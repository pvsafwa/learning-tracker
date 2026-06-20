# 09 — AWS account security and identity

## a) What & Why (theory)

In AWS, your **root user** is the master key to the entire account *and its billing*. If it leaks,
someone owns everything and can run up a huge bill. So the first rule of any AWS setup:
**lock root away and never use it for daily work** — turn on MFA, never create root access keys,
and do everything through a *limited* identity instead.

The **gold standard** for identity is: **no long-lived access keys anywhere.** Use short-lived,
federated credentials. There are two halves:
1. **Human access** — ideally **IAM Identity Center** (AWS's SSO): you log in and get short-lived
   credentials, no static keys.
2. **Automation** — **IAM roles** (an EC2 gets temporary credentials automatically via an *instance
   role*; no keys stored).

## b) What we actually did

**Locked down root** (in the AWS Console): enabled **MFA** on root, confirmed there are **no root
access keys**, and set a **billing budget alarm** (alert at 80% of a small monthly budget) so the
$200 credit can't silently drain.

Because IAM Identity Center turned out to forfeit the free credits (see trial-and-error), we built
the **best gold-standard identity possible without it** — an **assume-role + MFA** setup:

- An IAM **user `safwan`** with MFA, whose *only* permission is to **assume** the `admin` role.
- An IAM **role `admin`** with `AdministratorAccess`, whose **trust policy requires MFA**:

```json
// admin role TRUST policy (who may assume it):
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::729147110687:user/safwan" },
    "Action": "sts:AssumeRole",
    "Condition": { "Bool": { "aws:MultiFactorAuthPresent": "true" } }
  }]
}
```
```json
// safwan user's permission (it can ONLY assume that role, nothing else):
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": "arn:aws:iam::729147110687:role/admin"
  }]
}
```

On the Mac, two CLI profiles tie it together (`~/.aws/config`):
```ini
[profile safwan-base]            # the long-lived key (near-useless on its own)
region = us-east-1

[profile admin]                  # "borrow admin, with MFA, for ~1 hour"
region = us-east-1
role_arn   = arn:aws:iam::729147110687:role/admin
source_profile = safwan-base
mfa_serial = arn:aws:iam::729147110687:mfa/Poco-F6   # your phone's MFA device
```
Verified it works:
```bash
aws sts get-caller-identity --profile admin
# prompts for MFA, then returns:  "Arn": ".../assumed-role/admin/..."   <- short-lived, MFA-gated
```
Why this is strong: the base key can do *nothing* alone (only assume-role, only with MFA), and the
credentials you actually use are **short-lived (~1 hour)**. A leaked key is near-worthless.

Account ID: **729147110687**. Region (tentative): **us-east-1**.

## c) Trial-and-error log

- **Attempt 1 — enable IAM Identity Center (the gold-standard SSO).**
  - Result: the "Enable" screen warned:
    *"Creating an organization automatically upgrades your account from a free plan to a paid plan…
    and your free tier credits expire immediately."*
  - **You caught this and stopped** — correct. The org-level Identity Center creates an AWS
    Organization, which would **forfeit the $200 credits.** Do not enable it on this account.

- **Attempt 2 — the "account instance" of Identity Center** (the single-account option that doesn't
  create an Organization, so it keeps the credits).
  - We **verified against AWS docs** instead of guessing. The docs say plainly:
    *"Account instances do not support permission sets and therefore do not support access to AWS
    accounts."* So it only works for AWS *applications*, **not** console/CLI login. Dead end.

- **Conclusion / final solution.** On a brand-new free-plan account you **cannot have both**
  gold-standard SSO **and** the $200 credits. We chose to **keep the credits** (the whole project
  needs them) and use the **assume-role + MFA** identity above — gold standard for *automation*
  (instance roles, later) and as-close-to-keyless as possible for the human CLI. Honest interview
  framing: *"On a new account, Organizations/Identity Center forfeits the free credits, so I used
  an MFA-hardened assume-role identity for human access and instance roles for automation. In a
  funded enterprise I'd use Identity Center SSO + multi-account."*

## d) Diagram — the assume-role identity

```
   IAM user "safwan"  ──(can ONLY assume-role, and ONLY with MFA)──▶  IAM role "admin"
   (long-lived key,                                                   (AdministratorAccess)
    near-useless alone)                                                       │
                                                                              ▼
                                                       short-lived (~1h) credentials you actually use
```

## e) Key takeaways / gotchas
- **Never use root.** MFA on root, no root keys, billing alarm on.
- **Gold standard = no long-lived keys.** Short-lived, MFA-gated, assumed-role credentials.
- **AWS's new free tier forfeits credits the moment you create an Organization** — which IAM
  Identity Center (org instance) requires. The *account* instance can't do CLI access. So SSO and
  the $200 credits are mutually exclusive on a new account.
- The **assume-role + MFA** pattern makes a leaked key near-worthless (it can only assume a role,
  only with MFA; working creds expire in ~1 hour).
- Automation later uses **IAM instance roles** — fully keyless, no Organization needed.
