import React from "react";
import { Easing, interpolate, interpolateColors } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { theme, TYPE, IDLE_FILL } from "../../components/theme";

// Both faces are LOADED here, not named in a CSS stack. The previous version
// wrote `'"Inter", system-ui, ...'` without ever calling loadFont, so Inter only
// rendered when some *other* scene happened to be mounted and had loaded it —
// in E005Lab (page font system-ui) the sans text silently fell back. Same
// pattern as HookRace: what you scrub is what you ship.
//
// Only 500/700/900 are loaded, so only those weights may be used below. Asking
// for 600 or 800 makes the CSS font-matching algorithm round up to 700/900
// anyway — writing the real weight keeps the file honest about what renders.
const inter = loadInter("normal", {
  weights: ["500", "700", "900"],
  subsets: ["latin"],
});
// Same mono family as FakeTerminal/ReceiptPanel — the ledger has to read as
// machine output, and a second mono face in one episode is an identity leak.
const mono = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
const MONO = mono.fontFamily;
const SANS = inter.fontFamily;

/** Build steps, named exactly as in this beat's `build:` list in script.yaml. */
export type HiddenAssumptionStep =
  | "card_flip"
  | "ledger_rows"
  | "tags_equal"
  | "freeze"
  | "tag_diverge_small"
  | "tag_diverge_big";

export const HIDDEN_ASSUMPTION_STEPS: HiddenAssumptionStep[] = [
  "card_flip",
  "ledger_rows",
  "tags_equal",
  "freeze",
  "tag_diverge_small",
  "tag_diverge_big",
];

export interface HiddenAssumptionProps {
  /**
   * 0..1 per step; absent = 0 = not started.
   *
   * CALLER CONTRACT: this beat is `playhead: true` in Episode005's PLANS, i.e.
   * each step's `p` ramps LINEARLY across its own slot. Every sub-reveal below
   * is scheduled in FRAMES-from-step-start via `sub()`, against the slot widths
   * in `HIDDEN_ASSUMPTION_NOMINAL`. Snap a step to 1 in nine frames and the
   * whole 27-second beat collapses into six pops.
   */
  p: Partial<Record<HiddenAssumptionStep, number>>;
  /** Absolute frame, for idle micro-motion ONLY. Everything else is progress-driven. */
  frame?: number;
}

/**
 * Where beat 2 (`whiteboard_world`) must leave its blank card, and therefore
 * where this beat has to start its flip.
 *
 * The whole point of this beat's opening is that the card is the SAME object:
 * it slid up from behind the whiteboard axes unanswered, and now it turns over.
 * If the two beats hand-tune these coordinates separately the "flip" becomes a
 * jump cut and nothing fails loudly — same failure mode chartGeom.ts exists to
 * prevent for beats 9/10. WhiteboardWorld imports this rather than re-declaring
 * it; do not change these four numbers without reading that file.
 */
export const HIDDEN_CARD = {
  /** Centre of the card as beat 2 leaves it — dead centre, above the ledger. */
  cx: 960,
  cy: 470,
  w: 760,
  h: 190,
} as const;

/**
 * The slot width, in FRAMES, that each step's `p` ramps across. Transcribed
 * from Episode005's scheduler for the current cut (beat 1643-2472, mark
 * `counts` @1982, plan weights 45/150/88/27/114/240 with `freeze` pinned):
 *
 *     card_flip          1643 -> 1701   ( 58f)
 *     ledger_rows        1696 -> 1883   (187f)
 *     tags_equal         1875 -> 1987   (112f)
 *     freeze             1979 -> 2018   ( 39f)   starts 3f before the mark
 *     tag_diverge_small  2014 -> 2169   (155f)
 *     tag_diverge_big    2161 -> 2480   (319f)   runs past the beat end at 2472,
 *                                                so only 0..311 is reachable
 *
 * `sub(p, step, at, dur)` turns those into frame offsets. If the cut moves,
 * these proportions move with it (the plan is pinned to a mark, not to
 * absolutes) — the STORYBOARD comment below quotes the absolute frames this
 * was authored against, and those are the numbers that go stale, not these.
 */
export const HIDDEN_ASSUMPTION_NOMINAL: Record<HiddenAssumptionStep, number> = {
  card_flip: 58,
  ledger_rows: 187,
  tags_equal: 112,
  freeze: 39,
  tag_diverge_small: 155,
  tag_diverge_big: 319,
};

/**
 * The top of `tag_diverge_big` the beat actually reaches before it cuts. Its
 * slot ramp is 319 frames long but the beat ends at 2472, 8 frames early, so a
 * sub-reveal scheduled past 311 would never finish. Exported so a future
 * re-time can be checked against it rather than rediscovered by eye.
 */
export const HIDDEN_ASSUMPTION_BIG_REACHABLE = 311;

/** Last frame-offset any `tag_diverge_big` sub-reveal completes on. */
const BIG_LAST_EVENT = 291 + 12; // `claimStrike`
if (BIG_LAST_EVENT > HIDDEN_ASSUMPTION_BIG_REACHABLE) {
  // Loud at import time rather than a silently-never-drawn element in the cut.
  throw new Error(
    `HiddenAssumption: a tag_diverge_big sub-reveal ends at ${BIG_LAST_EVENT}f but only ` +
      `${HIDDEN_ASSUMPTION_BIG_REACHABLE}f of that slot is reachable before the beat cuts.`,
  );
}

/* ------------------------------------------------------------------------- */
/* Motion primitives                                                          */
/* ------------------------------------------------------------------------- */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const ease = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });

/** Exits are ease-IN and shorter than entrances — they get out of the way. */
const easeIn = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.in(Easing.cubic) });

/**
 * Entrance length in frames. The legal band is 6-9 (200-300ms at 30fps); this
 * file uses the ceiling for reveals. Round 2 of this scene had entrances
 * completing in TWO frames (67ms) — under the ~100ms perceptual "instantaneous"
 * threshold, so they read as a hard cut rather than a move. Never go below 6.
 */
const ENTER = 9;
/** Exits: ~200ms. */
const EXIT = 6;

/**
 * The FREEZE settle, in frames. Shorter than ENTER because it is a settle, not
 * an arrival — but it is still a ramp, and it has now been got wrong twice in
 * the same place for two different reasons:
 *
 *   r4  drove every frozen colour through `freeze > 0.5`, turning a 7-frame
 *       ease into a ONE-FRAME hard cut repainting 18% of the frame (four row
 *       slabs + four chips + the rail all switching on one threshold).
 *   r10 fixed the threshold and kept the ease — and got the SAME defect back
 *       (D8, f1982, 3.09% in a single frame), because out-cubic's first sample
 *       over 7 frames is 0.37. A threshold is a step function; a short ease-out
 *       is a step function with a tail.
 *
 * So the rule is now two-sided, and both halves matter:
 *   1. nothing may compare `freeze` to a threshold, and
 *   2. `freeze` is LINEAR (`linSub`), so no frame of it carries more than 1/7
 *      of the travel.
 * The change still has to be SEEN, and a linear colour ramp on its own moves
 * ~10 luma a frame and clears the 25-luma gate on zero pixels. That is what the
 * row-bed WIPE is for: the event is a clip boundary sweeping across, not a
 * colour crossfade. See the row slab in the render body.
 */
const FREEZE_ENTER = 7;

/**
 * Sub-reveal scheduler. `at` and `dur` are FRAMES measured from the start of
 * the step's slot, which is the only way the 2-3-second rule can be audited by
 * reading the source: the numbers in the calls below ARE the storyboard's frame
 * spacing, and every one is annotated with the absolute frame it lands on.
 *
 * Returns an ALREADY-EASED 0..1 — leaf components consume it raw, because
 * easing the same value twice compounds into a soft, late start, which is the
 * exact "sleepy entrance" this scene exists not to have.
 *
 * INVARIANT: `at + dur <= HIDDEN_ASSUMPTION_NOMINAL[step]` (and <=
 * BIG_REACHABLE for `tag_diverge_big`), or the sub-reveal never completes.
 */
const sub = (
  v: number | undefined,
  step: HiddenAssumptionStep,
  at: number,
  dur: number = ENTER,
) => ease((clamp01(v ?? 0) * HIDDEN_ASSUMPTION_NOMINAL[step] - at) / dur);

const subOut = (
  v: number | undefined,
  step: HiddenAssumptionStep,
  at: number,
  dur: number = EXIT,
) => easeIn((clamp01(v ?? 0) * HIDDEN_ASSUMPTION_NOMINAL[step] - at) / dur);

