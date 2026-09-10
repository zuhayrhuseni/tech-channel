# Emphasis choreography spec: script cues → visual reactions @30fps

**Purpose:** Make the visuals react to the *human voice* the way an experienced editor cuts — emphasis, pauses, and tone changes drive concrete motion, landing ON or just before the word. This is the craft that reads as "humanly curated," and it is a **direction problem, not an engine problem** — it is served by owned design tokens + frame-perfect sync + composed pauses, none of which Manim advances.

## The named methods (what we're actually doing)

- **Kinetic typography** — text animated in sync with speech; scale/position/color react to the word ([Wikipedia](https://en.wikipedia.org/wiki/Kinetic_typography), [Creative Bloq](https://www.creativebloq.com/typography/examples-kinetic-typography-11121304)). Our `KineticCaption` is exactly this.
- **Stomp / beat-synced editing** — cuts and hits land on transients; in narration the transient is the stressed syllable — our `**punch**`.
- **VO-synced motion-graphics editorial** (Vox / Kurzgesagt / Johnny Harris grammar) — a receipt/label/arrow lands on the noun being spoken, holds, then recedes; the screen never trails the voice ([Linearity](https://www.linearity.io/blog/kinetic-typography/)).
- **Sound-designed / composed rests** — pauses (`//`, `[beat]`) are composed silences that make the next reveal hit harder.

**The through-line (PLAYBOOK non-negotiable #2):** the visual lands **ON or ~3 frames BEFORE** its word, never after. Late is the #1 amateur tell.

## Timing model

`mark.frame` = the word's frame resolved by `make_timing.py` from `timing.json` (per-word `<mark>` → absolute frame, aligned to the **human** recording; `make_timing.py` fails closed and names any unmatched mark). @30fps, **1 frame = 33.3ms**. "Pre-roll N" = start the entrance N frames early so the *perceived* hit lands on the word.

---

## Rules catalog: cue → reaction → frame timing

| Script cue | Meaning | Visual reaction | Frame timing @30fps |
|---|---|---|---|
| `**punch**` | stressed word / "yell" | **Impact reveal**: keyword/receipt/label snaps in with scale overshoot `0.94 → 1.06 → 1.0`; +1 frame subtle ambient brighten | Entrance **starts `mark.frame − 3`**; overshoot peak `+2`; settle by `+9` (~300ms). Overshoot spring `damping:12, stiffness:200` |
| `[up]` | tone lifts / rising energy | Ambient **drift up + brighten**; keyword enters from `0.96` scale, letter-spacing tightens | Begin `−3`; 12–18 frame ramp; hold |
| `[down]` | tone drops / serious | Ambient **dims + settles**; active element **docks** (shrinks to corner label) rather than popping | Begin on `mark.frame`; 15–20 frame ease-in |
| `[dry]` | deadpan / flat | **Withhold motion** — text hard-*cuts* in on-frame, no spring (restraint is the joke) | Hard cut at `mark.frame`, 0 ease |
| `/` (0.35s) | short breath | Micro-hold: freeze primary motion ~10 frames, ambient micro-move stays alive | Freeze `mark.frame → +10` (~11 fr) |
| `//` (0.9s) | full stop / "let it land" | **Composed rest**: hold end-state; optional "…" fade-in over the gap; slow camera drift only; next reveal armed | Hold ~27 fr; "…" fades in over first 8, out over last 6 |
| `[beat]` | comedic/dramatic beat | Held frame + single micro-move (cursor blink / dot), **then** payoff reveal snaps after | Hold 18–24 fr; payoff entrance `−3` before gap-end |
| `[breath]` | inhale before new idea | Section-transition prep: current content recedes/docks, camera moves toward next region | 12–15 fr dock/pan, ends as next beat's first word begins |
| `[smile]` | warm aside | Slight ambient warm color-temp nudge; no hard graphic (keep it human) | 20 fr temp nudge, no reveal |
| `<mark id/>` | explicit visual anchor | Fires the scheduled asset (image/chart/terminal/scroll-rec/Manim clip) tied to that id | Asset `land_at = mark.frame − 3` |

### Compound patterns (how pros chain cues)

- **Withhold → punch (setup/payoff):** a `//` before a `**punch**` — the 0.9s composed rest makes the impact reveal hit ~2× harder. Never pop into a busy frame; clear it on the `//`, land the payoff on the punch.
- **Yell → receipt:** `**word**` on a claim → the screenshot/headline receipt IS the impact reveal (pre-roll −3, overshoot). The Johnny-Harris "proof lands on the assertion" move.
- **Manim-clip entrance = a single anchor:** a Manim leaf clip is placed like `<mark id/>` b-roll — its `land_at = mark.frame − 3` on ONE word; its interior is continuous, narrated as a whole, never per-word (see [visual-engine-decision](./visual-engine-decision.md), sync red-team). Per-word emphasis inside a clip is impossible without re-render — that's the signal to build native instead.

### Cadence limits

- **Impact-reveal budget:** overshoot punches are loud — cap ~1 per 8s, never 3 in a row (PLAYBOOK variety rule). Alternate `**punch**` moments with quiet `[down]`/diagram beats: *keyword → diagram breathes → keyword*.
- **Pauses are content, not gaps:** `/` and `//` must still carry ambient micro-motion (PLAYBOOK non-negotiable #1: never static). A truly frozen frame reads as a stutter/render bug, not a rest.

---

## Concrete component change to enable the `**punch**` rule

`KineticCaption` currently enters `0.94 → 1.0` monotonic (no overshoot) with 0 pre-roll. To make it emphasis-reactive with zero new dependency, add an `emphasis?: "punch" | "normal"` prop:

- `"normal"` → current behavior (`0.94 → 1.0`, `damping:200`, pre-roll 0).
- `"punch"` → offset `local` by **+3** (entrance begins 3 frames before `fromFrame`) AND drive scale with an **overshoot** spring (`0.94 → 1.06 → 1.0`, `config:{ damping:12, stiffness:200 }`) instead of `damping:200`.

The `**punch**` markup in `script.yaml` maps to `emphasis="punch"`; everything else stays `"normal"`. This turns the existing kinetic caption into the emphasis-reactive element without a new engine — which is the whole point: the "humanly curated" feel comes from this reaction layer, not from swapping the renderer. [VERIFY: confirm current `KineticCaption` spring config values against `src/components/KineticCaption.tsx` before implementing.]

---

## Sources

- Kinetic typography: [Wikipedia](https://en.wikipedia.org/wiki/Kinetic_typography) · [Creative Bloq examples](https://www.creativebloq.com/typography/examples-kinetic-typography-11121304) · [Linearity: how/why](https://www.linearity.io/blog/kinetic-typography/)
- Manim can't own per-word human-VO sync (bookmarks in narration string, audio-derived timing): [manim-voiceover docs](https://voiceover.manim.community/en/stable/index.html) · [quickstart](https://voiceover.manim.community/en/stable/quickstart.html)
- Animation timing / easing floor (entrances 200–400ms ease-out, exits ~200ms ease-in): PLAYBOOK non-negotiable #5, `docs/research/animation-craft.md`

Repo ground truth (absolute): `/Users/zuhayrhuseni/tech-channel/src/components/KineticCaption.tsx` (`fromFrame` → spring per word) · `/Users/zuhayrhuseni/tech-channel/make_timing.py` (mark→frame, fail-closed) · `/Users/zuhayrhuseni/tech-channel/episodes/002-two-job-markets/timing.json` (per-word marks) · `/Users/zuhayrhuseni/tech-channel/src/components/ScreenRecording.tsx` (mark-keyed `atFrame` idiom a clip slots into)
