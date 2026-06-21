# 13 — The k3s (Kubernetes) cluster, as Terraform code

## a) What & Why (theory)

**Kubernetes** (often written "k8s") is a system that **runs and manages containers** for you across
one or more machines. Instead of you starting a container by hand and hoping it stays up, you tell
Kubernetes "I want this app running," and it takes care of starting it, restarting it if it crashes,
running several copies, and replacing them during updates. It's the standard way large companies run
containerized apps.

**k3s** is a **lightweight version of Kubernetes** — fully compatible, but small and simple enough to
run on a single modest server. We chose it because full Kubernetes (or AWS's managed EKS) is heavy
and **expensive** (EKS charges ~$73/month just for its control plane, before any worker machines).
k3s gives us a real Kubernetes cluster for the cost of one EC2.

**What we'll use this cluster for** (all on this one cluster, to save money):
- **Ephemeral Jenkins build agents** — each build spins up a throwaway pod here, runs, and is deleted
  (topic 14 and 15).
- **Stage** and **Prod** environments — as two separate *namespaces* (a namespace is just a labelled
  section of the cluster) on the same node.

A bit of vocabulary you'll see:
- **Node** — a machine in the cluster (we have one).
- **Control plane** — the "brain" of Kubernetes that schedules and tracks everything. On a single
  k3s node, the control plane and the workloads run on the same machine.
- **Pod** — the smallest unit Kubernetes runs; basically one or more containers grouped together.

## b) The decisions (ADR)

| Decision | What we chose | Why |
|---|---|---|
| Topology | **Single-node** k3s | Cheapest, simplest. *Honest trade-off: real production uses multiple nodes so one failure doesn't take everything down — single-node is a learning/cost compromise.* |
| Instance size | **`m7i-flex.large`** (2 vCPU, **8 GB**) + stop-when-idle | It must hold k3s itself + Stage + Prod + transient build-agent pods. 2 GB would run out of memory; 8 GB gives comfortable headroom and avoids debugging out-of-memory crashes. |
| Subnet | **Public** subnet, locked down by firewall | It needs the internet to pull container images, and we deliberately have no NAT Gateway (cost). |
| Firewall | k3s API (port **6443**) reachable **only from the Jenkins server's security group**; no SSH | Jenkins talks to the cluster privately over the VPC; you get a shell via SSM. |
| Login | **SSM Session Manager** + a keyless IAM **instance role** | Same secure pattern as the Jenkins server. |
| Install | user-data: `curl -sfL https://get.k3s.io \| sh -` | k3s installs in one command — perfect for a boot script. |

**Cost note:** `m7i-flex.large` is ~$0.096/hour *while running*. Because you **stop it when you're
not practicing**, the real cost is per hour of use — a 3-hour session is about 36 cents.

## c) What we actually did

### Create `k3s-user-data.sh` (the boot script)
```bash
#!/bin/bash
set -euxo pipefail
# Install k3s as a single-node server.
# --write-kubeconfig-mode 644 makes the cluster's kubeconfig file readable, so we can grab it later
# (to hand the connection details to Jenkins).
curl -sfL https://get.k3s.io | sh -s - server --write-kubeconfig-mode 644
```

### Create `k3s.tf` (the full file)
```hcl
# ---------- Keyless identity for the k3s node (SSM access) ----------
resource "aws_iam_role" "k3s" {
  name = "${var.project}-k3s-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "k3s_ssm" {
  role       = aws_iam_role.k3s.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "k3s" {
  name = "${var.project}-k3s-profile"
  role = aws_iam_role.k3s.name
}

# ---------- Firewall: k3s API reachable ONLY from the Jenkins server; no SSH ----------
resource "aws_security_group" "k3s" {
  name        = "${var.project}-k3s-sg"
  description = "k3s cluster firewall"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "k3s API 6443 from the Jenkins server security group"   # NOTE: no apostrophe! (see trial-and-error)
    from_port       = 6443
    to_port         = 6443
    protocol        = "tcp"
    security_groups = [aws_security_group.jenkins.id]   # reference the Jenkins SG, not an IP address
  }
  egress {
    description = "all outbound (pull images, k3s install, SSM)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project}-k3s-sg" }
}

# ---------- The k3s node ----------
resource "aws_instance" "k3s" {
  ami                    = data.aws_ami.ubuntu.id   # reuses the Ubuntu lookup defined in jenkins.tf
  instance_type          = "m7i-flex.large"          # 8 GB, free-tier-eligible on this account
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.k3s.id]
  iam_instance_profile   = aws_iam_instance_profile.k3s.name
  user_data              = file("${path.module}/k3s-user-data.sh")
  tags                   = { Name = "${var.project}-k3s" }
}

output "k3s_instance_id" { value = aws_instance.k3s.id }
output "k3s_private_ip"  { value = aws_instance.k3s.private_ip }
```

### Apply and verify
```bash
aws sts get-caller-identity --profile admin
eval "$(aws configure export-credentials --profile admin --format env)"
terraform plan      # 5 resources to add (role, attachment, profile, SG, instance)
terraform apply     # type 'yes'
```
After ~2–3 minutes, connect via **SSM** to the `learning-tracker-k3s` instance and check it's up:
```bash
sudo k3s kubectl get nodes
# NAME            STATUS   ROLES           AGE   VERSION
# ip-10-0-1-224   Ready    control-plane   81s   v1.35.5+k3s1
```
`STATUS = Ready` means the cluster is live. (Our node's private IP came out as `10.0.1.224`.)

## d) Trial-and-error log

- **Attempt 1 — instance size.** I first suggested `t3.medium` (4 GB), but it wasn't in the
  free-tier-eligible list for this account. The available options were `t3.micro` (1 GB),
  `t3.small` (2 GB), `c7i-flex.large` (4 GB), and `m7i-flex.large` (8 GB).
  - What we learned: 2 GB is too small for k3s + Stage + Prod + agent pods (it would run out of
    memory), and 4 GB is right at the edge. Since the real cost is **per hour of use** (we stop the
    node when idle), we picked **`m7i-flex.large` (8 GB)** for headroom — avoiding memory-crash
    debugging is worth a slightly higher hourly rate.

- **Attempt 2 — `terraform plan` failed on the security-group description.** Exact error:
  ```
  Error: "ingress.0.description" doesn't comply with restrictions (...): "k3s API (6443) from the Jenkins server's security group only"
  ```
  - Cause: **AWS security-group descriptions can't contain an apostrophe** (`'`), and I had written
    "server's".
  - Fix: removed the apostrophe → "k3s API 6443 from the Jenkins server security group". Then it
    planned fine. (Lesson: keep SG descriptions to plain letters, numbers, spaces, and simple symbols.)

- **A counting clarification.** I said the plan would add "~6 resources," but it showed **5**. The
  five real resources are the IAM role, the policy attachment, the instance profile, the security
  group, and the instance. The "outputs" aren't resources — they're just values Terraform prints, so
  they don't count. **5 was correct.**

- After those two fixes, `terraform apply` finished cleanly and `kubectl get nodes` showed `Ready`.

## e) Key takeaways / gotchas
- **k3s = real Kubernetes, lightweight and cheap.** Use it instead of EKS (~$73/mo control plane) for
  small/learning setups.
- Size the node for **headroom** — k3s + Stage + Prod + build agents need RAM; 8 GB avoids
  out-of-memory pain. Cost is per-hour-of-use, so **stop the node when idle.**
- **AWS security-group descriptions reject apostrophes** (and a few other punctuation marks).
- Reference one security group from another (`security_groups = [aws_security_group.jenkins.id]`) to
  allow traffic *between* servers without hard-coding IPs.
- **Outputs are not resources** — a plan's "N to add" counts only real resources.
- Single-node is a cost compromise; real production uses multiple nodes for high availability.
