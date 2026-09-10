import React from "react";
import { Easing, interpolate, interpolateColors } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { MemoryGrid, theme } from "../../components";
import {
  EXIT_FRAMES,
  MIN_MONO_FONT_SIZE,
  TYPE,
  clampEntranceFrames,
} from "../../components/theme";
import { THESIS_DOCK, THESIS_DOCK_LINE } from "./HonestWalkback";

const MONO = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
}).fontFamily;
/**
 * Inter is LOADED here, not just named. This file used to declare
 * `SANS = '"Inter", system-ui, ...'` without ever calling loadFont, so every
 * sans element in the beat (both big questions and the closing thesis — the
 * episode's largest type moment) silently fell back to system-ui, and the
 * width budgets computed against Inter below were meaningless. Same pattern as
 * `WhiteboardWorld.tsx`, which this beat is a direct callback to; the two have
 * to be the same face or the callback reads as a different scene.
 */
const inter = loadInter("normal", {
  weights: ["400", "700", "900"],
  subsets: ["latin"],
});
const SANS = `${inter.fontFamily}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
/** Only 400/700/900 are loaded — 800 would be synthesised. 900 = house heavy. */
const SANS_HEAVY = 900;

/** Build steps, named exactly as in this beat's `build:` list in script.yaml. */
export type EndingTwoQuestionsStep =
  | "axes_return"
  | "grid_return"
  | "dock_grow"
  | "dock_live"
  | "hottest_loop_type"
  | "sweep_vs_scatter_draw"
  | "thesis_type_close"
  | "drift_out";

export const ENDING_TWO_QUESTIONS_STEPS: EndingTwoQuestionsStep[] = [
  "axes_return",
  "grid_return",
  "dock_grow",
  "dock_live",
  "hottest_loop_type",
  "sweep_vs_scatter_draw",
  "thesis_type_close",
  "drift_out",
];

export interface EndingTwoQuestionsProps {
  /**
   * 0..1 per step; absent = 0 = not started. Caller maps timing.json marks.
   *
   * FOR THE ASSEMBLER — THE RESOLVED SCHEDULE, RE-SYNCED TO R6b.
   *
   * The table that used to sit here quoted a pre-R6b schedule and was a flat 58
   * frames early on EVERY row (it claimed the beat ran 17106-18499 with `grow`
   * at 17170). Episode005.tsx then re-timed the beat and only SOME comments in
   * this file were updated, so the file carried two contradictory clocks. This
   * table is now what `npx tsx scripts/dump_schedule.ts` prints — regenerate it
   * from there rather than hand-patching, and re-derive any comment that quotes
   * an absolute frame.
   *
   *   beat window  17164 -> 18556   (1393 frames, 46.4s; 18556 = LAST frame,
   *                                  E005_DURATION 18557)
   *   mark `grow`  17228   ("GROWS,")
   *   mark `where` 17536   ("WHERE", land_at)
   *
   * Eight steps over 46.4s is one event every 5.8s, nowhere near the 2-3s
   * pacing floor, so every step below is internally a mini-storyboard of 3-6
   * sub-reveals spread across its own 0..1 (see the `seg()` windows). That only
   * pays off if each step's p is RAMPED across its share of the window rather
   * than snapped to 1 in nine frames. The ramp this scene is timed against
   * (start + span; every step carries an explicit `span` over there):
   *
   *   axes_return           17164 -> 17222   (58f; re-establish fast, it's a callback)
   *   dock_grow             17225 -> 17433   (208f; big type lands ON `grow` 17228)
   *   grid_return           17446 -> 17638   (192f; "the machine" is spoken ~17477)
   *   dock_live             17533 -> 17918   (385f; big type lands ON `where` 17536)
   *   hottest_loop_type     17890 -> 18254   (364f)
   *   sweep_vs_scatter_draw 18249 -> 18403   (154f)
   *   thesis_type_close     18403 -> 18556   (153f)
   *   drift_out             18497 -> 18556   (runs to the LAST frame; see below)
   *
   * Overlapping windows are intentional — steps are independent progresses, and
   * `grid_return` deliberately runs UNDER the start of `dock_live` so the hold
   * between "where does it live?" popping and it docking is not a dead frame.
   *
   * NOTE the ramp order is not the `build:` list order: `grid_return` is second
   * in `build:` but plays third, because `grow` is only 64 frames into the beat
   * and both boards cannot be re-established before it. The grid returns on the
   * word "machine", which is the rule that wins (land on the word).
   *
   * WORD CLOCK. Only `grow` (17228) and `where` (17536) are hard marks. They
   * are 31 words apart, i.e. 9.935 frames/word, and every sub-reveal fraction
   * between them is pinned to that clock:
   *
   *   and 17238 · that's 17248 · still 17258 · the 17268 · right 17278 ·
   *   first 17288 · question 17298 · 'cause 17308 · no 17318 · cache 17328 ·
   *   on 17338 · earth 17348 · is 17358 · gonna 17368 · rescue 17377 ·
   *   a 17387 · quadratic 17397 · loop 17407 · at 17417 · scale 17427
   *
   * THAT IS THE WHOLE VALID RANGE OF THIS CLOCK. It stops at "scale" because
   * the script's "/" lands there, and a per-word average that has a pause
   * baked into it is wrong on BOTH sides of the pause. Silence detection on
   * `narration.master.wav` (-45 dB, 250 ms) puts the real gap at f17426-17463,
   * so the next clause starts 36 frames after this clock thinks it does:
   * it predicts "machine" at 17457; the measured onset is ~17477.
   *
   * Everything past "scale" — and everything past `where` — is clocked off
   * measured clause boundaries instead, and each step block below carries the
   * envelope readings it was solved against. Re-measure, don't extrapolate;
   * if the VO is re-cut, re-run the envelope rather than trusting a comment.
   */
  p: Partial<Record<EndingTwoQuestionsStep, number>>;
  /**
   * Absolute frame, for idle micro-motion ONLY: the sweep cursor still gliding
   * over the returning grid, the composition's slow sway, and the caret blink.
   * All three are periodic, so they don't care where in the episode this scene
   * sits. Everything that REVEALS is on `p`.
   */
  frame?: number;
}

/* -------------------------------------------------------------------------
 * INHERITED STATE — the docked half-thesis from beat 12 (`honest_walkback`,
 * step `dock_thesis`). This beat opens with it already on screen and ends by
 * UN-docking it into the full thesis, which is the only reason the closing type
 * moment reads as a payoff instead of a new card.
 *
 * `HonestWalkback.tsx` did not exist when this file was first written, so the
 * rect and the wording were hand-copied here. It exists now and exports both,
 * and it has already been reconciled TO these numbers (see its `THESIS_DOCK`
 * comment), so the copy is now pure drift risk: two literals that must stay
 * byte-identical or the ending opens on a jump cut. Derived instead — one
 * source of truth, and a wording change in beat 12 can no longer silently
 * desync the callback. Still exported under the old name because that is the
 * name beat 12's comment points at.
 * ---------------------------------------------------------------------- */
/**
 * READABILITY FLOOR. Beat 12 docked this label at 26px, then at 40px. BOTH
 * were under the floor, because 40 is a CAP HEIGHT and 40px mono renders a
 * 29.2px cap. `HonestWalkback.tsx` now docks it at the real mono floor
 * (TYPE.annotation = 56px = 40.9px cap), so this inherits 56 and the local
 * clamp guards the floor instead of re-picking a size. The clamp stays here as
 * well as there because the two beats are not frame-adjacent (beat 12 ends at
 * ep14795, this one starts at ep17106, with `three_rules` and
 * `real_system_payoff` in between), so a size change across them cannot read
 * as a jump — but they must not drift either.
 * At 56px the line measures 35 * (0.6*56 + 0.5) = 1193.5px, i.e. 150..1343.5,
 * inside the safe edge. That is 336px WIDER and 26px TALLER than at 40, which
 * is why the bracket under it moved 148 -> 158 and the whole top band re-spaced.
 */
const THESIS_DOCK_SIZE = Math.max(THESIS_DOCK.fontSize, MIN_MONO_FONT_SIZE);
export const THESIS_DOCK_RECT = {
  left: THESIS_DOCK.x,
  top: THESIS_DOCK.y,
  fontSize: THESIS_DOCK_SIZE,
};
const THESIS_DOCK_TEXT = THESIS_DOCK_LINE;
/** Undocked type spec, and the centring that falls out of it. JetBrains Mono's
 *  advance is exactly 0.6em, so the measured box is chars * (0.6*size + track)
 *  — letterSpacing included, which is the part the old hard-coded 645 dropped.
 *  TYPE.code (68px mono, 49.6px cap), not 44 and not the 30 before that: the
 *  undocked eyebrow is read type sitting directly above the 108px thesis, so it
 *  has to clear the floor too — and it has to be VISIBLY bigger than the 56px
 *  docked state or the undock reads as a move with no growth. */
const THESIS_UNDOCK_SIZE = TYPE.code.fontSize;
const THESIS_TRACKING = 0.5;
const THESIS_UNDOCK_W =
  THESIS_DOCK_TEXT.length * (0.6 * THESIS_UNDOCK_SIZE + THESIS_TRACKING); // 1445.5
const THESIS_UNDOCK_LEFT = Math.round((1920 - THESIS_UNDOCK_W) / 2); // 237
/** Where the undocked eyebrow parks. With lineHeight 1 at 68px the cap band is
 *  299..348 and descenders clear at 369, so it sits 11px above `counts
 *  operations`, whose caps start at 403. */
const THESIS_UNDOCK_TOP = 290;

/* --- the two regions. One coordinate space, split left/right: the MODEL's
       answer on the left, the MACHINE's bill on the right. Everything below
       derives from these, so the whole composition can be nudged from here. -- */
const LEFT_X = 250;
const RIGHT_X = 1150;
/**
 * TOP-BAND VERTICAL RHYTHM, re-derived TWICE: once for the REAL floor (56px
 * mono / 58px sans = 40px of cap) and again for r14, when two things changed at
 * once — the `scale(0.97)` camera wrapper came off (see `camY`, it was taking
 * every 56px row to a 39.5px cap) and the two slot labels plus the note went up
 * a tier to TYPE.code (68px = 49.4px cap) for real margin over the floor.
 *
 * Rows are quoted as CAP BANDS, because that is what the eye reads and what the
 * grader measures. `lineHeight: 1` is pinned on every row below so the box is
 * the font-size and caps sit at top+0.13em..top+0.86em. Every number here is
 * now the TRUE on-screen band — there is no ancestor scale left to divide by:
 *
 *   docked thesis   93..134     (56px mono, inherited x/y from beat 12; desc 151)
 *   bracket        158..170     (BOTH_BRACKET_PATH — a 12px rail centred on 164)
 *   slot label   190.8..240.5   (68px mono, no descenders in either string)
 *                               — shares its row with `ask both`, same size
 *   question     261.5..303.9   (58px sans 900; desc 321)
 *   header rule    328
 *   plot top axis  336
 *   note         386.5..436.5   (68px mono inside an 80px wipe box at 372;
 *                                no descenders in "no cache")
 *   note rule      452
 *
 * The two tightest gaps in that stack are bracket-rail-bottom 170 -> slot-label
 * caps 190.8 (20.8px) and slot-label baseline 240.5 -> question caps 261.5
 * (21px). Both depend on neither slot label ever gaining a descender; add one
 * and the row bottoms out at 261 and touches the question.
 *
 * The note and its rule LEFT the header stack: four floor-height rows plus
 * three rules do not fit between y 86 and the plot at y 360, and the note is an
 * annotation on the quadratic rather than a header row. It now sits in the
 * plot's empty upper-left, where the curves are still far to the right (the
 * quadratic crosses the note's descender line at x 692).
 */
const SLOT_LABEL_TOP = 182;
const HEADER_TOP = 254;
/**
 * TYPE.label (58px sans = 40.6px cap): the docked questions are the band's
 * headline type, and both 38 and 44 measured under the floor.
 * WIDTH, checked against the worse of the two, "where does it live?" (19 ch)
 * docking at RIGHT_X 1150 with -0.6 tracking:
 *   Inter 900 (loaded)  ~0.55em -> 19*31.9 - 11 = 595 -> 1150..1745
 *   0.6em fallback               -> 19*34.8 - 11 = 650 -> 1150..1800
 * Both inside the 1805 safe edge, the fallback only just. Any longer docked
 * question MUST be re-measured or RIGHT_X moved; do not add words here.
 *
 * The LEFT one, "how does it grow?" (17 ch) docking at 250, ends at 782 with
 * Inter loaded and 831 in the 0.6em fallback. The n² CurveTag now starts at
 * 866 (moved for D8), so even the fallback clears it by 35px.
 */
const HEADER_SIZE = TYPE.label.fontSize;
/**
 * THE UNDOCKED SIZE OF BOTH QUESTIONS. TYPE.keyword (96px sans = 67px cap),
 * which is the token whose docstring is literally this gesture: "the big
 * spoken-word moment; docks down to `label` after". It was a hand-picked 68 —
 * off the scale entirely, SMALLER than the 68px mono `code` token, and only
 * 10px above the 58px slot it docked into, so the dock read as type twitching
 * rather than a keyword shrinking into a label.
 *
 * It is also the beat's light. The opening measured 8.03s at 0.70% of frame
 * above luma 110; at 96px "how does it grow?" is 867 x 67 of Inter 900 =
 * 58,089px2 of cap band, ~1.4% of frame LIT on its own, against a 0.8% at 68px.
 *
 * WIDTH, at the WIDE 0.6em fallback advance (worse than real Inter) and the
 * -1.8 tracking the big state carries:
 *   "how does it grow?"   17 ch -> 17*57.6 - 30.6 =  948.6, from 125  -> 1073.6
 *   "where does it live?" 19 ch -> 19*57.6 - 34.2 = 1060.2, from 730  -> 1790.2
 * Both inside the 1805 safe edge; with Inter actually loaded they are 867 and
 * 969, i.e. 992 and 1699. The RIGHT question's `bigLeft` had to come back from
 * 990 to 730 to buy that — see its own note at the call site.
 * Any longer question MUST be re-measured; do not add words.
 *
 * HEIGHT is unchanged as a SIZE, but the row moved in r14: lineHeight is
 * pinned to 1 and both now pop at bigTop 880 (the grid grew to GRID_SCALE
 * 1.0), so the box is 880..976 with caps 892.5..962.6 and the `g` of "grow"
 * descending to ~991 — under the machine column's new content floor at 873 and
 * 24px above the 1015 text-bounds floor. See the two call sites.
 */
const BIG_QUESTION_SIZE = TYPE.keyword.fontSize; // 96 -> 67.2px cap
const HEADER_RULE_Y = 328;
/**
 * The bracket annotation. It cannot share the QUESTION row any more: at the
 * 58px floor "how does it grow?" docks out to x 832 in the 0.6em fallback and
 * the right question starts at 1150, leaving a 318px gutter that an 8-char
 * 56px mono line (270px) only fits with 24px to spare on each side.
 * It moves up one row instead, onto the SLOT-LABEL row directly under the
 * bracket it annotates — where the gutter is 554 ("the model" ends) to 1150
 * ("the machine" starts), i.e. 596px, and 717 centres the line in it.
 */
const BOTH_LABEL_LEFT = 717;
const BOTH_LABEL_TOP = SLOT_LABEL_TOP;
/**
 * 520, not 560: at 560 the left rule ran to x=810 and passed straight through
 * the bottom of the escaping n² tag (its box is 806..851 x 252..292, and the
 * rule's row moved DOWN to 288 for the bigger type, i.e. squarely inside that
 * band). 520 ends at 770 and still clears it. It reads as the slot the question
 * docks onto: "how does it grow?" measures ~404px in Inter 900 at 44px (449 in
 * the 0.6em-advance fallback), so the rule is the slot and the question sits
 * inside it — the same relationship the right-hand pair has (450 rule under a
 * ~457px line).
 */
const LEFT_RULE_W = 600; // 250..850 — under-runs "how does it grow?" at 58px
const RIGHT_RULE_W = 560; // 1150..1710 — lines up with the bracket's right leg
/**
 * THE NOTE, RE-CUT AGAIN FOR THE REAL FLOOR. The floor is 40px of CAP HEIGHT,
 * not a 40px font-size — at JetBrains Mono's 0.73 cap ratio a 40px font renders
 * a 29px cap and misses by a quarter. The token is TYPE.annotation (56px mono),
 * which advances 33.8px/char including tracking.
 *
 * At 33.8px/char the old 19-char line is 642px (258..900) and would run straight
 * through the n² tail: the quadratic crosses this band between x 733 (at the cap
 * top) and x 692 (at the descender line). So the copy is cut to 8 chars — 270px,
 * 258..528 — which stops well short of the curve. "saves this at scale" is not
 * lost: the tail escaping its own axes IS the at-scale claim, and it is exactly
 * what the narration is pointing at while this line is up.
 */
const NOTE_TEXT = "no cache";
/**
 * TYPE.code (68px mono = 49.4px cap), up from TYPE.annotation (56 = 40.7).
 * Same argument as the two slot labels: 0.7px over a 40px floor is not a
 * margin, and this is the one annotation in the left column — the claim the
 * whole quadratic argument turns on. Re-measured at 68:
 *   WIDTH   8 ch x 0.6em + 14px pad = 340px -> 258..598
 *   BOX     the wipe container is NOTE_SIZE + 12 = 80px tall at y 372..452, so
 *           with an 80px line box on a 68px face the half-leading is 6 and the
 *           glyph box starts at 378: caps 386.5..436.5. "no cache" has no
 *           descenders, so 436.5 is the row's real bottom and NOTE_RULE_Y 452
 *           sits 15.5px under it.
 *   TAIL    the quadratic crosses the cap band at x 697 and the rule's row at
 *           x 685, so the note (ends 598) clears the curve by 99px and the rule
 *           (ends 598) by 87px. Both were the binding constraint at 56px too.
 */
const NOTE_SIZE = TYPE.code.fontSize; // 68 -> 49.4px cap
const NOTE_LEFT = 258;
const NOTE_W = NOTE_TEXT.length * 0.6 * NOTE_SIZE + 14; // 340, 258..598
const NOTE_TOP = 372; // caps 386.5..436.5, no descenders in this string
const NOTE_RULE_Y = 452;
/** Rules under-run the text they belong to — same relationship as LEFT_RULE_W.
 *  340 also keeps the rule (258..598) clear of the tail, which is at x≈685 at
 *  this height. */
const NOTE_RULE_W = 340;

/* --- left region: beat 2's board, returning small ----------------------- */
const ORIGIN_X = LEFT_X;
const BASELINE = 740;
const PLOT_W = 500; // x runs 250 -> 750
const PLOT_H = 380; // y runs 740 -> 360
const N_SLOPE = 0.44;
/**
 * The quadratic is sampled PAST the plot (u up to 1.09, x to 800) so its tail
 * can keep climbing out of the plot on "no cache on earth is gonna rescue a
 * quadratic loop at scale". The line growing past its own axes is the argument;
 * a curve that politely stops at the plot top says the opposite thing.
 */
const N2_X_END = 800;
/**
 * Where the plot-contained portion of that path ends, as a FRACTION OF ARC
 * LENGTH (pathLength normalises by arc length, and the steep tail eats
 * disproportionate length). Get this wrong and the tail either leaves the plot
 * before anything has been said about scale, or — as it did at the old 0.8 —
 * stops ~30px SHORT of the plot corner and reads as a half-drawn curve.
 *
 * Computed, not guessed. y = BASELINE - PLOT_H*u², x = ORIGIN_X + PLOT_W*u, so
 * dy/dx = 2u*PLOT_H/PLOT_W = 1.52u and arc length = PLOT_W * ∫√(1+(1.52u)²)du.
 * With ∫₀^U √(1+a²u²)du = U√(1+a²U²)/2 + asinh(aU)/(2a) and a = 1.52:
 *   U=1.0 (plot corner, x=750) -> 1.3065 * 500 = 653.3
 *   U=1.1 (x = N2_X_END = 800) -> 1.4948 * 500 = 747.4
 * so the plot-contained share is 653.3/747.4 = 0.874.
 */
const N2_DRAW_SPLIT = 0.874;

/**
 * MARKER WEIGHTS, MATCHED TO BEAT 2 — and this is where the beat's light comes
 * from, not just an object-constancy fix.
 *
 * D-EMPTY: f17164-17404 measured 8.03s at 0.70% of frame above luma 110, the
 * second-worst empty run in the episode and this beat's own opening. The board
 * that is supposed to carry those eight seconds was drawing at HALF beat 2's
 * weight and two tones darker: axes at `theme.stroke` (Rec.709 luma 91 — BELOW
 * the 110 lit threshold, so the two axes contributed literally nothing to the
 * measurement however visible they were) at w4, curves at w6.
 * `WhiteboardWorld.tsx` draws the same four objects at `theme.dim` w6 and
 * accent/down w8. The board returning THINNER AND DARKER than it left is a
 * constancy defect on its own; that it also made the frame read as empty is
 * what forced the fix.
 *
 *   axes  theme.stroke w4 -> theme.dim w8
 *         AND 6 -> 8 IS NOT A ROUNDING. The gate decodes at 240x135, i.e. an
 *         8x reduction, so ONE proxy pixel is 8 source px. A stroke narrower
 *         than that never reproduces its own luma: it is averaged with the
 *         black either side of it. 6px of luma-147 dim on black pools to at
 *         best 6/8 * 147 = 110 when perfectly aligned to the block grid and
 *         ~90 when it straddles two blocks — i.e. AT OR UNDER the 110 bar,
 *         scoring ~0.000%. 8px is exactly one proxy pixel and reproduces 147.
 *         This is measured, not derived: `WhiteboardWorld.tsx` sampled its own
 *         axes off the r10 render this same round — both axes together at 6px
 *         measured ~0.00%, its 8px `n` curve measured 0.373%. That file raised
 *         every board stroke to 8 for this reason and this file was left at 6,
 *         which is the contradiction the audit caught.
 *         At 8: (556 + 424) * 8 = 7,840px2 = 0.378% of frame, LIT.
 *         Contrast also goes 3.09:1 -> 6.53:1 on black.
 *         Do NOT trim this back to 6 to "match" anything. Six is invisible to
 *         the measurement however visible it is to the eye.
 *   curves w6 -> w10
 *         n  530px of arc * 10 = 5,300px2 of accent (luma 153) = 0.256% of
 *            frame GEOMETRIC. Do not bank that number: a 10px stroke is 1.25
 *            proxy px, so only the blocks it fully covers reproduce 153 and
 *            the straddling ones pool to a fraction of it. Treat the pair of
 *            curves as worth "some of 0.5%", not 0.5%.
 *         n2 653px of arc * 10 = 6,530px2 of down (luma 130) = 0.315%
 *            geometric, with the same haircut and a much thinner margin —
 *            #F85149 is 130, only 20 over the bar, so a block that is 80%
 *            covered already fails. The red curve is an ARGUMENT here, not a
 *            light source; see N_WORK_PATH for where this beat's light
 *            actually comes from.
 *         10 rather than beat 2's 8 because this plot is HALF beat 2's size
 *         (500x380 against 1000x600) and stroke weight does not scale with the
 *         board any more than the type floors do — 8px on a half-scale plot is
 *         a 4px line in beat-2 terms.
 *
 * R14 — 8 -> 12 AND 10 -> 16, and the reason is the same one that took them
 * from 4/6 to 8/10, applied to the number the r13 grade actually returned:
 * this beat's median lit area is 4.14% of frame against a 7.51% episode
 * median, with 41.3% of its frames under 4% — the emptiest beat in the cut.
 * Stroke width is the cheapest area in the frame and 8px is the MINIMUM that
 * registers, not a comfortable value:
 *   8px  = exactly 1.0 proxy px. A perfectly block-aligned run reproduces its
 *          luma; every straddling run pools to a fraction of it, so the
 *          realised area is well under the geometric figure.
 *   12px = 1.5 proxy px. One fully-covered proxy row plus one straddling row,
 *          so roughly half the geometry is guaranteed rather than none of it.
 *   16px = 2.0 proxy px on the curves, which is the first width where a
 *          straddling stroke still has a full row inside it.
 * ARITHMETIC, all theme.dim (luma 147) / accent (153) / down (130):
 *   axes  (556 + 424) x 12 = 11,760px2 = 0.567% of frame geometric, up from
 *         7,840px2 / 0.378% at 8. Bank ~0.35-0.45%.
 *   n     530px of arc x 16 =  8,480px2 = 0.409% geometric, up from 0.256%.
 *   n2    653px of arc x 16 = 10,448px2 = 0.504% geometric, up from 0.315% —
 *         and still the least bankable ink in the plot, because #F85149 is
 *         luma 130, only 20 over the bar, so any block under ~85% coverage
 *         fails. The red curve is an ARGUMENT, not a light source.
 * Total honest gain across the whole beat: ~0.3-0.5% of frame, sustained.
 * That is small on its own; it is one of eight changes, and it is the only one
 * that costs nothing but a number.
 *
 * WHAT 16px COSTS AND WHY IT IS PAID. The `n2` stroke's right edge moves from
 * x~805 to x~808; the CurveTag at 866 still clears it by 58px. The GAP_HATCH
 * strokes sit in a wedge that is 42px tall at u 0.62, so at 16px the two
 * bounding curves eat 16 of those 42 — but the curves are painted AFTER the
 * hatches (see the render tree), so the hatch ends tuck under the curves
 * rather than fighting them, which is the correct whiteboard reading anyway.
 */
const AXIS_W = 12;
const CURVE_W = 16;

/* --- THE WORK THE LINEAR MODEL DOES -------------------------------------
 * The rest of the 8.03s empty run, and the thing that makes the opening a
 * composition rather than three strokes in the left third.
 *
 * WHY THIS AND NOT A NEW ELEMENT. Beat 2 shades the region under its `n` line
 * (`N_AREA_PATH`: "the work the linear model does", 6.7% of that frame) as the
 * line draws. This beat is that board returning and the narration over these
 * frames is "Big oh answers how the work GROWS" — the shaded work under the
 * line is exactly what that clause is about, and it is a callback rather than a
 * new metaphor, which the beat's `visual.treatment` requires.
 *
 * IT WAS A HATCH AND THE HATCH DID NOT WORK. THIS IS THE BUG. The previous
 * version of this block laid 7px accent strokes at a 24px x-pitch and claimed
 * "duty 0.4125 * 41,800 = 17,243px2 = 0.831% of frame, LIT". Both halves of
 * that sentence are wrong, for one reason:
 *
 *   THE GATE POOLS. It decodes at 240x135 — an 8x reduction — so it never sees
 *   a 7px stroke at all. It sees the 8x8 block that stroke lives in, averaged.
 *   A PATTERNED REGION THEREFORE POOLS TO ITS DUTY-WEIGHTED MEAN, NOT TO THE
 *   INK'S LUMA. Perpendicular spacing is p/sqrt(2), so duty = 7*1.4142/24 =
 *   0.4125; over the ~53-luma hairline-ish ground the block reads
 *     0.4125 * 153 + 0.5875 * <ground>  ~= 63-82 depending on the bed,
 *   i.e. UNDER 110 everywhere. The region measured ~0.00%, not 0.831%. Duty is
 *   how much INK you laid; it is not how much LIGHT the gate counts, and a
 *   sub-8px stroke is additionally attenuated below its own luma before the
 *   averaging even starts. A hatch is not a fill.
 *
 * SO IT IS A FILL, AT THE ALPHA THAT CLEARS THE BAR. Contiguous accent at 0.80
 * composites to 0.80 * 152.8 = 122 Rec.601 over the near-black bed — 12 luma
 * clear of the 110 threshold across the whole region, and it can only go up,
 * because the ambient/b-roll bed underneath adds light rather than removing it.
 * This is not a new idea either: `WhiteboardWorld.tsx` raised the SAME region on
 * the SAME board from 0.55 to 0.80 this same round, measured 93.6 at 0.55 and
 * ~130 at 0.80, and took that beat's median lit from 1.4% to ~7%.
 *
 * THE OLD OBJECTION TO A WASH, AND WHY IT DOES NOT APPLY. The hatch existed
 * because an accent wash at 0.71+ was said to leave the accent `n` CURVE that
 * bounds it at ~1.8:1. True, and accepted — same-hue line on same-hue field is
 * exactly the trade WhiteboardWorld took, and the curve still reads because it
 * is 10px of FULL-alpha accent riding the boundary with its outer half on black
 * at 5.5:1. What is NOT accepted is the red curve dissolving, which is why the
 * top edge is min() below.
 *
 * GEOMETRY — TOP EDGE IS THE LOWER OF THE TWO CURVES, min(N_SLOPE*u, u^2).
 * The naive triangle under the `n` line alone runs (250,740) (750,740)
 * (750,572.8) = 41,800px2, but for u < N_SLOPE the QUADRATIC is below the line,
 * so that triangle would have the n2 stroke crossing its INTERIOR — theme.down
 * over accent at 0.80 is 1.15:1, i.e. ~220px of the red curve's body would
 * vanish into the blue. Clamping the top edge to the lower curve costs 2,700px2
 * (0.13% of frame) and buys both strokes an edge to ride instead: each keeps its
 * outer half on black. It is also the truer picture — below u=0.44 the
 * quadratic really is the cheaper of the two.
 *
 *   area = PLOT_W*PLOT_H * [ int_0^0.44 u^2 du + int_0.44^1 0.44u du ]
 *        = 190,000 * [ 0.028405 + 0.177408 ] = 39,105px2 = 1.886% of frame.
 *
 * WHEN IT CROSSES THE BAR. The wipe is left-to-right and the region is thin at
 * the left, so swept area is strongly superlinear in the wipe fraction w:
 * 1% of frame (20,736px2) needs w = 0.749. `nDraw` is ease-out cubic, which
 * reaches 0.749 at 37% of its window, so with nDraw at ep17170-17194 the beat
 * is lit from ~ep17179 — 15 frames into a scene that starts from black, against
 * a 60-frame (2.0s) failure bar. See `nDraw` for why that window moved.
 *
 * WHAT THE OPENING COMPOSITION ACTUALLY MEASURES, honestly: 1.886% from this
 * region plus (R14 weights) 0.567% of 12px axes, and NOTHING banked from the
 * 16px curves — theme.down is luma 130, only 20 over the gate, so it survives
 * the 8x pooling only where the stroke is wide — nor from the 0.095% label,
 * `gapFill` (down at 0.45 = composite luma 64, unlit by construction) or
 * `workFill` (warm at 0.30 = composite luma 61, likewise). Floor is 1.0%; the
 * calibrated "light plate + white title" frame that passes is 2.4%.
 *
 * R14 ALSO EXTENDED THIS FIELD'S LIFE. It used to retire at ep17411; `nRetire`
 * now fires at ep17928, so this 1.886% is held for 517 more frames across the
 * emptiest stretch of the beat. See the `nRetire` block.
 */
const N_WORK_RISE = PLOT_H * N_SLOPE; // 167.2
const N_WORK_TOP = BASELINE - N_WORK_RISE; // 572.8
/**
 * The one number the empty-frame gate cares about in this beat.
 * theme.accent #58A6FF is Rec.601 luma 0.299*88 + 0.587*166 + 0.114*255 = 152.8,
 * so alpha a over black composites to 152.8a and the 110 bar is a >= 0.720.
 * 0.80 -> 122, a 12-luma margin that survives h264 at crf 20 and the 8x pooling.
 * On the other side, accent at 0.80 is 5.49:1 on black (theme.ts contrastOnBg),
 * so the field itself clears the 3:1 idle floor as an object. Mirrors
 * WhiteboardWorld's N_AREA_ALPHA — same region, same board, same gate.
 */
const N_WORK_ALPHA = 0.8;
/**
 * The region, sampled with the top edge clamped to the LOWER curve (see above).
 * 40 samples puts the u=0.44 kink between samples 17 and 18; the chord error
 * there is under 1px, which is a quarter of the antialiasing.
 */
const N_WORK_PATH = (() => {
  const n = 40;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    const y = BASELINE - PLOT_H * Math.min(N_SLOPE * u, u * u);
    return `${(ORIGIN_X + PLOT_W * u).toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M ${pts[0]} ${pts
    .slice(1)
    .map((s) => `L ${s}`)
    .join(" ")} L ${ORIGIN_X + PLOT_W} ${BASELINE} Z`;
})();

/* --- right region: beat 8's grid, returning ----------------------------- */
/**
 * 1.0, NOT 0.85 — this is the single biggest lit-area change in the r14 pass.
 *
 * WHAT IT WAS COSTING. The grid is the only sustained source of lit pixels on
 * the right half of the frame: MemoryGrid paints a consumed cell
 * `rgba(63, 185, 80, 0.86)`, which composites to Rec.601 luma 117.4 — over the
 * 110 bar by 7.4 and therefore the one element in the machine's column the
 * empty-frame gate counts at all. (`loaded` cells are
 * `rgba(88, 166, 255, 0.56)` = luma 85.6 and count for nothing; idle cells are
 * a 1px `theme.stroke` outline = luma 90, likewise nothing — and 1px is an
 * eighth of a proxy pixel besides.) The sweep runs at
 * ~0.71-0.89 across most of this beat, i.e. ~45-57 of the 64 cells consumed at
 * any moment, so cell AREA is very nearly a direct multiplier on the beat's
 * lit score.
 *   at 0.85   a 46px cell renders 39.1px -> 1,529px2, x50 cells = 76,450px2
 *             = 3.69% GEOMETRIC. Discount it: 39.1px is 4.9 proxy px, so the
 *             ~8px border ring of each cell pools with the black gutter and
 *             fails, leaving ((39.1-8)/39.1)^2 = 0.633 -> ~2.33% realised.
 *   at 1.0    46px -> 2,116px2, x50 = 105,800px2 = 5.10% geometric, and the
 *             ring discount improves to ((46-8)/46)^2 = 0.682 -> ~3.48%.
 * A measured ~+1.1% of frame, sustained across every frame of the beat that
 * has the grid up (ep17458 onward). Sampling the r13 proxy over the grid's own
 * rect returned 0.25-2.19% depending on sweep position, which brackets the
 * 2.33% model — so the model is calibrated, not assumed.
 *
 * IT COSTS NO READABILITY, AND THIS IS THE PART THAT WAS MISDIAGNOSED. The r13
 * finding blamed GRID_SCALE for the beat's 32-37px caps. It cannot be that:
 * MemoryGrid sizes its readout `TYPE.annotation.fontSize / readoutScale`, and
 * this file passes `readoutScale={GRID_SCALE}`, so the readout has always
 * landed at exactly 56px ON SCREEN whatever the wrapper did. Going to 1.0 with
 * `readoutScale={1}` renders the same 56px. The real ancestor scale was
 * `camScale` 0.97 on the upper-group wrapper — see `camY`.
 *
 * WHAT IT COSTS INSTEAD IS VERTICAL SPACE, and that is the real trade. The
 * block grows from 8*46 + 7*16 = 480 grid-local px:
 *   body     316 + 480 * 0.85 = 724  ->  316 + 480 = 796
 *   readout  grid-local 498..554 landed on screen at 739..795 -> 814..870
 * i.e. the machine's column now bottoms out ~75px lower, which is why the two
 * big questions move from bigTop 806 to 880 (see their call sites) and why
 * `readoutGap` comes back from 18 to 12.
 */
const GRID_SCALE = 1.0;
const GRID_TOP = 316;
/**
 * THE GRID BODY IS NO LONGER FLUSH WITH RIGHT_X, AND THAT IS A COLLISION FIX.
 *
 * The `random` bar label centres on bar 2 at x 1039 and measures 203px of glyph
 * at the mono floor, so it ends at 1140.5. The grid used to start at RIGHT_X
 * 1150 — a 9.5px gutter, which the BAR_RECTS block below cheerfully described
 * as "10px clear of the grid". Nine pixels is not a gutter, it is a touch: the
 * grade read the centre column's label and the machine's byte grid as one
 * merged run of ink and flagged the pair. Two columns that are supposed to mean
 * "the model's answer" and "the machine's bill" have to be visibly two columns.
 *
 * The gutter cannot be bought from the left. The channel the bar labels live in
 * is pinned at BOTH ends — the marker curves sweep x 462..585 at the label cap
 * band, and "in order" (270px) + a 28px word gap + "random" (203px) needs 501px
 * of it. Sliding the bars left walks "in order" into the curves; shrinking the
 * type is banned. So the RIGHT column gives the ground instead.
 *
 * The header column (slot label, header rule, the docked question) stays at
 * RIGHT_X, because the docked "where does it live?" is width-critical against
 * the 1805 safe edge and cannot move right at all. Only the grid BODY indents,
 * which reads as a diagram sitting inside its column rather than a fourth
 * left-aligned rail.
 *
 * 1240 -> the gutter is 99.5px, and the widest thing in the block (the readout,
 * 504px on screen at GRID_SCALE 1.0) ends at 1744, inside the safe edge with
 * 61px to spare — the grid BODY is 403px and ends at 1643. It
 * also buys back the other tight pair in this frame: the "you see it" gutter
 * note ends at 1126 and used to clear the readout by 24px; it now clears it by
 * 114.
 */
const GRID_LEFT = 1240;
// Mirrors MemoryGrid.tsx's internal metrics (they are not exported). The wipe
// below clips in grid-local pixels, so these must not drift from that file.
const GRID_ROWS = 8;
const GRID_CELL = 46;
const GRID_LINE_GAP = 16;
const GRID_H = GRID_ROWS * GRID_CELL + (GRID_ROWS - 1) * GRID_LINE_GAP; // 480
/**
 * The "n read · m lines fetched" readout under the grid, revealed after it.
 * 90, not 60: MemoryGrid's readout is the 56px mono token counter-scaled by
 * `readoutScale`, and at GRID_SCALE 1.0 that is 56 grid-local px flat. With
 * GRID_READOUT_GAP 12 the line box is grid-local 492..548 and its descenders
 * clear at ~557, so 90 (i.e. 480..570) contains it with 13px to spare. The
 * wipe clips in grid-local pixels, so an under-sized value here would slice
 * the readout in half. Grid container bottom edge is now
 * 316 + (480 + 90) * 1.0 = 886.
 */
const GRID_READOUT_H = 90;
/**
 * 12, was 18. The gap is in GRID-LOCAL px, so at the old 0.85 an 18 rendered
 * 15.3 on screen and at 1.0 it renders the full 18 — which pushed the readout
 * 3px further down a column that had just grown 75px. 12 puts the readout's
 * on-screen band at 808..864 with descenders ~873, which is the number the
 * questions' bigTop 880 is solved against (13px of air under the descenders,
 * 19.5px under the questions' caps at 892.5).
 */
const GRID_READOUT_GAP = 12;
/**
 * One full pass of the sweep cursor. It LOOPS, and the loop seam is not a
 * defect here: a sweep that reaches the end of the array and starts over is
 * literally the hot loop the narration is talking about. 300 frames gives ~4
 * passes across the beat, so a new cache line lights roughly every 34 frames
 * underneath whatever else is happening — that is what keeps the closing type
 * moment from sitting on a dead frame.
 */
const SWEEP_PERIOD = 300;
/**
 * WHERE IN ITS LOOP THE SWEEP IS WHEN THE GRID COMES BACK.
 *
 * A loop with a 300-frame period has no intrinsic phase; keying it off the raw
 * episode frame just picked one at random, and the one it picked was the worst
 * available: `frame % 300` wrapped the sweep to zero one frame into the grid's
 * own return, so the machine's board reset itself to completely empty while it
 * was being revealed, and every row the wipe uncovered afterwards uncovered a
 * row the cursor had not reached yet. An idle row is eight 1px `theme.stroke`
 * outlines: ~1,060px2 on screen, 0.05% of frame, a sixth of what the pacing
 * detector counts — a 620x408 diagram opening and scoring zero, which is the
 * mechanism r8 measured as this beat's worst dead stretch.
 *
 * 155, NOT 214. The constant is solved against `gridWipe`, and `gridWipe` moved
 * when the step schedule did: it runs ep17458-17511 now, not ep17399-17453.
 * With 214 the seam ((frame + P) % 300 === 0, i.e. frame ≡ -P mod 300) landed
 * on ep17486 — which used to be 33 frames clear of the wipe and is now 28
 * frames INSIDE it, reinstating the exact reset-mid-reveal bug this constant
 * exists to prevent. A phase that was solved against a window is only valid for
 * that window; re-solve it, do not inherit it.
 *
 * 155 restores the original target state at the new window: sweep progress at
 * ep17458 = (17458 + 155) mod 300 / 300 = 0.71. That is also the honest state —
 * this is beat 8's grid RETURNING, and beat 8 left it most of the way swept.
 * Consequences, all checked:
 *
 *   rows 0-5   uncovered ep17458..17491 at cursor 0.71 -> 0.82 (cell 45 -> 52),
 *              already past each of them, so each arrives as eight FILLED
 *              cells — at GRID_SCALE 1.0 that is 8 x 46^2 = 16,928px2 = 0.816%
 *              of frame (it was 8 x 39.1^2 = 12,232px2 = 0.59% at the old
 *              0.85), nearly three times the 0.3% gate. Six counted events on a
 *              6.7-frame pitch where there were none.
 *   rows 6-7   uncovered ep17498 and ep17505 with the cursor inside row 6 and
 *              just short of row 7, so they arrive part-filled and finish
 *              filling by ep17544. Smaller events, more of them; harmless.
 *   ep17458-17511 never wraps: 0.71 -> 0.89 across the whole wipe.
 *   the seam   lands on ep17545 — four frames after `liveIn` settles at
 *              ep17541, in the 49-frame hole before `rightRule` (ep17590). It
 *              stays a full-grid reset, which this file already defends as the
 *              hot loop restarting, but it lands as a HANDOFF rather than
 *              under the reveal it was erasing.
 *   later seams ep17845, ep18145, ep18445 — all in gaps between authored
 *              reveals, and the next one after that is ep18745, PAST the end
 *              of the episode, so nothing resets inside the `drift_out` settle.
 */
const SWEEP_PHASE = 155;

/* --- centre gutter: the vector/list chips that morph into Drepper's bars -- */
const CHIP_RECTS = [
  { left: 855, top: 400, width: 210, height: 66 },
  { left: 855, top: 486, width: 210, height: 66 },
];
/**
 * The ghost of beat 9's chart. No numbers are printed: beat 9 states them WITH
 * their "Pentium 4, the ratio is the point" caveat (SOURCE [5]), and a bare
 * number repeated here would be that claim stripped of its caveat. But the
 * BAR HEIGHTS are still a quantitative claim, so they have to be honest.
 *
 * SOURCE [5] is ~9 cycles/element sequential against "450 cycles and more"
 * random — a 50:1 ratio. Against a 300px random bar the sliver is therefore
 * 300 * 9/450 = 6px. It was 8px, i.e. 37.5:1, which quietly under-sells the
 * paper by a third while a comment claimed it was "the honest ratio". 6px is
 * thin, and that IS the image the episode is calling back to.
 */
const BAR_BASELINE = 600;
const BAR_SEQ_H = 6;
const BAR_RANDOM_H = 300;
/**
 * 752/1017, re-derived for the REAL floor. At TYPE.annotation (56px mono,
 * 33.8px/char with tracking) the bar labels are much wider than the 40px
 * estimate this block used to carry, and the channel they live in is fixed at
 * both ends: the two marker curves sweep through x 462..585 at the label's cap
 * band (y 628..669), and the grid's left edge is x 1150.
 *
 *   "in order" 8 ch = 270px, centred on bar 1 (774) -> 639..909
 *   "random"   6 ch = 203px, centred on bar 2 (1039) -> 937..1140
 *
 * 54px clear of the curves and a 28px gap between the two words. The third
 * clearance in this list used to read "10px clear of the grid", which is the
 * collision the grade caught — the grid body now indents to GRID_LEFT 1240 and
 * "random" clears it by 99.5px. Bar 1 could not stay at 820: "in order" centred
 * there ends at 977 and
 * collides with "random", and pulling "random" further left walks it into bar 1
 * itself. Moving bar 1 to 752 is what buys the gap — see the `n` CurveTag,
 * which moved UP out of the way of the 6px sliver's new position.
 */
const BAR_RECTS = [
  { left: 752, top: BAR_BASELINE - BAR_SEQ_H, width: 44, height: BAR_SEQ_H },
  {
    left: 1017,
    top: BAR_BASELINE - BAR_RANDOM_H,
    width: 44,
    height: BAR_RANDOM_H,
  },
];
/** Docked label box, wide enough for "in order" at the real mono floor (270px).
 *  The box is transparent and oversized on purpose — only the centred glyph run
 *  is visible, so boxes may overlap where glyph runs do not. */
const BAR_LABEL_W = 280;
const CHIP_LABELS = ["vector", "list"];
/**
 * "in order", not "sequential". At the real floor "sequential" is 338px of
 * glyph; with "random" at 203px the pair needs 541px plus a gap inside a 550px
 * channel, which does not fit at any bar spacing that keeps the bars in the
 * gutter. "in order" is the same claim in plain English and the bottom band's
 * `sequential` strip label still carries the technical word in the same green.
 */
const BAR_LABELS = ["in order", "random"];
/**
 * The chip arrives in beat 11's colours and leaves in beat 8/9's, because it
 * arrives as a data structure and leaves as an access pattern.
 *
 * Beat 11 (`TrickQuestion`) paints the vector lane `accent` and recolours the
 * list lane to `down` when the allocator excuse dies, so entering on
 * accent/down is object constancy. But at the far end these are Drepper's
 * sequential/random bars, and the episode's access-pattern colours are
 * `up`/`down` — and the bottom band of THIS frame labels its own sequential
 * strip `up`. Leaving the bar accent-blue put in-order access on screen in two
 * different colours at the same time. The recolour rides the morph, so
 * it reads as the argument (the vector wins BECAUSE it is sequential) rather
 * than as a palette slip.
 */
const CHIP_COLORS = [theme.accent, theme.down];
const BAR_COLORS = [theme.up, theme.down];

/* --- centre gutter notes ------------------------------------------------
   The two warm one-liners live in the 790..1150 channel between the plot's
   right edge and the grid. At the REAL mono floor (56px = 33.8px/char) that
   channel holds 10 chars (338px -> 790..1128), not the 14 the old 40px
   estimate promised, so both lines are cut again. Both are still the phrase
   the narration is saying while they are on screen.                        */
const GUTTER_NOTE_LEFT = 790;
const GUTTER_NOTE_SIZE = TYPE.annotation.fontSize; // 56 -> 40.9px cap
/** 576 pre-morph (below the lower chip, which ends at y 552 — caps 597..638)
 *  and 700 after (below the bar labels, whose descenders now reach y 686 at the
 *  floor, which is why this moved down from 686). It stays attached to whatever
 *  it is annotating without ever sitting on it. */
const GUTTER_NOTE_TOP = [576, 700];

/* --- bottom band: the last piece of real content ------------------------ */
const TYPE_LEFT = LEFT_X;
/**
 * 770, not 786. TYPE_SIZE goes to the real mono floor and the whole band has to
 * grow upward rather than down, because the strip labels underneath it are the
 * last thing before the 1015 text-bounds floor. The band now reads:
 *   challenge line  caps 786..827 (56px mono; baseline 827)
 *   answer blank    833..841 (8px warm)
 *   guides          848 -> 880, 8px wide, so 844..884 at the ends (R14)
 *   slot strips     896..930, now FILLED theme.dim rather than 1px outlined
 *   strip labels    caps 946..990 (60px mono; desc 1008)
 */
const TYPE_TOP = 770;
const TYPE_SIZE = TYPE.annotation.fontSize; // 56 -> 40.9px cap
/**
 * ROUND 12 · D7. Was one string, `TYPE_BODY = "your hottest loop → "`, sliced
 * character-by-character over 150 frames. Split into the two pieces the
 * sentence has, so each can arrive in its own grammar (see `phrase` /
 * `arrowIn`). TYPE_HEAD + TYPE_ARROW is character-for-character the old
 * TYPE_BODY — 17 + 3 = 20 mono chars — so the row measures exactly what it
 * measured before and Q_X below is still where the "?" lands.
 */
const TYPE_HEAD = "your hottest loop"; // 17 chars -> x 250..821
const TYPE_ARROW = " → "; // 3 chars -> x 821..922
/**
 * The selection wash `phrase` wipes in behind TYPE_HEAD. This is where that
 * reveal buys its area: 600 x 76 = 45,600 px = 2.199% of frame, and over
 * AREA_ENTER_F (6) frames that is 2.199 x 6 / 6 = 2.20 against the 2.0
 * authoring floor, with 600/6 = 100px per frame = 0.367% in a SINGLE frame
 * against the 0.3% burst gate.
 *
 * R14 RAISED THE ALPHA 0.49 -> 0.68, AND THAT IS A LIT-AREA FIX, NOT A LOOK.
 * At 0.49 the composite over black is (111.2, 87.7, 31.8) = Rec.601 luma 88.4:
 * a 2.199%-of-frame object sitting 21.6 luma UNDER the empty-frame gate, i.e.
 * the largest single thing on screen in the closing third of the beat and worth
 * exactly 0.000% to the metric the r13 grade failed on. The previous version of
 * this comment said so in as many words and then left it there.
 * At 0.68 the composite is (154.4, 121.7, 44.2) = luma 122.6, over the 110 gate
 * by 12.6 — the same margin N_WORK_ALPHA is solved for, and the same margin
 * that survives crf 20 and the 8x pooling. So this now banks 2.199% of LIT area
 * from ep18098 until `dimRest` ghosts the band.
 * The ceiling is the ink type printed on top: 5.76:1 at 0.49, 3.43:1 at 0.68,
 * 3.26:1 at 0.70, and 3.00:1 at ~0.76. 0.68 keeps 14% of headroom over the
 * readability floor. The wash's own contrast on black goes 3.09:1 -> 5.19:1, so
 * it clears the 3:1 idle-structure floor more comfortably than before, not less.
 * The event arithmetic is unchanged (the delta against the board goes 88 -> 123,
 * both far over the 25 gate); this is purely area that was dark and is now lit.
 * Bounds: x 236..836 (the head's 250..821 plus 14px of padding, and clear of
 * the "?" at 922), y 770..846 (encloses the 786..827 cap band, and stops
 * 4px above GUIDE_L where that line passes x 836).
 */
const TYPE_WASH = { left: 236, top: 770, w: 600, h: 76 } as const;
/** Where the "?" lands, and therefore where the fan-out guides start. 20 mono
 *  chars at 56px (0.6em advance, no tracking on this row) = 672, so the body
 *  runs 250..922 and the "?" glyph sits at 922..956; 939 is its centre. */
const Q_X = 939;
/**
 * 848, not 844 (R14). The fan-out guides went from a 2px stroke to an 8px one
 * (see the GUIDE_L block), and an 8px stroke centred on 844 has its top edge at
 * 840 — 1px INSIDE the answer blank at y 833..841, which used to have 3px of
 * clearance. Dropping the origin 4px restores it: the guides now leave the "?"
 * at y 844..852 and the blank's floor is 841, so there are 3px between them
 * again. The glyph baseline is 827, so the fan still starts 21px under the "?"
 * rather than anywhere that reads as detached.
 */
const Q_Y = 848;
const SLOT_TOP = 896;
const SLOT_H = 34;
const STRIP_SLOTS = 16;
const STRIP_W = 630;
const SEQ_X = 250; // 250 -> 880
const SCAT_X = 1030; // 1030 -> 1660, both inside the 1805 safe edge
const SLOT_PITCH = STRIP_W / STRIP_SLOTS;
// 34, not 30 (R14). The slot cells went from a 1px outline to a filled
// `theme.dim` block, so their width is now lit area rather than chrome: at 30
// the 32 cells are 28,800px2 = 1.389% of frame, at 34 they are 36,992px2 =
// 1.784%. The pitch is 39.375, so 34 still leaves a 5.375px gutter and the row
// still reads as sixteen separate addresses rather than one bar. See SlotStrip.
const SLOT_W = 34;
const STRIP_LABEL_TOP = 938;
/**
 * 56 -> 60 across `resolve` (was 40 -> 46, which was a 29..34px cap and under
 * the floor at BOTH ends). At 60px with letterSpacing 1 "sequential" is 369px
 * (250..619) and "scattered" is 332px (1030..1362), both well inside the safe
 * edge. `lineHeight: 1` is pinned on StripLabel so the growth is absorbed
 * upward: caps 946..990 with descenders at 1008, inside the 1015 floor of the
 * text-bounds box. Without that pin the normal 1.32em box puts descenders at
 * 1017 and the band fails.
 */
const STRIP_LABEL_SIZE = [56, 60];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** A sub-reveal window carved out of one step's own 0..1. Ease-out entrance. */
const seg = (t: number | undefined, a: number, b: number) =>
  interpolate(clamp01(t ?? 0), [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

/** Exits are ease-IN and about half an entrance — they get out of the way. */
const exitSeg = (t: number | undefined, a: number, b: number) =>
  interpolate(clamp01(t ?? 0), [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

/** Linear window — for motion that IS the content (a draw, a typing pass). */
const lin = (t: number | undefined, a: number, b: number) =>
  interpolate(clamp01(t ?? 0), [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/**
 * Each step's ramp length in FRAMES — the `span` values Episode005.tsx declares
 * for this beat, mirrored. The scheduler owns WHEN a step starts; this scene
 * owns how long its own sub-reveals take, and it cannot express "eight frames"
 * as a fraction of a 0..1 progress without knowing the denominator. If a span
 * changes over there, change it here.
 */
const SPAN = {
  axes_return: 58,
  dock_grow: 208,
  grid_return: 192,
  dock_live: 385,
  hottest_loop_type: 364,
  sweep_vs_scatter_draw: 154,
  thesis_type_close: 153,
  drift_out: 60,
} as const;

/**
 * House entrance length, clamped into the 6-9 frame band rather than hand-picked
 * (theme.ts owns the band). Every reveal window below is written as
 * `fr(ENTER_F, step)` so the RENDERED entrance is exactly this many frames — the
 * previous code wrote ~9-frame `seg` windows but then drove opacity through
 * `clamp01(t / 0.4)`, so the visible ramp saturated in ~1.5 frames and the two
 * questions read as instant pops.
 */
const ENTER_F = clampEntranceFrames(8);
/**
 * THE FLOOR OF THE SAME BAND, for large-area wipes only.
 *
 * A reveal is counted by the pacing detector at `areaPct * 6 / durationFrames
 * >= 2.0`, so duration is half the design: the same region is an event at 6
 * frames and not one at 8. `workFill` covers 3.971% of frame but only 2.083%
 * of it moves past the detector's 25-luma gate — R14 re-derived this downward
 * from 2.44% after `nRetire` moved out of these six frames, because the accent
 * field that used to vacate underneath now stays put and its 39,105px2 shows a
 * 10.2-luma composite move instead of a 76-luma one. See WORK_FILL_PATH for the
 * line-by-line. At 6 frames the 2.083% presents 2.083 per window, over the bar
 * by 4%; at 8 it presents 1.56 and the reveal fails. 6 is the legal
 * floor of the house entrance band (theme.ts ENTRANCE_MIN_FRAMES), still 200ms,
 * and it is the difference between clearing the bar and sitting under it.
 *
 * Do NOT reach for this to make small reveals "count" — under ~1.5% of frame no
 * duration inside the legal band gets you to 2.0, and the answer there is a
 * bigger reveal, not a faster one (see theme.ts INK BUDGET).
 */
const AREA_ENTER_F = clampEntranceFrames(6);
/** Emphasized-move ceiling: 600ms at 30fps. Docks travel in this, not 46-77f. */
const EMPH_F = 18;
/** N frames expressed as a fraction of a step's own 0..1 ramp. */
const fr = (frames: number, step: keyof typeof SPAN) => frames / SPAN[step];

/**
 * Entrance shape only; the entrance DURATION is the caller's ramp (6-9 frames).
 * 0.94 -> 1.035 -> 1 is spring overshoot at damping ~16. Scale never starts at
 * 0 — that reads as a cartoon balloon rather than an object arriving.
 */
const pop = (v: number) =>
  interpolate(clamp01(v), [0, 0.55, 0.85, 1], [0.94, 1.035, 0.995, 1]);

// Deterministic pseudo-random. Remotion renders each frame in its own process,
// so Math.random() would re-scatter the hop order every single frame. Same hash
// MemoryGrid uses, so "scattered" has the same texture it had in beat 8.
function hash01(i: number, seed: number): number {
  let x = Math.imul(i ^ seed, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* --- the two marker curves, sampled once at module scope ---------------- */
function samplePath(
  f: (u: number) => number,
  x0: number,
  x1: number,
  samples = 30,
): string {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const x = lerp(x0, x1, i / samples);
    const u = (x - ORIGIN_X) / PLOT_W;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${(BASELINE - PLOT_H * f(u)).toFixed(1)}`;
  }).join(" ");
}
const N_PATH = samplePath((u) => N_SLOPE * u, ORIGIN_X, ORIGIN_X + PLOT_W);
const N2_PATH = samplePath((u) => u * u, ORIGIN_X, N2_X_END);

