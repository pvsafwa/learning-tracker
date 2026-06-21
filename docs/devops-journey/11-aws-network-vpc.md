# 11 — The AWS network (VPC), as Terraform code

## a) What & Why (theory)

Before any server can run in AWS, it needs a **network** to live in. AWS gives every account a
"default" network, but the proper, gold-standard way is to build **your own** — a
**VPC (Virtual Private Cloud)**. Think of a VPC as **your own private slice of the AWS network** that
nobody else shares and that you fully control.

Inside that private slice, you divide the space into smaller sections called **subnets**. There are
two kinds, and the difference is simply *whether the internet can reach into them*:

- **Public subnets** — reachable from the internet. Anything that *needs* to be reached from outside
  (like the Jenkins server, which has to receive GitHub webhooks) lives here.
- **Private subnets** — **not** reachable from the internet. Anything that should stay hidden (like a
  database) lives here. It can still talk to other things *inside* the VPC.

A few supporting pieces make it all work:

- **Internet Gateway** — picture it as the single "door" between your whole VPC and the internet.
  Public subnets send their internet traffic out through this door.
- **Route tables** — these are the "signposts." A route table is a little list of rules that says
  "traffic going to *this* place should leave through *that* door." We give the public subnets a
  route that says "anything bound for the internet (`0.0.0.0/0`) → go out the Internet Gateway," and
  we give the private subnets a route table with **no** internet route at all.
- **Availability Zones (AZs)** — an AWS region (like `us-east-1`) is split into a few physically
  separate data-center groups called Availability Zones. If you spread your subnets across **two**
  AZs, then if one whole zone has an outage, the other can keep going. Subnets themselves are free,
  so using two AZs costs nothing extra and sets you up for high availability later.

**Why our app needed this:** every server we build after this — Jenkins, the k3s cluster, the
database — has to sit *somewhere*. The VPC is that "somewhere," and building it ourselves (instead of
using the default) is what lets us control exactly what's reachable, lock down firewalls properly,
and keep the database hidden.

## b) The decision (ADR) — the one that saved real money

There is one network piece that **costs real money**: a **NAT Gateway**. Its job is to let
*private* subnets reach *out* to the internet (for example, to download software) while still being
unreachable *from* the internet. It is the gold-standard piece for private workloads — **but it
costs about $32/month, running all the time**, whether you use it or not.

