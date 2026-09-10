# Explainer-animation guide — advanced sequencing craft

Companion to `animation-craft.md`. That doc covers the physics: durations,
easing curves, choreography, the amateur-tell audit. This one covers the
**sequencing** layer — how a top explainer channel welds a *stream* of visual
information onto a *stream* of narration so the two feel like one thing. Scene
transition grammar, data-reveal choreography, kinetic-typography timing, camera
moves, and the narration-to-visual lock.

Frame numbers assume **30fps** (this channel's spec). "f" = frames; ms in
parentheses. Every rule is numbered — cite the ID in review. Source labels:
**[creator]** = a named channel's documented practice, **[practitioner]** =
working editors/motion designers, **[academic]** = peer-reviewed, **[folklore]**
= community consensus. URLs in §8.

This doc is opinionated and channel-specific. We are a **faceless, code-and-
diagram tech channel** — not Kurzgesagt (character animation, 8–10 week hand-
animation budgets) and not Johnny Harris (film-burn textures, cinematic
b-roll). We steal the *sequencing logic* of those channels and reject their
*surface texture*. Where a technique fights the PLAYBOOK non-negotiables or the
`theme.ts` design tokens, the PLAYBOOK wins — noted inline.

---

## 1. The narration lock — how audio drives picture

The core discipline of every channel studied: **the voice is the spine; the
picture is the muscle hung on it.** Sanderson builds clips first and syncs in an
editor afterward; Vox writes so "every visual answers something the narrator
just said"; Fireship cuts on the beat of his own delivery. [creator] We author
`script.yaml` first and animate to `words.json` timestamps — same principle,
inverted order.

**N1. Land visuals ON or ~3f BEFORE the word, never after.** Restated from the
PLAYBOOK because it is the single most-violated rule. The eye must already be on
the thing when the ear hears its name. An entrance that starts 3f early finishes
*at* the word. A visual that lands after the word makes the viewer feel the
video is lagging them. Ground truth is `words.json`; `<mark id=... land_at>` in
the script is how the script author declares the sync point.

**N2. Use the J-cut / L-cut split for scene changes.** Never change picture and
audio topic on the same frame — it reads as a hard slide-boundary. [practitioner]
- **J-cut (audio leads):** the narration of the *next* beat starts ~6–12f (200–
  400ms) before its visuals arrive. The sentence "…and that's where TLS comes
  in" begins over the *old* diagram; the TLS scene builds as the word "TLS"
  lands. This is the default for concept-to-concept moves.
- **L-cut (visuals lead / linger):** the *previous* beat's diagram holds 6–15f
  into the new sentence before dissolving/morphing out. Use when the new point
  is a *comment on* the old picture (an annotation, a caveat, a "but notice…").
The split hides the seam. A clean same-frame cut is reserved for a deliberate
hard topic change (§2).

**N3. One "information unit" per breath.** Vox's rule of thumb is one clear
visual idea per narrated sentence/clause. [creator] Map it: each `[breath]` or
sentence boundary in the script is a candidate for a new visual unit (a chart, a
line of code, a keyword, a diagram step). Fewer than that and the screen goes
stale (violates non-negotiable 1); more and the apprehension principle breaks
(§4, [academic]).

**N4. Silence gets motion; dense narration gets stillness.** Invert effort
against word density. During a fast, information-dense sentence, the picture
holds nearly still (one calm diagram, emphasis by dim/highlight — §5) so the ear
can work. During a pause, `[beat]`, or a slow rhetorical line, *that's* where the
camera move, the chart build, or the transform goes. Fireship does the opposite
surface (rapid cuts) but the same logic: the joke/meme cut lands in the *gap*
after a punchline, not over the explanation. [creator]

**N5. Cut/transition on the stressed syllable, not the pause.** When you do
change scenes, snap it to the emphasized word, not the silence before it. The
transition feels *caused* by the narration. `**punch**` markup in the script is
a transition-anchor candidate.

---

## 2. Scene transition grammar

A "scene" here = one section's worth of visual space. Transitions between them
are a *vocabulary*, and each word means something. Picking the wrong one lies to
the viewer about the relationship between two ideas. [practitioner]

**G1. The transition encodes the logical relation. Pick from meaning:**

| Relationship between beat A and beat B | Transition | Mechanic / timing |
|---|---|---|
| B is a *modification* of A (same object, new state) | **Morph / transform** | keep the mobject, tween 15–30f `smooth`. Never cut. (§3, E3) |
| B is the *next step* in one process/space | **Camera move** (pan/zoom to new region) | 12–18f ease-in-out, one combined pan+zoom. Same coordinate space. |
| B *zooms into detail* of A | **Push-in / scale-up** | 12–18f ease-in-out; A stays underneath, don't cut away |
| B *pulls back to context* around A | **Zoom-out reveal** | payoff move; ≤1–2 per episode |
| B is a *hard new topic*, unrelated | **Hard cut** (+ optional dip) | same-frame cut on a stressed word (N5); background can dip 3–4f |
| B is a *rebuttal / contrast* to A | **Directional wipe against the flow** | B enters from the side that opposes A's direction (H4) |
| B is a *receipt* (screenshot/headline proving A) | **Card dock / snap-in** | quick 6–8f pop; treat as annotation, then dismiss |

**G2. Default to transforms and camera moves; ration hard cuts.** The PLAYBOOK's
"transforms over add/remove" applies at the scene scale too. If two consecutive
sections are unrelated enough to need a hard cut, ask whether they can share a
coordinate space instead — lay both out in one plane and *move the camera*
between them (Johnny Harris's map-as-continuous-space; 3B1B's single canvas).
Spatial continuity beats teleporting (PLAYBOOK variety rule 4). [creator]

**G3. No decorative transitions.** Whip pans, film burns, light-leak dissolves,
glitch wipes — every studied "how to edit like X" tutorial reaches for these,
and they are exactly the surface texture we reject. A whip pan is legitimate
*only* as a genuine spatial move (camera actually travels between two regions in
one space), never as a stylistic smear between unrelated cards. [practitioner]
If a transition carries no spatial or logical meaning, use a plain cut.

**G4. Match-cut when geometry is shared.** If beat A ends on a shape/line that B
also contains (a bar becomes an axis; a box becomes a node; a `{` brace becomes
a diagram bracket), align them and let A's element *become* B's — a graphic match
cut. This is the strongest, cheapest continuity move and it's pure Manim
transform. [practitioner]

**G5. Never crossfade two informational frames.** Opacity crossfade dissolves
encode no relationship and momentarily show a muddy both-at-once frame. Reserve
dissolves for ambient/background layers only. Cut, morph, or camera-move instead
(animation-craft A4).

**G6. Beat gap between sections: 4–8f of quiet.** After A exits and before B
enters, hold ~4–8f (130–260ms) of settled background. This is the visual
equivalent of a breath and it's where comprehension consolidates. Two sections
that touch with zero gap feel rushed even when each is individually correct.

---

## 3. Data-reveal choreography

The most valuable and most-botched sequence type on a tech channel. The failure
mode is everything (axes, bars, labels, annotation) arriving at once — the
apprehension principle shattered. [academic] Build data in **layers**, each
layer a separate narrated beat.

**R1. Fixed frame of reference first, always.** Draw axes / gridlines / the empty
map / the code skeleton **before any data**, fast and quiet: 6–9f, low contrast
(use `dim` for gridlines, `stroke` for axes from `theme.ts`). The reference must
be *stable* before data enters — never animate axes and data simultaneously
(animation-craft D3, Heer & Robertson). [academic] Narration over this layer is
setup ("here's spend over five years…"); the payoff data comes on the next
clause.

**R2. Data enters in the direction of its meaning.**
- **Bars:** grow from the baseline (scaleY, bottom-anchored), stagger 1–2f each,
  ease-out. Category order = narrative order, not alphabetical.
- **Lines:** left-to-right trim-path draw (time axis = draw direction), 15–30f
  by length, `smooth`. The draw *is* the passage of time.
- **Count-up numbers:** interpolate to the final value, ease-out so the last
  digits settle legibly, then **hold the final value** ≥30f. A number that keeps
  ticking while narration moves on is unreadable (animation-craft 4.2, R2).

**R3. Annotations come 200–400ms (6–12f) after the data they mark.** The bar
arrives; a `[beat]` later the callout/highlighter/label lands on it. Simultaneous
data+annotation reads as one busy blob and hides the causal "look → now here's
why." This is the Vox **highlighter** move: the shape is already on screen, then
a marker sweep or box draws *onto* it exactly as narration says "this part." The
sweep itself is a trim-path draw, 8–15f, warm accent (`warm` / `accent`). [creator]

**R4. Stage any transition that changes more than one thing.** Re-sorting a bar
chart, rescaling an axis while marks move, switching chart types — do it as
*sub-transitions* with a dwell between (rescale → dwell 6–10f → move), never all
at once. Maintain **object constancy**: the same datum is visibly the same mark
across the change; move it slowly enough to track (bar-chart-race lesson — bars
slide to new ranks *slowly*). [academic][practitioner] Total staged transition
1–2s; slower hurts engagement without improving accuracy.

**R5. Animate the data, freeze the chart junk.** Gridlines, legends, axis labels,
titles: fade in fast, no choreography, then dead still. Choreography is spent
only on the marks that carry the number. [practitioner]

**R6. One comparison per reveal.** If the point is "A vs B," don't also animate a
trend line and a threshold and three annotations in the same beat. Reveal A,
reveal B, *then* (new beat) the annotation that compares them. The reveal answers
exactly one question the narration just asked (N3).

**R7. Rebuild from raw public data.** (Carried from PLAYBOOK/asset-sourcing —
belongs in any data-reveal checklist.) BLS is public domain; FRED third-party
series are not; every chart credited in `credits.md`. Never screen-grab someone's
rendered chart — rebuild it in-engine so it lives in our type/color system.

---

## 4. Kinetic typography timing

On a faceless channel, on-screen words *are* a second narrator — so their timing
is as load-bearing as the voice. The PLAYBOOK is strict: keywords are 1–4-word
noun phrases, on their spoken word, held ≥24f, then **docked** into a label (not
vanished). This section is the timing underneath that.

**K1. Keyword = spoken word, heavy sans, ≥24f hold.** When narration hits a key
noun phrase, that phrase appears **as** it's spoken (N1: entrance starts ~3f
early), in heavy sans (spoken keywords) — mono is reserved for code/annotations.
Hold fully still ≥24f (0.8s). **Do not animate text while it must be read** —
enter fast, HOLD DEAD STILL, then exit/dock (animation-craft R4). [practitioner]

