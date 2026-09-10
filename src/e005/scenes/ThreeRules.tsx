import React from "react";
import { Easing, Loop, interpolate, interpolateColors } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { BRoll } from "../../components";
import {
  IDLE_FILL,
  MONO_CAP_RATIO,
  TYPE,
  capToFontSize,
  clampEntranceFrames,
  theme,
} from "../../components/theme";

/**
 * CONTRAST FLOOR (round-4, ND-2). `theme.dim` (#8B949E) at 0.19-0.8 alpha over
 * a too-light b-roll plate measured 2.3-3.9:1 on four secondary captions — the
 * WCAG AA large-text floor is 3:1 and the house target is 4.5:1. Every
 * secondary caption in this scene now uses this one step-up from `dim`
 * (13.5:1 on the scrimmed plate at full alpha, ~7:1 at the receded 0.58), and
 * it is still visibly subordinate to `theme.ink`. Never reach for `theme.dim`
 * for TEXT in this beat — it is for strokes and unlit cells only.
 */
const SECONDARY = "#C9D1D9";

const MONO = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
}).fontFamily;
const SANS =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Build steps, named exactly as in this beat's `build:` list in script.yaml. */
export type ThreeRulesStep =
  | "rule1_draw"
  | "rule2_draw"
  | "aos_soa_morph"
  | "rule3_draw"
  | "mini_sweep"
  | "hold_list";

export const THREE_RULES_STEPS: ThreeRulesStep[] = [
  "rule1_draw",
  "rule2_draw",
  "aos_soa_morph",
  "rule3_draw",
  "mini_sweep",
  "hold_list",
];

export interface ThreeRulesProps {
  /**
   * 0..1 per step; absent = 0 = not started. Caller maps timing.json marks.
   *
   * ASSEMBLER CONTRACT: ramp each step's p linearly across ITS OWN slot as
   * given by `THREE_RULES_NOMINAL`. Every sub-reveal below is scheduled in
   * FRAMES-from-step-start, so an entrance is 9 frames regardless of how wide
   * the step's slot is.
   */
  p: Partial<Record<ThreeRulesStep, number>>;
  /** Absolute frame, for idle micro-motion ONLY. Everything else is progress-driven. */
  frame?: number;
}

/* -------------------------------------------------------------------------
 * TIMING. timing.json: `three_rules` starts at frame 14795 and
 * `real_system_payoff` at 16066, so the window is 1271 frames (42.4s) — the
 * longest beat in the episode. Marks land at beat-local 297 (`rules`), 464
 * (`rule2`), 792 (`rule3`).
 *
 * Episode005.tsx PLANS.three_rules pins those marks (with the offsets that
 * reproduce the boundaries below) and fills the rest by weight, then adds a
 * cross-fade tail of min(8, 10% of the slot). The resulting SLOTS — which is
 * what NOMINAL records, and what `sub()` converts progress back into frames
 * with — are, beat-local:
 *
 *   rule1_draw       0 - 398
 *   rule2_draw     390 - 538
 *   aos_soa_morph  530 - 786
 *   rule3_draw     778 -  852
 *   mini_sweep     845 -  905
 *   hold_list      900 - 1279
 *
 * Six steps over 1271 frames is a seven-second hold per step, so every step
 * fans out into 4-10 sub-reveals: 52 scheduled reveals, longest gap 51 frames
 * (1.7s, between key1 and note1), no static hold anywhere in the beat and a
 * 24-frame tail.
 *
 * ROUND-3 FIXES (grader defects, in the order they were reported):
 *   DF-7 instant pops — the keyword entrances measured 4 frames (133ms) even
 *     though ENTER is 9, because popOpacity finishes at 55% of the window.
 *     key1/key2/key3 (and the closing headline) now use keyOpacity, which
 *     spans 90% of it: 270ms, inside the 200-300ms band.
 *   SYNC — key2 moved 452 -> 461 and key3 782 -> 789, so each entrance starts
 *     3 frames before its mark instead of 10-12 (300-433ms early).
 *   HOLD abs 14923-15022 (local 128-227) — the pull-quote fills it: a rule
 *     draws at 150 and five quote lines cascade 174-226.
 *   HOLD abs 15912-16018 (local 1117-1223) — four text reveals already fired
 *     inside it but were too small to measure; the closing block is now at the
 *     type scale and the two advice rows are proved with six cells each,
 *     landing at 1158 and 1220.
 *
 * ROUND-7 FIX (grader priority #5, abs 15152-15307 = beat-local 357-512, a
 * 5.20s hold with only two content events, a 2.5s gap and a 2.7s gap). Two
 * separate faults sat on top of each other here:
 *
 *   (a) THE PROOF WAS DEAD CODE. Round 6 scheduled rule one's cache proof at
 *       `rule1_draw` f405-429 — but `rule1_draw`'s NOMINAL is 398, and `sub()`
 *       is `(p * NOMINAL - at) / dur`, so with p pinned at 1 the numerator
 *       maxes out at 398 - 405 = -7 and those six cells NEVER RENDERED. That
 *       is the whole 2.5s gap: after `note1` at 355 and `quoteDim` at 372 the
 *       left column genuinely had nothing until `arm2` at 428. Anything
 *       authored past a step's own nominal is silently invisible; every offset
 *       below is now inside its step's nominal by at least 9 frames.
 *   (b) IT WAS ALSO TOO SMALL AND IN THE WRONG PLACE. Six 34px chips are
 *       6,936px = 0.33% of frame, which clears the detector's 0.3% floor and
 *       nothing else — see the INK BUDGET note in components/theme.ts, where
 *       the perceptual threshold is ~2.0%. Meanwhile the quote sat at the mono
 *       FLOOR (56px, i.e. 28px on the 960 proxy the grader reads) and the
 *       bottom third of the frame was empty for the whole first half of the
 *       beat.
 *
 * So the window is re-staged with FEWER, MUCH LARGER events (the ink budget's
 * own corollary: when a beat reads static the fix is not a fourth flicker, it
 * is making the reveals you already have about 5x bigger):
 *
 *   local 370  cachePlate wipes in   888 x 124 = 110,112px = 5.31% of frame
 *   local 380  four FAT records      4 x 194 x 100 =  77,600px = 3.74%
 *   local 408  they MORPH into 12 compact ones: 77,600 leaves as an 839 x 100
 *              row (83,900px = 4.04%) wipes in over the same band -> ~7.8%
 *   local 448  bandRow travels row 1 -> row 2: 784 x 220 leaving and arriving
 *              = 344,960px = 16.6% (ROUND-14: 16f -> 10f, 4.51% in its
 *              first frame)
 *   local 450  ROW TWO arrives whole (ROUND-14 / D1) — numeral, baseline,
 *              key and note inside ONE clip; see `rowIn`
 *   local 461  key2 (existing)       630 x 64 = 40,320px = 1.94%
 *   local 472  the whole cache block leaves: 110,112 + 83,900 = 194,012px
 *              = 9.35%
 *   local 500  note2 (existing)      435 x 58 = 25,230px = 1.22%
 *   local 508  the quote and its plate leave: 888 x 660 = 586,080px = 28.3%
 *
 * Rendered (rule2_draw's ramp is 133 over a nominal of 148, so a step-local
 * frame is 0.899 rendered frames) those land at abs 15165 / 15175 / 15216 /
 * 15250 / 15256 / 15274 / 15299 / 15306. Largest gap inside the reported hold
 * is 15175 -> 15216 = 41 frames = 1.37s, against 2.5s and 2.7s before. Every
 * one of them clears REVEAL_INK_MIN_FRACTION (1.5% = 31,100px) on its own.
 *
 * ROUND-7 LAYOUT. The quote goes to 80px mono (a 58px CAP, one full step above
 * the floor and 40px on the proxy) and re-wraps to six lines, which is the
 * card GROWING rather than the type shrinking to fit. It now owns the right
 * column down to y 870, and the checklist drops from ROW_Y [258, 440, 622] to
 * [300, 520, 740] — a 220px pitch instead of 182 — with the sweep strip and its
 * label following it down to y 916 and 952. The left column now runs 62-1010
 * and the right 228-1014 instead of both stopping around y 772: the frame's
 * bottom third was the "dead half" the grader called out, and each rule's
 * arrival is now a 784 x 186 band lift landing in it rather than one more line
 * in a stack near the ceiling.
 *
 * ROUND-9 FIX (abs 15537-15632, 3.20s, the tail of `aos_soa_morph`). The
 * highest-motion dead window in the episode — 39% of its frames move, its peak
 * 6-frame ink is 1.53% against a 2.0% gate — because every reveal authored into
 * it is a glyph or a hairline: one crossfading word, three single mono row tags
 * and a 242 x 2 bracket, none of them a tenth of a content event. The step is
 * the one the script marks "tiny ... small, secondary", so its own brief is why
 * it cannot carry its last 8.5 seconds. One large mask wipe is added at local
 * 194-212 (abs 15575-15593), on "arrays in structs": the SoA declaration on a
 * lit bed, 850 x 212 = 180,200px = 8.69% of frame, 8.69 x 6 / 18 = 2.90. See
 * the DECL_* block for the word timings it is solved against and the bounds.
 *
 * The keywords now land at local 280 (`rules` 297), 461 (`rule2` 464) and 789
 * (`rule3` 792): on or three frames before their word, never after.
 *
 * Only three of the beat's words carry marks, and all three are in the first
 * two thirds — the last 480 frames are unmarked, so the back half is timed off
 * the word RATE the marks imply (2.91 w/s, with a ~57-frame `//` before "In
 * practice"): "sweeps" ~854, "prefetcher" ~895, "Biased" ~936, "hardware's"
 * ~1008, "In [practice]" ~1096, "vector's" ~1127, "pointer-heavy" ~1199,
 * "measured" ~1240. Every reveal after `rule3` is placed against those, within
 * 3-8 frames and always early — late is the one defect this beat cannot
 * absorb, because nothing downstream of `rule3` has a mark to catch drift.
 * ---------------------------------------------------------------------- */
export const THREE_RULES_NOMINAL: Record<ThreeRulesStep, number> = {
  rule1_draw: 398,
  rule2_draw: 148,
  aos_soa_morph: 256,
  rule3_draw: 74,
  mini_sweep: 60,
  hold_list: 379,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });
/** Exits ease IN and are shorter — a thing leaving shouldn't decelerate. */
const easeIn = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.in(Easing.cubic) });

/** Snappy entrance length. 9 frames is the top of the 6-9f band. */
const ENTER = 9;

/**
 * Sub-reveal scheduler. `at`/`dur` are FRAMES from the start of the step, so
 * the numbers in the calls below ARE the storyboard's frame spacing.
 */
const sub = (
  p: number | undefined,
  step: ThreeRulesStep,
  at: number,
  dur: number = ENTER,
) => ease((clamp01(p ?? 0) * THREE_RULES_NOMINAL[step] - at) / dur);

const subOut = (
  p: number | undefined,
  step: ThreeRulesStep,
  at: number,
  dur: number = ENTER,
) => easeIn((clamp01(p ?? 0) * THREE_RULES_NOMINAL[step] - at) / dur);

/**
 * LINEAR sub-reveal — the one to use for a LARGE MASK WIPE.
 *
 * ROUND-12. A RAMP IS NOT A CONTENT EVENT, and this scene shipped three of
 * them. The pacing detector starts a burst on >= 0.3% of frame changing in ONE
 * frame (or >= 2.0% across a 6-frame window). An ease-out curve's steepest
 * single-frame step is 3/N of its whole span (d/dt of 1-(1-t)^3 at t=0 is 3),
 * so a cubic-out ramp puts ~21% of its delta in its first frame and dribbles
 * the rest out below the gate; worse, an OPACITY ramp never produces a step of
 * >= 25 luma at all unless (3/N) x deltaY >= 25. `bandIn` was a 14-frame
 * ease-out opacity ramp on a 69-luma, 7.03%-of-frame rectangle and therefore
 * scored EXACTLY 0.000% — the biggest recurring "event" in the beat was
 * invisible to the instrument and, per the r11 grade, to the eye.
 *
 * `linSub` advances at a constant areaPct/dur per frame, which is the only
 * shape that lets the authoring rule below hold:
 *
 *     areaPct * 6 / durationFrames >= 2.0
 *
 * Named `linSub` deliberately: scripts/check_subreveals.ts admits exactly the
 * helper names in its HELPERS list, and a helper it cannot see is a reveal it
 * cannot prove is alive (see that file's `travelStage` note).
 */
const linSub = (
  p: number | undefined,
  step: ThreeRulesStep,
  at: number,
  dur: number = ENTER,
) => clamp01((clamp01(p ?? 0) * THREE_RULES_NOMINAL[step] - at) / dur);

// Entrance scale: 0.94 -> 1.03 -> 1.0. Never from 0 — a card growing out of
// nothing is the banner-ad read.
const popScale = (t: number) =>
  interpolate(clamp01(t), [0, 0.6, 0.85, 1], [0.94, 1.03, 0.995, 1]);
/** Opacity beats scale to the finish, so the element is READ before it settles. */
const popOpacity = (t: number) => clamp01(t / 0.55);
/**
 * DF-7 fix. `popOpacity` saturates at 55% of the window and `popScale`'s last
 * leg is a sub-pixel settle, so a 9-frame ENTER measured as a 4-frame (133ms)
 * INSTANT POP on rule 2 and rule 3 — the round-2 overcorrection. The three
 * keywords are the beat's headline moments, so they get an opacity ramp that
 * spans the window.
 *
 * ROUND-4 (SYNC-2): the grader still measured rule two's entrance at 5 frames
 * (167ms), one under the floor. The scene authors in ITS OWN frames and the
 * scheduler rescales them by ramp/nominal, which for `rule2_draw` is 133/148 =
 * 0.899 — so a 9-frame author is 8.09 rendered frames and the 0.9 cutoff took
 * the visible part to 7.3. The cutoff moves to 0.95, which puts all three
 * keywords at 7.7-8.8 RENDERED frames (257-293ms): over the 6-frame floor on
 * the shortest step, still inside the 300ms ceiling on the longest.
 */
const keyOpacity = (t: number) => clamp01(t / 0.95);
/** The keyword entrance window. Top of the 6-9f band; see keyOpacity. */
const KEY_ENTER = clampEntranceFrames(9);

const mix = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

// ---------------------------------------------------------------------------
// Geometry. Page coordinates in the 1920x1080 frame, every one checked against
// the 6% safe margin: x in [115, 1805], y in [65, 1015].
//
// TYPE FLOOR (phase-1 scale in components/theme.ts): 40px of CAP HEIGHT, i.e.
// 58px sans / 56px mono font-size. The previous pass ran everything at a
// hand-picked 40-54px FONT size, which is 28-38px of cap — the whole scene was
// under the floor. Raising to the tokens forced two structural consequences,
// because 40px of cap is roughly 40% wider per string than what was here:
//
//   1. THE PER-ROW VERBATIM FRAGMENTS MOVED OUT OF THE ROWS. At the mono floor
//      rule three's fragment is 1411px wide, so it would run from x 250 to
//      1661 — straight through the AoS/SoA diagram, whose geometry is verified
//      and off-limits. Splitting it across two lines made a row 246px tall and
//      three of those don't fit above the sweep strip. So the source is now
//      quoted ONCE, whole and exact, as a framed pull-quote in the right
//      column while it is empty (beat-local 150-516, cells land at 530) — the
//      narration is literally "his prescription is three lines long, and
//      honestly I'd frame 'em". Nothing is paraphrased; more of the source is
//      legible than before, for longer, and at a readable size.
//   2. Keys, notes and the closing block were re-measured string by string
//      against the columns (every width is written beside its element below).
//      Where a string could not fit at the floor it was SHORTENED, never
//      shrunk — that is the scale's own rule.
//
// COLUMNS. Left column owns x < 940 in every y band it shares with the right
// column; the right column starts at DIAG_X 940 and ends by the 1805 safe
// edge. Advances used: sans 58 ~ 29px/char, sans 76 bold ~ 42px/char, mono 56
// = 33.6px/char exactly.
// ---------------------------------------------------------------------------

/* -- ROUND-12, D2. THE OPENING QUESTION (rule1_draw local 0-146) -----------
 * THE MEASURED DEFECT: abs 14891-15037 (4.87s) was "two outlined panels with
 * zero content" — the worst static frame in the render. Both halves of that
 * sentence were true and they had the same cause: the beat opened by wiping in
 * its FURNITURE and waiting for words to fill it.
 *
 *   plateTop   arrived local  30 (abs 14885) — backing for a headline that had
 *              already been on screen since local 0
 *   plateBody  arrived local  78 (abs 14935) — 792 x 650 of black holding one
 *              4px spine until the first numeral at local 185 (abs 15048).
 *              113 frames = 3.8s of empty container. (ROUND-14: the numerals
 *              are gone too; the plate now arrives at 200 and the first thing
 *              inside it is a whole rule.)
 *   plateQuote arrived local 140 (abs 15000) — 888 x 660 of black holding
 *              nothing until quote line 0 at local 174 (abs 15036)
 *
 * AND THE HEADLINE WAS 150 FRAMES EARLY. `head` fired at local 0 (abs 14853)
 * but "Stroustrup's" is not spoken until abs ~15003 — five seconds of a title
 * card nobody is talking about, which is house rule 5 (nothing decorative) as
 * well as the reason the panels had to stand around waiting.
 *
 * THE FIX IS TO GIVE THE OPENING ITS OWN WORDS. The narration there is a
 * question — "so what do you actually do about any of this on Monday morning?"
 * — and a question is content. It plays as three marker-highlighted phrases
 * that wipe on with their own clauses, in a register (big type, full-bleed, no
 * card) that deliberately contrasts with the calm checklist that replaces it:
 * PLAYBOOK variety rule 6, keyword moment -> diagram breathes. Then the whole
 * question un-wipes and the header, the column and the quote each arrive WITH
 * their content, never before it.
 *
 * INK, against the gate (areaPct x 6 / dur >= 2.0, |dY| >= 25):
 *   row 0  1148 x 118 = 135,464px = 6.53%  / 14f -> 2.80
 *   row 1   770 x 118 =  90,860px = 4.38%  / 12f -> 2.19
 *   row 2   812 x 118 =  95,816px = 4.62%  / 12f -> 2.31
 *   out    all three   = 322,140px = 15.53% / 12f -> 7.77
 * These are OPAQUE TOKEN FILLS, not translucent structure: theme.ink is Rec.601
 * luma 236 and theme.warm is 175, arriving over scrimmed b-roll at ~30, so the
 * deltas are 206 and 145 — 8x and 5.8x the 25-luma gate, and both clear the
 * luma-110 lit floor outright. (This is the recurring bug class inverted: a
 * hairline/stroke region at luma 53-90 lights NOTHING and this scene has been
 * bitten by it four times. Nothing here is drawn in stroke.)
 *
 * MEAN-LUMA COST, because this beat has to stay inside the episode's 20-42
 * band: 15.53% of frame lit at ~215 mean is +29 luma, but only while all three
 * rows coexist (local 112-134, ~23 frames). Across the beat's 1271 frames that
 * is +0.9 on the mean.
 *
 * TYPE AND BOUNDS. TYPE.headline is 76px/700, ~42px per character in this face
 * (the advance this file measures everywhere else). Widths are measured, not
 * guessed, and every row is inside the 6% safe margin (x 115-1805, y 65-1015):
 *   "so what do you actually do" 26ch = 1092 -> slab 1148, x  150-1298
 *   "about any of this"          17ch =  714 -> slab  770, x  210-980
 *   "on Monday morning?"         18ch =  756 -> slab  812, x  270-1082
 * Rows sit at y 330-448 / 468-586 / 606-724, all clear of plateTop (ends 256)
 * and of plateBody, which ROUND-14 moved to local 200 — eight frames after the
 * last of the three staggered retires has finished.
 *
 * CONTRAST. theme.bg on theme.ink is 17.0:1 and on theme.warm 10.8:1. The
 * inverse (ink type on a lit bed) would have been 3.5:1 at this luma, which is
 * exactly the trade the CONTRAST FLOOR block above refuses to make.
 */
