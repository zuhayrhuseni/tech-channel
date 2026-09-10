# Animation craft for educational video — consultable rules

Research digest for an agent writing animation code (Remotion, 1920x1080 @ 30fps). Every rule is numbered; cite the rule ID when reviewing animation code. Source labels: **[spec]** = published design-system/platform specification, **[academic]** = peer-reviewed research, **[practitioner]** = working motion designers' published guidance, **[folklore]** = widely repeated community wisdom without a single authoritative source. Full source URLs in §9.

---

## 1. Timing and spacing

**T1. Timing is the duration; spacing is the easing.** The 12-principles distinction: how many frames an action takes (timing) vs. where the value sits on each frame (spacing/interpolation). Fix timing first, then easing — a good curve cannot rescue a wrong duration. [practitioner — Animation Mentor, School of Motion]

**T2. Baseline durations at 30fps.** Derived from Material (mobile 300ms baseline, desktop 150–200ms, ≤400ms cap) [spec], IBM Carbon duration tokens (70/110/150/240/400/700ms) [spec], and the 70–700ms professional envelope [folklore]:

| Move type | ms | frames @30 |
|---|---|---|
| Micro state change (color, small icon, toggle) | 70–100 | 2–3 |
| Opacity fade of a small element | 100–150 | 3–5 |
| Small move / small expansion (label slide, badge pop) | 150–200 | 5–6 |
| Standard element entrance (card, callout, list row) | 200–300 | 6–9 |
| Standard element exit | 150–250 | 5–8 (exits ~20–30% shorter than entrances) |
| Large panel / full diagram entrance | 300–400 | 9–12 |
| Full-scene transition, camera-style move | 400–600 | 12–18 |
| Background dim / ambient change | 500–700 | 15–21 |
| Diagram morph (identity-preserving transform) | 500–1000 | 15–30 |
| Line draw / write-on of a path or word | 500–1000 | 15–30 |

Material's enter/exit asymmetry is explicit: enter 225ms, exit 195ms on mobile — leaving elements don't need to decelerate on screen [spec]. Never exceed ~400ms for UI-scale moves [spec — Material]; educational diagram moves may go longer because they carry meaning (§6).

**T3. Scale duration with distance and size.** "The larger the change in distance traveled or size of the element, the longer the animation takes" [spec — IBM Carbon]. A 100px nudge at 8 frames and a full-screen traverse at 8 frames cannot both look right; the traverse needs 12–18.

**T4. Easing selection table.**

| Situation | Curve | Value |
|---|---|---|
| Element entering (on-screen destination) | ease-out / decelerate | Material decelerate `cubic-bezier(0.0, 0.0, 0.2, 1)`; Carbon productive entrance `(0, 0, 0.38, 0.9)` [spec] |
| Element exiting | ease-in / accelerate | Material accelerate `(0.4, 0.0, 1, 1)`; Carbon productive exit `(0.2, 0, 1, 0.9)` [spec] |
| On-screen A→B (visible whole time) | ease-in-out / standard | Material standard `(0.4, 0.0, 0.2, 1)`; M3 emphasized `(0.2, 0.0, 0, 1.0)`; Carbon standard `(0.2, 0, 0.38, 0.9)` [spec] |
| Hero/expressive moment | stronger S-curve | Carbon expressive standard `(0.4, 0.14, 0.3, 1)` [spec] |
| Diagram morphs, value interpolation | smoothstep sigmoid | Manim's default `smooth` rate function — zero velocity AND zero acceleration at both ends, reads as deliberate, weightless-but-controlled [spec — Manim docs] |
| Constant processes only (scroll ticker, loading sweep, orbit, elapsed-time bars) | linear | the ONLY legitimate linear uses [practitioner — animations.dev] |

**T5. Never use ease-in for entrances.** It reads as sluggish — the element dawdles then slams into place [practitioner — animations.dev "avoid ease-in as it makes the UI feel slow"]. Ease-in exists for exits and anticipation wind-ups only.

**T6. Ease-out feels faster than ease-in-out at identical duration** — use it when you want snap without shortening [practitioner — LottieFiles]. Default entrance recipe: ease-out, ~70–80% of the visual change completed in the first half of the duration.

