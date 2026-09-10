---
name: motion-density
description: >
  Apply when building or reviewing Remotion video scenes — the rules that
  keep an educational video feeling like YouTube, not a visual podcast.
  Density, constant motion, popping data reveals, enter+exit choreography,
  transitions, and a clean (never fuzzy) background. Enforced by the
  video-grader's motion/pacing dimensions.
---

The failure mode this prevents: a single number or phrase sitting static on
a background for 10+ seconds. Viewers give ~3 seconds before they judge.
Every beat must feel *alive and accumulating*, not held.

## The 3-second rule (non-negotiable)

No screen state is static for more than ~3 seconds. Within any 3-second
window something must **enter, move, change, highlight, or exit**. The
ambient background and camera push do NOT count — they're baseline, not
content motion. If a beat is 15s long, that's ~5–7 distinct reveals, not one.

## Hard pacing rules (proven on ep003 — this is what read as slop until fixed)

Slow, draggy, sparse animation was the **#1 slop tell** — it kept a
grader-PASSed cut "not postable." These are non-negotiable and the grader
must score them HARDEST (it was repeatedly too generous):

- **Something new every 2–3s.** An actual content event — reveal, transition,
  b-roll change, camera move — every 2–3 seconds.
- **ZERO holds >3s on an active beat.** Ambient drift, camera push, and b-roll
  motion do NOT count as a content event. A slowly drifting static frame is
  still static. Nothing new in 3s = the beat is broken.
- **Long beats get staged sub-reveals.** A 25–50s narration beat is **4–10
  staged sub-reveals**, spaced ~60–90 frames apart (~2–3s), never one visual
  held for 40s. Storyboard every long beat.
- **Snappy entrances: ~6–9 frames, not 15–20.** Slow entrances read sleepy.
  Fast, crisp settle.
- **Visuals land ON or ~3f BEFORE their word.** `timing.json` is ground truth;
  late is the #1 amateur tell. (The narration pipeline is now ElevenLabs **v3**,
  but it STILL emits the same word-level `timing.json` — per-beat `startFrame` +
  per-mark `{word, ms, frame}` — via chunked reassembly. Animation sync is
  unchanged; consume `timing.json` exactly as before.)
- **Strong visual intro in the first ~3s** that establishes the subject — not
  a wall of kinetic words over an unrecognizable zoomed screenshot.
- **Require a static-hold table when grading:** every hold >3s named with its
  frame range, or the render doesn't pass.

Full battle-tested reference: `docs/research/PRODUCTION-LESSONS.md`.

## Screenshots & literal visuals (ep003 fixes)

- **Zoom OUT — readable and recognizable.** The viewer must be able to tell
  *what it is* (which site/page). Show the whole page/headline so the source
  is obvious. Never zoom into a tight crop of random article text.
- **Gentle scroll OK; NO push-in / Ken-Burns on captures.** Establish wide and
  let it read; scroll to reveal.
- **NO circle / ring annotations. Ever.** Cut them everywhere.
- **Text aligned and in-bounds.** Nothing spills its container or the ~6% safe
  margin; watch `whiteSpace: nowrap` overflow. Check every spawn position.
- **Literal visuals over confusing metaphors.** A `FakeTerminal` of dense
  unreadable code beats a hieroglyph "dead language" image for "code you can't
  read." Show the literal thing.

## Density: every data point earns its own reveal

- **Never dump a chart fully-formed, and never leave one lone hero number.**
  A stat beat is not "one −25% held for 15s." It's: the number pops → a
  side annotation pops ("vs 2019 baseline") → a second data point slides in
  → a highlight sweeps the key figure → a caption lands. Each on its own
  word, ~1.5–2.5s apart.
- **Popups on the side and on the chart.** Use labeled callout chips that
  pop onto the margins and directly onto chart elements (value tags on bar
  tops, endpoint labels, annotation arrows). Layer 3–5 per data beat.
- **Progressive charts:** axes draw → bars/line build → value tags pop → a
  comparison/annotation appears → a highlight. Stagger everything.
- **Keyword/argument beats still need a moving motif** — an underline that
  sweeps in, an icon that reacts, an accent line, a second phrase that
  answers the first, a word that recolors on emphasis. Never a bare phrase
  parked center-screen.

## Pop, enter, AND exit

- **Pop:** entrances use spring overshoot (config damping ~12–15) so things
  *snap* in, compounded with scale (0.9→1.03→1) + slight blur→sharp. Flat
  linear fades read as sleepy.
- **Exit:** elements leave when superseded or before the beat ends — slide
  or scale away, don't just vanish at a hard cut. A beat that only ever adds
  and never removes feels static by its end.
- **Between beats:** transition with motion (quick cross-dissolve + a small
  directional slide/scale, ~6–8 frames), never a hard cut. Wrap each beat so
  it eases in from and out to the next.

## Continuous secondary motion

Always keep something subtly alive besides the hero element: a drifting
accent, a blinking cursor, packet/data motes traveling, a slow highlight
pulse, a counting ticker. The eye should never find a truly frozen frame.

## Background: clean, never fuzzy

The background is a designed dark *studio*, not noise. **No visible dot
grid, no grain, no high-frequency texture** — those read as a "fuzzy
screen." Use a deep, smooth gradient with 1–2 large, soft, slowly-drifting
glow blobs (heavy blur) and a gentle vignette. Motion is low-frequency
drift only. If you can see individual dots or static, it's wrong.

## Distinguished, not generic ("Mercedes, not luxury Toyota")

The look must read as a *designed broadcast show*, not a dark-mode template.

- **A persistent broadcast package on every frame:** a subtle inset hairline
  frame, a small monospace channel wordmark in a corner, a section/eyebrow
  label, and a slim progress line. This branded chrome is what separates a
  designed show from a generic AI render — the screen is never "just a
  slide," it's always framed by the system.
- **Editorial precision beats decoration.** Think FT/Bloomberg/Stripe/Linear:
  thin rules, exact alignment to a grid, small-caps mono eyebrows, generous
  negative space, one confident accent. Avoid generic blurred gradient blobs
  as the whole identity — restrain them, or frame them.
- **Confident motion, not bouncy-toy.** Pop should be a crisp, fast settle
  (spring damping ~15–18), not a cartoon bounce. Precise, quick, decisive —
  refined machinery, not a trampoline.
- **Consistency is luxury.** Same margins, same eyebrow style, same accent,
  same easing everywhere. Randomness reads cheap; a strict system reads
  premium.

## Review checklist (video-grader also enforces)

- [ ] Something new every 2–3s; NO hold >3s on an active beat (ambient/b-roll drift doesn't count)
- [ ] Long beats broken into 4–10 staged sub-reveals (~60–90f apart)
- [ ] Entrances are snappy (~6–9f), pop with overshoot, and elements also exit
- [ ] Every number/data point has its own staggered reveal
- [ ] Side + on-chart popup annotations present on data beats (3–5 each) — but NO circle/ring annotations
- [ ] Beat-to-beat transitions carry motion, not hard cuts
- [ ] Keyword beats carry a moving motif, not a bare phrase
- [ ] Screenshots zoomed-out & recognizable; gentle scroll, no push-in
- [ ] All text aligned and in-bounds (no overflow past container / safe margin)
- [ ] Background is smooth — no visible grid/grain/fuzz