- **Context:** We have a $200 credit and need it to last months.
- **Options:** (A) private subnets + a NAT Gateway (most correct, ~$32/mo always on); (B) put
  internet-needing servers in *public* subnets and lock them down hard with firewalls, keeping a
  private subnet only for the database (which doesn't need outbound internet).
- **Decision:** Option B — **skip the NAT Gateway.**
- **Trade-off / consequence:** the private subnets can't reach the internet outbound. That's fine for
  a database. If we ever need a private server that *does* need the internet, we'd add a NAT then.
- **How it'll be challenged ("why not private + NAT?"):** *"On a funded production system I'd run the
  compute in private subnets behind a NAT Gateway. On a $200 learning budget I used public subnets
  with tight security groups, and a private subnet only for the database, to avoid the ~$32/month NAT
  cost."* That answer shows you know the right way **and** made a defensible cost call.

## c) What we actually did

Everything lives in `~/aws-platform` (the infrastructure repo). We split it into three files by
purpose — this is good Terraform structure.

**`variables.tf`** — the values we might want to change, all in one place:
```hcl
variable "region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Name prefix used when tagging resources"
  type        = string
  default     = "learning-tracker"
}

variable "vpc_cidr" {
  description = "The IP address range for the whole VPC"
  type        = string
  default     = "10.0.0.0/16"   # ~65,000 addresses; plenty of room
}
```

**`network.tf`** — the network itself (the full file, nothing left out):
```hcl
# Look up which Availability Zones exist in this region, so we never hard-code AZ names
data "aws_availability_zones" "available" {
  state = "available"
}

# The VPC = our own private network in AWS
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true     # let instances get DNS names
  enable_dns_support   = true
  tags = { Name = "${var.project}-vpc" }
}

# Internet Gateway = the single door between the VPC and the internet
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project}-igw" }
}

# Two PUBLIC subnets (one per AZ). cidrsubnet() carves /24 ranges out of the /16.
# -> 10.0.1.0/24 and 10.0.2.0/24
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true   # servers launched here get a public IP automatically
  tags = { Name = "${var.project}-public-${count.index + 1}" }
}

# Two PRIVATE subnets (one per AZ). -> 10.0.11.0/24 and 10.0.12.0/24
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 11)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "${var.project}-private-${count.index + 1}" }
}

# PUBLIC route table: send internet-bound traffic (0.0.0.0/0) out the Internet Gateway
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${var.project}-public-rt" }
}

# Tie each public subnet to the public route table
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# PRIVATE route table: NO internet route (no NAT Gateway -> saves ~$32/month).
# Private subnets can only talk INSIDE the VPC.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project}-private-rt" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
```

**`outputs.tf`** — print the IDs we'll need when we add servers later:
```hcl
output "vpc_id"             { value = aws_vpc.main.id }
output "public_subnet_ids"  { value = aws_subnet.public[*].id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
```

**How we applied it** (on the Mac, in `~/aws-platform`). Remember the credential dance from topic 10
— the S3 backend can't do an interactive MFA prompt, so we get short-lived credentials into the
shell first:
```bash
aws sts get-caller-identity --profile admin                 # MFA prompt, caches the session
eval "$(aws configure export-credentials --profile admin --format env)"   # put creds in env vars
terraform plan      # review: it planned to ADD ~13 resources
terraform apply     # type 'yes' to create them
```

The real IDs it produced (yours will differ):
```
vpc_id             = "vpc-0e0388eba11aa29a9"
public_subnet_ids  = ["subnet-0de300316b7799c3c", "subnet-041dd3e66253757f9"]
private_subnet_ids = ["subnet-0a2750cfe0cd103ab", "subnet-0f81002530941a6da"]
```

## d) Trial-and-error log

This applied **cleanly on the first try** — no failures. The only "surprise" was a happy one:
because there's no NAT Gateway and no servers yet, the VPC + subnets + route tables + internet
gateway have **no hourly charge at all**, so the entire network costs **~$0/month** by itself. The
credit only starts being spent when we add servers.

## e) Diagram — what we built

```
  ┌──────────────────────── VPC  10.0.0.0/16 ───────────────────────┐
  │                                                                  │
  │   Internet Gateway (the door) ── public route table (0.0.0.0/0)  │
  │        │                                                         │
  │   ┌────┴─────────┐        ┌──────────────┐                       │
  │   │ public-1     │        │ public-2     │   (AZ a / AZ b)       │
  │   │ 10.0.1.0/24  │        │ 10.0.2.0/24  │   <- servers go here  │
  │   └──────────────┘        └──────────────┘                       │
  │   ┌──────────────┐        ┌──────────────┐                       │
  │   │ private-1    │        │ private-2    │   <- database goes    │
  │   │ 10.0.11.0/24 │        │ 10.0.12.0/24 │      here (no internet)│
  │   └──────────────┘        └──────────────┘                       │
  └──────────────────────────────────────────────────────────────────┘
```

## f) Key takeaways / gotchas
- A VPC, subnets, route tables, and the internet gateway are **free** — cost only starts with
  servers or a NAT Gateway.
- **Skipping the NAT Gateway** is a legitimate, defensible cost choice: put internet-facing servers
  in public subnets and lock them down with firewalls; keep a private subnet for the database.
- **Two Availability Zones** cost nothing extra (subnets are free) and set you up for high
  availability later.
- Use a **data source** for AZ names and the `cidrsubnet()` function for the ranges — that way
  nothing is hard-coded and it works in any region.
- Split your Terraform by purpose (`variables.tf` / `network.tf` / `outputs.tf`) — it stays readable
  as it grows.