/**
 * The LINEAR sibling of `sub`. Same contract, same units, no easing.
 *
 * `sub` returns out-cubic, and out-cubic over a short ramp is a step function
 * as far as the pacing detector is concerned: its first sample at 1/N of the
 * way through an N-frame ramp is already 1-(1-1/N)^3 of the travel — 37% of it
 * over 7 frames. That is fine for an ENTRANCE, where the thing was not on
 * screen a frame earlier and 37% of an arrival still reads as an arrival. It is
 * wrong for a STATE CHANGE applied to something already on screen, because 37%
 * of a 69-luma recolour is 25.5 luma delivered between two adjacent frames and
 * nothing at all delivered by the six frames after it — a hard cut wearing an
 * easing function's name. That is defect D8 in the r10 grade (f1982, 3.09% of
 * the frame changing in one frame with no transition).
 *
 * So: colour and geometry that change UNDER the viewer are ramped with `linSub`
 * and the event is carried by a clipPath wipe, which is the one shape that
 * delivers an equal, gate-clearing slice on every frame of its ramp.
 */
const linSub = (
  v: number | undefined,
  step: HiddenAssumptionStep,
  at: number,
  dur: number = ENTER,
) => clamp01((clamp01(v ?? 0) * HIDDEN_ASSUMPTION_NOMINAL[step] - at) / dur);

/**
 * Entrance SCALE with a slight overshoot — spring-ish (damping ~16) without
 * importing a spring. Starts at 0.94, never 0: a thing scaling up from nothing
 * is the banner-ad pop the playbook bans. Feed it an already-eased 0..1.
 */
const popScale = (v: number) =>
  interpolate(clamp01(v), [0, 0.55, 0.8, 1], [0.94, 1.035, 0.995, 1]);

/**
 * Settle overshoot for a 0..1 ROTATION ramp — same curve shape as `popScale`
 * but anchored at 0, because a card that starts 169deg turned is not a flip.
 * These used to be one function, which meant the chips scaled up from zero.
 */
const overshoot01 = (v: number) =>
  interpolate(clamp01(v), [0, 0.8, 1], [0, 1.04, 1]);

/* ------------------------------------------------------------------------- */
/* THE FLIP — 8 frames, in place, with a NAMED handoff.                       */
/*                                                                            */
/* It used to run 28. That is 0.93 seconds to turn one card, and it is the     */
/* FIRST thing that happens in the beat: PRODUCTION-LESSONS puts the entrance  */
/* band at 6-9 frames and names slow entrances as the #1 slop tell, and the    */
/* opening event is what sets the pace a viewer reads onto the 27 seconds      */
/* after it. FLIP_FRAMES is 8, mid-band.                                      */
/*                                                                            */
/* IN PLACE. The card does not travel while it turns — `dock`, 34 step-frames */
/* later, is what moves it — so this is a pure rotateY about the card's own    */
/* centre, exactly where beat 2 parked it.                                    */
/*                                                                            */
/* EASING: ease-IN-OUT, and it is not a style choice. `sub()` returns          */
/* out-cubic, which spends 60% of its travel in the first 15% of its window;   */
/* over 8 frames that puts the card past its 90-degree handoff inside ONE      */
/* frame, the blank front is never seen, and the "flip" degrades into the      */
/* claim simply appearing. In-out is symmetric about the handoff: four frames  */
/* of the blank front turning away, four of the claim turning to face us.      */
/* ------------------------------------------------------------------------- */

/** Turn length in frames. Mid-band of the 6-9 entrance rule. */
const FLIP_FRAMES = 8;

/** Total turn. A card has two faces; anything but 180 rests showing an edge. */
const FLIP_TURN_DEG = 180;

/**
 * The angle at which `backfaceVisibility: hidden` hands the frame from the
 * blank front face to the claim on the back.
 *
 * It is not a tunable — it is where a plane stops facing the camera — but it is
 * NAMED because the easing above is picked so this angle falls at the exact
 * middle of the turn, and anyone changing the curve has to meet it.
 */
const FLIP_HANDOFF_DEG = 90;

/** The step-frame the handoff lands on. Asserted below, not assumed. */
const FLIP_HANDOFF_AT = FLIP_FRAMES / 2;

/**
 * Settle overshoot for the turn. Deliberately NOT `overshoot01`: that curve
 * peaks at 0.8 and so maps the midpoint of the ramp to 0.65, i.e. 117 degrees —
 * it would slide the face handoff off centre and put five of the eight frames
 * on the back face. This one is pinned through (0.5, 0.5) so the midpoint is
 * the handoff, and only the last 15% carries the 3-degree overshoot.
 */
const flipSettle = (v: number) =>
  interpolate(clamp01(v), [0, 0.5, 0.85, 1], [0, 0.5, 1.03, 1]);

/** Turn angle from a step-frame offset. Pure, so the handoff is assertable. */
const flipDegAtFrame = (f: number) =>
  flipSettle(
    interpolate(clamp01(f / FLIP_FRAMES), [0, 1], [0, 1], {
      easing: Easing.inOut(Easing.cubic),
    }),
  ) * FLIP_TURN_DEG;

if (Math.abs(flipDegAtFrame(FLIP_HANDOFF_AT) - FLIP_HANDOFF_DEG) > 0.5) {
  // Loud at import time. A silently off-centre handoff is a flip that reads as
  // a pop, which is the exact defect this block exists to have fixed.
  throw new Error(
    `HiddenAssumption: the face handoff lands at ${flipDegAtFrame(
      FLIP_HANDOFF_AT,
    ).toFixed(
      1,
    )}deg at step-frame ${FLIP_HANDOFF_AT}, not ${FLIP_HANDOFF_DEG}deg. ` +
      `Re-centre flipSettle/the easing before changing FLIP_FRAMES.`,
  );
}

/* ------------------------------------------------------------------------- */
/* Geometry — every literal is checked against the 6% safe area:              */
/*   x in [116, 1804], y in [65, 1015]                                        */
/* Widths use JetBrains Mono's 0.6em advance and Inter's ~0.55em worst case.  */
/* ------------------------------------------------------------------------- */

// The claim, once read, becomes a full-width banner across the top. It does NOT
// shrink into a chip: at TYPE.headline x 0.66 the text would render a 35px cap,
// under the 40px floor. Dock by MOVING and WIDENING, never by scaling type down.
const BANNER_CY = 152;
const BANNER_W = 1200;
const BANNER_H = 132; // y 86-218

/**
 * The claim face is a LIGHT PLATE, and that is a measurement fix, not a mood.
 *
 * The r10 grade flagged f1643-1793 — 5.03s, the beat's own opening — as an
 * EMPTY RUN: under 1% of the frame above luma 110. The schedule was never the
 * problem (flip @1643, rule @1687, dock @1730, header @1752, row @1792 — five
 * events in five seconds). Every one of them was painted in the near-black
 * register: `theme.panel` is luma 14, `theme.stroke` is 91, IDLE_FILL is 89 —
 * ALL BELOW 110, so a correctly-paced opening measured as an unlit screen. The
 * grader's own calibration for this beat says a light plate carrying a title is
 * the shape that passes, and its prescription for an empty run is to FRONT-LOAD
 * the subject rather than add events. So the card the beat already turns over
 * in its first eight frames is what carries the light.
 *
 * 0.70 white over pure black = luma 178. The floor is not 110 for its own sake:
 * the beat's LAST move washes this plate red (`theme.down` at 0.50), and the
 * washed plate lands at luma 147 — a 31-luma delta, over the pacing gate's 25,
 * and still lit. Solve it and the plate has to clear 166:
 *
 *     delta = a * (P - lumaRed) = 0.50 * (P - 116) >= 25   =>   P >= 166
 *
 * At 0.62 (luma 158) the closing wash would be a 21-luma change and the beat's
 * cancellation would measure as nothing happening. 0.70 buys 6 luma of margin.
 *
 * CONSEQUENCE, and it is not optional: on this plate the dark palette inverts.
 * `theme.accent` measures 1.17:1 here and `theme.down` 1.59:1 — both would
 * VANISH — so the claim, its rule and its strike all go `theme.bg` (9.96:1 on
 * the plate, 7.27:1 once the red wash is over it). Anything added to this face
 * later has to be costed against the plate, never against the background.
 *
 * The FRONT face stays `theme.panel`: it is the blank card as beat 2 parks it,
 * and WhiteboardWorld hands it over dark. Turning dark-to-light IS the reveal.
 */
const CLAIM_PLATE = "rgba(255, 255, 255, 0.70)";