**T7. No bounce/elastic/stretch in informative content.** IBM: "do not use easing curves that suggest bounce, stretch, or sudden stops" [spec]. Springy overshoot is a personality accent, not a default; for a tech-explainer register, cap overshoot per C5 or omit it.

**T8. Springs, if used: start at zero bounce.** Apple's guidance is to tune from 100% damping (no overshoot) and add bounce only when the motion should feel playful; springs' value is velocity continuity and interruptibility, not wobble [spec — WWDC23 "Animate with springs", WWDC18 "Designing Fluid Interfaces"].

---

## 2. Choreography — staggering, overlap, follow-through

**C1. Nothing arrives in unison; nothing arrives at random.** Stagger siblings (list items, graph nodes, bullet lines) by 50–100ms = **2–3 frames at 30fps** [practitioner — LottieFiles; UX in Motion "offset & delay"]. Uniform simultaneous arrival is amateur tell A2; a stagger over ~5 frames per item starts to feel like a slideshow.

**C2. Cap total stagger under ~500ms (15 frames).** For n items, per-item offset ≈ min(3 frames, 15/n frames). Ten list items at 3-frame offsets = 27 frames of arrival — too long; compress to 1–2 frames each [practitioner — LottieFiles "<500ms total"]. Manim expresses this as `lag_ratio` (delay proportional to the run, total runtime held constant) — the same idea, normalized [spec].

**C3. Overlap actions; don't sequence them end-to-end.** Pose-to-pose block-outs where action B starts only when A fully settles read as robotic. Let B begin during A's deceleration (start B when A is ~70–80% complete). Distinct *conceptual* beats, however, get a real pause: 100–200ms (3–6 frames) of nothing between beats [practitioner — LottieFiles].

**C4. Follow-through: children trail parents by 50–150ms (2–4 frames).** When a container moves, its label/icon/shadow starts and stops a few frames late [practitioner — LottieFiles; School of Motion]. This single offset is the cheapest "professional" signal in the whole discipline.

**C5. Overshoot 3–10%, settle in 50–100ms (2–3 frames).** Travel to 103–110% of the destination value, then ease back. >25% overshoot reads as broken even in playful work [practitioner — LottieFiles, Mt. Mograph]. Not everything overshoots — reserve it for the primary element of the beat; secondary elements just ease in. Dan Ebberts' expression-driven bounce/overshoot math is the canonical AE reference and ports directly to code [practitioner — motionscript.com].

**C6. Secondary action supports, never competes.** A connecting line brightening while its node lands; a shadow deepening while a card lifts. Secondary action is smaller in amplitude (≤ ~20% of the primary's) and must be deletable without breaking the beat [practitioner — School of Motion; 12 principles].

**C7. Concurrency budget: one primary motion per moment.** At most 1 hero action + its followers on screen at once; if a second idea must move, it waits for the beat gap (C3). Community heuristics: no more than ~1/3 of the frame in motion, "one per moment" for hero animation [practitioner — LottieFiles]. Gestalt common-fate applies: things that move together are read as one group — so move things together *only* when they are one group [academic — via Dev3lop/Wertheimer].

**C8. Arcs for long moves.** Anything traveling more than ~1/4 screen on both axes should follow a slight arc (bow the path ~10–20px at midpoint), not a straight diagonal [practitioner — LottieFiles; 12 principles]. Short nudges stay straight.

---

## 3. Visual hierarchy in motion — leading the eye

**H1. Motion is the strongest attention magnet on screen.** The moving thing IS the hierarchy; if the wrong thing moves, the viewer studies the wrong thing. Staging (12 principles) in motion graphics = choreograph entrances so the eye lands where the narration points, one idea at a time [practitioner — IxDF, Toptal].

**H2. Anticipation = a small counter-move before the main move.** Wind-up 100–200ms (3–6 frames), amplitude ~10% of the main action [practitioner — LottieFiles]. In explainer work the better anticipation is often attentional, not physical: dim/desaturate the rest of the frame 6–10 frames before the key element animates, or pre-highlight the region about to change so the eye is already parked there when the change happens. Change blindness is real: viewers miss changes they weren't looking at — cue first, then change [academic — implied by Tversky's apprehension principle].

