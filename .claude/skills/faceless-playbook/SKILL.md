---
name: faceless-playbook
description: >
  Apply when making channel-level decisions about this faceless tech channel —
  what to make, how often, how to package it, and how to keep viewers watching.
  The always-on operating guide: positioning, cadence, series structure,
  packaging, retention loops, and the 2026 do/don't that keep the channel on
  the safe side of YouTube's inauthentic-content policy. Use before picking a
  topic, titling/thumbnailing an episode, or reviewing whether a video fits the
  channel. Complements per-artifact skills (script-voice, motion-density) with
  the business layer above them.
---

The channel: faceless, pseudonymous, calm, sourced tech explainers for
early-career and aspiring engineers — hand-scripted narration, human voice,
Remotion animation. That deep, hard-to-fake production shape is a **moat in
2026, not a limitation.** Every rule below leans into it.

Full evidence and sources: `docs/research/faceless-youtube-playbook.md` and
`docs/research/retention-packaging-guide.md`. Editorial spine: `CLAUDE.md` +
`docs/research/PLAYBOOK.md`. This skill is the operating distillation on top.

## The 2026 line you must stay on

YouTube's inauthentic-content policy demonetizes mass-produced, templated,
low-transformation uploads (16 channels, ~35M subs, terminated Jan 2026) and
enforces at the **channel level** — one bad pattern can pull monetization from
every video. Hand-scripted + human-voice + custom-animated sits on the *safe*
side by construction. Protect that:

- **Never** solve "faceless" with an AI voice — ElevenLabs output ships
  SynthID + C2PA markers, a machine-readable AI-made flag. Human recording
  ships; clone is timing-only.
- **Never** drift toward interchangeable filler. Every episode carries a POV,
  a real editorial decision, original animation.
- **Never** hire an on-camera host to game the face-proxy — it breaks anonymity
  and the identity. Substitute a *consistent visual system* for the face.

## Positioning — own a lane, not "tech"

- The lane is fixed: **engineering concepts + industry analysis + breaking into
  big tech, for early-career/aspiring engineers.** If a topic doesn't help a
  junior understand a system or get/keep a big-tech job, it's off-strategy —
  reject it.
- One repeatable sentence: *"The channel that explains how the systems you'll be
  asked about in interviews actually work."* Every video serves that person.
- Accurate-but-generic loses. Have a point of view. On a faceless channel the
  warm telling-a-friend voice (`script-voice`) *is* the differentiation.
- Favor high-intent + high-CPM topics: dev-tools / system-design / interview /
  cloud carry both search demand and premium ads ($40–80 CPM band).

## Cadence — sustainable weekly beats heroic-then-dead

- **1 high-quality long-form per week, same day, forever.** Weekly is the honest
  ceiling of the hand-authored pipeline; bi-weekly is an acceptable floor.
- **Consistency is the #1 predictor** — most channels that stall die of
  inconsistent posting. Keep a rolling **2–3 finished-episode buffer** so a bad
  week never breaks the streak.
- Do **not** chase daily volume for the 8,000-hour bar — volume-for-volume is
  exactly what the policy punishes. Longer, genuinely-watched videos bank
  watch-hours faster and stay safe.
- Judge nothing before ~30 published videos. Traction typically appears after
  30–50; monetization ~9–12 months of consistent weekly.

## Length & series — build a library, not a feed

- **8–12 minutes** for a concept explainer; let the idea set the length. Clears
  mid-roll eligibility (pipeline flags <1,200 narration words). A fully-watched
  10-min video beats a half-watched 20.
- Ship inside **named series** mapped to the positioning: *"How X actually
  works"* (evergreen search core), *"Breaking into big tech"* (high-intent /
  high-CPM), *"Industry analysis"* (browse/suggested spikes). Aim **~70%
  evergreen / 30% timely.**
- Every evergreen title targets a **real search query** a junior would type
  ("how does https work", "what is a message queue"). No evergreen ships without
  a query behind it.
- Shorts are a repurposing byproduct, never the growth engine (bar doubled to
  20M/90d, pays far less, cross-pollinates poorly). Use only as a trailer that
  points to a long-form breakdown.

## Packaging — designed before production