/* --- THE GAP between the two curves -------------------------------------
 * Fills the 17264-17359 static stretch the grader measured (3.20s with nothing
 * entering). That frame range is a HISTORICAL measurement against the cut it
 * was taken from and is deliberately not rebased onto the current schedule;
 * the resolved window for the reveal is on `gapFill` itself.
 * Everything that used to live in there was warm chrome a few pixels
 * tall — a 2px rule, a dim change on an existing stroke — none of which moves
 * >0.3% of the frame, so mechanically the beat was holding still under
 * "no cache on earth is gonna rescue a quadratic loop at scale".
 *
 * This is not a new element: it is the AREA BETWEEN the two lines already on
 * screen, i.e. literally the thing that sentence is about. The curves meet where
 * PLOT_H*u² = PLOT_H*N_SLOPE*u, i.e. u = N_SLOPE exactly, so the region runs
 * u 0.44..1 (x 470..750) and measures ~24,200px² — 1.2% of the frame, an
 * unambiguous content event, and it never reaches the note (whose descenders
 * clear at y 443, while the region's top edge at x 541 is already y 611).
 */
const GAP_U0 = N_SLOPE;
const GAP_X0 = ORIGIN_X + PLOT_W * GAP_U0; // 470
const GAP_W = PLOT_W * (1 - GAP_U0); // 280
const GAP_PATH = (() => {
  const n = 24;
  const pt = (u: number, f: (v: number) => number) =>
    `${(ORIGIN_X + PLOT_W * u).toFixed(1)} ${(BASELINE - PLOT_H * f(u)).toFixed(1)}`;
  const top = Array.from({ length: n + 1 }, (_, i) =>
    pt(lerp(GAP_U0, 1, i / n), (u) => u * u),
  );
  const back = Array.from({ length: n + 1 }, (_, i) =>
    pt(lerp(1, GAP_U0, i / n), (u) => N_SLOPE * u),
  );
  return `M ${top[0]} ${[...top.slice(1), ...back].map((s) => `L ${s}`).join(" ")} Z`;
})();
/**
 * Seven hatch strokes across the same region, staggered 3 frames apart — the
 * second staged reveal, landing on "quadratic loop at scale". Hatching a region
 * is whiteboard grammar (this beat is beat 2's board returning) and it is a
 * line-draw entrance, which keeps the grammar rotating: dock -> rule -> mask
 * wipe -> area wipe -> draw-on. Sampling starts at u 0.62 because below that the
 * gap is under 45px tall and a stroke in it reads as a smudge; the strokes lean
 * 18px left so they cannot be mistaken for bars.
 */