**K2. Dock, don't disappear.** The PLAYBOOK's signature type move: after its hold,
a big centered keyword *shrinks and moves* to become a small persistent label in
a corner or beside its diagram (12–15f, ease-in-out, `smooth`). The word doesn't
vanish — it demotes to reference. This gives object constancy to *language* and
builds a running glossary on screen. Use `dim` for docked labels.

**K3. Entrance-grammar rotation for text (never the same pop twice running).**
Per the PLAYBOOK variety rule, rotate at least 4 text-entrance patterns and never
repeat one >3 elements in a row:
- **fade-up** (opacity + 10–20px Y, per-word stagger 1–2f) — the safe workhorse
- **mask/line reveal** (text slides up from behind an invisible baseline) — the
  "premium" title entrance; for section headers
- **word-by-word pop** (scale 0.9→1 + fade, per word near narration cadence) —
  never scale from 0 (amateur tell A3)
- **typewriter** (chars appear L→R, linear rate, 1–2 chars/frame) — pair with
  terminal/code aesthetics only
- **tracking-in** (letter-spacing wide→normal + fade) — titles only, ≤5 words
- **count-up** (numerals interpolate) — for numbers (R2)

**K4. Reading-time budget is a hard gate.** On-screen text total time ≈ entrance
+ (word_count / 3) seconds + 0.5s buffer. A 12-word callout needs ~4.5–5s before
it can exit. Reading speed budget: 160–180 wpm / ~13–17 chars/sec. Minimum hold
for any text ≥24f. If the narration doesn't dwell long enough to read a phrase,
the phrase is too long — cut it to ≤4 words. [spec: BBC/Netflix subtitle limits]

