# 06 — The CI pipeline (the Jenkinsfile)

## a) What & Why (theory)

The `Jenkinsfile` describes, as code in your repo, every step Jenkins runs on a build. We built it
up stage by stage until it became a real, security-conscious CI pipeline. The full shape:

```
Install → Quality (parallel) → Security (parallel) → Build image → Image scan → Push image
```

- **Quality gates** catch sloppy/broken code: lint, format, type errors, failing tests.
- **Security gates** catch dangerous code/config: vulnerable dependencies, committed secrets, bad
  Dockerfile practices, insecure code patterns. *This layer is what most "CI pipelines" skip — and
  it's the heart of enterprise CI.*
- **Build** turns the code into the SHA-tagged image.
- **Image scan** checks the finished image for known vulnerabilities.
- **Push** publishes the trusted image to a registry so it can be deployed later.

A key adoption idea: new scanners are introduced in **"report-only"** mode first (show findings but
don't block), then flipped to **"enforcing"** (block the build) once the existing findings are
handled. Blocking on day one would stop all work; this is how real teams roll out gates.

## b) What we actually did — the final, enforcing Jenkinsfile

```groovy
pipeline {
    agent any
    tools { nodejs 'node22' }          // the pinned Node version from the NodeJS plugin
    stages {
        stage('Install') {
            steps { sh 'npm ci' }      // install all deps (incl. dev tools) for the checks
        }
        stage('Quality') {
            parallel {                  // these are independent + read-only -> run together
                stage('Lint')      { steps { sh 'npm run lint' } }        // eslint
                stage('Format')    { steps { sh 'npm run format:check' } }// prettier --check
                stage('Typecheck') { steps { sh 'npm run typecheck' } }   // tsc --noEmit
                stage('Unit tests'){ steps { sh 'npm test' } }            // vitest run
            }
        }
        stage('Security') {
            parallel {
                stage('Dependency check') {            // SCA: vulnerable libraries that SHIP
                    steps { sh 'npm audit --omit=dev --audit-level=high' }
                }
                stage('Secret scan') {                 // gitleaks: any committed passwords/keys
                    steps { sh 'docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest git /repo' }
                }
                stage('Dockerfile lint') {             // hadolint: Dockerfile best practices
                    steps { sh 'docker run --rm -i hadolint/hadolint hadolint --failure-threshold warning - < Dockerfile' }
                }
                stage('Code scan') {                   // semgrep: SAST, insecure code patterns
                    steps { sh 'docker run --rm -v "$PWD:/src" semgrep/semgrep semgrep scan --config auto --error /src' }
                }
            }
        }
        stage('Build image') {
            steps {
                sh '''
                    GIT_SHA=$(git rev-parse --short HEAD)        # tag = the git commit (provenance)
                    docker build -t learning-tracker:${GIT_SHA} .
                '''
            }
        }
        stage('Image scan') {                          // Trivy: scan the FINISHED image
            steps {
                sh '''
                    GIT_SHA=$(git rev-parse --short HEAD)
                    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                      aquasec/trivy image --ignore-unfixed --severity HIGH,CRITICAL --exit-code 1 \
                      learning-tracker:${GIT_SHA}
                '''
            }
        }
        stage('Push image') {                          // publish to GHCR
            steps {
                withCredentials([usernamePassword(credentialsId: 'ghcr-credentials',
                                 usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_TOKEN')]) {
                    sh '''
                        GIT_SHA=$(git rev-parse --short HEAD)
                        echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
                        docker tag learning-tracker:${GIT_SHA} ghcr.io/pvsafwa/learning-tracker:${GIT_SHA}
                        docker push ghcr.io/pvsafwa/learning-tracker:${GIT_SHA}
                        docker logout ghcr.io
                    '''
                }
            }
        }
    }
}
```

Why some specific choices:
- **`--omit=dev` on `npm audit`**: gate on the libraries that actually *ship* to users
  (production deps). Our build-only tools had known issues but never run in production.
- **Security scanners run inside Docker containers** (gitleaks, hadolint, semgrep, trivy): no
  tools installed on the server, reproducible, host stays clean.
- **`--ignore-unfixed` on Trivy**: only block on vulnerabilities that *have a fix available*. The
  base OS often has unfixable CVEs you can't patch anyway, so they shouldn't block you.
- **`--password-stdin` for `docker login`**: keeps the token off the screen and out of the logs.
- **GHCR push credential**: a GitHub Personal Access Token with `write:packages`, stored as a
  "Username with password" credential `ghcr-credentials` in Jenkins. The pushed image lands as a
  private package under your GitHub account, identified by both a tag and a digest.

Supporting repo changes we made for this: added `format:check` (`prettier --check .`) and a
`.prettierignore`; added a `// nosemgrep` comment with a written justification on a reviewed
false-positive in `public/app.js`.

## c) Trial-and-error log

- **Attempt 1 — first build failed at checkout.** Error: `couldn't find remote ref refs/heads/master`.
  - Cause: Jenkins' Git defaulted the branch to **`master`**, but GitHub uses **`main`**.
  - Fix: set the job's Branch Specifier to `*/main`. (Classic Jenkins gotcha — no org uses
    `master` anymore.)

