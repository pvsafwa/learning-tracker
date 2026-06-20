# 10 — Terraform and remote state

## a) What & Why (theory)

**Terraform** lets you describe cloud infrastructure as **code** — you write what you want (a VPC,
an EC2, a database) in `.tf` files, and Terraform creates/updates it for you. The benefits: it's
repeatable, reviewable, and you can tear everything down and rebuild it identically (great for cost
control — destroy at night, recreate next session).

Terraform tracks what it created in a **state file**. By default that file sits on your laptop,
which is dangerous: lose it and Terraform forgets what it owns (orphaned resources still cost
money); two runs at once can corrupt it; it can contain secrets in plain text. So the standard is
**remote state**: store it in an **S3 bucket** (durable, versioned, encrypted) with a **lock** so
two runs can't clash. This is the foundation you set up *before* building anything else.

## b) What we actually did

**Installed the tools** on the Mac (Homebrew):
```bash
brew install awscli
brew tap hashicorp/tap && brew install hashicorp/tap/terraform
```

**Bootstrapped the state backend** with the CLI (these must exist *before* Terraform can use them —
the classic chicken-and-egg, so they're created once by hand). Run with the MFA-gated `admin`
profile:
```bash
# create the state bucket (us-east-1 needs no location flag)
aws s3api create-bucket --bucket safwan-tfstate-729147110687 --region us-east-1 --profile admin
# keep version history of the state (lets you recover a broken state)
aws s3api put-bucket-versioning --bucket safwan-tfstate-729147110687 \
  --versioning-configuration Status=Enabled --profile admin
# encrypt the state at rest
aws s3api put-bucket-encryption --bucket safwan-tfstate-729147110687 \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
  --profile admin
# block ALL public access to the bucket
aws s3api put-public-access-block --bucket safwan-tfstate-729147110687 \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
  --profile admin
```

**The Terraform config** (`~/aws-platform/main.tf`) — the final, working version:
```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  backend "s3" {
    bucket       = "safwan-tfstate-729147110687"
    key          = "global/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true          # S3-native locking (no DynamoDB needed)
  }
}

provider "aws" {
  region = "us-east-1"           # NOTE: no `profile` here — creds come from the environment
}
```

**The run workflow** (because the S3 backend can't do an interactive MFA prompt — see
trial-and-error): do the MFA step first, export the resulting short-lived creds into the shell, then
run Terraform:
```bash
aws sts get-caller-identity --profile admin                    # 1) MFA prompt, caches the session (~1h)
eval "$(aws configure export-credentials --profile admin --format env)"  # 2) put short-lived creds in env vars
terraform init                                                 # 3) Terraform uses those env creds
terraform plan                                                 # -> "No changes" = backend + auth all work
```

**Version control** the infra code (`~/aws-platform`): `git init`, a `.gitignore` that excludes
`.terraform/`, `*.tfstate*`, and `*.tfvars` (secrets) — but **keeps** `.terraform.lock.hcl`
(commit that; it pins the exact provider version).

## c) Trial-and-error log

- **Attempt 1 — `terraform init` with `dynamodb_table` for locking and `profile = "admin"` in the
  backend.** Two problems came back:

  1. **Warning:** `The parameter "dynamodb_table" is deprecated. Use parameter "use_lockfile" instead.`
     - Meaning: newer Terraform locks the state *directly in S3* (S3-native locking) — no separate
       DynamoDB table needed. **Fix:** replace `dynamodb_table = "..."` with `use_lockfile = true`.
       (The DynamoDB table we'd created became unused and can be deleted.)

  2. **Error:** `assume role with MFA enabled, but AssumeRoleTokenProvider session option not set.`
     - Meaning: the S3 **backend** can't pop up an MFA prompt like the CLI can. With
       `profile = "admin"` (which assumes a role with MFA), the backend had no way to ask for the
       code, so it failed.
     - **Fix:** stop making Terraform do the MFA-assume-role itself. Do the MFA step first, **export
       the already-approved short-lived credentials into the shell as environment variables**, and
       remove `profile` from the backend and provider. Terraform then just uses the env credentials.
       (That's the `aws configure export-credentials` workflow shown above.)

- **Attempt 2 — re-run with `use_lockfile = true`, no `profile`, and exported env creds.**
  - Result: `Successfully configured the backend "s3"!` and then `terraform plan` →
    `No changes. Your infrastructure matches the configuration.` plus `Releasing state lock.`
  - Why it worked: env-var credentials need no interactive MFA; S3-native locking acquired and
    released a lock cleanly. The IaC foundation is solid.

## d) Diagram — remote state

```
   your Mac (terraform)
        │  short-lived MFA creds (exported to env vars)
        ▼
   S3 bucket  safwan-tfstate-729147110687
     ├─ holds terraform.tfstate   (versioned + encrypted + public access blocked)
     └─ S3-native LOCK (use_lockfile) so two runs can't clash
```

## e) Key takeaways / gotchas
- **Remote state in S3** (versioned, encrypted, public-access-blocked) is the foundation before any
  infrastructure. Never rely on local state for real infra.
- Newer Terraform locks state **natively in S3** (`use_lockfile = true`) — **no DynamoDB needed.**
- The **S3 backend can't do interactive MFA.** The fix: `aws configure export-credentials` to put
  short-lived creds in env vars, and don't put `profile` in the backend/provider.
- Those env credentials **expire in ~1 hour** — re-run the two `aws` lines to refresh.
- **Commit `.terraform.lock.hcl`**; never commit `*.tfstate` or `*.tfvars`.