**K5. Never full-transcribe the narration.** On-screen text is *keywords*, not
captions of what's being said. Duplicating the voice word-for-word is redundant
and unreadable at speed. Pull the 1–4-word noun the sentence pivots on. [creator:
Vox/Fireship kinetic type] (Auto-generated captions are a separate accessibility
track, not this.)

**K6. Never animate tracking/skew/per-character position on text longer than one
line.** And exits are simpler + faster than entrances (fade-down or mask-out,
5–8f) — the viewer already read it; an ornate exit steals the next beat's
attention (animation-craft 4.3, A9). [folklore]

**K7. Code is typography too.** Real code, rendered natively with syntax
highlighting (PLAYBOOK "real content, not chrome"), reveals by **typewriter or
line-cascade** (successive lines fade-up 2–3f apart), never by scale-pop. Hold
each line ≥ its own reading window. Highlight the *active* line/token by dimming
the rest (§5), synced to the word — this is the code equivalent of the Vox
highlighter (R3).

---

## 5. Emphasis without motion — leading the eye on a still frame

Because dense narration demands a still picture (N4), most emphasis happens
*without* new entrances. Use the weakest technique that works; stacking them is
an amateur tell (animation-craft A8, H3). [practitioner]

**M1. Escalation ladder (weakest → strongest):** (1) hold everything else still;
(2) dim/desaturate non-focus elements 6–10f before the change (`dim`/lowered
opacity) — this is *attentional anticipation*, park the eye before the change so
change-blindness doesn't eat it [academic]; (3) scale focus up 5–10%; (4) draw a
stroke/underline/box onto it (trim-path, 8–15f, `accent`/`warm`); (5) camera
push-in toward it. Prefer the top of the ladder.