- **The Format gate failed (Prettier).** `Code style issues found in 9 files`.
  - Cause: the inherited code wasn't Prettier-formatted; the *enforcing* format check caught it.
  - Fix: run the formatter once and commit it — `npm run format` (`prettier --write .`), then push.
    (This is the gate doing its job, not a bug.)

- **The Dockerfile-lint gate crashed.** Error:
  `exec: "--no-fail": executable file not found in $PATH` (exit code 127).
  - Cause: we wrote `docker run ... hadolint/hadolint --no-fail`, but that image treats the first
    word as the *program to run* — so it tried to run a program literally called `--no-fail`.
  - Fix: name the binary explicitly: `... hadolint/hadolint hadolint --no-fail - < Dockerfile`
    (the `-` means "read the Dockerfile from input"). We verified the exact form against hadolint's
    own docs before re-running.

- **"All checks passed" but the gates were still report-only.** After we wrote the *enforcing*
  Jenkinsfile, a green build showed the **old** report-only commands in the log
  (`hadolint --no-fail`, semgrep without `--error`, trivy without the gating flags).
  - Cause: the enforcing Jenkinsfile change hadn't actually been applied/committed.
  - Fix: apply and commit the enforcing version; verified the new log showed the gating flags.
  - **Lesson:** a green build doesn't prove the gates *enforce* — check the actual commands ran.

- **The Trivy image scan flagged a dependency (`picomatch`).** This was the dev-dependency /
  lock-file issue solved by the `prod-deps` stage, and then npm's own bundled libraries solved by
  removing npm — both documented in `02-the-dockerfile.md`.

- **Semgrep flagged the HTML-escape function** (`escapeHtml` in `public/app.js`).
  - We *read the code*: it correctly escapes all 5 standard HTML entities in the right order — a
    reviewed false positive (semgrep's suggested library is for sanitizing HTML, a different job).
  - Fix (the enterprise way): suppress it with a written reason —
    `// nosemgrep: javascript.audit.detect-replaceall-sanitization...` plus a comment explaining
    *why* it's safe. (Fix or formally accept — don't just ignore.)

After all that, the pipeline went **green with every security gate enforcing on merit**.

## d) Diagram — the pipeline

```
  push ─▶ Install ─▶  ┌ Lint ┐                 ┌ Dependency check (npm audit) ┐
                      │ Format│  Quality        │ Secret scan (gitleaks)        │  Security
                      │ Type  │ (parallel)      │ Dockerfile lint (hadolint)    │ (parallel)
                      └ Tests ┘                 └ Code scan (semgrep)           ┘
                                       │
                                       ▼
                           Build image (tag = git SHA) ─▶ Image scan (Trivy) ─▶ Push to GHCR
   (any gate fails  ->  the whole build stops, fail-fast)
```

## e) Key takeaways / gotchas
- A real CI pipeline has a **security layer** (deps, secrets, Dockerfile, code, image) — not just
  lint/test/build.
- **Report-only first, then enforce.** That's how you add gates to an existing codebase without
  blocking everything on day one.
- **A green build doesn't mean the gates enforce** — confirm the actual commands in the log.
- When a scanner flags something: **read it** and either *fix* it or *formally suppress with a
  written reason* — never silently ignore.
- Tag the image by **git SHA**, run scanners **inside containers**, and push with
  `--password-stdin` so secrets never hit the logs.