const Q_ROW_H = 118;
const Q_PAD_X = 28;
const Q_ROWS = [
  { text: "so what do you actually do", x: 150, y: 330, w: 1148, warm: false },
  { text: "about any of this", x: 210, y: 468, w: 770, warm: false },
  { text: "on Monday morning?", x: 270, y: 606, w: 812, warm: true },
];

/* -- ROUND-12. THE HEADER CARD, drawn WITH its own text --------------------
 * Same rect as the old `plateTop` (x 116-908, y 36-256) but the wrapper is
 * 1180 wide because the headline is 25ch x 42 = 1050 and legitimately overruns
 * the plate onto scrimmed b-roll at 11.3:1 — clipping the wrapper to the plate
 * would have cropped the last five characters off "prescription".
 * The plate alone is 792 x 220 = 174,240px = 8.39% of frame; 8.39 x 6 / 14 =
 * 3.60. It is a black plate over b-roll, so the delta is the ~39-level plate
 * drop rather than a lit step — that is the same mechanism the other five
 * plates in this scene already measure on, and it is the reason this one is
 * paired with the headline rather than left to carry the moment alone. */
const HEADCARD = { x: 116, y: 36, w: 1180, h: 220, plateW: 792 } as const;

const HEAD_X = 150;
const SPINE_X = 150;
const SPINE_TOP = 276;
const SPINE_BOTTOM = 902;

const NUM_X = 168;
const KEY_X = 250;
/** Full length of a rule's baseline: 168 + 600 = 768, clear of the diagram
 *  column at 940. */
const RULE_W = 600;
/**
 * ROUND-14 / D1. The per-row wrapper. Every part of a rule — numeral,
 * baseline, key and note — is a child of this box, so the box's own clip is
 * the only thing that can make any of them visible and an empty numbered row
 * is structurally impossible rather than merely un-scheduled.
 *
 * Sized to contain the row's widest and tallest children with margin:
 *   x  160 -> 920   (numeral at 168, key at 250 running to at most 887)
 *   y  ROW_Y - 24, 190 tall  ->  276-466 / 496-686 / 716-906
 * Rows do not overlap (pitch 220 vs height 190) and row three's bottom edge
 * lands exactly on plateBody's 906.
 */
const ROW_BOX_X = 160;
const ROW_BOX_W = 760;
const ROW_BOX_DY = -24;
const ROW_BOX_H = 190;
/**
 * ROUND-7. Was [258, 440, 622] on a 182px pitch, which bottomed the checklist
 * out at y 772 and left the frame's bottom quarter empty for the whole beat —
 * the "content crammed up top, dead lower half" the grader flagged inside the
 * 15152-15307 hold. 220px pitch starting at 300 puts the rows at 290-450 /
 * 510-670 / 730-890, so the list uses the height it is given and the 784x186
 * active-row band (14.1% of frame, the beat's biggest recurring delta) travels
 * 220px per rule instead of 182. The strip and its label follow it down; see
 * STRIP_Y. 890 + the band's 12px overhang = 902, still 113px clear of the
 * 1015 safe edge, which is where the sweep label ends.
 */
const ROW_Y = [300, 520, 740];
/** Row internals, as offsets from ROW_Y[i]. Every one is checked above. */
const KEY_DY = -10; // key   y-10 .. y+66  (headline 76)
const BASE_DY = 78; // baseline rule
const NOTE_DY = 92; // note  y+92 .. y+150 (label 58)

// -- the sweep strip that rule 3 gets, under its own baseline --
const STRIP_X = 250;
/** Follows the checklist down (ROW_Y): row three's note bottoms at 890, so the
 *  strip sits at 916-940 and its caption at 952-1010, three px inside the
 *  safe edge. The docked cells travel further now, which reads as more of a
 *  journey, not less. */
const STRIP_Y = 916;
const SWEEP_LABEL_Y = 952;
const STRIP_SLOTS = 16;
const STRIP_CELL = 24;
const STRIP_PITCH = 30; // 16 slots -> x 250-724

/* -- rule one's cache-residency proof (ROUND-7) ----------------------------
 * "smaller data means more of it fits in cache" — the SAME 64 bytes holding
 * four fat records, then twelve compact ones. Round 6 tried to say this with
 * six 34px chips wedged between the keyword and the 940 column edge: 6,936px,
 * 0.33% of frame, i.e. detectable and invisible — and it was scheduled past
 * its own step's nominal so it never rendered at all (see the ROUND-7 note in
 * the timing header).
 *
 * It moves to the band under the pull-quote, x 924-1763 / y 900-1000, which is
 * dead for the entire first half of the beat, and goes to diagram scale:
 *   fat      4 x 194 x 100 = 77,600px = 3.74% of frame
 *   compact 12 x  58 x 100 = 69,600px, arriving as one 839 x 100 masked row
 *                          = 83,900px = 4.04% of frame
 * Both rows are 839px wide to the pixel (4x194 + 3x21 = 12x58 + 11x13), which
 * is the claim: the byte budget did not change, only how many records fit in
 * it. Everything here clears REVEAL_INK_MIN_PX (31,100) by more than 2x. */
const REC_X = 924;
const REC_Y = 900;
const REC_H = 100;
const REC_ROW_W = 839;
const FAT_N = 4;
const FAT_W = 194;
const FAT_PITCH = 215; // 924 + 3x215 + 194 = 1763
const COMPACT_N = 12;
const COMPACT_W = 58;
const COMPACT_GAP = 13; // 12x58 + 11x13 = 839
/** The opaque plate under both rows. 888 x 124 = 110,112px = 5.31% of frame —
 *  it is the window's first large event as well as the readability backing. */
const REC_PLATE = { x: 912, y: 890, w: 888, h: 124 } as const;

// -- the AoS/SoA diagram. 56px cells so a 40px field glyph fits inside one. --
const DIAG_X = 940;
const CELL = 56;
const PITCH = 62;
/** Visible break between structs — without it the AoS row reads as a flat array. */
const GROUP_GAP = 14;
const FIELDS = 3;
const STRUCTS = 4;
const N_CELLS = FIELDS * STRUCTS; // 12; AoS row ends at x 1720
const AOS_Y = 420;
const SOA_X = 1000; // leaves 60px for the x/y/z row labels at DIAG_X
const SOA_Y = 340;
const SOA_ROW_PITCH = 76; // rows at 340 / 416 / 492, deepest cell bottom 548
const LABEL_Y = 236;
/** Below the deepest SoA row (548) so the caption never has to cross the cells
 *  mid-morph — a line of text sliding through twelve moving rectangles reads
 *  as a collision, not as a transform. It stays put; only its last word moves. */
/* -- THE PROOF BAND (ND-3) -------------------------------------------------
 * y 890-1012 under the closing block, x 940-1786. Dead for the whole beat
 * before round 4, which is house rule 7's "dead half" on its own. The wrapped
 * `pointer-heavy` row's second line ends at y 864, so the band starts at 890;
 * the lowest scattered cell bottoms out at 1012, three px inside the 1015
 * safe edge. Both groups are hand-placed and deterministic — never random. */
const PROOF_X = DIAG_X;
const DEF_CELLS = 15;
const DEF_CELL = 48;
const DEF_PITCH = 57; // 940 + 14x57 + 48 = 1786
const DEF_Y = 890;
const PTR_CELL = 44;
const PTR_Y = 956;
/** Irregular gaps ARE the point: a pointer chase does not walk in stride. */
const PTR_DX = [0, 110, 192, 336, 420, 568, 682, 802]; // 940 + 802 + 44 = 1786
const PTR_DY = [0, 10, -8, 6, -4, 12, 2, -6]; // y 948-1012

const ANNOT_Y = 570; // label 58 -> y 570-628
const LOOP_Y = 640; // mono 56, 24ch -> x 940-1746, y 640-696

/* -- ROUND-9. "ARRAYS IN STRUCTS", WRITTEN OUT (aos_soa_morph local 194-212)
 * THE MEASURED DEFECT: abs 15537-15632 (3.20s) is the tail of `aos_soa_morph`
 * and graded dead — median inter-frame ink 0.000%, peak over any 6-frame window
 * 1.53% against a 2.0% gate, and yet 39% of its frames show SOME motion. That
 * combination is diagnostic: things are happening and none of them is big
 * enough to count. Everything authored into that stretch is type or hairline.
 * Measured as BOXES, which flatters them — actual glyph ink is a third of this:
 *   `wordSwap`   "apart" -> "together", label 58, 232 x 58 =  13,456px = 0.65%
 *   `rowTagAt`   one mono-56 glyph each,  33.6 x 56 =          1,882px = 0.09%
 *   `bracket`    242 x 2 bar + two 2 x 10 legs =                 524px = 0.03%
 * Against a 2.0%-per-6-frame gate, the largest of them is a third of an event
 * and the smallest is a sixtieth. The script's own instruction is the root
 * cause: the morph is specified as "tiny ... small, secondary", and a tiny
 * secondary diagram cannot carry 8.5 seconds by itself.
 *
 * WHAT THE WORDS SAY THERE. Estimating off the two bracketing marks (`rule2`
 * "keep" at 15316, `rule3` "access" at 15644 — timing.json carries no
 * word-level marks inside a beat, only these three) there are 30 words plus one
 * `/` pause across 328 frames, i.e. ~9.8 f/word with a ~25f pause before
 * "Three": "storing" ~15532, "structs" ~15541, "in" ~15551, "arrays" ~15561,
 * "or" ~15571, "arrays" ~15581, "in" ~15590, "structs" ~15600. So the back half
 * of the window is literally the phrase "arrays in structs" — and the thing
 * that phrase names has never been shown as SOURCE anywhere in the episode.
 * The diagram above is the memory picture; the argument people actually have is
 * about the declaration. Writing it out is the literal visual (never a
 * metaphor) and it is narrated to the frame.
 *
 * WHY A LIT PANEL AND NOT MORE TYPE. The detector pools 8x8 at 240x135 and
 * gates on |dLuma| >= 25 over >= 2% of frame per 6-frame window, so only
 * CONTIGUOUS FILL registers. The bed is the event, the code is the content:
 *   bed   850 x 212 = 180,200px = 8.69% of frame
 *   wipe  18 frames  ->  8.69 x 6 / 18 = 2.90  (gate is 2.0)
 * and because the wipe eases OUT, its first 6 frames carry ~66% of the width
 * (5.7% of frame in one window), so the margin is larger than the linear figure.
 * Delta is the 87-level IDLE_FILL step, NOT the ~36-level b-roll-to-plate step:
 * this band sits below plateDiag (which ends at y 720) on scrimmed footage that
 * is already near luma 8 at the frame edge, and round 8 proved that a ~20-level
 * change is invisible to the detector and to the eye alike.
 *
 * GEOMETRY. x 932-1798 / y 740-968 — the whole lower right column, which is
 * empty black for the entire step (plateDiag stops at 720, LOOP_Y's line bottoms
 * at 696) and is not claimed again until `hold_list`'s PracticeRow at y 746.
 * ROUND-13, D2: the panel now leaves on `declOut` (rule3_draw local 0-8 =
 * abs 15629-15637), NOT on `rightExit` — it is rule TWO's argument and had been
 * parked here with nothing left to say since 15593. RULE3_CARD takes the same
 * footprint four frames later. Either way it is long gone before `hold_list`'s
 * PracticeRow at y 746. 968 is 47px inside the 1015 safe edge, 1798 inside 1805.
 *
 * TYPE. Mono 56 = the 40px cap floor exactly, 33.6px/char. Widths measured, not
 * guessed: line 2 is 23 chars = 772.8px and is indented one character (33.6),
 * so it runs x 1002-1775 — 15px inside the bed's own right edge and 30px inside
 * the safe margin. theme.ink on IDLE_FILL is 6.0:1 (see the ROUND-8/D1 block
 * above); theme.dim, which the loop line uses on black, would be 2.18:1 here and
 * is not an option on a lit bed.
 *
 * GRAMMAR. Mask wipe — the beat's existing large-event grammar (`Plate`,
 * `defRowWipe`, the struct bars) and NOT a spring pop, because the register for
 * this beat is "nothing pops; this beat breathes". It is also not the same
 * grammar as the two entrances either side of it (`rowTagAt` docks, `bracket`
 * draws on), so nothing repeats three times in a row.
 */
const DECL_PLATE = { x: 932, y: 740, w: 866, h: 228 } as const;
/** Inset 8px inside the plate on every edge — the plate is the readability
 *  backing, the bed is the measurable event. 850 x 212 = 180,200px = 8.69%. */
const DECL_BED = { x: 940, y: 748, w: 850, h: 212 } as const;
const DECL_TEXT_X = 968; // 28px of padding inside the bed's left edge
const DECL_INDENT = 34; // one mono-56 character (33.6), rounded
const DECL_TOP = 762;
/** 66, not 56: 3 lines x 66 = 198 and the deepest glyph box bottoms at 950,
 *  10px above the bed's bottom edge at 960. */
const DECL_LINE_H = 66;
/** The SoA declaration for the block that is on screen, exact and compilable.
 *  `indent` is in mono characters. Longest line is 23ch — see TYPE above. */
const DECL_LINES: { text: string; indent: number }[] = [
  { text: "struct Pts {", indent: 0 }, // 12ch = 403px, x 968-1371
  { text: "float x[N], y[N], z[N];", indent: 1 }, // 23ch = 773px, x 1002-1775
  { text: "};", indent: 0 }, // 2ch = 67px
];

/**
 * PULL-QUOTE — the source, whole and exact, but STAGED ONE RULE AT A TIME.
 *
 * ROUND-13, D2. THE MEASURED DEFECT: the whole six-line prescription wiped on
 * as ONE card at abs 15063-15093, which spoiled every rule the narrator had not
 * reached yet. The grader measured it against the beat's three marks:
 *
 *   `rules` @ 15150   quote already fully present ~2000ms early
 *   `rule2` @ 15316   its text had been legible for 223 frames (-7433 ms)
 *   `rule3` @ 15644   its text had been legible for 551 frames (-18367 ms)
 *
 * -18s is not a sync nudge, it is the beat giving away its own structure: the
 * script's `build` asks for six staged steps and the render collapsed them into
 * one. So the quote is cut into ITS THREE RULES and each one is revealed by its
 * own LINEAR clipPath wipe, opening ~3 frames before the mark that names it.
 * Nothing of rule N is legible before rule N's wipe.
 *
 * WHY RULE THREE IS NOT IN THIS CARD, stated plainly rather than fudged. This
 * column is claimed by `plateDiag` from abs 15382 (the AoS/SoA morph, which is
 * rule two's argument) and by `declPanel` under it from 15575, and both are
 * still up when `rule3` is spoken at 15644 — so the pull-quote CANNOT survive
 * to rule three's word. Holding rules 1-2 on screen for another 270 frames to
 * keep them together would have meant either deleting the diagram or shipping
 * the -18s spoil again. Rule three's two-and-a-half lines therefore leave this
 * card entirely and are quoted, at their own mark, in the panel the SoA
 * declaration vacates — see RULE3_CARD. The verbatim source is complete across
 * the beat; it is just no longer all on screen before it has been read out.
 *
 * SIZE (unchanged from ROUND-7). Mono 80 = `capToFontSize(58, mono)`, a 58px
 * cap and 40px on the 960 proxy the grader reads; at the 56px floor this card
 * came back illegible. 48px/char exactly, so 18 chars is the widest line the
 * 924-1804 column takes.
 *
 * The six strings still concatenate to SOURCE [2] character for character,
 * curly quotes included — the staging moved reveals, never words.
 */
const QUOTE_X = 924;
const QUOTE_TOP = 252;
const QUOTE_LINE_H = 96;
/** 80px. Derived, not hand-picked — see the SIZE note above. */
const QUOTE_FONT = capToFontSize(58, MONO_CAP_RATIO);
/** The widest line, and therefore the rule that draws on above the block. */
const QUOTE_W = 864;
const QUOTE_LINES = [
  "“don’t store data", // 17ch -> 816px, x 924-1740   } rule one
  "unnecessarily,", // 14ch -> 672px                  }
  "keep data compact,", // 18ch -> 864px, x 924-1788 — the widest line; rule two
  "and access memory", // 17ch -> 816px               }
  "in a predictable", // 16ch -> 768px                } rule three, in RULE3_CARD
  "manner.”", // 8ch                                  }
];

/* -- ROUND-13, D2. THE TWO IN-COLUMN RULE CARDS ----------------------------
 * One card per rule, stacked with a 12px gutter so they read as two of a set
 * rather than as one card with a seam in it. Each is a plate + its own lines
 * revealed by ONE linear left-to-right clip — a container is never on screen
 * without its content, and a linear clip is the only reveal shape whose
 * per-frame area is constant (a cubic-out spends 21% of its width on frame one
 * and then falls under the 0.3%-per-frame burst floor).
 *
 * INK, against the authoring gate `areaPct x 6 / durationFrames >= 2.0`. The
 * plate is the same rgba(0,0,0,0.88) as the five other `Plate`s in this scene,
 * so the step is the ~36-level DROP from scrimmed b-roll (~44 centre) to plate
 * (~8): over the 25-luma difference gate, and explicitly NOT a claim about lit
 * area — a black plate lowers lit area by construction.
 *
 *   RULE1_CARD  888 x 268 = 237,984px = 11.477% of frame
 *               authored 12f in `rule1_draw`, whose ramp/nominal is 419/398,
 *               so 12 x 1.0528 = 12.63 RENDERED frames
 *               11.477 x 6 / 12.63 = 5.45
 *   RULE2_CARD  888 x 124 = 110,112px =  5.311% of frame
 *               authored 9f in `rule2_draw`, ramp/nominal 132/148 = 0.8919,
 *               so 9 x 0.8919 = 8.03 RENDERED frames
 *                5.311 x 6 /  8.03 = 3.97
 *
 * BOUNDS. x 912-1800 (5px inside the 1805 safe edge). Rule one's card is
 * y 228-496, rule two's y 508-632; the deepest edge is 258px clear of the
 * record band at 890, which is where rule one's cache proof lands. The 268px
 * height is set by the HIGHLIGHTER, not by the type: QUOTE_HL runs card-local
 * 60-260 and has to be fully inside rule one's own clip or it would paint over
 * rule two's card before rule two's wipe. */