**M2. Highlighter sweep is the house emphasis move.** A `warm` marker sweep or a
drawn box that appears *on already-present content* exactly as narration names
it. It's motion (keeps the screen alive, non-negotiable 1) but it doesn't move
the content, so reading isn't disturbed (K1). This is the single most Vox-coded,
most reusable annotation in the whole vocabulary — build it as a component.

**M3. Dim-the-rest beats spotlight-the-one for code and diagrams.** To point at
line 3 of 8, drop lines 1–2 and 4–8 to `dim` opacity rather than glowing line 3.
Reduction reads calmer and more premium than addition.

---

## 6. Camera moves

The camera is how a faceless channel gets *cinematic* motion without b-roll. But
it is the most over-used tool in the "edit like Johnny Harris" tutorials, so
ration it hard. [creator]

**C1. One coordinate space per section; move the camera, don't swap cards.** Lay
a section's content out in a single large plane and travel between regions
(pan/zoom). This is 3B1B's infinite canvas and Harris's continuous map. It gives
spatial memory: the viewer knows *where* the earlier idea lives and can be
brought back to it. Beats popping unrelated cards in the same spot (PLAYBOOK
variety rule 4). [creator]

**C2. Combine pan + zoom into one move, ease-in-out, 12–18f.** Never sequence a
pan then a separate zoom — it reads as two robotic steps. One blended move,
`smooth`/standard easing, timed to a narration clause. Scale duration with
distance (bigger travel → 18f+; animation-craft T3).

**C3. Always-on ambient drift ≠ a camera move.** The slow background drift
(non-negotiable 1, `AmbientBackground`) runs constantly and means nothing — it
just keeps the frame alive. A *camera move* is a deliberate, narration-locked
travel to new content. Don't confuse the two; don't let idle drift accelerate
into a fake move.

**C4. Zoom-out-to-reveal-context is a payoff — ≤1–2 per episode.** Pulling back
to show the thing-we-were-looking-at was one node in a bigger system is a genuine
"whoa" beat. It stops working if you do it every section.

**C5. The Harris "punch-in on a still" is legit; the film-grain is not.** A quick
scale-up (Ken-Burns push) on a screenshot/headline *receipt* as narration lands
the point is good sequencing — it directs the eye and adds life to a static
asset (`AnnotatedImage` already does Ken-Burns + drift). The textured film burns,
light leaks, chromatic aberration, and 12fps-stutter that those tutorials teach
are surface identity we reject — they fight `theme.ts` and read as "vlog," not
"engineering." [creator, rejected on channel grounds]

**C6. Motion-blur camera moves only if fast; hold end state ≥1s.** A fast travel
can carry directional blur to sell speed, but the destination must arrive and
hold still ≥30f so the eye can read the new region (E6 apprehension hold).

---

## 7. Sequencing checklist (per beat)

Run this on every scene during animation review, in order:

