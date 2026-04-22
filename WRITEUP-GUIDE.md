# Writeup Guide

Everything you need to write a new post (writeup or project) and drop it into `posts/`. The build script (`scripts/build.js`) handles the rest.

## TL;DR

1. Copy `posts/_template.md` to `posts/your-slug.md`
2. Fill front-matter
3. Write body using shortcodes below
4. `node scripts/build.js` (or `git push` — GitHub Action builds automatically)

Never edit the generated `.html` in `posts/` — they get overwritten on build.

---

## Front-matter keys

### Required (all posts)

```yaml
---
title: HTB Certificate
slug: htb-certificate
type: writeup            # writeup | project
category: htb            # writeups only — htb | cit-ctf | other
date: 2025-06-14
summary: One-sentence pitch for cards and the home page.
tags: [AD, ADCS, KERBEROAST]
---
```

**`category`** controls which section of `/writeups` the post appears in:

- `htb` — Hack The Box (default if omitted)
- `cit-ctf` — CIT@CTF competition walkthroughs
- `other` — research, bug bounty, anything else

Projects (`type: project`) ignore `category` and show on `/projects`.

### Recommended (writeups)

```yaml
difficulty: hard         # easy | medium | hard | insane  → colors the difficulty chip + ledger bar
os: windows              # windows | linux                → shown as a ghost chip
readTime: 11 min read
points: 40               # HTB box point value            → amber "40 PTS" chip
classification: CLASSIFIED-WHITE   # any string — printed in the top stripe
```

### Optional structured blocks

All of these unlock dedicated UI. Skip them and the page still renders; include them and you get the full ops.log look.

**Engagement meta** (right-side info card on the hero)

```yaml
engagement:
  platform: Hack The Box
  target: certificate.htb
  ref: 10.10.11.71
  start: 04:12:08 CST
  firstBlood: T+04D 11H
  duration: 11 min read
  operator: WDD-01
```

**Kill chain** (top strip + auto-built TOC on the left)

Color options per stage: `ok` (green), `cool` (cyan), `warn` (amber), `red` (crimson), `hot` (pink).

```yaml
killchain:
  - { stage: FOOTHOLD, sub: ".phtml upload", tag: IIS,     color: warn }
  - { stage: USER,     sub: "svc_web shell", tag: RCE,     color: warn }
  - { stage: ROAST,    sub: "svc_sql hash",  tag: KERB,    color: warn }
  - { stage: SHADOW,   sub: "GA · DC01",     tag: CERTIPY, color: warn }
  - { stage: SYSTEM,   sub: "NT AUTHORITY",  tag: GOAL,    color: ok   }
```

**Loadout** (right sidebar "what I ran")

```yaml
loadout:
  - { tool: nmap,       purpose: recon }
  - { tool: ffuf,       purpose: fuzz }
  - { tool: impacket,   purpose: ad }
  - { tool: bloodhound, purpose: graph }
  - { tool: certipy,    purpose: adcs }
  - { tool: hashcat,    purpose: crack }
  - { tool: evil-winrm, purpose: shell }
```

**Remediation** (right sidebar "what blue team should fix")

```yaml
remediation:
  - Server-side upload validation · magic bytes
  - Disable IIS .phtml / .phar handlers
  - Audit writes to msDS-KeyCredentialLink
  - Strip GenericAll from nested groups
```

---

## Body shortcodes

Shortcodes open with `::: name attr="val"` and close with `:::` on its own line. They can contain markdown. Think of them as admonitions.

### Stage section

Wrap each stage's prose. Auto-linked to TOC. If you have a kill chain in front-matter, set `n=` to the stage number so TOC anchors match.

```
::: stage n=4 label="KERBEROAST" title="From svc_web, an SPN that shouldn't have been there."

Once the `.phtml` upload pinned a shell as {red:svc_web}, BloodHound made the next move obvious: {red:svc_sql}, a domain user with an SPN and no pre-auth surprises.

`impacket-GetUserSPNs` with `-request` does the heavy lifting.
:::
```

- `n=` — two-digit zero-padded (stage number)
- `label=` — short uppercase name shown above the big title
- `title=` — narrative sentence. Big, bold.

### Terminal block

```
::: terminal title="shell · svc_web@certificate.htb" tx="4.1 KB" rx="11.8 KB" lang="bash"
$ impacket-GetUserSPNs certificate.htb/svc_web -request -no-pass

SPN Name MemberOf
MSSQLSvc/sql01.certificate.htb svc_sql Domain Users

$krb5tgs$23$*svc_sql$CERTIFICATE$...

# hashcat -m 13100 roast.hash rockyou.txt -r best64.rule
+ svc_sql : Sup3rS3rv1c3!
:::
```

- `title=` — shell context (prompt / session id)
- `tx=`, `rx=` — optional bytes meter, rendered in cyan/green
- `lang=` — syntax highlight language (default `bash`). Options: `bash`, `powershell`, `python`, `yaml`, `json`, `swift` (more via highlight.js autodetect).

Content is literal. No markdown inside. Tabs and whitespace preserved. Syntax highlighted by highlight.js at page load.

### OPSEC note

```
::: opsec
If the first thing you do after a shell isn't a BloodHound collection, you're making the box harder than it needs to be.
:::
```

- Default header is `# OPSEC NOTE` — override with `title="..."`.
- Body is markdown.

### Other callouts