const RULE1_CARD = { x: 912, y: 228, w: 888, h: 268 } as const;
const RULE2_CARD = { x: 912, y: 508, w: 888, h: 124 } as const;
/** Card-local tops for the three in-column lines. Lines 0-1 are rule one's and
 *  sit on QUOTE_TOP + 42 as before; line 2 is rule two's and is measured from
 *  its own card. */
const RULE1_LINE_TOP = [
  QUOTE_TOP + 42 - RULE1_CARD.y, // 66  -> abs 294-390
  QUOTE_TOP + 42 + QUOTE_LINE_H - RULE1_CARD.y, // 162 -> abs 390-486
];
const RULE2_LINE_TOP = 14; // abs 522-618, 14px inside the card's own bottom

/* -- ROUND-13, D2. RULE THREE'S CARD, at rule three's own mark -------------
 * abs 15641 (`rule3_draw` local 12), three frames before `rule3` @ 15644. It
 * takes the footprint the SoA declaration vacates at 15629-15637 (`declOut`),
 * which is the correct hand-off as well as the only free rectangle in the
 * frame at that moment: the declaration is rule TWO's argument ("arrays in
 * structs") and had been parked there until `rightExit` at 15696 with nothing
 * left to say.
 *
 * INK:  866 x 286 = 247,676px = 11.944% of frame; `rule3_draw` runs 1:1
 *       (ramp 74, nominal 74) so 12 authored frames are 12 rendered.
 *       11.944 x 6 / 12 = 5.97      (out: 11.944 x 6 / 14.04 = 5.10)
 * Same plate mechanism and the same honesty about it as the two cards above.
 *
 * TYPE. `capToFontSize(52, mono)` = 72px — a 52px cap, 12 clear of the 40px
 * floor, and 43.2px/char. Derived from the height available, not picked: three
 * lines at a 86px pitch is 258px and the panel has 286. Widths measured:
 * 17ch = 734, 16ch = 691, 8ch = 346, all inside the 794px of text width the
 * card's 36px padding leaves.
 *
 * BOUNDS. x 932-1798 (7px inside the safe edge), y 726-1012 (3px inside it,
 * and 6px below `plateDiag`'s bottom edge at 720 so the two never share a
 * pixel). It leaves at `hold_list` local 0-14 = abs 15751-15765, seven frames
 * before "MY TAKE" claims the column at 15772 — so its whole life, 15641-15751,
 * is exactly the sentence that quotes it. */
const RULE3_CARD = { x: 932, y: 726, w: 866, h: 286 } as const;
const RULE3_FONT = capToFontSize(52, MONO_CAP_RATIO); // 72
const RULE3_LINE_H = 86;
const RULE3_TEXT_DX = 36; // x 968; 734px longest line ends at 1702
const RULE3_TEXT_DY = 18; // card-local 18 / 104 / 190; deepest box bottom 276

/* -- ROUND-12, D7/D9. THE HIGHLIGHTER, and why the cascade had to go --------
 * WHAT WAS THERE: six quote lines wiping on 10 frames apart across local
 * 174-233 — a per-line stagger that reads, and measures, as a typewriter. The
 * scheduling comment claimed "each of them is a 74-83k px block (3.6-4.0% of
 * frame) rather than a line of type". THAT COMMENT IS FALSE and it is the
 * fourth instance of this file's signature error: the BOX is 74-83k px, the
 * INK is mono glyphs at maybe 12-15% coverage, i.e. ~0.5% of frame per line,
 * and a typewriter is not a content event at any threshold. Corrected here.
 *
 * ROUND-12 replaced the cascade with ONE 20-frame wipe of the entire card.
 * ROUND-13 keeps the wipe grammar and splits it per rule (see RULE1_CARD): one
 * wipe is the right event shape, one wipe for all six lines was the -18s spoil.
 *
 * Then the SOURCE is highlighted as the narrator paraphrases it. Rule one is
 * "don't store data you don't need"; the quote's first two lines are literally
 * "don't store data / unnecessarily," — so a marker slab wipes across exactly
 * those two lines and their type inverts to theme.bg. This is a transform of
 * what is already on screen (object constancy), not another card, and it is
 * the only large event available in a stretch where the left column is a
 * keyword and a caption:
 *   slab 856 x 200 = 171,200px = 8.24% of frame
 *   in   8.24 x 6 / 16 = 3.09      out  8.24 x 6 / 12 = 4.12
 *   theme.warm is luma 175 over the card's ~5-luma plate: dY 170, and 175
 *   clears the 110 lit floor. theme.bg on warm is 10.8:1.
 * Bounds: x 916-1772 (33px inside the safe edge, 28 inside the card), y
 * 288-488, which contains line 0 (294-390) and line 1 (390-486) and nothing
 * else. Rel to RULE1_CARD: (4, 60) — and it is a CHILD of that card, so it
 * cannot reach rule two's lines even by arithmetic error. */
const QUOTE_HL = { dx: 4, dy: 60, w: 856, h: 200 } as const;

/** x = accent, y = warm, z = green. Semantic red/ink is reserved for the
 *  apart/together annotation, so no field can be confused with the verdict. */
const FIELD_COLOR = [theme.accent, theme.warm, theme.up];
const FIELD_NAME = ["x", "y", "z"];

const aosX = (i: number) =>
  DIAG_X + i * PITCH + Math.floor(i / FIELDS) * GROUP_GAP;
const soaX = (s: number) => SOA_X + s * PITCH;
const soaY = (f: number) => SOA_Y + f * SOA_ROW_PITCH;
const stripX = (slot: number) => STRIP_X + slot * STRIP_PITCH;
/** Struct-group backing bar: 8px of padding around cells 3s..3s+2. x 932-1728. */
const structBarX = (s: number) => aosX(s * FIELDS) - 8;
const BAR_PAD = 8;
const STRUCT_BAR_W = (FIELDS - 1) * PITCH + CELL + 2 * BAR_PAD; // 196
const BAR_H = CELL + 2 * BAR_PAD; // 72

/* -- ROUND-8, D1. THE BACKING GEOMETRY WAS DRAWN BELOW THE CONTRAST FLOOR ---
 * Every backing bar in this scene was authored as white at alpha 0.10-0.115
 * over the opaque black plates, which composites to luma ~28 against a plate
 * at ~5: a 1.35:1 ratio and a frame-to-frame delta of ~20, one level UNDER the
 * pacing detector's 25-luma gate. That is why beat-local 530-786 measured as
 * two dead windows (abs 15383-15506 and 15507-15633, 8.3s combined) despite
 * carrying eleven authored reveals — the reveals fired, and none of them
 * changed a pixel the detector or the eye could resolve. Round 7 responded by
 * making reveals BIGGER and moved the median event ink 0.80% -> 0.81%, because
 * area was never the deficit.
 *
 * Everything below now draws through `IDLE_FILL` (rgba(255,255,255,0.35),
 * exactly 3.00:1, luma ~92 on a plate = a 87-level delta). See the CONTRAST
 * FLOOR block in components/theme.ts. Text contrast ON these beds was
 * re-derived, not assumed: theme.ink is 6.0:1, SECONDARY is 4.1:1, and
 * `detailDim`'s recede floor moved 0.58 -> 0.75 so a receded note stays at
 * 3.4:1 rather than dropping to 2.7:1 once it sits on a lit bed.
 * ------------------------------------------------------------------------ */

/**
 * SoA row bed. These are the SLOTS THE CELLS FLY INTO, so they arrive during
 * the morph (local 128/140/152) rather than after it — an empty container that
 * then fills is the exact D1 shape, and it puts three 1.94%-of-frame events
 * inside the 15507-15633 window, which previously held only a 12-cell travel
 * whose per-frame delta was a few pixels per cell.
 *
 * x 992-1250 (258 wide) STOPS SHORT of the run-on ellipsis at 1254 and of the
 * `contiguous` label at 1308 — deliberately. IDLE_FILL composites to luma ~89,
 * and theme.dim on that is 2.18:1 while theme.warm is 2.60:1, so any bed that
 * ran under either of them would buy a content event by breaking a readability
 * floor. The bed backs the CELLS only; the annotations stay on black.
 * y soaY(f)-6, h 68 -> 334-402 / 410-478 / 486-554, an 8px gutter between beds
 * so three of them do not composite into one undifferentiated slab, and 6px of
 * padding around each 56px cell. 258 x 68 = 17,544px = 0.85% of frame each,
 * well over the 0.3% detection floor at an 87-level delta.
 */
const ROW_BAND_W = 258;
const ROW_BAND_H = 68;
const ROW_BAND_DY = -6;

/* -- the loop's stride, above the AoS row (ROUND-8) ------------------------
 * `for (p : pts) sum += p.x` lands at local 56-68 and then nothing explained
 * it for sixty frames. This is that line drawn: a bed the width of the whole
 * array with four markers over the four x cells — the loop touches one field
 * in three, which is the entire reason the morph below it is about to happen.
 *
 * It lives ABOVE the cells (y 330-402, under the AoS/SoA rule at 308) because
 * the band below them is owned by the caption at ANNOT_Y 570. It vacates at
 * local 112-122 and the SoA row-0 bed takes that same y band at 128 — the old
 * state is gone before the new one lands, never both.
 * Bed 796 x 72 = 57,312px = 2.76% of frame; it clears REVEAL_INK_MIN_FRACTION
 * on its own, entering AND leaving.
 */
const STRIDE_X = 932;
const STRIDE_Y = 330;
const STRIDE_W = 796; // 932-1728
const STRIDE_H = 72;
const STRIDE_MARK_H = 40;

/* -- the closing settle: the three rules resolving (ROUND-8) ---------------
 * THE LEFT COLUMN WAS FROZEN FOR THE LAST 11.5 SECONDS OF THE BEAT. After
 * `holdDim` at hold_list local 32 the checklist never changed again, which is
 * most of why abs 15938-16122 (6.13s, tied longest in the episode) measured
 * dead — the beat literally died on its last six seconds with the prescription
 * parked on screen.
 *
 * So the checklist RESOLVES through the tail: a bed lights behind each rule in
 * turn (local 248 / 288 / 328) with a tick, and then all three MERGE into one
 * block at 350 — the three lines becoming one prescription. Sizes:
 *   each row bed   784 x 186 = 145,824px = 7.03% of frame
 *   the merge      fills the two 784 x 34 gaps = 53,312px = 2.57%
 * all at a 87-level delta rather than the 20 the old 0.115 band managed.
 *
 * BOUNDS. x 120-904: the longest key ("keep it compact", sans 76 bold, ~42px
 * per char) ends at x 880 and the longest note ends at 801, so nothing spills.
 * y 276-462 / 496-682 / 716-902 — the deepest edge is 113px inside the 1015
 * safe line. The TICK lane at x 836 is right of every note and sits on the
 * note's line (y + 96), so it can never collide with a key.
 *
 * CEILING: hold_list's ramp (380) overruns the beat end by 8 frames, so `p`
 * tops out at 0.976 and the reachable local maximum is 370, NOT the published
 * nominal of 379. The last authored frame here is 366. Nothing in this step
 * may be scheduled past 370 or it is the silent dead code this file shipped in
 * round 6 (see the ROUND-7 note in the timing header).
 */
/**
 * The travelling active-row band's fill. IDLE_FILL (0.35) is the house floor
 * for backing geometry, but this one rectangle travels UNDERNEATH the accent
 * rule baselines, and theme.accent on a 0.35 bed is 2.65:1.
 *
 * Derivation, not a guess. accent #58A6FF has relative luminance 0.3657. For
 * 3:1 the bed must sit at or below (0.3657 + 0.05) / 3 - 0.05 = 0.0886, which
 * back-solves to a composited channel of 84 and, over the black plate at 8,
 * to alpha 0.308. 0.28 takes the margin: composited 77 (L 0.0848), accent
 * 3.08:1, ink 6.6:1, SECONDARY 5.1:1, and a 69-level delta on entry.
 *
 * The settle beds later reuse this exact rectangle at IDLE_FILL instead,
 * because by then the baselines have ramped to theme.ink. The two never
 * coexist — the band leaves at hold_list local 54, the beds arrive at 248.
 */
const BAND_FILL = "rgba(255, 255, 255, 0.28)";

const SETTLE_X = 120;
const SETTLE_W = 784;
const SETTLE_H = 186;
const SETTLE_DY = -24;
/** The gutter between two beds: 520 - 300 - 186 = 34. Beds 0 and 1 grow by
 *  exactly this on `merge`, so 276-462 / 496-682 / 716-902 closes to one
 *  784 x 626 block with no overlap anywhere and therefore no doubled alpha. */
const SETTLE_GAP = ROW_Y[1] - ROW_Y[0] - SETTLE_H; // 34
/** The tick lane, right of every note (row two's is the longest, x 250-801). */
const TICK_X = 836;
const TICK_DY = 96;

/**
 * SOURCE [2], Stroustrup, IEEE Computer, Jan 2012 — quoted verbatim in
 * QUOTE_LINES above, never paraphrased. What sits in the rows is our shorthand
 * and is written to read as shorthand.
 *
 * ROUND-14 / D2. Rule three read "predictable" while the narration says
 * "access memory in a **predictable** pattern" and the script's own treatment
 * lists "3 · predictable access". On-screen text disagreeing with the read is
 * a hard defect, so the key is now the scripted "predictable access" — which
 * does not fit at TYPE.headline's 76px.
 *
 * KEY_FONT, derived not guessed. This face advances ~0.5526 x fontSize per
 * character (the 42px/char at 76 that the rest of this file measures on). The
 * binding constraint is the left column plate's right edge at x 908, and
 * behind it RULE3_CARD / DECL_PLATE at x 932, both live while row three is on
 * screen (abs 15575-15765). From KEY_X 250 the budget is 908 - 250 = 658px for
 * the longest key, 18 characters:
 *     18 x 0.5526 x F <= 658  ->  F <= 66.1
 * 64 takes the margin. Widths at 64 (35.4px/char):
 *   "store less"          10ch = 354 -> x 250-604
 *   "keep it compact"     15ch = 531 -> x 250-781
 *   "predictable access"  18ch = 637 -> x 250-887  (21px inside the plate,
 *                                                   45px clear of the card)
 * Cap height 64 x 0.727 = 46.5px, over the 40px broadcast floor, and 64 clears
 * check_typesize's 55px minimum. Weight and tracking stay TYPE.headline's.
 *
 * Notes at sans 58 (~29px/char): row one ends at 772, row two at 801, row
 * three at 714 — row three's note (ROUND-7: y 832-890) also has to clear the
 * CLOSING BLOCK at x 940, which is why it is four words, not the narration's
 * full clause.
 */
const KEY_FONT = 64;
const RULES = [
  { key: "store less", note: "more fits in cache" },
  { key: "keep it compact", note: "fewer lines touched" },
  { key: "predictable access", note: "sweeps, not hops" },
];

// The clip is 33.4s (1366x720 — already downscaled) and the beat is 42.4s.
// Played straight, OffthreadVideo would park on a frozen last frame for the
// closing nine seconds — a dead texture layer is worse than one loop seam under
// a 0.72 scrim. 990 (not 1001) keeps the decoder off the final frame.
const BROLL_SRC = "ep-cpu-waits-on-memory/broll/7cc767d70c09.mp4";
const BROLL_CLIP_FRAMES = 990;

/* Global scrim. 0.86 -> BRoll's own gradient is 0.705 alpha in the centre and
   0.946 at the edges; the flat sheet on top is what sets the final
   transmission. Source clip mean ~182.

   ROUND-14 / D4. The r13 grade called the scrim across f15100-17100 too
   shallow — the footage was competing with the foreground instead of sitting
   behind it. 0.18 -> 0.32:
     centre  (1-0.705) x (1-0.32) = 0.2006 -> luma 36.5  (was 0.2419 -> 44.0)
     edge    (1-0.946) x (1-0.32) = 0.0367 -> luma  6.7  (was 8.1)
   i.e. 17% less light through, and the footage still MOVES (the hand carries
   5-14 luma of frame-to-frame delta at 0.242; ~4-12 at 0.201), which is what
   round 4's 0.95 + 0.5 destroyed.

   WHY NOT DEEPER, measured. Five of this beat's reveals are black `Plate`
   mask-wipes (rgba(0,0,0,0.88)), and a black plate is only an event via the
   b-roll-to-plate luma DROP: delta = 0.88 x brollLuma, so the 25-luma
   content-event gate needs brollLuma >= 28.4 under the plate. At 0.32 the
   plate's central band drops 36.5 -> 4.4 = 32.1 and clears it; at 0.40 the
   centre is 30.6 -> 3.7 = 26.9 and everything off-centre falls under 25, i.e.
   plateBody (24.83% of frame) would silently stop counting. This is why the
   deepening is paired with real LIT foreground in the same window — the
   staggered question retire, the white BAND_FILL row band and the three rule
   rows below, all at luma 73-236, none of which depend on the b-roll at all.
   No LIT cost: the footage is under 110 at either setting. */
const PLATE_BROLL_DIM = 0.86;
const PLATE_FLAT_SCRIM = 0.32;

