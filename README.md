# An autonomous long-form video pipeline

This repo turns a written script into a finished, graded, 10-minute animated
explainer video — narration, animation, sound design, render and QA — from one
hand-authored source file.

Everything downstream of that file is generated: the voice is a cloned voice
model, the animation is React code synced to word-level speech timestamps, the
sound design is synthesized in-repo, and the whole thing is graded by an
automated suite that measures the finished frames and refuses to pass a cut
that drags.

**One file is written by hand: `episodes/NNN-slug/script.yaml`.** Everything
else in a finished episode is derived from it.

---

## Why it's built this way

Long-form explainer video is normally a manual craft: you animate, you watch it
back, you decide it feels slow, you fix it, you watch it again. That loop is
slow and it is subjective — which makes it the wrong loop for one person to run
weekly.

So the interesting engineering problem here isn't rendering video. It's
**making "this feels like AI slop" into a number you can fail a build on.**

Episode 005 took two days and fifteen render rounds to reach a quality bar its
author was happy with. Almost all of that time went to a render-first loop:
animate against a feeling → render 40 minutes → watch → discover a new defect
class → fix → render again. Eleven times, a scene was changed, a comment was
written crediting the change, and the change measured **0.000%** — it did
literally nothing to the pixels.

The fix was to stop trusting eyes and start measuring. The result is a
**suite of eleven static gates that run in about two minutes with no render at
all**, plus a calibrated pacing model that measures the finished video. The
budget is now two renders: one grading cut, one master.

```bash
EPID=e006 ./scripts/gates.sh     # 11 gates, no pixels, ~2 min
```

The full method is in [`docs/research/ONE-SHOT-RECIPE.md`](docs/research/ONE-SHOT-RECIPE.md).

---

## The pipeline

```
script.yaml            ← the only hand-authored file
    │
    ├─ make_narration.py ──→ narration.txt        reading copy, word count, [VERIFY] flags
    │
    ├─ make_tts.py ────────→ narration.master.wav cloned voice (ElevenLabs v3)
    │                        .tts_cache/*.json    per-word timestamps ← animation ground truth
    │                        timing.json          per-beat start frames
    │
    ├─ src/eNNN/*.tsx ─────→ Remotion composition  React components pinned to those word frames
    │
    ├─ scripts/gates.sh ───→ 11 static gates       MUST be green before rendering
    │
    ├─ render_episode.sh ──→ parts_*/             chunked render (memory-constrained machine)
    ├─ stitch_episode.sh ──→ full_rN.mp4          video-only concat + single-pass audio
    │
    ├─ measure_pacing.sh ──→ pacing report        the calibrated slop detector
    ├─ anonymity_sweep.ts ─→ frame-level scan     no real names / paths / keys on screen
    └─ video-grader agent ─→ PASS / REVISE        graded against a written rubric
```

### The three things that were hard

**1. Word-level sync.** Visuals must land on or ~3 frames *before* their spoken
word; late is the single biggest amateur tell. The trap: `timing.json` only
carries per-beat start frames and a few anchor marks, so placing cues from a
words-per-minute *model* silently drifts. The real per-word alignment lives in
`.tts_cache/<hash>.json`. `scripts/check_wordsync.ts` resolves every cue to its
absolute frame and diffs it against the measured word — it found an entire
8-event sequence running ~2 seconds ahead of its narration.

Two subtleties that cost a round each: the TTS model's inline audio tags
(`[deadpan]`, `[pause]`) appear in the alignment data with timestamps but are
*performed*, not spoken — a cue pinned to one fires into silence. And the
animation helpers return exactly `0` at their own offset while the JSX gates on
`> 0`, so a reveal authored at frame N first paints at N+1.

**2. Measuring pacing objectively.** `scripts/pacing.py` decodes the render to a
240×135 grayscale proxy and scores three separate metrics — an absolute
"is the frame empty" gate, a difference-based "did anything actually change"
gate, and a stricter major-event gate. Getting this calibrated took several
attempts: a single naive area threshold swung the same cut from 16% dead to
87.6% dead.

What it taught, which is the genuinely non-obvious part:

- A large region painted in a dark UI grey contributes **0.000%** to the lit
  metric. Buy visual area by making things *larger and more saturated*, never
  by making a thin thing brighter.
- **A ramp is not an event.** An ease-out over N frames has a best single-frame
  delta of only `(3/N) × Δ`, which misses the gate. Use a linear wipe.
- **A typewriter is not an event at any threshold** — a 150-frame character
  reveal cleared the gate on 0 of 151 frames.
- Ambient drift and background video motion are not content events. A slowly
  drifting static frame is still a static frame.

**3. Not shipping a defect that no gate can see.** Several gates exist purely
because a defect was *silent*: a staged reveal whose offset exceeded its step's
length never rendered a single frame, threw nothing, and read as working code —
and was then "fixed" by enlarging reveals that had never been drawn. Gates that
fail loudly are cheap; the expensive bugs are the ones that pass review.