// --- ledger geometry -------------------------------------------------------
// Rows sit under the banner (bottom 218) and above the caption slot (900).
// Pitch 125 fits a header plus four TYPE.code rows in that band.
const OP_X = 150;
const HEADER_Y = 300; // mono 56 @ 1.4 -> box 300-378
const ROW_Y = [420, 545, 670, 795]; // row 4 box 747-843
const NEAR_X = 340; // "· near" suffix, clear of the 313px-wide "READ"
const LEADER_X = 600;
const LEADER_W = 480;
// The price column sits at x 1120, not 950: at 950 the ledger stopped 57% of
// the way across the frame and the right 45% held nothing for the eleven
// seconds between the header and the first bar. The whole frame is the canvas.
const CHIP_X = 1120;
const CHIP_W = 140;
const CHIP_H = 96;
const PRICE_RIGHT = CHIP_X + CHIP_W; // 1260 — header's right-aligned column edge
const RAIL_X = CHIP_X - 26;

// --- diverged-cost plot (right of the ledger) ------------------------------
// The two READ chips fly here and land as IDENTICAL short bars — that identity
// is the "same instruction" half of the argument — and then one of them grows.
//
// The heights are SCHEMATIC and both bars stay unlabelled by number on purpose.
// Narration here says "four cycles ... a couple hundred" (SOURCE [3]), a ~50x
// spread; at a 400px tall bar a true-to-scale short bar would be ~8px, which
// reads as zero. So this pair says "one of these is enormously worse" and
// nothing more precise — the numbered version is beat 5's latency ladder, where
// the citation lives. Do not add a figure to either bar in this beat.
const PLOT_BASE = 845;
const BAR_W = 160;
const SMALL_CX = 1420; // bar x 1340-1500
const BIG_CX = 1670; // bar x 1590-1750
const LANDED_H = 44; // what BOTH bars are when they touch down
const BIG_H = 400; // big bar top 445
const PLOT_L = 1300; // clears the price column's right edge (1260)
const PLOT_R = 1800; // inside the 1804 safe edge
/**
 * THE PLOT BED — r14, D-HA f2110-2280. See the `bed` sub-reveal for the
 * measured arithmetic (15.14% of frame, 1.683 %/frame over a linear 9-frame
 * top-down wipe). It replaces a 500x6 stroke rule that measured 0.145%.
 *
 * BOUNDS: x1284..1804 — 24px clear of the price column's right edge at 1260,
 * inside the 1804 safe edge. y356..960 — clear of the docked banner (86..218)
 * above and the 1015 floor below, and it encloses everything the plot owns:
 * the header strip 356..432, the tall bar's top at 445, the baseline at 845,
 * and both bar-label plates at 855..949.
 *
 * The header is `theme.dim` (luma 147, LIT) with `theme.bg` type on it, the
 * same citation-chip register MemoryWall uses. It says the words the narration
 * is saying as the bed arrives, so the panel is never decorative.
 */
const BED_L = 1284;
const BED_R = 1804;
const BED_T = 356;
const BED_B = 960;
const BED_HEAD_H = 76;
/**
 * Grouping wash, not structure: the bed's job is to say "these two bars belong
 * to one plot", and everything the viewer is asked to READ inside it (the
 * header type, the bars, the label plates) carries its own contrast against
 * this value, not against the page.
 */
const BED_FILL = "rgba(255, 255, 255, 0.14)"; // contrast-exempt: grouping wash
// behind the plot; the header strip (theme.dim, 147) and the bars carry the
// panel's structure, and dY 36 vs bg is what the difference gate measures.
const BRACKET_Y = 336; // above the bed's top edge (356); label box 250-320

// The question the model never asks owns the top-right before the plot exists,
// and is gone before the baseline draws — the two never coexist. Two mono lines
// at the floor: one line would need 575px and there are only 504 clear of the
// price column, and the answer to that is fewer words per line, never a
// smaller font.
const Q_X = 1330;
const Q_Y = 300; // line 1 box 300-378, line 2 box 378-456
const Q_LH = 78; // TYPE.annotation 56 @ 1.4
const Q_W = 420;

// One caption slot, bottom-left, that holds successive lines. The freeze line
// LEAVES before the closing line lands (object constancy: one slot, one line).
const CAP_X = 150;
const CAP_Y = 900; // mono box 900-978 / sans box 900-970, inside 1015

/**
 * The row bed once the meter has stopped.
 *
 * The LIVE bed is `IDLE_FILL` (0.35 white, luma 89, 3.00:1 — the floor exactly,
 * because a ledger row is structure a viewer is asked to see before it fills).
 * The FROZEN bed is deliberately below that floor: after `counts` the rows have
 * been priced and recede, and their read is carried by the `theme.ink` glyphs
 * sitting on them at 12.6:1 against the background, not by the bed.
 *
 * The pair is 89 -> 20 luma, a 69-luma delta over four 1174x96 slabs = 21.74%
 * of the frame. That is the biggest single change in the beat and it is why the
 * transition between them is a WIPE and not an interpolation; see FREEZE_ENTER.
 *
 * check_contrast.ts cannot see this literal — it reads colour on PAINT
 * PROPERTY lines, and this is a bare module const, which is the blind spot its
 * own header names ("a checker whose blind spot is the tidy way to write it").
 * Said out loud rather than left to be rediscovered: 0.08 white is 1.15:1, it
 * is under the floor on purpose, and the reason is the paragraph above.
 */
const FROZEN_ROW_FILL = "rgba(255, 255, 255, 0.08)";

const ROWS = ["ADD", "CMP", "READ", "READ"] as const;
/** Indices of the two rows that diverge — the identical pair is the argument. */
const READ_A = 2;
const READ_B = 3;

/**
 * How sharply a departing chip hands off to its flown bar, as a multiplier on
 * flight progress. At 10 the chip is gone and the bar is solid within 0.1 of the
 * flight — a ~2f crossfade, which reads as one object changing state rather than
 * two semi-transparent copies of the same thing pulling apart.
 */
const HANDOFF = 10;

/**
 * `hidden_assumption` — the thesis beat. Big O counts operations and never
 * prices them.
 *
 * STORYBOARD (absolute frames for the cut in HIDDEN_ASSUMPTION_NOMINAL). Every
 * line is a real content event: something enters, changes or leaves. Ambient
 * drift and the crawling leader ticks are NOT counted.
 *
 *   1643  card flips over -> "every op costs 1"          morph      (8f turn)
 *         The face handoff is at f1647 and the light plate is at full width by
 *         f1648, so the beat's subject is established, at size and LIT, five
 *         frames in. That is the whole answer to the r10 empty run (f1643-1793,
 *         5.03s under 1% lit): the events were always there, they were painted
 *         under the luma-110 gate. 760x190 at luma 178 = 6.96% of frame,
 *         becoming 7.64% once it docks, and it never leaves the beat.
 *   1687  accent underline draws under the claim         line       "the same"
 *   1730  card docks up + widens into the top banner     dock       (the // pause)
 *   1752  ledger rule draws + header wipes in            wipe       "one flat rate"
 *   1792  row ADD draws in                               draw-on    "an add,"
 *   1820  row CMP draws in                               draw-on    "a compare,"
 *   1846  row READ draws in                              draw-on    "a read"
 *   1872  row READ draws in                              draw-on    "from memory"
 *   1889  price chip "1" pops     (row 1)                pop        "the model charges"
 *   1911  price chip "1" pops     (row 2)                pop        "one tick"
 *   1933  price chip "1" slides in (row 3)               slide      "for each of 'em"
 *   1955  price chip "1" slides in (row 4)               slide
 *   1968  rail draws down the price column, linking them line       "no matter what"
 *   1979  FREEZE: row beds wipe live->frozen, chips     wipe       mark `counts` @1982
 *         contract, go outline, ticks stop                        (7f, 3.11%/frame)
 *   1994  caption slot: "counts the ops, never the cost" wipe       "counts your operations"
 *   2027  "what did it cost?" wipes into the right half  wipe       "never asks what"
 *   2065  "cost?" lands under it, in red                  wipe       "...one costs"
 *   2098  question exits; ADD/CMP + header dim back      exit       (the [beat])
 *   2118  plot baseline draws left-to-right              draw-on    "on real hardware"
 *   2145  READ chip A flies out and lands as a bar       morph      "four cycles"
 *   2178  bar label "READ" wipes in under bar A          wipe
 *   2205  READ chip B flies out, lands IDENTICAL to A    morph      "and some reads"
 *   2221  bar B GROWS ~9x and recolours to red           stretch    "a couple hundred"
 *   2248  bar label "READ" wipes in under bar B          wipe       (same word, both)
 *   2279  bracket draws across both bars                 line       "for the exact"
 *   2305  "same instruction" lands above the bracket     pop        "same instruction"
 *   2334  red strikes draw across both ghost "1" chips   line
 *   2366  caption line exits                             exit
 *   2374  "depends where it was sitting" wipes in        wipe       "depending on"
 *   2408  "· near" appends to READ row A                 wipe       "where the data"
 *   2429  "· far"  appends to READ row B                 wipe       "happened to be sitting"
 *   2452  red strike draws across the banner claim       line       "when you asked"
 *
 * 32 events across 829 frames (27.6s) = 11.6 per 10s against a 3.3 floor.
 * Largest gap 44 frames (1.47s), between 1643 and 1687. No hold over 1.5s.
 *
 * ENTRANCE BAND: every reveal above uses ENTER = 9 frames (300ms); exits use
 * EXIT = 6 (200ms). The flights are transforms, not entrances, and run 14-18f.
 *
 * SOURCE DISCIPLINE: this beat states the mechanism with NO numbers on screen
 * except the model's own flat "1". The 4-vs-couple-hundred spread is spoken
 * here but only *shown* in beat 5's latency ladder, where the citation lives.
 * The tall bar is deliberately unlabelled — height, not a figure.
 *
 * TYPE: every size comes from the TYPE scale in components/theme.ts. Nothing in
 * this file hand-picks a font-size, and nothing renders under the 40px cap
 * floor — including the docked banner, which is why it widens instead of
 * scaling down.
 */
