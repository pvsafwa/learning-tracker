# Learning Tracker — production deployment (single host)

This deploys the stack on one Ubuntu box with Docker Compose and nginx doing TLS
termination in front of the app. Course media stays on each user's own computer —
the server only ever stores accounts, sessions and progress in PostgreSQL.

```
            ┌─────────────┐      ┌──────────────┐      ┌────────────┐
 browser ──▶│ web (nginx) │──────│ app (API+SPA)│──────│ db (Postgres)
            │ TLS + proxy │ HTTP │ Node/Express │  SQL │            │
            └─────────────┘      └──────────────┘      └────────────┘
```

`web` is a pure reverse proxy — it does **not** serve static files itself. The
Node app serves the SPA and sets all security headers (CSP, HSTS, etc. via
helmet); duplicating that in nginx would just be a second place for it to drift.

---

## Before you start

1. **DNS**: point `your.domain.com` at the box's public IP.
2. **Google OAuth client** (console.cloud.google.com → APIs & Services →
   Credentials → Create credentials → OAuth client ID → Web application).
   Add an **Authorized redirect URI** that exactly matches:
   `https://your.domain.com/auth/google/callback`
3. **The folder picker needs HTTPS.** The File System Access API only works in
   a secure context — `http://localhost` counts, a public server does not.
   TLS isn't optional here the way it might be for other apps.

---

## 1. Provision the box

Ubuntu 24.04, t3.small or similar is plenty. Security group / firewall: allow
inbound **80 and 443** only (plus 22/SSH or your platform's equivalent for
shell access).

```sh
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker
docker compose version   # confirm the plugin is present; package name can vary by distro
```

## 2. Get the app onto the box

```sh
git clone <your-repo-url> learning-tracker
cd learning-tracker
cp .env.example .env
```

Edit `.env`:

- `APP_BASE_URL=https://your.domain.com`
- `COOKIE_SECURE=true`
- `SESSION_SECRET` — generate with `openssl rand -hex 32` (must be ≥32 chars; the app refuses to boot in production without one)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from step 1
- `ADMIN_EMAILS` — your Google email(s), comma-separated
- `POSTGRES_PASSWORD` — a long random string

Edit [deploy/nginx.prod.conf](deploy/nginx.prod.conf) and replace
`your.domain.com` (3 occurrences) with your real domain.

## 3. Get a TLS certificate

Port 80 must be free for this step (nothing is listening yet):

```sh
sudo apt install -y certbot
sudo certbot certonly --standalone -d your.domain.com
```

Certificates land in `/etc/letsencrypt/live/your.domain.com/`, which
`docker-compose.prod.yml` mounts read-only into the `web` container.

**Renewal**, once the stack is running (port 80 is now held by `web`), needs
certbot to free it first:

```sh
sudo certbot certonly --standalone -d your.domain.com --force-renewal \
  --pre-hook  "docker compose -f $(pwd)/docker-compose.yml -f $(pwd)/docker-compose.prod.yml stop web" \
  --post-hook "docker compose -f $(pwd)/docker-compose.yml -f $(pwd)/docker-compose.prod.yml start web"
```

Confirm certbot's systemd timer (`systemctl status certbot.timer`) will re-run
with these hooks — check current certbot docs, flags/timer behavior can change.

## 4. Bring the stack up

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

This applies DB migrations automatically on boot. Verify:

```sh
curl -I https://your.domain.com/healthz   # 200 from nginx, proxied to the app
curl -I https://your.domain.com/readyz    # 200 once the app can reach Postgres
```

Then visit `https://your.domain.com`, sign in with an `ADMIN_EMAILS` account,
and click **Choose courses folder** to pick a folder on your own machine.

---

## Operating it

```sh
docker compose logs -f app                      # tail API logs
docker compose ps                                # container status

# Update to the latest code:
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Stop (data persists in the dbdata volume):
docker compose down
```

**Backup:**

```sh
docker compose exec db pg_dump -U lt learning_tracker > backup-$(date +%F).sql
```

**Restore:**

```sh
docker compose exec -T db psql -U lt learning_tracker < backup.sql
```

---

## Local development

For plain local use (not a public deploy), the base compose file alone is
enough — nginx proxies plain HTTP and `localhost` is a secure context, so the
folder picker and Google sign-in both work without TLS:

```sh
cp .env.example .env   # APP_BASE_URL=http://localhost:8080, COOKIE_SECURE=false
docker compose up -d --build
```

To run the Node app outside Docker with live reload (`npm run dev`), start
only `db` — its port is published to `127.0.0.1:5432` for exactly this:

```sh
docker compose up -d db
npm install
DATABASE_URL=postgres://lt:<POSTGRES_PASSWORD from .env>@localhost:5432/learning_tracker npm run dev
```

---

## What to verify against current docs (version-specific, changes over time)

- Ubuntu's Docker Compose package name (`docker-compose-v2` here; check `apt-cache search docker-compose` on your release).
- Certbot's current flags and systemd timer behavior (eff.org / certbot docs).
- The File System Access API's current browser support matrix (caniuse.com) — Chromium-family only as of this writing.
