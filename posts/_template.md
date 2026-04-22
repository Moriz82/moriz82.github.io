---
title: HTB Target Name
slug: htb-target-slug
type: writeup
category: htb              # htb | cit-ctf | other
date: 2026-04-21
difficulty: easy           # easy | medium | hard | insane
os: linux                  # linux | windows
readTime: 10 min read
points: 20
tags: [HTB, WEB, EXAMPLE]
classification: CLASSIFIED-WHITE
summary: One-sentence pitch. Appears on cards and the home page.

engagement:
  platform: Hack The Box
  target: target.htb
  ref: 10.10.11.xx
  start: 00:00:00 CST
  firstBlood: T+00D 00H
  duration: 10 min read
  operator: WDD-01

killchain:
  - { stage: FOOTHOLD, sub: "short sub",  tag: TAG,  color: warn }
  - { stage: USER,     sub: "short sub",  tag: TAG,  color: warn }
  - { stage: ROOT,     sub: "short sub",  tag: GOAL, color: ok   }

loadout:
  - { tool: nmap,     purpose: recon }
  - { tool: curl,     purpose: http }

remediation:
  - What the blue team should fix
  - Another mitigation
---

::: stage n=1 label="RECON" title="First contact."

Prose here. Use backticks for `inline code`, {red:red accent}, {ok:green}, {warn:amber}, {cool:cyan}, {dim:dim}, ==highlight==, **bold**, *italic*.

::: terminal title="shell · user@kali" tx="1.2 KB" rx="3.4 KB"
$ nmap -sV -p- 10.10.11.xx
$ # terminal content is literal — no markdown here
:::

:::

::: stage n=2 label="FOOTHOLD" title="Narrative title for the exploit moment."

Paragraph explaining what you did.

::: opsec
OPSEC note — amber callout with left border. Markdown works inside.
:::

### Why it worked

Subheading explanation.

:::

::: stage n=3 label="ROOT" title="Privesc."

::: img src="../assets/img/writeups/target/screenshot.png" caption="BloodHound graph showing GenericAll" alt="BloodHound screenshot"

::: tip
Tip callout — green left border.
:::

:::