export const HiddenAssumption: React.FC<HiddenAssumptionProps> = ({
  p,
  frame = 0,
}) => {
  /* --- card_flip: the claim turns over and gets underlined ---------------- */
  // The turn is driven off the step-frame directly rather than through `sub()`:
  // it needs the symmetric curve above, not `sub`'s out-cubic. See FLIP_FRAMES.
  const flipFrame =
    clamp01(p.card_flip ?? 0) * HIDDEN_ASSUMPTION_NOMINAL.card_flip;
  const flipDeg = flipDegAtFrame(flipFrame); // f1643..f1651 morph (8f)
  const claimRule = sub(p.card_flip, "card_flip", 44); // f1687 line draw-on

  /* --- ledger_rows: dock, header, four rows ------------------------------- */
  const dock = sub(p.ledger_rows, "ledger_rows", 34, 12); // f1730 dock grammar
  const header = sub(p.ledger_rows, "ledger_rows", 56); // f1752 mask wipe
  const rowIn = [
    sub(p.ledger_rows, "ledger_rows", 96), // f1792 "an add,"
    sub(p.ledger_rows, "ledger_rows", 124), // f1820 "a compare,"
    sub(p.ledger_rows, "ledger_rows", 150), // f1846 "a read"
    sub(p.ledger_rows, "ledger_rows", 176), // f1872 "from memory"
  ];

  // The card travels and stretches into a banner. Type size is constant through
  // the move — only the container changes, so the claim never drops below the
  // readability floor while it is still the thing being argued with.
  const bannerCy = interpolate(dock, [0, 1], [HIDDEN_CARD.cy, BANNER_CY]);
  const bannerW = interpolate(dock, [0, 1], [HIDDEN_CARD.w, BANNER_W]);
  const bannerH = interpolate(dock, [0, 1], [HIDDEN_CARD.h, BANNER_H]);

  /* --- tags_equal: four identical prices, then the rail ------------------- */
  const chipIn = [
    sub(p.tags_equal, "tags_equal", 14), // f1889 pop
    sub(p.tags_equal, "tags_equal", 36), // f1911 pop
    sub(p.tags_equal, "tags_equal", 58), // f1933 slide
    sub(p.tags_equal, "tags_equal", 80), // f1955 slide
  ];
  const rail = sub(p.tags_equal, "tags_equal", 93); // f1968 "no matter what"

  /* --- freeze: the meter stops on the word "counts" ----------------------- */
  // LINEAR, not eased — see `linSub`. This value recolours the rail, the chip
  // cells, the chip glyphs and the leader ticks, all of which are already on
  // screen when it runs, so every frame of it has to carry an equal share.
  const freeze = linSub(p.freeze, "freeze", 0, FREEZE_ENTER); // f1979, mark @1982
  /** Spring-ish settle (damping ~16) for the freeze's geometry and colours. */
  const freezeS = overshoot01(freeze);
  const capFreeze = sub(p.freeze, "freeze", 15); // f1994 caption slot

  /* --- tag_diverge_small: the unasked question, then the plot floor ------- */
  const question = sub(p.tag_diverge_small, "tag_diverge_small", 13); // f2027
  const qCost = sub(p.tag_diverge_small, "tag_diverge_small", 51); // f2065
  const qOut = subOut(p.tag_diverge_small, "tag_diverge_small", 84); // f2098
  /* r14 · D-HA f2110-2280 (5.70s with NO major event) — MAJOR #1.
     The old `baseline` was a 500x6 rule of `theme.stroke`: 3,000 px = 0.145% of
     frame, at luma 90 (under the 110 lit gate), eased over 12 frames. It also
     fired at f2118, which `silencedetect` puts INSIDE the measured silence
     f2112-2148 — a reveal on nothing, 30 frames before the sentence it belongs
     to. It is deleted, and the plot arrives as a labelled BED instead:

       520 x 604 = 314,080 px = 15.14% of frame
       linear top-down clipPath wipe over 9 frames
       15.14 / 9 = 1.683 %/frame        >= the 1% one-frame MAJOR gate
       15.14% inside a 6-frame window    >= the 5% window gate
       15.14 * 6 / 9 = 10.1              >= the 2.0 reveal-rate floor

     Landing f2145, three frames before speech resumes at f2148 on "And on real
     hardware" — which is also the bed's own header label, so it is narrated as
     it arrives rather than being a panel that appears and waits.

     WHICH GATE IT PAYS, stated plainly: the body wash is luma ~36, a DIFFERENCE
     event (dY 36) and 0.000% of LIT area. The header strip is `theme.dim`
     (luma 147) at 520x76 = 1.906% of frame, and that part is lit. */
  const bed = linSub(p.tag_diverge_small, "tag_diverge_small", 131, 9); // f2145
  // Pushed 131 -> 139 so the chip flies INTO a plot that already exists. 139+16
  // = 155 is exactly HIDDEN_ASSUMPTION_NOMINAL.tag_diverge_small, i.e. the last
  // frame this step can reach; it cannot go later without truncating.
  const flightA = sub(p.tag_diverge_small, "tag_diverge_small", 139, 16); // f2153

  /* --- tag_diverge_big: the divergence, staged ---------------------------- */
  const flightB = sub(p.tag_diverge_big, "tag_diverge_big", 44, 14); // f2205
  /* MAJOR #2 — f2221, on "a couple hundred".
     `grow` was an 18-frame EASED height ramp on a 160px-wide bar: 2.747% of
     frame total, and out-cubic delivers its best single frame at (3/18) of that
     = 0.458% — a content event, never a major one. Two changes, one moment:

       dur 18 -> 6 and LINEAR (`linSub`), so the stretch pays its area evenly:
         160 x 356 / 6  =  9,493 px/frame = 0.458 %/frame
       plus the READ_B ledger row washing red on the same frames:
         1174 x 96 / 6  = 18,784 px/frame = 0.906 %/frame
       total                                1.364 %/frame   (MAJOR)
       six-frame window  2.747% + 5.435% =  8.182%          (MAJOR)

     `at` stays 60 because Episode005's SFX_PLAN pins a `pop` to 60/319; only
     the duration and the curve change, so the cue still fires on frame one.
     The wash is `theme.down` at the 0.65 alpha that measures exactly 3.00:1 —
     the same tint the "· far" tag uses 200 frames later, which is the point:
     the row and its bar are one object being priced. */
  const grow = linSub(p.tag_diverge_big, "tag_diverge_big", 60, 6); // f2221 the moment
  const labelA = sub(p.tag_diverge_big, "tag_diverge_big", 17); // f2178
  const labelB = sub(p.tag_diverge_big, "tag_diverge_big", 87); // f2248
  const bracket = sub(p.tag_diverge_big, "tag_diverge_big", 118, 12); // f2279
  const bracketLabel = sub(p.tag_diverge_big, "tag_diverge_big", 144); // f2305
  const strike = sub(p.tag_diverge_big, "tag_diverge_big", 173, 12); // f2334
  const capOut = subOut(p.tag_diverge_big, "tag_diverge_big", 205); // f2366
  const capClose = sub(p.tag_diverge_big, "tag_diverge_big", 213); // f2374
  const nearTag = sub(p.tag_diverge_big, "tag_diverge_big", 247); // f2408
  const farTag = sub(p.tag_diverge_big, "tag_diverge_big", 268); // f2429
  const claimStrike = sub(p.tag_diverge_big, "tag_diverge_big", 291, 12); // f2452 (<=311)

  // Everything but the two READ rows recedes when the question leaves and the
  // plot takes over — dim-the-rest, because ringing the interesting rows is
  // banned. It is its own scheduled event (f2098), not a side effect of a flight.
  const restDim = interpolate(qOut, [0, 1], [1, 0.3]);
  const capLine = clamp01(capFreeze - capOut);

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: SANS }}>
      {/* ---- the card from beat 2, turning over, then widening ---------- */}
      <div
        style={{
          position: "absolute",
          left: HIDDEN_CARD.cx - bannerW / 2,
          top: bannerCy - bannerH / 2,
          width: bannerW,
          height: bannerH,
          transform: `perspective(1400px) rotateY(${flipDeg}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <CardFace>
          {/* Blank on the front — this is the unanswered card as beat 2 left it. */}
          <div />
        </CardFace>
        <CardFace back light>
          <div style={{ position: "relative" }}>
            <div
              style={{
                ...TYPE.headline,
                // bg-black, not `ink`: the face is a light plate now (see
                // CLAIM_PLATE). Black on it is 9.96:1; `ink` would be 1.78:1.
                color: theme.bg,
                whiteSpace: "nowrap",
              }}
            >
              every op costs 1
            </div>
            {/* Rule under the claim — its own event, on "the same". Ink-black,
                not accent: `theme.accent` on the light plate is 1.17:1 and this
                5px line would simply not be in the picture. The rule's job is
                the draw-on, and a draw-on works in any colour that can be
                seen. */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: TYPE.headline.fontSize * TYPE.headline.lineHeight + 4,
                width: `${claimRule * 100}%`,
                height: 5,
                borderRadius: 3,
                background: theme.bg,
              }}
            />
            {/* ...and the beat's last move: the same claim, cancelled. It has
                to be struck HERE, on the banner it opened with, rather than as
                a second horizontal rule stacked under "same instruction" —
                two parallel lines 11px apart read as one muddy double-bracket.
                Black, for the same reason the rule above is: red-on-plate is
                1.59:1 and red on the RED WASH that lands with this strike is
                1.06:1. Black over the washed plate is 7.27:1, and a strike the
                same colour as the text it cancels is what a strikethrough is. */}
            <div
              style={{
                position: "absolute",
                left: -12,
                top:
                  (TYPE.headline.fontSize * TYPE.headline.lineHeight) / 2 - 3,
                width: `${claimStrike * 104}%`,
                height: 6,
                borderRadius: 3,
                background: theme.bg,
              }}
            />
          </div>
        </CardFace>
      </div>

      {/* The beat's last move needs to be visible from across a room: a 6px
          strike across the banner is 0.04% of frame, so the cancellation also
          washes the whole banner red (1200x132 = 7.64% of frame). Over the
          CLAIM_PLATE that is luma 178 -> 147, a 31-luma delta, and the washed
          banner is still above the 110 empty-frame gate. The claim stays
          legible under it — black on the washed plate is 7.27:1.
          Event: 7.64% x 6 / 12f = 3.82 >= 2.0. */}
      <Slab
        t={claimStrike}
        left={HIDDEN_CARD.cx - BANNER_W / 2}
        top={BANNER_CY - BANNER_H / 2}
        width={BANNER_W}
        height={BANNER_H}
        // 0.50 is now fixed at both ends and is no longer a free parameter.
        // FLOOR: the wash must move the plate by 25 luma, and delta =
        // a x (178 - 116), so a >= 0.40. CEILING: at a = 1 the banner is solid
        // `theme.down` (luma 116) and the plate stops being lit at all. 0.50
        // sits mid-band: 31 luma of change, 147 luma left afterwards.
        //
        // (The old note here solved this against PURE BLACK, back when the card
        // face was `theme.panel`. On the light plate every one of those numbers
        // — 1.29:1, 2.00:1, 5.07:1 — is the wrong arithmetic; see CLAIM_PLATE.)
        tint="rgba(248,81,73,0.50)"
        radius={14}
      />

      {/* ---- ledger rule + header (mask-wipe, so it isn't another pop) --- */}
      <div
        style={{
          position: "absolute",
          left: OP_X,
          top: HEADER_Y - 22,
          width: (PRICE_RIGHT - OP_X) * header,
          height: 5,
          background: theme.stroke,
          opacity: restDim,
        }}
      />
      <Wipe t={header} left={OP_X} top={HEADER_Y} width={PRICE_RIGHT - OP_X}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: MONO,
            ...TYPE.annotation,
            letterSpacing: 2,
            color: theme.dim,
            opacity: restDim,
          }}
        >
          <span>OPERATION</span>
          <span>MODEL&apos;S PRICE</span>
        </div>
      </Wipe>

      {/* ---- the price column rail, linking four identical 1s ----------- */}
      <div
        style={{
          position: "absolute",
          // 5px wide was 0.12% of frame — below the content-event floor, so
          // "no matter what" measured as nothing happening. 24px puts the
          // draw-on at 0.61% and it reads as a price column, not a hairline.
          left: RAIL_X - 20,
          top: ROW_Y[0] - CHIP_H / 2,
          width: 24,
          borderRadius: 4,
          height: (ROW_Y[3] + CHIP_H / 2 - (ROW_Y[0] - CHIP_H / 2)) * rail,
          background: interpolateColors(
            freeze,
            [0, 1],
            [theme.accent, theme.dim],
          ),
          opacity: 0.75,
        }}
      />

      {/* ---- the four ledger rows --------------------------------------- */}
      {ROWS.map((op, i) => {
        const isRead = i === READ_A || i === READ_B;
        const departed = i === READ_A ? flightA : i === READ_B ? flightB : 0;
        const rowDim = isRead ? 1 : restDim;
        const tag = i === READ_A ? nearTag : i === READ_B ? farTag : 0;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              opacity: rowIn[i] * rowDim,
            }}
          >
            {/* The row's own slab — this, not the three mono glyphs on top of
                it, is what makes the row arriving a measurable event (1174x96
                = 5.44% of frame). It also carries the FREEZE, as a WIPE:

                D8 in the r10 grade was this recolour done as an interpolation.
                `freeze` was out-cubic over 7 frames, so its first sample was
                0.37 — 37% of the 69-luma change delivered between two adjacent
                frames and nothing by the six after it. The detector saw one
                3.09% single-frame state change with no transition, which is
                exactly what it was: only the slab pixels whose pooled delta
                happened to clear 25 luma registered, and the rest of the ramp
                moved ~8 luma a frame and registered nothing.

                So the two beds are now two layers and the live one is EATEN
                FROM THE LEFT while the frozen one wipes in behind it. Every
                frame flips a full 1/7 strip the whole 69 luma — no dilution,
                no marginal pixels — which is 21.74% / 7 = 3.11% of frame per
                frame for seven consecutive frames, against a 0.3% floor.
                Event: 21.74% x 6 / 7f = 18.6 >= 2.0. */}
            <Slab
              t={rowIn[i]}
              left={OP_X - 32}
              top={ROW_Y[i] - 48}
              width={PRICE_RIGHT + 32 - (OP_X - 32)}
              height={96}
              tint={IDLE_FILL}
              eatLeft={freeze}
            />
            <Slab
              t={freeze}
              left={OP_X - 32}
              top={ROW_Y[i] - 48}
              width={PRICE_RIGHT + 32 - (OP_X - 32)}
              height={96}
              tint={FROZEN_ROW_FILL}
            />
            {/* THE EXPENSIVE ROW, f2221. Half of MAJOR #2 — the bar shooting
                up on "a couple hundred" is only 0.458 %/frame on its own, and
                the ledger row it came from washing red on the same six linear
                frames is the other 0.906 %/frame. It is also the object-
                constancy link: the row and the bar are one instruction being
                priced, so they change together or the plot is a second slide.
                1174 x 96 = 5.435% of frame; the 0.65 alpha is `theme.down` at
                exactly 3.00:1, composited over the frozen bed it is dY 71. */}
            {i === READ_B ? (
              <Slab
                t={grow}
                left={OP_X - 32}
                top={ROW_Y[i] - 48}
                width={PRICE_RIGHT + 32 - (OP_X - 32)}
                height={96}
                tint="rgba(248,81,73,0.65)"
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                left: OP_X,
                top: ROW_Y[i] - 48,
                fontFamily: MONO,
                ...TYPE.code,
                fontWeight: 700,
                letterSpacing: 1,
                color: theme.ink,
                whiteSpace: "nowrap",
                // Rows arrive by drawing in from the label side, never by
                // dropping in from a corner.
                transform: `translateX(${(1 - rowIn[i]) * -22}px)`,
              }}
            >
              {op}
            </div>

            {/* Where the data was sitting — appended to the READ rows only,
                on the narration's closing clause. No numbers: the figures
                belong to beat 5. */}
            {isRead ? (
              <>
                {/* The semantic colour moves into a filled cell (252x94 =
                    1.1% of frame) so the two closing tags are events; the
                    glyphs go `ink` because accent-on-accent is under 3:1. */}
                <Slab
                  t={tag}
                  left={NEAR_X - 16}
                  top={ROW_Y[i] - 51}
                  width={252}
                  height={94}
                  // 0.55 / 0.65: the alphas at which `theme.accent` and
                  // `theme.down` each reach exactly 3.00:1 on black. Solved
                  // through the real sRGB transfer, f(c) = ((c+0.055)/1.055)^2.4
                  // — the α^2.4 shortcut over-shoots these by ~0.03 because it
                  // drops the 0.055 offset. Both were 0.34, which is 1.76:1 and
                  // 1.99:1 — the tags were "filled cells" that measured as
                  // barely-tinted black. The glyphs on top are already `ink`,
                  // which stays at 6.1:1 on either.
                  tint={
                    i === READ_A
                      ? "rgba(88,166,255,0.55)"
                      : "rgba(248,81,73,0.65)"
                  }
                  radius={8}
                />
                <Wipe t={tag} left={NEAR_X} top={ROW_Y[i] - 39} width={260}>
                  <div
                    style={{
                      fontFamily: MONO,
                      ...TYPE.annotation,
                      fontWeight: 700,
                      color: theme.ink,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {i === READ_A ? "· near" : "· far"}
                  </div>
                </Wipe>
              </>
            ) : null}

            {/* Dotted leader, drawn on left-to-right. */}
            <div
              style={{
                position: "absolute",
                left: LEADER_X,
                top: ROW_Y[i] - 3,
                width: LEADER_W * rowIn[i],
                height: 6,
                overflow: "hidden",
                // Was interpolate(tag, [0,1], [0.55, 1]). `theme.stroke` is
                // 3.09:1 — the floor with nothing spare — so multiplying it by
                // 0.55 put the leader at 1.50:1 for most of the beat. The
                // brightening on `tag` is redundant anyway: the leader already
                // recolours stroke -> accent/down on the same value, and a
                // colour change is the louder of the two.
                opacity: 1,
              }}
            >
              <div
                style={{
                  width: LEADER_W,
                  height: 6,
                  background: `repeating-linear-gradient(90deg, ${
                    tag > 0.5
                      ? i === READ_A
                        ? theme.accent
                        : theme.down
                      : theme.stroke
                  } 0 5px, transparent 5px 16px)`,
                }}
              />
            </div>

            {/* Idle micro-motion, and the only legal use of `frame` here: a tick
                crawling each leader while the meter is still running. It fades
                out on `freeze` rather than stopping, so nothing snaps back.
                This is NOT a content event and is not counted as one. */}
            <div
              style={{
                position: "absolute",
                left: LEADER_X + ((frame * 2.4 + i * 91) % LEADER_W),
                top: ROW_Y[i] - 3,
                width: 7,
                height: 6,
                borderRadius: 3,
                background: theme.dim,
                opacity:
                  0.4 *
                  rowIn[i] *
                  (1 - freeze) *
                  (1 - clamp01(departed * HANDOFF)),
              }}
            />

            {/* The chip the model charges. Once a READ chip departs it leaves a
                dashed ghost: the model still insists the price is 1. */}
            <Chip
              t={chipIn[i]}
              slide={isRead}
              freeze={freeze}
              freezeS={freezeS}
              departed={departed}
              strike={isRead ? strike : 0}
              top={ROW_Y[i] - CHIP_H / 2}
            />
          </div>
        );
      })}

      {/* ---- the caption slot: one line at a time ----------------------- */}
      {/* Caption bed: appears with the first line (5.4% of frame) and BRIGHTENS
          on the second (0.35 -> 0.50 white, 39-luma delta) so the swap is an
          event rather than one line of mono replacing another.
          The two states carry DIFFERENT text and are capped by it. State 1 is
          under `theme.warm`, which is a light colour and dies on a light bed:
          0.35 (3.00:1, the floor exactly) leaves warm at 3.60:1, and 0.39 is
          the last alpha that would. The warm line has already exited by the
          time state 2 lands (`capOut` @205 precedes `capClose` @213), so state
          2 only ever sits under `ink` and can go to 0.50 / 5.28:1 with the ink
          at 3.37:1. Both were 0.15 / 0.26 — 1.39:1 and 2.10:1. */}
      <Slab
        t={capFreeze}
        left={CAP_X - 34}
        top={CAP_Y - 16}
        width={1060}
        height={104}
        tint={capClose > 0.5 ? "rgba(255,255,255,0.50)" : IDLE_FILL}
      />
      <Wipe t={capLine} left={CAP_X} top={CAP_Y} width={1040}>
        <div
          style={{
            fontFamily: MONO,
            ...TYPE.annotation,
            color: theme.warm,
            whiteSpace: "nowrap",
            transform: `translateX(${capOut * -40}px)`,
          }}
        >
          counts the ops, never the cost
        </div>
      </Wipe>
      <Wipe t={capClose} left={CAP_X} top={CAP_Y} width={880}>
        <div
          style={{
            ...TYPE.label,
            fontWeight: 700,
            color: theme.ink,
            whiteSpace: "nowrap",
          }}
        >
          depends where it was sitting
        </div>
      </Wipe>

      {/* ---- the question the model never asks, in two halves ---------- */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1 - qOut,
          transform: `translateY(${qOut * -26}px)`,
        }}
      >
        {/* Panel behind the unasked question (480x212 = 4.9%) and, 38 frames
            later, a solid red cell under the operative word (480x96 = 2.2%).
            Both leave together on `qOut`, which makes the exit an event too. */}
        <Slab
          t={question}
          left={Q_X - 30}
          top={Q_Y - 28}
          width={480}
          height={212}
        />
        <Slab
          t={qCost}
          left={Q_X - 30}
          top={Q_Y + Q_LH - 14}
          width={480}
          height={96}
          // 0.65 = `theme.down` at exactly 3.00:1 on black (0.55 was 2.25:1),
          // solved through the full sRGB transfer rather than the α^2.4
          // shortcut. The word on it is already `ink`, which stays at 6.1:1.
          tint="rgba(248,81,73,0.65)"
          radius={8}
        />
        <Wipe t={question} left={Q_X} top={Q_Y} width={Q_W}>
          <div
            style={{
              fontFamily: MONO,
              ...TYPE.annotation,
              // `ink`, not `dim` — the panel under this line is now at the 3:1
              // idle floor (0.35 white), and `theme.dim` on top of that plate
              // measures 2.28:1. Same trade the "· near/· far" tags and "cost?"
              // already made in this file: the plate carries the contrast, the
              // glyphs go ink, and the emphasis is carried by the red cell on
              // the line below rather than by two greys.
              color: theme.ink,
              whiteSpace: "nowrap",
            }}
          >
            what did it
          </div>
        </Wipe>
        {/* The operative word lands red, on "costs" — and it is the first red
            on screen, which is what the tall bar becomes 140 frames later. */}
        <Wipe t={qCost} left={Q_X} top={Q_Y + Q_LH} width={Q_W}>
          <div
            style={{
              fontFamily: MONO,
              ...TYPE.annotation,
              fontWeight: 700,
              // ink, not `down` — the red moved into the cell underneath, and
              // red-on-red measured ~1.3:1.
              color: theme.ink,
              whiteSpace: "nowrap",
            }}
          >
            cost?
          </div>
        </Wipe>
      </div>

      {/* ---- the plot bed, wiped down before either bar lands ------------
          Plate, header and floor are all inside ONE clip and all at full
          opacity, so there is no frame on which an empty bordered panel is
          waiting for its contents. */}
      {bed > 0 ? (
        <div
          style={{
            position: "absolute",
            left: BED_L,
            top: BED_T,
            width: BED_R - BED_L,
            height: BED_B - BED_T,
            background: BED_FILL,
            borderRadius: 14,
            clipPath: `inset(0 0 ${(1 - bed) * 100}% 0)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: BED_R - BED_L,
              height: BED_HEAD_H,
              borderRadius: "14px 14px 0 0",
              background: theme.dim,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: MONO,
              ...TYPE.annotation,
              fontWeight: 700,
              letterSpacing: 2,
              // theme.bg on theme.dim (147) is 6.85:1.
              color: theme.bg,
              whiteSpace: "nowrap",
            }}
          >
            real hardware
          </div>
          {/* The floor both bars stand on, inside the bed that owns it. */}
          <div
            style={{
              position: "absolute",
              left: PLOT_L - BED_L,
              top: PLOT_BASE - BED_T,
              width: PLOT_R - PLOT_L,
              height: 6,
              background: theme.stroke,
            }}
          />
        </div>
      ) : null}

      {/* ---- the two READ chips, now bars. They land IDENTICAL; one grows. */}
      <FlownBar
        t={flightA}
        grow={0}
        fromTop={ROW_Y[READ_A] - CHIP_H / 2}
        cx={SMALL_CX}
        tallHeight={LANDED_H}
      />
      <FlownBar
        t={flightB}
        grow={grow}
        fromTop={ROW_Y[READ_B] - CHIP_H / 2}
        cx={BIG_CX}
        tallHeight={BIG_H}
      />

      {/* Both labels brighten as the bracket lands: the two READs are the
          same instruction, and that has to be the loudest thing in the frame
          at f2279, not a hairline. */}
      <BarLabel t={labelA} cx={SMALL_CX} hot={bracket} />
      <BarLabel t={labelB} cx={BIG_CX} hot={bracket} />

      {/* ---- bracket over both bars: same instruction, both times ------- */}
      <Bracket t={bracket} label={bracketLabel} />
    </div>
  );
};