const GAP_HATCH = [0.62, 0.68, 0.74, 0.8, 0.86, 0.92, 0.98].map((u) => {
  const x = ORIGIN_X + PLOT_W * u;
  const yTop = BASELINE - PLOT_H * u * u;
  const yBot = BASELINE - PLOT_H * N_SLOPE * u;
  return `M ${x.toFixed(1)} ${(yBot - 3).toFixed(1)} L ${(x - 18).toFixed(1)} ${(yTop + 3).toFixed(1)}`;
});

/* --- THE WORK UNDER THE QUADRATIC ---------------------------------------
 * Fills the f17360-17463 dead window (3.47s; measured median inter-frame ink
 * 0.000%, peak 0.93% over any 6-frame window, 14% of frames showing any motion
 * at all). Like the r8 numbers on GAP_PATH, that frame range is a HISTORICAL
 * measurement against the cut it came off and is not rebased; what it named is
 * the TAIL of `dock_grow` plus the head of
 * `grid_return`, and everything authored inside it is thin: the seven
 * `GAP_HATCH` strokes are 5px x ~100px (~3,500px2 total, 0.17% of frame), and
 * `n2Escape` is a stroke advancing ~4px across those frames. Neither repaints
 * area. (`nRetire` used to be in this list as a dim change on an existing
 * stroke; R14 moved it out of the window entirely.)
 *
 * THE ARITHMETIC THAT DECIDES WHAT COUNTS. The pacing detector pools the frame
 * to 240x135 (8x8), calls a pixel changed at |dY| >= 25, and needs >= 2% of
 * frame repainted inside a 6-frame window. So the quantity to design against is
 * not area, it is AREA / DURATION:  areaPct * 6 / durationFrames >= 2.0. A 6.7%
 * region wiped over 18 frames presents 2.2% per window and IS an event; the
 * same region over 24 frames presents 1.7% and is NOT. This is also why the
 * existing `gapFill` never graded: 24,200px2 (1.17%) spread over 41.6 frames is
 * 1.17 * 6 / 41.6 = 0.17% per window, an order of magnitude under the bar,
 * however correct its timing and colour are.
 *
 * WHY THIS REGION AND NOT A NEW ELEMENT. The beat's `visual.treatment` is a
 * callback composite and bans new metaphors outright, so the reveal has to come
 * out of something already on screen. The narration across the window is
 * "...no cache on earth is gonna rescue a quadratic loop at scale", and the area
 * under n2 is literally the work that loop is doing — the quantity the sentence
 * is about. Filling it is an annotation of the curve the viewer is already
 * looking at (region-fill grammar, object constancy), not a fourth diagram.
 *
 * AREA, EXACTLY. The region is bounded below by the x-axis (y 740), left by the
 * y-axis (x 250), above by the curve y = BASELINE - PLOT_H*u^2 over u 0..1, and
 * then — past the plot corner — by the plot top (y 360) out to N2_X_END 800:
 *   under the curve  = PLOT_W * PLOT_H / 3      = 500 * 380 / 3 = 63,333px2
 *   escape column    = (800 - 750) * PLOT_H     =  50 * 380     = 19,000px2
 *   region           =                                            82,333px2
 *   frame            = 1920 * 1080                              2,073,600px2
 *   areaPct          =                                               3.971%
 * Over a 6-frame wipe that is 3.971 * 6 / 6 = 3.97% per window, ~2x the 2.0 bar.
 *
 * WHAT OF THAT ACTUALLY REGISTERS AS CHANGED — FULLY RE-DERIVED IN R14, BECAUSE
 * `nRetire` NO LONGER FIRES HERE. The previous version of this block credited
 * N_WORK_PATH's accent field vacating in the same six frames (122 -> 46, a
 * 76-luma swing over 39,105px2). R14 moved `nRetire` to ep17928 to keep that
 * 1.886% of frame LIT for 517 more frames, so that credit is GONE and the
 * reveal has to stand on its own. Composite luma throughout: `theme.panel`
 * rgba(14,14,16,0.72) over pure black = plate luma 10.2; warm at 0.30 over the
 * plate = 61.3.
 *
 * The region is not empty when this fires, and the paint order matters — this
 * fill sits UNDER N_WORK_PATH and UNDER the gapFill wedge, so in both of those
 * sub-regions it is only seen through the layer above:
 *   N_WORK_PATH        39,105px2. accent at 0.80 sits on top, so only 20% of
 *                      the move gets through: 0.20 x (61.3 - 10.2) = 10.2 luma.
 *                      UNDER the 25 gate. Counts for NOTHING now.
 *   gapFill wedge      24,200px2 (1.167%). theme.down at 0.45 sits on top, so
 *                      55% gets through: 0.55 x 51.1 = 28.1 luma, measured
 *                      composite 64.1 -> 92.2. Over the gate by 3.1. COUNTS,
 *                      and this is exactly what the alpha raise bought — at the
 *                      old 0.26 the same number is 24.3 and it did NOT count.
 *   escape column      19,000px2 (0.916%). Virgin ground: plate 10.2 -> 61.3,
 *                      a 51.1-luma move with nothing on top of it. COUNTS.
 *   n2 stroke          653px of arc x 16px = 10,448px2 at full alpha. Nothing.
 *   GAP_HATCH          seven 5px strokes, ~3,500px2. Nothing.
 *   x-axis in column   30 x 12px. Nothing.
 * So the honest total is wedge + escape = 24,200 + 19,000 = 43,200px2 =
 * 2.083% of frame, over 6 frames = 2.083% per window against a 2.0 bar.
 *
 * SAY IT PLAINLY: THAT IS A 4% MARGIN ON AREA AND A 12% MARGIN ON LUMA, and
 * over half of it depends on a composite calculation about pixels that are
 * already painted — the exact thing the old version of this block said not to
 * rely on. It is accepted here because the trade is measured on both sides:
 * this reveal loses ~0.35% of margin, the beat gains 1.886% of LIT area held
 * across 517 frames, and lit area is the defect the r13 grade actually named
 * (median 4.139%, 41.3% of frames under 4%). The escape column alone is
 * 0.916%, so if the wedge composite is being optimistic the reveal degrades to
 * a small event rather than to nothing.
 *
 * At the house ENTER_F of 8 frames the same figure is 1.56%, under the bar,
 * which is why this reveal runs at the 6-frame FLOOR of the entrance band
 * rather than its usual 8. See AREA_ENTER_F. The single-frame gate is not
 * close: `seg`'s ease-out puts 42% of the height up in frame one, and the
 * bottom 42% of the escape column alone is ~8,000px2 = 0.386% > 0.3%.
 *
 * THE TAIL STAYS UNFILLED ON PURPOSE. The fill is capped at the plot top, so
 * past x 750 the curve is climbing ABOVE its own shaded region with nothing
 * containing it — the shaded work fills the board to the corner and the line
 * leaves. That is the sentence's actual claim, and it is also why the cap is at
 * y 360 rather than following the curve out to y 280: at 280 the region's top
 * tip would print under the docked "how does it grow?", whose 0.6em-fallback box
 * runs x 250..831 at y 254..312.
 *
 * WHAT THE COLUMN COSTS. From ep17733 the `in order` bar (x 752..796, y
 * 594..600) and part of its label sit on the wash. That is a smaller change than
 * it sounds: the label's glyph run is 639..909, so it already crossed the fill
 * inside the plot, and the extension adds 50px of overlap plus a 44x6px sliver.
 * Both are theme.up over the wash at 5.19:1, well clear. The other neighbours
 * are checked and clear: the `you see it` gutter note starts at x 790 (10px of
 * overlap, warm on warm at 5.73:1) and the n2 CurveTag starts at x 866.
 */
