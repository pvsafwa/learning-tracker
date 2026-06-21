# 15 — Wiring Jenkins to the k3s cluster

This is where the controller (topic 12) and the cluster (topic 13) get connected, so that builds run
on **throwaway pods** (the architecture from topic 14). When this works, you have a real, modern CI
platform.

## a) What & Why (theory)

For the Jenkins controller to create agent pods on the cluster, three things have to be true:

1. **The controller must be allowed to talk to the cluster** — it needs an *identity inside
   Kubernetes* (a **ServiceAccount**) with permission to create and manage pods (that permission is
   granted by **RBAC** — Role-Based Access Control), plus a **token** to prove that identity, the
   cluster's **CA certificate** (so the connection is trusted), and the cluster's **API address**.
2. **There must be a network path both ways:**
   - controller → cluster on port **6443** (the Kubernetes API) — *the agent pod gets created*. (We
     already opened this in topic 13.)
   - agent pod → controller on port **8080** — *the agent connects back to register and receive work*.
     (We open this here.)
3. **The Kubernetes plugin must be configured** in Jenkins with all of the above.

A subtle but important point: when an agent pod connects *back* to the controller, it must use the
controller's **private IP** (the `10.0.x.x` address inside the VPC), **not** the public Elastic IP.
Servers inside the same VPC reach each other privately; using the public IP from inside the VPC
doesn't route cleanly.

## b) What we actually did

### Part 1 — the agent-callback firewall rule (Terraform, on the Mac)
We let agent pods on k3s reach the Jenkins controller on 8080. We use a **separate rule resource**
(not an inline rule) on purpose: if both security groups referenced each other with inline rules,
Terraform would see a **circular dependency**. A standalone rule breaks that loop.
```hcl
# Let agent pods on k3s connect BACK to the Jenkins controller on 8080 (WebSocket agents)
resource "aws_vpc_security_group_ingress_rule" "jenkins_agents_from_k3s" {
  security_group_id            = aws_security_group.jenkins.id
  referenced_security_group_id = aws_security_group.k3s.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  description                  = "Jenkins agents on k3s connect back over 8080"
}

# also output the controller's PRIVATE ip — the agents need it
output "jenkins_private_ip" { value = aws_instance.jenkins.private_ip }
```
Apply it (`terraform apply`). It gave us `jenkins_private_ip = 10.0.1.197`.

### Part 2 — the ServiceAccount + RBAC + token (on the k3s node, via SSM)
Connect via SSM to `learning-tracker-k3s`, then apply this. It creates a `jenkins` namespace, a
ServiceAccount, the RBAC that lets it manage pods, and a **token Secret** (explained in
trial-and-error):
```bash
sudo k3s kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Namespace
metadata: { name: jenkins }
---
apiVersion: v1
kind: ServiceAccount
metadata: { name: jenkins, namespace: jenkins }
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role                                # what Jenkins is allowed to do in this namespace
metadata: { name: jenkins-agents, namespace: jenkins }
rules:
- apiGroups: [""]
  resources: ["pods", "pods/exec", "pods/log"]
  verbs: ["get", "list", "watch", "create", "delete", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding                         # attaches the Role above to the jenkins ServiceAccount
metadata: { name: jenkins-agents, namespace: jenkins }
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: Role, name: jenkins-agents }
subjects:
- { kind: ServiceAccount, name: jenkins, namespace: jenkins }
---
apiVersion: v1
kind: Secret                              # a long-lived token for the ServiceAccount
metadata:
  name: jenkins-token
  namespace: jenkins
  annotations: { kubernetes.io/service-account.name: jenkins }
type: kubernetes.io/service-account-token
EOF
```
Then grab the two values Jenkins needs:
```bash
# The TOKEN (this is a credential — don't paste it into chats/files you share):
sudo k3s kubectl -n jenkins get secret jenkins-token -o jsonpath='{.data.token}' | base64 -d; echo

# The cluster CA certificate (copy the whole BEGIN/END block):
sudo k3s kubectl -n jenkins get secret jenkins-token -o jsonpath='{.data.ca\.crt}' | base64 -d
```

