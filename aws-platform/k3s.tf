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
    description     = "k3s API 6443 from the Jenkins server security group"   # <- no apostrophe
    from_port       = 6443
    to_port         = 6443
    protocol        = "tcp"
    security_groups = [aws_security_group.jenkins.id]
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
  ami                    = data.aws_ami.ubuntu.id   # reuses the Ubuntu lookup from jenkins.tf
  instance_type          = "m7i-flex.large"          # 8 GB, free-tier-eligible on your account
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.k3s.id]
  iam_instance_profile   = aws_iam_instance_profile.k3s.name
  user_data              = file("${path.module}/k3s-user-data.sh")
  root_block_device {          # <-- ADD THIS BLOCK
    volume_size = 40           # GB — room for k3s + CI images + Stage/Prod + Trivy DB
    volume_type = "gp3"        # gp3 = cheaper and faster baseline than the old gp2 default
  }
  tags                   = { Name = "${var.project}-k3s" }
}

output "k3s_instance_id" { value = aws_instance.k3s.id }
output "k3s_private_ip"  { value = aws_instance.k3s.private_ip }