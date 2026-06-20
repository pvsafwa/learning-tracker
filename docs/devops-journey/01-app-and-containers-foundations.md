# 01 — App and Containers: the Foundations

## a) What & Why (theory)

Before any DevOps work makes sense, you have to know what an "app" actually *is*.

**An app is just a folder of files on a computer.** This whole project — the `learning-tracker`
folder — *is* the app. There's nothing magic about it.

**"Running" the app** means: the computer starts reading one specific *starting file* and does
what it says. For our app the starting file is `server`. When the computer runs it, it switches
on a website that people open in a browser.

The files inside come in a few kinds, and telling them apart is the key skill:

- **The developer's own code** — the human-written instructions. In our app these live in the
  `src/` folder, written in a language called **TypeScript** (files end in `.ts`).
- **Borrowed code (dependencies)** — nobody writes everything from scratch. For common jobs
  (like running a website) you grab code other people already wrote. Our app borrows about a
  dozen of these. The *list* of what's borrowed is in **`package.json`**. The borrowed code
  itself gets downloaded into a folder called **`node_modules`**.
- **The built/runnable version** — the computer can't run TypeScript directly. It runs a close
  cousin called **JavaScript** (`.js`). So there's a conversion step called **building**
  (a.k.a. compiling): it turns the `.ts` files in `src/` into `.js` files in a new folder called
  **`dist/`**. The program that runs JavaScript is called **Node**.

So the full "life of the code":
1. Developer writes TypeScript in `src/`.
2. Borrowed code is downloaded into `node_modules` (from the `package.json` list).
3. Building converts `src/` into runnable JavaScript in `dist/`.
4. The computer runs `dist/server.js`, and the website is live.

**Why does this matter for DevOps?** Because **Docker** (next topic) is just a way to package
this whole thing so it runs the *same* everywhere — your Mac, the Ubuntu server, AWS — instead
of "works on my machine." A **Docker image** is a sealed package that holds the app and
everything it needs to run. A **container** is that image actually running. A **Dockerfile** is
the recipe that builds the image.

**Is our app microservices or a monolith?** A monolith — one single application. How we knew:
- One `package.json` in the whole repo (one app = one build).
- One start command (`node dist/server.js` = one process).
- The folders inside `src/` (`routes/`, `auth/`, `db/`...) are *modules inside one app*, not
  separate apps. Microservices would be several separate apps, each with its own `package.json`,
  each deployed on its own, talking over the network.
- **Important catch:** the `docker-compose.yml` has two containers (`app` + a Postgres database).
  That does **not** make it microservices. The database is an off-the-shelf dependency you pull
  ready-made, not an application *you* build. Multiple containers ≠ microservices.

## b) What we actually did

We read the repo to understand it before touching anything:

```bash
# How many apps? (each package.json = one app)
find . -name package.json -not -path '*/node_modules/*'
# -> only ./package.json  => one app => a monolith

# How does it build / start / which Node version?
#   from package.json:
#     "build": "tsc -p tsconfig.json"   # tsc = the TypeScript compiler
#     "start": "node dist/server.js"    # the runnable starting file
#     engines.node >= 20                # needs Node 20+
```

We also checked which folders the *running* app reads from disk, by searching the code (this is
how you decide what must go into the Docker image later):

```bash
grep -rn "migrations" src/   # -> src/db/migrate.ts reads SQL files from the migrations/ folder at startup
grep -rn "public\|static" src/  # -> src/app.ts serves static files from public/ via express.static()
```

So the running app needs: `dist/` (built code), `node_modules` (prod borrowed code),
`public/` (browser files it serves), and `migrations/` (database setup it runs at boot).

## c) Trial-and-error log

This topic worked by reading, so no real failures — but two things surprised us and taught a
lesson:

- **"I can't see the `node_modules` folder."** Correct — it wasn't there. It's huge (thousands
  of files), so you don't carry it around. Git deliberately leaves it out (`.gitignore` lists
  `node_modules`). You **recreate** it by running an install command, which reads `package.json`
  and downloads everything. **Lesson:** borrowed code is never stored/shipped; it's recreated
  from the list. (This is exactly why, in Docker, you don't copy `node_modules` — you install it
  inside.)
- **"I can't see the `dist/` folder either."** Same idea — `dist/` is *created* by the build
  step and is also git-ignored. **Lesson:** built output is generated, not stored.

## d) Diagram — the life of the code

```
  You write              Borrowed code              Build step
  TypeScript     +      (node_modules,      ->      converts      ->   Node runs
  in  src/             from package.json)          src/ -> dist/        dist/server.js
                                                                            |
                                                                            v
                                                                    website is live
```

## e) Key takeaways / gotchas
- An app is just a folder of files; "running" it = the computer follows the starting file.
- Two kinds of code: **yours** (in `src/`) and **borrowed** (`node_modules`, from `package.json`).
- The app runs the **built** JavaScript (`dist/`), not the TypeScript source.
- `node_modules` and `dist/` are **recreated**, never stored in git — so they're never "missing,"
  they're just not built/installed yet.
- One `package.json` + one start command = a **monolith**. Extra containers (like a database)
  don't make it microservices.
