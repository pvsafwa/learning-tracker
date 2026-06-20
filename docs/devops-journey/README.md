# DevOps Journey — Learning Tracker

This is a **teaching record**, not a changelog. It walks through everything we built to take
this app from "runs on my laptop" toward "runs on AWS like a real production system" — and it
explains the **why** behind every decision in plain English, so you (or a future you) can pick
it up from zero.

## Who this is for
Someone who is new to DevOps and not super comfortable with technical English. Every topic
starts from "assume you know nothing" and builds up.

## How each topic is organized
Every file has the same five parts:
1. **What & Why (theory)** — what the thing is, in plain words, and why our app needed it.
2. **What we actually did** — the real commands, configs, and files, with comments.
3. **Trial-and-error log** — the things that failed first, the exact errors, and how we fixed
   them. (Failing and fixing is how you actually learn this stuff, so we keep the record.)
4. **Diagram** — a simple picture, only where it helps. *(They're drawn as text-art inside
   code blocks so they render correctly in any editor and on GitHub.)*
5. **Key takeaways / gotchas** — the few things to really remember.

## The topics, in the order we did them
1. [App and containers — the foundations](01-app-and-containers-foundations.md)
2. [The Dockerfile — from naive to production](02-the-dockerfile.md)
3. [Running it locally with Docker Compose](03-running-locally-docker-compose.md)
4. [CI/CD — the core ideas](04-cicd-concepts.md)
5. [Jenkins setup and connecting to GitHub](05-jenkins-setup-and-github.md)
6. [The CI pipeline (the Jenkinsfile)](06-the-ci-pipeline.md)
7. [Auto-triggering builds — polling vs webhook](07-auto-trigger-polling-vs-webhook.md)
8. [The target AWS architecture](08-target-aws-architecture.md)
9. [AWS account security and identity](09-aws-account-security-and-identity.md)
10. [Terraform and remote state](10-terraform-and-remote-state.md)

---

## CURRENT STATE & NEXT STEPS
*(This is the most important section to read when resuming. Updated when this doc was written.)*

### What exists and works right now
- **The app**: a Node.js + TypeScript + Express monolith (a "learning tracker" SaaS) backed by
  PostgreSQL. One codebase, one process — a **monolith**, not microservices.
- **Dockerfile**: a hardened, 3-stage build on `node:22-alpine`. Non-root, npm removed, with a
  healthcheck. The image is small and scans clean. It builds and runs.
- **Local run**: `docker compose up` brings the app + a Postgres database up together; the app
  serves on port 4173 and answers `/healthz`.
- **CI pipeline (Jenkins, on the home Ubuntu laptop)**: a multi-stage Jenkinsfile that on each
  build runs — Install → Quality (lint, format, typecheck, unit tests) → Security (npm audit,
  gitleaks, hadolint, semgrep — **all enforcing/blocking now**) → Build image (tagged by git
  commit) → Trivy image scan (enforcing) → Push to GitHub Container Registry (GHCR). It is
  **green**. Jenkins reaches GitHub via a read-only SSH deploy key; secrets live in Jenkins'
  credential store.
- **AWS foundations**: account secured (root has MFA, no root keys, billing budget alarm). A
  gold-standard-within-constraints identity: an IAM user `safwan` that can only *assume* an
  `admin` role, and only with MFA, giving short-lived credentials. AWS CLI + Terraform installed
  on the Mac. **Terraform remote state** is live: an encrypted, versioned S3 bucket with
  S3-native locking. `terraform plan` runs clean.

### What is NOT done yet
- Builds are still triggered **manually** ("Build Now") — auto-trigger is undecided (polling vs
  a stable webhook). See topic 07.
- **Nothing is deployed anywhere yet** beyond local. No Dev/Stage/Prod environments exist.
- **No AWS infrastructure beyond the state backend** — no VPC, no EC2, no Jenkins-on-AWS, no
  k3s cluster, no Tailscale mesh. All of that is designed (topic 08) but not built.
- The **40 GB of course media** storage approach (EBS vs S3 vs EFS) is decided in principle but
  not implemented.
- The **branch/promotion model** (feature → dev → stage → prod with PR approvals) is designed
  but not set up in GitHub.

### What we were about to do next
**Phase 0.4 — real infrastructure as Terraform code**, starting with **0.4a: the network**
(a custom VPC, subnets, internet gateway, routing, security groups), then the **Tailscale mesh**,
then the **Jenkins controller EC2** (using a keyless IAM *instance role*), then the **k3s cluster**.
