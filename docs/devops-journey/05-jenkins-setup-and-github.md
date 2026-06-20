# 05 — Jenkins setup and connecting to GitHub

## a) What & Why (theory)

**Jenkins** is an automation server — a program that runs steps automatically when something
happens (like you pushing code), instead of you typing commands by hand every time. The ordered
list of steps it runs is a **pipeline**, and you write that pipeline in a file called a
**`Jenkinsfile`** that lives in your repo (just like the Dockerfile, but for "what to run").

For Jenkins to build your app it needs three connections set up first:
1. **Read your code from GitHub** — securely, with a credential.
2. **Trust GitHub's server identity** — so the SSH connection is safe (not a fake).
3. **Be able to build Docker images** — i.e. talk to the Docker engine.
4. **Have Node available** — to run your lint/test/build steps.

Our Jenkins runs on the home **Ubuntu laptop** (a separate machine from the Mac), as the system
user `jenkins`.

## b) What we actually did

### Connect Jenkins to GitHub — a read-only SSH deploy key (least privilege)
Instead of using a password or a personal token (which grants broad access), we used a **deploy
key**: an SSH key pair scoped to *this one repo*, **read-only**.

```bash
# 1) Generate a dedicated key ON THE UBUNTU SERVER (where it will live, so it never travels):
ssh-keygen -t ed25519 -C "jenkins-deploy@learning-tracker" -f ~/.ssh/jenkins_lt_deploy -N ""
#   -t ed25519  = modern, strong key type
#   -f ...      = a DEDICATED file (never reuse your personal key)
#   -N ""       = no passphrase (OK: it's read-only, repo-scoped, stored securely in Jenkins)

# 2) Add the PUBLIC half to GitHub:
cat ~/.ssh/jenkins_lt_deploy.pub
#   GitHub repo -> Settings -> Deploy keys -> Add -> paste -> LEAVE "Allow write access" UNCHECKED

# 3) Put the PRIVATE half into Jenkins' credential store (Manage Jenkins -> Credentials),
#    Kind "SSH Username with private key", ID github-learning-tracker-deploy, username git.
# 4) Securely delete the private key file (Jenkins now holds it encrypted):
shred -u ~/.ssh/jenkins_lt_deploy
```
Why: a deploy key is least-privilege (one repo, read-only, not tied to your personal account), and
the secret lives **encrypted in Jenkins**, referenced by an ID — never in code.

### Give Jenkins access to Docker (so the pipeline can build images)
The Docker engine listens on a socket file owned by the `docker` group. Add the `jenkins` user to
that group:
```bash
sudo usermod -aG docker jenkins   # -aG = APPEND the group (omit -a and you wipe jenkins's other groups!)
sudo -u jenkins docker info       # confirm jenkins can reach Docker
sudo systemctl restart jenkins    # a process only reads its groups at startup -> must restart
```
Security note we discussed: being in the `docker` group is effectively **root-equivalent** on the
host. Acceptable here because this box is a *dedicated build host*. On a shared/production
controller you'd isolate builds instead.

### Give Jenkins a Node version (the NodeJS plugin)
Rather than hand-installing Node, we used the **NodeJS plugin**: Manage Jenkins → Plugins → install
"NodeJS"; then Manage Jenkins → Tools → add a NodeJS installation named **`node22`** (install
automatically). The Jenkinsfile then asks for it with `tools { nodejs 'node22' }`, and Jenkins
provisions the same Node version every build (reproducible).

## c) Trial-and-error log

- **Attempt 1 — running the pipeline from SCM failed at the start.**
  - Result, exact error:
    ```
    No ED25519 host key is known for github.com and you have requested strict checking.
    Host key verification failed.
    ```
  - What it means: SSH checks the *server's* identity (github.com) against a list of known, trusted
    servers (`known_hosts`). The `jenkins` user had never connected to GitHub, so github.com wasn't
    trusted, and SSH (correctly) refused. This protects against someone impersonating GitHub.
  - **What we did NOT do:** turn off the check (that reopens the security hole).
  - **Fix:** add GitHub's *real, verified* host key to the **`jenkins`** user's `known_hosts`:
    ```bash
    ssh-keyscan -t ed25519 github.com | tee /tmp/gh_hostkey
    ssh-keygen -lf /tmp/gh_hostkey
    #   verify the printed fingerprint equals GitHub's published ED25519 fingerprint:
    #   SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU
    sudo -u jenkins mkdir -p /var/lib/jenkins/.ssh
    sudo -u jenkins tee -a /var/lib/jenkins/.ssh/known_hosts < /tmp/gh_hostkey
    ```
  - **Key lesson:** it must be the **jenkins** user's `known_hosts` (the user Jenkins runs as), not
    your login user's.

- The **first pipeline build then succeeded** (it cloned the repo over SSH and ran). The
  `usermod`/restart for Docker worked on the first try (we knew up front the restart was required).

## d) Diagram — how Jenkins reaches GitHub

```
   Jenkins (jenkins user on Ubuntu)
        │  uses the read-only SSH DEPLOY KEY (private half in Jenkins credential store)
        │  trusts github.com via the jenkins user's known_hosts (verified fingerprint)
        ▼
   GitHub repo (clones the code + the Jenkinsfile)
```

## e) Key takeaways / gotchas
- Use a **read-only deploy key** (one repo, least privilege); never a password or broad token.
- Secrets live in **Jenkins' credential store**, referenced by ID — never in the Jenkinsfile.
- "Host key verification failed" = SSH doesn't trust the server yet. Fix it by adding the
  **verified** host key to the right user's `known_hosts` — never by disabling the check.
- Adding `jenkins` to the `docker` group needs a **Jenkins restart** to take effect (groups are
  read at process start). And docker-group = root-equivalent on the host.
- The **NodeJS plugin** gives a pinned, reproducible Node version (`tools { nodejs 'node22' }`).
