# The one-shot recipe — how to make ep005's animation without ep005's fifteen rounds

Episode 005 took two days and fifteen render rounds. The animation that came
out the far end is the target quality bar: **this file exists so the next
episode reaches it in two renders instead of fifteen.**

`PRODUCTION-LESSONS.md` is the *diagnostic* record — what failed and why. This
file is the *prescriptive* one: the order to do things in, and the arithmetic to
author against before anything is rendered. On conflict, PRODUCTION-LESSONS
still wins on any question of taste; this file wins on order of operations.

---

## Why it took fifteen rounds (the only diagnosis that matters)

Not because the work was hard. Because **the loop was render-first**:

> author against a vibe → render 40 min → measure → discover a defect class →
> write a gate for it → fix → render again

Every gate in `scripts/` was written *after* the defect it catches had already
burned a round. Fifteen rounds bought eleven gates. **Episode 006 inherits all
eleven for free**, which is the entire saving — but only if they are run *before*
the first render instead of after it.

The second cause, which cost more time than any single bug: **authoring against
a feeling instead of against the measurement model.** Eleven separate times, a
scene was changed, a comment was written crediting the change, and the change
measured **0.000%**. Not "too small" — *zero*. See the arithmetic section; it is
short, and knowing it up front is worth more than any amount of iteration.

---

## The ladder

Do these in order. Nothing below step 4 is meaningful until everything above it
is green.

### 1 · Script, and the script gate

```bash
python3 make_narration.py episodes/NNN-slug/script.yaml   # reading copy + word count
# then: script-grader agent on script.yaml   -> must PASS
```

Read it aloud yourself after the grader passes. The grader is generous; your ear
is the real gate. Under 1,200 words means the episode is too short for mid-roll.

### 2 · Voice, and the timing that everything else is pinned to

```bash
python3 make_tts.py episodes/NNN-slug/script.yaml --v3
./scripts/master_narration.sh episodes/NNN-slug
```

**This is the last moment a re-voice is cheap.** Every frame number in every
scene is derived from this audio. A re-voice after animation begins invalidates
every absolute frame in every comment in the episode — ep005 did it once
(beat 10, a factual correction) and it moved the composition 18500 → 18483
frames and stranded four hand-typed `DURATION=` constants.

Before moving on, capture the two things you will pin against:

```bash
ffmpeg -v info -i episodes/NNN-slug/narration.master.wav \
  -af silencedetect=noise=-35dB:d=0.3 -f null -      # silences -> STDERR
```

Per-word truth is `.tts_cache/<hash>.json` → `spoken: [[word, seconds]]`, with
`abs = beat.startFrame + round(seconds * 30)`. **`timing.json` carries only
per-beat `startFrame` plus a few anchor marks — it is not the per-word source.**
`.tts_cache` holds multiple takes of the same beat and does not mark which one
shipped; discriminate by which one's `dur` lands exactly on a beat boundary AND
agrees with silencedetect.

### 3 · Register the episode

One literal in `src/episodes.ts` and one case in `scripts/_episode_env.zsh`.
The type checker will name every field you missed. Every gate below is
episode-agnostic *only* because of this entry.

### 4 · Animate — against the arithmetic below, not against a vibe

### 5 · All static gates, before any render

```bash
EPID=eNNN ./scripts/gates.sh
```

Eleven gates, no pixels, ~2 minutes: `tsc`, `eslint`, contrast floor, dead
sub-reveals, type size, dimmed ink, word sync, bench receipts, credits, a
zero-warning schedule resolve, `playhead: true` on every beat, plus an advisory
SFX-coverage warning. Exit code is the number of failures.

**Do not render on a red board.** A render started here measures a cut you
already know is broken, and it costs 40 minutes to tell you so.

### 6 · Render ONE grading cut at half scale

```bash
ROUND=r1 EPID=eNNN SCALE=0.5 ./scripts/render_episode.sh
ROUND=r1 EPID=eNNN SCALE=0.5 ./scripts/stitch_episode.sh
```

Chunked, fresh process per chunk, zombies killed between. This machine OOMs at
1080p with concurrency > 1 — see PRODUCTION-LESSONS § RENDERING. Half scale is
fine for every measurement below: the pacing model downscales to 240×135 anyway.

### 7 · Measure, sweep, grade — all three, in this order

```bash
./scripts/measure_pacing.sh <the stitched mp4>   # the three metric tiers
npm run sweep -- <the stitched mp4>              # anonymity, in frames
# then: video-grader agent on the episode folder
```

### 8 · Fix, then the 1080p master

Fix what step 7 names, re-run step 5, and render the final at `SCALE=1`.

**Two renders is the budget: one grading cut, one master.** If you are on round
four, something in steps 4–5 is being skipped — go back and find which gate you
are not believing.

### 9 · The human watch

Full screen, twice. Once for whether it works, once reading every on-screen
string for anonymity. **A grader PASS only earns this watch; it never replaces
it.** This is the real gate and no tool in this repo can do it.

---

## The author-time arithmetic

Everything here is enforced against a **240×135 grayscale proxy** of the render.
Author to these numbers *before* the first render and step 7 has nothing to say.

### Three metric tiers. Never conflate them — this cost more ep005 time than any other single mistake.