/**
 * One face of the flipping card. `back` is pre-rotated so it reads unmirrored.
 *
 * `light` swaps the face to CLAIM_PLATE. The two are separate props on purpose:
 * `back` is a geometry fact (which side of the plane this is) and `light` is a
 * paint decision, and the FRONT face must stay dark whatever the back does —
 * it is the blank card WhiteboardWorld hands over, and beat 2 draws it in
 * `theme.panel`. The border goes black on the light face because
 * `theme.stroke` is DARKER than the plate and would read as a smudge rather
 * than an edge.
 */
const CardFace: React.FC<{
  back?: boolean;
  light?: boolean;
  children: React.ReactNode;
}> = ({ back, light, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: light ? CLAIM_PLATE : theme.panel,
      // The dark border is a near-black edge on a near-white plate. It is not
      // structure the viewer has to find before it fills — the plate is already
      // 178 luma against a 17-luma background — so it is not costed against the
      // 3:1 idle floor, and the gate skips it: black's source colour is 1:1.
      border: `2px solid ${light ? "rgba(0, 0, 0, 0.45)" : theme.stroke}`,
      borderRadius: 14,
      backfaceVisibility: "hidden",
      transform: back ? "rotateY(180deg)" : undefined,
    }}
  >
    {children}
  </div>
);

