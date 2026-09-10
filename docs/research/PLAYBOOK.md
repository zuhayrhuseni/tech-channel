# Production playbook

Distilled operating rules from the deep-research corpus in this folder.
This file is always in context; consult the full docs when working in that
area — they carry the evidence, numbers, and source URLs:

- `youtube-psychology.md` — retention, hooks, packaging, algorithm
- `animation-craft.md` — timing tables, easing, choreography, kinetic type
- `remotion-mastery.md` — Remotion patterns, packages, pitfalls, render specs
- `asset-sourcing.md` — licensing rules per source, music, screenshots, AI
- `channel-identity.md` — faceless-channel identity system, mascot verdict
- `script-voice-ai-tells.md` — the AI-tell catalog + rhythm rules for narration
- `script-performance.md` — voice, humor mechanics, VO cue markup, read-aloud QA
- `voice-clone-vs-recording.md` — **verdict REVERSED (2026-09-02): ship the
  clone by design.** The old HYBRID verdict (draft-only clone; publish the
  human recording) is stale. The channel now PUBLISHES on the ElevenLabs
  **v3** clone (`make_tts.py --v3`) — v3's inline audio tags perform the tone
  cues, the creator confirmed it sounds good, and the clone is the channel
  voice. (The SynthID/C2PA marker concern is accepted as the cost of the
  faceless clone workflow.) The v3 pipeline still emits the same word-level
  `timing.json`, so animation sync is unchanged.
- `animation-review-rubric.md` (../) — the grading rubric the video-grader enforces
- `PRODUCTION-LESSONS.md` — **battle-tested refinements proven making ep003**
  (script / pacing / b-roll / sound / render / grade). Goes beyond this corpus
  and wins on conflict — proven against a real cut, not derived. Read it before
  making any episode.
- `ONE-SHOT-RECIPE.md` — **the order of operations + the author-time
  arithmetic**, so the next episode hits ep005's bar in two renders instead of
  fifteen. PRODUCTION-LESSONS says what failed; this says what to do first.
  Entry point: `EPID=eNNN ./scripts/gates.sh` before any render.
- `sfx-palette.md` — the 13 synthetic, Content-ID-safe cue sounds, each with its
  motivated on-screen job and the ffmpeg command that reproduces it.

Script gates: narration is written/rewritten with the `script-voice` skill
and must PASS the `script-grader` agent before recording — same relationship
as render → `video-grader`. The 10-cue markup vocabulary lives in the skill;
make_narration.py keeps cues in the teleprompter, make_timing.py strips them
from alignment.

## Non-negotiables (every video)

1. **The screen is never empty or static.** Ambient background layer + slow
   camera drift always on; new visual information every ≤8s; something
   micro-moves in every frame (cursor, dots, drift).
2. **Visuals land on or slightly before their word, never after.** Word-level
   timestamps from timing.json are ground truth; entrances start ~3 frames
   before the mark.
3. **Delete all throat-clearing.** Target ≥60% retention at 0:30. Hook =
   stakes → target → transformation; never answer the core question in the
   hook; first visual within the first seconds.
4. **Keywords, not transcription.** On-screen text is 1–4-word noun phrases
   on their spoken word, held ≥24 frames, then shrunk into a label — not
   vanished. Mono type for annotations, heavy sans for spoken keywords.
5. **Motion craft floor:** entrances 200–400ms ease-out (spring damping 200),
   exits ~200ms ease-in, staggers 2–4 frames, scale from ~0.94 never 0,
   no linear easing on position/scale, ≤1 primary moving focus at a time.
6. **Animate processes, freeze structures.** Diagrams: stage complex changes,
   preserve object constancy, hold end states ≥1s before moving on.
7. **Audio:** master −14 to −16 LUFS integrated, true peak ≤ −1 dBTP —
   *measure after processing*, single-pass loudnorm undershoots. YouTube
   render: h264 crf 16–18, AAC 320k, 1080p30.
8. **Assets:** rebuild charts from raw public data (BLS = public domain;
   FRED third-party series are not); icon sets over one-off images; YouTube
   Audio Library only for Content-ID-safe music; screenshots of software UI
   are fine, embedded third-party audio is not; keep a per-episode
   `credits.md` before render.
9. **Identity is the system, not a mascot:** consistent voice, palette,
   type, easing, diagram language — enforced in code via `src/components/`
   design tokens. No mascot until cadence and quality are established.
10. **Packaging first.** Title + thumbnail direction exist before production;
    thumbnails render as Remotion stills from the same design tokens; never
    repeat the title in the thumbnail.
11. **Endings:** never announce the ending; overlap end content with real
    content; pin a comment asking what to cover next.
12. **Anonymity gate before anything ships** (CLAUDE.md hard rules) and the
    `video-grader` agent must PASS every render.

## Variety rules — don't look like pop-up ads

The failure mode: every element is a rounded card that springs in on its
word. Fourteen pops in a 50s trailer is tolerable; 200 pops in a 10-minute
episode reads as banner ads. Enforced by the grader's motion-craft score.

1. **Rotate the entrance grammar.** At least 4 of these per episode, never
   the same pattern more than 3 elements in a row: spring pop, line
   draw-on, morph/transform from an existing element, camera move to a new
   area, count-up number, dock/undock (big keyword shrinks into a label),
   mask wipe reveal.
2. **Transforms over add/remove** (Sanderson; object constancy). If the new
   thing relates to what's on screen, the old thing should *become* it —
   chart axes reflow into a timeline, a node expands into a diagram — not
   vanish while a new card pops.
3. **Cards are containers, not the show.** Panels/chips for annotations
   only. Diagrams, code, and data live full-bleed on the background. If
   two consecutive scenes are both "cards on background," redesign one.
4. **Spatial continuity beats teleporting.** Move the camera to content
   laid out in space (pan/zoom between regions) instead of swapping
   popups in place. One coordinate space per section where possible.
5. **Nothing decorative.** Every element must be narrated within ~1s of
   appearing — an element nobody talks about is an ad. No starbursts, no
   shakes, no attention-begging idle animations, nothing sliding in from
   a screen corner.
6. **Alternate register.** Big-type keyword moments and quiet full-frame
   diagram moments should alternate; two loud scenes back-to-back flatten
   both. Roughly: keyword → diagram breathes → keyword.
7. **Real content, not chrome.** In episodes (unlike the trailer's
   deliberate skeletons): real code rendered natively with syntax
   highlighting, real charts rebuilt from raw data, real headline
   screenshots only as receipts (clean browser profile, credited in
   credits.md).
