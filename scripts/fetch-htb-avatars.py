#!/usr/bin/env python3
"""Fetch HTB machine avatar images for writeup posts that declare an avatar field."""
import requests, time, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "assets" / "img" / "writeups"
API_KEY = open(os.path.expanduser("~/.config/htb-operator/config.ini")).read().split("api_key = ")[1].split("\n")[0].strip()
HDR = {"Authorization": f"Bearer {API_KEY}", "User-Agent": "htb-operator/1.4.3"}
CDN = "https://htb-mp-prod-public-storage.s3.eu-central-1.amazonaws.com"

BOXES = {
    "htb-pingpong": 891,
    "htb-silentium": 867,
    "htb-logging": 888,
    "htb-certificate": 589,
    "htb-escapetwo": 641,
    "htb-heal": 631,
    "htb-planning": 635,
}

for slug, mid in BOXES.items():
    out = DEST / f"{slug}.png"
    if out.exists() and out.stat().st_size > 10000:
        print(f"[skip] {slug} — already exists ({out.stat().st_size}b)")
        continue
    time.sleep(3)
    r = requests.get(f"https://labs.hackthebox.com/api/v4/machine/profile/{mid}", headers=HDR, timeout=15)
    if r.status_code != 200:
        print(f"[fail] {slug} — API {r.status_code}")
        continue
    avatar = r.json()["info"]["avatar"]
    img_url = f"{CDN}{avatar}"
    time.sleep(2)
    r2 = requests.get(img_url, timeout=15)
    ct = r2.headers.get("content-type", "")
    if "image" in ct and len(r2.content) > 1000:
        out.write_bytes(r2.content)
        print(f"[ok] {slug} — {len(r2.content)}b from {img_url}")
    else:
        print(f"[fail] {slug} — {r2.status_code} {ct[:30]} {len(r2.content)}b")
        print(f"       URL: {img_url}")
        print(f"       Try manually: open https://app.hackthebox.com/machines/{mid} and save avatar")
