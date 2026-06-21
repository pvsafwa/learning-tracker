# 14 — Jenkins controller vs agents (the architecture)

> This topic is mostly concept — but it's an important correction, and it changes how the pipeline is
> written from here on. It came from a sharp question you asked, not from me getting it right first.

## a) What & Why (theory)

A proper Jenkins setup has **two separate roles**:

- **The controller.** This is the Jenkins brain: it serves the web UI, schedules jobs, stores all the
  configuration, and holds the credentials (the deploy key, the registry token). In a real setup the
  controller should run **no builds at all.** Two reasons:
  1. **Security.** The controller is high-value (it holds your secrets). You do *not* want to run
     untrusted build code on it. And builds often need Docker — giving the controller access to the
     Docker engine is effectively giving it root on the host, which is exactly what you avoid on a
     controller.
  2. **Stability.** A runaway build shouldn't be able to crash the thing that runs everything.
  Best practice: set the controller's **executors to 0**, so it physically can't run a build.

- **The agents.** These do the actual work — checking out code, running tests, building images. They
  carry the tools (Node, image builders). With our **ephemeral k3s agents**, each build spins up a
  fresh **pod**, runs in it, and the pod is **deleted** afterward. Clean, isolated, disposable.

## b) The correction (what was wrong, and the fix)

On the **home** Jenkins, we ran builds with `agent any`. That made the **controller also the
executor** — the controller itself ran the build. That's why, on the home box, we had to install
Docker (`usermod -aG docker jenkins`) and the Node tool *on the controller*. **That was a
single-machine simplification, not the real way.**

When we moved to AWS with a proper controller + k3s agents, you correctly asked: *"Why does the
controller need Docker access, and where does the Node tool get installed, if the agents do the
work?"* The honest answer: **it doesn't, and the Node tool doesn't go on the controller at all.** On
AWS:
- The controller gets **no Docker access** and **no Node tool** — and its executors are set to **0**.
- The **agent pods** carry the tools.

## c) How agents get their tools (the new way)

With the Jenkins **Kubernetes plugin**, you don't "install tools." Instead, each build runs in a
**pod made of containers that already have the tools.** You describe the pod right in the Jenkinsfile:

```groovy
agent {
    kubernetes {
        yaml '''
          apiVersion: v1
          kind: Pod
          spec:
            containers:
            - name: node                # the Node steps run in here
              image: node:22
              command: [sleep]
              args: ["infinity"]
            - name: kaniko              # builds + pushes the image, with NO Docker daemon
              image: gcr.io/kaniko-project/executor:debug
              command: [sleep]
              args: ["infinity"]
        '''
    }
}
```
and the steps say which container to run in:
```groovy
container('node')   { sh 'npm ci && npm test' }     // uses node:22 — no "NodeJS tool" plugin needed
container('kaniko') { sh '/kaniko/executor ...' }   // builds the image without a Docker socket
```

Two big swaps from the home setup:
- The **`node:22` container is your Node.** No NodeJS-tool plugin on the controller.
- **Kaniko** builds and pushes images **without a Docker daemon.** This matters because on Kubernetes
  you can't (and shouldn't) hand a build the privileged Docker socket. Kaniko reads your `Dockerfile`
  and builds + pushes the image from inside a normal container — no daemon, no root-equivalent
  access. (BuildKit is another tool that does the same job.)

## d) What we actually did
This topic was the *decision* and the architecture. The concrete setup that makes it real — the
Kubernetes service account, the plugin "cloud" config, and the proof that a build runs on a throwaway
pod — is in the next topic, [15 — Wiring Jenkins to the k3s cluster](15-wiring-jenkins-to-k3s.md).

## e) Trial-and-error log
No command failed here — this was a **thinking** correction. The honest record: I lazily carried the
home setup (controller-does-everything) over to AWS, and **you caught it** by reasoning about the
controller/agent split. That's exactly the kind of question that separates "followed a tutorial" from
"understands the architecture." The fix was to move the build tools off the controller and into agent
pods, and to set the controller's executors to 0.

## f) Diagram — how a build actually runs now

```
   Jenkins CONTROLLER (orchestrates only, executors = 0)
        │ 1. tells k3s "create an agent pod"
        ▼
   k3s cluster ──▶ creates a POD (agent) with: [node container] [kaniko container]
                        │ 2. agent connects BACK to the controller
                        │ 3. build steps run INSIDE the pod's containers
                        │       container('node')  -> npm test
                        │       container('kaniko')-> build + push image
                        ▼
                   4. pod is DELETED when the build ends
```

## g) Key takeaways / gotchas
- **Controller orchestrates; agents build.** Keep build tools and Docker **off** the controller; set
  its executors to **0**.
- The controller still holds the **secrets** and **fetches the Jenkinsfile** — it just doesn't run
  the build steps.
- On Kubernetes, tools come from **container images in the agent pod**, not from plugins on the
  controller. A `node:22` container *is* your Node.
- Build images with **Kaniko** (daemonless) — never hand a Kubernetes build the Docker socket.
- `agent any` (controller-as-executor) is a single-machine shortcut; `agent { kubernetes { ... } }`
  is the real, scalable way.
