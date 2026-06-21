# 12 — The Jenkins controller on AWS (Terraform)

## a) What & Why (theory)

We moved Jenkins off the home laptop and onto a real AWS server (an **EC2 instance** — "EC2" is just
AWS's name for a virtual machine you rent). Two big reasons:

1. **It becomes reachable from the internet.** GitHub can now send a webhook straight to it — no
   tunnel, no expiring URL. This is the clean fix for the whole problem we got stuck on in topic 07.
2. **It becomes the controller.** In the proper architecture (topic 14), the Jenkins controller only
   *orchestrates* — it schedules jobs, stores config, and holds credentials — while the actual
   building happens on separate, throwaway agents. So this server doesn't need to be powerful.

A few important ideas behind *how* we built it the gold-standard way:

- **Logging in via SSM Session Manager, not SSH.** Normally you'd open SSH (port 22) and use a key
  pair to get a shell on a server. But an open SSH port is an attack surface, and a key pair is
  something that can leak. AWS **Systems Manager (SSM) Session Manager** gives you a shell *through
  AWS itself* — so there is **no SSH port open and no key pair at all**, and every session is logged.
  That's the secure way.
- **A keyless IAM instance role.** A server often needs AWS permissions (here, the permission for SSM
  to work). The wrong way is to put access keys on the server. The right way is an **instance role**:
  you attach a role to the EC2, and the server automatically receives short-lived AWS credentials —
  nothing is stored, nothing can leak. This is the real gold standard for a machine's identity.
- **An Elastic IP.** A normal EC2's public IP changes if you stop and start it. An **Elastic IP** is a
  fixed public address you attach to the instance, so the address stays the same — which matters
  because a GitHub webhook needs a stable URL to point at.
- **A user-data script.** "User data" is a script AWS runs **once, on the server's first boot**. We
  use it so the server **installs Jenkins itself** — no manual steps, everything as code.

## b) The decisions (ADR)

| Decision | What we chose | Why |
|---|---|---|
| Operating system | Ubuntu 24.04 | Matches the home Jenkins; familiar `apt` commands. |
| Instance size | `t3.small` (2 vCPU, 2 GB) + stop-when-idle | Cheapest that runs a Jenkins *controller*; the heavy builds run on agents (topic 14), not here. |
| Login method | **SSM Session Manager** (no SSH) | No open SSH port, no key pair to leak, fully audited. |
| Server identity | **IAM instance role** (keyless) | Server gets temporary AWS creds automatically; nothing stored. |
| Firewall | Jenkins UI (8080) **from my home IP only** | Locks the UI to you. No SSH port at all. |
| Stable address | **Elastic IP** | The public address survives stop/start, so the webhook URL stays valid. |
| Installing Jenkins | **user-data script** | Infrastructure as code — the server installs itself. |

## c) What we actually did

### Find your home IP (on the Mac)
```bash
curl https://checkip.amazonaws.com     # e.g. 117.244.233.126
```

### Add a variable to `variables.tf`
```hcl
variable "my_ip_cidr" {
  description = "Your home public IP in CIDR form, e.g. 117.244.233.126/32. Find it: curl https://checkip.amazonaws.com"
  type        = string
}
```

### Create `terraform.tfvars` (git-ignored, so it stays off GitHub)
```hcl
my_ip_cidr = "117.244.233.126/32"   # YOUR ip, with /32 on the end (means "this one address")
```

### Create `jenkins-user-data.sh` (the install script the server runs on first boot)
We verified these commands against the official Jenkins docs — note Jenkins now needs **Java 21**,
and it must be installed **before** Jenkins:
```bash
#!/bin/bash
set -euxo pipefail   # stop on any error; print every command (so the log shows what happened)

# Install Java 21 FIRST (installing it before Jenkins avoids a startup failure)
apt-get update
apt-get install -y fontconfig openjdk-21-jre

# Add the official Jenkins apt repository (the key file name rolls over each year -> 2026 key)
mkdir -p /etc/apt/keyrings
wget -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key
echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  > /etc/apt/sources.list.d/jenkins.list

# Install Jenkins and make sure it runs now and on every boot
apt-get update
apt-get install -y jenkins
systemctl enable jenkins
systemctl start jenkins
```

### Create `jenkins.tf` (the full file)
```hcl
# Find the latest Ubuntu 24.04 (codename "noble") image from Canonical, so we never hard-code an AMI id
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]   # Canonical's official AWS account number
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*/ubuntu-noble-24.04-amd64-server-*"]
  }
}

# ---------- The keyless identity for the server (IAM instance role) ----------
resource "aws_iam_role" "jenkins" {
  name = "${var.project}-jenkins-role"
  assume_role_policy = jsonencode({          # who is allowed to "wear" this role: EC2 itself
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Allow logging in via SSM Session Manager (this is our access method)
resource "aws_iam_role_policy_attachment" "jenkins_ssm" {
  role       = aws_iam_role.jenkins.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# The "instance profile" is the wrapper that attaches the role to the EC2
resource "aws_iam_instance_profile" "jenkins" {
  name = "${var.project}-jenkins-profile"
  role = aws_iam_role.jenkins.name
}

# ---------- The firewall: Jenkins UI from MY ip only, no SSH ----------
resource "aws_security_group" "jenkins" {
  name        = "${var.project}-jenkins-sg"
  description = "Jenkins controller firewall"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Jenkins web UI, my IP only"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [var.my_ip_cidr]
  }
  egress {
    description = "all outbound (plugins, GitHub, SSM, apt...)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project}-jenkins-sg" }
}

# ---------- The Jenkins server ----------
resource "aws_instance" "jenkins" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.small"
  subnet_id              = aws_subnet.public[0].id          # one of our public subnets
  vpc_security_group_ids = [aws_security_group.jenkins.id]
  iam_instance_profile   = aws_iam_instance_profile.jenkins.name
  user_data              = file("${path.module}/jenkins-user-data.sh")
  tags                   = { Name = "${var.project}-jenkins" }
}

# ---------- A stable public IP (survives stop/start) ----------
resource "aws_eip" "jenkins" {
  instance = aws_instance.jenkins.id
  domain   = "vpc"
  tags     = { Name = "${var.project}-jenkins-eip" }
}

output "jenkins_instance_id" { value = aws_instance.jenkins.id }
output "jenkins_url"         { value = "http://${aws_eip.jenkins.public_ip}:8080" }
```

### Apply it (on the Mac, in `~/aws-platform`)
```bash
aws sts get-caller-identity --profile admin
eval "$(aws configure export-credentials --profile admin --format env)"
terraform plan      # ~6 resources to add (role, attachment, profile, SG, instance, EIP)
terraform apply     # type 'yes'
```
It produced (yours will differ):
```
jenkins_instance_id = "i-0b8bb6273928241e5"
jenkins_url         = "http://52.5.159.174:8080"
```

### Get into Jenkins (after ~3–4 minutes, so the install script finishes)
1. **Wait** a few minutes — the server is installing Java + Jenkins on first boot.
2. **Connect via SSM** to read the first-time admin password — easiest with **no extra tools**:
   AWS Console → **Systems Manager** → **Session Manager** → **Start session** → pick the
   `learning-tracker-jenkins` instance. Then run:
   ```bash
   sudo cat /var/lib/jenkins/secrets/initialAdminPassword
   ```
3. Open the `jenkins_url` in your browser, paste that password, **Install suggested plugins**, and
   create your admin user.

## d) Trial-and-error log

It **applied and booted cleanly** — no errors. The Ubuntu image lookup, the install script, SSM
access, and the unlock screen all worked first time.

The one thing that's not an error but is worth knowing: **your home IP is dynamic.** The firewall
only allows your *current* IP. If Jenkins suddenly stops loading one day, your home IP changed — just
update `my_ip_cidr` in `terraform.tfvars` and run `terraform apply` again.

## e) Key takeaways / gotchas
- **SSM Session Manager** beats SSH: no open SSH port, no key pair to leak, every session audited.
- A **keyless IAM instance role** is how a server should get AWS permissions — never put access keys
  on a server.
- An **Elastic IP** keeps the public address stable across stop/start — needed for a webhook URL.
- **Stop the instance when idle** — it's ~2¢/hour while running:
  `aws ec2 stop-instances --instance-ids <id> --profile admin`.
- The controller is intentionally small (`t3.small`) because, after topic 14, it only *orchestrates*
  — the heavy work runs on agents.
- The `file(...)` for user-data is read at **plan** time, so the `jenkins-user-data.sh` file must
  exist *before* you run `terraform plan`.
