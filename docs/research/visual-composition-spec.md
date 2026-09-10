# Visual composition spec: per-archetype screen-time budgets

**Purpose:** Tell the animator how to divide a video's screen-time across visual types, per content archetype, so the screen is never static and never 100% one template (the two failure modes that read as "AI slop"). Budgets are targets (±10%), not measured constants.

## The corrected baseline assumption

For a **faceless channel there is no A-roll** (no talking head). The industry "60% A-roll / 40% B-roll" rule ([OpusClip](https://www.opus.pro/research/broll-visual-effects-short-form), [vidIQ](https://vidiq.com/blog/post/create-b-roll-youtube-videos/)) does not apply — you inherit the B-roll burden across **100% of runtime**. Every second must carry information. The lazy solutions (100% stock loops, or 100% one component template) are exactly what reads as slop. That is why these budgets *mix* visual types deliberately.

**"Diagrams / data-viz / animation"** below = native Remotion `BarReveal`/`LineReveal`, built diagrams, kinetic diagram sequences, and (rarely) a Manim leaf clip. Per the [visual-engine-decision](./visual-engine-decision.md), Manim is only ever a fraction of *this* row, only in concept/stats episodes, and only for genuine continuous-math.

---

## Archetype budgets (share of total screen-time)

| Visual type | STATS / DATA-HEAVY | CONCEPT-EXPLAINER | INDUSTRY-ANALYSIS | DEV / CODE |
|---|---|---|---|---|
| **Diagrams / data-viz / animation** | **35%** | **55%** | 20% | 15% |
| **Screen-recordings / code** | 5% | 5% | 10% | **45%** |
| **Stock b-roll** (Pexels/Openverse/Wikimedia) | **30%** | 10% | **35%** | 10% |
| **Kinetic text / keyword cards** | 20% | 20% | 25% | 20% |
| **Full-frame emphasis** (held word/number/quote/receipt) | 10% | 10% | 10% | 10% |

**Reference channels per archetype:** stats-heavy ≈ Wendover/PolyMatter (charts are the payoff; stock b-roll is the connective tissue between them). Concept-explainer ≈ 3Blue1Brown-adjacent — the *only* archetype where a Manim-style engine earns >50% of the frame, and even here it is ~55%, not 95%, because an early-career audience needs more b-roll and keyword scaffolding than a math-grad one. Industry-analysis ≈ Wendover with the data share cut and headline "receipt" screenshots raised — **Manim is nearly useless here.** Dev/code ≈ Fireship — the market rebuilds this look in **Remotion, not Manim** (documented "Fireship-in-Remotion" pattern).

### Critical read-outs (the failure modes each budget prevents)

- **Stats-heavy is NOT 90% charts.** Data-viz is ~a third; static wall-to-wall charts is an exhausting, low-retention video. Stock b-roll (30%) keeps the screen alive *between* chart payoffs.
- **Concept-explainer tops out ~55% custom animation**, not 95% — the audience is early-career, not 3b1b's math-literate base.
- **Industry-analysis is the most b-roll-heavy (35%), least custom-animation (20%).** Headline screenshots as receipts live in the full-frame + screen-rec buckets.
- **Dev/code is 45% screen-recordings/code.** `FakeTerminal` + real code captures dominate; Manim contributes ~zero.

### What this implies for Manim adoption

Manim would author **>50% of the frame only in concept-explainer** — the *least* frequent format for an "early-career / breaking into big tech" audience (which skews industry-analysis + dev). In the other three archetypes Manim would author **at most 15–35% of screen-time, almost none of it continuous-math**. A second language, runtime, and render pipeline for that return is a poor trade — confirming Manim-as-leaf, not core.

---

## Decision tree: which visual type for THIS beat?

```
START: what is the beat's job?

1. Is the beat SHOWING A NUMBER / TREND / COMPARISON from data?
   → Bar/line/area/parts-of-whole?  → BarReveal / LineReveal (native)          [diagrams row]
   → A single striking number/stat? → Full-frame count-up emphasis             [full-frame row]

2. Is the beat SHOWING SOFTWARE / CODE / A CLI / A REAL WEBSITE?
   → Real terminal/CLI output?      → FakeTerminal (fake values only)          [screen-rec row]
   → Scrolling a real page / UI?    → Playwright scroll screen-recording        [screen-rec row]
   → A headline as a "receipt"?     → screenshot, held full-frame               [full-frame row]

3. Is the beat a KEYWORD / CLAIM / PUNCHLINE landing on a spoken word?
   → KineticCaption pop on the mark (see emphasis-choreography-spec)            [kinetic row]

4. Is the beat SHOWING A PLACE / THING / MOOD the narration is about?
   → Pexels/Openverse/Wikimedia still + Ken-Burns via AnnotatedImage           [b-roll row]
   → gated: anonymity + license + credits.md

5. Is the beat a DIAGRAM / PROCESS / RELATIONSHIP (nodes, arrows, stages)?
   → Build it as a native Remotion diagram (staged, object-constant)           [diagrams row]
   → Static equation reveal? → KaTeX→SVG, path/opacity animate in Remotion     [diagrams row]

6. Is the beat a GENUINE CONTINUOUS-MATH TRANSFORM?
   (integral filling, vector field, ReplacementTransform morph, geometric proof,
    gradient descending a surface — something SVG-path/KaTeX genuinely can't fake)
   → FIRST ask: can a native FunctionPlot/Riemann SVG-path component do it?
       YES → build native (stays word-syncable, on-palette)                    [diagrams row]
       NO  → Manim leaf clip (Cairo -t, fps 30, 1920x1080, single sync anchor,
              house.py reskin, gated through capture/) — MAX ~1 per episode    [diagrams row]

DEFAULT if none fit cleanly: keyword card on the spoken word, over ambient bg.
```

### Cross-cutting rules (apply on top of the budget)

- **Visual change every 3–5s** on hooks, ≤8s everywhere (PLAYBOOK). A Ken-Burns push, a caption appearing on a held shot, or a two-beat graphic build all reset the timer — so "change" is cheap; use it.
- **Rotate entrance grammar** — ≥4 distinct grammars per episode (spring pop, line draw-on, morph/transform, camera move, count-up, dock/undock, mask wipe); never the same pattern >3 elements in a row.
- **Transforms over add/remove** — if the new thing relates to what's on screen, the old thing *becomes* it (chart axes reflow into a timeline; a node expands into a diagram).
- **Alternate register** — loud keyword moment → quiet full-frame diagram breathes → keyword. Never two loud scenes back-to-back.
- **Cards are containers, not the show.** Diagrams, code, and data live full-bleed on the background; panels/chips are for annotations only. If two consecutive scenes are both "cards on background," redesign one.
- **Nothing decorative** — every element narrated within ~1s of appearing; anything nobody talks about is an ad.
- **[VERIFY]** the per-archetype percentages are inferred from creator-pipeline descriptions + editing conventions + structural observation, not published frame counts. Treat as ±10% targets and tune against retention graphs.

---

## Sources

- 3Blue1Brown pipeline (Manim = clip factory feeding an editor; "use traditional video-editing software for as much as you can"): [How I animate 3Blue1Brown](https://3blue1brown.substack.com/p/how-i-animate-3blue1brown) · [3b1b About](https://www.3blue1brown.com/about/) · [manim demo](https://www.3blue1brown.com/lessons/manim-demo/)
- Wendover / PolyMatter stats-doc visual language (stock footage + animated maps/charts, no clutter): [Wendover Productions](https://www.wendoverproductions.com/) · [ReelMind Wendover style analysis](https://reelmind.ai/blog/wendover-productions-video-style-analyzing-fact-based-youtube-success)
- Fireship dev-explainer style + Remotion rebuild pattern: [Wisp CMS](https://www.wisp.blog/blog/how-to-create-video-content-like-fireship-hyperplexed-and-juxtoposed) · [De Programmatica Ipsum](https://deprogrammaticaipsum.com/fireship/) · [BrightCoding Remotion-Fireship](http://blog.brightcoding.dev/2026/02/21/remotion-fireship-create-viral-videos-with-react-code)
- A-roll/B-roll 60/40 baseline; b-roll retention data (65% / 42% recall): [OpusClip](https://www.opus.pro/research/broll-visual-effects-short-form) · [vidIQ](https://vidiq.com/blog/post/create-b-roll-youtube-videos/)
- Visual-change 3–5s retention floor: [Framesail](https://framesail.com/blog/high-retention-faceless-youtube-videos) · [Fluxnote](https://fluxnote.io/guides/faceless-channel-retention-strategies-2026)

Repo components referenced (absolute): `/Users/zuhayrhuseni/tech-channel/src/components/charts/BarReveal.tsx` · `/Users/zuhayrhuseni/tech-channel/src/components/charts/LineReveal.tsx` · `/Users/zuhayrhuseni/tech-channel/src/components/KineticCaption.tsx` · `/Users/zuhayrhuseni/tech-channel/src/components/ScreenRecording.tsx` · `/Users/zuhayrhuseni/tech-channel/src/components/AnnotatedImage.tsx` · `/Users/zuhayrhuseni/tech-channel/src/components/FakeTerminal.tsx`
