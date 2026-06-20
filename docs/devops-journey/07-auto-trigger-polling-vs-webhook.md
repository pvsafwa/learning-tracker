# 07 — Auto-triggering builds: polling vs webhook

> Status: **decision still open.** Builds are currently started by hand ("Build Now"). This topic
> records the options and the real wall we hit, so we can finish it later.

## a) What & Why (theory)

Right now you click "Build Now" in Jenkins. Real CI runs **automatically** on every push. Two ways
to make Jenkins start a build on its own:

- **Webhook (push-based):** the moment you push, GitHub sends an instant "ping" (an HTTP request)
  to Jenkins, which starts the build. Instant, event-driven — the way production does it. **But:**
  GitHub (on the internet) must be able to *reach* your Jenkins.
- **Polling (pull-based):** Jenkins reaches *out* to GitHub every couple of minutes and asks "any
  new commits?" — if yes, it builds. Slight delay, but Jenkins needs no inbound access.

## b) What we actually did / explored

Our Jenkins is on a **home Ubuntu laptop behind a home router (NAT)** — GitHub cannot reach it
directly. So a webhook needs a way to expose Jenkins to the internet:

**Webhook config (when reachable)** — for a declarative pipeline, the trigger is:
```groovy
triggers { githubPush() }     // needs the Jenkins "GitHub" plugin
```
and the GitHub webhook Payload URL is `https://<your-jenkins>/github-webhook/` (content type
`application/json`, "Just the push event"). The trigger only activates *after* the pipeline runs
once with it in place.

**Polling config** — Jenkins polls GitHub on a schedule; no inbound access needed:
```groovy
triggers { pollSCM('H/2 * * * *') }   // check every ~2 minutes; build only if there's a new commit
```

To make a webhook work behind NAT we looked at tunnels:
- **Cloudflare quick tunnel** (`cloudflared tunnel --url http://localhost:8080`) — free, no domain.
- **Stable-URL options:** ngrok static domain, Tailscale Funnel, or a Cloudflare *named* tunnel.

## c) Trial-and-error log

- **Attempt — Cloudflare quick tunnel.**
  - Result: it works, **but the public URL is random and changes every time the tunnel restarts.**
    That breaks the GitHub webhook each restart — useless for "set up once, test anytime."
  - Learned: a webhook needs a **stable** public URL.

- **Looked at the stable-URL options and the honest trade-offs:**
  - *ngrok static domain* — free stable URL, but needs an account/agent and a browser-warning page
    that can interfere.
  - *Tailscale Funnel* — the cleanest free stable URL (no warning page, agent runs as a service),
    but more setup.
  - *Cloudflare named tunnel* — most solid, but **requires a domain you own** (not free).
  - *Every* tunnel also has two costs polling doesn't: an always-on agent to keep running, and
    **exposing Jenkins to the internet** (a real attack surface).

- **No final decision made.** The honest conclusion: for "reliable, set up once, test anytime,"
  **polling** fits best (nothing exposed, no agent, no expiring URL — only a small delay). The
  *truly* clean webhook answer is to move Jenkins onto a **publicly reachable host** — which is
  exactly what the AWS plan (topic 08) does, since Jenkins will live on an EC2.

## d) Diagram — the two approaches

```
  WEBHOOK (push):   GitHub ──instant ping──▶  Jenkins      (needs Jenkins reachable from internet)
  POLLING (pull):   Jenkins ──"any new commits?"──▶ GitHub  (every ~2 min; needs no inbound access)
```

## e) Key takeaways / gotchas
- A **home Jenkins behind NAT** can't receive webhooks without a tunnel (and a tunnel exposes it).
- **Quick tunnels give an expiring URL** — no good for a webhook.
- **Polling** = no exposure, no agent, no expiring URL; cost is a small delay. Best fit for our
  current home setup.
- The real fix for webhooks is **putting Jenkins on a reachable host** (the AWS EC2 plan), which
  also removes the whole tunnel problem.
- Open item: decide polling-now vs wait-for-Jenkins-on-AWS.