const WORK_FILL_PATH = (() => {
  const n = 32;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    return `${(ORIGIN_X + PLOT_W * u).toFixed(1)} ${(BASELINE - PLOT_H * u * u).toFixed(1)}`;
  });
  // ...curve to the plot corner (750, 360), then right along the plot top to
  // the tail's x, then straight down to the axis and closed.
  return `M ${pts[0]} ${pts
    .slice(1)
    .map((s) => `L ${s}`)
    .join(" ")} L ${N2_X_END} ${BASELINE - PLOT_H} L ${N2_X_END} ${BASELINE} Z`;
})();
/** The wipe clips in plot coordinates, so it has to span the escape column too. */
const WORK_FILL_W = N2_X_END - ORIGIN_X; // 550

const X_AXIS_PATH = `M ${ORIGIN_X - 26} ${BASELINE} L ${ORIGIN_X + PLOT_W + 30} ${BASELINE}`;
const Y_AXIS_PATH = `M ${ORIGIN_X} ${BASELINE + 20} L ${ORIGIN_X} ${BASELINE - PLOT_H - 24}`;

/**
 * The bracket that joins the two docked questions on "ask both questions".
 * A bracket, never a ring — circle/ring annotations are banned outright, and a
 * bracket is also the only shape that can span 1300px without enclosing the
 * grid and the axes in one meaningless blob.
 *
 * R14 — IT MOVED DOWN 6px AND GOT FOUR TIMES THICKER, and that is a lit-area
 * fix. At the old w3 this 1474px rail contributed 0.000% to the empty-frame
 * gate: the proxy decodes at 240x135, so 3px is 0.375 of one proxy pixel and
 * the block it lives in pools to 0.375 x 175 + 0.625 x bed ~= 73, under the
 * 110 bar however visible the line is at 1080p. It is the same "a large region
 * painted thin scores nothing" trap the axes were pulled out of.
 * At w12 the rail is 1.5 proxy px, so the interior row of blocks reproduces
 * theme.warm's 175 outright:
 *   path length 16 + 1474 + 16 = 1506px x 12 = 18,072px2 = 0.871% of frame
 *   GEOMETRIC. Discount it: a 1.5-px-wide stroke has one fully-covered proxy
 *   row and one straddling row, so bank ~0.4-0.5%, not 0.871%.
 * It is lit from `bothBracket` settling (ep17930) until `dimRest`, which is
 * most of the beat's second half — including the ep17845-17962 stretch that
 * measured a 3.57% median on r13.
 *
 * GEOMETRY, re-solved for the thicker rail. The rail is centred on y 164, so it
 * occupies 158..170: 7px under the docked thesis's descender line at 151, and
 * 20.8px over the slot-label caps at 190.8. The legs run down to 180 and the
 * round linecap takes them to 186 — but the legs are at x 236 and x 1710 while
 * the labels run 250..626 and 1150..1610, so that clearance is horizontal, not
 * vertical. Do not lengthen the legs.
 */
const BOTH_BRACKET_PATH = `M ${LEFT_X - 14} 180 L ${LEFT_X - 14} 164 L 1710 164 L 1710 180`;
const BOTH_BRACKET_W = 12;

/* --- the two access patterns -------------------------------------------- */
const slotCX = (x0: number, i: number) => x0 + i * SLOT_PITCH + SLOT_PITCH / 2;

/**
 * A hop path over the 16 slots in visit order. The quadratic control point sits
 * at twice the apex height, so `h` is the real arc height. maxH is 34 for the
 * scattered strip and 20 for the sequential one, which puts the highest SCAT
 * apex at y 862 and the highest SEQ apex at y 877, both off SLOT_TOP 896.
 * (This block used to say the arcs "stay under the fan-out guides, which land
 * at y 898". The guides land at y 880, not 898, and the arcs do NOT stay under
 * them — see the GUIDE_L block for the crossing and why it is accepted.)
 *
 * R14 MEASURED LENGTHS, by 64-segment polyline integration of the quadratics:
 *   SEQ_PATH   856.9px   SCAT_PATH  3,560.3px
 * At the new w=10 (was 4) that is 8,569px2 = 0.413% and 35,603px2 = 1.717%
 * GEOMETRIC. Do not bank those figures whole: 10px is 1.25 proxy pixels at
 * 240x135, theme.up is luma 136.5 and theme.down is 130 — only 26 and 20 over
 * the gate — so bicubic pooling takes the edges off both. Assume ~40% realises,
 * i.e. ~0.85% of frame between the two, and treat anything above that as a
 * bonus rather than as a number this file has earned.
 */
function hopPath(x0: number, order: number[], maxH: number): string {
  let d = `M ${slotCX(x0, order[0]).toFixed(1)} ${SLOT_TOP}`;
  for (let k = 1; k < order.length; k++) {
    const from = slotCX(x0, order[k - 1]);
    const to = slotCX(x0, order[k]);
    const h = Math.min(maxH, 16 + Math.abs(to - from) * 0.075);
    d += ` Q ${((from + to) / 2).toFixed(1)} ${(SLOT_TOP - 2 * h).toFixed(1)} ${to.toFixed(1)} ${SLOT_TOP}`;
  }
  return d;
}
const SEQ_ORDER = Array.from({ length: STRIP_SLOTS }, (_, i) => i);
const SCAT_ORDER = SEQ_ORDER.map((i) => ({ i, k: hash01(i, 31) }))
  .sort((a, b) => a.k - b.k)
  .map((o) => o.i);
const SEQ_PATH = hopPath(SEQ_X, SEQ_ORDER, 20);
const SCAT_PATH = hopPath(SCAT_X, SCAT_ORDER, 34);

/**
 * Guides fanning out of the "?" at the end of the typed line, so the two strips
 * are visibly the ANSWER to that line rather than two new diagrams. They start
 * at the "?" — which moved right again when the typed line went to the 56px
 * mono floor — and stop 16px above the strips at y 880 (SLOT_TOP is 896).
 *
 * R14 — theme.stroke w2 -> theme.dim w8, and this is a LIT-AREA change.
 *   theme.stroke is Rec.601 luma 90, 20 UNDER the 110 empty-frame gate, so
 *   these lines were worth 0.000% however long they are. theme.dim is 147.
 *   A 2px stroke is 0.25 of a proxy pixel at 240x135 and vanishes into the
 *   duty-weighted mean regardless of colour; 8px is exactly 1 proxy pixel,
 *   which is the documented floor at which a stroke registers at all.
 *   Lengths: GUIDE_L sqrt(639^2 + 32^2) = 639.8, GUIDE_R sqrt(151^2 + 32^2) =
 *   154.4, total 794.2px. x 8 = 6,354px2 = 0.306% of frame, LIT.
 *   NOT an event and no event claim is made: `guides` is a 14-frame lin, so
 *   0.306 x 6 / 14 = 0.13% per window, far under the 2.0 bar. It is there to
 *   stop the bottom band reading as three unlit objects on black.
 * BOUNDS, honestly. The top end is clean — Q_Y moved 844 -> 848 to keep 3px
 * under the answer blank, see Q_Y. The bottom end is NOT clean and it was not
 * clean before either: the guides land at y 880 +/- 4 and the SEQ hop arcs peak
 * at y 877 (SCAT at 862), so the last ~150px of each guide runs through the arc
 * band. That is accepted rather than fixed: the guides are drawn FIRST in the
 * SVG so the coloured hop lines paint over them, the guides land 60+ frames
 * before the arcs are drawn, and the read is "the guide goes behind the access
 * line". Moving the guides above the arcs would land them in mid-air pointing
 * at nothing, which is worse. (The stale note on hopPath claiming the guides
 * "land at y 898" has been corrected.)
 */
const GUIDE_L = `M ${Q_X} ${Q_Y} L 300 880`;
const GUIDE_R = `M ${Q_X} ${Q_Y} L 1090 880`;

/**
 * Beat 15 — the close. A callback composite: no new metaphor, no end card, no
 * announcement that anything is ending.
 *
 * The structure is a deliberate answer to the beat's own argument. The board
 * from beat 2 (the MODEL) sits on the left, the grid from beat 8 (the MACHINE)
 * sits on the right, and each gets one docked question. The centre gutter runs
 * the callbacks — the vector/list chips from beat 11 MORPH into the ghost of
 * beat 9's bars, which is the episode's whole thesis in one gesture. Then the
 * bottom band opens for the only genuinely new content in the beat: the
 * viewer's own hot loop, sequential or scattered. Finally the half-thesis that
 * has been docked in the corner since beat 12 UN-docks and completes itself.
 *
 * Nothing ever cuts away: the grid keeps sweeping under the closing type and is
 * still moving on the last frame of the episode.
 */
