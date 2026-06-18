# Learning Tracker

A self-hosted, invite-only web app for tracking progress through course videos, audio lessons, and PDFs. Sign in with Google; only accounts an admin has added can get in. Each user's progress, notes, flashcards, goals and achievements are stored server-side in PostgreSQL.

## Architecture (3-tier)

```
Presentation tier   public/        Static SPA (vanilla JS). Talks to the API; holds no user data.
        │ HTTPS + session cookie
Application tier     src/           Node + Express + TypeScript. Google OAuth + allowlist,
        │ SQL                       REST API, authenticated media streaming. Stateless.
Data tier            PostgreSQL     Users/allowlist, sessions, progress, notes, cards, goals…
                     courses/       Media files on a mounted volume (streamed, never uploaded).
```

The app tier is **stateless** (all shared state is in Postgres), so it scales horizontally and fits containers/Kubernetes cleanly.

## Prerequisites

- [Docker](https://www.docker.com/) + Docker Compose (easiest), **or** Node ≥ 20 and a PostgreSQL 14+ instance.
- A **Google OAuth client** (for real sign-in) — see below.

## 1. Configure

```sh
cp .env.example .env
```

Edit `.env`:

| Variable               | Required | Purpose                                                                    |
| ---------------------- | -------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`         | yes      | PostgreSQL connection string.                                              |
| `SESSION_SECRET`       | yes      | Random string for signing session cookies. `openssl rand -hex 32`.         |
| `APP_BASE_URL`         | yes      | Public URL, no trailing slash. Used to build the OAuth callback.           |
| `GOOGLE_CLIENT_ID`     | yes\*    | Google OAuth client id.                                                    |
| `GOOGLE_CLIENT_SECRET` | yes\*    | Google OAuth client secret.                                                |
| `ADMIN_EMAILS`         | yes      | Comma-separated Google emails seeded as admins on boot.                    |
| `COURSES_DIR`          | no       | Folder holding your course folders (default `./courses`).                  |
| `PORT` / `HOST`        | no       | Defaults `4173` / `0.0.0.0`.                                               |
| `DEV_LOGIN_ENABLED`    | no       | `true` enables a password-less local login for testing. **Never in prod.** |

\* Google sign-in is disabled until both are set (handy for first local runs with `DEV_LOGIN_ENABLED=true`).

### Google OAuth setup

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID → Web application**.
2. Add an **Authorized redirect URI** that exactly matches: `${APP_BASE_URL}/auth/google/callback`
   (e.g. `https://learn.example.com/auth/google/callback`).
3. Copy the client id/secret into `.env`.

> Production needs **HTTPS** — Google requires it for non-localhost redirect URIs, and the app sets `Secure` session cookies in production. Terminate TLS at a reverse proxy (Caddy/nginx/Traefik) or load balancer in front of the app.

## 2. Run

### With Docker Compose (recommended)

```sh
docker compose up --build
```

Brings up PostgreSQL + the app, runs migrations automatically, and serves on `http://localhost:4173`. Put your course folders in `./courses` (mounted read-only) or set `COURSES_DIR`.

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
  routes/                me, library, progress, notes, cards, goals, achievements, admin
  db/
    pool.ts              pg connection pool
    migrate.ts           forward-only SQL migration runner (advisory-locked)
    repositories/        one module per table
  lib/                   scan (library), stream (range), media types, logger
migrations/              *.sql, applied in order
public/                  the SPA (presentation tier)
```

## Data & privacy

- **Media** is read by the server and streamed to authenticated users; never uploaded elsewhere.
- **Per-user data** (progress, activity, notes, flashcards, goals, achievements) lives in PostgreSQL, keyed to the user — not in the browser. UI preferences (theme, volume) stay in `localStorage`.
- **Auth**: server-side sessions (httpOnly, SameSite=Lax, Secure in prod) stored in Postgres. Only the user id is kept in the session and re-validated against the DB each request, so disabling/removing a user takes effect immediately.

## Features

Resume playback, background duration probing, a dashboard (time invested, streak, heatmap, continue-watching, goals with pace projection, flashcards due, achievements), timestamped notes & bookmarks, sidecar `.srt`/`.vtt` captions + searchable transcript, SM-2 spaced-repetition flashcards, search/filter, light & dark themes, keyboard shortcuts, PiP, and per-lesson / per-course / all progress reset.

## Keyboard shortcuts

`Space` play/pause · `←/→` seek 10s · `↑/↓` volume · `M` mute · `C` captions · `B` bookmark · `F` fullscreen · `N`/`P` next/previous · `[` toggle sidebar · `?` shortcuts.
