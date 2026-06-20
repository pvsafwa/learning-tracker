# 08 — The target AWS architecture

> Status: **designed, not built yet.** This is the plan we agreed on for moving everything to AWS.

## a) What & Why (theory)

So far everything runs on home machines. The goal is a real, enterprise-shaped setup on AWS, with
a proper feature → dev → stage → prod flow. The pieces:

- **Mac (M1, 8/256)** — your dev workstation. You write code, run git, run the AWS CLI + Terraform.
  Keep the 40 GB of courses *off* it (too small).
- **Lenovo Ubuntu laptop (home)** — the **Dev environment** (feature/dev branches deploy here). A
  copy of the 40 GB courses lives here. It connects to AWS privately via **Tailscale**.
- **AWS:**
  - a **Jenkins controller** on a dedicated EC2 (publicly reachable → webhooks work natively, no
    tunnel — this also solves topic 07).
  - a **k3s cluster** (lightweight Kubernetes) on EC2, used for **Stage**, **Prod** (as two
    namespaces on one cluster), *and* for **ephemeral Jenkins build agents** (a fresh agent pod per
    build, destroyed after).
  - a **static Jenkins agent on the Lenovo** (over Tailscale) to deploy Dev.

Everything is provisioned with **Terraform** (infrastructure as code). We learn the **pre-GitOps**
way first (Jenkins drives the deploys), then later move to **GitOps with ArgoCD**.

**The promotion model (the pre-GitOps way):**
```
feature/*  → PR → dev    (2 mandatory approvals)        → deploy to Dev   (Lenovo)
dev        → PR → stage                                  → deploy to Stage (k3s)
stage      → PR → main/prod  (manual approval)           → deploy to Prod  (k3s)
```
Golden rule (build-once-deploy-many): the **same image** built once is promoted through stage →
prod — never rebuilt per branch.

## b) What we actually did

This was design, not build. Key decisions captured:

**Cost right-sizing (FinOps — we have a $200 credit, not unlimited):**
- Use **k3s**, NOT EKS. (EKS charges ~$73/month for the control plane *alone*.)
- Smallest instances; **stop instances when not practicing** (the biggest saver — Terraform makes
  rebuild trivial); stage+prod as **namespaces** on one small cluster.
- A **billing budget alarm** is set so credit can't silently drain.

**Honest trade-offs we accepted (so you can defend them in an interview):**
- **Single cluster for stage+prod** (namespaces) is a learning compromise — real prod isolates
  environments into separate clusters/accounts.
- **Single AWS account** (not multi-account) — true enterprise uses AWS Organizations + separate
  accounts per environment; impractical/costly on one $200 account.

**The 40 GB course media** (decided in principle): cheapest no-code path = an **EBS disk** the app
reads as a folder (~$3–4/mo); best-practice cloud-native = **S3** (needs the app modified to read
from S3); shared/no-code = **EFS** (pricier). Leaning EBS to start.

## c) Trial-and-error log

Design only — no commands run yet, so nothing failed. The one correction during design: the
original promotion flow mixed up "merge to dev" with "merge to stage"; we cleaned it to strict
branch-to-branch promotion (feature→dev→stage→prod) with the same image promoted, not rebuilt.

## d) Diagrams

**Runtime architecture:**
```
                         ┌───────────────── AWS ─────────────────┐
   you push ─▶ GitHub ──▶│  Jenkins controller (EC2, reachable)  │
                         │        │ runs builds on...             │
                         │        ├─▶ ephemeral agents (k3s pods) │
                         │        ├─▶ Stage  (k3s namespace)      │
                         │        └─▶ Prod   (k3s namespace)      │
                         └────────────────┬──────────────────────┘
                                          │ Tailscale (private mesh)
                                          ▼
                          Lenovo Ubuntu (home) = Dev env + 40GB courses
```

**Promotion flow:**
```
  feature/x ──PR(2 approvals)──▶ dev ──▶ [build image ONCE]
                                  │           │ deploy to Dev (Lenovo)
                                  ▼           ▼
                                 stage ◀── promote SAME image ──▶ deploy to Stage (k3s)
                                  │
                            manual approval
                                  ▼
                                 prod  ◀── promote SAME image ──▶ deploy to Prod (k3s)
```

## e) Key takeaways / gotchas
- **k3s, not EKS** — EKS control plane alone is ~$73/mo. Stop instances when idle.
- **Tailscale** connects home (Lenovo) ↔ AWS privately, and putting Jenkins on a reachable EC2
  fixes the webhook problem for free.
- **Ephemeral agents on k3s** = a clean, throwaway build environment per build.
- Promote the **same image** through stage → prod; never rebuild per branch.
- Honest compromises to remember: single cluster for stage+prod, single AWS account — both for
  cost, both not how true prod isolates things.
