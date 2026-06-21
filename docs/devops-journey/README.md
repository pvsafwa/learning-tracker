# DevOps Journey — Learning Tracker

This is a **teaching record**, not a changelog. It walks through everything we built to take
this app from "runs on my laptop" to "runs on a real AWS platform" — and it explains the **why**
behind every decision in plain English, so you (or a future you) can pick it up from zero.

## Who this is for
Someone who is new to DevOps and not super comfortable with technical English. Every topic
starts from "assume you know nothing" and builds up.

## How each topic is organized
Every file has the same parts:
1. **What & Why (theory)** — what the thing is, in plain words, and why our app needed it.
2. **What we actually did** — the real commands, configs, and files, with comments.
3. **Trial-and-error log** — the things that failed first, the exact errors, and how we fixed
   them. (Failing and fixing is how you actually learn this, so we keep the record. Where something
   worked first try, we just say so — no invented failures.)
4. **Diagram** — a simple picture, only where it helps. *(Drawn as text-art inside code blocks so
   they render correctly in any editor and on GitHub.)*
5. **Key takeaways / gotchas** — the few things to really remember.

Decisions also include a short **ADR** (context / options / decision / trade-off / how it'll be
challenged), so you can defend each choice in an interview.

## The topics, in the order we did them

**Part 1 — the app and CI on the home setup**
1. [App and containers — the foundations](01-app-and-containers-foundations.md)
2. [The Dockerfile — from naive to production](02-the-dockerfile.md)
3. [Running it locally with Docker Compose](03-running-locally-docker-compose.md)
4. [CI/CD — the core ideas](04-cicd-concepts.md)
5. [Jenkins setup and connecting to GitHub](05-jenkins-setup-and-github.md)
6. [The CI pipeline (the Jenkinsfile)](06-the-ci-pipeline.md)
7. [Auto-triggering builds — polling vs webhook](07-auto-trigger-polling-vs-webhook.md)

**Part 2 — moving to AWS (infrastructure as code)**
8. [The target AWS architecture](08-target-aws-architecture.md)
9. [AWS account security and identity](09-aws-account-security-and-identity.md)
10. [Terraform and remote state](10-terraform-and-remote-state.md)
11. [The AWS network (VPC)](11-aws-network-vpc.md)
12. [The Jenkins controller on AWS](12-jenkins-controller-on-aws.md)
13. [The k3s (Kubernetes) cluster](13-k3s-cluster.md)
14. [Jenkins controller vs agents (the architecture)](14-jenkins-controller-vs-agents.md)
15. [Wiring Jenkins to the k3s cluster](15-wiring-jenkins-to-k3s.md)

---

## CURRENT STATE & NEXT STEPS
*(The most important section to read when resuming. Updated each time we extend these docs.)*

### What exists and works right now
- **The app**: a Node.js + TypeScript + Express monolith ("learning tracker") backed by PostgreSQL.
  One codebase, one process — a **monolith**, not microservices.
- **Dockerfile**: a hardened, 3-stage build on `node:22-alpine` — non-root, npm removed, with a
  healthcheck. Small, scans clean, builds and runs.
- **Local run**: `docker compose up` brings the app + Postgres up together; serves on 4173, answers
  `/healthz`.
- **CI pipeline (Jenkins)**: a Jenkinsfile that runs Install → Quality (lint, format, typecheck,
  tests) → Security (npm audit, gitleaks, hadolint, semgrep — **all enforcing**) → Build image
  (SHA-tagged) → Trivy image scan (enforcing) → Push to GHCR. Green. *(This pipeline runs on the
  home Jenkins; porting it to the AWS platform with k8s agents is the next major job.)*
- **AWS account**: secured (root MFA, no root keys, billing budget alarm). Gold-standard-within-
  constraints identity — IAM user `safwan` that can only **assume** an `admin` role, **only with
  MFA**, giving short-lived credentials. Account ID `729147110687`, region `us-east-1`.
- **AWS infrastructure (all as Terraform code in `~/aws-platform`)**:
  - **Terraform remote state** — encrypted, versioned S3 bucket with S3-native locking.
  - **VPC** — `10.0.0.0/16`, 2 public + 2 private subnets across 2 AZs, internet gateway, route
    tables. No NAT Gateway (cost). ~$0/month by itself.
  - **Jenkins controller EC2** — `i-0b8bb6273928241e5`, `t3.small`, Ubuntu 24.04, Elastic IP
    `52.5.159.174` (private IP `10.0.1.197`), keyless IAM instance role, SSM access (no SSH),
    firewall open on 8080 to the home IP only. Jenkins is installed and set up.
  - **k3s cluster** — single-node, `i-0c5073580cd7bcfc4`, `m7i-flex.large` (8 GB), private IP
    `10.0.1.224`, node `Ready` (k3s v1.35.5).
  - **Ephemeral Jenkins agents on k3s — WORKING.** A test build successfully spun up a pod, ran on
    it, and tore it down. Controller executors = 0; agents carry the tools.

### What is NOT done yet
- ✅ **The real app pipeline now runs end-to-end on AWS** (2026-06-21): Checkout → Install → Quality
  → Security → Build (Kaniko, daemonless) → Trivy (scan the tarball) → Push to GHCR — all on
  ephemeral k3s pods, all gates enforcing. First image `ghcr.io/pvsafwa/learning-tracker:<short-sha>`
  is in GHCR (the package is **private** by default). *(Webhook + deploy are still pending — below.)*
- **Webhooks** are not turned on yet (now possible — Jenkins is publicly reachable).
- **Nothing is deployed** to Stage/Prod yet (no app running in the k3s `stage`/`prod` namespaces).
- **Tailscale mesh + the Lenovo Dev environment** are designed but not built.
- The **40 GB course media** storage (EBS vs S3 vs EFS) is decided in principle but not implemented.
- The **branch/promotion model** (feature → dev → stage → prod with PR approvals) is designed but not
  set up in GitHub.

### What we were about to do next
The CI pipeline is **green on AWS**. Next: **turn on the webhook** (`triggers { githubPush() }` + a
GitHub webhook to `http://52.5.159.174:8080/github-webhook/` + open the Jenkins SG to GitHub's
webhook IP ranges on 8080), then **deploy the pushed image to the `stage`/`prod` namespaces** on k3s
(build-once-deploy-many — deploy the same `<short-sha>` tag; needs an imagePullSecret for the private
GHCR package, or make the package public). Still to document: topics **16** (connect AWS Jenkins to
GitHub) + **17** (CI on k3s with Kaniko/Trivy/skopeo) + an ADR for the Semgrep risk-acceptance.

### Cost reminder
Both EC2s cost ~$0.12/hour combined while running. **Stop them when you're not practicing:**
```bash
aws ec2 stop-instances --instance-ids i-0b8bb6273928241e5 i-0c5073580cd7bcfc4 --profile admin
```