```
::: note title="WHY IT WORKED"
Explanation. Cyan left border.
:::

::: warn
Red left border. Use for "don't do this in prod" warnings.
:::

::: tip
Green left border. Use for shortcuts or protocol hints.
:::
```

### Image with corner brackets

Single-line shortcode — no closing `:::`:

```
::: img src="../assets/img/writeups/certificate/bloodhound.png" caption="GenericAll from svc_sql via nested group" alt="BloodHound screenshot"
```

- `src=` — relative path from `posts/`
- `caption=` — optional
- `alt=` — required for accessibility

Images get a 1px border, padded frame, and corner brackets.

---

## Inline shortcuts

Use inside any prose (including inside stage/opsec/callout):

| Syntax            | Renders as                      | Use for                             |
|-------------------|----------------------------------|-------------------------------------|
| `` `inline` ``    | pink inline code (`inline`)     | commands, file names, identifiers   |
| `{red:svc_web}`   | red accent                      | target users, CVEs, alert phrases   |
| `{ok:SYSTEM}`     | green                           | successful outcomes                 |
| `{warn:GenericAll}`| amber                          | ACEs, risky perms, rolling defaults |
| `{cool:13100}`    | cyan                            | hashcat modes, port numbers         |
| `{dim:comment}`   | dim grey                        | meta / side notes                   |
| `{ink:bold}`      | bright white, bold              | emphasis                            |
| `==highlight==`   | amber highlight marker          | key insight inside a paragraph      |
| `**bold**`        | standard markdown bold          | normal emphasis                     |
| `*italic*`        | italic                          | prose rhythm                        |
| `[text](url)`     | dashed-underline crimson link   | refs, citations                     |

---

## Standard markdown still works

Everything marked supports — headings (`##`), lists (`-`, `1.`), blockquotes (`>`), tables, fenced code blocks (` ``` `) — all styled. Shortcodes are additive, not a replacement.

Fenced code blocks (no language needed) render like a standard block:

```
# this is a regular fenced block
nmap -sV -p- 10.10.11.71
```

Prefer `::: terminal` when you want the TX/RX strip and prompt context. Use regular fences for language snippets (Python, Go, YAML, etc.).

---

## Full minimal example

```markdown
---
title: HTB Certificate
slug: htb-certificate
type: writeup
date: 2025-06-14
difficulty: hard
os: windows
readTime: 11 min read
points: 40
tags: [AD, ADCS, KERBEROAST]
summary: Resume upload → `GenericAll` on the DC in four clean jumps. No zero-days — just primitives the blue team forgot to close.
engagement:
  platform: Hack The Box
  target: certificate.htb
  ref: 10.10.11.71
  firstBlood: T+04D 11H
  duration: 11 min read
  operator: WDD-01
killchain:
  - { stage: FOOTHOLD, sub: ".phtml upload", tag: IIS,     color: warn }
  - { stage: USER,     sub: "svc_web shell", tag: RCE,     color: warn }
  - { stage: ROAST,    sub: "svc_sql hash",  tag: KERB,    color: warn }
  - { stage: SHADOW,   sub: "GA · DC01",     tag: CERTIPY, color: warn }
  - { stage: SYSTEM,   sub: "NT AUTHORITY",  tag: GOAL,    color: ok }
loadout:
  - { tool: nmap,       purpose: recon }
  - { tool: bloodhound, purpose: graph }
  - { tool: certipy,    purpose: adcs }
  - { tool: evil-winrm, purpose: shell }
remediation:
  - Server-side upload validation · magic bytes
  - Audit writes to msDS-KeyCredentialLink
---

::: stage n=1 label="RECON" title="First contact — port scan says IIS, and not much else."
Content here.
:::

::: stage n=4 label="KERBEROAST" title="From svc_web, an SPN that shouldn't have been there."

Once the `.phtml` upload pinned a shell as {red:svc_web}, BloodHound flagged {red:svc_sql}.

::: terminal title="shell · svc_web@certificate.htb" tx="4.1 KB" rx="11.8 KB"
$ impacket-GetUserSPNs certificate.htb/svc_web -request -no-pass
+ svc_sql : Sup3rS3rv1c3!
:::

::: opsec
If the first thing you do after a shell isn't BloodHound, you're making the box harder than it needs to be.
:::

### Why it worked

{red:svc_sql} had ==GenericAll== on `DC01$` via a nested group. Writing a public key to `msDS-KeyCredentialLink` yields the NT hash of Administrator.
:::
```

---

## Preview locally

```bash
node scripts/build.js
npx http-server . -p 4646 -c-1 -s
```

Open `http://localhost:4646/posts/your-slug.html`.

## Deploy

```bash
git add posts/your-slug.md
git commit -m "writeup: your-slug"
git push
```

GitHub Action runs `node scripts/build.js` and commits the regenerated HTML back to main. Live within a minute.

---

## When something doesn't render

1. **Shortcode showing as literal `:::`** — check that the closing `:::` is on its own line with nothing after it, and that the opening has a space between `:::` and the shortcode name (`::: stage`, not `:::stage`).
2. **Front-matter silently ignored** — check YAML indentation (spaces, not tabs). Bracketed-object syntax (`{ key: val, key2: val2 }`) must keep the spaces.
3. **Kill chain TOC empty** — check that `killchain:` is a list of objects with at least `stage:`. The left TOC auto-populates from front-matter, not from `::: stage` blocks.
4. **Post doesn't show on home / index** — `type:` must be exactly `writeup` or `project`. Posts with no `type` are skipped with a warning in the build log.
