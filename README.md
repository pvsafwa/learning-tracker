# Learning Tracker

A self-hosted, invite-only web app for tracking progress through course videos, audio lessons, and PDFs. Sign in with Google; only accounts an admin has added can get in. Each user picks their own course folder on their own computer — media is read straight out of the browser and never uploaded. Only progress, notes, flashcards, goals and achievements are stored server-side in PostgreSQL.

## Architecture (3-tier)

```
Presentation tier   public/        Static SPA (vanilla JS). Reads the user's course folder
                                   directly (File System Access API) — media never leaves
                                   the browser. Talks to the API for progress only.
        │ HTTPS + session cookie
Application tier     src/           Node + Express + TypeScript. Google OAuth + allowlist,
        │ SQL                       REST API for per-user progress. Stateless; never touches media.
Data tier            PostgreSQL     Users/allowlist, sessions, progress, notes, cards, goals…
```

The app tier is **stateless** (all shared state is in Postgres), so it scales horizontally and fits containers cleanly. Course media stays on each user's machine — the server has no storage or bandwidth cost for it, and never sees it.

> Picking a folder needs the **File System Access API**: Chrome, Edge, Arc or Brave. Safari/Firefox aren't supported yet, and it requires a secure context (`http://localhost` works; a real deployment needs HTTPS).

## Prerequisites

- [Docker](https://www.docker.com/) + Docker Compose (easiest), **or** Node ≥ 20 and a PostgreSQL 14+ instance.
- A **Google OAuth client** (for real sign-in) — see below.

## 1. Configure

```sh
cp .env.example .env
```

Edit `.env`:

| Variable               | Required | Purpose                                                                        |
| ---------------------- | -------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`         | yes      | PostgreSQL connection string.                                                  |
| `SESSION_SECRET`       | yes      | Random string (≥32 chars) for signing session cookies. `openssl rand -hex 32`. |
| `APP_BASE_URL`         | yes      | Public URL, no trailing slash. Used to build the OAuth callback.               |
| `GOOGLE_CLIENT_ID`     | yes\*    | Google OAuth client id.                                                        |
| `GOOGLE_CLIENT_SECRET` | yes\*    | Google OAuth client secret.                                                    |
| `ADMIN_EMAILS`         | yes      | Comma-separated Google emails seeded as admins on boot.                        |
| `COOKIE_SECURE`        | no       | `true` once served over HTTPS. Defaults to on in production.                   |
| `PORT`                 | no       | Default `4173`.                                                                |
| `DEV_LOGIN_ENABLED`    | no       | `true` enables a password-less local login for testing. **Never in prod.**     |

\* Google sign-in is disabled until both are set (handy for first local runs with `DEV_LOGIN_ENABLED=true`).

### Google OAuth setup

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID → Web application**.
2. Add an **Authorized redirect URI** that exactly matches: `${APP_BASE_URL}/auth/google/callback`
   (e.g. `https://learn.example.com/auth/google/callback`).
3. Copy the client id/secret into `.env`.

> Production needs **HTTPS** — Google requires it for non-localhost redirect URIs, the app sets `Secure` session cookies, and the folder picker needs a secure context. See [DEPLOY.md](DEPLOY.md) for a full production deploy (Docker Compose + nginx + TLS on a single host).

## 2. Run

### With Docker Compose (recommended)

```sh
docker compose up --build
```

Brings up PostgreSQL + the app behind nginx, runs migrations automatically, and serves on `http://localhost:8080`. After signing in, click **Choose courses folder** and pick the folder on your computer that holds your course folders — nothing is uploaded.

### Locally for development

```sh
# Postgres (or use your own and set DATABASE_URL)
docker compose up -d db
npm install
npm run dev          # tsx watch; runs migrations on boot
```

## 3. Manage access (admin)

The emails in `ADMIN_EMAILS` become admins on boot. As an admin, click the **avatar → Manage users** to add/remove people, grant admin, or disable accounts — all from the app. A person can sign in only after their exact Google email is on the list.

## Scripts

| Command                              | What it does                                          |
| ------------------------------------ | ----------------------------------------------------- |
| `npm run dev`                        | Dev server (tsx watch) + auto-migrate.                |
| `npm run build`                      | Compile TypeScript → `dist/`.                         |
| `npm start`                          | Run the compiled server (`dist/server.js`).           |
| `npm run migrate`                    | Apply DB migrations (compiled). `migrate:dev` for ts. |
| `npm test`                           | Unit tests (Vitest) — no DB needed.                   |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit`.                              |

## Project layout

```
src/
  config.ts              env validation (zod), 12-factor config
  server.ts              entrypoint: migrate → seed admins → listen
  app.ts                 Express app factory (helmet/CSP, sessions, routes)
  auth/                  passport Google strategy + allowlist, auth routes
  middleware/            requireAuth/requireAdmin, async + error handling
  routes/                me, progress, notes, cards, goals, achievements, admin
  db/
    pool.ts              pg connection pool
    migrate.ts           forward-only SQL migration runner (advisory-locked)
    repositories/        one module per table
  lib/                   logger
migrations/              *.sql, applied in order
public/                  the SPA (presentation tier) — folder picker, scanning,
                         playback and progress tracking all live in app.js
```

## Data & privacy

- **Media** is read directly by the browser from the folder the user picks (File System Access API) and never leaves their device — the server has no code path that touches it.
- **Per-user data** (progress, activity, notes, flashcards, goals, achievements) lives in PostgreSQL, keyed to the user. UI preferences (theme, volume) and the picked folder's _handle_ stay in the browser (`localStorage` / IndexedDB) — reselecting the folder re-grants access each session, by design of the browser's permission model.
- **Auth**: server-side sessions (httpOnly, SameSite=Lax, Secure per `COOKIE_SECURE`) stored in Postgres. Only the user id is kept in the session and re-validated against the DB each request, so disabling/removing a user takes effect immediately.

## Features

Resume playback, background duration probing, a dashboard (time invested, streak, heatmap, continue-watching, goals with pace projection, flashcards due, achievements), timestamped notes & bookmarks, sidecar `.srt`/`.vtt` captions + searchable transcript, SM-2 spaced-repetition flashcards, search/filter, light & dark themes, keyboard shortcuts, PiP, and per-lesson / per-course / all progress reset.

## Keyboard shortcuts

`Space` play/pause · `←/→` seek 10s · `↑/↓` volume · `M` mute · `C` captions · `B` bookmark · `F` fullscreen · `N`/`P` next/previous · `[` toggle sidebar · `?` shortcuts.