### Part 3 — configure Jenkins (in the browser)
1. Manage Jenkins → **Plugins** → install **Kubernetes**.
2. Manage Jenkins → **Nodes** → **Built-In Node** → set **# of executors = 0** (controller stops
   running builds itself).
3. Manage Jenkins → **Credentials** → add a **Secret text** credential holding the **token**, ID
   `k3s-jenkins-token`.
4. Manage Jenkins → **Clouds** → Add a new cloud → **Kubernetes**, and fill in:

   | Field | Value |
   |---|---|
   | Kubernetes URL | `https://10.0.1.224:6443` (the k3s node's private IP) |
   | Kubernetes server certificate key | the **CA cert** from Part 2 |
   | Credentials | `k3s-jenkins-token` |
   | Namespace | `jenkins` |
   | Jenkins URL | `http://10.0.1.197:8080` (the controller's **private** IP — not the public 52.x) |
   | WebSocket | ✅ checked (agents connect over the HTTP port, no separate agent port needed) |

   Click **Test Connection** → expect *"Connected to Kubernetes ..."*.

### Part 4 — the proof (a test pipeline)
A throwaway Pipeline job (`k8s-agent-test`) with an **inline** script (no GitHub needed yet, so we
test the agent in isolation):
```groovy
pipeline {
  agent {
    kubernetes {
      yaml '''
        apiVersion: v1
        kind: Pod
        spec:
          containers:
          - name: node
            image: node:22-alpine
            command: [sleep]
            args: ["infinity"]
      '''
    }
  }
  stages {
    stage('Run on a throwaway pod') {
      steps {
        container('node') {
          sh 'node --version && echo "Hello from an ephemeral k3s agent!"'
        }
      }
    }
  }
}
```
The console output proved the whole loop works:
```
Created Pod: jenkins/k8s-agent-test-1-1xs28-sjnd5-d2bzc
...
JENKINS_WEB_SOCKET: "true"
JENKINS_URL: "http://10.0.1.197:8080/"
...
+ node --version
v22.23.0
+ echo 'Hello from an ephemeral k3s agent!'
Hello from an ephemeral k3s agent!
Finished: SUCCESS
```
That log shows: Jenkins created a pod on k3s, the pod's agent connected **back over WebSocket to the
private IP** (`10.0.1.197:8080`), the step ran inside the `node` container (`v22.23.0`), and the pod
was torn down. **The platform works end to end.**

## c) Trial-and-error log

- **It all came from the architecture correction** (topic 14): once we knew agents do the work, this
  wiring became the next job.

- **The ServiceAccount token (k8s 1.24+ behaviour).** Newer Kubernetes **no longer auto-creates a
  long-lived token** for a ServiceAccount. So `kubectl get secret` on the SA would show nothing. We
  fixed this by **explicitly creating a Secret** of type `kubernetes.io/service-account-token` with
  the `kubernetes.io/service-account.name: jenkins` annotation — Kubernetes then fills it with a
  token. That's why the YAML in Part 2 includes that Secret.

- **The test passed on the first run** once the cloud was configured — Jenkins created the pod, the
  agent connected back, and it printed *"Hello from an ephemeral k3s agent!"*.

- **An honest mentor mistake:** the test result was attached as a file, and I answered as if Part 3–4
  were still pending because I **didn't open the attached file**. You pointed it out, I read it, and
  it had already SUCCEEDED. Lesson for me: always read the attached file.

## d) Key takeaways / gotchas
- The controller authenticates to the cluster with a **ServiceAccount + RBAC + token + CA cert**.
- On Kubernetes 1.24+, **create the token Secret explicitly** (with the SA-name annotation) — SAs no
  longer auto-generate long-lived tokens.
- The agent's **Jenkins URL must be the controller's private IP**, not the public Elastic IP
  (in-VPC traffic stays private).
- You need **two firewall directions**: controller → cluster (6443) and agent → controller (8080).
  Use a **standalone rule resource** for the second one to avoid a circular reference between the SGs.
- Use **WebSocket** agents so they connect over the HTTP port — no separate agent port to open.
- Don't forget **controller executors = 0**.
- Minimum RBAC for the plugin: `pods`, `pods/exec`, `pods/log` with `get/list/watch/create/delete`.
