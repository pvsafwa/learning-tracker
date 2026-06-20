# 02 — The Dockerfile: from naive to production

## a) What & Why (theory)

A **Dockerfile** is a text file that lists the steps Docker runs, top to bottom, to package your
app into a sealed **image**. Run that image and you get a **container** (the app actually running).
The point is that the image runs the *same* everywhere — Mac, Ubuntu, AWS.

Two ideas drive every good Dockerfile:

1. **Layers and caching.** Each instruction makes a "layer." Docker reuses a layer if nothing it
   depends on changed. So put the things that rarely change (installing borrowed code) *above*
   the things that change every commit (your source). Otherwise every tiny code change
   re-downloads all your dependencies.
2. **Size and safety.** Everything you put in adds weight and "attack surface." The tools needed
   to *build* the app (the TypeScript compiler, dev tools) are dead weight at *run* time. Getting
   rid of them is the whole reason **multi-stage builds** exist: one throwaway stage builds the
   app, and a second clean stage takes only the finished pieces.

What the *running* image actually needs (decided by reading the code in topic 01):
- `dist/` — the built JavaScript
- production `node_modules` — borrowed code, runtime only
- `public/` and `migrations/` — files the app reads while running
- **NOT** `node_modules` copied from your Mac (it's built for macOS, not the Linux container, and
  it's huge) — you install it *inside* the image instead.

## b) What we actually did

### Step 1 — a naive single-stage Dockerfile (to feel the problem)
We wrote this by hand, one line at a time, to understand each instruction:

```dockerfile
FROM node:22                       # start from a ready-made image that already has Node 22
WORKDIR /app                       # make /app inside the image and work there
COPY package.json package-lock.json ./   # copy the borrowed-code LIST first (for caching)
RUN npm ci                         # download borrowed code (exact versions from the lock file)
COPY . ./                          # copy the rest of the code in (.dockerignore filters junk)
RUN npm run build                  # convert src/ (TypeScript) -> dist/ (JavaScript)
EXPOSE 4173                        # note which port the app listens on (just a label)
CMD ["node", "dist/server.js"]     # the command that starts the app when the container runs
```

We built it:
```bash
docker build -t learning-tracker:naive .
docker images learning-tracker:naive   # -> 1.83GB  (!!)
```
**1.83 GB** — enormous for what is really a small pile of JavaScript. That's the problem the
production version solves.

### Step 2 — multi-stage build (the size fix)
```dockerfile
# ---- build stage: install ALL deps, compile ----
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

# ---- runtime stage: small, only what runs ----
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev              # ONLY production deps (skip the build-only tools)
COPY --from=build /app/dist ./dist # copy ONLY the finished build from the first stage
COPY public ./public
COPY migrations ./migrations
USER node                          # run as a non-root, limited user (security)
EXPOSE 4173
CMD ["node", "dist/server.js"]
```
Result: **375 MB** — about 5× smaller. What got *left out*: the full base image's bloat, the
build-only borrowed code (`--omit=dev`), and the TypeScript source (`src/`, since we copy only
`dist/`). What stays is exactly what the running app needs.

### Step 3 — the final, hardened version (done later, during CI hardening)
We then made it genuinely production-grade. Two improvements you (the user) actually pushed for:
- a dedicated **`prod-deps` stage** so the final image never even contains the lock file, and
- switching the runtime to **`node:22-alpine`** (a tiny, hardened Linux), then **removing npm**.

```dockerfile
# Stage 1: build — compile TypeScript to JavaScript
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

# Stage 2: prod-deps — install ONLY production dependencies (alpine, to match the runtime)
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 3: runtime — small alpine image, npm removed (the app never uses npm to run)
FROM node:22-alpine
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules   # finished prod deps, from stage 2
COPY --from=build /app/dist ./dist                        # finished build, from stage 1
COPY public ./public
COPY migrations ./migrations
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx  # drop npm
USER node                          # non-root
EXPOSE 4173
# Tell Docker how to know the app is actually healthy (not just "switched on"):
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4173)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
```

Why these final changes:
- **`prod-deps` stage + `COPY --from=prod-deps`**: the runtime image receives the production
  `node_modules` as a finished artifact. It never copies `package.json`/`package-lock.json` and
  runs no `npm` — so there's nothing extra for a scanner to misread (see trial-and-error below).
- **alpine**: it's a tiny Linux. Our app is pure JavaScript (no compiled C/C++ libraries), so the
  usual alpine risk (the `musl` C library breaking native code) doesn't apply to us.
- **remove npm**: the runtime never *uses* npm, and npm ships its own vulnerable sub-libraries
  inside the base image — so deleting it removes findings and shrinks the image.
- **healthcheck**: lets Docker/orchestrators know if the app inside is actually working, by
  asking the app's own `/healthz` page.

## c) Trial-and-error log

- **Attempt 1 — the start command typo.** We wrote `CMD ["node", "dist/server/js"]`.
  - Result: this points at a file called `js` inside a folder `server` — which doesn't exist.
  - Fix: `dist/server.js` (a **dot** is a file extension; a **slash** is a folder separator).

- **"It built but the file on disk was empty."** We had typed the Dockerfile only into the chat,
  not saved it. **Lesson:** the actual file on disk has to be saved before `docker build` sees it.

- **The 1.83 GB shock.** The naive image worked but was huge.
  - Cause: it used the full `node:22` base, shipped the build-only tools, and shipped the `src/`
    source. Fix: multi-stage build → 375 MB.

- **Trivy flagged `picomatch` (a dependency).** After switching to alpine, an image scan still
  showed a vulnerable library.
  - Investigation: it was a **dev-only** dependency, only present because the build's lock file
    was sitting inside the image. We first tried `RUN npm ci --omit=dev && rm -f package-lock.json`.
  - Better solution (your idea): a dedicated **`prod-deps` stage** so the runtime image never
    contains the lock file at all — cleaner than the `rm` hack, and it's how the original
    developer's Dockerfile was structured too.

- **Trivy then flagged libraries inside `npm` itself.** The remaining findings came from
  `/usr/local/lib/node_modules/npm/...` — npm's *own* bundled libraries, shipped in the node base
  image.
  - Fix: the runtime never uses npm, so we **deleted it** (`RUN rm -rf .../npm ...`). Findings gone.

- **alpine result:** the operating-system vulnerability count dropped from **139 (Debian-based
  slim) → 0 (alpine)**. Big, real, verified win.

## d) Diagram — the multi-stage build

```
  Stage 1: build (big, throwaway)        Stage 3: runtime (small, shipped)
  ------------------------------         --------------------------------
  FROM node:22                           FROM node:22-alpine
  npm ci      (ALL deps)                 COPY --from=prod-deps  node_modules
  npm run build  -> dist/   --------+    COPY --from=build      dist/   <--+
                                    |    COPY public, migrations            |
  Stage 2: prod-deps                |    rm npm ; USER node ; HEALTHCHECK   |
  ------------------                |    CMD node dist/server.js            |
  FROM node:22-alpine               |                                       |
  npm ci --omit=dev (prod only) ----+---------------------------------------+
                                    (only the finished pieces cross over)
```

## e) Key takeaways / gotchas
- **Multi-stage build = build in a throwaway stage, ship only the finished pieces.** This is the
  single biggest idea for small, safe images.
- Order instructions **least-changing first** (install deps before copying source) so caching
  actually helps.
- Run as a **non-root user** (`USER node`) and add a **healthcheck**.
- Don't ship what the app doesn't run: no build tools, no `src/`, no lock file, no `npm`.
- A picture of the saving: `node:22` full + everything = **1.83 GB**; multi-stage alpine, prod
  deps only, npm removed = small, with **0 OS vulnerabilities**.
- A dependency flagged by a scanner might be a **dev-only** library that doesn't even ship — check
  *where* it lives before "fixing" it.
