# Find the latest Ubuntu 24.04 (noble) image from Canonical (so we never hard-code an AMI id)
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical's official AWS account
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*/ubuntu-noble-24.04-amd64-server-*"]
  }
}

# ---------- The keyless identity for the server (IAM instance role) ----------
resource "aws_iam_role" "jenkins" {
  name = "${var.project}-jenkins-role"
  assume_role_policy = jsonencode({         # who may "wear" this role: EC2 itself
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Allow logging in via SSM Session Manager (our access method)
resource "aws_iam_role_policy_attachment" "jenkins_ssm" {
  role       = aws_iam_role.jenkins.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# The "instance profile" attaches the role to the EC2
resource "aws_iam_instance_profile" "jenkins" {
  name = "${var.project}-jenkins-profile"
  role = aws_iam_role.jenkins.name
}

# ---------- The firewall: NO inline rules — every rule is a standalone resource ----------
resource "aws_security_group" "jenkins" {
  name        = "${var.project}-jenkins-sg"
  description = "Jenkins controller firewall"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${var.project}-jenkins-sg" }
}

# Jenkins web UI (8080) from your home IP only
resource "aws_vpc_security_group_ingress_rule" "jenkins_ui_from_home" {
  security_group_id = aws_security_group.jenkins.id
  cidr_ipv4         = var.my_ip_cidr
  ip_protocol       = "tcp"
  from_port         = 8080
  to_port           = 8080
  description       = "Jenkins web UI, home IP only"
}

# All outbound (plugins, GitHub, SSM, apt, pulling images...)
resource "aws_vpc_security_group_egress_rule" "jenkins_all_out" {
  security_group_id = aws_security_group.jenkins.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"          # all protocols/ports (so no from_port/to_port)
  description       = "all outbound"
}

# GitHub webhook delivery to /github-webhook/ on 8080
# Source ranges from https://api.github.com/meta (.hooks). GitHub changes these rarely — re-check occasionally.
resource "aws_vpc_security_group_ingress_rule" "jenkins_github_webhook" {
  for_each          = toset(var.github_webhook_cidrs)
  security_group_id = aws_security_group.jenkins.id
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 8080
  to_port           = 8080
  description       = "GitHub webhook on 8080"
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

# Let agent pods on k3s connect BACK to the Jenkins controller on 8080 (WebSocket agents)
resource "aws_vpc_security_group_ingress_rule" "jenkins_agents_from_k3s" {
  security_group_id            = aws_security_group.jenkins.id
  referenced_security_group_id = aws_security_group.k3s.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  description                  = "Jenkins agents on k3s connect back over 8080"
}

output "jenkins_private_ip" { value = aws_instance.jenkins.private_ip }