1. **Referent?** Does every narrated claim in this beat have a visual it points
   at, and does that visual carry info the words don't just repeat? (N3, E1)
2. **Lock?** Does each element land on/3f-before its word per `words.json`? (N1)
3. **Split?** Is the scene change a J-cut or L-cut, not a same-frame swap? (N2)
4. **Relation → transition?** Does the transition *type* match the logical
   relation between this beat and the last (morph/camera/cut/wipe)? (G1)
5. **Layered data?** Reference frame before data; annotations 6–12f after data;
   one comparison per reveal? (R1, R3, R6)
6. **Text timing?** Keywords ≤4 words, held ≥24f, docked not vanished, reading-
   budget satisfied, entrance-grammar rotated? (K1–K5)
7. **Register alternation?** Loud keyword beat → quiet diagram breath → loud, not
   two loud beats back-to-back? (PLAYBOOK variety rule 6)
8. **Stillness under density?** Is the busiest-narration moment the *stillest*
   picture? (N4)
9. **Hold?** After any meaningful motion, ≥30f end-state hold before the next
   move? (E6)
10. **Gap?** 4–8f of quiet between sections? (G6)

If a beat fails 3+ of these, it's a REVISE regardless of how polished the
individual animation looks.

---

## 8. Sources

**[creator] — named channel practice**
- Vox motion-graphics breakdown (highlighter, kinetic type, map animation, "every visual answers the narrator") — https://www.premiumbeat.com/blog/replicating-vox-motion-graphic/
- Vox informational-video method (infographics, reusable motifs, research-first) — https://www.kapwing.com/resources/how-to-make-informational-videos-like-vox/
- Kurzgesagt process (storyboard-first, visual-metaphor consistency, ~a dozen script drafts, 2–3 animators over 8–10 weeks) — https://www.linkedin.com/pulse/how-kurzgesagt-nikko-imperial and https://kurzgesagt.org/what-we-do
- Fireship style (fast pace, black background, memes-as-receipts, faceless density) — https://read.engineerscodex.com/p/how-fireship-became-youtubes-favorite and https://youtube.fandom.com/wiki/Fireship
- Johnny Harris documentary techniques (photo pop-up, punch-in on stills, map-as-space, texture — texture rejected on our channel) — https://motionarray.com/learn/premiere-pro/edit-documentary-in-premiere-pro/
- 3Blue1Brown / Manim (visuals-first, clips-then-edit sync, `self.wait()` after every animation, shared palette/type/speed) — https://www.3blue1brown.com/about/ and https://nibble-app.com/blog/manim

**[practitioner]**
- J-cuts and L-cuts (audio as the spine; audio-led scene changes) — https://www.adobe.com/creativecloud/video/post-production/cuts-in-film/l-and-j-cut.html and https://www.techsmith.com/blog/how-to-edit-videos-l-cuts-and-j-cuts/
- Match cuts, whip pans, transition-as-meaning, "don't overdo flashy transitions" — https://www.studiobinder.com/blog/match-cuts-creative-transitions-examples/ and https://www.studiobinder.com/blog/types-of-editing-transitions-in-film/
- Bar chart race — slow bar re-sorting for trackability, cumulative data structure — https://flourish.studio/visualisations/bar-chart-race/

**[academic]**
- Observable, "Five ways to effectively use animation in data visualization" (tweening/object-constancy, spatial shifts, motion-as-cue, use sparingly) — https://observablehq.com/blog/effective-animation
- Heer & Robertson, "Animated Transitions in Statistical Data Graphics" (staged transitions, object constancy, avoid rotation) — http://vis.stanford.edu/papers/animated-transitions
- Tversky, Morrison & Bétrancourt, "Animation: can it facilitate?" (apprehension + congruence principles, change blindness) — https://hci.stanford.edu/courses/cs448b/papers/Tversky_AnimationFacilitate_IJHCS02.pdf

**[spec]**
- Subtitle reading-speed limits (BBC 160–180 wpm; Netflix CPS + min duration) — https://www.closedcaptioncreator.com/blog/articles/subtitle-reading-speed.html and https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines

**[folklore]** — community consensus codified in the sources above; per-character
text animation limits and ornate-exit avoidance from AE community convention, no
single canonical source.
