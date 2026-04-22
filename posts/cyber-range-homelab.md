---
title: Cyber Range Homelab
slug: cyber-range-homelab
type: project
date: 2025-02-10
readTime: 8 min read
tags: [PROXMOX, CISCO, LAB]
classification: UNCLASSIFIED
summary: Stitched together Proxmox, Cisco routing, and isolated enclaves into a reliable red-team sandbox for malware triage and exploit drills.
engagement:
  platform: Homelab
  target: 10.10.0.0/16 (private)
  ref: r720 · proxmox 8
  start: OCT '24
  firstBlood: FIRST BOOT — 2 days
  duration: 8 min read
  operator: WDD-01
killchain:
  - { stage: HARDWARE, sub: "Dell R720 · 128GB",   tag: TIN,     color: warn }
  - { stage: HYPER,    sub: "Proxmox VE 8",        tag: VIRT,    color: warn }
  - { stage: NETWORK,  sub: "Cisco + VLANs",       tag: L3,      color: warn }
  - { stage: ENCLAVES, sub: "detonate · target",   tag: SANDBOX, color: warn }
  - { stage: OPS,      sub: "CI + snapshots",      tag: LIVE,    color: ok }
loadout:
  - { tool: proxmox,     purpose: hypervisor }
  - { tool: cisco-ios,   purpose: routing }
  - { tool: pfsense,     purpose: edge }
  - { tool: ansible,     purpose: provisioning }
  - { tool: sysmon,      purpose: telemetry }
  - { tool: wazuh,       purpose: siem }
---

::: stage n=1 label="HARDWARE" title="A retired Dell R720 and a plan."

Picked up an R720 off eBay — dual Xeon E5-2670v2, 128GB of DDR3 ECC, 8× 2TB SAS. Not fast, but dense and cheap per core. Added a dual-port 10GbE NIC for the storage network.

Noise was the first problem. Stock fans scream at 50%. IPMI fan curve, plus a pair of Noctua NF-A12-25 pulling from the front, dropped it to tolerable for a garage.

:::

::: stage n=2 label="HYPER" title="Proxmox 8 with ZFS — because snapshots are cheap."

::: terminal title="shell · root@pve" lang="bash"
$ zpool create -o ashift=12 tank raidz2 sda sdb sdc sdd sde sdf
$ zfs create tank/vm
$ zfs create tank/ct
$ zfs set compression=lz4 tank

$ pveperf /tank
CPU BOGOMIPS:      152000
FSYNCS/SECOND:     3842
DNS EXT:           12.01 ms
:::

Nested virtualization enabled for the Windows AD lab. CPU type set to `host` for feature passthrough.

:::

::: stage n=3 label="NETWORK" title="VLANs and a Cisco 3560-X so the lab can't talk to anything important."

Four VLANs on the Cisco switch:

- {cool:10} — management (Proxmox, iDRAC, switch)
- {cool:20} — lab internal (targets, pivots)
- {cool:30} — detonation (malware triage, blackhole-routed)
- {cool:40} — operator (my box, SIEM)

pfSense edges routes between operator + lab. VLAN 30 has zero route to anywhere outside — packets die at the firewall.

::: img src="../assets/img/homelab.jpg" caption="R720 + switch + pfSense · garage lab in production" alt="Homelab server rack"

:::

::: stage n=4 label="ENCLAVES" title="Targets by template — clone, detonate, destroy."

Ansible playbooks that spin up a target profile in under three minutes:

::: terminal title="shell · operator@kali" lang="bash"
$ ansible-playbook -i lab.ini targets/windows-domain.yml \
    -e domain=blackbird.lab -e users=30

PLAY [Provision Windows AD target]
TASK [hypervisor : clone template]    ok
TASK [dns : configure]                 changed
TASK [users : seed 30 domain accounts] changed
TASK [siem : enroll hosts in wazuh]    changed

PLAY RECAP
targets: ok=8 changed=5 unreachable=0 failed=0
:::

Snapshots before every engagement. Roll back takes 4 seconds on ZFS.

:::

::: stage n=5 label="OPS" title="Detection pipeline — because red only matters if blue can see."

Sysmon → Wazuh → Grafana dashboards. Every detonation emits telemetry I can later diff against real-world campaigns.

::: tip
Don't skip the blue side. Half the learning in a homelab is watching your own attack show up in the logs.
:::

What's next: a containerized C2 range, and automated MITRE technique coverage reporting.
:::