/* -- ROUND-11, D5. THE TEXTURE LAYER WAS BIT-FROZEN 40% OF THE TIME --------
 * The r10 grade reported "scripted b-roll missing" for this beat. It is NOT
 * missing — assets.json resolves `three_rules.broll` to the clip below, it is
 * mounted at the bottom of this scene, and the desk footage is visible in the
 * render. But the MEASUREMENT under that wrong diagnosis is real: 508 of the
 * beat's 1270 frames are BIT-IDENTICAL to their predecessor, the worst frozen
 * share in the episode.
 *
 * WHY, and why "lighten the scrim" is the wrong lever. Two causes stack:
 *   (a) STRUCTURAL, 16.7%. The clip is 25fps in a 30fps composition, so the
 *       source frame index is floor(5f/6) and one composition frame in six
 *       repeats its predecessor's source frame exactly. Nothing can be done
 *       about that by grading the scrim; it is a resampling fact.
 *   (b) QUANTISATION, the other ~23%. Where the footage is exposed at all it
 *       is at the frame EDGES (the opaque plates below cover 66-71% of the
 *       frame, all of it central), and the radial scrim is at its strongest
 *       there: BRoll's own gradient reaches alpha 0.946 at 100%, and the flat
 *       0.18 sheet on top leaves ~5-8% of the source surviving in exactly the
 *       regions that are not plated. A quiet 10-luma inter-frame change in the
 *       source arrives as 0.5-0.8 luma of output and ROUNDS TO ZERO in 8-bit.
 *
 * SO THE FIX IS MOTION, NOT BRIGHTNESS. Round 4 already tried the brightness
 * axis in the other direction (dim 0.95 + a flat 0.5 sheet -> ~11% survival,
 * zero delta, 57.2% frozen) and round 5 inverted it back to the 0.86 + 0.18
 * above, buying readability locally with the opaque plates instead. Those two
 * numbers are the settled second iteration of that trade-off and they DO NOT
 * MOVE here: lightening regresses the readability the plates were introduced
 * to fix, and the beat's mean luma has to stay inside the episode's 20-42 band.
 *
 * Instead the whole texture layer gets a slow CIRCULAR drift. A pan changes
 * WHICH SOURCE PIXELS LAND IN WHICH OUTPUT PIXELS every frame, so the output
 * delta stops depending on the subject moving — and it defeats cause (a) too,
 * because a repeated source frame sampled at a different offset is still a
 * different output frame. Circular and not sinusoidal because a sine's
 * velocity passes through zero at each extreme, which would re-freeze the
 * layer for a few frames twice per period; with R_x = R_y the speed of
 * (R cos wf, R sin wf) is the constant R*w.
 *
 *   speed  = 70 * 2pi/200 = 2.20 px/frame
 *   output delta = 2.20px * (local source gradient) * (scrim survival)
 *   in the exposed EDGE regions (survival ~0.084, textured gradient ~25
 *   luma/px after the ~1.6x total upscale) that is 2.20*25*0.084 = 4.6 luma,
 *   i.e. 4-5 LSBs, against the ~0.6 the subject's own motion was delivering.
 *   Even a near-smooth patch (gradient 5) yields 0.9 and rounds to 1.
 *
 * AND IT CANNOT FAKE A CONTENT EVENT. The pacing detector box-pools 8x8 before
 * thresholding at |dLuma| >= 25. A 2.20px shift inside an 8px pool moves at
 * most 2.20/8 = 27.5% of the pool's own luma RANGE, and the scrimmed footage's
 * full range is ~36 luma (centre 44 down to edge 8), so the pooled delta is
 * bounded by 0.275 * 36 = 9.9 — comfortably under the 25 gate everywhere. The
 * drift restores "the screen is never static" without polluting the event
 * count, which is exactly the register b-roll is supposed to occupy.
 *
 * COVER SCALE. The transform is on a wrapper at inset:0, so translating it
 * would expose the frame edge. 1.15 covers (0.15*1080)/2 = 81px vertically and
 * (0.15*1920)/2 = 144px horizontally, both >= the 70px excursion. Side effect,
 * accounted for: scaling the wrapper also scales BRoll's own radial scrim, so
 * the frame corners now sample it at ~92% of its former relative radius —
 * alpha 0.926 instead of 0.946, survival 7.4% instead of 5.4%, corner luma ~11
 * instead of ~8. Over the ~30% of frame that is not plated (and it is the
 * darker 30%) that is under +1 luma on the beat mean, which stays inside 20-42.
 */
const BROLL_DRIFT_R = 70;
const BROLL_DRIFT_PERIOD = 200; // frames; 6.67s per revolution
const BROLL_DRIFT_COVER = 1.15;

/** Opaque mask-wipe plate. `t` is 0..1 entrance progress; `dir` picks the wipe
 *  axis so consecutive plates don't share a grammar. Purely presentational and
 *  always behind scene content. */