export const EndingTwoQuestions: React.FC<EndingTwoQuestionsProps> = ({
  p,
  frame = 0,
}) => {
  /**
   * R14 SILENCE AUDIT. `timing.json` carries anchor marks only, so every reveal
   * below was also checked against the MEASURED pauses in the narration:
   *   ffmpeg -i narration.master.wav -af silencedetect=n=-40dB:d=0.4 -f null -
   * Silences inside this beat, in frames:
   *   17163-17175 · 17426-17467 · 17861-17906 · 18043-18086 · 18213-18230 ·
   *   18397-18442
   * Two defects were found and one was fixed:
   *   FIXED — `dimRest` (ep18403) and `undock` (ep18418) both fired inside the
   *     18397-18442 pause: the board was being cleared while nothing was being
   *     said. Both moved to ep18449 / ep18458, inside "Big oh can't tell you."
   *     See the dimRest block.
   *   ACCEPTED, NOT FIXED — `machineLabel` (ep17446-17456) sits entirely inside
   *     the 17426-17467 pause. It is 21 frames ahead of "the machine" at
   *     ep17477, so it is EARLY rather than orphaned and it resolves inside the
   *     ~1s narration rule. Moving it onto its word would collide it with
   *     `gridWipe` (ep17458-17511) and break the one-moving-focus staging table
   *     on readoutWipe, and the step window itself (ep17446) is fixed by the
   *     schedule, which this file does not own. Flagged rather than papered over.
   *   `gridWipe` opens ep17458, 9 frames before speech resumes at 17467, but 44
   *     of its 53 frames are under the clause. Left alone.
   *
   * --- axes_return: the board comes back, fast (it's a callback) ---------
   * Window ep17164-17222 (58f). axesDraw ep17164-17187, nDraw ep17170-17194,
   * n2Base ep17190-17222, modelLabel ep17196-17206.
   */
  const axesDraw = seg(p.axes_return, 0, 0.4);
  /**
   * 0.25-0.70 -> 0.10-0.52, AND THIS IS THE BEAT'S LIGHT SWITCH, NOT A STAGGER
   * TWEAK. `nDraw` also drives the N_WORK_PATH wipe, which is the only element
   * in the opening that the empty-frame gate scores at all (see N_WORK_PATH).
   * The swept region needs w = 0.749 to reach 1% of frame and ease-out cubic
   * gets there at 37% of the window, so the old window lit the frame at
   * ep17179 + 0.37*26 = ep17189, i.e. 25 dark frames; this one lights it at
   * ep17179, i.e. 15. Both clear the 60-frame bar, and the cheaper of the two
   * is the one to take when the scene is cutting in from a 6.4%-lit frame.
   *
   * It also REDUCES simultaneous motion rather than adding it: n used to still
   * be drawing 15 frames after n2 started, now it overlaps n2 by 4.
   */
  const nDraw = seg(p.axes_return, 0.1, 0.52);
  const n2Base = seg(p.axes_return, 0.45, 1);
  const modelLabel = seg(p.axes_return, 0.55, 0.72);

  /* --- dock_grow: big type lands on `grow`, docks, then the tail escapes --
     Window ep17225-17433 (208f). Word clock: "no cache" 17318-17328, "at
     scale" 17417-17427 (see the word table at the top of the file). */
  // ENTRANCE, IN FRAMES, NOT A GUESSED FRACTION. This was `seg(0, 0.045)` — a
  // 9.4-frame window, which looks compliant — but DockingQuestion faded through
  // `clamp01(inP / 0.4)`, and ease-out cubic hits 0.4 at 16% of the window, so
  // the rendered entrance was ~1.5 frames (graded 3f / 100ms, an instant pop).
  // The window is now exactly ENTER_F and the opacity ramp spans all of it.
  const growIn = seg(p.dock_grow, 0, fr(ENTER_F, "dock_grow")); // ep17225-17233
  // 18f, not 46f: the dock is an emphasized MOVE and the ceiling is 600ms.
  const growDock = seg(p.dock_grow, 0.28, 0.28 + fr(EMPH_F, "dock_grow")); // ep17283-17301
  /**
   * ONE MOVING FOCUS. At 0.34 this started while `growDock` was still landing
   * the question — so the slot the question docks onto was still growing
   * underneath it while it arrived, which is two things moving in the same
   * frames and reads as the slot chasing the type rather than receiving it.
   * 0.375 starts it at ep17303, two frames after the dock settles at ep17301,
   * and the window is ENTER_F rather than a hand-picked 21 frames.
   */
  const leftRule = seg(p.dock_grow, 0.375, 0.375 + fr(ENTER_F, "dock_grow")); // ep17303-17311
  // 0.42, not 0.55: at 0.55 the note wiped on ~25 frames AFTER "no cache" was
  // spoken. Late is the tell. At 0.42 it opens ep17312 and finishes ep17337,
  // against "no cache" at ep17318-17328 — it is uncovering across the phrase.
  const noteWipe = seg(p.dock_grow, 0.42, 0.54); // ep17312-17337, on "no cache"
  const noteRule = seg(p.dock_grow, 0.56, 0.66); // ep17341-17362
  /* `nRetire` used to live here, at 0.855 of dock_grow (ep17403-17411). It is
     now clocked off `morph` in the hottest_loop_type block — see it there for
     the 517 frames of lit area that move bought, and see `workFill` just below
     for what it costs the reveal that used to be paired with it. */
  /**
   * THE TWO STAGED REVEALS THAT ACTUALLY BREAK THE 17264-17359 HOLD. `nRetire`
   * and `noteRule` above are a dim change and a 2px line — real intent, but far
   * under the 0.3%-of-frame bar a content event has to clear, which is why the
   * stretch still graded static. These two clear it by an order of magnitude.
   *   gapFill  0.46-0.66 — the ~24,200px² (1.2% of frame) region between n and
   *                        n² wipes open left-to-right. RE-CUT for the 3.97s
   *                        static hold at beat+135..+254: it was an 8-frame
   *                        pop at 0.58, which is one event in a 120-frame
   *                        stretch whose other members (a 2px rule, an 8-char
   *                        mono line, a second 2px rule) are all an order of
   *                        magnitude under the 0.3%-of-frame content-event bar.
   *                        As a 42-frame travelling area wipe it is continuous
   *                        large-area change across the middle of the hold —
   *                        `lin`, because the wipe IS the content, the same
   *                        licence n2Draw takes. Opacity also went 0.17 -> 0.30:
   *                        at 0.17 the warm fill is a ~17-luma delta on black,
   *                        under the 25-luma gate, so it did not COUNT as an
   *                        event however big it was.
   *   gapHatch 0.72-0.90 — seven strokes measure it, 3-frame stagger, on
   *                        "quadratic loop at scale", handing straight over to
   *                        n2Escape at 0.78 with no seam. w 3 -> 5 and dim
   *                        0.62 -> 0.9 for the same luma reason.
   */
  const gapFill = lin(p.dock_grow, 0.46, 0.66);
  const gapHatch = GAP_HATCH.map((_, i) =>
    seg(
      p.dock_grow,
      0.72 + fr(3 * i, "dock_grow"),
      0.72 + fr(3 * i + ENTER_F, "dock_grow"),
    ),
  );
  const n2Escape = seg(p.dock_grow, 0.78, 1); // ep17387-17433, "quadratic loop at scale"
  /* `nWorkAlpha` moved out with `nRetire` — both are declared in the
     hottest_loop_type block below. */
  /**
   * THE ONE REVEAL INSIDE THE f17360-17463 DEAD WINDOW. Geometry, area and the
   * "why the area under n2 and not a new element" argument are on
   * WORK_FILL_PATH; this is only the clock.
   *
   * SCHEDULE. The step's resolved window is 17225-17433 (span 208), so
   * p = (f - 17225) / 208 and 0.86 -> ep17403.9, settling at
   * 0.86 + fr(AREA_ENTER_F) = 0.88885 -> ep17409.9. Six frames.
   *
   * THE WORD. Per-word clock between the only two hard marks in this beat —
   * `grow` ep17228 and `where` ep17536, 31 words apart, 9.935 frames/word:
   *   quadratic 17397 · loop 17407 · at 17417 · scale 17427 · But 17437
   * so the wipe opens 3.1 frames BEFORE "loop" (the house lead) and settles ON
   * it, across the phrase "quadratic loop". It is pinned to the clause's NOUN,
   * not to "at" or "scale": the region is the work the loop does. Deriving this
   * by hand at the "~9.6 frames/word" quoted at the top of this file put every
   * word ~6 frames early and would have landed the wipe a frame LATE on "loop",
   * which is the tell this whole rule exists to prevent — re-derive the clock,
   * don't inherit it.
   *
   * WHERE IN THE WINDOW. The wipe opens 44 frames past the window's start and
   * closes 53 short of its end, i.e. it splits a 3.47s hole into 1.47s + 1.77s.
   * Placing it on "But the machine" instead (ep17437-17457, where the whole
   * right-hand column is empty and could take a far bigger fill) would have
   * left the front 2.6s — the entire "quadratic loop at scale" clause —
   * untouched, which is the half of the window that is about something.
   *
   * ONE MOVING FOCUS. The last GAP_HATCH stroke settles ep17400.8, three frames
   * before this opens, and `n2Escape` is across these six frames advancing the
   * tail from x ~789 to x ~792 — 3px of a 16px stroke. Nothing else is in
   * flight. `nRetire` USED to be co-scheduled here (it took the accent field
   * out of the same region as this warm field arrived, a substitution rather
   * than two objects) — R14 moved it to ep17928 to keep 1.886% of frame LIT
   * across the 517 frames in between. See the `nRetire` block below for that
   * trade, and the WORK_FILL_PATH block for what it cost this reveal and how
   * alpha 0.30 pays it back.
   *
   * GRAMMAR ROTATION. This step has already spent dock (growDock), rule draw-on
   * (leftRule/noteRule), left-to-right mask wipe (noteWipe), left-to-right area
   * wipe (gapFill) and line draw-on (gapHatch). This one rises from the x-axis —
   * a bottom-up mask reveal, a sixth grammar, and the direction is the content:
   * the work piles UP off the baseline. `seg`, not `lin`: this is an entrance,
   * not a long draw, and the ease-out front-loads the widest part of the region
   * (the band just above the axis spans the full 500px; at y 400 it is 77px
   * wide) into the first frames, which is where the detector wants it.
   */
  const workFill = seg(p.dock_grow, 0.86, 0.86 + fr(AREA_ENTER_F, "dock_grow")); // 17404-17410

  /* --- grid_return: the machine's side. Window ep17446-17638 (192f) ------
     Still overlaps dock_live in WINDOW, but no longer in MOTION: the two steps
     interleave their sub-reveals rather than running them on top of each other.
     See the staging table on readoutWipe below. */
  // 17446-17456. "the machine" is spoken ~17477 (the clause resumes 17463 after
  // the "/" and runs 7.34 f/word to the `where` mark), so the label is 21
  // frames ahead of its word — early, which is the safe side, and it is the
  // slot header rather than the reveal: `gridWipe` opens 17458, on the clause.
  const machineLabel = seg(p.grid_return, 0, 0.05);
  // `lin`, not `seg`: this ramp is quantized to the grid's eight rows (see
  // gridClip), and an ease-out puts the first four rows inside 11 frames and
  // then leaves 27 frames of nothing before the last one. Linear spaces the
  // eight arrivals evenly at 6.75 frames. The wipe IS the content here, which
  // is the same licence n2Draw and seqDraw take.
  const gridWipe = lin(p.grid_return, 0.06, 0.34); // 17458-17511, 8 stepped rows
  /**
   * THE TWO STEPS ARE NOW STAGED, NOT STACKED. grid_return deliberately runs
   * under the head of dock_live, and the price of that was three things in
   * flight across ep17533-17584: the readout still wiping open, the right
   * header rule growing, and "where does it live?" popping on top of both.
   * Three moving diagrams in one frame window is the ">= 1 primary moving
   * focus" violation the grade named; the fact that two of them were tiny
   * (a 517x56 line and a 560x2 rule) doesn't make them not-motion, it just made
   * them motion nobody could read.
   *
   * So the grid finishes arriving BEFORE the question, and the rule arrives
   * AFTER it, in the hole between the pop and the dock:
   *
   *   gridWipe    17458-17511   grid is the focus
   *   readoutWipe 17515-17523   grid is the focus (8f now, not 36)
   *   liveIn      17533-17541   the question is the focus, alone (`where` 17536)
   *   rightRule   17590-17598   the slot appears, alone
   *   liveDock    17660-17678   the question docks into it, alone
   *
   * readoutWipe only moves 29 frames earlier and stays on the same phrase, so
   * nothing lands after its word. rightRule moves 33 frames LATER on purpose:
   * as a 2px rule it was never a content event by ink (1,120px², 0.05% of
   * frame), so it buys nothing where it was, and parked at 0.75 it at least
   * splits the 119-frame hold between the pop and the dock into 49 + 62 frames
   * — both inside the 3s ceiling. The ink that actually carries this stretch is
   * the question itself — at BIG_QUESTION_SIZE a 969x96 box, 93,024px², 4.49%
   * of frame — arriving and then making a 552px climb, which is the round's
   * rule: fill the gaps a sequential restage opens by making the arrivals
   * bigger, not by adding more flickers.
   */
  const readoutWipe = seg(
    p.grid_return,
    0.36,
    0.36 + fr(ENTER_F, "grid_return"),
  ); // 17515-17523
  const rightRule = seg(p.grid_return, 0.75, 0.75 + fr(ENTER_F, "grid_return")); // 17590-17598

  /* --- dock_live: land_at mark, then the trick-question callback ---------
     Window ep17533-17918 (385f). `where` is a REAL mark at ep17536.

     THE REST OF THIS STEP IS CLOCKED OFF THE AUDIO, NOT OFF THE BEAT AVERAGE.
     The 9.935 f/word figure quoted at the top of the file is a two-mark average
     across a stretch containing a 1.2s "/" pause, so it drifts badly once you
     are 30+ words past a mark — it predicts "trick" at ep17844. A 33 ms RMS
     envelope of narration.master.wav over 591.9-595.6 s puts the real onsets
     13 frames earlier, and only a handful of frames from where the fractions
     below already sat, which is why this is a re-measure and not a rewrite:
       17673-17685  "And hey,"        (comma pause 17686-17696)
       17697-17759  "next time an interviewer asks you vector or list,"
                    -> "vector" onset ep17743, "list" onset ep17753
       17773-17798  "you're allowed to smile"   (pause 17799-17814)
       17815-17864  "it's a better trick question than they know."
                    -> "trick" onset ep17831
     Re-measure, don't extrapolate. */
  const liveIn = seg(p.dock_live, 0, fr(ENTER_F, "dock_live")); // 17533-17541
  /**
   * 18f, not 77f. This travel — 730,806 up to the header slot at 1150,254 with
   * the type shrinking BIG_QUESTION_SIZE -> HEADER_SIZE — was 2.57s of
   * continuous emphasized movement against a 600ms ceiling, and it is the only
   * thing in this step long enough to have graded 967ms on `where`. Started
   * later (0.33, not 0.26) rather than just clipped short, so the 18 frames
   * land in the middle of the quiet stretch instead of at its head: rightRule
   * settles ep17598, the dock runs ep17660-17678, the vector chip enters
   * ep17733 — two gaps of 2.1s and 1.8s where there used to be one of 0.8s and
   * one of 2.7s. Nothing new opens up, it is just balanced.
   */
  const liveDock = seg(p.dock_live, 0.33, 0.33 + fr(EMPH_F, "dock_live"));
  // ~9.6-frame entrances (0.025 of 385 frames), not 15 — slow entrances are the
  // thing that read as sleepy in the last episode. The two chips settle
  // ep17740 and ep17752 against measured onsets of ep17743 ("vector") and
  // ep17753 ("list") — the 3-frame house lead on the first, effectively on the
  // word for the second, and a 3-frame stagger between them. The second chip
  // was at 0.57 and settled ep17762, nine frames AFTER "list"; the whole point
  // of measuring the envelope was to catch that.
  const chipIn = [
    seg(p.dock_live, 0.513, 0.538),
    seg(p.dock_live, 0.545, 0.57),
  ];
  // 0.741, not 0.77. At 0.77 this opened ep17830 and settled ep17839 — eight
  // frames AFTER the measured "trick" onset at ep17831, which is the
  // late-landing tell in its plainest form, and it happened because the
  // fraction was solved against the beat-average clock that puts "trick" at
  // ep17844. 0.741 opens ep17818 and settles ep17828, three frames ahead of
  // the word. It stays clear of `trickOut` (ep17966) by 138 frames.
  const trickIn = seg(p.dock_live, 0.741, 0.766);

  /* --- hottest_loop_type: bracket, morph, camera settle, typing ----------
     Window ep17890-18254 (364f). Measured clause boundaries (same envelope
     method as dock_live above):
       17906-18007  "Ask both questions and Drepper's chart stops being
                     spooky,"  -> "both" 17917, "Drepper's" 17951,
                     "spooky" 17996
       18011-18044  "'cause you can see it coming."
       18086-18216  "So take the loop you hit most, and go look at how the
                     thing it walks is actually laid out."  -> "laid out"
                     18203-18216
       18229-18312  "Your C P U's been staring at that answer all day." */
  const bothBracket = seg(p.hottest_loop_type, 0, 0.11); // 17890-17930
  const bothLabel = seg(p.hottest_loop_type, 0.025, 0.05); // settles 17908, "both" 17917
  const morph = seg(p.hottest_loop_type, 0.105, 0.3); // 17928-17999, over "Drepper's" 17951
  /**
   * `nRetire` — MOVED HERE IN R14 FROM 0.855 OF dock_grow (ep17403-17411).
   * This is the single largest LIT-AREA fix in the beat, and it is a deletion
   * of a retire, not an addition of an element.
   *
   * WHAT IT WAS COSTING. `nRetire` drives `nWorkAlpha = 1 - nRetire`, which is
   * a multiplier on N_WORK_PATH's fill. That field is `theme.accent` at
   * N_WORK_ALPHA 0.80 over the plate — composite Rec.601 luma 122, i.e. LIT
   * (gate 110) with 12 to spare — and it covers 39,105px² = 39105/2073600 =
   * 1.886% of frame. Retiring it at ep17411 replaced it with `workFill`, which
   * is `theme.warm` at 0.26-0.30 = luma 46-61: UNLIT. So the old schedule threw
   * 1.886% of the frame's lit area away at ep17411 and did not get it back.
   * That is a large fraction of a beat whose median lit area measured 4.139%.
   *
   * WHAT MOVING IT BUYS. 0.105 of a 364-frame window starting ep17890 is
   * ep17928.2, settling at 0.105 + fr(8) = 0.1270 -> ep17936.2. The field
   * therefore stays lit from ep17411 to ep17928 — 517 frames, 17.2s — at
   * +1.886% of frame. Nothing is added to the screen to achieve this; a retire
   * is simply deferred to the moment the plot is genuinely being replaced.
   *
   * THE HARD DEADLINE, AND WHY IT CANNOT GO ANY LATER. The bar labels
   * crossfade on `lin(m, 0.42, 0.58)` = ep17958-18016, and they are drawn in
   * `theme.dim`. `theme.dim` over accent-at-0.80 measures 1.246:1 — far under
   * the 3:1 idle floor, i.e. unreadable. `mx = seg(m, 0, 0.45)` has the bars in
   * final position by ep17960. So the accent field MUST be gone before ep17958,
   * and ep17936 clears that by 22 frames. There is no later slot.
   *
   * NOT A SECOND MOVING FOCUS. It runs inside `morph` (ep17928-17999), which is
   * the curve-to-bars transform occupying exactly this region: the field
   * dissolving is the same gesture as the curves it belongs to becoming bars.
   * Same substitution logic it had at ep17403, now attached to the transform
   * that actually justifies it.
   *
   * WHAT IT COSTS. `workFill` at ep17404-17410 used to land partly on ground
   * this field was vacating in the same six frames. It no longer does; see the
   * WORK_FILL_PATH block for the re-derived event arithmetic (escape column
   * 0.916% of virgin ground + the wedge's recolour at alpha 0.30 giving a
   * 26.9-luma delta against a 25 gate) and for the honest statement of how thin
   * that 1.9-luma margin is.
   */
  const nRetire = seg(
    p.hottest_loop_type,
    0.105,
    0.105 + fr(8, "hottest_loop_type"),
  ); // ep17928-17936
  /**
   * The shaded work under the linear line. Two independent terms, on purpose:
   * the WIPE follows `nDraw`, so the field is uncovered by the same marker pass
   * that draws the line it belongs to (ep17170-17194) rather than arriving as a
   * separate object; the OPACITY is gated by `nRetire` above, so the field
   * leaves when the curve it annotates morphs into bars. This is a MULTIPLIER
   * on N_WORK_ALPHA, not the alpha itself — see N_WORK_PATH for the geometry,
   * the 0.80 solve and why a hatch was the wrong instrument.
   */
  const nWorkAlpha = 1 - nRetire;
  /**
   * EXIT_FRAMES, not 0.04. 0.21-0.25 of a 364-frame span is 14.6 frames — a
   * 490ms exit against the house 200ms ceiling (theme.ts EXIT_FRAMES), on the
   * one element in this beat that has to be gone before its replacement
   * arrives. It is the same defect this file already fixed on three docks
   * (growDock 46f, liveDock 77f, undock 30.6f), left standing on the exit.
   * Nothing moves EARLIER: the start stays 0.21 (ep17966) and the settle comes
   * back from ep17981 to ep17972, which WIDENS the gap to `spookyIn` at 0.26
   * (ep17985) from 4 frames to 13. The two gutter notes share one slot, so that
   * gap is the constraint — see the note on spookyIn below.
   */
  const trickOut = exitSeg(
    p.hottest_loop_type,
    0.21,
    0.21 + fr(EXIT_FRAMES, "hottest_loop_type"),
  );
  // Out before in: the two gutter notes share one slot, so their windows must
  // not overlap or the frame reads two contradictory lines stacked on 838,650.
  const spookyIn = seg(p.hottest_loop_type, 0.26, 0.285); // settles 17994, "spooky" 17996
  // 18043-18090: the band opens under the last words of "…see it coming"
  // (ends 18044) and is done just after the next sentence starts at 18086, so
  // the camera is never moving while the line it makes room for is typing.
  const camera = seg(p.hottest_loop_type, 0.42, 0.55);
  /* ROUND 12 · D7 — THE 5-SECOND TYPEWRITER. This was
       const typing = lin(p.hottest_loop_type, 0.52, 0.93);   // 18079-18229
     driving `TYPE_BODY.slice(0, round(typing * 20))`: 20 characters over 150
     frames, 7.5 frames per glyph. A character typewriter adds ~0.02% of the
     frame per frame — two orders under the 0.3% single-frame burst gate — so
     this was five seconds of the episode's last argument arriving as
     measurable nothing, and it was the single worst instance of the grammar
     the r11 grader called dominant.
     It is now THREE reveals in THREE DIFFERENT grammars, one per clause of the
     sentence that is actually being spoken over them
     ("So take the loop you hit most, / and go look at how the thing it walks /
     is actually laid out." — 18086-18216):
       phrase   mask-wipe    ep18092-18098, lands ~8f before "loop"/"you hit
                             most"; carries TYPE_WASH, which is the area
       arrowIn  spring pop   ep18135-18143, on "go look at how" — the arrow IS
                             "go look at"
       slotIn   line draw-on ep18196-18208, on "is actually laid out" — the
                             empty answer blank the "?" then lands in. It
                             REPLACES the blinking caret, which was itself
                             typewriter chrome, so no element is added.
     The "?" still arrives at ep18236 and still at Q_X: every span keeps its
     exact character content and mono advance, so the flex row measures what it
     always measured and GUIDE_L / GUIDE_R still start on the glyph. */
  const phrase = seg(
    p.hottest_loop_type,
    0.5549,
    0.5549 + fr(AREA_ENTER_F, "hottest_loop_type"),
  ); // ep18092-18098
  const arrowIn = seg(
    p.hottest_loop_type,
    0.6731,
    0.6731 + fr(ENTER_F, "hottest_loop_type"),
  ); // ep18135-18143
  // `lin`, not `seg`: a draw is the one motion that IS the content, and an
  // ease-out on it front-loads the ink and then crawls.
  const slotIn = lin(
    p.hottest_loop_type,
    0.8407,
    0.8407 + fr(12, "hottest_loop_type"),
  ); // ep18196-18208
  // 18236-18247. NOT "on 'laid out'" — that phrase is 18203-18216 and the "?"
  // is the last glyph of a line whose answer blank only draws at 18196-18208,
  // and it is the resolution of that blank, so it cannot
  // precede it. It lands in the gap after the sentence, which is where the
  // question the line poses actually hangs.
  const qMark = seg(p.hottest_loop_type, 0.95, 0.98);

  /* --- sweep_vs_scatter_draw: the last real content. Window 18249-18403 --
     "Sequential, or scattered?" is spoken 18317-18398, i.e. it starts two
     thirds of the way through this step. The strips therefore draw UNDER the
     previous sentence in grey and it is `resolve` — colour + growth on both
     labels at once — that lands inside the spoken pair. Naming what is already
     on screen; not two labels arriving 50 frames early with nothing said about
     them. */
  const guides = lin(p.sweep_vs_scatter_draw, 0, 0.09);
  const seqSlots = seg(p.sweep_vs_scatter_draw, 0.09, 0.19);
  const seqDraw = lin(p.sweep_vs_scatter_draw, 0.22, 0.46);
  const seqLabel = seg(p.sweep_vs_scatter_draw, 0.46, 0.5);
  const scatSlots = seg(p.sweep_vs_scatter_draw, 0.53, 0.63);
  const scatDraw = lin(p.sweep_vs_scatter_draw, 0.66, 0.88);
  const scatLabel = seg(p.sweep_vs_scatter_draw, 0.88, 0.92);
  const resolve = seg(p.sweep_vs_scatter_draw, 0.9, 1); // 18388-18403, inside "scattered?"

  /* --- thesis_type_close: the docked half-thesis completes itself --------
     Window ep18403-18556 (153f), i.e. it runs to the last frame of the
     episode. Measured: the "//" before the last sentence is 18401-18439,
     "Big oh can't tell you." is 18439-18478, and "It counts operations, and
     it never asks the price." is 18487-18556 — the narration plays to the
     final frame, so nothing here is over an empty track. Onsets: "counts"
     ep18492, "never" ep18521. The old 0.3/0.5 fractions put both lines up
     early — the second line landing before the words is what turns the
     episode's last sentence into a caption. */
  /**
   * 0.30-0.42 (ep18449-18467), NOT 0-0.12 (ep18403-18421). THIS IS THE SECOND
   * HALF OF THE LIT-AREA FIX, and it is a scheduling change, not a repaint.
   *
   * `rest` = interpolate(dimRest, [0,1], [1, 0.13]) multiplies the opacity of
   * every layer in this scene except the grid and the docked thesis. That is a
   * textbook RETIRE-CLIFF: at rest 0.13 every element in those layers drops
   * far under the 110 empty-frame gate at once, so the board does not dim, it
   * goes out. Firing it at ep18403 while `line1` does not arrive until ep18481
   * left a 77-frame stretch (measured median lit 1.11%, containing a 19-frame
   * run under 1%) in which the episode's last words had not started and
   * everything else had already been switched off. That stretch is the single
   * worst window in the beat the r13 grade called the emptiest in the episode.
   *
   * Moving the cliff to ep18449 hands 46 frames back at the full board level —
   * TYPE_WASH 2.199% + slot strips 1.784% + guides 0.306% + arcs ~0.85% + the
   * grid ~3.48% + axes 0.567% + bracket ~0.4%, i.e. roughly 9-10% of frame
   * instead of ~1%.
   *
   * IT ALSO FIXES A SILENCE DEFECT. `silencedetect` on narration.master.wav puts
   * the "//" before the last sentence at frames 18397-18442. The old dimRest/undock
   * pair fired at ep18403 and ep18418 — both INSIDE that measured pause, i.e.
   * the board was being cleared while nothing was being said. 18449-18467 sits
   * inside "Big oh can't tell you." (18442-18478), and the line being ghosted
   * is literally the docked "big-O isn't wrong — it's incomplete".
   *
   * WHAT IS LEFT, honestly: `rest` reaches 0.13 at ep18467 and `line1` opens at
   * ep18481, so there is a ~14-frame window whose only lit content is the
   * undocking eyebrow (68px mono ink; its ~7px stems pool to ~206 and do
   * register, but it is a thin object). That is ~0.47s against a 2.0s
   * empty-frame FAIL bar, and it replaces a 77-frame hole. It is not zero and
   * this comment is not going to call it zero.
   *
   * WHY THE FLOOR IS NOT SIMPLY RAISED INSTEAD. Checked and rejected: to keep
   * TYPE_WASH over the 110 gate through the close the layer needs rest >= 0.897
   * (warm luma 180.4 x 0.68 x rest >= 110), and the slot strips need rest >=
   * 0.748 (dim 147). Neither is a ghost. There is no intermediate value of
   * `rest` at which the bottom band survives the gate — the cliff is inherent
   * to gating a whole layer, which is why the fix is WHEN it fires, not how far.
   */
  const dimRest = seg(p.thesis_type_close, 0.3, 0.42); // ep18449-18467
  /**
   * 18f, not 30.6f. 0.1-0.3 of a 153-frame span is 1.02s of continuous
   * emphasized travel against the 600ms ceiling EMPH_F encodes — the same
   * defect this file already fixed on `growDock` (was 46f) and `liveDock` (was
   * 77f), left standing on the one dock that closes the episode.
   *
   * R14 also moved the START, 0.1 -> 0.36 (ep18418 -> ep18458), for two
   * reasons. First the same silence defect as `dimRest`: ep18418 was inside the
   * measured 18397-18442 pause; ep18458 is inside "Big oh can't tell you."
   * Second, geometry — the eyebrow's travel takes it from the docked band
   * (caps 93..134) to THESIS_UNDOCK_TOP (caps 299..348), so mid-travel it
   * passes straight through the slot-label row at 190.8..240.5 and the docked
   * question at 261.5..303.9. With `dimRest` delayed, running the undock on the
   * old schedule would have driven the eyebrow through both of those at FULL
   * ink. Starting at 0.36 puts `dimRest` 87.5% complete (rest ~0.24) before the
   * eyebrow moves at all, so the crossing happens over a board that is already
   * ghosting: one gesture — the board dissolves as the thesis rises out of it —
   * rather than two objects colliding.
   * 0.36 + 18/153 = 0.4776, settling ep18476, five frames before `line1`.
   */
  const undock = seg(
    p.thesis_type_close,
    0.36,
    0.36 + fr(EMPH_F, "thesis_type_close"),
  ); // ep18458-18476
  // ENTER_F, not a 0.10 fraction. 0.10 of a 153-frame span is 15.3 frames —
  // nearly double the 6-9 band, on the two lines the episode ends on, which is
  // the "slow entrances read sleepy" defect in the worst possible place.
  //
  // line1 is 0.51, not 0.44. Against the measured onset of "counts" at ep18492
  // the 0.44 window opened ep18470 and settled ep18478 — fourteen frames early,
  // i.e. the first half of the thesis was already sitting there while the voice
  // was still finishing "Big oh can't tell you." Early is safer than late, but
  // fourteen frames of it makes the line a caption rather than a landing.
  // 0.51 opens ep18481 and settles ep18489, three frames ahead of the word.
  // line2 is unchanged: it opens ep18513 and settles ep18521, one frame ahead
  // of "never" at ep18521, which is as close as this grid gets.
  const line1 = seg(
    p.thesis_type_close,
    0.51,
    0.51 + fr(ENTER_F, "thesis_type_close"),
  ); // 18481-18489, "counts" 18492
  const line2 = seg(
    p.thesis_type_close,
    0.72,
    0.72 + fr(ENTER_F, "thesis_type_close"),
  ); // 18513-18521, "never" 18521
  // 0.78-0.88, NOT 0.88-1.0. thesis_type_close resolves to ep18403-18556, so
  // 0.88-1.0 had this 720px rule still growing at ~20px/frame ON ep18556 — the
  // last frame of the episode. That is the literal mechanism behind D13: the
  // file ran out of frames in the middle of a draw. It now draws ep18522-18538
  // and is finished 18 frames (0.6s) before the end, so the last AUTHORED
  // motion in the episode completes before the episode does and `drift_out` has
  // something to settle.
  const closeRule = lin(p.thesis_type_close, 0.78, 0.88);

  /* --- drift_out: THE SETTLE. Window ep18497-18556 (span 60) -------------
   * D13 — the episode ended on a hard stop: mean frame luma 31.9 and RISING,
   * with 0.97% of the frame still actively changing on ep18556. The step was
   * scheduled and wired, but it was `lin`, and a linear ramp is at FULL
   * velocity on its last frame — so the closing camera push was still
   * accelerating into the cut and `gridDim` was still brightening when the
   * episode stopped. A drift out that never decelerates is not a drift out.
   *
   * `seg` is the house ease-out cubic, whose velocity is 3(1-t)^2 of peak: by
   * ep18550 the camera is down to 2% of its speed and by ep18556 it is at rest.
   * The picture ARRIVES somewhere and stops.
   *
   * IT IS STILL NOT AN END CARD, and that is the constraint that shapes it
   * (PLAYBOOK #11 / faceless-playbook: never announce the ending, never end on
   * a static card, overlap the final seconds with real content). So:
   *   - nothing fades to black. `rest` holds the whole composition at 0.13 and
   *     `gridDim` RISES 0.3 -> 0.38 across the settle, so the machine's board
   *     gets brighter as the camera stops rather than dimming out.
   *   - the closing thesis stays at full ink through the last frame.
   *   - the visual bed stays alive: the sweep cursor runs on `sweepAmbient`,
   *     which is periodic in the absolute frame and owes nothing to `p`, so it
   *     is still gliding after every authored reveal has settled. Its loop seam
   *     is at ep18745 (see SWEEP_PHASE: seams land where (frame + 155) % 300
   *     === 0, i.e. ep18445 then ep18745), so nothing resets inside the settle
   *     — the last seconds are a cursor moving across a live grid, not a reset.
   */
  const drift = seg(p.drift_out, 0, 1);

  /* --- ambient. Periodic only, so absolute frame is safe here ------------ */
  // + SWEEP_PHASE, not the raw frame — see SWEEP_PHASE for the arithmetic and
  // for the r8 dead stretch the old phase was causing.
  const sweepAmbient = ((frame + SWEEP_PHASE) % SWEEP_PERIOD) / SWEEP_PERIOD;
  const swayX = Math.sin(frame / 112) * 3;
  const swayY = Math.cos(frame / 137) * 2;
  // (The blinking caret that used to live here went with the typewriter — see
  // the D7 block on `phrase` / `arrowIn` / `slotIn`.)

  /**
   * Everything that isn't the grid or the closing type fades to a ghost for the
   * thesis. It never reaches 0: the composition staying faintly readable under
   * the last line is what makes the close feel like the end of an argument
   * rather than a cut to a title card.
   */
  const rest = interpolate(dimRest, [0, 1], [1, 0.13]);
  // The grid is the one thing that does NOT fade out for the close, and it
  // comes back up very slightly on the drift so the last moving thing on screen
  // stays legible. Clamped because the two terms are independent progresses.
  const gridDim = clamp01(
    interpolate(dimRest, [0, 1], [1, 0.3]) + drift * 0.08,
  );

  // ONE dash-offset drives the quadratic across two steps — splitting it into
  // two paths would break object constancy exactly where the eye is on it.
  const n2Draw = N2_DRAW_SPLIT * n2Base + (1 - N2_DRAW_SPLIT) * n2Escape;

  // The linear line's own dim, once it has handed the frame to the quadratic.
  // Follows `nRetire`, so R14's move takes this with it: the `n` stroke now
  // stays at full weight until ep17928 instead of dimming to 0.32 at ep17411.
  // That is intentional on both counts — the stroke is the boundary of the
  // 1.886% accent field that is being kept lit, and dimming the boundary while
  // keeping the fill would have read as a bug.
  const nDim = rest * interpolate(nRetire, [0, 1], [1, 0.32]);

  /**
   * Camera settle that opens the bottom band: the upper half LIFTS, and that
   * is now all it does.
   *
   * THE SCALE IS GONE, AND IT WAS THE EPISODE'S READABILITY BUG IN THIS BEAT.
   * This used to be `translateY(camY) scale(camScale)` with camScale ramping
   * 1 -> 0.97, and the r13 grade's "ending beat renders at 32-37px cap against
   * a 40px floor" traces straight to it. Cap height is fontSize x 0.727 x the
   * PRODUCT OF ANCESTOR SCALES, so a 0.97 wrapper takes every element in the
   * upper group under the floor:
   *
   *   56px mono (slot labels, `no cache`, `ask both`, gutter notes, chip/bar
   *              labels)  56 x 0.727 x 0.97 = 39.5px cap   -- UNDER 40
   *   58px sans (CurveTag, the docked questions at HEADER_SIZE)
   *              58 x 0.727 x 0.97 = 40.9 -> 40.9px cap, clearing by 0.9px
   *
   * i.e. the tokens all clear the floor on their own (theme.ts is not the
   * problem) and a single 0.97 on a wrapper 700 lines away puts half the beat
   * under it. That is exactly the class of bug the floor exists to catch, and
   * it is invisible to `check_typesize.ts`, which says so itself: "a cleared
   * fontSize inside a wrapper scaled by transform: scale(0.5) renders at half.
   * Static analysis cannot follow that."
   *
   * NOT compensated by dividing the fontSizes by 0.97 — a compensated size is
   * only correct until someone changes the scale, and then it rots silently.
   * The wrapper lays the beat out at TRUE SIZE and the sizes stay the tokens.
   * Post-fix: 56px mono = 40.7px cap, 58px sans = 42.2px cap, both over.
   *
   * WHAT WAS LOST. 3% of scale on a settle nobody was reading as a zoom. The
   * lift is the gesture (36px of it) and the lift is untouched. Bounds at
   * camera = 1, re-checked without the scale: the topmost thing in the group
   * is the bracket rail at y 164, which lifts to 128 — clear of the 64.8 top
   * safe margin; the lowest is the grid container's bottom edge at y 886,
   * which lifts to 850. `DockedThesis` is a SIBLING of this group, not a
   * child, so it never moved with the camera and still doesn't.
   *
   * NOT A LIT FIX, and no lit claim is made for it: type ink is ~12-15% of its
   * own box, so 3% more of it is ~0.02% of frame. It is a readability fix that
   * happens to make every glyph in the upper group 3% larger.
   */
  const camY = -36 * camera;

  /* ---- THE GRID WIPE, QUANTIZED TO ROWS ---------------------------------
     r8 named f17360-17459 (3.33s) as this beat's worst dead stretch — that
     window is a HISTORICAL measurement against the r8 cut and is not rebased;
     the surprising part was WHAT sat inside it: the grid's own row wipe (today
     ep17458-17511) ran right through it. A 620x408 diagram opening across most
     of the stretch graded as nothing.

     It is an arithmetic failure, not a design one. The detector diffs
     consecutive frames at 240x135 and needs 0.3% of frame (97 low-res pixels)
     to move by >= 25 luma. A smooth 408px-tall reveal over 54 frames advances
     7.5 screen px per frame — 0.94 low-res rows across a 77.5-px-wide column,
     about 73 pixels. Under the gate on EVERY frame of the wipe, so the median
     inter-frame ink over the window stayed below the 0.05% dead-stretch floor
     even though a large object was continuously arriving. This is the same
     trap PRODUCTION-LESSONS names for camera drift: continuous is not the same
     as countable.

     The grid is already made of eight discrete rows, so the fix is to reveal
     it the way it is built. `gridRows` floors the wipe onto row boundaries:
     the clip holds still for ~6 frames, then jumps one whole 46px row. The old
     figure here (620 x 39 = 24,180px2) measured the CONTAINER, which is wrong
     twice over — the grid body is 403px wide, not 620, and the 5px gutters
     between cells are not ink. The honest figure is the row's cells:
     8 x 46 x 46 = 16,928px2 = 0.816% of frame at GRID_SCALE 1.0 (12,232px2 /
     0.590% at the old 0.85), i.e. ~2.7x the 0.3% gate rather than ~4x. Eight
     arrivals on a ~6.75-frame pitch instead of one invisible crawl, and the
     readout still wipes smoothly after them because it is a single line of
     type with no row structure to quantize to.

     THE END STATE IS UNCHANGED. At gridWipe = 1, `Math.floor(1 * 8) = 8`, so
     gridRows = 8 and the term is GRID_H exactly — the same value the smooth
     expression produced. Nothing downstream (GRID_READOUT_H, the 800px bottom
     edge, the readout's own clip) sees any difference. ------------------- */
  const gridRows = Math.min(
    GRID_ROWS,
    Math.floor(clamp01(gridWipe) * GRID_ROWS),
  );
  const gridClip =
    ((GRID_H * gridRows) / GRID_ROWS + GRID_READOUT_H * readoutWipe) *
    GRID_SCALE;

  return (
    /**
     * NO BACKGROUND FILL. This div used to carry `backgroundColor: theme.bg`,
     * which is an opaque #000 sheet over the global <AmbientBackground/> that
     * Episode005.tsx mounts once for the whole episode. The measured cost:
     * mean frame luminance 4.9 against 17.8-21.3 everywhere else, corner
     * luminance 1.8 against 18-20, ffmpeg blackdetect firing across the first
     * 9.83s of the beat, and — worst of all — a visible background POP at the
     * ep17106 cut as the ambient layer was suddenly occluded. Scenes are
     * TRANSPARENT layers; if a beat ever needs to be darker, that is a
     * partial-alpha scrim, never an opaque fill. This one does not need it:
     * `rest` already ghosts the composition to 0.13 under the closing thesis,
     * and every big line carries its own shadow halo for contrast.
     */
    <div
      style={{
        position: "absolute",
        inset: 0,
        fontFamily: SANS,
        overflow: "hidden",
      }}
    >
      {/* Outermost camera: ambient sway always, plus the slow drift out.
          `drift` is EASED (see the drift_out block) so this push decelerates to
          rest instead of being cut off at full speed — the D13 hard stop. The
          frame is still not static at ep18556: `swayX`/`swayY` are periodic in
          the absolute frame and never stop, and the grid is still sweeping
          under the thesis. What settles is the authored motion; the bed keeps
          breathing. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${swayX}px, ${swayY - drift * 12}px) scale(${1 + drift * 0.035})`,
          transformOrigin: "960px 560px",
        }}
      >
        {/* ---- inherited: beat 12's docked half-thesis. Rendered
                unconditionally at p={} because it is CARRIED IN, not revealed —
                fading it in here would re-pop an element the viewer has been
                looking at for two beats. ------------------------------------ */}
        <DockedThesis undock={undock} />

        {/* ================= upper group (camera settles it up) ============ */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            // translateY only — see `camY`. The `scale(0.97)` that used to
            // ride here is the ancestor-scale readability bug and is gone.
            transform: `translateY(${camY}px)`,
          }}
        >
          <svg
            width={1920}
            height={1080}
            viewBox="0 0 1920 1080"
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {/* THE WORK UNDER THE QUADRATIC — first child, so everything else
                in the plot paints OVER it. Order matters four ways: the two 8px
                axes stay the crisp edges of the board rather than being
                half-covered by a region whose base sits on y=740; the `gapFill`
                wedge and its hatches stay the brighter, readable objects on top
                of it; both curves keep their full-strength strokes; and
                N_WORK_PATH sits directly above this one, sharing the same
                ground. That last one USED to be the handover — `nRetire` fired
                in these same six frames and the accent field dissolved into
                this warm one. R14 moved `nRetire` to ep17928; the paint order
                is unchanged and still correct, but the accent field now stays
                on top of this fill for another 517 frames, which is why the
                event arithmetic on WORK_FILL_PATH had to be redone.

                A MASK WIPE, NOT A FADE. The detector calls a pixel changed at
                |dY| >= 25, and a region that fades in over six frames moves
                every one of its pixels by ~7 luma per frame — a large object
                arriving and scoring zero, which is the same trap `gridWipe`
                fell into (see the GRID WIPE block below). Clipping instead
                takes each pixel from background to full fill in ONE frame, so
                every pixel the clip uncovers is over the gate by construction.

                The clip is a rect rising off the baseline: y 740 -> 360,
                height 0 -> PLOT_H, WORK_FILL_W wide so it covers the escape
                column as well as the plot. At t=1 it contains the whole path,
                so the end state is the entire region and nothing stays clipped.

                0.30 of `theme.warm` (R14; was 0.26), and both halves of that
                are load-bearing:
                  LUMA (does it COUNT). All figures below are re-measured over
                  the real ground — `theme.panel` rgba(14,14,16,0.72) on pure
                  black composites to Rec.601 luma 10.2, not the "~17 ambient"
                  this comment used to assume. Warm at 0.30 over it lands at
                  61.3, a 51.0-luma delta, twice the detector's 25. That is the
                  ESCAPE COLUMN's move, where nothing is painted on top.
                  The alpha is NOT set by the escape column though — it is set
                  by the wedge, which keeps only 55% of the move through
                  gapFill's 0.45: 0.26 gives the wedge 24.3 (fails the gate) and
                  0.30 gives 28.1 (passes). See WORK_FILL_PATH; with `nRetire`
                  moved out of these six frames the wedge is no longer optional
                  ink, it is half the reveal.
                  HUE (does it READ). `theme.down` was the obvious choice and is
                  wrong: the wedge already sitting inside this region is
                  theme.down at 0.45 and the seven hatch strokes are theme.down
                  at 0.9, so a red backdrop would swallow both and cost the beat
                  the measure-the-gap gesture it just spent 26 frames making.
                  Warm is the annotation colour this frame is already using for
                  exactly this claim — the "no cache" note and its rule, which
                  the narration says 90 frames earlier — so the fill reads as
                  that note's region rather than as a fourth colour.
                Checked against what has to stay legible over it (WCAG; warm at
                0.30 over the plate = 0.0490 relative luminance). Every number
                here is the 0.30 value, with the old 0.26 value in brackets so
                the cost of the raise is visible rather than buried:
                  n2 curve  theme.down   3.17:1  [3.53]  — still over 3:1, and
                            0.32 would put it at exactly 3.00, which is the
                            other reason the alpha stopped at 0.30.
                  n line    theme.accent 4.20:1  [4.68]  — and this now holds
                            for 517 frames rather than six, since `nRetire` no
                            longer dims the line as the fill arrives.
                  in-order bar / label  theme.up   4.18:1  [4.65]
                  gutter note           theme.warm 5.45:1  [6.07]
                  wedge     theme.down at 0.45 reads 1.65:1 against this fill
                            [1.74], down from 2.00:1 against bare plate. It is
                            dimmer against its surround than it would be alone,
                            and it is DEFINED by strokes rather than by its own
                            contrast — the n2 curve bounding it above is 16px.
                            HONEST WEAK POINT, and it is pre-existing rather
                            than introduced here: inside the overlap the n2
                            stroke reads 1.92:1 against the wedge [2.03] and the
                            0.9 hatches read 1.71:1 [1.80]. Both are same-hue
                            reds stacked on each other. The curve is saved by
                            its OUTER edge (6.4:1 against the plate above it);
                            the hatches are not, and they are the thinnest
                            justified thing on this board. Not repainted here
                            because the fix is a hue change to an element this
                            defect list does not cover — flagged, not fixed.
                Like `gapFill` this sits below the 3:1 idle floor (1.98:1 as an
                object on black, measured) and like `gapFill` that is the right
                answer here: it is texture
                under a stroke, and every step it takes toward its own floor is
                a step the curve that DEFINES it loses. */}
            <clipPath id="e005b15-work-wipe">
              <rect
                x={ORIGIN_X}
                y={BASELINE - PLOT_H * clamp01(workFill)}
                width={WORK_FILL_W}
                height={PLOT_H * clamp01(workFill)}
              />
            </clipPath>
            <path
              d={WORK_FILL_PATH}
              fill={theme.warm}
              // 0.30, raised from 0.26 in R14. This is not a taste change, it
              // is the price of moving `nRetire` off this reveal: with the
              // accent field no longer vacating underneath, the ONLY part of
              // this region that changes by more than the detector's 25-luma
              // gate is whatever this fill can move on its own. Over the plate
              // (composite luma 10.2) warm-at-a lands at 175a + 10.2(1-a); the
              // wedge above it keeps 55% of that move through gapFill's 0.45,
              // so the wedge needs a >= ~0.28 to clear 25. Measured: a=0.26 ->
              // wedge delta 24.3 (FAILS), a=0.28 -> 26.2, a=0.30 -> 28.1.
              // Taken at 0.30 for a 3.1-luma margin rather than 1.2. The ceiling
              // is the n^2 curve, which reads over this fill at 3.17:1 at a=0.30
              // and exactly 3.00:1 at a=0.32 — so 0.30 is the last value with
              // any margin on BOTH constraints. Still luma 61.3, far under the
              // 110 lit gate: this buys event ink, never lit area.
              opacity={workFill > 0 ? 0.3 * rest : 0}
              clipPath="url(#e005b15-work-wipe)"
            />
            {/* THE WORK THE LINEAR MODEL DOES — a CONTIGUOUS field, uncovered
                by the same marker pass that draws the `n` line and handed over
                to `workFill` at the end of the step. Sits above `workFill` and
                below the axes and both curves, so the 10px envelopes stay the
                readable objects and this stays the ground they ride on.

                This was a 7px/24px hatch and the hatch measured ~0.00% — see
                N_WORK_PATH for why (a pattern pools to its duty-weighted mean,
                which lands under the gate however bright the ink is), for the
                area, and for the alpha solve.

                The clip is a plain left-to-right rect driven by `nDraw`, so the
                field is uncovered at exactly the rate the line is drawn — the
                region and its boundary are one gesture, not two objects. It is
                a clip and not a fade for the usual reason: a clip takes each
                pixel from background to full fill in ONE frame, so every pixel
                it uncovers clears the detector's 25-luma gate by construction,
                where a six-frame fade moves them ~20 luma per frame and scores
                nothing. */}
            <clipPath id="e005b15-nwork-wipe">
              <rect
                x={ORIGIN_X}
                y={N_WORK_TOP - 4}
                width={PLOT_W * clamp01(nDraw)}
                height={N_WORK_RISE + 8}
              />
            </clipPath>
            <path
              d={N_WORK_PATH}
              fill={theme.accent}
              // N_WORK_ALPHA (0.80) is the empty-frame solve and is the only
              // reason this number is not lower — composite luma 122 against a
              // 110 gate, over 1.886% of frame, which is the single biggest lit
              // object in this beat. `nWorkAlpha` retires it on `nRetire`,
              // which R14 moved from ep17411 to ep17928 so that 1.886% is held
              // across the emptiest 517 frames of the beat and is given up only
              // when `morph` turns the curves it annotates into bars. `rest`
              // ghosts it with the board for the close.
              opacity={nDraw > 0 ? N_WORK_ALPHA * nWorkAlpha * rest : 0}
              clipPath="url(#e005b15-nwork-wipe)"
            />
            {/* the board returns — see AXIS_W / CURVE_W for why these are
                beat 2's weights and not the half-weight they used to be */}
            <Draw
              d={X_AXIS_PATH}
              t={axesDraw}
              color={theme.dim}
              w={AXIS_W}
              dim={rest}
            />
            <Draw
              d={Y_AXIS_PATH}
              t={axesDraw}
              color={theme.dim}
              w={AXIS_W}
              dim={rest}
            />
            {/* the gap between the two lines — under the strokes, so the
                curves stay the readable objects and the region is texture */}
            <clipPath id="e005b15-gap-wipe">
              <rect
                x={GAP_X0}
                y={BASELINE - PLOT_H - 40}
                width={GAP_W * clamp01(gapFill)}
                height={PLOT_H + 60}
              />
            </clipPath>
            <path
              d={GAP_PATH}
              fill={theme.down}
              // 0.45, and this is a CAPPED value, not the 3:1 solve. The
              // region is bounded by the n^2 curve, which is the same
              // `theme.down` at full — so every step the fill takes toward its
              // own floor is a step the curve loses. `theme.down` reaches 3:1
              // on black at 0.65, and at 0.65 the curve over the fill is
              // 2.09:1: the line that DEFINES the region would dissolve into
              // it. 0.45 is where the curve is still 3.19:1 over the fill,
              // which is the binding constraint. The fill itself lands at
              // 1.96:1 — below the idle floor on purpose, and the one place in
              // this file where that is the right answer, because this really
              // is texture under a stroke rather than an object of its own.
              // Still a real gain over 0.30 (1.44:1, Rec.709 luma 35 vs 59).
              opacity={gapFill > 0 ? 0.45 * rest : 0}
              clipPath="url(#e005b15-gap-wipe)"
            />
            {GAP_HATCH.map((d, i) => (
              <Draw
                key={d}
                d={d}
                t={gapHatch[i]}
                color={theme.down}
                w={5}
                dim={rest * 0.9}
              />
            ))}
            <Draw
              d={N_PATH}
              t={nDraw}
              color={theme.accent}
              w={CURVE_W}
              dim={nDim}
            />
            <Draw
              d={N2_PATH}
              t={n2Draw}
              color={theme.down}
              w={CURVE_W}
              dim={rest}
            />
            {/* header rules: the empty slots the two questions dock ONTO, which
                is what stops the dock reading as type shrinking for no reason */}
            <Rule
              x={LEFT_X}
              y={HEADER_RULE_Y}
              w={LEFT_RULE_W}
              t={leftRule}
              dim={rest}
            />
            <Rule
              x={RIGHT_X}
              y={HEADER_RULE_Y}
              w={RIGHT_RULE_W}
              t={rightRule}
              dim={rest}
            />
            {/* h=10 (R14). theme.warm is luma 175 but at 2px it pooled to
                0.25 x 175 = 44 and was invisible to both the eye and the gate;
                at 10px (1.25 proxy px) the 340 x 10 = 3,400px2 = 0.164% of
                frame reads. Small, and claimed as small. BOUNDS: y 452..462,
                x 258..598. The note's descender row ends at 436.5, and inside
                the rule's x span nothing else is painted — the n2 curve crosses
                y 462 at x 678 and the `n` line never descends that far — so the
                extra 8px lands on empty plot. NOT an event: 0.164 x 6 / 21 =
                0.05% per window. */}
            <Rule
              x={NOTE_LEFT}
              y={NOTE_RULE_Y}
              w={NOTE_RULE_W}
              t={noteRule}
              dim={rest}
              color={theme.warm}
              h={10}
            />
            <Draw
              d={BOTH_BRACKET_PATH}
              t={bothBracket}
              color={theme.warm}
              w={BOTH_BRACKET_W}
              dim={rest}
            />
          </svg>

          <SlotLabel left={LEFT_X} t={modelLabel} dim={rest}>
            the model
          </SlotLabel>
          <SlotLabel left={RIGHT_X} t={machineLabel} dim={rest}>
            the machine
          </SlotLabel>

          {/* the quadratic's tail label, riding the line out of its own plot */}
          {/* 866, not 806. N2_PATH ends at (800, 280) drawn at CURVE_W 10, so
              its right edge is x≈805 (it was x≈803 at w=6, and 866 still clears
              it by 61px) — the tag's box started 3px off the stroke and
              graded as overprinting the curve (D8). It also sat inside the
              831 fallback-width end of the docked "how does it grow?".
              866..916 is 63px clear of the stroke and 35px clear of the
              fallback question, in a y band (252..310) whose only neighbour is
              "ask both" (717..987, bottom 238). Still the only mark up here, so
              it still reads as the tail's label. */}
          <CurveTag
            left={866}
            top={252}
            t={n2Escape}
            color={theme.down}
            dim={rest}
          >
            n&sup2;
          </CurveTag>
          {/* THE `n` CURVE TAG IS GONE, and its removal is the point.
              It sat at (762, 512) — a single 33x30px glyph, ~1,000px², which is
              0.05% of the frame and thirty times under REVEAL_INK_MIN_FRACTION.
              At that size it never read as a label; it read as an unexplained
              coloured mark floating in the wedge between the linear line's end
              point (750, 572.8) and the sequential sliver at 752..796 x
              594..600 — and the grade duly logged it as a small orphan
              rectangle at that exact spot, attached to nothing.
              It was also never narrated: nothing in this beat says the word
              "n", and the argument the beat IS making belongs entirely to the
              quadratic, which keeps its `n²` tag. An element nobody talks about
              is an ad (PLAYBOOK rule 5), and the previous fix for it — nudging
              it 36px up out of the sliver — treated a labelling problem as a
              spacing problem. Deleting it is the honest version: the accent
              line is a callback the viewer has already been taught, and the
              only mark left in the plot is the one that carries the claim. */}

          {/* mask-wipe, not a fade: the text is uncovered left to right, which
              is the fourth entrance grammar in a row of four different ones */}
          <div
            style={{
              position: "absolute",
              left: NOTE_LEFT,
              top: NOTE_TOP,
              width: NOTE_W * noteWipe,
              height: NOTE_SIZE + 12,
              overflow: "hidden",
              opacity: rest,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: NOTE_SIZE,
                lineHeight: `${NOTE_SIZE + 12}px`,
                color: theme.warm,
                whiteSpace: "nowrap",
              }}
            >
              {NOTE_TEXT}
            </div>
          </div>

          {/* ---- the grid returns, wiped down row by row ------------------ */}
          <div
            style={{
              position: "absolute",
              left: GRID_LEFT,
              top: GRID_TOP,
              width: 620,
              height: gridClip,
              overflow: "hidden",
              opacity: gridDim,
            }}
          >
            <div
              style={{
                transform: `scale(${GRID_SCALE})`,
                transformOrigin: "left top",
              }}
            >
              {/* readoutScale = GRID_SCALE counter-scales the cost line so it
                  lands at exactly 56px (the mono floor) on screen whatever the
                  wrapper is doing. At GRID_SCALE 1.0 that is the identity, so
                  the readout is 56 grid-local = 56 on screen — the SAME
                  on-screen size it had at 0.85, which is the reason the scale
                  change costs nothing in readability. (The r13 grade blamed
                  GRID_SCALE for this beat's undersized type; it was never able
                  to be that, precisely because of this counter-scale. See
                  `camY` for the scale that really was doing it.)

                  showPrefetch is OFF here, and that is a bounds decision, not
                  taste: at 56px on screen, "· prefetch on" adds 12 chars =
                  ~403px, which runs the line from GRID_LEFT 1240 to 2147 — off
                  the frame, never mind the 1805 margin. Without it the line is
                  "64 read · 8 lines", 15 chars = 504px, ending at 1744, inside
                  the safe edge with 61px to spare. The prefetcher is beat 8's
                  argument anyway; here the grid is ambient texture under the
                  two questions.

                  GRID_READOUT_GAP 12 (was 18, which rendered 15.3 at the old
                  0.85) puts the line box at grid-local 492..548, inside the 570
                  this container reserves, and on screen at 808..864 with
                  descenders ~873 — clear of the questions' pop at bigTop 880,
                  whose caps start at 892.5. */}
              <MemoryGrid
                mode="sweep"
                progress={sweepAmbient}
                showPrefetch={false}
                readoutScale={GRID_SCALE}
                readoutGap={GRID_READOUT_GAP}
                readoutFont={MONO}
              />
            </div>
          </div>

          {/* ---- centre gutter: chips -> Drepper's bars ------------------- */}
          {CHIP_RECTS.map((chip, i) => (
            <ChipToBar
              key={CHIP_LABELS[i]}
              chip={chip}
              bar={BAR_RECTS[i]}
              enter={chipIn[i]}
              morph={morph}
              chipLabel={CHIP_LABELS[i]}
              barLabel={BAR_LABELS[i]}
              chipColor={CHIP_COLORS[i]}
              barColor={BAR_COLORS[i]}
              dim={rest}
            />
          ))}
          {/* Both cut to <=10 chars so they fit the 790..1150 channel at the
              REAL mono floor — see GUTTER_NOTE_LEFT. Each is still the phrase
              the narration is saying while it is on screen. */}
          <GutterNote t={trickIn * (1 - trickOut)} morph={morph} dim={rest}>
            a trick
          </GutterNote>
          <GutterNote t={spookyIn} morph={morph} dim={rest}>
            you see it
          </GutterNote>

          {/* ---- the two questions: pop big, then DOCK (never vanish) -----

              R14 — BOTH bigTops move 806 -> 880, and it is one number for both
              because the pair has to stay a matched pair. The grid went to
              GRID_SCALE 1.0 for lit area (see GRID_SCALE), which drops the
              machine's column 75px: its readout now bands 808..864 on screen
              with descenders ~873, where at 0.85 it banded 739..795. A
              96px/lineHeight-1 question at bigTop 806 boxes 806..902 with caps
              818.5..885.3 — straight through the readout. At 880 it boxes
              880..976, caps 892.5..962.6, descenders (the `g` of "grow") ~991:
                readout descenders 873 -> question caps 892.5   19.5px
                question descenders 991 -> text-bounds floor 1015  24px
              The band below is still empty across both questions' lives — the
              challenge line wipes in at ep18092, the guides at ep18249, and
              the left question docks at ep17301 / the right at ep17678.
              (These are TRUE on-screen numbers now: the upper group no longer
              carries a scale(0.97), so nothing here needs dividing by it.) */}
          {/*
            bigTop 880, not 430 — the same fix D10 made on the right-hand
            question, applied to the sibling that had the identical defect and
            was never checked for it.

            At 430 this line lay straight across the plot: the quadratic passes
            through that y band between x 638 and x 701, and "no cache" parks at
            258..541 x 372..443. So for the frames the question held before
            docking it was printing over the one curve the sentence is about —
            the exact failure the right question was moved for ("the question
            can't be the thing hiding it"), on the exact diagram the question is
            asking about.

            Below the x-axis (y 740) the band is empty until the challenge line
            wipes in at ep18092, long after this has docked at ep17301, so
            the question now sits under the board it interrogates like a caption
            and then travels up into its header slot. That also makes the two
            questions a matched pair — both pop at y 880 at BIG_QUESTION_SIZE
            under their own diagram, both climb to HEADER_TOP — instead of one
            caption and one overlay, and it makes the left dock the same large
            gesture as the right one: at 96px that is 949 x 96 of ink sweeping a
            949 x 630 region, well over REVEAL_INK_TARGET_FRACTION, which is
            what has to carry the beat now that the small chrome around it has
            been pulled out of these frames.

            `bigLeft` stays at 125: at BIG_QUESTION_SIZE the line runs 125..1074
            in the wide 0.6em fallback (125..992 with Inter loaded), so both the
            116 safe edge and the 1805 edge are still clear.
          */}
          <DockingQuestion
            inP={growIn}
            dockP={growDock}
            bigLeft={125}
            bigTop={880}
            dockLeft={LEFT_X}
            dim={rest}
          >
            how does it grow?
          </DockingQuestion>
          {/*
            D10 — this used to pop big at (990, 430), i.e. 990..1700 x 430..508,
            which lay straight across the grid: the grid is 8 rows of 46 on a
            62px pitch from y 316, so the big line covered rows 2, 3 and 4 of
            the machine's board for the 119 frames it held before docking
            (`liveIn` settles ep17541, `liveDock` starts ep17660). The whole
            point of the beat is that the grid is still running while the
            question is asked, so the question can't be the thing hiding it.

            It now pops in the empty band BELOW the grid (grid content ends at
            y 873 — 8*46 + 7*16 = 480 at GRID_SCALE 1.0, plus the readout, which
            at the mono floor runs grid-local 492..548 = screen 808..864 with
            descenders ~873, from GRID_TOP 316). At BIG_QUESTION_SIZE the line
            occupies y 880..976 (lineHeight is pinned to 1), clear of 873 above
            and 39px above the 1015 text-bounds floor, and the bottom band it
            borrows is empty until the challenge line wipes in at ep18092,
            long after this has docked at ep17678. Reading order improves too:
            the question now sits under the board it is asking about, like a
            caption, and then travels UP into the header slot — a bigger, more
            legible gesture than the old 200px hop, without touching the
            ep17536 `where` mark that `liveIn` is cut to.

            `bigLeft` comes back 990 -> 730 because the type grew. At
            BIG_QUESTION_SIZE, in the wide 0.6em fallback advance and with the
            big state's -1.8 tracking, "where does it live?" is 19 ch ->
            19*57.6 - 34.2 = 1060.2px. From 990 that ends at 2050.2 — 245px
            past the 1805 safe edge and 130px past the frame itself. From 730 it
            runs 730..1790.2, inside the edge; with Inter actually loaded it is
            969px wide, i.e. 730..1699. It still starts right of the left
            board's plot (which ends at x 750, y 740) and there is nothing else
            in this band across ep17536-17678.
          */}
          <DockingQuestion
            inP={liveIn}
            dockP={liveDock}
            bigLeft={730}
            bigTop={880}
            dockLeft={RIGHT_X}
            dim={rest}
          >
            where does it live?
          </DockingQuestion>

          <div
            style={{
              position: "absolute",
              left: BOTH_LABEL_LEFT,
              top: BOTH_LABEL_TOP,
              fontFamily: MONO,
              // TYPE.code (68px mono = 49.4px cap), matching the slot-label row
              // it shares — see SlotLabel for why the annotation token's 0.7px
              // of margin over the floor was not enough on this row.
              // 8 chars at 68px (0.6em, no tracking on this line) = 326px, so
              // 717..1043 — inside the 626..1150 gutter the two 68px slot
              // labels now leave, with 91px on the left and 107px on the right.
              // No descenders in "ask both", so the row bottoms out at its
              // baseline (240.5) like its neighbours.
              fontSize: TYPE.code.fontSize,
              lineHeight: 1,
              color: theme.warm,
              opacity: bothLabel * rest,
              transform: `translateY(${(1 - bothLabel) * -6}px)`,
              whiteSpace: "nowrap",
            }}
          >
            ask both
          </div>
        </div>

        {/* ================= bottom band =================================== */}
        <div style={{ position: "absolute", inset: 0, opacity: rest }}>
          {/* The selection wash under the challenge line — the area half of
              the `phrase` mask-wipe. Drawn before the row so the type paints
              over it; see TYPE_WASH for the measurement and the bounds. */}
          <div
            style={{
              position: "absolute",
              left: TYPE_WASH.left,
              top: TYPE_WASH.top,
              width: TYPE_WASH.w * phrase,
              height: TYPE_WASH.h,
              // 0.68 (R14; was 0.49). #E3B341 at 0.49 on black composites to
              // Rec.601 luma 88.4 — under the 110 empty-frame gate, so 2.199%
              // of frame was being painted and banking ZERO lit area. 0.68
              // composites to 122.6, over the gate by 12.6, which is the same
              // margin N_WORK_ALPHA was solved for. Ceiling is the ink type on
              // top: 3.43:1 at 0.68, 3.26:1 at 0.70, 3.00:1 at ~0.76 — so 0.68
              // keeps 14% of headroom on the readability floor. Wash on black
              // rises 3.09:1 -> 5.19:1, so it also reads better as an object.
              background: "rgba(227, 179, 65, 0.68)",
              borderRadius: 6,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: TYPE_LEFT,
              top: TYPE_TOP,
              display: "flex",
              alignItems: "baseline",
              fontFamily: MONO,
              fontSize: TYPE_SIZE,
              color: theme.ink,
              whiteSpace: "pre",
            }}
          >
            {/* Full string, always laid out; the CLIP is what arrives. Nothing
                reflows, so the arrow and the "?" after it never move. */}
            <span style={{ clipPath: `inset(0 ${(1 - phrase) * 100}% 0 0)` }}>
              {TYPE_HEAD}
            </span>
            {/* Pops rather than being typed. Its box is the same 3 mono chars
                it always occupied, so the "?" still lands at Q_X. */}
            <span
              style={{
                opacity: arrowIn,
                transform: `scale(${pop(arrowIn)})`,
                transformOrigin: "center",
              }}
            >
              {TYPE_ARROW}
            </span>
            <span
              style={{
                color: theme.warm,
                // Lands with the house overshoot. THE `resolve` SHRINK IS GONE:
                // it was `pop(qMark) * interpolate(resolve, [0,1], [1, 0.6])`,
                // i.e. the glyph ended the beat at 56 x 0.6 = 33.6px, a 24.4px
                // cap against the 40px floor — the single smallest piece of
                // narrated type in the beat, and the one the two answers below
                // are supposed to be answering. The handoff it was performing
                // is already carried by GUIDE_L / GUIDE_R fanning out of this
                // exact glyph on the same `resolve`; the shrink was the
                // readability cost of saying it twice. At 56px flat the cap is
                // 40.7px and it clears.
                opacity: qMark,
                transform: `scale(${pop(qMark)})`,
                display: "inline-block",
              }}
            >
              ?
            </span>
          </div>

          {/* The answer blank. Line draw-on, left to right, in the slot the "?"
              lands in 28 frames later — it is what the old blinking caret was
              standing in for, minus the typewriter. 78 x 8 at warm (luma 175,
              over the luma-110 lit gate) = 624 px = 0.030% of frame: this one
              is a MARK, not an area event, and no event claim is made for it.
              y 833..841 is 6px under the row's 827 baseline and, after R14
              widened the guides to 8px and dropped Q_Y to 848, still 3px above
              GUIDE_R's top edge where that line leaves the glyph. */}
          <div
            style={{
              position: "absolute",
              left: 922,
              top: 833,
              width: 78 * slotIn,
              height: 8,
              background: theme.warm,
              borderRadius: 4,
            }}
          />

          <svg
            width={1920}
            height={1080}
            viewBox="0 0 1920 1080"
            style={{ position: "absolute", inset: 0 }}
          >
            {/* R14 weights. Everything in this SVG used to be 2-4px of an
                under-gate colour, i.e. the whole bottom band drew 0.000% of lit
                area. Guides: theme.stroke(90) w2 -> theme.dim(147) w8. Arcs:
                w4 -> w10. See GUIDE_L and hopPath for the measured lengths, the
                pooling discount, and the arc/guide crossing. */}
            <Draw d={GUIDE_L} t={guides} color={theme.dim} w={8} dim={1} />
            <Draw d={GUIDE_R} t={guides} color={theme.dim} w={8} dim={1} />
            <Draw d={SEQ_PATH} t={seqDraw} color={theme.up} w={10} dim={1} />
            <Draw
              d={SCAT_PATH}
              t={scatDraw}
              color={theme.down}
              w={10}
              dim={1}
            />
          </svg>

          <SlotStrip x={SEQ_X} t={seqSlots} />
          <SlotStrip x={SCAT_X} t={scatSlots} />

          <StripLabel x={SEQ_X} t={seqLabel} resolve={resolve} color={theme.up}>
            sequential
          </StripLabel>
          <StripLabel
            x={SCAT_X}
            t={scatLabel}
            resolve={resolve}
            color={theme.down}
          >
            scattered
          </StripLabel>
        </div>

        {/* ================= the close ===================================== */}
        <ClosingThesis line1={line1} line2={line2} rule={closeRule} />
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------- */

/** SVG stroke that draws itself. pathLength=1 normalises every path so one
 *  0..1 drives lines of wildly different lengths identically. */
const Draw: React.FC<{
  d: string;
  t: number;
  color: string;
  w: number;
  dim: number;
}> = ({ d, t, color, w, dim }) => (
  <path
    d={d}
    fill="none"
    stroke={color}
    strokeWidth={w}
    strokeLinecap="round"
    strokeLinejoin="round"
    pathLength={1}
    strokeDasharray="1 1"
    strokeDashoffset={1 - clamp01(t)}
    // The 0.92 is gone. `theme.stroke` is 3.09:1 at FULL opacity — it is the
    // floor with 0.09 to spare — so multiplying it by anything puts it under,
    // and the two fan-out guides still pass exactly that colour in. At 0.92 the
    // board this beat opens on measured 2.79:1. (The two AXIS draws no longer
    // pass theme.stroke at all — they moved to theme.dim, 6.53:1, with beat 2;
    // see AXIS_W.) The other callers (accent, down, up curves) only gain from
    // it. `dim` is the caller's own choreography and stays untouched.
    opacity={t > 0 ? dim : 0}
  />
);

/** A horizontal rule that grows from its left edge — same draw-on grammar as
 *  the curves, so a slot arriving reads as part of the same board. */
const Rule: React.FC<{
  x: number;
  y: number;
  w: number;
  t: number;
  dim: number;
  color?: string;
  h?: number;
}> = ({ x, y, w, t, dim, color = theme.stroke, h = 2 }) => (
  <rect
    x={x}
    y={y}
    width={w * clamp01(t)}
    height={h}
    fill={color}
    // Same `theme.stroke` trap as `Draw` above: the default colour is 3.09:1
    // at full and 2.32:1 at 0.8. These rules are the empty slots the two
    // questions dock ONTO — if the slot isn't visible the dock reads as type
    // shrinking for no reason, which is the exact failure this component
    // exists to prevent.
    //
    // R14 ADDED `h`, DEFAULT 2, AND ONLY ONE CALLER RAISES IT. A 2px rule is a
    // quarter of a proxy pixel at 240x135, so all three of these draw 0.000% of
    // lit area whatever colour they are. The note rule can afford to grow (see
    // its call site); the two HEADER rules cannot, and that was checked rather
    // than assumed: HEADER_RULE_Y is 328, the docked questions' descenders
    // reach 321, and the y-axis top cap reaches 330 — nine free pixels, which
    // is not enough for the 8px minimum a stroke needs to register. Raising
    // them would have bought 1,160 x 8 = 9,280px2 = 0.448% and cost a collision
    // with the axis corner. Not taken.
    opacity={dim}
    rx={1}
  />
);

const SlotLabel: React.FC<{
  left: number;
  t: number;
  dim: number;
  children: React.ReactNode;
}> = ({ left, t, dim, children }) => (
  <div
    style={{
      position: "absolute",
      left,
      top: SLOT_LABEL_TOP,
      fontFamily: MONO,
      // TYPE.code (68px mono = 49.4px cap), up from TYPE.annotation (56 =
      // 40.7). The annotation token clears the 40px floor by 0.7px, which is
      // no margin at all once the render is graded off a --scale=0.5 draft
      // where antialiasing eats the cap band from both sides; these two are the
      // column HEADERS of the whole composition ("the model" / "the machine")
      // and they are the labels the beat's entire left/right argument hangs on,
      // so they get read type rather than floor type.
      // WIDTHS at 68px mono (0.6em advance + 1 letterSpacing = 41.8px/char):
      //   "the model"    9 ch = 376px -> 250..626, clear of `ask both` (717) by 91
      //   "the machine" 11 ch = 460px -> 1150..1610, inside the 1805 safe edge
      // VERTICAL, with lineHeight 1 pinning the box to the em: caps 190.5..240.5
      // (SLOT_LABEL_TOP + 0.125em .. + 0.86em), which clears the bracket rail's
      // lower edge at 170 by 20px and the question row's caps at 261.5 by 21px.
      // Neither string has a descender (t h e m o d l a c i n) — if the copy
      // ever gains one it drops to 261 and touches the question row, so
      // re-measure before changing these two words.
      fontSize: TYPE.code.fontSize,
      lineHeight: 1,
      letterSpacing: 1,
      color: theme.dim,
      opacity: t * dim,
      transform: `translateX(${(1 - t) * -10}px)`,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

const CurveTag: React.FC<{
  left: number;
  top: number;
  t: number;
  color: string;
  dim: number;
  children: React.ReactNode;
}> = ({ left, top, t, color, dim, children }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      fontFamily: SANS,
      fontWeight: 700,
      // TYPE.label (58px sans = 40.6px cap). 40 rendered a 28px cap.
      fontSize: TYPE.label.fontSize,
      lineHeight: 1,
      color,
      opacity: clamp01(t / 0.4) * dim,
      transform: `scale(${pop(t)})`,
      transformOrigin: "left center",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

/**
 * The two questions. Each pops big over its own region and then DOCKS into that
 * region's header slot — it never disappears, because both questions have to be
 * on screen together for "ask both questions" to mean anything.
 *
 * Big and docked are both left-anchored, and both the left AND the top of the
 * oversized state are pre-computed per side, so each question pops over free
 * space in its own region without interpolating textAlign (not interpolable).
 * Both extremes are sized against a WIDE fallback font (0.6em advance, worse
 * than Inter) so the right-hand one ends at 1790 big / 1800 docked rather than
 * spilling the 1805 safe edge if the render machine can't load Inter. (Inter is
 * now actually loaded — see the top of the file — so the real widths are 969px
 * big at BIG_QUESTION_SIZE and 595px docked at HEADER_SIZE, i.e. 730..1699 and
 * 1150..1745. The fallback budget is the worst case.)
 */
const DockingQuestion: React.FC<{
  inP: number;
  dockP: number;
  bigLeft: number;
  /** Where the oversized state sits before it docks. Kept per-question even
   *  though both now pass 880 — each has to stay OFF its own diagram (the plot
   *  on the left, the grid on the right) and their free bands could diverge
   *  again. The horizontal anchors DO still differ; see the two call sites. */
  bigTop: number;
  dockLeft: number;
  dim: number;
  children: React.ReactNode;
}> = ({ inP, dockP, bigLeft, bigTop, dockLeft, dim, children }) => {
  const left = lerp(bigLeft, dockLeft, dockP);
  const top = lerp(bigTop, HEADER_TOP, dockP);
  const size = lerp(BIG_QUESTION_SIZE, HEADER_SIZE, dockP);
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        fontFamily: SANS,
        fontWeight: SANS_HEAVY,
        fontSize: size,
        letterSpacing: lerp(-1.8, -0.6, dockP),
        // 1, not 1.15: the docked state is one row in a stack whose cap bands
        // are quoted at the top of the file, and a 1.15 box drifts the caps
        // 5px down into the header rule at 328.
        lineHeight: 1,
        color: theme.ink,
        // Big, it owns the frame at full strength; docked, it belongs to the
        // board and dims with everything else.
        // `inP`, NOT `inP / 0.4`. The /0.4 was the bug behind both graded
        // entrance defects: it saturated the fade at 40% of an already
        // ease-out-cubic window, so a caller-side 8-frame entrance rendered as
        // ~1.5 frames of fade and the question appeared to be simply switched
        // on. The window IS the entrance now — ENTER_F frames, in band, with
        // `pop()` overshooting across the same span.
        opacity: clamp01(inP) * lerp(1, dim, dockP),
        transform: `scale(${pop(inP)})`,
        transformOrigin: "left center",
        whiteSpace: "nowrap",
        // The separation glow fades WITH the dock. It used to be
        // `dockP < 0.5 ? glow : "none"`, which killed a 30px halo in a single
        // frame at the midpoint of the travel — over the live grid that reads
        // as a flicker. `where does it live?` crosses the whole grid at its big
        // size, so the glow has to exist there and has to leave continuously.
        // rgba(0,0,0,a) is theme.bg (#000000) with an alpha channel, not a new
        // colour — an alpha is the one thing a hex token can't carry.
        textShadow: `0 6px 30px rgba(0, 0, 0, ${(0.9 * (1 - dockP)).toFixed(3)})`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * The beat-11 callback becoming the beat-9 callback. `vector` and `list` arrive
 * as chips, then the chips THEMSELVES stretch into the two bars — transform
 * over add/remove, and the transform is the argument: the vector collapses to a
 * sliver, the list towers. Their labels ride out from inside the chip to under
 * the bar rather than being swapped.
 */
const ChipToBar: React.FC<{
  chip: { left: number; top: number; width: number; height: number };
  bar: { left: number; top: number; width: number; height: number };
  enter: number;
  morph: number;
  chipLabel: string;
  barLabel: string;
  chipColor: string;
  barColor: string;
  dim: number;
}> = ({
  chip,
  bar,
  enter,
  morph,
  chipLabel,
  barLabel,
  chipColor,
  barColor,
  dim,
}) => {
  const m = clamp01(morph);
  // Data structure -> access pattern; see CHIP_COLORS / BAR_COLORS.
  const color = interpolateColors(m, [0, 1], [chipColor, barColor]);
  const left = lerp(chip.left, bar.left, m);
  const top = lerp(chip.top, bar.top, m);
  const width = lerp(chip.width, bar.width, m);
  const height = lerp(chip.height, bar.height, m);
  // Label box: BAR_LABEL_W (280) wide once docked, centred on its bar. The box
  // is transparent and only the glyphs are visible, so what has to clear is the
  // GLYPH run: "in order" is 270px centred at 774 (639..909) and "random" is
  // 203px centred at 1039 (937..1140). See BAR_RECTS for why the bars moved.
  //
  // D8 — THE TRAVEL IS L-SHAPED, NOT DIAGONAL, AND THAT IS THE WHOLE FIX.
  // Both labels start centred on 960 (the two chips share a column, 855 wide
  // 210) and separate to 774 / 1039 as they land. Run x and y off the SAME `m`
  // and the pair separates horizontally at exactly the rate it converges
  // vertically, so mid-morph they are on one row and still overlapping:
  //   rightEdge("in order") = 1095 - 186m, leftEdge("random") = 858.5 + 79m
  //   -> glyph gap = 265m - 236.5, negative for all m < 0.893
  //   cap bands are 86(1-m) apart, i.e. touching once m > 0.52
  // which is an 83px-deep collision at m 0.58 and the ~2.7s the grader saw.
  // So: finish ALL the horizontal travel by m 0.45, and start the vertical
  // drop at m 0.45. The label slides out of the chip, then drops under its
  // bar. At every m the pair is either on two rows (m < 0.45, caps 45px apart)
  // or fully separated horizontally (m >= 0.45, 28px glyph gutter). No value
  // of m puts them on the same row and overlapping.
  const mx = seg(m, 0, 0.45);
  const my = seg(m, 0.45, 1);
  const labelLeft = lerp(
    chip.left,
    bar.left + bar.width / 2 - BAR_LABEL_W / 2,
    mx,
  );
  const labelWidth = lerp(chip.width, BAR_LABEL_W, mx);
  // -36, not -26: at the 56px floor the label's cap band is 41px tall inside a
  // 74px normal-line-height box, so -26 hung the caps low in a 66px chip. -36
  // centres the cap band on the chip's own centre line (413..454 in a 400..466
  // chip). The docked end is unchanged.
  const labelTop = lerp(chip.top + chip.height / 2 - 36, BAR_BASELINE + 12, my);
  const enterA = clamp01(enter / 0.4) * dim;
  const rect = {
    position: "absolute" as const,
    left,
    top,
    width,
    height,
    borderRadius: lerp(10, 3, m),
    transform: `scale(${pop(enter)})`,
    transformOrigin: "center bottom" as const,
  };
  return (
    <>
      {/* Fill and outline are two layers on the SAME rect, not one element with
          a blended opacity — a single element at 0.12 would fade its own border
          to nothing and the chip would read as an empty gap on black. The fill
          rises and the outline retires as the chip becomes a bar. */}
      <div
        style={{
          ...rect,
          backgroundColor: color,
          opacity: enterA * lerp(0.12, 0.9, m),
        }}
      />
      <div
        style={{
          ...rect,
          border: `2px solid ${color}`,
          opacity: enterA * (1 - m),
        }}
      />
      {/* The label rides out of the chip and lands under the bar. The two words
          CROSSFADE across the middle of the travel rather than swapping at a
          threshold — a hard text swap mid-morph is a visible pop, and the whole
          point of this gesture is that one object becomes another. */}
      {[chipLabel, barLabel].map((text, k) => (
        <div
          key={text}
          style={{
            position: "absolute",
            left: labelLeft,
            top: labelTop,
            width: labelWidth,
            textAlign: "center",
            fontFamily: MONO,
            // Flat at the 56px mono floor, not a lerp. It was 44 -> 40, i.e.
            // 32px -> 29px of cap, under the floor at BOTH ends. It can't ramp
            // DOWN to the floor either: the chip is 210px wide and "vector" at
            // 56px already measures 203px, so any larger chip-state size spills
            // its own container.
            fontSize: TYPE.annotation.fontSize,
            color: interpolateColors(m, [0, 1], [theme.ink, theme.dim]),
            opacity:
              clamp01(enter / 0.4) *
              dim *
              (k === 0 ? 1 - lin(m, 0.42, 0.58) : lin(m, 0.42, 0.58)),
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </div>
      ))}
    </>
  );
};

/** The warm one-liner under the gutter. It travels down with the morph so it
 *  stays attached to the thing it is annotating. */
const GutterNote: React.FC<{
  t: number;
  morph: number;
  dim: number;
  children: React.ReactNode;
}> = ({ t, morph, dim, children }) => (
  <div
    style={{
      position: "absolute",
      left: GUTTER_NOTE_LEFT,
      top: lerp(GUTTER_NOTE_TOP[0], GUTTER_NOTE_TOP[1], clamp01(morph)),
      fontFamily: MONO,
      fontSize: GUTTER_NOTE_SIZE,
      color: theme.warm,
      opacity: clamp01(t) * dim,
      transform: `translateY(${(1 - clamp01(t)) * 6}px)`,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

/**
 * 16 address slots, uncovered left to right — the strip is a place, and the
 * hop line drawn over it is the access order.
 *
 * R14: FILLED, NOT OUTLINED. These were 1px `theme.stroke` borders. Both halves
 * of that were worth nothing to the empty-frame gate: `theme.stroke` is Rec.601
 * luma 90, twenty under the 110 bar, and a 1px stroke is 0.125 of a proxy pixel
 * at 240x135, so 32 of them measured 0.000% of lit area between them. What the
 * viewer got was a row of near-invisible ghost boxes at the very bottom of the
 * emptiest beat in the episode.
 * Filled with `theme.dim` (#8B949E, luma 147, 37 over the gate) and SLOT_W
 * widened 30 -> 34:
 *   32 cells x 34 x 34 = 36,992px2 / 2,073,600 = 1.784% of frame, LIT.
 * The horizontal duty cycle is 34/39.375 = 0.863 and the 5.375px gutters are
 * 0.67 of a proxy pixel, so the pooled strip row lands at ~0.863 x 147 = 128 and
 * survives; 1.784% is the conservative cell-area figure, not the 2.066% the
 * whole 630x34 band would give if the gutters pooled away entirely.
 * NOT AN EVENT, and no event claim is made: `seqSlots` runs 15.4 frames, so
 * 0.892% x 6 / 15.4 = 0.35% per window and the per-frame slice is ~0.167%,
 * under the 0.3% burst gate. This is a LIT-AREA change only.
 * Contrast: the hop arcs rise off y=896 into the space ABOVE the strips
 * (hopPath's control points are SLOT_TOP - 2h), so up/down only meet dim at the
 * arc endpoints, and the strip labels live at y 946..990, below the 930 floor of
 * the band. Nothing legible is printed on top of these.
 */
const SlotStrip: React.FC<{ x: number; t: number }> = ({ x, t }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: SLOT_TOP,
      width: STRIP_W * clamp01(t),
      height: SLOT_H,
      overflow: "hidden",
    }}
  >
    {Array.from({ length: STRIP_SLOTS }).map((_, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: i * SLOT_PITCH + (SLOT_PITCH - SLOT_W) / 2,
          top: 0,
          width: SLOT_W,
          height: SLOT_H,
          borderRadius: 3,
          backgroundColor: theme.dim,
        }}
      />
    ))}
  </div>
);

const StripLabel: React.FC<{
  x: number;
  t: number;
  resolve: number;
  color: string;
  children: React.ReactNode;
}> = ({ x, t, resolve, color, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: STRIP_LABEL_TOP,
      fontFamily: MONO,
      // Pinned so the growth is absorbed upward — see STRIP_LABEL_SIZE.
      lineHeight: 1,
      fontSize: lerp(
        STRIP_LABEL_SIZE[0],
        STRIP_LABEL_SIZE[1],
        clamp01(resolve),
      ),
      letterSpacing: 1,
      // Grey until the "?" resolves, then it takes the pattern's colour — the
      // answer arriving, rather than a colour appearing for decoration.
      // Interpolated, not switched at a threshold: a hard colour cut on a label
      // that is simultaneously growing reads as a render glitch.
      color: interpolateColors(clamp01(resolve), [0, 1], [theme.dim, color]),
      opacity: clamp01(t),
      transform: `translateY(${(1 - clamp01(t)) * 8}px)`,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

/**
 * Beat 12's corner label, and its undocking. It travels to a centred eyebrow
 * above the closing lines instead of being replaced by them, so the full thesis
 * visibly GROWS OUT of the half-thesis the viewer has had in the corner for two
 * beats.
 */
const DockedThesis: React.FC<{ undock: number }> = ({ undock }) => {
  const u = clamp01(undock);
  return (
    <div
      style={{
        position: "absolute",
        // Left-anchored the whole way. Interpolating `textAlign` is impossible
        // and switching it at u=0.5 would teleport the line several hundred
        // pixels mid-travel, so the FINAL left is precomputed to centre the
        // line in the 1920 frame instead. The old 645 came from "~630px", which
        // is the glyph advance only (35 chars * 0.6em * 30px) and ignored the
        // 0.5px letterSpacing riding on every char: the real box is 647.5px, so
        // the line sat 9px right of centre under a 108px centred thesis.
        left: lerp(THESIS_DOCK_RECT.left, THESIS_UNDOCK_LEFT, u),
        top: lerp(THESIS_DOCK_RECT.top, THESIS_UNDOCK_TOP, u),
        fontFamily: MONO,
        fontSize: lerp(THESIS_DOCK_RECT.fontSize, THESIS_UNDOCK_SIZE, u),
        // Pinned at both ends of the travel. At the docked 56px the normal
        // 1.32em box drops descenders to y 160, which is INSIDE the bracket
        // rail at 158; lineHeight 1 puts the cap band at 93..134 with
        // descenders clearing at 151, which is the row the top-of-file rhythm
        // block is written against.
        lineHeight: 1,
        letterSpacing: THESIS_TRACKING,
        color: interpolateColors(u, [0, 1], [theme.dim, theme.ink]),
        opacity: lerp(THESIS_DOCK.opacity, 1, u),
        whiteSpace: "nowrap",
      }}
    >
      {THESIS_DOCK_TEXT}
    </div>
  );
};

/**
 * The episode's biggest type moment, and its last words. It sits OVER the still
 * sweeping grid on purpose: the picture the whole episode was about is visibly
 * still running underneath the sentence that explains it, which is why this
 * doesn't read as an end card.
 *
 * The block is a 1600-wide centred box at left 160, so both lines are inside
 * the safe margin no matter how the font falls back on the render machine.
 */
const ClosingThesis: React.FC<{
  line1: number;
  line2: number;
  rule: number;
}> = ({ line1, line2, rule }) => (
  <>
    {/* 386 / 530 / 700, re-spaced for TYPE.display. At 128px with lineHeight
        pinned to 1 each line boxes 128px tall, so the old 380/510 pair (a 130px
        pitch built around a 108px hand-picked size) would have overlapped by
        6px, and the rule at 656 would have sat inside `price`'s descender.
        Line 1 caps 403..496 — exactly the number THESIS_UNDOCK_TOP's comment is
        written against, so the undocked eyebrow still clears it by 34px. */}
    <BigLine top={386} t={line1}>
      counts operations
    </BigLine>
    <BigLine top={530} t={line2}>
      never asks the <span style={{ color: theme.warm }}>price</span>
    </BigLine>
    {/* R14 — 12px of theme.warm, was 2px of theme.stroke.
        theme.stroke is luma 90 and a 2px line is 0.25 of a proxy pixel: this
        rule, the last graphic element in the episode, was drawing 0.000% of lit
        area under the frame's biggest type. theme.warm is 175 and 12px is 1.5
        proxy pixels, so 720 x 12 = 8,640px2 = 0.417% of frame now registers.
        Warm rather than dim because `price` on the line above is warm — the
        rule underlines the word it belongs to instead of introducing a fourth
        neutral. NOT an event (0.417 x 6 / 16 = 0.16% per window) and no event
        claim is made; it is lit area under the close.
        BOUNDS: y 700..712. `price`'s descender at 128px reaches ~678, so the
        gap is 21.6px, and nothing else lives between here and the grid readout
        at 808..873. */}
    <div
      style={{
        position: "absolute",
        left: 960 - 360 * clamp01(rule),
        top: 700,
        width: 720 * clamp01(rule),
        height: 12,
        backgroundColor: theme.warm,
      }}
    />
  </>
);

const BigLine: React.FC<{
  top: number;
  t: number;
  children: React.ReactNode;
}> = ({ top, t, children }) => (
  <div
    style={{
      position: "absolute",
      left: 160,
      top,
      width: 1600,
      textAlign: "center",
      fontFamily: SANS,
      // TYPE.display (128px sans = 90px cap) — the episode's last words and its
      // biggest type moment, which is exactly what that token is for. 108 was
      // hand-picked and outside the scale; the round-2 grade measured this band
      // at 20-22px, i.e. it was not reading as a headline at all. fontWeight is
      // overridden to SANS_HEAVY because only 400/700/900 are loaded here and
      // the token's 800 would be synthesised (see the loadInter call up top).
      // lineHeight pinned to 1 so the two lines keep a measurable cap band.
      fontSize: TYPE.display.fontSize,
      fontWeight: SANS_HEAVY,
      lineHeight: 1,
      letterSpacing: TYPE.display.letterSpacing,
      color: theme.ink,
      opacity: clamp01(t / 0.4),
      // Lands from very slightly oversized: a line settling, not flying in.
      transform: `scale(${interpolate(clamp01(t), [0, 1], [1.06, 1])})`,
      textShadow: `0 8px 44px ${theme.bg}, 0 2px 12px ${theme.bg}`,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);
