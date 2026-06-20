# 03 — Running it locally with Docker Compose

## a) What & Why (theory)

Our app doesn't run alone — it needs a **PostgreSQL database** to work. Starting two things by
hand and wiring them together is tedious and error-prone. **Docker Compose** lets you describe the
whole local setup in one file (`docker-compose.yml`) and start it all with one command.

In Compose, each thing is a **service**. We have two: `db` (Postgres, pulled ready-made) and `app`
(our image, built from our Dockerfile). Compose also handles the order — the app waits until the
database is actually ready before starting.

**Important idea this proves:** the *image* stays the same; only the **configuration** (database
URL, secrets, port) is injected from outside. That's the seed of "build once, deploy many"
(topic 04).

## b) What we actually did

The repo already had a `docker-compose.yml` with two services. The key parts:

```yaml
services:
  db:                                  # the database service
    image: postgres:16-alpine          # pulled ready-made, we don't build it
    environment:
      POSTGRES_USER: lt
      POSTGRES_PASSWORD: lt_password
      POSTGRES_DB: learning_tracker
    healthcheck:                        # Compose can check the DB is truly ready
      test: ["CMD-SHELL", "pg_isready -U lt -d learning_tracker"]

  app:
    build: .                           # build OUR image from the Dockerfile in this folder
    depends_on:
      db:
        condition: service_healthy     # wait until the DB healthcheck passes, THEN start app
    environment:
      DATABASE_URL: postgres://lt:lt_password@db:5432/learning_tracker  # config injected here
      PORT: 4173
    volumes:
      - ${COURSES_DIR:-./courses}:/courses:ro   # course media mounted in, NOT baked into image
    ports:
      - "4173:4173"
```

We ran it:
```bash
docker compose up --build
```
What success looked like in the logs:
- Postgres logged "database system is ready to accept connections".
- The app applied its database migration (`Applying migration` -> `Migrations applied`).
- The app logged `Learning Tracker API listening` on port 4173.

We then **proved** it actually works (not just "started") by hitting it:
```bash
curl -s http://localhost:4173/healthz     # -> {"ok":true}   (HTTP 200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/        # -> 200 (home page)
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/app.js  # -> 200 (a file from public/)
```

To stop: `Ctrl+C`, then optionally `docker compose down` (the DB data is kept in a volume).

**Note on the 40 GB course media:** the courses are **data**, not part of the app. In Compose
they're *mounted in* (`volumes:`), not copied into the image. The `.dockerignore` even excludes
`courses`. This is a key principle: code/assets go *in* the image; large/changing **data** stays
*outside* (a mounted folder locally, object storage like S3 in the cloud).

## c) Trial-and-error log

This worked on the first proper run — the logs showed migrations applied and the app listening,
and all three `curl` checks returned 200. No failures here.

(One thing to know: the app can't be *logged into* without Google sign-in configured, but the page
loading + reaching the database is the proof that the image runs correctly.)

## d) Diagram — local stack

```
   your browser ──▶  app container (port 4173)  ──▶  db container (Postgres)
                          │
                          └── reads course media from a MOUNTED folder (not baked in)
```

## e) Key takeaways / gotchas
- Compose runs your **multi-tier** app (app + database) with one command.
- `depends_on ... service_healthy` makes the app **wait** for the database to be truly ready.
- The image is identical; the **config** (DB URL, port) is injected from the Compose file — the
  first taste of build-once-deploy-many.
- **Data (the 40 GB courses) is mounted in, never baked into the image.**
- "Built" is not "works" — always **prove** it with a real request (`/healthz` returning `ok`).