**H3. Emphasis techniques, in escalating strength:** (1) hold everything else still; (2) dim/blur non-focus elements (UX-in-Motion "obscuration"); (3) scale the focus element up 5–10%; (4) draw a stroke/underline around it; (5) camera-style push-in ("dolly") toward it [practitioner — UX in Motion Manifesto]. Use the weakest technique that works; stacking all five is amateur tell A8.

**H4. Enter from meaning, not from convenience.** Direction should encode relationship: a detail expands *out of* the thing it details; a rebuttal slides in *against* the flow; the next pipeline stage enters from the previous stage's side. Arbitrary "fly in from left" that encodes nothing is decoration [practitioner — UX in Motion "continuity/relationship"; Material choreography].

**H5. Exits are half the job.** Clearing the stage before a new idea is what keeps frames readable. Exit the old idea (fast, ease-in, 5–8 frames), hold 3–6 frames of quiet, then enter the new idea. Never let the incoming and outgoing ideas cross mid-screen unless the morph itself is the point (§6.3).

---

## 4. Typography in motion

**4.1 Taxonomy.** Kinetic type splits into **motion typography** (letterforms rigid, position/scale/rotation animate) — subdivided into *scrolling* (whole block travels) and *dynamic layout* (words/letters move relative to each other) — vs. **fluid typography** (the letterforms themselves deform/morph) [academic/literature — Barbara Brownie's temporal-typography taxonomy, via Wikipedia and Content Creatures]. For an educational channel, stay ~95% in motion typography; fluid type is expressive and costs readability.

**4.2 Entrance patterns, catalogued** (all standard AE text-animator moves; all reproducible with per-character/word stagger + the properties named):

- **Fade-up** — opacity 0→1 + Y offset 10–20px, per-word stagger 1–2 frames. The workhorse; safest default.
- **Typewriter** — characters appear instantly left-to-right, no easing (appearance rate can be linear — it's a constant process, T4). 1–2 characters/frame reads as typing; pair with terminal aesthetics.
- **Word-by-word pop** — scale 0.9→1 (never 0→1, tell A3) + fade, per word, synced near narration cadence.
- **Tracking-in** — letter-spacing wide→normal + fade; elegant, for titles only.
- **Mask/line reveal** — text slides up from behind an invisible line at its own baseline; the "premium" title entrance [practitioner — AE community via Miracamp/Storyblocks].
- **Blur-in** — blur 8px→0 + fade; soft emphasis, use sparingly (GPU cost, and haze reads as vagueness).
- **Cascade/stagger by line** — successive lines fade-up 2–3 frames apart; the bullet-list pattern.
- **Counter/value change** — numerals interpolate to final value (UX-in-Motion "value change"); always ease-out so the last digits settle legibly; final value must hold per R-rules below.

**4.3 Exit taxonomy.** Mirror of entrances but faster (T2) and simpler: fade-down, mask-out, fade + slight Y continue. Exits should be *less* elaborate than entrances — the viewer already read the text; an ornate exit steals attention from the incoming idea [practitioner — sideshowfx/AE presets convention].

**4.4 Readability rules — hard numbers.**

- **R1. Reading speed:** budget 160–180 wpm / ~12–17 characters per second for on-screen text [spec — BBC subtitle guidelines 160–180 wpm; Netflix ≤17–20 CPS].
- **R2. Minimum hold:** no text fully-visible for less than ~24 frames (Netflix minimum subtitle duration is 20 frames); practical explainer floor: 1s for a short label, 2s+ for a sentence [spec — Netflix Timed Text Style Guide].
- **R3. Total on-screen time ≈ entrance + (word count / 3) seconds + 0.5s buffer.** A 12-word callout: ~4.5–5s before exit.
- **R4. Don't animate text while it must be read.** Motion during reading destroys comprehension; enter fast, then HOLD DEAD STILL for the reading window, then exit. Per-character animation is for ≤5-word titles, never body text [practitioner — Designity "titles flying too fast to read"; folklore].
- **R5. Never animate tracking, skew, or per-character position on text longer than one line.** [folklore — AE community]

---

## 5. Explaining with animation — the Sanderson principles

**E1. Visuals first, narration second.** 3Blue1Brown's stated method: "putting the visuals first and letting the explanation form around that" [practitioner — 3blue1brown.com/about]. For script-driven work, invert carefully: every narrated claim needs a visual referent, and the visual should carry information the words don't duplicate.

**E2. Concrete before abstract; example before definition.** "You just show them a bunch of examples… by the time you bring in the definition, it's articulating a thing that's already in the brain" [practitioner — Sanderson, Lex Fridman #64 transcript]. Animate the specific instance (this packet, this request, these 3 nodes) before showing the general diagram.

**E3. Transforms over cuts.** Manim's core move: "anything can transform into anything" — objects morph between representations rather than cutting, so the viewer's mental object survives the change and the *mapping* between representations is shown, not asserted [practitioner — Manim philosophy, solafide/Nibble analyses; spec — Manim `Transform`/`TransformMatchingTex`]. Rule: if state B is a modification of state A, morph A→B (500–1000ms, `smooth` easing). Cut only when the topic actually changes.

**E4. Visual metaphor consistency.** Once a shape/color means something (green box = client, orange = server), it means that for the whole episode. Reuse the exact same mobject in later scenes — bring it back via transform, not a lookalike redraw. Inconsistent re-instantiation silently breaks E3's continuity payoff [practitioner — Manim workflow; folklore].

**E5. Motivation in the first 30 seconds; clarity over cleverness.** Sanderson's judging criteria: clarity (explain jargon, minimal assumed background), motivation ("why care" within 30s), novelty, memorability [practitioner — 3blue1brown.com/blog/some1].

**E6. When to animate vs. hold still — the apprehension constraint.** The animation-learning literature is blunt: animations often *fail* to outperform static graphics because they violate the **apprehension principle** — changes happen too fast, or too many at once, to be accurately perceived [academic — Tversky, Morrison & Bétrancourt 2002, "Animation: can it facilitate?"]. Their **congruence principle**: animate only when the change over time *is* the content (data flowing, state machines stepping, a value growing). Operational rules:
  - Animate **processes**; hold still for **structures**. A finished architecture diagram should be static while narration walks it (use H3 emphasis, not motion).
  - One conceptual change per animation; if two things change, stage them (§6.2).
  - After any meaningful animation, hold the end state ≥ 1s before the next motion — comprehension happens in the holds.
  - If a viewer would want to pause the video to study the frame, the frame should already be paused for them.

**E7. Every image is a choice.** "With every image you're making a choice… each concrete example is aiding someone's path to understanding" [practitioner — Sanderson, Lex transcript]. No decorative particles, no ambient drift on informational frames. If a moving element carries zero information, delete the motion (see A7).

---

## 6. Diagram animation specifics

**D1. Line draws.** Draw connectors/paths with a trim-path (stroke-dashoffset) animation, 500–1000ms depending on length; ease-in-out or `smooth`. Draw *in the direction information flows* — the draw direction is data. For labeled arrows: draw line → land arrowhead → fade label in 2–3 frames later (C4). Manim's `Write`/`Create` (draw-border-then-fill) is the reference feel [spec — Manim].

**D2. Node-graph builds.** Order = dependency order, not spatial order: root/entry node first, then edges drawn outward to children as they appear. Per-node stagger 2–3 frames (C1, C2 cap). Nodes enter scale 0.9→1 + fade (never from 0, A3); the edge *to* a node starts drawing 1–2 frames before the node lands so arrival looks caused, not coincidental.

**D3. Chart builds.** One conceptual layer at a time: axes/gridlines first (fast, quiet, 6–9 frames), then primary series, then annotations/reference lines 200–400ms later [practitioner — Dev3lop staging; Urban Institute]. Bars: grow from the baseline (scaleY with bottom anchor), stagger 1–2 frames per bar, ease-out. Lines: left-to-right trim-path draw (time axis = draw direction). Never animate axes and data simultaneously — the frame of reference must be stable before data enters [academic — Heer & Robertson].
  - **Animate the data, not the chart junk.** Gridlines, legends, labels: fade, fast, no choreography.

**D4. Morphing between diagrams — the Heer & Robertson rules** [academic — "Animated Transitions in Statistical Data Graphics", InfoVis 2007]:
  - Prefer **simple, direct transitions** — translation and expand/contract are tracked far better than rotation. Avoid rotation in data morphs.
  - **Stage complex transitions**: if both axes rescale *and* marks move, do it as sub-transitions (rescale, dwell, then move) rather than everything at once. Dwells between stages must be long enough to track the change (≥ 6–10 frames).
  - **Maintain object constancy**: the same datum must be visibly the same mark across the morph (identity-preserving transforms — the data-viz statement of E3).
  - Total staged transition 1–2s; slower measurably hurts engagement without improving accuracy.

**D5. State-machine / packet-flow animation.** Moving tokens along edges is the congruent case where animation beats statics (E6). Token travel: 300–600ms per hop, linear-ish mid-edge with ease-out arrival; pause 6–10 frames at each node while narration names the step.

**D6. Camera moves.** Pan/zoom over a large diagram = full-scene transition timing (12–18 frames minimum, ease-in-out). One camera move per beat; combine pan+zoom into a single move rather than sequencing two. Zoom-out-to-reveal-context is a payoff move — use at most once or twice per episode.

---

## 7. Amateur tells — audit checklist

Each is a named defect; fix is cited to the rule above.

- **A1. Linear easing on spatial movement.** The #1 tell; constant velocity "doesn't occur in nature," reads robotic [practitioner — Adobe; folklore]. Fix: T4.
- **A2. Uniform timing everywhere.** Every element 300ms, every stagger 100ms, everything arriving together. Vary duration by size/distance (T3), stagger siblings (C1) — but *standardize* per element type; random variation is equally amateur [practitioner — LottieFiles "standardize easing per motion type"].
- **A3. Scale-from-zero entrances.** 0→100% scale looks like a PowerPoint preset and distorts letterforms en route. Enter at 85–95% → 100% + fade [folklore — AE community; consistent with Material fade-through conventions].
- **A4. Everything-fades.** Opacity crossfade as the only transition = no relationships encoded (H4), no continuity (E3). Fades are the fallback, not the system.
- **A5. Over-animation.** Perpetual ambient motion, hover-wiggles, particles. "Just because you can animate it doesn't mean you should" [practitioner — Adobe/Designity; folklore]. Budget: C7, E7.
- **A6. No follow-through / dead stops.** Everything freezes on the same frame like a switch flipped. Fix: C4, C5.
- **A7. Decorative motion during dense narration.** Motion competing with a point being made verbally. Fix: E6 holds, H1.
- **A8. Stacked emphasis.** Glow + bounce + zoom + color-flash on one element. Fix: H3 minimal-sufficient.
- **A9. Ornate exits.** Exit choreography rivaling entrances. Fix: T2 (shorter), 4.3.
- **A10. Bounce as default personality.** Elastic overshoot on serious content. Fix: T7, C5.
- **A11. Text moving while it should be read.** Fix: R4.
- **A12. Simultaneous multi-change morphs.** Axes + data + layout all shifting at once. Fix: D4 staging.
- **A13. Inconsistent visual language across scenes** — same concept drawn differently, easing register changing scene to scene [practitioner — Designity]. Fix: E4; keep ≥90% of animations in one easing "archetype" per project [practitioner — LottieFiles].
- **A14. Keyframe litter.** In code terms: magic numbers scattered per-element instead of a shared duration/easing token set. The design-system lesson: define tokens once (Carbon/M3 style) and compose [spec — Carbon, M3].

---

## 8. Default recipe (synthesis)

For a standard beat in this channel's episodes at 30fps: **dim non-focus elements over 6f → hold 3f → primary element enters 8f ease-out with 2f-staggered followers → overshoot ≤5%, settle 2f → HOLD ≥30f while narration lands → exit 6f ease-in → 4f quiet → next beat.** Diagram morphs: 20–30f `smooth`, staged if >1 conceptual change, end-state hold ≥30f.

---

## 9. Sources

**[spec]**
- Material Design (M1) duration & easing — https://m1.material.io/motion/duration-easing.html
- Material Design 3 easing/duration tokens — https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- IBM Carbon motion — https://carbondesignsystem.com/elements/motion/overview/ and https://v10.carbondesignsystem.com/guidelines/motion/overview/
- Apple WWDC23 "Animate with springs" — https://developer.apple.com/videos/play/wwdc2023/10158/
- Apple WWDC18 "Designing Fluid Interfaces" — https://developer.apple.com/videos/play/wwdc2018/803/
- Manim Animation defaults (run_time 1.0s, `smooth`, `lag_ratio`) — https://docs.manim.community/en/stable/reference/manim.animation.animation.Animation.html
- Manim rate functions — https://docs.manim.community/en/stable/reference/manim.utils.rate_functions.html
- Netflix Timed Text Style Guide (subtitle timing) — https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines
- Subtitle reading-speed limits (BBC 160–180 wpm, CPS) — https://www.closedcaptioncreator.com/blog/articles/subtitle-reading-speed.html

**[academic]**
- Heer & Robertson, "Animated Transitions in Statistical Data Graphics" (InfoVis 2007) — http://vis.stanford.edu/papers/animated-transitions
- Tversky, Morrison & Bétrancourt, "Animation: can it facilitate?" (IJHCS 2002) — https://hci.stanford.edu/courses/cs448b/papers/Tversky_AnimationFacilitate_IJHCS02.pdf
- Brownie temporal-typography taxonomy — https://en.wikipedia.org/wiki/Kinetic_typography

**[practitioner]**
- 3Blue1Brown about (visuals-first) — https://www.3blue1brown.com/about
- Sanderson, SoME1 criteria (clarity/motivation/novelty/memorability) — https://www.3blue1brown.com/blog/some1
- Sanderson on Lex Fridman #64, transcript (concrete-before-abstract, every-image-is-a-choice) — https://podscripts.co/podcasts/lex-fridman-podcast/grant-sanderson-3blue1brown-and-the-beauty-of-mathematics
- Manim philosophy analyses — https://solafide.ca/blog/inside-3blue1brown-manim-animation-engine-part-1 ; https://nibble-app.com/blog/manim
- LottieFiles motion-design-skill troubleshooting (numeric heuristics) — https://github.com/LottieFiles/motion-design-skill/blob/main/skills/motion-design/reference/troubleshooting.md
- animations.dev, "The Easing Blueprint" — https://animations.dev/learn/animation-theory/the-easing-blueprint
- Willenskomer, "UX in Motion Manifesto" (12 principles) — https://medium.com/ux-in-motion/creating-usability-with-motion-the-ux-in-motion-manifesto-a87a4584ddc
- School of Motion, common animation mistakes — https://schoolofmotion.com/blog/new-to-2d-character-animation-here-are-the-most-common-mistakes-and-how-to-avoid-them
- Mt. Mograph, bounce & overshoot — https://mtmograph.com/blogs/tools/the-bounce-and-overshoot-animation-trick-every-motion-designer-should-know
- Dan Ebberts, "Realistic Bounce and Overshoot" (AE expressions → code) — https://motionscript.com/articles/bounce-and-overshoot.html
- Urban Institute, animating data visualizations — https://urban-institute.medium.com/4-observations-on-animating-your-data-visualizations-cf987b069c35
- Dev3lop, animation principles for data transitions — https://dev3lop.com/blog/animation-principles-for-data-transition-visualization/
- IxDF, Disney's 12 principles applied to UI — https://ixdf.org/literature/article/ui-animation-how-to-apply-disney-s-12-principles-of-animation-to-ui-design
- Content Creatures, kinetic typography types — https://www.contentcreatures.com/kinetic-typography-different-types-of-animated-text/
- AE text-animation technique catalogues — https://www.miracamp.com/learn/after-effects/best-text-animation-techniques ; https://helpx.adobe.com/after-effects/using/animating-text.html
- Designity, top motion-graphics mistakes — https://www.designity.com/blog/top-10-mistakes-to-avoid-in-motion-graphics-design

**[folklore]** (community consensus, no single canonical source)
- Linear = robotic; 70–700ms envelope with 200–300ms sweet spot — echoed in https://www.adobe.com/uk/creativecloud/animation/discover/easing.html and countless r/MotionDesign / r/AfterEffects threads
- Scale-from-zero, everything-fades, over-animation as amateur tells; "less is more" — AE community consensus, partially codified in the LottieFiles troubleshooting doc above

*Note: r/MotionDesign and r/AfterEffects threads could not be fetched directly (Reddit blocks crawlers); community positions are represented via secondary codifications (LottieFiles skill doc, Adobe community/discover articles) and labeled folklore accordingly.*