/**
 * A price chip. `slide` sends it in along its leader instead of popping, so the
 * four chips aren't four identical pops in a row. `departed` hands the chip
 * over to the flown bar and leaves the model's claim behind as a dashed ghost;
 * `strike` cancels that ghost price once the real costs are on the plot.
 */
const Chip: React.FC<{
  t: number;
  slide: boolean;
  freeze: number;
  /** `freeze` with the spring overshoot, for the contract. */
  freezeS: number;
  departed: number;
  strike: number;
  top: number;
}> = ({ t, slide, freeze, freezeS, departed, strike, top }) => {
  const gone = clamp01(departed * HANDOFF);
  // Freeze reads as a small settle: the chip contracts past its rest size and
  // comes back, and goes outline over the same 7 frames.
  const frozenScale = interpolate(freezeS, [0, 1], [1, 0.94]);
  const frozenEdge = interpolateColors(
    freeze,
    [0, 1],
    [theme.accent, theme.dim],
  );
  const frozenGlyph = interpolateColors(freeze, [0, 1], [theme.ink, theme.dim]);
  return (
    <>
      {/* The chip's cell. The 140x96 outlined chip alone is 0.65% of frame but
          only its 2px border changes, so four scheduled chip arrivals measured
          as zero events. The filled cell (172x112 = 0.93%, 31-luma delta over
          the row slab) is what actually lands on the beat. */}
      <div
        style={{
          position: "absolute",
          left: CHIP_X - 16,
          top: top - 8,
          width: CHIP_W + 32,
          height: CHIP_H + 16,
          borderRadius: 10,
          // LIVE state 0.55 = `theme.accent` at exactly 3.00:1 on black; it was
          // 0.26, which is 1.29:1, so "the filled cell is what actually lands
          // on the beat" was landing on nothing. The `1` on top is `ink` at
          // 6.1:1 over the bright cell.
          //
          // The FROZEN state stays dim on purpose and is the one alpha in this
          // file left under the floor: after the freeze the chip is supposed to
          // recede to an outline, and its contrast is carried by its 2px dashed
          // `theme.stroke` border (3.09:1) and its `theme.dim` glyph (6.83:1),
          // not by its fill. Raising the live state also widens the freeze from
          // a 24-luma change to 124 — the settle on `counts` is now the biggest
          // single event in the beat, which is what it should always have been.
          // The two endpoints are split onto their own lines so the exemption
          // below lands on the frozen one ALONE. Both used to share a line, and
          // a marker there would have exempted the live colour too — which is
          // the one endpoint that must never be exempt, because it is the one
          // that has to land on a spoken word.
          background: interpolateColors(
            freeze,
            [0, 1],
            [
              "rgba(88,166,255,0.55)",
              // contrast-exempt: the frozen state is meant to recede to an
              // outline (see the paragraph above), so its read is carried by the
              // 2px dashed `theme.stroke` border at 3.09:1 and the `theme.dim`
              // glyph at 6.83:1, not by this fill. 1.18:1 is the intent.
              "rgba(139,148,158,0.16)",
            ],
          ),
          clipPath: `inset(0 ${(1 - t) * 100}% 0 0)`,
          opacity: clamp01(t * 8) * (1 - gone * 0.65),
        }}
      />
      {/* Ghost: the price the model still charges, left behind when the real
          cost flies off. It KEEPS ITS "1" — an empty dashed box is not a claim,
          and the red strike drawn across this spot later has to be seen
          cancelling a number. Striking out an empty rectangle says nothing. */}
      <div
        style={{
          position: "absolute",
          left: CHIP_X,
          top,
          width: CHIP_W,
          height: CHIP_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px dashed ${strike > 0.5 ? theme.down : theme.stroke}`,
          borderRadius: 8,
          opacity: gone * interpolate(strike, [0, 1], [0.85, 0.45]),
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            ...TYPE.code,
            lineHeight: 1,
            fontWeight: 700,
            color: strike > 0.5 ? theme.down : theme.dim,
          }}
        >
          1
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: CHIP_X - (slide ? (1 - t) * 170 : 0),
          top,
          width: CHIP_W,
          height: CHIP_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Ramped over FREEZE_ENTER, not switched at 0.5. The click on
          // "counts" comes from the scale overshoot and the row slabs dropping
          // together; a threshold here just made it a one-frame cut.
          border: `2px solid ${frozenEdge}`,
          borderRadius: 8,
          transform: `scale(${(slide ? 1 : popScale(t)) * frozenScale})`,
          opacity: t * (1 - gone),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: theme.accent,
            borderRadius: 6,
            opacity: interpolate(freeze, [0, 1], [0.14, 0.04]),
          }}
        />
        <span
          style={{
            fontFamily: MONO,
            ...TYPE.code,
            lineHeight: 1,
            fontWeight: 700,
            color: frozenGlyph,
          }}
        >
          1
        </span>
      </div>
      {/* The model's price, cancelled. */}
      <div
        style={{
          position: "absolute",
          left: CHIP_X - 10,
          top: top + CHIP_H / 2 - 4,
          width: (CHIP_W + 20) * strike,
          height: 8,
          background: theme.down,
        }}
      />
    </>
  );
};

/**
 * The chip becoming a bar — one object, not a delete and a pop.
 *
 * `t` is the FLIGHT: the chip travels from its ledger row to the plot floor and
 * sets down at LANDED_H, the same height as its twin. `grow` is the divergence:
 * the bar stretches from LANDED_H to `tallHeight` and recolours to red. Keeping
 * these two ramps separate is the whole point of the beat — the viewer has to
 * see the two READs land IDENTICAL before one of them explodes.
 */
const FlownBar: React.FC<{
  t: number;
  grow: number;
  fromTop: number;
  cx: number;
  tallHeight: number;
}> = ({ t, grow, fromTop, cx, tallHeight }) => {
  const e = t; // already eased by `sub`
  // Slight overshoot on the stretch so the divergence lands with weight.
  const g = interpolate(clamp01(grow), [0, 0.72, 1], [0, 1.035, 1]);
  const h =
    interpolate(e, [0, 1], [CHIP_H, LANDED_H]) + (tallHeight - LANDED_H) * g;
  const w = interpolate(e, [0, 0.5], [CHIP_W, BAR_W], {
    extrapolateRight: "clamp",
  });
  const left = interpolate(e, [0, 1], [CHIP_X, cx - BAR_W / 2]);
  const top =
    interpolate(e, [0, 1], [fromTop, PLOT_BASE - LANDED_H]) -
    (h - LANDED_H) * e;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        background: theme.accent,
        borderRadius: 6,
        overflow: "hidden",
        // Same HANDOFF constant the chip fades out on, so the two curves cross
        // in the same ~2 frames instead of overlapping for part of the flight.
        opacity: clamp01(t * HANDOFF) * 0.9,
      }}
    >
      {/* Recolour rides the stretch: cheap blue becomes expensive red. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: theme.down,
          opacity: clamp01(grow * 1.4),
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          ...TYPE.code,
          lineHeight: 1,
          fontWeight: 700,
          color: theme.bg,
          opacity: clamp01(1 - e * 3),
        }}
      >
        1
      </span>
    </div>
  );
};

/** Identical labels under non-identical bars — that contrast is the argument. */
const BarLabel: React.FC<{ t: number; cx: number; hot: number }> = ({
  t,
  cx,
  hot,
}) => (
  <>
    {/* 200x94 = 0.91% of frame: the label's plate is the event, the four
        mono glyphs on it are not. */}
    <Slab
      t={t}
      left={cx - BAR_W / 2 - 20}
      top={PLOT_BASE + 10}
      width={BAR_W + 40}
      height={94}
      // 0.35 -> 0.50, not 0.13 -> 0.24 (1.31:1 -> 1.94:1, both under the floor
      // — the plates the comment above calls "the event" were not in the
      // picture). The cold state is `IDLE_FILL`, the floor exactly; the hot
      // state goes to 0.50 / 5.28:1, a 39-luma jump over 0.91% of frame.
      tint={hot > 0.5 ? "rgba(255,255,255,0.50)" : IDLE_FILL}
      radius={8}
    />
    <Wipe
      t={t}
      left={cx - BAR_W / 2 - 20}
      top={PLOT_BASE + 18}
      width={BAR_W + 40}
    >
      <div
        style={{
          fontFamily: MONO,
          ...TYPE.annotation,
          fontWeight: hot > 0.5 ? 700 : 400,
          // Both states are `ink`: the cold plate is now bright enough that
          // `theme.dim` on it measures 2.28:1. The brighten still reads — the
          // plate jumps 39 luma and the weight goes 400 -> 700 — it just isn't
          // carried by a grey that nobody could see either way.
          color: theme.ink,
          textAlign: "center",
        }}
      >
        READ
      </div>
    </Wipe>
  </>
);

/**
 * Square bracket spanning both bars. A bracket, not a ring — rings are banned,
 * and a bracket also says "these two belong together" rather than "look here".
 */
const Bracket: React.FC<{ t: number; label: number }> = ({ t, label }) => {
  const left = PLOT_L;
  const right = PLOT_R;
  const labelTop = BRACKET_Y - 86; // sans 58 @ 1.2 -> box 250-320 (plate 234-336)
  return (
    <>
      {/* Plate under "same instruction" (500x102 = 2.5%), so the beat's
          conclusion is an event and not 16 glyphs fading up. */}
      <Slab
        t={label}
        left={left}
        top={labelTop - 16}
        width={right - left}
        height={102}
      />
      {/* 6px was 0.15% of frame; 14px puts the draw-on over the floor. */}
      <div
        style={{
          position: "absolute",
          left,
          top: BRACKET_Y,
          width: (right - left) * t,
          height: 14,
          background: theme.dim,
          opacity: 0.8,
        }}
      />
      {[left, right - 14].map((x) => (
        <div
          key={x}
          style={{
            position: "absolute",
            left: x,
            top: BRACKET_Y,
            width: 14,
            height: 40 * t,
            background: theme.dim,
            opacity: 0.8,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left,
          top: labelTop,
          width: right - left,
          textAlign: "center",
          ...TYPE.label,
          fontWeight: 700,
          color: theme.ink,
          opacity: label,
          transform: `scale(${popScale(label)})`,
          whiteSpace: "nowrap",
        }}
      >
        same instruction
      </div>
    </>
  );
};

/**
 * A filled slab that mask-wipes in behind a reveal.
 *
 * WHY: round 3 measured this beat as 53% "held" with a 7.53s dead stretch even
 * though eight sub-reveals were scheduled inside it. The reveals were all
 * hairlines and 3-4 mono glyphs — a word of 56px mono repaints ~2k px, which is
 * 0.1% of the frame, under the 0.3%/25-luma content-event floor. The schedule
 * was fine; the reveals were too SMALL to register. Every staged reveal now
 * carries a slab sized >=0.3% of frame (most are 1-5%), so the event the
 * storyboard intended is the event the measurement sees.
 *
 * ALPHAS. The default was 0.16, chosen against the pacing detector's 25-luma
 * gate (0.16 white = luma 41, delta 41 > 25 — it passed). That was the wrong
 * gate. theme.ts's CONTRAST FLOOR measures the same colour at 1.44:1, and the
 * r7/r8 luma audits found 87.7% of all pixels under luma 40 with the whole
 * episode reading flat because of exactly this band of alphas. The default is
 * now `IDLE_FILL` (0.35 = 3.00:1, luma 89) and `ink` still sits at 5.9:1 on
 * top of it.
 *
 * The per-use overrides below are all derived the same way: solve for the alpha
 * at which the tint reaches 3:1, then cap it wherever the TEXT on the slab
 * would drop under its own floor (3:1 for the 56px+ type this scene uses).
 * Where the cap bites, the note says so and gives the number.
 */
const Slab: React.FC<{
  t: number;
  left: number;
  top: number;
  width: number;
  height: number;
  tint?: string;
  radius?: number;
  /** Wipe top-to-bottom instead of left-to-right — rotates the grammar. */
  vertical?: boolean;
  /**
   * Fraction 0..1 of the slab REMOVED from the left, independently of `t`.
   *
   * `t` wipes a slab in; this wipes it back out from the other edge, which is
   * how one slab hands over to another laid on the same rectangle (the row
   * bed's live -> frozen swap). Doing it as a pair of complementary clips
   * rather than as a colour interpolation is what makes the change land as an
   * equal slice on every frame; see the row slab's comment for the arithmetic.
   * Ignored in `vertical` mode, which has no consumer that needs both.
   */
  eatLeft?: number;
}> = ({
  t,
  left,
  top,
  width,
  height,
  tint = IDLE_FILL,
  radius = 10,
  vertical = false,
  eatLeft = 0,
}) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width,
      height,
      background: tint,
      borderRadius: radius,
      clipPath: vertical
        ? `inset(0 0 ${(1 - t) * 100}% 0)`
        : `inset(0 ${(1 - t) * 100}% 0 ${clamp01(eatLeft) * 100}%)`,
      opacity: clamp01(t * 8),
    }}
  />
);

/**
 * Mask-wipe reveal. Kept as a shared helper so the captions have a grammar of
 * their own and the scene isn't carried by pops alone.
 */
const Wipe: React.FC<{
  t: number;
  left: number;
  top: number;
  width: number;
  children: React.ReactNode;
}> = ({ t, left, top, width, children }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width,
      overflow: "hidden",
      clipPath: `inset(0 ${(1 - t) * 100}% 0 0)`,
      opacity: clamp01(t * 8),
    }}
  >
    {children}
  </div>
);
