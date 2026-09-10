# Production lessons — what actually works, proven making ep003

Battle-tested refinements from the ep003 render/grade/rework cycles
(2026-08/09). These go **beyond** the research corpus and PLAYBOOK — they are
the hard-won "the grader passed it but the human eye still said *AI slop*"
fixes. When a rule here conflicts with a softer statement elsewhere, **this
file wins** — it was proven against a real cut, not derived.

The meta-lesson, and the frame for everything below:

> **A grader PASS is not "done." The human first-pass watch is the real bar.**
> The video-grader was repeatedly *too generous* (PASSed 7.8, then 8.4, while
> the creator's eye still called it "not postable"). Grade pacing HARDEST; a
> PASS only means "eligible for the human watch," never "ship it."

---

## SCRIPT — conversational, non-monotonous, contraction-first

Rule of thumb per point:

- **Telling a friend, not reading a script.** Warm, in-the-moment, reacts to
  what's on screen. 002 sounded "like reading off a script" — that's the
  failure. Vary energy; a flat, even read is a slop tell.
- **Always contract, always reduce.** Never `do not / cannot / going to` —
  always `don't / can't / gonna`. Whenever a phrase *can* shorten, shorten it
  (`want to → wanna`, `kind of → kinda`, `it is → it's`). Long forms read
  stiff and AI. This is a global rule, every script. (see
  `.claude/skills/script-voice/SKILL.md` §2.)
- **Run the AI-tell scrub every draft.** Kill the vocabulary (`delve,
  leverage, robust, furthermore, landscape`), staccato triads, `it's not X,
  it's Y`, signposted recaps ("So what does this mean?"), `-ing` significance
  trailers. 3+ co-occurring tells in a paragraph = rewrite.
- **Vary sentence length — measure it.** Per 10 sentences: ≥1 under 6 words,
  ≥1 over 25, under 70% inside the 12–22 band. Uniformity is the master tell.
- **Elongation lives in flowing sentences, not staccato fragments + pause
  tags.** ep003's first draft over-fragmented (45% of sentences under 6 words)
  and graded REVISE; merging triads into breathed sentences flipped it to
  PASS. Warmth comes from *long connected clauses*, not choppy stabs.
- **Titles are conversational, never an AI two-beat aphorism.** Bad: *"The
  code works. Nobody knows why. That's the problem."* — that clipped
  three-sentence rhythm is a fingerprint. Write the title the way you'd say it
  to someone.
- **The ElevenLabs clone IS the voice — ship it by design.** Published
  episodes use the clone (make_tts.py output), not a human recording. So the
  cue system exists to make the clone read *human*: `/ // [beat] [breath]`
  pacing, `[dry]/[up]/[down]` tone, `**punch**` emphasis, spelled-out numbers
  (`Base44 → "Base forty-four"`), and `[say: "..."]` pronunciation. These are
  the levers that make it slow/warm/emphatic. (Full rules:
  `elevenlabs-narration` skill.)
- **Pipeline is ElevenLabs v3 now (ep004+), v2 is the fallback flag.** On v3
  (`make_tts.py --v3`) the tone cues become REAL inline audio tags
  (`[dry]→[deadpan]`, `[up]→[excited]`, `[down]→[softly]`, `[smile]→[warmly]`)
  and `**punch**` becomes an UPPERCASED word — the tone cues are performed, no
  longer stripped. v3 has no `<break>` tags, so pauses are ellipses / `[pause]`.
  Because v3's char-alignment path caps ~2k chars, the script is chunked on
  beat boundaries and reassembled — but it **STILL emits the identical
  word-level `timing.json`** (per-beat `startFrame` + per-mark
  `{word, ms, frame}`), so animation sync is unchanged. v2 stays wired as a
  fallback for regression.
- **Don't over-cue.** ep003's clone read "grandma-slow" from stacked
  `[down]/[dry]` + ellipses + over-hedging ("very, very"; "bragged — bragged").
  A cue every sentence flattens all of them. Run a tighter rhythm/hedge pass
  up front so you never have to re-voice draggy beats later.
- **script-grader gate before recording — but it's generous.** PASS it, then
  read it aloud yourself. The human ear is the real gate here too.

---

## PACING / ANIMATION — the biggest lesson (this is what read as slop)

Slow, draggy, sparse animation was the **#1 slop tell** — the thing that kept
ep003 "not postable" even after b-roll was praised. Fix it structurally:

- **Something new every 2–3 seconds.** A reveal, a transition, a b-roll
  change, a camera move — an actual *content event* every 2–3s.
- **ZERO on-screen holds >3s on an active beat.** Ambient drift, camera push,
  and b-roll motion **do NOT count** as a content event — a slowly drifting
  static frame is still a static frame. If nothing new has entered/changed/left
  in 3s, the beat is broken.
- **Long narration beats need staged sub-reveals.** A 25–50s beat is not one
  visual held for 40s — it's **4–10 staged sub-reveals**, spaced ~60–90 frames
  apart (~2–3s at 30fps). Break every long beat into a mini-storyboard.
- **Snappy entrances: ~6–9 frames, not 15–20.** Slow entrances read sleepy.
  Fast settle, spring overshoot (damping ~15–18), crisp — not a cartoon bounce.
- **Rotate entrance grammar — ≥4 kinds, never the same >3 in a row.** Spring
  pop, line draw-on, morph/transform from an existing element, camera move,
  count-up number, dock/undock, mask-wipe reveal. Fourteen identical pops read
  as banner ads.
- **Visuals land ON or ~3 frames BEFORE their word — never after.** `timing.json`
  word marks are ground truth; late is the #1 amateur tell.
- **Strong intro that establishes the subject visually in the first ~3s.** Not
  a wall of kinetic words over an unrecognizable zoomed screenshot — the viewer
  should *see what this is about* immediately.

### How "a content event" is actually MEASURED (ep005, rounds 7–12)

Everything above is enforced against a **240×135 grayscale proxy** of the
render (`pacing_r8.py`). Authoring against a vibe instead of against this
model is how eleven rounds of "I added a reveal" measured 0.000%. Two
DIFFERENT metrics, and conflating them wasted more time on ep005 than any
other single mistake:

1. **LIT / empty-frame gate — ABSOLUTE.** A pixel is lit at Rec.601 luma
   ≥ 110. A frame is empty if < 1% of pixels are lit; a run ≥ 2.0s FAILS.
2. **CONTENT-EVENT / ink gate — DIFFERENCE.** |Δluma| ≥ 25 between frames.
   A burst starts at ≥ 0.3% of frame in ONE frame, OR ≥ 2.0% inside a
   6-frame window. Bursts merge.
3. **Calibrated dead stretch:** a 3s window is dead iff it has no ≥0.3%
   burst start AND its median per-frame ink is < 0.05%. A single area gate
   swings 16% → 87.6% dead on one cut; you need both halves.

**Palette luma (Rec.601, measured — memorize these).** `bg` 0 · `panel` 14 ·
`hairline` #30363D **53** · `stroke` #525C68 **90** · `down` #F85149 130 ·
`dim` #8B949E 147 · `accent` #58A6FF 153 · `warm` #E3B341 175 · `ink`
#E6EDF3 236.

- **THE #1 RECURRING BUG — hit five times on ep005.** A large region painted
  in `hairline` (53) or `stroke` (90) contributes **0.000%** to the LIT
  metric. Both are under 110. Four separate agents shipped comments crediting
  repaints that lit exactly nothing. If a fix is meant to raise lit area it
  must use ≥ 130. *Measure, then write the comment — never the reverse.*
- **A RAMP IS NOT AN EVENT.** An ease-out opacity/colour ramp over N frames
  has a best single-frame step of only `(3/N) × Δ`. An 8-frame ease-out
  opens at 3/8 speed and misses the 0.3% gate; a 9-frame ease-out on a 1.7%
  bar moves 22.5 luma levels and misses the 25 gate. **Use a linear
  `clipPath` wipe.** Found in the wild three times, each time under a comment
  claiming the reveal was the beat's biggest delta.
- **Wipe geometry:** a left-to-right wipe on a linear time curve paints area
  as *width²*. Drive the clip with `sqrt(t)` so AREA advances linearly.
- **`scale=240:135` is swscale BICUBIC, not box pooling** — its support is
  WIDER than a box, so thin strokes fare *worse* than a box model predicts.
  ≥ ~24px in both dims reads near true luma; 8–16px is attenuated; < 8px
  vanishes. **6px stroke = 0.75 proxy px = invisible. 8px = exactly 1 proxy
  px = registers.** Every sub-8px rule on ep005 measured 0.0000%.
- **A patterned region pools to its DUTY-WEIGHTED MEAN**, not to the ink's
  luma. A grid of thin bright lines on black pools dark.
- **THE RETIRE-CLIFF.** A step multiplying a whole layer by `(1 - t)` drives
  every `theme.ink` element under luma 110 as opacity crosses ~0.46 — a
  silent empty run manufactured by a *retire*. Never fade a whole layer out
  unless something else is already lit.
- **Authoring rule for every reveal: `areaPct × 6 / durationFrames ≥ 2.0`.**
  Buy area by making things LARGER and DARKER-AND-CHROMATIC, never by making
  a thin thing brighter.
- **A TYPEWRITER IS NOT A CONTENT EVENT AT ANY THRESHOLD.** Measured on
  ep005 r11: a 150-frame character reveal of a 20-char string cleared the
  1-frame gate on **0 of 151 frames** (max 0.2963% vs a 0.3% gate). Mono
  glyph ink is ~12–15% of its own box, so sizing a text reveal by its box
  overstates it ~7×. That single error is what made a six-line typewriter
  look like a legitimate event ladder.
- **Containers must not be scheduled ahead of their content.** The fix for an
  empty panel is structural, not a timing nudge: put the plate INSIDE the
  wrapper its own clip reveals, so no panel can render empty under any drift.
  An empty bordered box is invisible to every automated gate — b-roll motion
  behind the scrim satisfies the difference test while the foreground is a
  loading skeleton. This is the exact "grader PASSed it, the human eye says
  slop" failure.
- **Check reveals against the narration's SILENCES, not just its marks.**
  `timing.json` carries anchor marks only. Run `silencedetect` on
  `narration.master.wav` — ep005 had three reveals firing *inside* measured
  silences, one of them 19 frames after its own sentence had ended.

### Screenshots / screen captures (specific, hard-won)

- **Zoom OUT — readable and recognizable.** You must be able to tell *what it
  is* (which site, which page). Show the whole page/headline so the source is
  obvious. ep003's Moltbook shot was cropped so tight you couldn't tell what
  it was — that's the failure.
- **NEVER zoom into a tight crop of random article text.** A push-in on
  illegible body copy communicates nothing.
- **Gentle scroll is OK. No push-in / no Ken-Burns zoom on captures.**
  Establish wide and let it read; scroll to reveal, don't punch in.

### Other visual non-negotiables

- **NO circle / ring annotations. Ever.** Cut them everywhere (this reverses
  the old `annotate.circle` habit — don't ring things).
- **Text must be aligned and in-bounds.** Nothing spills its container or the
  ~6% safe margin. Watch `whiteSpace: nowrap` overflow especially. Check every
  spawn position; misaligned text is an instant slop tell.
- **Literal visuals over confusing metaphors.** A `FakeTerminal` of dense
  unreadable code beats an Egypt-hieroglyph "dead language" image for "code you
  can't read" — the metaphor read as random. Show the literal thing.

---

## B-ROLL — real video, as texture not star

- **Real Pexels VIDEO behind a dark scrim.** It's texture that keeps the screen
  alive on talky beats — the foreground text stays the star and stays readable.
- **License-clean + credited** in the per-episode `credits.md` before render.
- **Per-archetype screen-time budgets** — don't wallpaper the whole video in
  stock loops (that's its own slop failure). See
  `docs/research/visual-composition-spec.md` (industry-analysis ~35% b-roll,
  dev/code ~10%, etc.).
- **CRITICAL: downscale b-roll to 720p before render.** It's invisible behind
  the scrim anyway, and heavy 1080p video decode crashes render tabs
  (target-closed). This is a hard requirement on this machine, not an optimization.

---

## SOUND — one continuous bed + subtle synthetic SFX

- **One CONTINUOUS ambient bed spanning the whole video.** A short looped bed
  leaves silent seams = dropouts (ep003's first bed was 20s looped → 5
  silent-seam dropouts). Generate/lay one bed the full runtime, no loops.
- **Subtle synthetic, Content-ID-safe SFX:** ticks/pops on entrances, a whoosh
  on camera moves, a thud on big reveals. Synthetic or CC0/YouTube-Audio-Library
  only — never anything Content-ID-claimable.
- **Master ~−14 to −16 LUFS integrated, true peak ≤ −1 dBTP.** Measure *after*
  processing (single-pass loudnorm undershoots — ep003 came out −17.3 and had
  to be re-normalized).

---

## RENDERING — this machine is memory-constrained (~1.9 GB free of 16 GB)

At 1080p with concurrency > 1, Chrome renderers get **OS-OOM Killed:9 at random
frames** (memory accumulates in the long-running browser). The reliable pattern:

- **CHUNKED render.** `--frames=A-B` chunks of ~1200–1800 frames, concurrency
  1–2, a **fresh process per chunk** (this resets accumulated memory), retry
  each chunk up to 3×, then stitch with `ffmpeg -f concat -c copy`.
- **Kill zombies before every relaunch.** `pkill -9 -f chrome-headless-shell;
  pkill -9 -f remotion` and **verify 0 procs** before relaunching — killed
  renders leave zombie `chrome-headless-shell` procs that starve new renders.
- **Never run two renders at once.** A stuck background render + a new one =
  mutual OOM.
- **Downscale heavy inputs.** Giant screenshot PNGs (>~6M px) crawl the render
  (they re-decode every frame — ep003's 49M-px shot projected a ~2-hour render);
  crop to ~1400×4200. B-roll to 720p (see above).
- **`--scale=0.5` for fast grading renders**, full-res only for the final cut.
  `--concurrency` does not help the giant-image case (layer-raster bound).
- **`--chrome-mode=chrome-for-testing`** is more stable than the default
  headless-shell.
- For a **1080p final**: free ~4–6 GB RAM first, *then* chunked.

Working grading command shape:
```
npx remotion render EpisodeNNN <out> --crf=20 --scale=0.5 --chrome-mode=chrome-for-testing
```

---

## GRADING — grade pacing hardest, PASS ≠ done

- **Run the video-grader after every render**, before any human review.
- **Grade PACING HARDEST** against the 2–3s-something-new / no-hold-over-3s
  rule — it kept coming out too generous on motion-craft. Require the
  static-hold table (every hold >3s named with its frame range).
- **A PASS is not "done."** It only earns the human first-pass watch — which is
  the real gate — and then the anonymity sweep. Fix the named defects, re-render,
  re-grade.

---

## One-line checklist for the next episode

- [ ] Contractions everywhere; conversational title; AI-tell scrub run; rhythm varied
- [ ] Something new every 2–3s; zero holds >3s on active beats; long beats = 4–10 staged reveals
- [ ] Entrances 6–9f; ≥4 entrance grammars; visuals land on/before their word
- [ ] Strong visual intro in first ~3s; screenshots zoomed-out & recognizable; gentle scroll not push-in
- [ ] No circles; text aligned/in-bounds; literal visuals not metaphors
- [ ] Real Pexels video behind dark scrim, downscaled to 720p, credited
- [ ] One continuous ambient bed + synthetic SFX; master −14 to −16 LUFS / ≤ −1 dBTP (measured after)
- [ ] Chunked render, zombies killed & 0 procs verified, one render at a time
- [ ] video-grader PASS (pacing graded hard) → human first-pass watch → anonymity sweep