| Tier | Test | Threshold | Fails at |
|---|---|---|---|
| **LIT / empty frame** | absolute | pixel lit at Rec.601 luma **≥ 110**; frame empty if < 1% lit | run ≥ 2.0s |
| **Content event** | difference | \|Δluma\| ≥ 25 over **≥ 0.3%** of frame in 1 frame, or ≥ 2.0% in 6 | gap > 3.0s |
| **Major event** | difference | **≥ 1%** in 1 frame, or ≥ 5% in 6 | gap > 5.0s |

A 3-second window is **dead** iff it has no ≥0.3% burst start **and** its median
per-frame ink is < 0.05%. Both halves are required — a single area gate swung
16% → 87.6% dead on one identical cut.

**~1.16% is the empirical single-frame pass point for a major event. Size for
≥ 1.2%.**

### Palette luma (Rec.601) — memorize the 110 line

```
bg 0 · panel 10 · hairline #30363D 53 · stroke #525C68 90
down #F85149 130 · dim #8B949E 147 · accent #58A6FF 153
warm #E3B341 175 · ink #E6EDF3 236
```

**`hairline` (53) and `stroke` (90) are BELOW 110 and contribute 0.000% to the
lit metric.** This bug was hit six-plus times on ep005; four different agents
shipped comments crediting repaints that lit exactly nothing. If a fix is meant
to raise lit area it must use **≥ 130**.

### The five rules that make a reveal actually register

1. **`areaPct × 6 / durationFrames ≥ 2.0`.** Buy area by making things
   **larger and darker-and-chromatic**, never by making a thin thing brighter.
2. **A ramp is not an event.** An ease-out over N frames has a best single-frame
   step of only `(3/N) × Δ`. Use a **linear `clipPath` wipe**. Drive a
   left-to-right wipe with `sqrt(t)`, because area advances as width².
   (A constant-height rectangle is already linear in width.)
3. **Under 8px is invisible.** The proxy downscale is swscale *bicubic*, whose
   support is wider than a box: 6px = 0.75 proxy px = **gone**; 8px = exactly 1
   proxy px = registers; ≥24px reads near true luma.
4. **These are not events at any threshold:** typewriters (a 150-frame reveal of
   a 20-char string cleared the gate on **0 of 151 frames**), count-ups, filling
   bars, growing curves, opacity ramps, slow pans, ambient drift, b-roll motion.
   Mono glyph ink is ~12–15% of its own line box, so sizing a text reveal by its
   box overstates it ~7×.
5. **Never fade a whole layer out.** Multiplying a layer by `(1 - t)` drives every
   `theme.ink` element under luma 110 as opacity crosses ~0.466 — a silent empty
   run manufactured by a *retire*. Exits must be front-loaded (ease-**out**), and
   something else must already be lit.

### Sync

- `sub()` / `lin()` return exactly 0 *at* their own offset and the JSX gates on
  `driver > 0`, so **a reveal authored at local N first paints at N+1.** Author
  at `(word − step_start) − 1`.
- **A negative `at` is a bug, not headroom** — `at: -1` mounts the element 16.7%
  painted for the entire preceding beat.
- `at = offset / NOMINAL[step]`, never `offset / slot-span`.
- **v3 audio tags are not words.** `[deadpan]`, `[pause]`, `[excited]` carry
  timestamps in `spoken` but are *performed* — they occupy silence. A cue pinned
  to a tag fires into dead air.
- **`SFX_PLAN` order is load-bearing.** `check_wordsync` recovers a cue's identity
  by matching a beat's entries in *authored* order against resolved events in
  *frame* order. Re-fitting one cue past a sibling silently breaks every `why` in
  that beat.
- Prefer 0 frames of lead over 1, so a re-voice degrades to on-the-word rather
  than back over the line.

### Containers

Put the plate **inside** the wrapper its own clip reveals, so no panel can render
empty under any drift. An empty bordered box is invisible to every automated gate
— b-roll behind the scrim satisfies the difference test while the foreground is a
loading skeleton. That is the exact "grader PASSed it, the human eye says slop"
failure.

---

## What still cannot be known without pixels

Be honest about the limit of step 5. The static gates prove a reveal *exists*,
*resolves*, *lands on its word*, and is *legible*. They do **not** prove it is
big enough — `areaPct` is authored, not measured, and a wrapper with
`transform: scale(0.5)` defeats static analysis entirely.

So the one grading render in step 6 is not optional, and the pacing report is
the only thing that can say "your reveal measured 0.000%".

---

## Trust rules

Written because they were violated repeatedly on ep005, by agents and by me.

- **Measure, then write the comment. Never the reverse.** Every claim of the form
  "this is the beat's biggest delta" that was checked turned out false.
- **A stale absolute frame in a comment reads exactly like a measured one.**
  Header-block absolutes go stale after every re-voice; step-*local* numbers stay
  correct. When a comment states an absolute frame, assume it is modelled until
  you have re-derived it.
- **Distrust the report, including your own.** A partial grade means a partial
  fix. When an agent says it fixed eight things, verify the count.
- **Fix bug classes centrally.** The same defect appearing in three scenes is one
  bug in a shared component or one missing gate.
- **A gate that fails for a reason unrelated to what it guards is worse than no
  gate**, because the noise is what gets ignored. If a gate is red on arrival,
  scope it or exempt it with a written reason — do not learn to skim it.
