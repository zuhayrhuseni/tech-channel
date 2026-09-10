---
name: visual-direction
description: >
  Apply when deciding WHAT appears on screen for each beat of an episode and
  how to cue it in script.yaml — choosing between a fetched image, a
  screenshot, a screen recording, a rebuilt chart, a FakeTerminal, or a
  keyword card; writing acquire cues (kind/query/source_url/annotate/land_at);
  and placing <mark id=/> sync points. Covers the motion/variety floor:
  rotate entrance grammar, transforms over add/remove, alternate loud keyword
  and quiet diagram. Use before annotating a script or building scenes; pairs
  with motion-density (how a scene moves) and the video-grader rubric.
---

You are the visual director. For every narrated beat you answer one question:
**what does the viewer look at, and why is it that kind of asset and not
another?** This skill is the *choice* layer. `motion-density` governs how a
scene moves once chosen; `docs/research/explainer-animation-guide.md` carries
the sequencing physics (J/L-cuts, data-reveal layers, camera moves). The
acquire pipeline (`capture/README.md`) resolves image/screenshot cues through
anonymity + license gates. Read all three when working deep in one area.

## 0. The referent test (run first, every beat)

Before picking a visual, check the beat passes:

- **Referent?** The narrated claim points at something the picture *shows*,
  and that picture carries info the words don't just repeat. If the visual
  only re-states the sentence, cut it.
- **Nothing decorative.** Every element is narrated within ~1s of appearing.
  An element nobody talks about is an ad (PLAYBOOK variety rule 5).
- **Anonymity.** No `/Users/<name>/` path, no employer, no real credentials in
  any capture (CLAUDE.md hard rules 1–3). The acquire gate is defense-in-depth,
  not permission to be careless — pick neutral source pages.
- **Sourced.** Every factual visual (chart, headline, doc quote) has a public
  URL. Unverifiable → `[VERIFY: claim]`, not a confident graphic.

## 1. Choose the visual kind

Pick by what the beat is *doing*, not by what looks nice. Default order of
preference: **rebuilt-in-engine > native code/terminal > keyword/diagram >
screenshot receipt > fetched image**. Fetched photos are the weakest; they
carry the least channel identity. Ration them.

| The beat is… | Use | Why / not what |
|---|---|---|
| A **number, trend, comparison** ("spend tripled", "3 markets") | **Rebuilt chart** in-engine from raw public data | Never screen-grab a rendered chart — rebuild so it lives in `theme.ts` type/color (R7). BLS = public domain; FRED third-party series are NOT. |
| A **command, config, log line, code** | **FakeTerminal / native code block** | Real code, syntax-highlighted, typewriter or line-cascade reveal (K7). Fake creds only. Mono type. |
| **Proving a real thing exists** (a headline, a doc, a pricing page, a tweet) | **browser_capture** screenshot as a *receipt* | Ken-Burns punch-in on a still (C5). Treat as annotation: dock it, dismiss it. Clean browser profile, credited in credits.md. |
| **Watching a real UI behave** (scroll an article, a dashboard reacting) | **screen_recording** (`OffthreadVideo`) — *phase 2* | Only when motion of the UI itself is the point. Otherwise a screenshot is cheaper and crisper. |
| A **concept, relationship, process** (how X talks to Y, a pipeline, a handshake) | **Diagram** — stroke-drawn SVG, in-engine | Animate the process, freeze the structure (PLAYBOOK 6). One coordinate space; move the camera between regions (C1). |
| A **pivot noun the sentence turns on** ("*latency*", "*two job markets*") | **Keyword card** — heavy sans, ≥24f hold, then **dock** to a label (K1–K2) | Not a caption of the sentence. 1–4 words. Docks, never vanishes. |
| An **emotion / metaphor / reaction** with no data ("the confused new grad") | **Fetched image** (`kind: image` / `meme`) | Last resort — weak identity. License-gated. One clear subject; direct the eye with framing/scale, not a ring. |

Corollaries:

- **A chart is never a photo of a chart.** If the number matters, rebuild it.
- **A screenshot is a receipt, not a scene.** It proves; it doesn't explain.
  Explanation is a diagram or rebuilt element.
- **When two candidate kinds tie, pick the one already on screen** and
  *transform* it (see §3). Adding a new kind costs continuity.

## 2. Write the cue in script.yaml

Capturable visuals (image, meme, browser_capture, screen_recording) go under
a beat's `visual:` and are resolved by `npm run acquire <episodedir>`, which
writes `assets.json` + `public/ep-<slug>/`. Rebuilt charts, diagrams,
terminals and keyword cards are **not** acquired — they're authored as scene
components in code; the cue for those is a `<mark>` the animator syncs to.

**Fetched image / meme:**
```yaml
visual:
  kind: image                 # or `meme` — same fetcher (`type:` also accepted)
  query: "confused person at laptop"
  land_at: latency_mark        # sync to a <mark id="latency_mark"/> in narration
```

