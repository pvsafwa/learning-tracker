# Find which Availability Zones exist in this region (so we don't hard-code names)
data "aws_availability_zones" "available" {
  state = "available"
}

# The VPC = our own private network
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true     # let instances get DNS names
  enable_dns_support   = true
  tags = { Name = "${var.project}-vpc" }
}

# Internet Gateway = the door to the internet
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project}-igw" }
}

# Two PUBLIC subnets (one per AZ). 10.0.1.0/24 and 10.0.2.0/24
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1)   # carve /24s out of the /16
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true  # servers here get a public IP automatically
  tags = { Name = "${var.project}-public-${count.index + 1}" }
}

# Two PRIVATE subnets (one per AZ). 10.0.11.0/24 and 10.0.12.0/24
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 11)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "${var.project}-private-${count.index + 1}" }
}

# PUBLIC route table: internet-bound traffic (0.0.0.0/0) goes out the Internet Gateway
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${var.project}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# PRIVATE route table: NO internet route (no NAT Gateway -> saves ~$32/month).
# Private subnets can talk INSIDE the VPC only.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project}-private-rt" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}