---

## Setup from scratch

### 1 · Prerequisites

```bash
git clone <this repo>
cd tech-channel
npm install

# macOS
brew install ffmpeg whisper-cpp
```

- **Node 18+** and **Python 3.9+**
- **ffmpeg** — audio mastering, chunk stitching, the pacing proxy decode
- **whisper-cpp** — transcribes the finished narration to verify the voice
  actually said what the script says

### 2 · API keys

```bash
cp .env.example .env
```

Then fill in the three values. `.env` is gitignored; **never commit it.**

| Variable | Where to get it | Free? |
|---|---|---|
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) → avatar (bottom-left) → **API Keys** → Create. Starts with `sk_`. | Free tier works; v3 needs a paid plan for volume |
| `ELEVENLABS_VOICE_ID` | Your **cloned** voice's ID — see below | — |
| `PEXELS_KEY` | [pexels.com/api/new](https://www.pexels.com/api/new/) — instant, no card | Yes |

Nothing else needs a key. Remotion, ffmpeg and whisper all run locally.

### 3 · Cloning your voice

The channel is faceless and publishes on a **cloned** voice rather than a live
recording, which is what makes the pipeline autonomous — a script change
regenerates the affected beats instead of requiring a new recording session.

1. Record **1–3 minutes** of clean speech. Quiet room, one mic, consistent
   distance, no music, no processing. More audio is not better; *consistent*
   audio is better.
2. [elevenlabs.io/app/voice-lab](https://elevenlabs.io/app/voice-lab) →
   **Add Voice** → **Instant Voice Clone** → upload → name it.
3. Open the voice → copy its **ID** (the copy icon next to the name). It's a
   ~20-character string. Put it in `.env` as `ELEVENLABS_VOICE_ID`.

   Or list them:
   ```bash
   curl -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/voices
   ```

4. Generate narration:
   ```bash
   python3 make_tts.py episodes/NNN-slug/script.yaml --v3
   ./scripts/master_narration.sh episodes/NNN-slug
   ```

**Two hard-won settings.** `stability` must be sent as a **float** (`0.5`), not
a string — the API accepts a string and silently ignores it. And the v3 model
caps its word-alignment response around 2k characters, so `make_tts.py` chunks
the script on beat boundaries and reassembles, which is why per-beat caching
exists: changing one sentence regenerates one beat, not ten minutes of audio.

**Performance is directed in the script**, not fixed in post. The script's cue
markup (`[dry]`, `[up]`, `[down]`, `[smile]`, `**punch**`, `/` and `//` for
pauses) compiles to v3 inline audio tags, so tone is authored text.
See [`docs/research/elevenlabs-narration.md`](docs/research/elevenlabs-narration.md).

### 4 · B-roll and stills

```bash
npm run acquire
```

Fetches Pexels footage using `PEXELS_KEY` into `public/ep-*/`, which is
gitignored — clips are **re-fetchable, not vendored**, and every one is
credited with its source URL in the episode's `credits.md`. A gate
(`check_credits.ts`) fails the build if an acquired asset isn't credited.

**Downscale b-roll to 720p before rendering.** It sits under a dark scrim where
the extra resolution is invisible, and 1080p decode crashes render tabs on a
memory-constrained machine.

### 5 · Sound

All sound is **synthesized in-repo with ffmpeg** — 13 cue sounds plus a
continuous ambient bed. Nothing is downloaded, so there is nothing Content ID
can claim, which matters for monetization. Every generating command is recorded
in [`docs/research/sfx-palette.md`](docs/research/sfx-palette.md), so the audio
regenerates from source.

Three traps worth knowing if you build your own:

- ffmpeg's `sine=` emits at amplitude **0.125**, not unity — mixing it against
  noise buries the tonal layer ~18 dB, and peak-normalizing afterwards *hides*
  the problem by fixing file level while leaving the internal balance wrong.
  Use `aevalsrc='sin(2*PI*F*t)'`.
- `anoisesrc` seeds from the clock, so a documented command without an explicit
  `seed=` produces a different file every run.
- Normalize every cue to the same peak (here **−12.0 dBFS**) and do all
  balancing with per-cue gain. Cues were once mixed 15 dB *under* the ambient
  bed and were functionally inaudible — only matched filtering could find them.

**The ambient bed must be one continuous render the full length of the video.**
A looped bed leaves audible silent seams at every join.

### 6 · Agent skills and MCP servers

The repo ships its own skills and subagents. They are checked in, so a clone
gets them — there's no install step.

```
.claude/skills/     script-voice, elevenlabs-narration, faceless-playbook,
                    motion-density, visual-direction, new-episode,
                    remotion-* (create, render, studio, captions,
                    multimedia, best-practices, docs)
.claude/agents/     script-grader.md, video-grader.md
.agents/skills/     the remotion-* set, for agent runtimes that read .agents/
```

**Two adversarial reviewer subagents** gate the work. `script-grader` audits a
script before recording (AI-tells, rhythm uniformity, hook strength, cue
validity) and returns PASS/REVISE. `video-grader` grades a finished render
against [`docs/animation-review-rubric.md`](docs/animation-review-rubric.md).
Both are read-only — they never edit or re-render, they just judge.

A grader PASS is deliberately **not** treated as "done." It only earns the
human watch. Both graders were repeatedly too generous.

**MCP servers** (optional, for thumbnail and asset design) are configured in
`.codex/config.toml` and authenticate over **OAuth — no keys in the repo**:

| Server | URL | Used for |
|---|---|---|
| Figma | `https://mcp.figma.com/mcp` | exploring thumbnail layout variants |
| Recraft | `https://mcp.recraft.ai/mcp` | vector/raster asset generation |

Note thumbnails **ship as Remotion stills**, rendered from the same design
tokens as the episode — that's what keeps them visually consistent with the
video. Figma is for exploring alternates; anything that wins there gets
re-implemented in code.

---

## Making an episode

```bash
# 1. Write episodes/NNN-slug/script.yaml, then:
python3 make_narration.py episodes/NNN-slug/script.yaml   # reading copy + word count
#    → script-grader agent must PASS

# 2. Voice. This is the last moment a re-voice is cheap —
#    every animation frame number derives from this audio.
python3 make_tts.py episodes/NNN-slug/script.yaml --v3
./scripts/master_narration.sh episodes/NNN-slug

# 3. Register the episode: one entry in src/episodes.ts + scripts/_episode_env.zsh

# 4. Animate in src/eNNN/ (npm run dev for live preview)

# 5. All static gates green BEFORE rendering
EPID=eNNN ./scripts/gates.sh

# 6. One half-scale grading render
ROUND=r1 EPID=eNNN SCALE=0.5 ./scripts/render_episode.sh
ROUND=r1 EPID=eNNN SCALE=0.5 ./scripts/stitch_episode.sh

# 7. Measure, sweep, grade
./scripts/measure_pacing.sh <stitched.mp4>
npm run sweep -- <stitched.mp4>
#    → video-grader agent

# 8. Fix, re-gate, render the 1080p master
# 9. Watch it full screen, twice.
```

### The gates

| Gate | Catches |
|---|---|
| `tsc` / `eslint` | types, lint |
| `check_contrast` | idle geometry too low-contrast to read as content |
| `check_subreveals` | reveals whose offset exceeds their step — never render, throw nothing |
| `check_typesize` | on-screen type below the readability floor |
| `check_dimmed_ink` | elements faded under the visibility threshold with nothing else lit |
| `check_wordsync` | any cue that drifts off its spoken word or into a silence |
| `check_bench` | numbers quoted on screen vs. the committed benchmark output |
| `check_credits` | any acquired asset not credited with its licence |
| schedule resolve | scenes running at a clock rate their storyboard wasn't authored for |
| `playhead` | beat plans that silently collapse staged reveals into one pop |
| sfx coverage | long stretches with no sound design (advisory) |

Post-render: `pacing.py` (the slop detector), `anonymity_sweep.ts` (frame-level
identity scan), `video-grader`.

---

## Repo layout

```
episodes/NNN-slug/script.yaml   the only hand-authored file
src/components/                 shared Remotion component library + design tokens
src/eNNN/                       one episode: beat plan, SFX plan, per-beat scenes
src/episodes.ts                 episode registry — one literal per episode
scripts/                        gates, render pipeline, pacing model
docs/research/                  the corpus: craft rules, and what failed and why
.claude/skills/, .claude/agents/  authoring skills + adversarial graders
make_tts.py, make_narration.py, make_timing.py
```

### Docs worth reading

- [`ONE-SHOT-RECIPE.md`](docs/research/ONE-SHOT-RECIPE.md) — order of operations + the author-time arithmetic
- [`PRODUCTION-LESSONS.md`](docs/research/PRODUCTION-LESSONS.md) — what failed, and why, across two episodes
- [`animation-review-rubric.md`](docs/animation-review-rubric.md) — what the video-grader enforces
- [`sfx-palette.md`](docs/research/sfx-palette.md) — all 13 cues, reproducible
- [`script-voice-ai-tells.md`](docs/research/script-voice-ai-tells.md) — the AI-tell catalog

---

## What's deliberately not in this repo

Rendered output and fetched media are excluded — the working tree is ~8.5 GB and
nearly all of it is derived. Excluded: rendered `.mp4`s, `.wav` narration and
sound assets, `.tts_cache/`, generated `timing.json` / `props.json`, fetched
b-roll and screenshots under `public/ep-*/`, and `.env`.

All of it regenerates from what *is* here: narration from `make_tts.py`, sound
from the ffmpeg commands in `sfx-palette.md`, b-roll from `npm run acquire`.

---

## License

Code is MIT. Episode scripts and narration are the channel's editorial content
and are not covered by it. Third-party assets keep their own licences, recorded
per episode in `credits.md`.