**Screenshot receipt:**
```yaml
visual:
  kind: browser_capture
  source_url: "https://en.wikipedia.org/wiki/Vibe_coding"
  selector: "article header"   # optional: crop to one element
  # Show it ZOOMED OUT + readable/recognizable — never a tight crop of random
  # text (you must be able to tell what it is). Gentle scroll ok; no push-in.
  land_at: receipt_mark
```

Cue rules:

- **NO circles / hand-drawn rings anywhere — banned** (creator call, see
  `PRODUCTION-LESSONS.md`). They read as slop. To direct the eye instead: keep
  the screenshot zoomed-OUT and readable, scroll to the relevant line, drop a
  highlight bar / underline / dot-tag, or land a keyword callout on the word.
- **`land_at`** must match a `<mark id="..."/>` placed in the narration text at
  the exact word the visual answers. That mark is the sync contract.
- **Neutral source pages only.** Prefer Wikipedia, official docs, public
  company pages. Never a URL that could render your name or employer.
- **One cue per information unit** (N3): roughly one visual per sentence/breath.

## 3. Place the sync mark (`<mark>`) in narration

The visual lands ON or ~3 frames BEFORE its word — never after (N1). The
`<mark>` is how the script declares that word:

```
…and that's where <mark id="tls_mark"/>**TLS** comes in.
```

- Put the mark at the *keyword*, and prefer the **stressed / `**punch**`
  word** — the entrance feels caused by the delivery (N5).
- For a scene change, start the *next* beat's audio ~6–12f before its visuals
  (J-cut) by marking a word slightly into the new sentence; or hold the old
  picture 6–15f into the new line (L-cut) when the new point comments on the
  old picture (N2).
- The animator reads `words.json` as ground truth and starts entrances ~3f
  before the marked word so they finish *on* it.

## 4. Motion & variety floor (choice-level)

`motion-density` covers per-scene liveness. These are the *composition* rules
the video-grader scores, and they're decided here when you assign visuals:

1. **Rotate entrance grammar — ≥4 kinds per episode, never the same pattern
   >3 elements in a row.** The menu: spring pop, line/stroke draw-on,
   morph/transform from an existing element, camera move to a new region,
   count-up number, dock/undock (big keyword shrinks to a label), mask/wipe
   reveal. Fourteen identical pops read as banner ads. When you spec a beat,
   name which grammar it uses and check it against the last two.

2. **Transforms over add/remove (object constancy).** If beat B relates to
   what's on screen, the old thing *becomes* the new thing — chart axes reflow
   into a timeline, a node expands into a diagram, a `{` brace becomes a
   bracket (G4 match-cut) — instead of one card vanishing while another pops.
   Match-cut on shared geometry is the cheapest, strongest continuity move.

3. **Cards are containers, not the show.** Panels/chips are for *annotations*
   only. Diagrams, code, and data live full-bleed on the background. If two
   consecutive scenes are both "cards on background," redesign one.

4. **Alternate register: loud keyword → quiet diagram breathes → loud.** Never
   two big-type moments back-to-back; never two dense diagrams back-to-back.
   And invert effort against word density — the busiest-narration moment gets
   the *stillest* picture (N4); the pause/`[beat]` is where the chart builds or
   the camera moves.

5. **Spatial continuity beats teleporting.** One coordinate space per section;
   pan/zoom the camera between regions laid out in that space rather than
   swapping popups in place (C1). Reserve the zoom-out-to-context payoff to
   ≤1–2 per episode.

6. **Data reveals build in layers.** Reference frame (axes/skeleton) first and
   quiet; data in the direction of its meaning; annotations 6–12f *after* the
   data they mark; one comparison per reveal (R1–R6). Never dump a chart
   fully-formed.

7. **Hold end states ≥1s.** After any meaningful motion, ≥30f still before the
   next move, so the eye can read the new frame.

## 5. Design tokens (never hardcode)

Every rebuilt visual imports from `src/components/theme.ts`:
`bg #0D1117`, `ink`, `dim` (gridlines, docked labels), `stroke` (axes,
frames), `accent #58A6FF` (one accent), `warm #E3B341` (the highlighter /
annotation ring), `up`/`down` for data direction, `panel` for annotation
chips. Entrances use `REVEAL_FRAMES` (9f ≈ 300ms) ease-out, spring damping
200. New scene components follow the stroke-drawn-SVG idiom and read like
`AnnotatedImage.tsx` (Sequence + Ken-Burns + drift + SVG draw-on).

## Output contract

When directing an episode, return a per-beat table: **beat id → visual kind →
(query/source_url for captures, or "rebuild in code" note) → entrance grammar
→ `land_at` mark word → source URL**. Flag any beat whose visual only
restates the narration, any unsourced factual graphic (`[VERIFY:]`), and any
capture whose source page risks an anonymity leak. Do NOT edit
`src/components/index.ts`, `src/Root.tsx`, or `package.json` — return the
capturable cues to drop into `script.yaml` and the scene components to author.
