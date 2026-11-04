# Writing guide

Posts are markdown files in `posts/`. `scripts/build.js` renders each one into the desktop: a server-rendered page at `/posts/<slug>.html` that reads fine without JavaScript, plus an entry in the virtual filesystem (`assets/data/fs.json`) that Files, Console, Activities search and the Text Editor use.

## TL;DR

1. Copy a template: `posts/_template.md` (writeup), `_template-blog.md`, `_template-competition.md` or `_template-project.md` to `posts/<slug>.md`.
2. Fill in the front-matter and write the body.
3. `npm test` builds the site and runs the checks. `npm run preview` serves it at http://127.0.0.1:8080.
4. Push. The Build Site action runs `npm test` and commits the generated HTML.

Never edit generated files (`index.html`, `about.html`, `contact.html`, `posts/*.html`, the section `index.html` files, `assets/data/`, `assets/src/`). They are overwritten on every build.

## Sections

`type` decides the folder a post lives in:

| `type`        | Folder           | For |
|---------------|------------------|-----|
| `blog`        | `/blog/`         | Research, security topics, industry talking points |
| `writeup`     | `/writeups/`     | Hack The Box machines and Pro Labs |
| `competition` | `/competitions/` | CTF and pentest competition recaps |
| `project`     | `/projects/`     | Builds and tools. Add `sub: homelab` to file it under homelab shenanigans |

URLs stay `/posts/<slug>.html` whatever the type, so links never break when a post moves sections.

## Front-matter

Every post:

```yaml
---
title: HTB Certificate
slug: htb-certificate-writeup
type: writeup
date: 2025-06-02
tags: [AD, ADCS, KERBEROAST]
summary: "One or two sentences. Shown under the title, in lists and in search. Inline `code` works."
---
```

Quote `summary` (and `title`) whenever it contains `: `, or the YAML won't parse. The build names the file and line if it doesn't.

Optional, any type:

```yaml
draft: true        # never published; see Drafts below
readTime: 11 min read
repo: https://github.com/Moriz82/Edamame-NG   # projects: shown under the title
sub: homelab       # projects: subfolder
```

Writeups also take:

```yaml
difficulty: hard   # easy | medium | hard | insane
os: windows        # windows | linux
points: 40
avatar: htb-certificate.png   # assets/img/writeups/avatars/<file> (128px portrait)
```

### The ops rail

These blocks build the right-hand rail (it collapses above the article in narrow windows and on phones). Any post type can use them.

```yaml
engagement:
  platform: Hack The Box
  target: certificate.htb
  ref: 10.10.11.71            # shown as "address" on writeups
killchain:                    # "Kill chain" on writeups, "Stages" elsewhere
  - { stage: FOOTHOLD, sub: ".phtml upload" }
  - { stage: USER,     sub: "svc_web shell" }
  - { stage: SYSTEM,   sub: "NT AUTHORITY" }   # last stage is shown as the goal
loadout:
  - { tool: bloodhound, purpose: graph }
remediation:
  - Server-side upload validation, check magic bytes
  - Audit writes to `msDS-KeyCredentialLink`
```

Kill-chain entries link to the matching `::: stage` block by label, so keep `stage:` and the stage `label=` the same word. Older front-matter keys (`tag`, `color`, `start`, `firstBlood`, `duration`, `operator`, `classification`, `category`) are ignored.

## Body shortcodes

Open with `::: name attr="val"`, close with `:::` on its own line.

```
::: stage n=4 label="KERBEROAST" title="From svc_web, an SPN that shouldn't have been there."
Markdown here, including the blocks below.
:::

::: terminal title="shell · svc_web@certificate.htb" lang="bash"
$ impacket-GetUserSPNs certificate.htb/svc_web -request -no-pass
:::

::: opsec
Markdown. Header defaults to "OPSEC note"; override with title="...".
:::

::: note title="Why it worked"
::: warn
::: tip
(each closes with :::)

::: img src="../assets/img/writeups/certificate/bloodhound.png" caption="GenericAll via nested group" alt="BloodHound graph"
```

- `stage`: `label` shows as "Stage n · Label" (all-caps labels are shown in sentence case, three-letter acronyms stay caps). `title` is the heading and accepts inline markdown.
- `terminal`: content is literal, no markdown. `lang` picks highlighting (default `bash`; `powershell`, `python`, `yaml`, `json`, `http`, `swift` and the highlight.js common set work). Optional `tx=` / `rx=` add a byte meter.
- `img`: single line, no closing `:::`. Write `src` relative to `posts/` (`../assets/...`); the build makes it root-relative.

Inline: `{red:text}`, `{ok:text}`, `{warn:text}`, `{cool:text}`, `{dim:text}`, `{ink:text}` color a phrase (also inside terminals), `==text==` highlights. Standard markdown (headings, lists, tables, fenced code, links) works everywhere.

## Drafts

Two kinds:

- **`draft: true`** in front-matter. The build skips the post entirely: no page, no listing, no source JSON. Flip it to `false` (or delete the line) to publish. The markdown is still visible in the public repo.
- **Encrypted HTB drafts** for active machines live in `drafts/*.md.enc`. Use `scripts/draft.sh lock|unlock|edit`. The Publish Retired workflow decrypts and publishes them automatically when HTB retires the machine. Never commit an unlocked active-machine writeup.

## Checks

`npm test` (also run in CI) fails if a draft is emitted, a published post lacks its page or source, raw markdown leaks into rendered prose, assets use `../` paths, or the email address or phone number appears in any generated file.

## When something doesn't render

1. A shortcode shows as literal `:::`: the closing `:::` must be on its own line, and the opener needs a space (`::: stage`, not `:::stage`).
2. The build prints `[error] … not valid YAML`: quote the value it points at.
3. A post is missing from its section: check `type`, and that it isn't `draft: true`.