- **Title + thumbnail direction exist before the episode is built** (PLAYBOOK
  #10); thumbnails render as Remotion stills from the same tokens.
- **Hide the answer, not the topic.** Concrete curiosity gap: "How TLS Actually
  Works" (topic named, mechanism hidden), not "This One Trick Secures The
  Internet" (bait). Never answer the core question in the title.
- **Title and thumbnail carry different information** (1+1=3) — title states the
  concept, thumbnail carries the one surprising visual or the stakes. No
  redundancy; never repeat the title in the thumbnail.
- **Ban hype words.** Engineers distrust "game-changing / revolutionary /
  seamless"; understatement is the click driver. CTR target **4–6%+**.
- **Squint test:** legible at 25% size with one focal object and ≤3 words; keep
  text out of the bottom-right ~15% (runtime badge). Run **Test & Compare**
  every upload — it picks the winner on watch-time share, not clicks.

## Retention — the click is worthless if they don't watch

Quality CTR is the 2026 game: a 5% CTR at 60% AVD beats a 12% CTR at 15%. The
video must fully pay off the packaging promise, fast.

- **First 30s is the highest-leverage window** (target ≥60% at 0:30). Hook =
  Stakes → Target → Transformation over 20–30s; **withhold the payoff.**
  First visual in the first seconds; delete all throat-clearing ("welcome
  back", "in this video"). Plant the first pattern interrupt at 25–35s.
- **Segment into ~6-minute payoff cycles** — length is unconstrained if each
  segment has its own question and its own resolve.
- **Re-hook every 60–90s; change something on screen every 30–60s** (visual /
  structural / register — never a sound effect or shake). **Open a second loop
  before closing the first.** Deliver mini-payoffs throughout, not one finale.
- **Alternate register:** loud keyword → quiet diagram breathes → loud keyword.
  Two loud scenes back-to-back flatten both.
- Build one clean, **screenshot-able diagram per ~6-min segment** — rewind
  Spikes are a positive signal.
- **Audio is the content on a faceless channel** — master −14 to −16 LUFS; bad
  audio is a silent 0:30 killer.

## Endings & growth loops — no CTA, ever

The channel forbids spoken "like and subscribe" and cadence promises. Retention
replaces the ask; use passive on-platform affordances only.

- **Never announce the ending** (cut "thanks for watching" from the script).
  Overlap the final 15–20s with **real content** + one specific next-episode
  open question; keep the visual bed alive, never a static card.
- **End-screen ONE specific next video, same series > generic latest** — the
  goal is session continuation. Group episodes into focused **playlists.**
- **Pin "what should I break down next?"** — sanctioned engagement + topic
  engine + soft return signal (it's a comment, not an in-video CTA).
- **Recognizability is a growth loop:** fixed palette, type, easing, diagram
  language, thumbnail template, voice — enforced via `src/components/theme.ts`.
  "If your channel looks like anyone made it, YouTube treats it like no one
  made it."
- Seed launches off an owned surface (newsletter / dev-community under the
  *channel brand*, name-free per Hard Rule 1); build one **lead magnet** (a
  sourced systems cheat-sheet / interview-concept map) and link it everywhere.

## Do / Don't

**DO**
- Serve one early-career engineer getting/keeping a big-tech job, every video.
- Ship weekly at quality inside a named series; buffer 2–3 ahead.
- Design packaging before production; put a real query behind every title.
- Nail ≥60% at 0:30 and withhold the payoff; re-hook every 60–90s.
- Keep human script + human voice + custom animation — your survival trait.
- Source everything with a URL; flag unverifiable claims `[VERIFY: claim]`.
- After each video: read the retention graph, fix exactly **one** thing.

**DON'T**
- Don't answer the core question in the title, thumbnail, or first 5 seconds.
- Don't use hype words, clickbait that doesn't pay off, or CTAs in-video.
- Don't chase daily volume or build on Shorts.
- Don't add an AI voice or an on-camera host to fix "faceless."
- Don't publish an evergreen video with no search query behind it.
- Don't drift off the design tokens or trade anonymity for a monetization
  shortcut.
- Don't evaluate the channel before ~30 published videos.

## Retention-graph triage (two weeks post-publish)

Drop at 0:15 → the opening failed. Mid-video drop → that section ran long,
segment it. Spike → make more of that (build screenshot-able moments). Slow
steady decline → normal, fine. Fix **one** thing on the next video, not three.
