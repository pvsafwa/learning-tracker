# 04 — CI/CD: the core ideas

## a) What & Why (theory)

This topic is concepts, not commands — but it's the most important mental model in the whole
journey, because it kills the most common confusion.

**The single most important rule: build once, deploy many.**
You **build the image exactly once.** That same image — identified by its digest/tag — is what
travels through Dev → Stage → Prod. You **never rebuild it per environment.**

Why? If you rebuilt per environment, the thing you tested in Stage is *not* the thing you ship to
Prod (different build time, maybe different resolved dependency versions, different base-image
patch). Your testing would be a lie. The whole point of a pipeline is *provable confidence*: "the
bytes we tested are the bytes we shipped."

**So what changes between environments?** Not the image — the **configuration**: database URL,
secrets, base URL, scaling, feature flags. The image is identical; config is injected at deploy
time. (You already saw this in Compose, topic 03.)

**CI vs CD (plain):**
- **CI = Continuous Integration.** On each push: lint, test, **build the image**, scan it, push it
  to a registry. Output: *one versioned, trusted artifact.*
- **CD = Continuous Delivery/Deployment.** Take that one artifact and **promote** it through
  environments, with **gates** between them (auto to Dev, then heavier tests, then a **manual
  approval** before Prod). Tests get heavier/slower as you climb, because failures get more
  expensive the closer you are to real users.
- **Delivery vs Deployment** (classic interview point): *Continuous Delivery* = the pipeline
  produces a deploy-ready artifact but a human presses the button for Prod. *Continuous
  Deployment* = no human gate, every green build goes to Prod automatically. Same pipeline; the
  only difference is whether a human approves Prod.

**Common confusion we cleared up:** "Does CI run again for each environment?" No. CI runs **once**
to produce the image. After that, CD **promotes** that same image. The "new tests" at each
environment are *different kinds* of tests (smoke, integration, e2e) run against the *same* image —
more testing, same bytes.

## b) What we actually did

There were no commands here — this was the design conversation that shaped everything after. The
concrete decisions we locked in:
- The image is tagged by the **git commit short SHA** (e.g. `learning-tracker:538631e`) so any
  image is traceable to the exact code that built it. This is the backbone of build-once-deploy-many.
- The promotion model we chose (the pre-GitOps way, learned first):
  ```
  feature/* → PR → dev   (2 approvals)        → deploy to Dev
  dev       → PR → stage                       → deploy to Stage (heavier tests)
  stage     → PR → main/prod (manual approval) → deploy to Prod
  ```
  With the golden rule: **the SAME image built once is promoted** — never rebuilt per branch.

## c) Trial-and-error log

No commands failed (it's concept work), but here's the honest learning record of the *mental*
mistakes we corrected:
- **Belief:** "each environment rebuilds its own image / re-tests / makes a new image."
  **Correction:** wrong — one image, promoted. Rebuilding breaks the test-what-you-ship guarantee.
- **Belief (about the promotion flow):** mixing up "merge to dev" with "merge to stage."
  **Correction:** it's branch-to-branch promotion (feature→dev→stage→prod), and the *image* is
  promoted, not rebuilt.

## d) Diagram — build once, deploy many

```
                       ┌────────── CI: runs ONCE per commit ──────────┐
   git push ─▶ GitHub ─▶ test → build image → scan → push to registry → image@sha256:abc
                                                                              │
                       ┌──────────── CD: promote the SAME image ─────────────┘
                       ▼
                Dev  (+ dev config)  →  Stage (+ stage config)  →  Prod (+ prod config, manual gate)
                       └──────────────── same image; only CONFIG changes ─────────────┘
```

## e) Key takeaways / gotchas
- **Build once, deploy many.** One image, promoted; never rebuilt per environment.
- **CI** produces a trusted artifact; **CD** promotes it with gates.
- Between environments, only **config** changes — never the image.
- Tag images by **git commit SHA** for traceability (provenance).
- **Continuous Delivery** = human gate before Prod; **Continuous Deployment** = no human gate.