const Plate: React.FC<{
  t: number;
  x: number;
  y: number;
  w: number;
  h: number;
  dir: "down" | "right";
}> = ({ t, x, y, w, h, dir }) => {
  const c = clamp01(t);
  if (c <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 14,
        background: "rgba(0, 0, 0, 0.88)",
        clipPath:
          dir === "down"
            ? `inset(0 0 ${(1 - c) * 100}% 0)`
            : `inset(0 ${(1 - c) * 100}% 0 0)`,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * Beat 13 — the fix, in three lines.
 *
 * The whole episode has been diagnosis; this is the only beat that prescribes,
 * so the structure is deliberately plain: a checklist that builds one line at a
 * time and never moves again. Everything else in the frame is subordinate to
 * it.
 *
 * The right column carries the one thing a checklist can't teach. "Storing
 * structs in arrays, or arrays in structs" is a layout, and a layout has to be
 * SEEN changing — so the same twelve cells that draw on as an array-of-structs
 * physically travel into a struct-of-arrays, keeping object constancy the whole
 * way. No cells are added, none are removed; the argument is that it's the same
 * bytes in a different order, and the animation has to be able to survive that
 * claim frame by frame.
 *
 * Then the payoff chains: the x row of that SoA block doesn't vanish when rule
 * three arrives — it docks down under rule three's own baseline and becomes the
 * strip the prefetcher sweeps. Rule two's fix is literally what rule three
 * walks over.
 *
 * THIS SCENE PAINTS NO BACKGROUND. Episode005 mounts one global
 * AmbientBackground behind every beat; an `AbsoluteFill` of theme.bg (pure
 * black) inside a scene occludes it and the frame measures dead black. Scenes
 * are transparent layers.
 */
export const ThreeRules: React.FC<ThreeRulesProps> = ({ p, frame = 0 }) => {
  /* ---- rule1_draw | 398f | beat-local 0-398 ------------------------------
   * "Alright — so what do you actually do about any of this on Monday morning?
   * [smile] Stroustrup's prescription is three lines long, and honestly I'd
   * frame 'em. / One: don't store data you don't **need** — smaller data means
   * more of it fits in cache."
   *
   * THE WORD MAP THIS STEP IS AUTHORED AGAINST (ROUND-12). timing.json carries
   * exactly one mark inside this step — `rules`, the word "don't", at abs 15150
   * = beat-local 282 — so everything else is placed off the rate that mark
   * implies. 26 words plus a ~10f sentence break and a ~25f `/` across the 297
   * abs frames from 14853 to 15150 is 10.1 abs frames per word, and this step's
   * ramp is 419 over a nominal of 398, so one abs frame is 0.950 local frames:
   *
   *     local   0 Alright    10 so       19 what      29 do      38 you
   *            48 actually   58 do       67 about     77 any     86 of
   *            96 this      105 on      115 Monday   125 morning?
   *           142 Stroustrup's         152 prescription        162 is
   *           171 three     181 lines  190 long     200 and    209 honestly
   *           219 I'd       228 frame  238 'em      [ / pause ]  271 One:
   *           282 don't  <- MARK `rules`, abs 15150
   *           291 store    301 data    310 you      320 don't   330 need
   *           347 smaller  357 data    366 means    376 more    395 it
   *           404 fits     423 cache
   *
   * Every reveal below names the word it lands on and every one lands ON or
   * BEFORE it. Nothing in this step is scheduled against a word that isn't
   * being spoken — which is what the old `head` at local 0 was doing (see the
   * ROUND-12 D2 block by Q_ROWS).
   *
   * EVENT LADDER, in absolute frames, with the longest gap named. The r11
   * grade reported three defects across this step; all three are gaps in this
   * ladder, so the ladder is the fix and the table is the proof:
   *
   * ROUND-14 rebuilt the middle of this ladder. abs = 14853 + local x 419/398.
   *
   *   local   abs          what                              area   /dur -> n
   *      0  14853-14868  question row 0 wipes on             6.53%  /14 -> 2.80
   *     62  14918-14931  question row 1 wipes on             4.38%  /12 -> 2.19
   *    100  14958-14971  question row 2 wipes on (warm)      4.62%  /12 -> 2.31
   *    134  14994-15000  question row 0 un-wipes             6.53%  /6  -> 6.53
   *    140  15000-15015  header card + headline + attrib     8.39%  /14 -> 3.60
   *    160  15021-15028  question row 1 un-wipes             4.38%  /6  -> 4.38
   *    186  15049-15055  question row 2 un-wipes             4.62%  /6  -> 4.62
   *    200  15064-15080  the column wipes down              24.83%  /16 -> 9.31
   *    216  15080-15099  the spine draws                     (thin)
   *    258  15125-15131  rule one's row band lights          7.03%  /6  -> 7.03
   *    272  15139-15153  ROW ONE arrives whole (D1)          (type)
   *    279  15147-15159  rule ONE's card + its two lines    11.48%  /12.6-> 5.45
   *    280  15148-15157  key1 "store less"                   (type)
   *    310  15179-15196  the source highlights                8.24% /16 -> 3.09
   *    358  15230-15243  the highlight leaves                 8.24% /12 -> 4.12
   *    370  15243-15252  cachePlate                           5.31% /9  -> 3.54
   *    380  15253-15272  four fat records                     3.74% /9  -> 2.49
   *
   * Longest gap between MEASURED events (the "(type)" and "(thin)" rows are
   * deliberately not counted — a mono glyph is ~0.02% of frame and a 4px spine
   * pools to half a proxy pixel): abs 15099 -> 15125 = 26 frames = 0.87s.
   * Then 15080->15099 (0.63s) and 15055->15064 (0.30s). Nothing in this step
   * holds for as much as one second, where the r13 arrangement leant on two
   * 0.000% elements to bridge 80 frames.
   *
   * WHAT THIS REPLACES, and why each one was dead:
   *   `head` local 0      — 150 frames before its own word (see above)
   *   `attrib` local 28   — same, and a 20px dock is not an event
   *   `quoteRule`         — 864 x 3 in theme.stroke. Stroke is luma 90 and 3px
   *                         pools to 0.375 proxy px: 0.000% lit, ~0% delta.
   *                         Folded into the card wipe; kept as ornament only.
   *   `quoteLineAt` x6    — the typewriter. See the QUOTE_HL block.
   *   `numeralAt`/`stubAt`/`arm1..3`  — DELETED IN ROUND-14. They armed all
   *                         three rows at abs 15026-15065 and then waited up
   *                         to 590 frames for their content: the r13 grade
   *                         called f15100-15147 a loading skeleton and it was
   *                         right. Rows now arrive whole; see the three-rules
   *                         JSX block and `rowIn`.
   */
  /* THE OPENING QUESTION. Three marker-highlighted phrases, each on its own
     clause; see the ROUND-12 D2 block by Q_ROWS for ink, luma and bounds. */
  const qRow0 = linSub(p.rule1_draw, "rule1_draw", 0, 14); // "so"@10 "what"@19
  const qRow1 = linSub(p.rule1_draw, "rule1_draw", 62, 12); // "about"@67
  const qRow2 = linSub(p.rule1_draw, "rule1_draw", 100, 12); // "on"@105
  /** The question leaves by clip un-wipe, never by opacity — multiplying a
   *  layer by (1-t) drops every theme.ink element under luma 110 as the alpha
   *  crosses ~0.46, and the retire stops registering at all (the "retire
   *  cliff", found three times in this codebase).
   *
   *  ROUND-14 / D1. It now leaves in THREE staggered un-wipes rather than one.
   *  Deleting the pre-armed numerals and stubs (see below) vacated abs
   *  15038-15147; splitting the retire and pushing the column wipe back fills
   *  it with three real deltas instead of one. Each slab is opaque ink 236 or
   *  warm 175 going to scrimmed b-roll at ~30, so the luma step is 145-206
   *  against a 25 gate, and the areas are the Q_ROWS widths x Q_ROW_H 118:
   *    qOut0  1148 x 118 = 135,464px = 6.53% / 6f = 1.088 %/f  -> MAJOR
   *    qOut1   770 x 118 =  90,860px = 4.38% / 6f = 0.730 %/f
   *    qOut2   812 x 118 =  95,816px = 4.62% / 6f = 0.770 %/f
   *  at local 134 / 160 / 186 = abs 14994 / 15022 / 15049, i.e. one event
   *  every ~27 frames across the clause break. */
  const qOut0 = linSub(p.rule1_draw, "rule1_draw", 134, 6); // after "morning?"
  const qOut1 = linSub(p.rule1_draw, "rule1_draw", 160, 6);
  const qOut2 = linSub(p.rule1_draw, "rule1_draw", 186, 6);
  const qOutAt = [qOut0, qOut1, qOut2];
  const qGone = Math.min(qOut0, qOut1, qOut2);
  /** Header card: plate, headline and attribution revealed by ONE downward
   *  wipe. A container is never on screen without its content. */
  const headIn = linSub(p.rule1_draw, "rule1_draw", 140, 14); // "Stroustrup's"@142
  /** The checklist column's spine. ROUND-14: moved 158 -> 216 so it arrives
   *  with plateBody (200) rather than 42 frames of black plate ahead of the
   *  spine, and so the pair covers the window the stubs used to occupy. */
  const spine = linSub(p.rule1_draw, "rule1_draw", 216, 18);
  /* ROUND-14 / D1 — THE SKELETON-LOADER FIX. `numeralAt` and `stubAt` are
     GONE, and with them `arm1..3`.
       Old: numerals at local 164/176/188 and stubs at 168/180/192 armed ALL
       THREE rows at abs 15026 / 15038 / 15051, while the rows' actual content
       landed at abs 15148 (key1), 15314 (key2) and 15586 (key3). Row two was
       therefore a numbered container with nothing in it for ~270 frames and
       row three for ~535 — the r13 grade caught the tail of that at
       f15100-15147 and correctly called it a loading skeleton. Worse, a
       numeral is one mono glyph and a stub is 252 x 3 in theme.stroke (luma
       90): both are 0.000% to the lit gate, so nothing automated could see it.
       New: there is no such thing as an un-filled row. Each row's numeral,
       baseline, key and note live inside ONE wrapper that its own linear clip
       reveals (`rowIn` below), so a row cannot render empty under any drift,
       any ramp, or any future re-time. */
  /** PULL-QUOTE, RULE ONE (ROUND-13 / D2). Plate + the source's first two lines
   *  in ONE 12-frame linear left-to-right wipe. Authored 279 = abs 14853 +
   *  279/0.94988 = 15146.7, three frames before `rules` @ 15150 and landing
   *  across "don't store data". Was local 206 (abs 15070) WITH ALL SIX LINES:
   *  the whole prescription 80 frames before its first word and 551 before its
   *  last. Linear, because a cubic-out clip spends 21% of its width on frame
   *  one and then falls under the burst floor for the rest. */
  const qRule1 = linSub(p.rule1_draw, "rule1_draw", 279, 12);
  /** The source lights up under the clause that paraphrases it — "don't store
   *  data you don't need" over "don't store data / unnecessarily,". */
  const hlIn = linSub(p.rule1_draw, "rule1_draw", 310, 16); // "you"@310 "need"@330
  const hlOut = linSub(p.rule1_draw, "rule1_draw", 358, 12); // "means more"@366
  /** ROUND-14 / D1. Row one arrives WHOLE — numeral, baseline, key and note
   *  are one wrapper and this linear clip is the only thing that reveals it.
   *  Local 272-285 = abs 15139.4-15153.0 (rule1_draw: 14853 + L x 419/398),
   *  so the wipe opens 11 frames before `rules` @ 15150 and the numeral, being
   *  8px into a 760px wrapper, is on screen from its first frame. Linear, not
   *  cubic-out: a left-to-right ease-out spends a fifth of its width on frame
   *  one and then falls under the burst floor. Replaces `arm1` at 262, which
   *  used to extend a baseline that had been sitting empty since local 168. */
  const rowIn0 = linSub(p.rule1_draw, "rule1_draw", 272, 13);
  const key1 = sub(p.rule1_draw, "rule1_draw", 280, KEY_ENTER); // f280 -> `rules` 297
  /* ROUND-6 HOLD (beat-local 299-456, 5.23s, "only rule 1's line is up"). The
     note is pushed to 355 as its own line draw-on, and "more of it fits in
     cache" is then PROVED by the record band below the quote.

     ROUND-7 — THIS IS THE 15152-15307 FIX. The round-6 proof was written at
     f405-429, PAST rule1_draw's nominal of 398, so it evaluated to zero for
     every frame of the beat and the 2.5s gap the grader measured was literally
     empty. The whole block is rebuilt inside the nominal and at ~11x the ink:

       f370  cachePlate  888 x 124 = 110,112px = 5.31% of frame  (mask wipe)
       f380  fat records 4 x 194 x 100 = 77,600px = 3.74%        (spring pop)

     then it MORPHS in rule2_draw's slot and leaves before rule two's note —
     see `compactIn` / `cacheBlockOut` below. Offsets are 9 frames clear of the
     398 nominal (last fat cell: 389 + 9 = 398 exactly), so nothing here can go
     silent the way round 6's did. */
  const note1 = sub(p.rule1_draw, "rule1_draw", 355, 12); // f355
  const cachePlate = sub(p.rule1_draw, "rule1_draw", 370, 9); // f370-379
  const fatAt = (i: number) => sub(p.rule1_draw, "rule1_draw", 380 + i * 3); // f380-398
  /** Rule one's card steps back once rule one's own proof is the primary
   *  focus. It applies to RULE1_CARD only — rule two's card is not on screen
   *  yet, and arriving pre-dimmed is how a staged reveal reads as an
   *  afterthought. */
  const quoteDim = sub(p.rule1_draw, "rule1_draw", 372, 16); // f372

  /* ---- rule2_draw | 148f | beat-local 390-538 ----------------------------
   * SYNC FIX: key2 was at step-local 62 = beat 452 = abs 15247, and the mark
   * `rule2` is at abs 15259 — a 12-frame (400ms) early onset.
   *
   * ROUND-4 (SYNC-1): 71 was solved against the OLD pin, and Episode005 then
   * re-solved its own offset (93 -> 108) against local 62. Both moved, so the
   * corrections stacked and the onset rendered at abs 15263 — +133ms, THE ONLY
   * LATE MARK IN THE EPISODE. The step now resolves to start 15200 with a
   * ramp of 133 over a nominal of 148, so one authored frame is 0.899 rendered
   * frames and the keyword's absolute onset is 15200 + (at/148) x 133. Solving
   * for 15256 gives at = 63 (15256.6). Two frames before the word, never
   * after. If Episode005's `rule2_draw` offset changes again, RE-SOLVE THIS. */
  /** ROUND-14 / D1. Row two arrives whole. rule2_draw resolves start 15258,
   *  ramp 132 over nominal 148 (0.892 rendered frames per authored frame), so
   *  local 52-64 = abs 15304.4-15315.1 — the wipe closes one frame before
   *  `rule2` @ 15316 and never exists ahead of its own content. Ceiling check:
   *  the step's usable local max is 148 x 124/132 = 139, and 64 << 139. */
  const rowIn1 = linSub(p.rule2_draw, "rule2_draw", 52, 12);
  const key2 = sub(p.rule2_draw, "rule2_draw", 63, KEY_ENTER); // f453 -> abs 15256, `rule2` 15259
  const note2 = sub(p.rule2_draw, "rule2_draw", 110, 12); // f500
  /* ROUND-7, the second half of the 15152-15307 fix. The four fat records
     TRANSFORM into twelve compact ones over the same 839px of byte budget —
     grammar rotation as well as ink, since a masked row wiping over cells that
     are fading out is a morph, not another pop. 77,600px leaves while 83,900px
     arrives inside ten frames: ~7.8% of frame repainted at step-local 18,
     which renders at abs 15216 and closes the window's longest remaining gap
     to 41 frames (1.37s). Then the whole block — plate included, 194,012px =
     9.35% — docks away at 82 (abs 15274), 25 rendered frames before note2, so
     rule one's evidence is gone before rule two finishes its sentence. */
  const fatOut = subOut(p.rule2_draw, "rule2_draw", 18, 8); // f408-416
  const compactIn = sub(p.rule2_draw, "rule2_draw", 18); // f408-417
  const cacheBlockOut = subOut(p.rule2_draw, "rule2_draw", 82, 8); // f472-480
  /** PULL-QUOTE, RULE TWO (ROUND-13 / D2). The source's middle line — "keep
   *  data compact," — on its own card and its own 9-frame linear wipe.
   *  Authored 62 = abs 15258 + 62/1.12121 = 15313.3, three frames before
   *  `rule2` @ 15316 and one frame before `key2`. This is also the fix for the
   *  measured "+667 ms late" chip: the only burst the detector could find near
   *  that mark was `cacheBlockOut` at 15331-15338 (9.35% leaving), because
   *  key2's own arrival is an opacity ramp on 2.3% of frame of GLYPH and never
   *  clears the 0.3%-per-frame floor. 5.31% of frame at 0.66%/frame does. */
  const qRule2 = linSub(p.rule2_draw, "rule2_draw", 62, 9);
  /** Both cards leave together, before the cells land at 530. */
  const quoteOut = subOut(p.rule2_draw, "rule2_draw", 118, 8); // f508-516

  /* ---- aos_soa_morph | 256f | beat-local 530-786 ------------------------- */
  const cellIn = (i: number) =>
    sub(p.aos_soa_morph, "aos_soa_morph", i * 3, 10); // f530-573
  const loopIn = sub(p.aos_soa_morph, "aos_soa_morph", 56, 12); // f586
  /* ROUND-8. The loop line landed at 56-68 and then NOTHING explained it for
     sixty frames — the 15383-15506 dead window. The stride bed draws the loop:
     one bed the width of the array, then four marks over the four x cells, one
     every 3 frames. Bed 2.76% of frame, marks 0.15% each. */
  const strideBed = sub(p.aos_soa_morph, "aos_soa_morph", 66, 14); // 66-80
  const strideMarkAt = (s: number) =>
    sub(p.aos_soa_morph, "aos_soa_morph", 80 + s * 3, 9); // 80-98
  const strideOut = subOut(p.aos_soa_morph, "aos_soa_morph", 112, 10); // 112-122
  const focusX = sub(p.aos_soa_morph, "aos_soa_morph", 88, 16); // f618
  /** The morph itself: a 40f travel per cell, 2f apart, so the layout
   *  re-shuffles as a wave instead of twelve rectangles sliding as one block. */
  const cellMorph = (i: number) =>
    sub(p.aos_soa_morph, "aos_soa_morph", 118 + i * 2, 40);
  const labelSwap = sub(p.aos_soa_morph, "aos_soa_morph", 138, 26); // f668
  /* ROUND-6 HOLD (beat-local 540-655, 3.83s). Twelve 56px cells staggered 3
     frames apart are 3.1k px each — individually under the content-event floor,
     so the whole draw-on measured as one event and then dead air. Four STRUCT
     GROUP bars (196x72 = 14.1k px, 0.68% each) wipe in behind the cells at
     542/554/566/578 — they are the literal claim ("structs in an array"), and
     they all leave together at 630 (56k px vanishing) right before the morph. */
  const structBarAt = (s: number) =>
    sub(p.aos_soa_morph, "aos_soa_morph", 12 + s * 12, 12); // f542-590
  /* ROUND-8: 100 -> 116. The bars used to vanish 18 frames before anything
     replaced them; now they leave 116-126 with the morph already underway at
     118, so the exit reads as the records dissolving INTO the new layout. */
  const structBarOut = subOut(p.aos_soa_morph, "aos_soa_morph", 116, 10);
  const wordSwap = sub(p.aos_soa_morph, "aos_soa_morph", 168, 20); // f698
  const rowTagAt = (f: number) =>
    sub(p.aos_soa_morph, "aos_soa_morph", 186 + f * 8, 14); // f716-746
  const bracket = sub(p.aos_soa_morph, "aos_soa_morph", 206, 20); // f736
  /* ROUND-8: 222 -> 128. These were three beds appearing under rows that had
     already been settled for sixty frames — decoration after the fact, and in
     the 15507-15633 dead window they arrived at its very end. They now land
     DURING the morph, so they are the slots the cells fly into. */
  const rowBandAt = (f: number) =>
    sub(p.aos_soa_morph, "aos_soa_morph", 128 + f * 12, 14); // 128-166
  /* ROUND-9, THE 15537-15632 FIX. See the DECL_* block for the geometry and the
     ink arithmetic. Placement is solved in ABSOLUTE frames and converted back,
     because this step's ramp is not 1:1: `aos_soa_morph` resolves to from=15382
     to=15637 over a nominal of 256, so local L renders at 15382 + L x 255/256.
       local 194 -> abs 15575.2   (wipe starts, "arrays" ~15581)
       local 212 -> abs 15593.1   (wipe completes, "in" ~15590 / "structs" ~15600)
     i.e. it opens ~6 frames BEFORE the word it is named by and finishes while
     that clause is still being spoken — on or before, never after.

     WHY THE MIDDLE OF THE WINDOW AND NOT THE HOLE AT THE END. The window's
     authored events cluster 15533-15607 and then stop; the obvious placement is
     the empty 15607-15629 tail. But one event cannot rescue 3.2s from an
     endpoint — dropping it in the middle splits the window into 15537-15575
     (38f, 1.27s) and 15593-15632 (39f, 1.30s), both under the 2-3s bar, where
     the tail placement would have left a 2.33s front half untouched.

     CEILING: 194 + 18 = 212, and `aos_soa_morph` reaches 100% of its clock
     (check_subreveals lists only the beat's LAST step, `hold_list`, as clipped
     — to 97.9%), so its ceiling is the published 256. 44 frames of headroom. */
  const declIn = sub(p.aos_soa_morph, "aos_soa_morph", 194, 18); // 194-212

  /* ---- rule3_draw | 74f | beat-local 778-852 -----------------------------
   * Same sync fix as rule 2: key3 was at step-local 4 = beat 782 = abs 15577
   * against a mark at 15587, 10 frames early. 11 puts the onset at abs 15586,
   * three frames before the word. */
  /** ROUND-14 / D1. Row three arrives whole. rule3_draw resolves start 15629,
   *  ramp 74 over nominal 74 (1.000x), so local 0-12 = abs 15629-15641, three
   *  frames before `rule3` @ 15644. Under the old schedule this row's numeral
   *  and stub had been on screen since abs 15051 — 590 frames, 19.6s, of a
   *  numbered slot with nothing in it. */
  const rowIn2 = linSub(p.rule3_draw, "rule3_draw", 0, 12); // f778
  const key3 = sub(p.rule3_draw, "rule3_draw", 11, KEY_ENTER); // f789 -> `rule3` 792
  const note3 = sub(p.rule3_draw, "rule3_draw", 46, 12); // f824
  /* ROUND-13, D2 — THE HAND-OFF THAT MAKES RULE THREE QUOTABLE ON ITS MARK.
     `rule3_draw` runs 1:1 (ramp 74 = nominal 74), so a local offset IS an
     offset from abs 15629.

       local 0-8    declOut   the SoA declaration un-wipes. 866 x 228 =
                              197,448px = 9.522% of frame; 9.522 x 6 / 8 = 7.14.
                              It is rule TWO's argument and had been parked
                              until `rightExit` at 15696 with nothing left to
                              say; retiring it here is the correct hand-off AND
                              frees the only rectangle in the frame that rule
                              three's quote can occupy.
       local 12-24  qRule3    abs 15641-15653, three frames before `rule3` @
                              15644. See RULE3_CARD for ink and bounds. */
  const declOut = linSub(p.rule3_draw, "rule3_draw", 0, 8); // abs 15629-15637
  const qRule3 = linSub(p.rule3_draw, "rule3_draw", 12, 12); // abs 15641-15653

  /* ---- mini_sweep | 60f | beat-local 845-905 -----------------------------
   * The cursor has to move UNDER "sweeps, the kind the prefetcher can lock onto"
   * (~854-925) and be finished before the closing block starts — two primary
   * motions at once flattens both. */
  const dockAt = (s: number) => sub(p.mini_sweep, "mini_sweep", s * 3, 16); // f845
  const rightExit = subOut(p.mini_sweep, "mini_sweep", 0, 16);
  const stripAt = (k: number) =>
    sub(p.mini_sweep, "mini_sweep", 12 + k * 2, 10); // f857-895
  const sweepRaw = sub(p.mini_sweep, "mini_sweep", 14, 40); // f859
  const sweepLabel = sub(p.mini_sweep, "mini_sweep", 26, 12); // f871

  /* ---- hold_list | 379f | beat-local 900-1279 ---------------------------
   * Word rate targets in the header comment; every reveal is 3-8 frames early. */
  /** ROUND-13. Rule three's card un-wipes at abs 15751-15765, seven frames
   *  before `takeTag` claims the column at 15772 — the old state is gone before
   *  the new one lands. Linear, and a clip rather than an opacity fade: a
   *  layer multiplied by (1-t) drops every theme.ink pixel under luma 110 as
   *  the alpha crosses ~0.46 and the retire stops registering (the retire
   *  cliff). 11.944 x 6 / 14.04 = 5.10. */
  const qRule3Out = linSub(p.hold_list, "hold_list", 0, 14); // abs 15751-15765
  const takeTag = sub(p.hold_list, "hold_list", 21); // f921
  const takeLine = sub(p.hold_list, "hold_list", 28, KEY_ENTER); // f928 "Biased" ~936
  /** Dim AFTER the keyword lands, so the sweep isn't dimmed mid-stroke. */
  const holdDim = sub(p.hold_list, "hold_list", 32, 20); // f932
  const takeSub = sub(p.hold_list, "hold_list", 97, 10); // f997 "hardware's" ~1008
  /** ND-3 reveal 1 of 3. "flat arrays" takes the accent and an underline draws
   *  beneath it — a transform of type already on screen, not another card. */
  const takeFlat = sub(p.hold_list, "hold_list", 112, 12); // f1012, abs ~15810
  /** The `//` before "In practice" is ~57 dead frames; the divider draws
   *  through it so the pause is scored rather than empty. */
  const divider = sub(p.hold_list, "hold_list", 133, 20); // f1033
  /* D7 — EMPTY BLACK CONTAINER, beat-local 1052-1199 (4.4s). `plateBottom` was
     scheduled at 1048 but its contents did not land until 1158, so the panel
     rendered as a filled empty rounded rectangle — a hole punched in the
     b-roll. The panel is now sized to its content and wipes in WITH it (1086,
     four frames before the first cell), and the advice rows themselves move up
     into the dead window: `vector by default` types at 1065, `pointer-heavy
     when measured` at 1135. Nothing opaque is ever on screen empty. */
  const practiceTag = sub(p.hold_list, "hold_list", 152); // f1052
  const defRow = sub(p.hold_list, "hold_list", 165, 10); // f1065
  const defTail = sub(p.hold_list, "hold_list", 178, 12); // f1078
  /* ND-3 reveals 2 and 3. Round 3 proved each advice row with six 30x30 chips
     jammed into the right margin: 5,400px, under the 6,220px (0.3%) content-
     event floor, so the grader still measured the whole 8.7s tail at ZERO
     events. They move DOWN into the band under the closing block — y 890-1012,
     x 940-1786, which was dead the entire beat (house rule 7) — and go up to
     diagram scale. Contiguous is 15 cells of 48px (34,560px, 1.67%); the
     pointer chase is 8 of 44px on a hand-placed scatter (15,488px, 0.75%).
     Both clear the wrapped `pointer-heavy` row, whose second line ends at
     y 864, and both stop short of the 1015 safe edge. */
  /* ROUND-8/D1. Fifteen 48px cells popping two frames apart is 2,304px per
     event — 0.11% of frame, a THIRD of the 0.3% detection floor, which is why
     the run measured as nothing. They are now revealed by ONE mask wipe over
     their container: 15 x 48 x 48 = 34,560px = 1.67% arriving as a single
     left-to-right draw. That also reads the claim better than fifteen pops —
     "contiguous" should sweep, not stutter. `defCellAt` keeps a 2-frame
     stagger on the fill so the wipe has grain inside it. */
  const defRowWipe = sub(p.hold_list, "hold_list", 190, 14); // 190-204
  const defCellAt = (i: number) => sub(p.hold_list, "hold_list", 190 + i * 2); // f1090-1118
  const ptrRow = sub(p.hold_list, "hold_list", 235, 10); // f1135
  /* The address space the chase is scattered ACROSS — the same 862px span the
     contiguous run above just filled end to end. 862 x 74 = 63,788px = 3.07%
     of frame, and it lands 13 frames before the first node so the nodes have
     somewhere to land instead of floating in black. */
  const ptrBed = sub(p.hold_list, "hold_list", 262, 14); // 262-276
  const ptrCellAt = (i: number) => sub(p.hold_list, "hold_list", 275 + i * 3); // f1175-1196
  const ptrTail = sub(p.hold_list, "hold_list", 335, 12); // f1235 "measured" ~1240
  /* ROUND-8. THE LEFT COLUMN'S LAST EVENT WAS `holdDim` AT LOCAL 32 — the
     checklist then sat unchanged for 338 frames (11.3s) and took the whole
     tail down with it (abs 15938-16122, 6.13s, tied longest in the episode).
     The three rules now RESOLVE through the tail: a bed lights behind each in
     turn with a tick, then all three MERGE into one block as the narrator
     lands the prescription. See the SETTLE_* block for sizes.
     CEILING: hold_list's reachable local max is 370, not the nominal 379 (its
     ramp overruns the beat end by 8 frames). Last authored frame here is 366. */
  const settleAt = (i: number) =>
    sub(p.hold_list, "hold_list", 248 + i * 40, 14); // 248 / 288 / 328
  const settleTickAt = (i: number) =>
    sub(p.hold_list, "hold_list", 256 + i * 40, 9); // 256 / 296 / 336
  const merge = sub(p.hold_list, "hold_list", 350, 16); // 350-366

  /* ---- ND-5 plate schedule: the eight LARGE staged reveals ---------------
   * Round 4's 52 reveals were nearly all type, and type at this scale is
   * 20-60k px of GLYPH, most of which is below the 25-luma bar. The grader
   * measured 3.78 ev/10s and three literal freeze runs. These eight are each
   * 147k-597k px at a 36-level drop, and they are placed INSIDE the reported
   * dead windows (beat-local: 38-290, 300-353, 1041-1093):
   *   local  140  headIn       792x220  = 174k px   (with its own headline)
   *   local  200  plateBody    792x650  = 515k px   (ROUND-14: 158 -> 200,
   *                                       into the window the deleted
   *                                       numerals/stubs used to occupy)
   *   local  294  qRule1       888x268  = 238k px   (ROUND-13 D2: was ONE
   *                                       888x660 card at local 206 carrying
   *                                       all six lines — which put rule
   *                                       three's text on screen 551 frames
   *                                       before its word. Split three ways.)
   *   local  460  qRule2       888x124  = 110k px   (ROUND-13 D2, on `rule2`)
   *   local  258  bandIn       784x186  = 146k px   (ROUND-12: was an OPACITY
   *                                       ramp at 306 and scored 0.000%.
   *                                       ROUND-14: 252/14f -> 258/6f, i.e.
   *                                       1.172 %/f instead of 0.502.)
   *   local  370  cachePlate   888x124  = 110k px   (ROUND-7, the 5.20s hold)
   *   local  448  bandRow 0->1 travel, 10f, 4.51% in its first frame
   *   local  472  cachePlate OUT with the records — 194k px leaving
   *   local  508  BOTH in-column cards OUT together — 348k px leaving
   *   local  530  plateDiag    888x520  = 462k px
   *   local  724  declPanel    850x212  = 180k px   (ROUND-9, the 3.20s hold)
   *   local  776  declOut      866x228  = 197k px leaving  (ROUND-13 D2)
   *   local  788  qRule3       866x286  = 248k px   (ROUND-13 D2, on `rule3`)
   *   local  898  qRule3Out    866x286  = 248k px leaving
   *   local  782  bandRow 1->2 travel
   *   local  845  plateStrip   792x108  = 86k px    (under the sweep strip)
   *   local  940  bandOut                            (940-997 gap)
   *   local 1048  plateBottom  888x156  = 139k px   (1.77s freeze run)
   * Longest gap between LARGE events is now 148 frames, and every one of them
   * sits in a window that previously measured zero. Combined with the existing
   * 52 type reveals the beat runs ~14 events/10s scheduled; the b-roll is alive
   * again on top of that, so no frame can be identical to its predecessor. */
  /** ROUND-12: 78 -> 158, and LINEAR. The column wipes down as the narrator
   *  says "is three [lines long]", with the spine drawing at the same rate —
   *  it is never the empty 792 x 650 rectangle the r11 grade found for 3.8s.
   *
   *  ROUND-14 / D1: 158 -> 200, 18 -> 16 frames. With the numerals and stubs
   *  deleted the old placement finished at abs 15038 and left 109 frames
   *  (3.63s) of nothing before rule one's card at 15147 — a hold the stubs had
   *  been papering over with two elements that measure 0.000%. At 200 it runs
   *  abs 15063.6-15080.4, immediately after the last question slab retires:
   *      792 x 650 = 514,800px = 24.83% of frame / 16f = 1.552 %/f -> MAJOR
   *  at a 32-luma drop (b-roll ~36.5 under the deepened scrim -> plate 4.4),
   *  and the spine follows it at 216. The remaining gaps in the window are
   *  15055->15064 (9f), 15080->15099 (spine), 15099->15125 (26f, 0.87s) and
   *  15131->15139: no hold over 3s anywhere. */
  const plateBody = linSub(p.rule1_draw, "rule1_draw", 200, 16);
  const plateDiag = sub(p.aos_soa_morph, "aos_soa_morph", 0, 14);
  const plateStrip = sub(p.mini_sweep, "mini_sweep", 0, 12);
  const plateBottom = sub(p.hold_list, "hold_list", 186, 12); // D7: with its cells
  /** Band: lights on "One:" so the slot is armed before the keyword lands in
   *  it, travels on each following keyword, out as the closing take takes over.
   *
   *  ROUND-12: 306 -> 266, `sub` -> `linSub`, AND THE PAINT MOVED FROM OPACITY
   *  TO A CLIP. This was a 14-frame cubic-out OPACITY ramp on a 69-luma,
   *  7.03%-of-frame rectangle: its steepest single frame is (3/14) x 69 = 14.8
   *  luma, under the detector's 25 gate on every frame of its life, so the
   *  beat's biggest recurring "event" measured EXACTLY 0.000%. As a linear clip
   *  wipe it repaints 0.50% of frame per frame at the full 69-level delta.
   *  `bandOut` moves to the same clip for the same reason (an opacity retire
   *  falls off the same cliff on the way out).
   *
   *  ROUND-13, D2: 266 -> 252 (abs 15133 -> 15118). Splitting the pull-quote
   *  moved rule one's card from abs 15070 to 15147, which left the window
   *  15038 (end of the column wipe) -> 15133 with no measured event: 95 frames
   *  = 3.17s, over the 3.0s ceiling. The numerals and stubs in that window are
   *  a mono glyph and a 3px hairline each and measure ~0.000%, so they do not
   *  close it. Arming the band 14 frames earlier makes the two halves 80f
   *  (2.67s) and 14f. It reveals no text — it is the empty slot the keyword
   *  lands in, which is the grammar this comment already describes — so the
   *  0.47s it now precedes "One:" spoils nothing.
   *
   *  ROUND-14 / D1: 252 -> 258 and 14 -> 6 frames. This rectangle is the only
   *  LIT thing in the window (BAND_FILL 0.28 white over the black plate at 4.4
   *  composites to 74.6, a 70-luma step) and it is 784 x 186 = 145,824px =
   *  7.03% of frame, so at 14 frames it painted 0.502 %/f and at 6 it paints
   *      7.03 / 6 = 1.172 %/f -> MAJOR, and 7.03 x 6 / 6 = 7.03 >> 2.0.
   *  Local 258-264 = abs 15124.6-15130.9, i.e. the slot is armed 9 frames
   *  before the row wipes into it and 19 before `rules`. Deepening the scrim
   *  (D4) does not touch this: it is white on plate, not b-roll on plate. */
  const bandIn = linSub(p.rule1_draw, "rule1_draw", 258, 6);
  const bandOut = subOut(p.hold_list, "hold_list", 40, 14);
  /** ROUND-14: the travel is 16 frames -> 10. The band leaves one row and
   *  arrives at the next 220px away, repainting 2 x 784 x 220 = 344,960px =
   *  16.6% of frame at 70 luma. Spread over 16 frames a cubic-out's first
   *  frame moved 220 x (1-(15/16)^3) = 36.8px -> 784 x 36.8 x 2 = 2.78%; over
   *  10 it moves 59.6px -> 4.51% in ONE frame, comfortably MAJOR, and the
   *  whole travel still reads as a move rather than a cut. */
  const bandRow =
    sub(p.rule2_draw, "rule2_draw", 50, 10) +
    sub(p.rule3_draw, "rule3_draw", 0, 10);

  /** Per-row arrival. NOTHING in a row exists outside this clip — see the
   *  ROUND-14 / D1 block at `qOut0`. */
  const rowIn = [rowIn0, rowIn1, rowIn2];
  const keyP = [key1, key2, key3];
  const noteP = [note1, note2, note3];

  // The sourced fragments recede at the end so the three shorthand keywords are
  // what's left standing while the narrator gives his own take. Dim-the-rest,
  // never a highlight box and never a ring.
  // ND-2: 0.78 receded the notes to 0.22 alpha, which is 2.1:1 even on pure
  // black. ROUND-8: 0.42 -> 0.25, because the notes now sit on the lit settle
  // bed for the last four seconds — SECONDARY at 0.58 over IDLE_FILL measures
  // 2.50:1, at 0.75 it measures 3.17:1. Recede is still legible as recede.
  const detailDim = 1 - 0.25 * holdDim;

  // Sweep cursor. -0.6 .. 15.6 so the head enters from outside slot 0 and
  // leaves past slot 15 instead of parking on either end.
  const cursorPos = interpolate(sweepRaw, [0, 1], [-0.6, STRIP_SLOTS - 0.4]);
  // Ramped in over the first eighth of the sweep, so the docked x cells fade
  // from "array at rest" into "array being read" instead of snapping colour.
  const sweepOn = clamp01(sweepRaw * 8);

  const slotFill = (slot: number) => {
    const d = slot - cursorPos;
    const rest = 0.3;
    if (Math.abs(d) <= 0.5)
      return { o: mix(rest, 1, sweepOn), warm: sweepOn > 0.3 };
    if (d < -0.5) return { o: mix(rest, 0.9, sweepOn), warm: false };
    // Look-ahead: three lines in front of the cursor are already on their way.
    // This is the whole reason rule 3 exists, so it has to be visible.
    if (d <= 3.2) return { o: mix(rest, 0.45, sweepOn), warm: false };
    return { o: mix(rest, 0.14, sweepOn), warm: false };
  };

  // Ambient only, no start and no end: a slow luminance breath on the spine and
  // a 1Hz caret on the closing line.
  const spineBreath = 0.55 + 0.12 * Math.sin(frame / 64);
  const caretOn = Math.sin(frame / 4.8) > 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        fontFamily: SANS,
      }}
    >
      {/* --- texture layer: real desk footage, hard scrimmed ---------------
          ND-2. At dim 0.72 this beat measured a mean luma of 74.7 against
          20-42 everywhere else in the episode, with 96% of the frame above
          luma 45: the hand/keyboard plate was the STAR, which inverts the
          b-roll rule and dragged four secondary captions to 2.3-3.9:1.

          Two scrims, because BRoll's own gradient tops out at alpha 0.82 in
          the centre (`a * 0.82`) and 0.82 is not enough on a plate this
          bright. dim 0.95 puts the frame edges at a full 1.0 and the centre at
          0.78; the flat 0.5 sheet on top takes the centre to 0.89, so at most
          ~11% of the plate survives anywhere and the beat lands back in the
          20-42 band. The footage still MOVES — it is texture, which is all it
          was ever meant to be.

          ROUND-11/D5: the two scrim numbers above are UNCHANGED (see the
          BROLL_DRIFT_* block for why lightening them is the wrong lever). What
          is new is the constant-speed circular drift on this wrapper, which
          makes the surviving footage move by 2.2px/frame regardless of what
          the subject does — the only thing that clears 8-bit quantisation in
          the edge regions the plates leave exposed, and the only thing that
          also defeats the 25-vs-30fps duplicate frames. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${
            BROLL_DRIFT_R * Math.cos((2 * Math.PI * frame) / BROLL_DRIFT_PERIOD)
          }px, ${
            BROLL_DRIFT_R * Math.sin((2 * Math.PI * frame) / BROLL_DRIFT_PERIOD)
          }px) scale(${BROLL_DRIFT_COVER})`,
          pointerEvents: "none",
        }}
      >
        <Loop durationInFrames={BROLL_CLIP_FRAMES}>
          <BRoll
            src={BROLL_SRC}
            kind="video"
            durationInFrames={BROLL_CLIP_FRAMES}
            dim={PLATE_BROLL_DIM}
          />
        </Loop>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `rgba(0, 0, 0, ${PLATE_FLAT_SCRIM})`,
          pointerEvents: "none",
        }}
      />

      {/* --- PLATES: the contrast win WITHOUT the dead layer -----------------
          ND-2 (round 4) took dim to 0.95 + a flat 0.5 sheet: ~11% of the plate
          survived, which quantised to ZERO frame-to-frame delta — 57.2% of this
          beat rendered IDENTICAL to the previous frame and the texture layer
          was dead. Round 5 inverts the fix. The GLOBAL scrim is lightened back
          to 0.86 + 0.18 (~24% survival, centre luma ~44, edges ~8, still inside
          the 20-42 band on the mean) so the footage MOVES again; readability is
          then bought locally by opaque black PLATES that wipe in under the two
          text columns. Text no longer sits on b-roll at all — it sits on ~8
          luma, which is 9:1 for SECONDARY at full alpha and 4.6:1 receded.

          They are also the beat's biggest content events: each plate is
          150k-600k px (7-29% of frame) going from luma ~44 to ~8, a 36-level
          drop over vastly more than the 0.3% floor. Mask-wipe grammar, so they
          rotate against the spring pops and line draw-ons around them. */}
      {/* ROUND-12: the top plate is no longer here. It arrives inside the
          header card below, drawn by the same wipe as the headline it backs —
          a plate whose text is somewhere else in the tree is a plate that can
          be scheduled without its content, which is exactly what D2 was.
          ROUND-7: the checklist dropped to ROW_Y [300, 520, 740] and the active
          band now reaches y 902, so the body plate is re-cut to 256-906 —
          flush against the header card above and plateStrip below, no b-roll
          seam between them. Its content (spine, numerals, baselines) is
          scheduled INSIDE its own 18-frame wipe; see the ROUND-12 event
          ladder. */}
      <Plate t={plateBody} x={116} y={256} w={792} h={650} dir="down" />
      {/* ROUND-7: rule one's record band, under the quote. Wipes in at local
          370 — ten frames before its first cell, never an empty container —
          and is 110,112px (5.31%) on its own. */}
      <Plate
        t={cachePlate * (1 - cacheBlockOut)}
        x={REC_PLATE.x}
        y={REC_PLATE.y}
        w={REC_PLATE.w}
        h={REC_PLATE.h}
        dir="right"
      />
      <Plate t={plateDiag} x={912} y={200} w={888} h={520} dir="right" />
      <Plate t={plateStrip} x={116} y={906} w={792} h={108} dir="right" />
      {/* D7: sized to the proof band it backs (cells y 890-1012), not to the
          column — and it wipes in four frames before the first cell, never
          ahead of its content. */}
      <Plate t={plateBottom} x={916} y={874} w={886} h={142} dir="right" />

      {/* Active-row plate lift. Travels 0 -> 1 -> 2 as each keyword lands, so
          every rule change is TWO large deltas (the band leaving one row and
          arriving at the next) instead of one more text pop. 0.115 white over
          the black plate is luma 8 -> 36: a 28-level lift over 784 x 186 =
          145,824px, so a travel repaints 291,648px = 14.1% of frame. ROUND-7:
          the throw is now 220px per rule rather than 182, and the two bands no
          longer overlap at all — a clean leave-and-arrive rather than a slide.

          ROUND-8/D1: 0.115 -> BAND_FILL (0.28). Luma 8 -> 77 instead of 8 ->
          36, so the lift is a 69-level delta and the lit row finally sits
          above the luma-40 line that 87.8% of this episode's pixels fall
          under. NOT IDLE_FILL (0.35): this band travels UNDER the accent rule
          baseline, and 0.35 puts accent at 2.65:1. 0.28 is the brightest fill
          that keeps it over 3:1 — see BAND_FILL for the derivation.

          ROUND-12: the fill is unchanged and the PAINT PATH is the whole fix.
          `opacity: bandIn * (1 - bandOut)` made both the arrival and the exit
          a smooth ramp on a 69-luma step, whose steepest single frame is
          (3/14) x 69 = 14.8 — under the 25-luma gate for its entire life. The
          rectangle now wipes in from the left and out from the left under a
          LINEAR clip, so it repaints 784 x 186 / 14 = 10,416px = 0.50% of frame
          per frame at the full 69 levels. */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: ROW_Y[0] - 24 + bandRow * (ROW_Y[1] - ROW_Y[0]),
          width: SETTLE_W,
          height: SETTLE_H,
          borderRadius: 10,
          background: BAND_FILL,
          clipPath: `inset(0 ${100 * (1 - bandIn)}% 0 ${100 * bandOut}%)`,
          opacity: bandIn > 0 && bandOut < 1 ? 1 : 0,
          pointerEvents: "none",
        }}
      />

      {/* ================= the opening question (local 0-192) ===============
          "so what do you actually do about any of this on Monday morning?"
          Three marker-highlighted phrases, each landing on its own clause and
          — ROUND-14 / D1 — each RETIRING on its own, 26 authored frames apart,
          so the sentence break is three measured deltas instead of one. Opaque
          token fills (ink 236 / warm 175) over scrimmed b-roll at ~30, so the
          deltas are 206 and 145 against a 25-luma gate. No card, no plate, no
          springs: this is the loud register the checklist answers quietly.
          See the ROUND-12 D2 block by Q_ROWS for sizes, luma and bounds. */}
      {qGone < 1 &&
        Q_ROWS.map((r, i) => {
          const t = [qRow0, qRow1, qRow2][i];
          const qOut = qOutAt[i];
          if (t <= 0 || qOut >= 1) return null;
          return (
            <div
              key={r.text}
              style={{
                position: "absolute",
                left: r.x,
                top: r.y,
                width: r.w,
                height: Q_ROW_H,
                borderRadius: 10,
                background: r.warm ? theme.warm : theme.ink,
                display: "flex",
                alignItems: "center",
                // In from the left, out from the left: one continuous gesture
                // rather than a fade, so both ends of its life are measurable.
                clipPath: `inset(0 ${100 * (1 - t)}% 0 ${100 * qOut}%)`,
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  marginLeft: Q_PAD_X,
                  ...TYPE.headline,
                  lineHeight: `${Q_ROW_H}px`,
                  // 17.0:1 on ink, 10.8:1 on warm. Ink type on a lit bed would
                  // have been 3.5:1 — see the CONTRAST FLOOR block.
                  color: theme.bg,
                  whiteSpace: "nowrap",
                }}
              >
                {r.text}
              </span>
            </div>
          );
        })}

      {/* ================= header card + attribution ========================
          ROUND-12: the plate, the headline and the attribution are ONE object
          revealed by ONE downward wipe at local 140-154, landing on
          "Stroustrup's" (142) and finishing on "prescription" (152). Before
          this the headline stood alone from local 0 — five seconds ahead of
          its own word — and the plate arrived under it at local 30 as the
          first of the beat's two empty containers.

          The wrapper is 1180 wide but the plate is 792: the headline is
          25ch x 42 = 1050 (x 150-1200) and legitimately overhangs the plate
          onto scrimmed b-roll at 11.3:1. Clipping the wrapper to the plate
          would crop it. */}
      {headIn > 0 && (
        <div
          style={{
            position: "absolute",
            left: HEADCARD.x,
            top: HEADCARD.y,
            width: HEADCARD.w,
            height: HEADCARD.h,
            clipPath: `inset(0 0 ${100 * (1 - headIn)}% 0)`,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: HEADCARD.plateW,
              height: HEADCARD.h,
              borderRadius: 14,
              background: "rgba(0, 0, 0, 0.88)",
            }}
          />
          {/* headline 76 -> 25ch x 42 = 1050, x 150-1200, y 62-143 */}
          <div
            style={{
              position: "absolute",
              left: HEAD_X - HEADCARD.x,
              top: 62 - HEADCARD.y,
              ...TYPE.headline,
              color: theme.ink,
              whiteSpace: "nowrap",
            }}
          >
            Stroustrup&rsquo;s prescription
          </div>
          {/* label 58 (sans floor) -> 39ch x 29 = 1131, x 150-1281, y 156-214.
              "created C++" is cut, not shrunk: at the floor the long form ran
              into the pull-quote column. */}
          <div
            style={{
              position: "absolute",
              left: HEAD_X - HEADCARD.x,
              top: 156 - HEADCARD.y,
              ...TYPE.label,
              color: SECONDARY,
              whiteSpace: "nowrap",
            }}
          >
            Bjarne Stroustrup &middot; IEEE Computer, 2012
          </div>
        </div>
      )}

      {/* ================= the pull-quote, ONE CARD PER RULE ===============
          ROUND-13, D2. The source is still quoted whole and exactly; it is no
          longer quoted ALL AT ONCE. Rule one's two lines wipe at abs 15146.7
          (3f before `rules` @ 15150) and rule two's line at 15313.3 (3f before
          `rule2` @ 15316); rule three's are not in this column at all, because
          this column belongs to the diagram by the time rule three is spoken —
          they are quoted in RULE3_CARD at 15641. See the RULE1_CARD block for
          the ink arithmetic and the full argument.

          Two cards, not one card with a seam: a 12px gutter, both fully
          rounded, so rule two ARRIVING reads as the set growing rather than as
          a panel that had been sitting there half-empty. Both leave together on
          `quoteOut` by the same clip un-wiping from the left. */}
      {qRule1 > 0 && quoteOut < 1 && (
        <div
          style={{
            position: "absolute",
            left: RULE1_CARD.x,
            top: RULE1_CARD.y,
            width: RULE1_CARD.w,
            height: RULE1_CARD.h,
            clipPath: `inset(0 ${100 * (1 - qRule1)}% 0 ${100 * quoteOut}%)`,
            // Lifts away as it goes, so the column reads as VACATED for the
            // diagram rather than as a light being switched off.
            transform: `translateY(${quoteOut * -26}px)`,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 14,
              background: "rgba(0, 0, 0, 0.88)",
            }}
          />
          {/* The rule above the block. Ornament, and named as such: 864 x 3 in
              theme.stroke is luma 90 over 0.375 of a proxy pixel, so it lights
              nothing and measures nothing. It rides the card's wipe. */}
          <div
            style={{
              position: "absolute",
              left: QUOTE_X - RULE1_CARD.x,
              top: QUOTE_TOP - RULE1_CARD.y,
              width: QUOTE_W,
              height: 3,
              borderRadius: 2,
              background: theme.stroke,
              opacity: mix(1, 0.5, quoteDim),
            }}
          />
          {RULE1_LINE_TOP.map((top, i) => (
            <div
              key={QUOTE_LINES[i]}
              style={{
                position: "absolute",
                left: QUOTE_X - RULE1_CARD.x,
                top,
                whiteSpace: "nowrap",
                ...TYPE.annotation,
                // ROUND-7: 80px, not the 56px floor. See QUOTE_FONT — the card
                // grew around it rather than the type shrinking into the card.
                fontSize: QUOTE_FONT,
                fontFamily: MONO,
                lineHeight: `${QUOTE_LINE_H}px`,
                color: theme.ink,
                opacity: mix(1, 0.45, quoteDim),
              }}
            >
              {QUOTE_LINES[i]}
            </div>
          ))}

          {/* The highlighter, local 310-326 / 358-370. The narrator's "don't
              store data you don't need" over the source's own "don't store
              data / unnecessarily," — a transform of type already on screen,
              not another card. See the QUOTE_HL block for the arithmetic. */}
          {hlIn > 0 && hlOut < 1 && (
            <div
              style={{
                position: "absolute",
                left: QUOTE_HL.dx,
                top: QUOTE_HL.dy,
                width: QUOTE_HL.w,
                height: QUOTE_HL.h,
                clipPath: `inset(0 ${100 * (1 - hlIn)}% 0 ${100 * hlOut}%)`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 10,
                  background: theme.warm,
                }}
              />
              {RULE1_LINE_TOP.map((top, i) => (
                <div
                  key={QUOTE_LINES[i]}
                  style={{
                    position: "absolute",
                    left: QUOTE_X - RULE1_CARD.x - QUOTE_HL.dx,
                    top: top - QUOTE_HL.dy,
                    whiteSpace: "nowrap",
                    ...TYPE.annotation,
                    fontSize: QUOTE_FONT,
                    fontFamily: MONO,
                    lineHeight: `${QUOTE_LINE_H}px`,
                    // 10.8:1 on warm. theme.ink on warm is 1.6:1 and would be
                    // unreadable — the highlight has to invert the type.
                    color: theme.bg,
                  }}
                >
                  {QUOTE_LINES[i]}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rule two's line. Its own card, its own clip, its own mark — and it
          renders only once `qRule2` is non-zero, so "keep data compact," is
          not on screen at any point before abs 15313.3. */}
      {qRule2 > 0 && quoteOut < 1 && (
        <div
          style={{
            position: "absolute",
            left: RULE2_CARD.x,
            top: RULE2_CARD.y,
            width: RULE2_CARD.w,
            height: RULE2_CARD.h,
            clipPath: `inset(0 ${100 * (1 - qRule2)}% 0 ${100 * quoteOut}%)`,
            transform: `translateY(${quoteOut * -26}px)`,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 14,
              background: "rgba(0, 0, 0, 0.88)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: QUOTE_X - RULE2_CARD.x,
              top: RULE2_LINE_TOP,
              whiteSpace: "nowrap",
              ...TYPE.annotation,
              fontSize: QUOTE_FONT,
              fontFamily: MONO,
              lineHeight: `${QUOTE_LINE_H}px`,
              color: theme.ink,
            }}
          >
            {QUOTE_LINES[2]}
          </div>
        </div>
      )}

      {/* ================= the closing settle (local 248-366) ===============
          The three rules resolving, so the left column is not a frozen
          prescription for the last eleven seconds. A bed lights behind each
          rule in turn, a tick draws in its lane, and then beds 0 and 1 GROW
          by exactly the 34px gutter between rows — the three beds becoming
          one block. A transform of what is already there; nothing is added
          and nothing is removed, and no two beds ever overlap, so the alpha
          is never double-composited. */}
      {ROW_Y.map((y, i) => {
        const t = settleAt(i);
        if (t <= 0) return null;
        const r = 14;
        // Corners facing a seam square off as the block closes.
        const rTop = i === 0 ? r : mix(r, 0, merge);
        const rBot = i === ROW_Y.length - 1 ? r : mix(r, 0, merge);
        return (
          <div
            key={`settle-${i}`}
            style={{
              position: "absolute",
              left: SETTLE_X,
              top: y + SETTLE_DY,
              width: SETTLE_W,
              height:
                SETTLE_H + (i < ROW_Y.length - 1 ? merge * SETTLE_GAP : 0),
              borderRadius: `${rTop}px ${rTop}px ${rBot}px ${rBot}px`,
              background: IDLE_FILL,
              // Wipes UP into place rather than popping — the row is settling,
              // not arriving.
              clipPath: `inset(${100 * (1 - t)}% 0 0 0)`,
              opacity: t,
              pointerEvents: "none",
            }}
          />
        );
      })}
      {ROW_Y.map((y, i) => {
        const t = settleTickAt(i);
        if (t <= 0) return null;
        return (
          <svg
            key={`tick-${i}`}
            width={48}
            height={48}
            viewBox="0 0 48 48"
            style={{ position: "absolute", left: TICK_X, top: y + TICK_DY }}
          >
            <polyline
              points="8,25 19,36 40,13"
              fill="none"
              // 5.7:1 on the bed. theme.up measures 2.5:1 there and would be
              // a green tick nobody can see.
              stroke={theme.ink}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={48}
              strokeDashoffset={48 * (1 - t)}
            />
          </svg>
        );
      })}

      {/* ================= the spine — line draw-on ========================= */}
      <div
        style={{
          position: "absolute",
          left: SPINE_X,
          top: SPINE_TOP,
          width: 4,
          height: (SPINE_BOTTOM - SPINE_TOP) * spine,
          borderRadius: 2,
          // ROUND-8: accent on the lit settle bed is 2.65:1. It ramps to ink
          // (5.7:1) as the first row settles, which also reads correctly —
          // the spine goes from "list in progress" to "list resolved".
          background: interpolateColors(
            settleAt(0),
            [0, 1],
            [theme.accent, theme.ink],
          ),
          opacity: mix(spineBreath, 0.95, holdDim),
        }}
      />

      {/* ================= the three rules =================================
          ROUND-14 / D1 — THE STRUCTURAL FIX FOR THE SKELETON ROWS.

          These used to be four flat siblings per row: a numeral and a 252x3
          stub scheduled together for ALL THREE rows at rule1_draw local
          164-204 (abs 15026 / 15038 / 15051), with the content that belongs in
          them arriving at abs 15148, 15314 and 15641. Row two therefore stood
          as a numbered container with nothing in it for 276 frames and row
          three for 590 — 19.6 seconds of loading skeleton. Both offenders were
          also invisible to every automated gate: one mono glyph is ~0.02% of
          frame and a 3px line in theme.stroke (luma 90) is under the lit
          threshold entirely, so nothing measured what the eye saw immediately.

          A row is now ONE wrapper whose own clip reveals it, and the numeral,
          baseline, key and note live inside it. There is no schedule under
          which a numeral can render without its rule: `rowIn[i]` is the only
          thing that makes any of it visible, and it is authored to close on
          each rule's spoken word (see rowIn0/1/2). The left-to-right wipe
          draws the baseline out from under the numeral as it goes, which is
          the "line draw-on" grammar this beat otherwise lacks.

          BOUNDS. The wrapper is x 160-920, y ROW_Y-24 +190, i.e. 276-466 /
          496-686 / 716-906 — no overlap between rows, and the bottom edge
          lands exactly on plateBody's 906. The widest child is the row-three
          key at 637px from wrapper-x 90, ending at 727 and at 746 under
          popScale's 1.03 overshoot, so nothing is clipped by its own wrapper
          and nothing crosses the 940 diagram column. */}
      {RULES.map((r, i) => {
        const y = ROW_Y[i];
        const t = rowIn[i];
        const kp = keyP[i];
        if (t <= 0) return null;
        return (
          <div
            key={r.key}
            style={{
              position: "absolute",
              left: ROW_BOX_X,
              top: y + ROW_BOX_DY,
              width: ROW_BOX_W,
              height: ROW_BOX_H,
              // The ONE reveal. Linear, left to right; nothing inside has an
              // entrance of its own that could outrun it.
              clipPath: `inset(0 ${100 * (1 - t)}% 0 0)`,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: NUM_X - ROW_BOX_X,
                top: 4 - ROW_BOX_DY,
                width: 60,
                ...TYPE.annotation,
                fontFamily: MONO,
                lineHeight: `${TYPE.annotation.fontSize}px`,
                // Deliberately never changes colour: a hard swap mid-ramp is a
                // one-frame flicker. The end-of-beat emphasis is carried by the
                // sourced lines receding (detailDim), not by the numerals.
                color: SECONDARY,
                opacity: mix(0.85, 1, holdDim),
              }}
            >
              {i + 1}
            </div>

            {/* Baseline: full RULE_W from the first frame, drawn out by the
                wrapper's wipe. It is never a stub waiting to be filled, because
                there is no longer a moment when the rule is missing. */}
            <div
              style={{
                position: "absolute",
                left: NUM_X - ROW_BOX_X,
                top: BASE_DY - ROW_BOX_DY,
                width: RULE_W,
                height: 3,
                borderRadius: 2,
                // Same ROUND-8 ramp as the spine: accent is 2.65:1 once this
                // row's bed is lit, ink is 5.7:1.
                background: interpolateColors(
                  settleAt(i),
                  [0, 1],
                  [theme.accent, theme.ink],
                ),
              }}
            />

            <div
              style={{
                position: "absolute",
                left: KEY_X - ROW_BOX_X,
                top: KEY_DY - ROW_BOX_DY,
                ...TYPE.headline,
                // ROUND-14 / D2: KEY_FONT 64, not TYPE.headline's 76 — see the
                // KEY_FONT derivation. Cap 46.5px, over the 40px floor.
                fontSize: KEY_FONT,
                lineHeight: `${KEY_FONT}px`,
                color: theme.ink,
                whiteSpace: "nowrap",
                opacity: keyOpacity(kp),
                transform: `scale(${popScale(kp)})`,
                transformOrigin: "left center",
              }}
            >
              {r.key}
            </div>

            <div
              style={{
                position: "absolute",
                left: KEY_X - ROW_BOX_X,
                top: NOTE_DY - ROW_BOX_DY,
                ...TYPE.label,
                lineHeight: `${TYPE.label.fontSize}px`,
                color: SECONDARY,
                whiteSpace: "nowrap",
                opacity: noteP[i] * detailDim,
                transform: `translateY(${(1 - noteP[i]) * 6}px)`,
              }}
            >
              {r.note}
            </div>
          </div>
        );
      })}

      {/* ---- rule one's cache-residency proof (beat-local 380-480) --------
          "smaller data means more of it fits in cache", said with the byte
          budget held fixed: four fat records spring in across 839px, then the
          SAME 839px re-fills with twelve compact ones. The fat row fades under
          the incoming mask rather than popping out first, so this reads as one
          quantity changing, not two slides.

          INK: fat 4 x 194 x 100 = 77,600px (3.74% of frame); compact 12 x 58 x
          100 = 69,600px arriving inside an 839 x 100 = 83,900px (4.04%) wipe.
          Both clear REVEAL_INK_MIN_PX (31,100) more than twice over, where the
          round-6 version was 6,936px and never rendered at all. */}
      {Array.from({ length: FAT_N }, (_, i) => {
        const t = fatAt(i);
        if (t <= 0) return null;
        const gone = Math.max(fatOut, cacheBlockOut);
        return (
          <div
            key={`fat-${i}`}
            style={{
              position: "absolute",
              left: REC_X + i * FAT_PITCH, // x 924-1763
              top: REC_Y, // y 900-1000
              width: FAT_W,
              height: REC_H,
              borderRadius: 8,
              background: theme.dim,
              opacity: keyOpacity(t) * (1 - gone) * 0.85,
              transform: `translateY(${gone * 18}px) scale(${popScale(t)})`,
            }}
          />
        );
      })}
      {compactIn <= 0 ? null : (
        <div
          style={{
            position: "absolute",
            left: REC_X,
            top: REC_Y,
            width: REC_ROW_W,
            height: REC_H,
            display: "flex",
            gap: COMPACT_GAP,
            // Mask wipe over the fat row's own footprint — the transform
            // grammar, and it means the delta is the full band, not per-cell.
            clipPath: `inset(0 ${100 * (1 - compactIn)}% 0 0)`,
            opacity: 1 - cacheBlockOut,
            transform: `translateY(${cacheBlockOut * 18}px)`,
            pointerEvents: "none",
          }}
        >
          {Array.from({ length: COMPACT_N }, (_, i) => (
            <div
              key={`rec-${i}`}
              style={{
                width: COMPACT_W,
                height: REC_H,
                borderRadius: 6,
                background: theme.accent,
                opacity: 0.92,
              }}
            />
          ))}
        </div>
      )}

      {/* ---- struct-group bars, BEHIND the AoS cells (f542-590) -----------
          "storing structs in arrays": four bars wipe in around each group of
          three cells, so the array reads as four records rather than twelve
          rectangles, and they all leave together at f630 as the morph starts. */}
      {Array.from({ length: STRUCTS }, (_, s) => {
        const t = structBarAt(s) * (1 - structBarOut);
        if (t <= 0) return null;
        return (
          <div
            key={`sbar-${s}`}
            style={{
              position: "absolute",
              left: structBarX(s), // x 932-1728
              top: AOS_Y - BAR_PAD, // y 412-484
              width: STRUCT_BAR_W,
              height: BAR_H,
              borderRadius: 10,
              // ROUND-8/D1: was rgba(255,255,255,0.11) = a 20-level delta,
              // under the detector's 25 gate and under the eye's.
              background: IDLE_FILL,
              clipPath: `inset(0 ${100 * (1 - structBarAt(s))}% 0 0)`,
              opacity: 1 - structBarOut,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* ---- SoA row beds, the slots the cells fly into (local 128/140/152) --
          Each field becomes one run, so the run gets a bed and the cells land
          IN it. See the ROUND-8 note on ROW_BAND_W for why the bed stops at
          1250 rather than running under the ellipsis. */}
      {FIELD_NAME.map((name, f) => {
        const t = rowBandAt(f) * (1 - rightExit);
        if (t <= 0) return null;
        return (
          <div
            key={`rband-${name}`}
            style={{
              position: "absolute",
              left: SOA_X - BAR_PAD, // x 992-1250
              top: soaY(f) + ROW_BAND_DY, // y 334 / 410 / 486, +68
              width: ROW_BAND_W,
              height: ROW_BAND_H,
              borderRadius: 10,
              // ROUND-8/D1: was rgba(255,255,255,0.10).
              background: IDLE_FILL,
              clipPath: `inset(0 ${100 * (1 - rowBandAt(f))}% 0 0)`,
              opacity: 1 - rightExit,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* ---- the loop's stride, above the AoS row (local 66-122) -----------
          `for (p : pts) sum += p.x` drawn: one bed the width of the array,
          four marks over the four x cells. The loop touches one field in
          three — which is the whole reason the morph below is about to
          happen. It leaves at 112 as the morph starts. */}
      {strideBed > 0 && strideOut < 1 && (
        <div
          style={{
            position: "absolute",
            left: STRIDE_X,
            top: STRIDE_Y,
            width: STRIDE_W,
            height: STRIDE_H,
            borderRadius: 10,
            background: IDLE_FILL,
            clipPath: `inset(0 ${100 * (1 - strideBed)}% 0 0)`,
            opacity: 1 - strideOut,
            transform: `translateY(${strideOut * -14}px)`,
            pointerEvents: "none",
          }}
        />
      )}
      {strideBed > 0 &&
        strideOut < 1 &&
        Array.from({ length: STRUCTS }, (_, s) => {
          const t = strideMarkAt(s);
          if (t <= 0) return null;
          return (
            <div
              key={`stride-${s}`}
              style={{
                position: "absolute",
                left: aosX(s * FIELDS),
                top: STRIDE_Y + (STRIDE_H - STRIDE_MARK_H) / 2, // 346
                width: CELL,
                height: STRIDE_MARK_H * t,
                borderRadius: 4,
                // 5.7:1 on the bed — the marks are the readable content here.
                background: theme.ink,
                opacity: (1 - strideOut) * 0.92,
                transform: `translateY(${strideOut * -14}px)`,
                pointerEvents: "none",
              }}
            />
          );
        })}

      {/* ================= the twelve cells ================================
          ONE array of twelve elements for the whole beat. They draw on as an
          array-of-structs, travel into a struct-of-arrays, and four of them then
          travel again into the sweep strip. Once a cell is on screen it is never
          unmounted and re-added — the entire teaching claim is "same bytes,
          different order", and swapping the elements out would quietly cheat
          it. */}
      {Array.from({ length: N_CELLS }, (_, i) => {
        const s = Math.floor(i / FIELDS);
        const f = i % FIELDS;

        const entry = cellIn(i);
        if (entry <= 0) return null;

        const t = cellMorph(i);
        const dock = f === 0 ? dockAt(s) : 0;

        const xMid = mix(aosX(i), soaX(s), t);
        const yMid = mix(AOS_Y, soaY(f), t);
        // Small arc so cells crossing each other read as re-ordering rather
        // than as sliding through one another. Fields split up and down.
        const arc = Math.sin(Math.PI * t) * (f === 0 ? -18 : 18);

        const x = mix(xMid, stripX(s), dock);
        const y = mix(yMid + arc, STRIP_Y, dock);
        const size = mix(CELL, STRIP_CELL, dock);

        // y and z drop back when the loop's single field is called out, then
        // leave entirely once the strip takes over. Dim-the-rest, not a ring.
        const focus = f === 0 ? 1 : mix(1, 0.22, focusX);
        const alive = f === 0 ? 1 : 1 - rightExit;

        const lit = slotFill(s);
        const restO = 0.85 * focus;
        // Once docked, the strip is rule 3's evidence and stays on screen — but
        // it steps back while the closing advice is being read, so there is only
        // ever one primary focus.
        const secondary = 1 - 0.45 * holdDim * dock;
        const o = f === 0 ? mix(restO, lit.o, dock) * secondary : restO * alive;
        const fill =
          f === 0 && lit.warm && dock > 0.6 ? theme.warm : FIELD_COLOR[f];

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: 6,
              background: fill,
              opacity: popOpacity(entry) * o,
              // y and z leave to the right as they fade — an exit that only
              // fades reads as a bulb dying, not as something making way.
              transform: `translateX(${f === 0 ? 0 : 30 * rightExit}px) scale(${popScale(entry)})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                // Mono floor exactly, and CELL is 56 — the glyph fills its cell.
                ...TYPE.annotation,
                fontFamily: MONO,
                lineHeight: `${CELL}px`,
                fontWeight: 700,
                color: theme.bg,
                // The letters go with the zoom-out: in a 24px strip cell a glyph
                // is noise, and it would be under the readability floor.
                opacity: 1 - dock,
              }}
            >
              {FIELD_NAME[f]}
            </span>
          </div>
        );
      })}

      {/* ---- the strip slots the docked x cells extend into ---------------
          Slots 0-3 are the docked cells above; these are 4-15, the rest of the
          array. They wipe on left to right after the dock, which is what sells
          "this row keeps going" without inventing more structs in the diagram. */}
      {Array.from({ length: STRIP_SLOTS - STRUCTS }, (_, k) => {
        const slot = STRUCTS + k;
        const w = stripAt(k);
        if (w <= 0) return null;
        const lit = slotFill(slot);
        return (
          <div
            key={slot}
            style={{
              position: "absolute",
              left: stripX(slot),
              top: STRIP_Y,
              width: STRIP_CELL * w,
              height: STRIP_CELL,
              borderRadius: 4,
              background: lit.warm ? theme.warm : theme.accent,
              opacity: lit.o * (1 - 0.45 * holdDim),
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          // label 58 -> 23ch x 29 = 667, x 250-917, y 952-1010 (ROUND-7: the
          // strip followed the checklist down, so this followed the strip;
          // 1010 is five px inside the 1015 safe edge).
          left: STRIP_X,
          top: SWEEP_LABEL_Y,
          ...TYPE.label,
          lineHeight: `${TYPE.label.fontSize}px`,
          color: theme.warm,
          whiteSpace: "nowrap",
          opacity: sweepLabel * 0.95,
          transform: `translateX(${(1 - sweepLabel) * -16}px)`,
        }}
      >
        the prefetcher locks on
      </div>

      {/* ================= AoS / SoA label — one label, two words ==========
          Crossfaded in place so the heading transforms with the cells instead
          of one heading vanishing and another popping in beside it. */}
      <div
        style={{
          position: "absolute",
          left: DIAG_X,
          top: LABEL_Y,
          height: TYPE.annotation.fontSize + 8,
          opacity: (1 - rightExit) * popOpacity(cellIn(0)),
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            ...TYPE.annotation,
            fontFamily: MONO,
            lineHeight: `${TYPE.annotation.fontSize}px`,
            color: theme.dim,
            whiteSpace: "nowrap",
            opacity: 1 - labelSwap,
          }}
        >
          array of structs
        </span>
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            ...TYPE.annotation,
            fontFamily: MONO,
            lineHeight: `${TYPE.annotation.fontSize}px`,
            color: theme.ink,
            whiteSpace: "nowrap",
            opacity: labelSwap,
          }}
        >
          struct of arrays
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          // 308, not 296: the label above it is now 56px of mono (y 236-292).
          left: DIAG_X,
          top: 308,
          width: 320 * cellIn(0),
          height: 2,
          background: theme.stroke,
          opacity: 1 - rightExit,
        }}
      />

      {/* ---- SoA row tags, docked at the left edge of each row ------------ */}
      {FIELD_NAME.map((name, f) => {
        const t = rowTagAt(f);
        return (
          <React.Fragment key={name}>
            <div
              style={{
                position: "absolute",
                left: DIAG_X + 8,
                top: soaY(f),
                ...TYPE.annotation,
                fontFamily: MONO,
                lineHeight: `${CELL}px`,
                color: FIELD_COLOR[f],
                opacity: t * (1 - rightExit),
                transform: `translateX(${(1 - t) * 14}px)`,
              }}
            >
              {name}
            </div>
            <div
              style={{
                position: "absolute",
                left: SOA_X + STRUCTS * PITCH + 6,
                top: soaY(f),
                ...TYPE.annotation,
                fontFamily: MONO,
                lineHeight: `${CELL}px`,
                color: theme.dim,
                opacity: t * 0.8 * (1 - rightExit),
              }}
            >
              &hellip;
            </div>
          </React.Fragment>
        );
      })}

      {/* ---- bracket over the x row (never a ring) ------------------------ */}
      <div
        style={{
          position: "absolute",
          left: SOA_X,
          top: SOA_Y - 20,
          width: (STRUCTS * PITCH - (PITCH - CELL)) * bracket,
          height: 2,
          background: theme.warm,
          opacity: (1 - rightExit) * 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: SOA_X,
          top: SOA_Y - 20,
          width: 2,
          height: 10 * bracket,
          background: theme.warm,
          opacity: (1 - rightExit) * 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: SOA_X + STRUCTS * PITCH - (PITCH - CELL) - 2,
          top: SOA_Y - 20,
          width: 2,
          height: 10 * bracket,
          background: theme.warm,
          opacity: (1 - rightExit) * 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          // label 58 -> 10ch x 29 = 290, x 1308-1598, y 290-348; clear of the
          // row-0 ellipsis, which ends at x 1288.
          left: SOA_X + STRUCTS * PITCH + 60,
          top: SOA_Y - 50,
          ...TYPE.label,
          lineHeight: `${TYPE.label.fontSize}px`,
          color: theme.warm,
          whiteSpace: "nowrap",
          opacity: bracket * (1 - rightExit),
          transform: `translateX(${(1 - bracket) * -12}px)`,
        }}
      >
        contiguous
      </div>

      {/* ---- the narrated verdict, one word of which changes --------------
          "things used together live together" is the narration, so the caption
          IS that phrase, parked below both layouts, and the morph is scored by
          its last word flipping from apart to together. A whole new caption
          would make the layout change look like two unrelated slides. */}
      <div
        style={{
          position: "absolute",
          left: DIAG_X,
          top: ANNOT_Y,
          display: "flex",
          // NOT `baseline`: the swap slot's children are absolutely
          // positioned, so it has no in-flow line box and its baseline is its
          // bottom edge — baseline alignment would lift "apart"/"together"
          // above the phrase it belongs to. Align the tops and pin one shared
          // line-height instead, so the swapped word sits on the line.
          alignItems: "flex-start",
          // label 58: prefix 21ch = 609, slot 232 -> x 940-1789, y 570-628
          ...TYPE.label,
          lineHeight: "58px",
          whiteSpace: "nowrap",
          opacity: focusX * (1 - rightExit),
        }}
      >
        <span style={{ color: theme.dim }}>used together, stored&nbsp;</span>
        <span
          style={{
            position: "relative",
            display: "inline-block",
            width: 232,
            height: 58,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              lineHeight: "58px",
              color: theme.down,
              opacity: 1 - wordSwap,
            }}
          >
            apart
          </span>
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              lineHeight: "58px",
              color: theme.ink,
              fontWeight: 700,
              opacity: wordSwap,
            }}
          >
            together
          </span>
        </span>
      </div>

      {/* ---- the loop, literally, so "used together" means something ------ */}
      <div
        style={{
          position: "absolute",
          // mono 56 -> 24ch x 33.6 = 806, x 940-1746, y 640-696. The full
          // `for (auto& p : points)` form is 1142px at the floor and would
          // clear the safe edge by 77px, so the loop is shortened, not shrunk.
          left: DIAG_X,
          top: LOOP_Y,
          ...TYPE.annotation,
          fontFamily: MONO,
          lineHeight: `${TYPE.annotation.fontSize}px`,
          color: theme.dim,
          whiteSpace: "nowrap",
          opacity: loopIn * (1 - rightExit),
          transform: `translateY(${(1 - loopIn) * 8}px)`,
        }}
      >
        for (p : pts) sum += <span style={{ color: theme.accent }}>p.x</span>
      </div>

      {/* ---- "arrays in structs", written out (local 194-212) -------------
          ROUND-9, the abs 15537-15632 fix. The narration names two layouts in
          this stretch and the diagram above only ever shows the memory picture
          of them; this is the source people actually argue about, landing on
          the words that name it. Full derivation — words, ink, bounds, why a
          wipe — is in the DECL_* block near the geometry.

          ONE clip-path wipe over the plate, the bed AND the code, so the
          panel is never on screen empty (the D7 rule) and the whole thing
          reads as a single gesture rather than a container that later fills.
          The plate buys theme.ink 6.0:1 on the bed; without it the bed would
          composite over scrimmed b-roll and the same ink measures 3.9:1. */}
      {declIn > 0 && declOut < 1 && (
        <div
          style={{
            position: "absolute",
            left: DECL_PLATE.x,
            top: DECL_PLATE.y,
            width: DECL_PLATE.w,
            height: DECL_PLATE.h,
            // ROUND-13, D2: it leaves the way it arrived — the SAME linear clip
            // running off the left edge — 8 frames at rule3_draw local 0-8
            // (abs 15629-15637), handing the footprint to RULE3_CARD three
            // frames later. It no longer waits for `rightExit`: it is rule
            // TWO's argument and had nothing left to say from 15593 onward.
            clipPath: `inset(0 ${100 * (1 - declIn)}% 0 ${100 * declOut}%)`,
            pointerEvents: "none",
          }}
        >
          {/* Readability backing only — same 0.88 black as `Plate`. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 14,
              background: "rgba(0, 0, 0, 0.88)",
            }}
          />
          {/* THE EVENT: 850 x 212 = 180,200px = 8.69% of frame at the
              87-level IDLE_FILL step. 8.69 x 6 / 18 = 2.90 against the 2.0
              gate; eased out, its first 6 frames alone carry ~5.7%. */}
          <div
            style={{
              position: "absolute",
              left: DECL_BED.x - DECL_PLATE.x,
              top: DECL_BED.y - DECL_PLATE.y,
              width: DECL_BED.w,
              height: DECL_BED.h,
              borderRadius: 10,
              background: IDLE_FILL,
            }}
          />
          {DECL_LINES.map((line, i) => (
            <div
              key={line.text}
              style={{
                position: "absolute",
                left: DECL_TEXT_X - DECL_PLATE.x + line.indent * DECL_INDENT,
                top: DECL_TOP - DECL_PLATE.y + i * DECL_LINE_H,
                ...TYPE.annotation,
                fontFamily: MONO,
                lineHeight: `${TYPE.annotation.fontSize}px`,
                // 6.0:1 on the bed. theme.dim (the loop line's colour, which
                // sits on black) is 2.18:1 here and SECONDARY is 4.1:1 — on a
                // lit bed the code is the primary read, so it takes ink.
                color: theme.ink,
                whiteSpace: "nowrap",
              }}
            >
              {line.text}
            </div>
          ))}
        </div>
      )}

      {/* ================= rule three's card, on rule three's word ==========
          ROUND-13, D2. The last three lines of the source — "and access memory
          / in a predictable / manner.”" — were previously on screen from
          abs 15093, i.e. 551 frames (-18.4s) before the word `rule3` at 15644.
          They now do not exist until `qRule3` opens at abs 15641, three frames
          BEFORE that word.

          It takes the rectangle the SoA declaration vacated four frames
          earlier, so the hand-off is a transform of the column rather than a
          third card popping in somewhere new. Full derivation in RULE3_CARD.
          ONE linear clip over plate AND type together: the container is never
          on screen empty.

              866 x 286 = 247,676px = 11.944% of frame
              12 authored frames in `rule3_draw` (ramp 74 / nominal 74 = 1:1)
              11.944 x 6 / 12 = 5.97   >= 2.0                                */}
      {qRule3 > 0 && qRule3Out < 1 && (
        <div
          style={{
            position: "absolute",
            left: RULE3_CARD.x,
            top: RULE3_CARD.y,
            width: RULE3_CARD.w,
            height: RULE3_CARD.h,
            clipPath: `inset(0 ${100 * (1 - qRule3)}% 0 ${100 * qRule3Out}%)`,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 14,
              background: "rgba(0, 0, 0, 0.88)",
            }}
          />
          {QUOTE_LINES.slice(3).map((line, i) => (
            <div
              key={line}
              style={{
                position: "absolute",
                left: RULE3_TEXT_DX,
                top: RULE3_TEXT_DY + i * RULE3_LINE_H,
                whiteSpace: "nowrap",
                ...TYPE.annotation,
                // 72px = a 52px cap, 12 clear of the 40px floor. Smaller than
                // the 80px in-column cards because three lines have to fit the
                // 286px the declaration vacated — derived, see RULE3_CARD.
                fontSize: RULE3_FONT,
                fontFamily: MONO,
                lineHeight: `${RULE3_LINE_H}px`,
                color: theme.ink,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* ================= the closing default =============================
          Lives in the space the diagram vacates (the y/z cells and the loop
          have both exited by hold_list). Every row is clear of the checklist,
          which owns x < 940 in every band the block occupies (y 250-868): the
          widest thing on the left at those heights is rule two's key, ending
          at x 880 — and after ROUND-7's drop the lowest thing on the left in
          this band is rule three's note, x 250-714 at y 832-890. */}
      {/* mono 56 + ls 3 -> 7ch = 256, y 250-306 */}
      <div
        style={{
          position: "absolute",
          left: DIAG_X,
          top: 250,
          ...TYPE.annotation,
          fontFamily: MONO,
          lineHeight: `${TYPE.annotation.fontSize}px`,
          letterSpacing: 3,
          color: SECONDARY,
          opacity: takeTag,
        }}
      >
        MY TAKE
      </div>
      {/* headline 76 on two lines: 25ch on one line is 1050px and clears the
          safe edge, so the opinion WRAPS rather than shrinking. y 318-480. */}
      <div
        style={{
          position: "absolute",
          left: DIAG_X,
          top: 318,
          ...TYPE.headline,
          lineHeight: "81px",
          color: theme.ink,
          whiteSpace: "pre",
          opacity: keyOpacity(takeLine),
          transform: `scale(${popScale(takeLine)})`,
          transformOrigin: "left top",
        }}
      >
        <div>biased toward</div>
        {/* ND-3, reveal 1. The second line takes the accent 15 frames after
            "it's the hardware's bias too" lands — the take's punch, carried by
            a colour transform of type ALREADY on screen rather than by a new
            object arriving. ~35,000px change (1.7% of frame). */}
        <div
          style={{
            color: interpolateColors(
              takeFlat,
              [0, 1],
              [theme.ink, theme.accent],
            ),
          }}
        >
          flat arrays
        </div>
      </div>
      {/* Emphasis underline draws left to right under "flat arrays" (11ch x 42
          = 462 wide, x 940-1402), y 484-489 — four px clear of the takeSub
          line at 496. Line draw-on, not a ring. */}
      <div
        style={{
          position: "absolute",
          left: DIAG_X,
          top: 484,
          width: 462 * takeFlat,
          height: 5,
          borderRadius: 3,
          background: theme.accent,
          opacity: takeFlat,
        }}
      />
      {/* label 58 -> 27ch x 29 = 783, x 940-1723, y 496-554 */}
      <div
        style={{
          position: "absolute",
          left: DIAG_X,
          top: 496,
          ...TYPE.label,
          lineHeight: `${TYPE.label.fontSize}px`,
          color: SECONDARY,
          whiteSpace: "nowrap",
          opacity: takeSub,
          transform: `translateX(${(1 - takeSub) * -18}px)`,
        }}
      >
        it&rsquo;s the hardware&rsquo;s bias too
      </div>
      <div
        style={{
          position: "absolute",
          left: DIAG_X,
          top: 578,
          // Full column width (x 940-1794) rather than 700, so the draw-on
          // through the `//` pause is a content event and not a hairline.
          width: 854 * divider,
          height: 3,
          background: SECONDARY,
          // ROUND-8/D1: 0.35 put this at luma 74 x 0.35 = a 1.9:1 hairline
          // nobody sees draw. 0.75 is 4.6:1 on the plate and the draw-on is
          // actually visible, which was the whole point of widening it.
          opacity: 0.75 * divider,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: DIAG_X,
          top: 600,
          ...TYPE.annotation,
          fontFamily: MONO,
          lineHeight: `${TYPE.annotation.fontSize}px`,
          letterSpacing: 3,
          color: SECONDARY,
          opacity: practiceTag,
        }}
      >
        IN PRACTICE
      </div>

      <PracticeRow
        top={672}
        t={defRow}
        tailT={defTail}
        tick={theme.accent}
        code="vector"
        codeColor={theme.accent}
      >
        {/* Leading NBSP, not a space: the clause is an inline-block, so an
            ordinary leading space collapses and the row runs together. */}
        {" by default"}
      </PracticeRow>
      <PracticeRow
        top={746}
        t={ptrRow}
        tailT={ptrTail}
        tick={SECONDARY}
        code="pointer-heavy"
        codeColor={SECONDARY}
        tailBelow
        caret={caretOn}
      >
        {" when you’ve measured"}
      </PracticeRow>

      {/* ---- the two advice rows, PROVED ---------------------------------
          Six contiguous cells for the vector, six scattered ones for the
          pointer chase — the same visual language the whole episode has used,
          at the size the grader can actually see. These are the sub-reveals
          that break the 15912-16018 hold, and each lands on its own word. */}
      {defRowWipe > 0 && (
        <div
          style={{
            position: "absolute",
            left: PROOF_X,
            top: DEF_Y,
            width: DEF_CELLS * DEF_PITCH, // 855; last cell ends at 1786
            height: DEF_CELL,
            // ONE mask wipe over the whole run (ROUND-8/D1): fifteen 0.11%
            // pops were under the detection floor individually, and a
            // contiguous run should sweep rather than stutter.
            clipPath: `inset(0 ${100 * (1 - defRowWipe)}% 0 0)`,
            pointerEvents: "none",
          }}
        >
          {Array.from({ length: DEF_CELLS }, (_, i) => {
            const t = defCellAt(i);
            return (
              <div
                key={`def-${i}`}
                style={{
                  position: "absolute",
                  left: i * DEF_PITCH,
                  top: 0,
                  width: DEF_CELL,
                  height: DEF_CELL,
                  borderRadius: 5,
                  background: theme.accent,
                  // Grain inside the wipe, never the wipe itself.
                  opacity: mix(0.72, 0.92, clamp01(t)),
                }}
              />
            );
          })}
        </div>
      )}
      {ptrBed > 0 && (
        <div
          style={{
            position: "absolute",
            left: PROOF_X - 8, // x 932-1794, inside the 1805 edge
            top: PTR_Y - 16, // y 940-1014, inside the 1015 edge
            width: DEF_CELLS * DEF_PITCH + 16,
            height: PTR_CELL + 30,
            borderRadius: 10,
            // The address space the chase is scattered across — the same span
            // the contiguous run above just filled end to end.
            background: IDLE_FILL,
            clipPath: `inset(0 ${100 * (1 - ptrBed)}% 0 0)`,
            pointerEvents: "none",
          }}
        />
      )}
      {PTR_DX.map((dx, i) => {
        const t = ptrCellAt(i);
        if (t <= 0) return null;
        return (
          <div
            key={`ptr-${i}`}
            style={{
              position: "absolute",
              left: PROOF_X + dx, // x 940-1786, inside the 1805 edge
              top: PTR_Y + PTR_DY[i], // y 948-1012, inside the 1015 edge
              width: PTR_CELL,
              height: PTR_CELL,
              borderRadius: 5,
              background: SECONDARY,
              // ROUND-8: 0.55 -> 0.9. On the lit address-space bed 0.55
              // measures 2.40:1; 0.9 measures 3.85:1.
              opacity: keyOpacity(t) * 0.9,
              transform: `scale(${popScale(t)})`,
            }}
          />
        );
      })}
    </div>
  );
};

/**
 * One line of closing advice. A tick bar plus text, deliberately NOT a rounded
 * card — the beat already has a dozen filled rectangles on screen and two more
 * panels would turn the frame into a dashboard.
 *
 * TWO reveals, not one: the tick + the code word dock in on `t`, and the
 * qualifying clause wipes in later on `tailT`. Both halves are spoken ~25
 * frames apart ("the vector's your default"; "pointer-heavy structures / when
 * you've measured yourself a reason"), and revealing the whole row at once left
 * a 90-frame dead stretch at the end of the beat with nothing entering.
 *
 * BOUNDS at the TYPE FLOOR (mono 56 / sans 58): tick 4 + 24 margin puts text
 * at x 968. Row one is "vector" (6 mono chars = 202) + " by default" (319) =
 * x 968-1489, one line. Row two is "pointer-heavy" (437) + " when you’ve
 * measured" (609) + a caret = 1080px, which would end at x 2048 — so that row
 * WRAPS (`tailBelow`) instead of shrinking: code on top, clause indented on
 * the line below, ending at x 1611. The narration's full clause ("when you've
 * measured yourself a reason") is still the keyword compression it always was,
 * not a paraphrase of the claim.
 *
 * The clause uses a clip-path wipe rather than a width animation so the row's
 * layout — and the caret parked at its end — never reflows mid-reveal.
 */
const PracticeRow: React.FC<{
  top: number;
  t: number;
  /** Progress for the trailing clause; a separate content event from `t`. */
  tailT: number;
  tick: string;
  code: string;
  codeColor: string;
  /** Wrap the clause onto its own indented line (see BOUNDS above). */
  tailBelow?: boolean;
  /** Blinking block caret — ambient only, and only on the last line. */
  caret?: boolean;
  children: React.ReactNode;
}> = ({ top, t, tailT, tick, code, codeColor, tailBelow, caret, children }) => {
  const clause = (
    <>
      <span
        style={{
          display: "inline-block",
          ...TYPE.label,
          lineHeight: `${TYPE.label.fontSize}px`,
          color: SECONDARY,
          clipPath: `inset(0 ${100 * (1 - tailT)}% 0 0)`,
        }}
      >
        {children}
      </span>
      {caret === undefined ? null : (
        <span
          style={{
            ...TYPE.label,
            lineHeight: `${TYPE.label.fontSize}px`,
            color: theme.accent,
            opacity: tailT * (caret ? 1 : 0.15),
          }}
        >
          &#9615;
        </span>
      )}
    </>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: DIAG_X,
        top,
        whiteSpace: "nowrap",
        opacity: t,
        // Docks in from the right margin it will rest against, rather than
        // popping: these two rows are one thought arriving in two halves.
        transform: `translateX(${(1 - t) * 22}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 4,
            height: 56,
            borderRadius: 2,
            background: tick,
            marginRight: 24,
          }}
        />
        <span
          style={{
            ...TYPE.annotation,
            fontFamily: MONO,
            lineHeight: `${TYPE.annotation.fontSize}px`,
            color: codeColor,
          }}
        >
          {code}
        </span>
        {tailBelow ? null : clause}
      </div>
      {tailBelow ? (
        <div style={{ marginLeft: 28, marginTop: 4 }}>{clause}</div>
      ) : null}
    </div>
  );
};
