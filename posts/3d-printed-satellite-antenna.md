---
title: 3D-Printed Satellite Antenna
slug: 3d-printed-satellite-antenna
type: project
date: 2025-01-18
readTime: 6 min read
tags: [SDR, RF, NOAA]
classification: UNCLASSIFIED
summary: Breaking down the SDR stack, CAD iterations, and signal-cleanup pipeline that made a budget-friendly NOAA/GOES weather downlink possible.
engagement:
  platform: Backyard SDR
  target: NOAA 18/19 · GOES-16
  ref: 137 MHz · 1.69 GHz
  start: NOV '24
  firstBlood: FIRST GOOD FRAME — 9 days
  duration: 6 min read
  operator: WDD-01
killchain:
  - { stage: CAD,       sub: "helical build",     tag: FUSION, color: warn }
  - { stage: PRINT,     sub: "PETG spine",        tag: PRUSA,  color: warn }
  - { stage: TUNE,      sub: "VNA sweep",         tag: SWR,    color: warn }
  - { stage: CAPTURE,   sub: "rtl-sdr + gqrx",    tag: SDR,    color: warn }
  - { stage: DECODE,    sub: "noaa-apt",          tag: IMG,    color: ok }
loadout:
  - { tool: fusion360,   purpose: cad }
  - { tool: prusa-mk4,   purpose: print }
  - { tool: nanovna,     purpose: swr }
  - { tool: rtl-sdr,     purpose: radio }
  - { tool: gqrx,        purpose: capture }
  - { tool: noaa-apt,    purpose: decode }
---

::: stage n=1 label="CAD" title="A helical, because linear-polarized gets wrecked by Faraday rotation."

Right-hand circularly polarized. NOAA satellites transmit RHCP, so matching it buys you 3 dB over a linear dipole. Helix geometry — four turns, 0.75λ diameter, 0.25λ pitch. At 137 MHz that's ugly big; at 1.69 GHz it's palm-sized, so GOES is the easier target for a first build.

Fusion 360 for the spine, 3mm copper wire wound around a 3D-printed helical jig for repeatability.

:::

::: stage n=2 label="PRINT" title="PETG, 40% gyroid, because a PLA antenna warps in the Texas sun."

Print time: 14 hours. Four pieces that lap-joint together. Wire channels routed at the exact pitch for the helix — no eyeballing the winding.

::: opsec
PLA will deform at ~55°C. San Antonio attics hit 60°C easy. PETG or ASA only.
:::

:::

::: stage n=3 label="TUNE" title="VNA → the antenna lies to you until you measure it."

::: terminal title="shell · operator@bench" lang="bash"
$ nanovna-cli sweep 1.6e9 1.8e9
freq(MHz)   |SWR|   |Z|
1600.00     1.82    48.3 - j15.0
1650.00     1.41    52.1 - j06.2
1690.00     1.12    51.8 + j01.1   ← sweet spot
1700.00     1.19    53.4 + j04.8
1800.00     2.24    44.9 + j22.6
:::

Trimmed the active element 6mm, re-measured, landed at {ok:SWR 1.12 @ 1690 MHz}. Good enough.

:::

::: stage n=4 label="CAPTURE" title="RTL-SDR + an LNA + the sky."

RTL-SDR v3 on a laptop. BiasT-powered LNA at the feedpoint. Gqrx spectrum view, then record to IQ samples when a pass crosses overhead.

::: img src="../assets/img/antenna.jpg" caption="Finished helical mounted on a TV rotor" alt="3D-printed helical antenna pointing at sky"

Pass prediction with `gpredict`. NOAA-19 gave me a 12-minute window at 42° peak elevation — strong enough for a clean capture.

:::

::: stage n=5 label="DECODE" title="noaa-apt → weather image, printed on silicon."

::: terminal title="shell · operator@kali" lang="bash"
$ noaa-apt decode noaa19_pass_20250118.wav -o n19.png
Decoding APT... 97% SNR: 42 dB
Demodulating channel A ... done
Demodulating channel B ... done
Saved n19.png (909×1040)
:::

Visible and IR stripes from the same pass. Frame it, put it on the wall, start planning GOES-16 full-disk capture next.

::: tip
Start with NOAA APT at 137 MHz for your first build — the antenna tolerates more error than GOES does at 1.69 GHz. Walk before running.
:::
:::
