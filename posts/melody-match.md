---
title: Melody Match
slug: melody-match
type: project
date: 2024-12-03
readTime: 7 min read
tags: [SWIFT, PYTHON, ESP8266]
classification: UNCLASSIFIED
summary: Built at RowdyHacks X. A Swift iOS client and Python backend coordinate BPM-aware track selection through ESP8266 telemetry.
engagement:
  platform: RowdyHacks X
  target: 36-hour hackathon
  ref: San Antonio
  start: NOV '24
  firstBlood: FIRST DEMO — 32 hours
  duration: 7 min read
  operator: WDD + team (4)
killchain:
  - { stage: HARDWARE, sub: "ESP8266 + HR sensor", tag: WEARABLE, color: warn }
  - { stage: BACKEND,  sub: "FastAPI + Postgres",  tag: PYTHON,   color: warn }
  - { stage: CLIENT,   sub: "SwiftUI + Spotify",   tag: IOS,      color: warn }
  - { stage: MATCH,    sub: "bpm-aware ranker",    tag: LOGIC,    color: warn }
  - { stage: DEMO,     sub: "judges + lanyards",   tag: SHIPPED,  color: ok }
loadout:
  - { tool: esp8266,   purpose: wearable }
  - { tool: fastapi,   purpose: backend }
  - { tool: postgres,  purpose: db }
  - { tool: swiftui,   purpose: client }
  - { tool: spotify,   purpose: catalog }
---

::: stage n=1 label="HARDWARE" title="Cheap micro + a pulse sensor on a 3D-printed strap."

ESP8266 over Wi-Fi, an off-the-shelf PPG heart-rate sensor, a LiPo and charging circuit. Telemetry sent as JSON every 2 seconds to the backend.

::: terminal title="esp8266 · serial" lang="bash"
[wearable] booted · wifi=ok · ip=192.168.42.17
[wearable] sensor ready · baseline 72 bpm
[wearable] → POST /telemetry  {"user":"will","bpm":74,"ts":1701212101}
[wearable] → POST /telemetry  {"user":"will","bpm":76,"ts":1701212103}
[wearable] → POST /telemetry  {"user":"will","bpm":81,"ts":1701212105}
:::

:::

::: stage n=2 label="BACKEND" title="FastAPI because we had 32 hours."

::: terminal title="shell · server · python" lang="python"
@app.post("/telemetry")
async def telemetry(packet: Telemetry, db: Session = Depends(get_db)):
    window = await db.recent_bpm(packet.user, seconds=30)
    state = infer_state(window)   # rest | active | peak
    await catalog.suggest(packet.user, bpm=packet.bpm, state=state)
    return {"ok": True, "state": state}
:::

30-second rolling window smooths out sensor noise. The state classifier is a simple threshold tree — not ML, just engineering.

:::

::: stage n=3 label="CLIENT" title="SwiftUI + Spotify SDK, because iPhones were the demo platform."

::: terminal title="swift · ios app" lang="swift"
struct NowPlayingView: View {
    @EnvironmentObject var session: Session
    var body: some View {
        VStack(alignment: .leading) {
            Text("\(session.bpm) BPM")
                .font(.system(size: 72, weight: .heavy, design: .monospaced))
            Text(session.state.rawValue.uppercased())
                .foregroundColor(session.state.color)
            TrackRow(track: session.nextTrack)
        }
    }
}
:::

Swift + Spotify SDK handled the catalog pull. The client just renders whatever state + track the server assigns.

:::

::: stage n=4 label="MATCH" title="BPM-aware ranker — your heart rate picks the next song."

Target track tempo = {cool:current_bpm ± 10}. Pull top 40 candidates from Spotify's recommendations endpoint, filter by tempo band, pick the highest-rated one we haven't played in the last hour.

::: note title="WHY IT FELT GOOD"
The jump from "music is random" to "music tracks your effort" is a small UX change that feels enormous. The algorithm is simple — the effect is the real product.
:::

:::

::: stage n=5 label="DEMO" title="32 hours in, green lanyards, one working prototype."

Judges tried it on. A volunteer's resting heart rate pulled up lo-fi. 30 seconds of jumping jacks bumped it to 130, and the app swapped to drum-and-bass mid-song. Loud applause. We walked away with top 10 and a bag of swag.

::: tip
Hackathon wisdom: one feature that feels magical beats three features that work OK. Cut ruthlessly at hour 20.
:::
:::
