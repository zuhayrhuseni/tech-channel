import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { BRoll, theme } from "../../components";
import { TYPE } from "../../components/theme";

const mono = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
const MONO = mono.fontFamily;
const SANS =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Build steps, named exactly as in this beat's `build:` list in script.yaml. */
export type RealSystemPayoffStep =
  | "qmcpack_label"
  | "runtime_bar"
  | "kernel_slice_50"
  | "chip_aos_soa"
  | "chip_blocking"
  | "chip_vectorize"
  | "bar_compress_countup";

export const REAL_SYSTEM_PAYOFF_STEPS: RealSystemPayoffStep[] = [
  "qmcpack_label",
  "runtime_bar",
  "kernel_slice_50",
  "chip_aos_soa",
  "chip_blocking",
  "chip_vectorize",
  "bar_compress_countup",
];

export interface RealSystemPayoffProps {
  /** 0..1 per step; absent = 0 = not started. Caller maps timing.json marks. */
  p: Partial<Record<RealSystemPayoffStep, number>>;
  /** Absolute frame, for idle micro-motion ONLY. Everything else is progress-driven. */
  frame?: number;
}

/* -------------------------------------------------------------------------
 * SLOT ARITHMETIC — re-derived from the SHIPPING
 * episodes/005-cpu-waits-on-memory/timing.json by replaying Episode005's
 * schedule() (LEAD 3, TAIL = min(8, 10% of slot)) rather than trusting the
 * fractions this file used to carry.
 *
 *   real_system_payoff    startFrame 16123
 *   ending_two_questions  startFrame 17164   -> beat = 1041 frames (34.7s)
 *   mark `speedup` ("four") @ 16893          -> LOCAL 770
 *
 * (Those three absolutes read 16066 / 17106 / 16836 until 2026-09-04 — ~57
 * frames stale against the shipping timing.json. Every step-LOCAL number in
 * this block was and is correct: 16893 - 16123 is still 770, and the slot
 * widths below are unchanged. Verified with `npx tsx scripts/dump_schedule.ts`.)
 *
 * PLAN weights 346/72/73/78/78/77 with `bar_compress_countup` pinned at
 * `speedup` offset -46 resolve to these step-local windows:
 *
 *   qmcpack_label          0 - 354     (354f)
 *   runtime_bar          346 - 425     ( 79f)
 *   kernel_slice_50      418 - 498     ( 80f)
 *   chip_aos_soa         491 - 577     ( 86f)
 *   chip_blocking        569 - 655     ( 86f)
 *   chip_vectorize       647 - 732     ( 85f)
 *   bar_compress_countup 724 - 1048    (324f, clipped by the beat at 1040)
 *
 * Those widths are what REAL_SYSTEM_PAYOFF_NOMINAL below encodes, and every
 * sub-reveal is now scheduled in FRAMES against them via `sub(p, step, at,
 * dur)` — the same helper shape as src/e005/scenes/TrickQuestion.tsx. The old
 * fraction windows are gone: on a 354-frame step a "0.05 wide" window is an
 * 18-frame entrance, and on the 324-frame compress step "0.05" is 16 frames —
 * both well past the 6-9 frame entrance ceiling. Frames are the unit that
 * ceiling is written in, so frames are the unit the code uses.
 *
 * The narration model the sub-reveal PLACEMENT is designed against (69 words
 * before the mark at local 770 = 11.2 frames/word = 2.7 words/sec):
 *
 *   000-089  "And this cashes out way past interview prep."     -> kicker
 *   089-346  "...Department of Energy physics code called        -> naming +
 *             QMCPACK ... national-lab supercomputers."            context
 *   346-491  "One kernel ... eating up to half of the total     -> bar + slice
 *             runtime."
 *   491-724  "a data-layout rewrite - three changes bundled..." -> 3 rows
 *   724-860  "...more than [770:four] and a half times faster,  -> compress
 *             end to end."
 *   860-1040 "[dry] The physics didn't change..."               -> ledger
 *
 * CONTENT-EVENT CENSUS (absolute step-local frame each event STARTS):
 *   0, 71, 113, 188, 220, 251, 290, 304, 316, 325, 334,  (qmcpack_label)
 *   346, 358, 370,                                 (runtime_bar)
 *   418, 434, 466,                                 (kernel_slice_50)
 *   491, 531,                                      (chip_aos_soa)
 *   583,                                           (chip_blocking)
 *   655, 683,                                      (chip_vectorize)
 *   724, 728, 746, 748, 777, 807, 837, 862, 906, 950, 996   (compress)
 * = 31 events over 1040 frames. Largest gap between consecutive events is
 * 75 frames (113 -> 188, narration with no new noun before "QMCPACK"); inside
 * the compress step the largest is 46 (862 -> 906), and 748 -> 777 is covered
 * throughout by the bar compressing and the count-up running. Nothing touches
 * the 90-frame ceiling and nothing holds 3s.
 *
 * r7 RE-STAGE of the compress tail. The four beat-local starts 777/807/837/862
 * (abs f16900/16930/16960/16985) replace the old 790/824/856/906 + a caption
 * stranded back at chip_vectorize 703. That old table is what the r6b grade
 * measured as the episode's only true freeze — abs 16891-16995, 3.5s of
 * sampled frames with no content change — because its two events in that
 * window were thin mono lines while the whole lower half of the frame held
 * still. Every one of the four is now sized past theme.ts's ink floor; see the
 * arithmetic on `bar_compress_countup` below.
 * ---------------------------------------------------------------------- */

/** Step-local slot WIDTHS in frames — see the derivation above. */
export const REAL_SYSTEM_PAYOFF_NOMINAL: Record<RealSystemPayoffStep, number> =
  {
    qmcpack_label: 354,
    runtime_bar: 79,
    kernel_slice_50: 80,
    chip_aos_soa: 86,
    chip_blocking: 86,
    chip_vectorize: 85,
    bar_compress_countup: 324,
  };

/* --- TYPE SCALE ------------------------------------------------------------
 * Every hand-picked size in this file used to be 40px, written against a
 * mistaken reading of the floor: 40 is a CAP HEIGHT, not a font-size, so 40px
 * mono renders a 29.2px cap and fails the floor by 27%. The floor tokens are
 * 56px mono (cap 40.9) and 58px sans (cap 40.6) — src/components/theme.ts.
 *
 * That is a 1.4x width multiplier on every mono string in the scene, which is
 * why several strings below got shorter and why the ladder under the header
 * got re-pitched. JetBrains Mono advances exactly 0.6em, so a 56px mono char
 * is 33.6px + 0.2 tracking = MONO_CH_ADVANCE below — the only number needed to
 * bound a line.
 *
 * LINE_H is 62px, not TYPE.annotation's 1.4 (78px): these are all single,
 * absolutely-positioned lines, so the box only decides where the baseline
 * falls. At 62 the caps sit top+10..top+51 and descenders clear at top+68 —
 * enough to stack rows at a 76px pitch without a 78px box eating the frame.
 * ------------------------------------------------------------------------- */
const MONO_SIZE = TYPE.annotation.fontSize; // 56 -> 40.9px cap. Mono floor.
const SANS_SIZE = TYPE.label.fontSize; // 58 -> 40.6px cap. Sans floor.
const LINE_H = "62px";
/**
 * 56px mono advance incl. tracking: 56 * 0.6 + 0.2. Every BOUNDS comment in
 * this file is `chars * 33.8` — the whole width model for mono here.
 * Referenced in comments rather than code because every line is authored to a
 * literal left/width, so exporting it as a constant is how the next editor
 * finds the arithmetic instead of re-deriving it.
 */
export const MONO_CH_ADVANCE = 33.8;

/* --- THE MASTHEAD: TWO PAPER ROWS, TYPE KNOCKED OUT ------------------------
 * r12 GRADE · D6 — TWO NEAR-STATIC LOW-LIT RUNS, abs f16123-16311 (6.30s, and
 * it starts on the beat's FIRST frame) and f16348-16439 (3.07s), both under 3%
 * of the frame lit at luma >= 110 against an episode median of 6.51%.
 *
 * MEASURED, on out/draft/full_r12.mp4, 240x135 grayscale proxy:
 *
 *   f16220  whole-frame MAX luma 126, p90 33, p99 44, >=110 = 0.077%
 *   f16290  >=90 = 4.40%   >=110 = 2.29%   >=130 = 1.01%
 *
 * Two facts fall straight out of those numbers.
 *
 * 1. THE B-ROLL IS NOT A LEVER. At f16220 the brightest pixel in the entire
 *    frame is 126 and the 90th percentile is 33. Behind a 0.58 scrim the rack
 *    plate transmits ~0.22, so its raw p90 is ~150; even opening the scrim to
 *    half would put p90 at 75, still under the 110 gate. Nothing in the
 *    background can be made to count without destroying the text contrast the
 *    r10 regrade bought.
 *
 * 2. THE LETTERHEAD PLATE WAS THE #1 RECURRING BUG, IN THIS FILE, SHIPPING.
 *    It was painted `IDLE_FILL` — rgba(255,255,255,0.35), which composites to
 *    luma ~89-105 over this scrim. The f16290 histogram shows it exactly: the
 *    plate is 1232 x 74 = 4.40% of frame, and ">=90 = 4.40%, >=110 = 2.29%" is
 *    that plate straddling the gate, contributing roughly its own edges. A
 *    3.00:1 contrast token is NOT a lit-area token; 0.35 white is below 110 and
 *    the previous author's comment credited it with an event it half-had.
 *
 * So the whole header stops being thin bright type on black and becomes PAPER
 * WITH THE TYPE KNOCKED OUT — the idiom CacheLine, ThreeRules, HookRace,
 * SweepVsChase and HonestWalkback already use (`color: theme.bg` on a light
 * plate). `PLATE` composites to luma 148 over pure black, clear of 130 with
 * headroom for the proxy's bicubic edge attenuation, and theme.bg on it is
 * 6.91:1 — BETTER than the 3.60:1 the warm-on-IDLE_FILL version had.
 *
 * The masthead is two rows, and the kicker's DOCK is what builds the first one
 * (see BigDock's `plate` prop). Areas, all against the 2,073,600px^2 canvas:
 *
 *   row 1  kicker docked    1400 x 66 = 92,400px^2 = 4.456%
 *   row 2  letterhead W1     752 x 66 = 49,632px^2 = 2.394%
 *   row 2  letterhead W2    1400 x 66 = 92,400px^2 = 4.456%
 *
 * REVEAL ARITHMETIC (`areaPct * 6 / durationFrames >= 2.0`, and the reveals are
 * LINEAR — `lin()`, never `sub()`'s ease-out — because an N-frame ease-out's
 * best single-frame step is only (3/N) x delta and misses the gate):
 *
 *   local 113  plate grows 0 -> W1 with "Department of Energy"
 *              2.394 * 6 / 7 = 2.05  >= 2.0   per-frame 2.394/7 = 0.342% >= 0.3
 *   local 150  plate EXTENDS W1 -> W2, "physics code" wipes in with the edge
 *              extension 648 x 66 = 42,768px^2 = 2.062%
 *              2.062 * 6 / 6 = 2.06  >= 2.0   per-frame 2.062/6 = 0.344% >= 0.3
 *
 * The plate is a WIDTH ramp, not a clipPath on a fixed box, so at constant
 * height its AREA already advances linearly with a linear time curve — the
 * sqrt(t) correction is only needed where a fixed-width element is clipped
 * (that one is in BigDock, on the opening card).
 *
 * "physics code" is the narration's own words in that clause ("...Department of
 * Energy physics code called QMCPACK"), so the reveal is a noun the voice is
 * saying, not decoration invented to fill a gap.
 *
 * PROJECTED LIT, minus glyph knockout (mono ink ~13% of its own box):
 *   local  0- 70  opening card            6.331 - 0.483 = 5.85%
 *   local 95-112  docked row 1 alone      4.456 - 0.302 = 4.15%
 *   local  120s   + letterhead W1                        6.28%
 *   local  160s   + letterhead W2                        8.19%
 * against a measured baseline of 1.23% mean across f16123-16311 and 2.40% mean
 * across f16348-16439.
 *
 * BOUNDS. Safe top margin is 6% of 1080 = 64.8.
 *   row 1  y 66..132   text 56px mono, lineHeight 66 -> caps ~78..119
 *   gutter y 132..138
 *   row 2  y 138..204  warm rule 138..146, text top 138 lineHeight 66,
 *                      caps ~150..191
 *   QMCPACK docks at top 214 — 10px under row 2, unchanged, as is every
 *   element below it.
 * x: rows run 118..1518, inside the 115 and 1805 margins. "Department of
 * Energy" is 20ch = 676px at x150 -> 826, inside W1's right edge at 870;
 * "physics code" is 12ch = 406px at x960 -> 1366, inside W2's right edge at
 * 1518.
 * ------------------------------------------------------------------------- */
/**
 * The paper. rgba(255,255,255,0.58) composites to Rec.601 luma 148 over
 * theme.bg — over the 110 lit gate by 38 levels, which is the margin that
 * survives swscale's bicubic downscale to the 240x135 grading proxy. Do NOT
 * lower this toward IDLE_FILL (0.35 -> luma 89): that token is a CONTRAST
 * floor and is invisible to the lit-area gate.
 */
const PLATE = "rgba(255, 255, 255, 0.58)";
/** Both masthead rows share this left edge and this full width. */
const MAST_X = 118;
const MAST_W = 1400;
const MAST_ROW_H = 66;
/** Row 1 — where the kicker docks. See BigDock's `plate` prop. */
const KICKER_DOCK_PLATE = {
  left: MAST_X,
  top: 66,
  width: MAST_W,
  height: MAST_ROW_H,
};
/**
 * The opening card: the same paper, sized to the kicker at 76px sans 800.
 * 23ch x 44.1 = 1014px of type + 40px of padding each side = 1094 wide.
 * 1094 x 120 = 131,280px^2 = 6.331% of frame.
 */
const KICKER_BIG_PLATE = { left: 400, top: 300, width: 1094, height: 120 };
/** Row 2 — the letterhead. */
const DOE_BAND = { left: MAST_X, top: 138, height: MAST_ROW_H };
/** Width under "Department of Energy" alone. */
const DOE_BAND_W1 = 752;
/**
 * Width once "physics code" has been appended. 1400, not the old 1232: the
 * extension has to clear the reveal floor on its own, and 480 x 66 = 1.53% only
 * reaches 1.53 on `areaPct * 6 / 6`. 648 x 66 = 2.06% clears it.
 */
const DOE_BAND_W2 = MAST_W;
/** Where the appended words start. Clear of the DoE line's right edge at 826. */
const PHYSICS_X = 960;
/**
 * The letterhead rule. 8px, not 6: at the 240x135 proxy 6px is 0.75 of a pixel
 * and vanishes, 8px is exactly 1 and registers. It is warm on paper, which is
 * the one chromatic mark the masthead keeps once the type is knocked out.
 */
const DOE_RULE_H = 8;

/* --- the runtime bar. Every number on screen derives from these five. -----
 * BAR_Y moved 300 -> 376: the header above it is three 56px mono lines deep
 * now (kicker 70, funder 136, name 214 + the context chips on the name's
 * band), and "total run time" needs its own 62px line under them. */
const BAR_X = 150;
const BAR_Y = 376;
const BAR_W = 1400;
const BAR_H = 78;
/**
 * SOURCE [9], arXiv:1611.02665, abstract, verbatim: "This work combined with
 * our current efforts of optimizing other QMC kernels, result in greater than
 * 4.5x speedup of miniQMC on KNL." The narration says "more than four and a
 * half times". 4.5 is therefore the CONSERVATIVE read of the source, and the
 * bar is drawn honestly against it: the "after" length is BAR_W / 4.5, which
 * is 311px — just under a quarter of the original, exactly what the storyboard
 * asks the eye to see.
 *
 * SCOPE, which the screen must state and does (see SCOPE_NOTE): the figure is
 * for miniQMC on KNL, and it is the paper's own work COMBINED WITH other
 * kernel optimizations. Neither the bar nor the type may imply that the three
 * changes alone bought 4.5x on the full production application.
 */
const SPEEDUP = 4.5;
const AFTER_W = BAR_W / SPEEDUP;
/**
 * The scope caveat, on screen under the number. Not decoration — it is the
 * difference between what the source says and what a bare "4.5x, end to end"
 * would let a viewer assume.
 * SHORTENED for the floor, not trimmed for tidiness: at 56px mono the old
 * 48-char line is 1622px from x 684 and ends at x 2306, half a frame outside
 * the 1805 safe edge. "combined with our current efforts of optimizing other
 * QMC kernels" is what "plus other work" stands in for — the claim it has to
 * defeat is "these three changes alone bought 4.5x", and it still does.
 * BOUNDS: 32 mono chars at 56px (33.8px/char) = 1082px from x 684 -> x 1766.
 */
const SCOPE_NOTE = "miniQMC on KNL · plus other work";
/**
 * One kernel was eating UP TO half of total runtime. SOURCE [9] verbatim:
 * "historically taking as much as 50% of the total run time" — a cap, not a
 * mean, which is why the on-screen count-up reads "up to 50%".
 */
const KERNEL_W = BAR_W * 0.5;

/* --- the rewrite. THREE changes, never one. -------------------------------
 * BINDING CAVEAT from the beat notes: the win comes from a data-layout rewrite
 * that BUNDLES three changes. Saying or showing "they changed one struct" would
 * attribute the whole 4.5x to the AoS->SoA flip, which the paper does not
 * support. That is why there are three rows, why they are numbered, and why a
 * brace ties them together before the bar moves.
 *
 * The abstract is in fact one notch weaker still — the >4.5x is this work
 * "combined with our current efforts of optimizing other QMC kernels" — so even
 * the three changes together do not own the whole figure. That is what
 * SCOPE_NOTE puts on screen; do not delete it to tidy the frame.
 *
 * LAYOUT CHANGE (readability floor): these used to be three side-by-side cards
 * with a 30px title and 17px sub-lines, then three 40px lines. Both were under
 * the floor. They are now a numbered STACK, braced on the left. Same
 * information, same "three, bundled" reading, legible at distance.
 *
 * INK BUDGET (r7). The rows used to be a NARROW COLUMN: number + title + dash
 * + sub packed into ~1035px of a 62px line box = 64,170px^2. That is 3.1% of
 * frame by bounding box, but the box is mostly gutter between short mono words
 * — the eye reads it as a thin strand of type in the lower-left ninth of the
 * screen, which is exactly the class of reveal theme.ts's INK BUDGET section
 * says registers on the detector and not on the viewer. Each row now spans the
 * frame as a two-column spec line (number + title flush left, sub flush right
 * at x1610, dotted leader between), because each row now ARRIVES ALONE:
 *
 *   ROW_W 1420 x ROW_LH 70 = 99,400px^2 = 4.79% of 2,073,600
 *   floor 1.5% = 31,104px^2   target 2.0% = 41,472px^2   -> 3.2x the floor
 *
 * That width is also what makes their DEPARTURE the biggest single event in the
 * beat: three rows leaving at once repaints 298,200px^2 = 14.4% of frame.
 *
 * BOUNDS: rows run x 190 -> 1610. Left group worst case = numeral 46 + gap 18 +
 * "cache blocking" at 58px sans bold (14ch x 33.6) 470 = x 190 -> 724. Right
 * column worst case = "struct of arrays" at 56px mono (16ch x 33.8) 541,
 * right-aligned to 1610, so x 1069 -> 1610 — inside the 1804 safe edge.
 * PITCH: 82, not 76 — a 70px line box needs 12px of air or the descenders of
 * one row sit in the caps of the next.
 */
const ROW_X = 190;
const ROW_Y = 700;
const ROW_W = 1420;
const ROW_PITCH = 82;
const ROW_LH = 70;
const CHANGES: Array<{ title: string; sub: string }> = [
  { title: "AoS → SoA", sub: "struct of arrays" },
  { title: "cache blocking", sub: "work on tiles" },
  { title: "vectorization", sub: "many at a time" },
];
/**
 * One entrance grammar per row. The rows are 1420px bands now and they arrive
 * ~52 and ~72 frames apart, so the viewer sees each one enter on its own; three
 * identical left-slides at that size is the "banner ads" read the variety rule
 * exists to stop. Wipe, then slide, then pop — no grammar twice in a row.
 */
const ROW_GRAMMAR = ["wipe", "slide", "pop"] as const;
/** Brace spans the three rows: 700 -> 934 of text, 8px of overhang each end. */
const BRACE_TOP = ROW_Y;
const BRACE_BOTTOM = ROW_Y + (CHANGES.length - 1) * ROW_PITCH + ROW_LH + 8;

/* --- THE B-ROLL LOOP SEAM ---------------------------------------------------
 * Server-rack footage is 31.56s at 25fps (ffprobe: 789 frames) = 946.8
 * composition frames at 30fps, and the beat is 1041. Played straight it would
 * sit on a frozen final frame through the punchline, so it has to wrap.
 *
 * R10 GRADE · D8 — THE EPISODE'S LARGEST ZERO-TRANSITION JUMP. This used to be
 * a bare `<Loop durationInFrames={930}>`, i.e. a HARD CUT from clip frame 930
 * back to clip frame 0. The scene is mounted in Episode005's per-beat
 * `<Sequence from={16123}>`, so the loop's seam sits at beat-local 930 =
 * ABSOLUTE f17053 — exactly the frame the grade measured as 10.24% of the
 * picture changing in ONE frame with no transition at all, 111 frames before
 * the beat ends. The old note here reasoned about WHERE to put the cut and
 * never about the cut itself; a full-frame video splice is a transition-less
 * state change no matter which 25-frame gap it lands in, and the scrim does
 * not soften it (extraScrim is 0.60 at f17053, its heaviest, and 10.24% of the
 * frame still crossed the 25-luma bar).
 *
 * The wrap is now a CROSS-DISSOLVE, not a splice. Two passes of the same clip,
 * the second fading up over the first across BROLL_DISSOLVE frames:
 *
 *   pass A   fromFrame 0    plays clip frames    0..937   (937 < 946 avail)
 *   pass B   fromFrame 930  plays clip frames    0..110   (beat ends at 1041)
 *   dissolve beat-local 930..937, `Easing.inOut(Easing.sin)`
 *
 * ARITHMETIC. 7 frames = 233ms, inside the 6-9 frame craft band. Sampled frame
 * by frame, the blend steps 0 / .0495 / .1883 / .3887 / .6113 / .8117 / .9505 /
 * 1 — a largest single-frame step of 0.2225 at f934 (analytic bound (pi/2)/7 =
 * 0.224). So the biggest one-frame change is 22.3% of the splice, and a pixel
 * would need a full-cut delta of 25/0.2225 = 112 luma to still cross the
 * grader's 25-luma bar — which behind a 0.60 scrim (0.21 transmitted) needs 535
 * luma of raw video difference. Nothing can supply that, so the seam stops
 * being a single-frame event at all rather than becoming a smaller one.
 *
 * WHY A IS MOUNTED ONE FRAME PAST THE DISSOLVE (BROLL_PASS = seam + dissolve +
 * 1 = 938). Pass A's own `<Sequence>` unmounts at its duration. If it unmounted
 * ON the last dissolve frame, the residual few percent of A would disappear in
 * one frame — a small version of the same defect. Ending the dissolve at 937
 * and unmounting A at 938 means A is already fully covered when it goes.
 *
 * WHERE IT SITS. Replaying schedule(): `ledger[0]` completes at step-local 194
 * = beat-local 919 and `ledger[1]` arrives at beat-local 951, so the dissolve
 * occupies 930-937 inside a 32-frame window where nothing enters or leaves.
 * (The old comment named `chipsRecede` and `ledger[2]` — neither is the
 * neighbour, and `chipsRecede` does not exist in this file.)
 *
 * RENDER NOTE: verified with ffprobe on review — this clip is ALREADY 1280x720
 * / 2.2 MB / 789 frames @ 25fps, so there is nothing for the render phase to
 * downscale here. The two passes overlap for 8 frames and only 8 frames, which
 * is the one place in this beat that decodes the clip twice; Episode005's
 * SCENE_OWNS_BROLL note is about decoding it twice for a WHOLE beat.
 * ------------------------------------------------------------------------- */
const BROLL_SRC = "ep-cpu-waits-on-memory/broll/2c5be2930b0e.mp4";
/** Beat-local frame the clip wraps on. */
const BROLL_SEAM = 930;
/** 7 frames = 233ms — inside the 6-9 frame entrance/exit band. */
const BROLL_DISSOLVE = 7;
/** Each pass's length, +1 so pass A unmounts fully covered. See above. */
const BROLL_PASS = BROLL_SEAM + BROLL_DISSOLVE + 1; // 938

/* --- the paper, SET NATIVELY. ---------------------------------------------
 * The arXiv capture is GONE from this scene. It was mounted as a headline
 * crop (1560x182) at 1160px arriving / 548px docked, i.e. 0.74x / 0.35x of a
 * source whose printed title is ~22px of cap — 16px arriving, ~6px docked.
 * There is NO size at which that capture clears the 40px cap floor: it would
 * need 2.5x, which is a 3900px-wide image. So this follows `google_receipts`'
 * settled answer — the citation is TYPESET IN-ENGINE at the mono floor, and
 * the screenshot is not shown at all. Provenance is unchanged: the arXiv ID
 * is on screen, at the floor, for the rest of the beat, and credits.md still
 * carries the full record for arxiv.org/abs/1611.02665.
 *
 * CITE_TITLE is a VERBATIM substring of the paper's title ("Optimization and
 * parallelization of B-spline based orbital evaluations in QMC on
 * multi/many-core shared memory processors") — an excerpt, never a paraphrase.
 * BOUNDS at 56px mono (33.8px/char) from CITE_X 700:
 *   title    28ch =  946px -> x 700-1646
 *   authors  23ch =  777px -> x 700-1477
 *   id       16ch =  541px -> x 700-1241   (docked: x 1264-1805)
 * The arrival block owns y 430-644, which is empty until `runtime_bar`: the
 * bar's own band is y 376-454 and it does not reach x700 until ~14 frames
 * after the title and author lines have already left. */
const CITE_TITLE = "B-spline orbital evaluations";
const CITE_AUTHORS = "Mathuriya et al. · 2016";
const CITE_ID = "arXiv:1611.02665";
const CITE_X = 700;
const CITE_Y = 430;
const CITE_PITCH = 76;
/** Docked home: the slot the old receipt panel used, minus the image. The
 *  rewrite header ends at x1063 and the change rows at x1225, so x1264-1805
 *  on the y612 band is clear of everything for the rest of the beat. */
const CITE_DOCK_X = 1264;
const CITE_DOCK_Y = 612;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });

/** Default entrance length. 9 frames = 300ms — the top of the 6-9f window. */
const ENTER = 9;

/**
 * Carve a sub-reveal out of one step's progress, in FRAMES from that step's
 * start. Same helper shape as TrickQuestion.tsx — one pattern, not two.
 * `at` = frames after the step begins, `dur` = length of the reveal.
 */
const sub = (
  v: number | undefined,
  step: RealSystemPayoffStep,
  at: number,
  dur: number = ENTER,
) => ease((clamp01(v ?? 0) * REAL_SYSTEM_PAYOFF_NOMINAL[step] - at) / dur);

/**
 * `sub` WITHOUT the ease-out — the same window, on a straight line.
 *
 * WHY BOTH EXIST. `sub` is right for anything the eye reads as a gesture: an
 * ease-out settles, and settling is what makes an entrance feel crafted. It is
 * WRONG for anything whose job is to repaint area, because the grading
 * detector measures the biggest SINGLE-FRAME change and an N-frame ease-out
 * opens at only (3/N) x delta — a 9-frame ease-out on a 1.7% element moves 22.5
 * luma levels and misses the 25 gate outright. Every area reveal in this file
 * is therefore driven by `lin` and either ramps a WIDTH (area is linear in
 * width at constant height) or drives a clipPath through sqrt(t) (a
 * left-to-right wipe paints area as width^2, so sqrt is what makes AREA, not
 * the mask edge, advance linearly).
 */
const lin = (
  v: number | undefined,
  step: RealSystemPayoffStep,
  at: number,
  dur: number = ENTER,
) => clamp01((clamp01(v ?? 0) * REAL_SYSTEM_PAYOFF_NOMINAL[step] - at) / dur);

// Spring-ish entrance without a spring: 0.94 -> 1.035 -> 1.0. Scale never starts
// at 0 (that reads as a cartoon balloon) and the overshoot settles inside the
// caller's 6-9 frame entrance window.
const popScale = (t: number) =>
  interpolate(clamp01(t), [0, 0.6, 0.85, 1], [0.94, 1.035, 0.995, 1]);
const popOpacity = (t: number) => clamp01(t / 0.4);

/**
 * The rack footage, wrapped with a cross-dissolve instead of a splice — see THE
 * B-ROLL LOOP SEAM above for why and for the arithmetic.
 *
 * `useCurrentFrame` here is BEAT-LOCAL (the scene is mounted in Episode005's
 * per-beat `<Sequence>`), which is the same clock the old `<Loop>` ran on, so
 * the seam has not moved — only its grammar has. This is the one place in the
 * scene that reads a clock rather than a progress channel, exactly as the b-roll
 * always did; nothing that REVEALS uses it.
 */
const BrollWrap: React.FC = () => {
  const f = useCurrentFrame();
  const over = interpolate(
    f,
    [BROLL_SEAM, BROLL_SEAM + BROLL_DISSOLVE],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.sin),
    },
  );
  return (
    <>
      {/* Pass A. Its own Sequence unmounts it at BROLL_PASS, one frame after
          the dissolve has already covered it completely. */}
      <BRoll
        src={BROLL_SRC}
        kind="video"
        durationInFrames={BROLL_PASS}
        dim={0.58}
      />
      {/* Pass B, opaque, fading up on top: a true cross-dissolve with no
          ambient bleed through a half-transparent A. Same `durationInFrames` as
          A so the two passes push in at the same rate; the beat's own Sequence
          clips it after 111 frames. */}
      <div style={{ position: "absolute", inset: 0, opacity: over }}>
        <BRoll
          src={BROLL_SRC}
          kind="video"
          fromFrame={BROLL_SEAM}
          durationInFrames={BROLL_PASS}
          dim={0.58}
        />
      </div>
    </>
  );
};

/**
 * Beat 14 — the payoff: the same cache argument, run on a national-lab physics
 * code instead of an interview whiteboard.
 *
 * The design rule is that there is ONE object in this scene — the total-runtime
 * bar — and everything else annotates it. The kernel slice lights inside it, the
 * three rewrite rows sit under it, and then the bar itself compresses rather
 * than being replaced by an "after" bar next to it. Object constancy is what
 * makes the 4.5x land as a thing that happened to a system, not as two bars in
 * a chart. The ghost outline it leaves behind is the only honest way to keep the
 * "before" length on screen once the bar has moved.
 *
 * TRANSPARENCY: this scene paints NO opaque background. Episode005 mounts a
 * global AmbientBackground under every scene; an `AbsoluteFill` filled with
 * theme.bg (#000000, fully opaque) would occlude it and leave a dead-black
 * frame. Local darkening is the partial-alpha `extraScrim` below, and nothing
 * else.
 */
export const RealSystemPayoff: React.FC<RealSystemPayoffProps> = ({
  p,
  frame = 0,
}) => {
  const barP = clamp01(p.runtime_bar ?? 0);

  /* --- qmcpack_label: 9 sub-reveals over its 354-frame slot ---------------
   * Window LENGTHS matter as much as their start: an entrance is 6-9 frames.
   * The longer windows below are deliberately NOT entrances — a mask wipe
   * across 900px of type, a dock, and a scrim lift are GESTURES, and gestures
   * read at 20-50 frames. Getting that backwards is what makes a scene sleepy;
   * stretching an entrance to fill a slot is what the grader measured as a
   * 220-frame fade. Ramp fast, then hold.
   * Starts:  0 / 71 / 113 / 150 / 188 / 220 / 251 / 290 / 304 / 316 / 325 / 334
   * Gaps:      71   42    37    38    32    31    39    14    12     9     9
   * (113 -> 188 used to be one 75-frame gap and was the beat's only dead
   * stretch in the r8 pacing run; `physicsCode` at 150 is what halves it.)
   *
   * r12: the three MASTHEAD reveals moved from `sub` to `lin` and from 16/20/16
   * frames to 9/7/6. Both halves of that matter. The ease-out was costing them
   * the single-frame gate (see `lin` above), and 16-20 frames is outside the
   * 6-9f entrance band anyway — these are entrances, not the gestures the long
   * windows below are. The dock and the scrim lift stay eased and stay long,
   * because those ARE gestures.
   *
   * `kickerIn` STARTS AT -3, and that is not a typo. The previous beat hands
   * over at 15.03% lit (measured, f16120 of full_r12) and this one's first frame
   * is its own entrance's frame zero — so a wipe starting at 0 spends f16123 on
   * an unlit frame and the cut reads as a one-frame blackout. Opening the window
   * three frames early means the card is already sqrt(3/9) = 57.7% painted on
   * the beat's first frame — a 3.65% single-frame burst ON the cut, closing over
   * the six frames that follow, which is an entrance inside the 6-9f band and a
   * far better handoff than a blink.
   */
  const kickerIn = lin(p.qmcpack_label, "qmcpack_label", -3, 9); // wipe, 6f seen
  const kickerDock = sub(p.qmcpack_label, "qmcpack_label", 71, 24); // dock
  const doeLine = lin(p.qmcpack_label, "qmcpack_label", 113, 7); // width ramp
  // The second half of the letterhead. See THE MASTHEAD: this is the reveal
  // that splits the beat's 75-frame hole (113 -> 188) into 37 and 38.
  const physicsCode = lin(p.qmcpack_label, "qmcpack_label", 150, 6); // extend
  const nameIn = sub(p.qmcpack_label, "qmcpack_label", 188); // pop, 9f
  const nameDock = sub(p.qmcpack_label, "qmcpack_label", 220, 24); // dock
  const ctxElectrons = sub(p.qmcpack_label, "qmcpack_label", 251); // pop, 9f
  const brollLift = sub(p.qmcpack_label, "qmcpack_label", 290, 48); // texture
  const ctxSuper = sub(p.qmcpack_label, "qmcpack_label", 304); // pop, 9f
  // The citation, three staggered mask wipes — 9 frames each, in the house
  // entrance band. It replaces the single 16-frame image fade.
  const citeTitle = sub(p.qmcpack_label, "qmcpack_label", 316);
  const citeAuthors = sub(p.qmcpack_label, "qmcpack_label", 325);
  const citeId = sub(p.qmcpack_label, "qmcpack_label", 334);

  /* The letterhead's painted width, in one place because three elements have to
   * agree on it: the plate, its warm rule, and — critically — the two lines of
   * type, which are revealed BY THE PLATE'S OWN EDGE rather than by a clip on
   * their own progress. Clipping the type on `doeLine` directly let a glyph or
   * two hang past the paper mid-wipe; deriving each line's clip from where the
   * edge actually is makes the words appear as the paper reaches them, which is
   * the whole point of a letterhead being typed. */
  const doeW =
    DOE_BAND_W1 * doeLine + (DOE_BAND_W2 - DOE_BAND_W1) * physicsCode;
  const doeEdge = DOE_BAND.left + doeW;
  /** "Department of Energy": 20ch x 33.8 = 676px from x150. */
  const doeReveal = clamp01((doeEdge - 150) / 676);
  /** "physics code": 12ch x 33.8 = 406px from PHYSICS_X. */
  const physicsReveal = clamp01((doeEdge - PHYSICS_X) / 406);

  /* --- runtime_bar (79f): label wipes on, then the bar draws L->R --------- */
  const barLabel = sub(p.runtime_bar, "runtime_bar", 0, 13); // wipe, 13f
  // The citation DOCKS here — see the CITE_* block for the geometry. 20 frames
  // is a gesture, not an entrance, and it deliberately runs BEFORE barDraw
  // (local 12) gets far, so the title/author lines have left the bar's band by
  // the time the bar reaches x700.
  const receiptDock = sub(p.runtime_bar, "runtime_bar", 0, 20); // dock
  // The two lines that do NOT survive the dock leave on a ~6-frame ease-in:
  // 1.6x of an eased 20-frame gesture is fully clear by its 6th frame.
  const citeGone = 1 - clamp01(receiptDock * 1.6);
  // 50 frames to draw 1400px. Long on purpose: this is the object the whole
  // scene annotates ARRIVING — a line draw-on gesture, not a label popping.
  const barDraw = sub(p.runtime_bar, "runtime_bar", 12, 50); // draw-on

  /* THE "one kernel" LABEL LIVES IN runtime_bar, NOT IN kernel_slice_50.
   *
   * MEASURED, not modelled. The shipping alignment for the chunk that opens
   * this beat is episodes/005-cpu-waits-on-memory/.tts_cache/eec0742d2991092e
   * .json (word, seconds-from-chunk-start); the chunk starts at the beat's
   * `startFrame` 16123, confirmed twice — "four" resolves to abs 16893, the
   * exact `speedup` mark in timing.json, and "Big" to 17164, the exact
   * `ending_two_questions` startFrame. Against that clock:
   *
   *   "One"     t 11.620s -> abs 16472   (runtime_bar local  3)
   *   "kernel"  t 12.446s -> abs 16496   (runtime_bar local 27)
   *   "HALF"    t 14.000s -> abs 16543   (kernel_slice_50 local 2)
   *
   * `npx tsx scripts/dump_schedule.ts` resolves runtime_bar to 16469-16548 and
   * kernel_slice_50 to 16541-16621, so the WHOLE phrase this label spells is
   * spoken and finished 45 frames before kernel_slice_50 opens. The old pin,
   * `sub(p.kernel_slice_50, "kernel_slice_50", 64)`, resolved to abs 16605 —
   * 109 frames (3.6s) after "kernel", 133 after "One", i.e. it popped over
   * "So they did a data-layout rewrite". No offset inside kernel_slice_50 can
   * reach back before its own start, so the fix is the STEP, not the offset.
   *
   * WHY THE HEAD NOUN AND NOT "One". Local 24 = abs 16493 is 3 frames before
   * "kernel" (the house rule exactly) and 21 frames INTO the drawn-out "One",
   * so it is on the phrase, never after it. Pinning 3 frames before "One"
   * instead (local 0 = 16469) is reachable but wrong for the picture: barDraw
   * only opens at local 12 = 16481, so at 16469-16472 this label is centred
   * under an UNPAINTED bar and points at nothing. At local 24 the eased draw
   * stands at 1 - (1 - 12/50)^3 = 0.561, i.e. 785px of 1400 — the entire 700px
   * kernel region is painted beneath the label on the frame it arrives.
   *
   * It also staggers the step cleanly: 16469 bar label + citation dock, 16481
   * bar draw-on, 16493 this pop. */
  const sliceLabel = sub(p.runtime_bar, "runtime_bar", 24); // pop, 9f

  /* --- kernel_slice_50 (80f): fill wipe, count-up, bracket ---------------- */
  const sliceFill = sub(p.kernel_slice_50, "kernel_slice_50", 0, 26); // wipe
  const sliceCount = sub(p.kernel_slice_50, "kernel_slice_50", 16, 40); // count
  const sliceBracket = sub(p.kernel_slice_50, "kernel_slice_50", 48, 16); // draw

  /* --- ROUND-14 / D3 — THE MAJOR-EVENT GAP f16484-16705 (7.40s) ------------
   * The r13 grade measured 221 frames in which nothing >= 1% of the picture
   * changed in a single frame. The whole window is one narrated sentence —
   * "One kernel inside it was eating up to half of the total runtime" — and
   * everything staged against it is small or is disqualified by construction:
   *   sliceFill    700 x 78 = 2.63% over 26f = 0.101 %/f  (0.61 on the
   *                areaPct x 6 / dur >= 2.0 rule, i.e. it fails it)
   *   sliceCount   a COUNT-UP; not an event at any threshold
   *   sliceBracket a 3px DrawnPath; 3px pools to 0.375 proxy px, ~0.000%
   *   sliceLabel   10 mono chars; glyph ink is ~13% of the line box, ~0.03%
   *                (and it no longer even lands in this window — it has moved
   *                back to runtime_bar local 24 = abs 16493, onto the word it
   *                spells; see the pin above. It was never an event here.)
   *   rewriteHeader 27 mono chars wiping over 15f = 0.024 %/f
   * and the frame's lower half (y 500-1000) is EMPTY for the entire window —
   * see the r13 stills at f16520 and f16600. So the gap is not a timing nudge,
   * it is missing content, and it is filled with a discrete ARRIVAL.
   *
   * THE BAND. The sentence's payload is the word "half", and this beat already
   * owns an idiom for a spoken keyword at scale: PLATE paper with the type
   * knocked out (`color: theme.bg`), the same object as the masthead rows. So
   * "half the total runtime" arrives as a plate in the empty lower half, on
   * its own word, and leaves before the rewrite header needs the space.
   *
   *   area   1080 x 130 = 140,400px = 6.77% of frame
   *   in     local 0-6   = abs 16541-16547, 6 frames
   *          6.77 / 6 = 1.128 %/f          -> MAJOR (1% single-frame gate)
   *          6.77 over 6f                  -> MAJOR (5% six-frame gate)
   *          6.77 x 6 / 6 = 6.77           -> >> the 2.0 authoring floor
   *   out    local 62-68  = abs 16603-16609, same arithmetic
   *
   * WORD SYNC — FIXED 2026-09-04, the band was 12 frames LATE.
   *
   * MEASURED, not modelled. The abs 16558 for "half" this block used to carry
   * was derived at a flat 11.15 f/word off a 69-word count; nothing about it
   * was ever aligned. Ground truth is the shipping chunk alignment,
   * .tts_cache/eec0742d2991092e.json (`spoken: [[word, seconds]]`), chunk
   * origin = this beat's startFrame 16123, confirmed by the same two
   * cross-checks the `sliceLabel` pin above uses — "four" t 25.664s -> abs
   * 16893, the exact `speedup` mark, and "Big" t 34.693s -> abs 17164, the
   * exact `ending_two_questions` startFrame. Against that clock:
   *
   *   "HALF"  t 14.000s -> abs 16543
   *
   * kernel_slice_50 resolves to 16541-16621 with ramp == NOMINAL == 80, i.e.
   * a 1.000x LINEAR playhead (`playhead: true` in Episode005's plan), so
   * step-local == abs - 16541 with no clock skew to correct for.
   *
   * MEASURE THE FIRST PAINTED FRAME, NOT THE `at`. `lin` is zero AT its own
   * offset and only goes positive on the NEXT frame, and the render is gated
   * on `halfBandIn > 0`, so a reveal authored at local N is invisible until
   * N+1. Tabulated (dur 6):
   *
   *   at   first painted frame   vs "HALF" @16543
   *   14         16556                 +13   <- shipped, the defect
   *    2         16543 + 1 = 16544      +1    <- STILL LATE. rejected.
   *    1         16543                   0
   *    0         16542                  -1    <- chosen
   *
   * Local 0 is taken because it is the EARLIEST REACHABLE offset on this step
   * and it is the only one with headroom: it paints a frame before the word,
   * is already 33% wiped ON the word's own frame, and completes at 16547. It
   * also degrades safely — a re-voice that shifts this step a frame or two
   * later leaves the band at 0/+1 instead of pushing it back over the line,
   * which is what `at: 2` would do on the very first frame of drift.
   *
   * NOTHING BELOW LOCAL 0 IS REACHABLE, and a negative `at` is a BUG on this
   * step, not an option. `p.kernel_slice_50` is 0 (absent) for the whole beat
   * before 16541, so `lin(p, step, -1, 6)` evaluates to clamp01(1/6) = 0.167
   * from the beat's FIRST frame and the `halfBandIn > 0` guard would mount the
   * plate at 16.7% painted for 418 frames. (`kickerIn`'s at:-3 is only safe
   * because qmcpack_label starts ON the beat boundary, so there is no
   * before-the-step to leak into. Do not copy it here.) So -1 relative to the
   * word is the best this step can do, and it is inside the -3..0 window.
   *
   * NOTHING BELOW LOCAL 0 IS REACHABLE, and a negative `at` is a BUG on this
   * step, not an option. `p.kernel_slice_50` is 0 (absent) for the whole beat
   * before 16541, so `lin(p, step, -1, 6)` evaluates to clamp01(1/6) = 0.167
   * from the beat's FIRST frame and the `halfBandIn > 0` guard would mount the
   * plate at 16.7% painted for 418 frames. (`kickerIn`'s at:-3 is only safe
   * because qmcpack_label starts ON the beat boundary, so there is no
   * before-the-step to leak into. Do not copy it here.)
   *
   * `sliceFill` DID NOT MOVE, and did not have to. The old note here declined
   * the fix partly because pulling the band to local 0-2 "collides with
   * sliceFill's own 0-26 wipe" — but local 14-20 was ALREADY strictly inside
   * 0-26, so the overlap it warned about was the SHIPPING STATE, not a
   * consequence of the fix. The only thing that changes is the phase: the
   * band's start moves from sliceFill+14 to sliceFill+0.
   *
   * That co-fire is stated plainly rather than dressed up as a stagger, and it
   * is fine on three counts. (1) They are spatially disjoint — the slice is
   * y 376-454 INSIDE the bar, the band is y 580-710 in the empty lower half —
   * so there is no second moving focus competing for the same region. (2)
   * `sliceFill` is not an arrival: it is a 26-frame eased GROWTH of a red
   * region inside an object already on screen, 0.101 %/f, which is why it has
   * never cleared the 0.3% burst gate. (3) They are one narrated gesture — the
   * slice reaching half the bar and the paper naming "half the total runtime",
   * both on the word "HALF". Buying a 2-frame stagger here would have cost a
   * frame of lateness, and sync outranks a stagger the detector cannot see.
   *
   * THE EXIT IS UNTOUCHED, so the "band gone before rewriteHeader" arithmetic
   * survives verbatim rather than being re-fitted: only the IN moved, and
   * `halfBandOut` still runs local 62-68 = abs 16603-16609 against
   * `rewriteHeader = sub(p.chip_aos_soa, "chip_aos_soa", 0, 15)` on a step that
   * dump_schedule resolves to 16614 — 5 clear frames, exactly as before. The
   * only quantity the move changes is the band's own on-screen hold: the wipe
   * completes at 16547 instead of 16561, so the plate is static for
   * 16547-16603 = 56f (1.87s) rather than 42f. That is under the 3s hold
   * ceiling, and it is not a still FRAME in any case — `sliceCount` runs
   * 16557-16597 and `sliceBracket` 16589-16605 across it.
   *
   * EVENT LADDER, re-derived. Step-local starts go 0/14/16/48/62 ->
   * 0/0/16/48/62 = abs 16541/16541/16557/16589/16603, gaps 0/16/32/14 frames,
   * max 32f = 1.07s, then 11 frames to `rewriteHeader` at 16614. Nothing comes
   * near the 2-3s content-event rule and there is no major-event gap anywhere
   * close to 5s. The census loses an ENTRY but not an EVENT: under the
   * |dLuma| >= 25 detector `sliceFill` was never a burst (700 x 78 = 2.63%
   * over 26 eased frames = 0.101 %/f, a third of the 0.3% single-frame gate —
   * see the census above), so this band was and remains the step's ONLY
   * measured burst. It has simply moved 14 frames earlier, which shortens the
   * major-event gap that opens ahead of it rather than opening a new one.
   *
   * LUMA. PLATE (rgba(255,255,255,0.58)) over the deepened scrim (b-roll ~35)
   * composites to 0.58 x 255 + 0.42 x 35 = 162.6: a 128-level step, five times
   * the 25 gate, and over the 110 lit threshold — so this is also the LIT
   * foreground that pays for D4's deeper scrim in the same window.
   * A LINEAR clip, and the rectangle is CONSTANT HEIGHT, so area advances
   * linearly with the clip and no sqrt() correction is needed; an ease-out
   * would open at 3/6 speed and land at 0.56 %/f, under the major gate.
   *
   * BOUNDS, all checked against what is live at abs 16542-16609 (the move
   * only widens this window on the left, into frames where the lower half is
   * emptier still — "one kernel" at 16493 is the sole neighbour it gains, and
   * it clears the band's top edge by 26px exactly as it did before):
   *   band      x 150-1230, y 580-710
   *   "one kernel"      y 492-554  (arrives 16493)          26px above
   *   docked citation   x 1264+, y 612-674                  34px to the right
   *   rewriteHeader     y 612-674  (arrives 16614)          band gone at 16609
   *   change row 1      y 700+     (arrives 16654)          band gone at 16609
   * Text is 22 mono chars at 68px = 22 x 41.0 = 902px from x 190, ending at
   * 1092 — 138px inside the plate, so nothing can spill under any face metric
   * drift. Cap height 68 x 0.73 = 49.6px, over the 40px broadcast floor.
   *
   * CEILING: 68 <= kernel_slice_50's reachable clock (the step resolves at
   * 1.000x on an 80-frame slot, and `sliceBracket` already runs to 64). */
  // local 0 = abs 16541; first PAINTED frame 16542, one before the measured
  // onset of "HALF" at 16543. Was 14 (first paint 16556, 400ms late). Local 0
  // is the hard floor here — a negative `at` leaks the plate across the whole
  // beat on a step that is not the beat's first. See WORD SYNC above.
  const halfBandIn = lin(p.kernel_slice_50, "kernel_slice_50", 0, 6);
  const halfBandOut = lin(p.kernel_slice_50, "kernel_slice_50", 62, 6);

  /* --- the rewrite: header, three rows, then the brace draws --------------
   * Beat-local: 491 header, 531 row1, 583 row2, 655 row3, 683 brace.
   * Absolute (schedule() replayed against the shipping timing.json): the steps
   * open at 16614 / 16692 / 16770, so the rows land at 16654 / 16706 / 16778 —
   * 52 and 72 frames apart, each on the clause that names it. THEY ARE ALREADY
   * STAGGERED; the r6b freeze at 16891+ is downstream of here and is fixed in
   * bar_compress_countup, not by dragging these off their words.
   *
   * Each row now enters with a DIFFERENT grammar (wipe / slide / pop) because
   * each one is a full-frame-width band arriving alone — three identical
   * left-slides at that size would be three identical banners.
   */
  const rewriteHeader = sub(p.chip_aos_soa, "chip_aos_soa", 0, 15); // wipe
  const rowIn = [
    sub(p.chip_aos_soa, "chip_aos_soa", 40),
    sub(p.chip_blocking, "chip_blocking", 14),
    sub(p.chip_vectorize, "chip_vectorize", 8),
  ];
  const bundleBrace = sub(p.chip_vectorize, "chip_vectorize", 36, 18); // draw

  /* --- bar_compress_countup: 10 sub-reveals over its 324-frame slot -------
   * THE PAYOFF NUMBER LANDS ON ITS WORD. Episode005 pins this step to
   * `speedup` - 46, so the mark sits at step-local 46 by construction no
   * matter how the beat is re-voiced. The old table started the count-up at 42
   * and ran it for 66 frames, so 4.5x RESOLVED at 108 — 62 frames (2.1s) after
   * the word "four", with the viewer watching a number tick through 3.2x and
   * 4.4x long after hearing the answer. A count-up is not a content event; the
   * settled value is.
   *
   * So the count-up PRE-ROLLS and ARRIVES on the mark:
   *   compress   starts  4, runs 42 -> the bar is at its final length at 46
   *   morePrefix starts 22, runs  9 -> "more than" is up at 31, 15f early
   *   countUp    starts 24, runs 22 -> reads 4.5x AT 46, the word "four"
   * Nothing about the payoff resolves after its word. The pre-roll is also
   * what keeps both strings off the still-shrinking bar: the bar's right edge
   * clears x1030 at local 13 and x680 at local 21.
   * ---- r7: THE ONE TRUE FREEZE IN THE EPISODE, AND ITS ARITHMETIC ---------
   * The r6b grade found abs f16891-16995 (3.5s) content-identical across every
   * sampled frame. Re-deriving that window against the SHIPPING timing.json
   * (beat start 16123, `speedup` @16893, so this step is pinned at 16893-46 =
   * 16847 and step-local == abs - 16847 at the 1.00x clock this beat resolves
   * to) puts the freeze at step-local 44-148.
   *
   * The grade blamed "the three numbered changes all arrive at f16891". They do
   * not, and moving them there would be the worse bug: replaying schedule()
   * puts chip_aos_soa at 16614, chip_blocking at 16692, chip_vectorize at
   * 16770, so the rows already land at 16654 / 16706 / 16778 — 52 and 72 frames
   * apart, each ON the clause that names it. f16900 is 250 frames past
   * "three changes bundled"; the narration there is "...four and a half times
   * faster, end to end." Re-pinning the rows to the freeze window would trade
   * the episode's only freeze for the episode's worst late landing.
   *
   * What was ACTUALLY wrong is the size of what happens in 44-148. The window
   * did carry three events (endToEnd 66, scopeNote 100, rowsRecede 132) — but
   * the whole lower half of the frame, the three change rows and their caption,
   * sat frozen from 16826 to 16979, and the only things moving were two thin
   * mono lines in a dead centre band. That is the r6b failure verbatim: real
   * reveals, too small to see.
   *
   * So the four events the grade asked for at f16900 / f16930 / f16960 / f16985
   * are delivered at those exact frames, off this step's playhead, each sized
   * past the ink floor rather than added as new clutter:
   *
   *   endToEnd    53 -> abs 16900   64px sans, 705 x 80  =  56,400px^2 = 2.72%
   *   scopeNote   83 -> abs 16930   56px mono, 1082 x 62 =  67,084px^2 = 3.23%
   *   rowsRecede 113 -> abs 16960   three 1420 x 70 rows = 298,200px^2 = 14.4%
   *   closingLine 138 -> abs 16985  76px sans, 1147 x 86 =  98,642px^2 = 4.76%
   *
   * (floor 1.5% = 31,104px^2 of the 2,073,600px^2 canvas; target 2.0% =
   * 41,472px^2. The smallest of the four clears the floor by 1.8x.)
   *
   * `closingLine` is not a new element — it is "no one change owns the win",
   * moved here from chip_vectorize local 56 (abs 16826), where it arrived while
   * the rows it summarises were still arriving and then sat still for 5.3s. It
   * now lands as what it is: the verdict, after the three rows have left.
   *
   * Starts: 0/4/22/24/53/83/113/138/182/226/272. Max gap 46f (1.53s), and
   * 24->53 is covered by the count-up and the compress both animating to 46.
   */
  const ghost = sub(p.bar_compress_countup, "bar_compress_countup", 0, 16);
  const compress = sub(p.bar_compress_countup, "bar_compress_countup", 4, 42);
  const morePrefix = sub(p.bar_compress_countup, "bar_compress_countup", 22);
  const countUp = sub(p.bar_compress_countup, "bar_compress_countup", 24, 22);
  const endToEnd = sub(p.bar_compress_countup, "bar_compress_countup", 53);
  // The scope caveat, 30 frames after the claim: the number reads first and the
  // scope reads immediately after — never the other way round, never omitted.
  const scopeNote = sub(p.bar_compress_countup, "bar_compress_countup", 83);
  // 18, not 38. This is an EXIT, so it is not bound by the 6-9f entrance band,
  // but it does have to finish before `closingLine` at 138 or the verdict fades
  // up through the rows it replaces. 113 + 18 = 131 leaves 7 frames of clean
  // frame between the two, which is what makes the swap read as one thing
  // becoming another rather than a cross-fade.
  const rowsRecede = sub(
    p.bar_compress_countup,
    "bar_compress_countup",
    113,
    18,
  );
  // The verdict on the three rows, re-homed out of chip_vectorize — see the
  // freeze arithmetic above. It is deliberately the last big-type moment of the
  // beat and it does NOT leave: the ledger lands under it, not over it.
  const closingLine = sub(p.bar_compress_countup, "bar_compress_countup", 138);
  const ledger = [
    sub(p.bar_compress_countup, "bar_compress_countup", 182, 12),
    sub(p.bar_compress_countup, "bar_compress_countup", 226, 12),
    sub(p.bar_compress_countup, "bar_compress_countup", 272, 12),
  ];

  // The bar is one object that changes length; it is never swapped for a second
  // bar. Everything that annotated the "before" state fades as it moves.
  const liveW = interpolate(compress, [0, 1], [BAR_W, AFTER_W]);
  // The slice is drawn INSIDE the bar, so it narrows with its parent and can
  // fade across the whole compress.
  const beforeEra = 1 - compress;
  // Its annotations cannot: text centred on a 700px slice would be left
  // stranded over black once the bar is 311px wide, so they clear in the first
  // 40% of the compress — an ~200ms ease-in exit, before the geometry moves out
  // from under them.
  const beforeLabels = clamp01((1 - compress) * 2.5);
  // The three rows leave COMPLETELY (not to 22%) because the ledger lands in
  // the lower third right after them; a ghost of the rows under the ledger
  // would read as two lists stacked on each other.
  const rowsGone = 1 - clamp01(rowsRecede);

  // Ambient only: a rack-room sized sway, no start and no end. Without it the
  // frames between sub-reveals are literally motionless.
  const swayX = Math.sin(frame / 104) * 3;
  const swayY = Math.cos(frame / 127) * 2;

  /**
   * Texture management: dark while the name lands, opens up on "national-lab
   * supercomputers" so the racks are the establishing shot for exactly the
   * phrase that earns them, then closes back down as the diagram takes over.
   *
   * PARTIAL ALPHA ONLY, and capped at 0.68 — this is a scrim, never a fill. It
   * darkens the b-roll and the global AmbientBackground behind it; it must
   * never reach 1, or the frame goes dead black with a 3px sway as the only
   * motion on screen. Range: 0.62 (naming) -> 0.34 (racks) -> 0.68 (diagram).
   *
   * REGRADED. The beat measured mean luma 36.34 — 2nd brightest in the episode
   * — and the docked kicker sat on a rack highlight at 3.07:1 during the lift.
   * Budget, as transmitted fraction of the raw plate at frame centre, where
   * BRoll's own gradient contributes `dim * 0.82`:
   *     base = 1 - 0.58 * 0.82 = 0.524
   *     naming  0.524 * 0.42 = 0.220   (was 0.215 — unchanged, it was fine)
   *     lift    0.524 * 0.66 = 0.346   (was 0.561 — this is the 3.07:1 fix)
   *     diagram 0.524 * 0.40 = 0.210   (was 0.347)
   * The lift highlight measured sRGB 0.27; at 0.346/0.561 of that it is 0.167,
   * so theme.dim (#8B949E, L 0.290) over it reads 4.62:1 — over the 4.5 target,
   * not merely over the 3:1 floor.
   *
   * r12 NOTE: the kicker no longer sits on a rack highlight at all — it is
   * knocked out of `PLATE` (see THE MASTHEAD), which is opaque enough at 0.58
   * to hold 6.91:1 regardless of what the b-roll does under it. The budget
   * above stays as-is because the CONTEXT LANES and the docked name are still
   * theme.dim over bare scrim and are what it was computed for. Do not read
   * the plates as a licence to reopen the scrim: at f16220 the whole frame's
   * brightest pixel was 126, so the b-roll cannot be made to carry lit area
   * without going through the text.
   *
   * DELIBERATELY NOT CRUSHED. three_rules answered the same defect with
   * dim 0.95 + a flat 0.5 sheet (~0.11 transmitted) and bought a dead layer:
   * 57.2% of its frames are byte-identical to the previous frame.
   *
   * ROUND-14 / D4 — DEEPENED, WITH THE ESTABLISHING SHOT HELD EXACTLY.
   * The r13 grade found the scrim across f15100-17100 too shallow: the racks
   * were competing with the foreground rather than sitting behind it as
   * texture, and by f16520 the beat is already at its old 0.60 cap and the
   * rack is still plainly readable. Re-solved as
   *     0.62 - 0.28 * brollLift + 0.34 * ease(barP),  capped 0.68
   * which moves the two ends and pins the middle:
   *     naming   0.62 -> 0.524 * 0.38 = 0.199   (was 0.220, -10%)
   *     lift     0.34 -> 0.524 * 0.66 = 0.346   (UNCHANGED — 0.62-0.28 = 0.34,
   *                                              so the 4.62:1 contrast fix
   *                                              above and the "racks are the
   *                                              establishing shot" moment are
   *                                              bit-for-bit what they were)
   *     diagram  0.68 -> 0.524 * 0.32 = 0.168   (was 0.210, -20%)
   * 0.168 is still 1.53x the 0.11 that killed three_rules' texture layer, so
   * the racks keep moving. The lit cost is real and paid for: the brightest
   * b-roll pixel in the diagram section drops from ~126 to ~101, i.e. below
   * the 110 lit gate, so the deepening is paired with the `half the total
   * runtime` paper band (6.77% of frame at luma ~163) that arrives in exactly
   * the window this darkens hardest. Deepening a window with nothing in front
   * of it is the failure mode this file is warned about.
   */
  const extraScrim = Math.min(
    0.68,
    clamp01(0.62 - 0.28 * brollLift + 0.34 * ease(barP)),
  );

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: SANS }}>
      <BrollWrap />
      {/* Partial-alpha scrim. NOT an opaque background — see extraScrim. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: theme.bg,
          opacity: extraScrim,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${swayX}px, ${swayY}px)`,
        }}
      >
        {/* ---- header: kicker, funder, name, context ----------------------
            Every line here is at or above the 56px mono floor, so the header
            restacks on 66-78px bands: kicker docks into masthead row 1 at 66
            (caps ~78-119), the letterhead is row 2 at 138 (caps ~150-191),
            name 214 (caps 222-269), and the two context lines share the name's
            band to its right — the name docks at 64px mono, 7 chars = 269px,
            so it ends at x 419.

            THE KICKER IS THE OPENING CARD AND IT IS PLATED. The beat used to
            open on 76px type over a scrimmed rack and measure 1.40% lit at
            f16135 while the episode median is 6.51% — the frame's brightest
            pixel at f16220 was 126. Knocked out of paper it opens at 5.85% and
            its DOCK lands on 4.15% instead of on 0.077%, which is what the
            r12 grade measured at f16215 and is the retire-cliff this file was
            manufacturing for itself: shrinking 76px ink into 56px dim mono
            with nothing else lit on screen. */}
        <BigDock
          inP={kickerIn}
          dockP={kickerDock}
          big={{ left: 440, top: KICKER_BIG_PLATE.top, size: 76 }}
          docked={{ left: 150, top: KICKER_DOCK_PLATE.top, size: MONO_SIZE }}
          wipeIn
          plate={{
            big: KICKER_BIG_PLATE,
            docked: KICKER_DOCK_PLATE,
            textWidth: 1014,
          }}
        >
          way past interview prep
        </BigDock>

        {/* ---- the letterhead band, written in two stages ------------------
            Drawn on rather than popped: it is the institution the code belongs
            to, spoken before the code has a name, so it reads as a letterhead
            under the kicker's docked row and above the title slot the name is
            about to dock into. Reads "Department of Energy", matching the
            narration word for word — the screen must not add a "U.S." the voice
            never says.

            THE PLATE IS THE REVEAL, and it is now bright enough to be one. It
            used to be `IDLE_FILL`; the r12 proxy measured that plate straddling
            the lit gate (f16290: >=90 = 4.40%, exactly the plate's own area;
            >=110 = 2.29%). At `PLATE` the whole 4.456% counts. Full arithmetic
            in THE MASTHEAD block. */}
        <div
          style={{
            position: "absolute",
            left: DOE_BAND.left,
            top: DOE_BAND.top,
            width: doeW,
            height: DOE_BAND.height,
            background: PLATE,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {/* The rule along the top edge — the actual letterhead stroke, and
              the masthead's only chromatic mark once the type is knocked out.
              It is INSIDE the plate, so it can never be scheduled ahead of the
              paper it is printed on and can never render as a bare warm bar. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: DOE_RULE_H,
              background: theme.warm,
            }}
          />
        </div>
        {/* BOUNDS: 20 mono chars at 56px = 676px, x 150 -> 826, inside W1's
            right edge at 870. Dark on paper: 6.91:1, up from the 3.60:1 warm
            type on IDLE_FILL used to read. */}
        <div
          style={{
            position: "absolute",
            left: 150,
            top: DOE_BAND.top,
            fontFamily: MONO,
            fontSize: MONO_SIZE,
            lineHeight: `${MAST_ROW_H}px`,
            letterSpacing: 0.5,
            color: theme.bg,
            whiteSpace: "nowrap",
            opacity: doeReveal > 0 ? 1 : 0,
            clipPath: `inset(0 ${(1 - doeReveal) * 100}% 0 0)`,
          }}
        >
          Department of Energy
        </div>
        {/* ...and what kind of code it is, on the same band, on its own words.
            BOUNDS: 12 mono chars at 56px = 406px, x 960 -> 1366, inside W2's
            right edge at 1518. */}
        <div
          style={{
            position: "absolute",
            left: PHYSICS_X,
            top: DOE_BAND.top,
            fontFamily: MONO,
            fontSize: MONO_SIZE,
            lineHeight: `${MAST_ROW_H}px`,
            letterSpacing: 0.5,
            color: theme.bg,
            whiteSpace: "nowrap",
            opacity: physicsReveal > 0 ? 1 : 0,
            clipPath: `inset(0 ${(1 - physicsReveal) * 100}% 0 0)`,
          }}
        >
          physics code
        </div>

        <BigDock
          inP={nameIn}
          dockP={nameDock}
          big={{ left: 696, top: 320, size: 110 }}
          docked={{ left: 150, top: 214, size: 64 }}
        >
          QMCPACK
        </BigDock>

        {/* Two lanes, not one line — see ContextChip. Read down the right
            column it is "QMCPACK / simulates electrons / on supercomputers",
            which is the sentence the narration says; read across the old
            single band it was "QMCPACK simulates electrons supercomputers".
            "on" is carried into lane 2 so the lane is a phrase on its own
            rather than a dangling noun.
            SHORTENED: "national-lab supercomputers" is 27ch = 913px at the
            floor and "national-lab" is already on screen as the Department of
            Energy letterhead, so the chip keeps the half it doesn't say. */}
        <ContextChip left={700} top={214} t={ctxElectrons}>
          simulates electrons
        </ContextChip>
        <ContextChip left={700} top={276} t={ctxSuper}>
          on supercomputers
        </ContextChip>

        {/* ---- the bar ----------------------------------------------------
            "total run time" is SOURCE [9]'s own phrase for the thing the kernel
            took half of, and it is what the narration says.
            BOUNDS: 14 mono chars at 56px = 473px, x 150 -> 623. It is now the
            ONLY thing on the y296 band — the result block moved down to the bar
            band, which is what un-collided it from the context lane above. */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: 296,
            fontFamily: MONO,
            fontSize: MONO_SIZE,
            lineHeight: LINE_H,
            color: theme.dim,
            whiteSpace: "nowrap",
            opacity: barLabel > 0 ? 1 : 0,
            clipPath: `inset(0 ${(1 - barLabel) * 100}% 0 0)`,
          }}
        >
          total run time
        </div>

        {/* Ghost of the pre-rewrite length. The compressed bar would otherwise
            be a number with nothing to be smaller THAN. */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: BAR_Y,
            width: BAR_W,
            height: BAR_H,
            border: `2px dashed ${theme.stroke}`,
            borderRadius: 8,
            // Full `ghost`, not `ghost * 0.9`. `theme.stroke` is 3.09:1 with
            // nothing to spare; the 0.9 put the before-length outline at
            // 2.62:1, under the floor for the one piece of geometry the
            // compressed bar has to be measured against.
            opacity: ghost,
          }}
        />
        {/* BOUNDS: 6 mono chars at 56px = 203px, x 1566 -> 1769. */}
        <div
          style={{
            position: "absolute",
            left: BAR_X + BAR_W + 16,
            top: BAR_Y + (BAR_H - 62) / 2,
            fontFamily: MONO,
            fontSize: MONO_SIZE,
            lineHeight: LINE_H,
            color: theme.dim,
            whiteSpace: "nowrap",
            opacity: ghost,
          }}
        >
          before
        </div>

        {/* The bar itself: draws to full width, then compresses. Its colour
            resolves from "mostly idle time" to solid as it becomes the after
            state, so the shrink is a change of state, not a new object. */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: BAR_Y,
            width: liveW * barDraw,
            height: BAR_H,
            backgroundColor: theme.accent,
            // 0.62 -> 0.92, not 0.40 -> 0.92. `theme.accent` at 0.40 measures
            // 1.81:1 on black: the beat's single largest object — a 1400x78
            // bar, 5.3% of frame — spent its whole "before" life under the
            // contrast floor. 0.62 is the alpha at which accent reaches 3.33:1,
            // and the resolve to solid still reads (3.33:1 -> 7.04:1).
            opacity: interpolate(compress, [0, 1], [0.62, 0.92]),
            borderRadius: 8,
          }}
        />

        {/* The kernel slice, wiped in from the bar's left edge. It is drawn
            INSIDE the bar, so at compress time it narrows with its parent and
            fades — the paper does not give the kernel's post-rewrite share and
            this scene must not imply one. */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: BAR_Y,
            width: KERNEL_W * sliceFill * (liveW / BAR_W),
            height: BAR_H,
            backgroundColor: theme.down,
            opacity: 0.92 * beforeEra,
            borderRadius: 8,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: BAR_Y + (BAR_H - 62) / 2,
            width: KERNEL_W,
            textAlign: "center",
            fontSize: SANS_SIZE,
            fontWeight: 800,
            letterSpacing: -1,
            lineHeight: LINE_H,
            color: theme.ink,
            opacity: clamp01(sliceCount * 2) * beforeLabels,
          }}
        >
          up to {Math.round(50 * sliceCount)}%
        </div>

        {/* Brackets, never rings — house rule bans circle/ring annotations. */}
        <svg
          width={1920}
          height={1080}
          viewBox="0 0 1920 1080"
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          {/* `draw` and `fade` are separate on purpose: folding the exit into
              the dash offset would make these UN-draw right-to-left while the
              things they point at are fading, which reads as a glitch rather
              than as an exit. */}
          <DrawnPath
            d={`M ${BAR_X} 466 L ${BAR_X} 482 L ${BAR_X + KERNEL_W} 482 L ${BAR_X + KERNEL_W} 466`}
            draw={sliceBracket}
            fade={beforeLabels}
            color={theme.warm}
            width={3}
          />
          {/* Vertical brace tying the three stacked changes together. x 158 is
              inside the 115 left bound; the rows begin at x 190. */}
          <DrawnPath
            d={`M 176 ${BRACE_TOP} L 158 ${BRACE_TOP} L 158 ${BRACE_BOTTOM} L 176 ${BRACE_BOTTOM}`}
            draw={bundleBrace}
            fade={rowsGone}
            color={theme.warm}
            width={3}
          />
        </svg>

        {/* BOUNDS: 10 mono chars at 56px = 338px centred on the 700px slice,
            so x 331 -> 669. Sits under the bracket (ends y 482). */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: 492,
            width: KERNEL_W,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: MONO_SIZE,
            lineHeight: LINE_H,
            color: theme.warm,
            whiteSpace: "nowrap",
            opacity: popOpacity(sliceLabel) * beforeLabels,
            transform: `translateY(${(1 - popOpacity(sliceLabel)) * 6}px)`,
          }}
        >
          one kernel
        </div>

        {/* ---- ROUND-14 / D3: the sentence's payload, on its own word ------
            "half the total runtime" knocked out of paper in the empty lower
            half — the beat's masthead idiom at a bigger register. Full
            arithmetic, word sync, luma and bounds are on `halfBandIn` above.
            It is a plate holding its own text, revealed by one linear clip, so
            it can never render as an empty container; and it retires five
            frames before the rewrite header wants the same band. */}
        {halfBandIn > 0 && halfBandOut < 1 && (
          <div
            style={{
              position: "absolute",
              left: 150,
              top: 580,
              width: 1080,
              height: 130,
              borderRadius: 8,
              background: PLATE,
              // In from the left, out from the left. Constant height, so the
              // painted AREA advances linearly with the clip — no sqrt().
              clipPath: `inset(0 ${100 * (1 - halfBandIn)}% 0 ${100 * halfBandOut}%)`,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 40,
                top: 0,
                fontFamily: MONO,
                fontSize: 68,
                lineHeight: "130px",
                color: theme.bg,
                whiteSpace: "nowrap",
              }}
            >
              half the total runtime
            </div>
          </div>
        )}

        {/* ---- the result, in the space the bar vacated -------------------
            OVERPRINT FIX. "more than" used to sit at top 296 — the SAME band as
            "total run time" (x150-623) AND under the `on supercomputers`
            context lane, whose line box is y276-338 and which runs x700-1275.
            For ~7.5s the frame rendered `total run time  mo·on
            supercomputers·an`. The context lanes are load-bearing (they are the
            sentence "QMCPACK / simulates electrons / on supercomputers"), so
            the RESULT moved instead: the whole block now reads left-to-right
            ALONG the vacated bar band, "more than  4.5x", and the y296 band
            belongs to the bar label alone.
            BOUNDS: "more than" 9 mono chars = 304px, x 680-984, caps y 402-443.
            The number at left 1030 (46px of air) is ~180px wide at 80px sans,
            x 1030-1210, caps y 387-443 — baseline-matched to the mono, and
            clear of the ghost's dashed rules (y376-378, y452-454) by 9px, so
            nothing strikes through the one number the beat exists to deliver.
            Both strings are inside the shrinking bar's former footprint on
            purpose: the bar's right edge has already passed them (x1030 at
            local 13, x680 at local 21) before either fades in. */}
        <div
          style={{
            position: "absolute",
            left: 680,
            top: 392,
            fontFamily: MONO,
            fontSize: MONO_SIZE,
            lineHeight: LINE_H,
            color: theme.dim,
            whiteSpace: "nowrap",
            opacity: popOpacity(morePrefix),
            transform: `translateY(${(1 - popOpacity(morePrefix)) * 6}px)`,
          }}
        >
          more than
        </div>
        <div
          style={{
            position: "absolute",
            left: 1030,
            top: BAR_Y + (BAR_H - 80) / 2,
            fontSize: 80,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: "80px",
            color: theme.accent,
            whiteSpace: "nowrap",
            opacity: clamp01(countUp * 3),
            transformOrigin: "left center",
            transform: `scale(${popScale(clamp01(countUp * 2.5))})`,
          }}
        >
          {/* Counts from 1.0 (no change) rather than 0 — a speedup of zero is
              not a thing, and starting at parity makes the ramp mean something. */}
          {(1 + (SPEEDUP - 1) * countUp).toFixed(1)}&times;
        </div>
        {/* 680, flush with "more than": the 80px number no longer sits above
            these lines (it moved onto the bar band beside its prefix), so the
            old 4px optical kick against it is gone and the result block shares
            one left edge.
            r7 INK: this was 56px MONO — 642 x 62 = 39,804px^2, a thin dim
            strand in the middle of the frame, and it was the first of the two
            events inside the measured freeze window. It is now 64px SANS BOLD
            (TYPE.body, cap 45 — above the 40 floor and above the 58px sans
            floor), which both makes it the payoff PHRASE beside the payoff
            NUMBER in the same family, and clears the ink budget:
              19ch x 37.1 = 705 wide, 80px line box = 56,400px^2 = 2.72%.
            BOUNDS: x 680 -> 1385, box y 462-542 — under the ghost's lower rule
            (y454) by 8px and clear of the scope note below. */}
        <div
          style={{
            position: "absolute",
            left: 680,
            top: 462,
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: -0.3,
            lineHeight: "80px",
            color: theme.ink,
            whiteSpace: "nowrap",
            opacity: endToEnd > 0 ? 1 : 0,
            clipPath: `inset(0 ${(1 - endToEnd) * 100}% 0 0)`,
          }}
        >
          faster &mdash; end to end
        </div>
        {/* The scope caveat. SOURCE [9] says "greater than 4.5x speedup of
            miniQMC on KNL", from this work "combined with our current efforts of
            optimizing other QMC kernels". A bare "4.5x — end to end" over a bar
            labelled as total run time lets a viewer read that as the full
            production application, which the paper does not support, so the
            scope goes on screen under the number rather than nowhere.
            It is at the 56px floor like everything else (it was 20px, then
            40px — both under the floor, which is exactly how a caveat gets
            read as fine print and skipped).
            It is at the 56px floor like everything else, and at 32ch x 33.8 =
            1082 wide in a 62px box it is 67,084px^2 = 3.23% of frame — the
            widest single line in the beat, so the second event in the freeze
            window carries real ink without being re-typeset.
            MOVED 532 -> 544 to make room for the enlarged 64px payoff phrase
            above (its box now ends at y542).
            r7 GRAMMAR: rises into place instead of wiping, so it does not
            repeat the wipe that lands 30 frames earlier at f16900.
            BOUNDS: caps y 554-595, descenders clear at 612 — level with the
            rewrite header's box top and 10px above its caps (622) — and the
            docked citation is at x1264+, while this line ends at x1762. */}
        <div
          style={{
            position: "absolute",
            left: 680,
            top: 544,
            fontFamily: MONO,
            fontSize: MONO_SIZE,
            lineHeight: LINE_H,
            color: theme.dim,
            whiteSpace: "nowrap",
            opacity: popOpacity(scopeNote),
            transform: `translateY(${(1 - popOpacity(scopeNote)) * 10}px)`,
          }}
        >
          {SCOPE_NOTE}
        </div>

        {/* ---- the rewrite: three changes, braced --------------------------
            SHORTENED: "a data-layout rewrite — three changes" is 37 chars =
            1251px at the floor, x 150 -> 1401, which crosses the receipt panel
            at x 1258. Both nouns that carry the caveat survive.
            BOUNDS: 27 mono chars at 56px = 913px, x 150 -> 1063; caps y
            622-663, clear of the scope note above (descends to 600) and the
            first change row below (caps from 710). */}
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 612,
            fontFamily: MONO,
            fontSize: MONO_SIZE,
            lineHeight: LINE_H,
            color: theme.dim,
            whiteSpace: "nowrap",
            opacity: (rewriteHeader > 0 ? 1 : 0) * rowsGone,
            clipPath: `inset(0 ${(1 - rewriteHeader) * 100}% 0 0)`,
          }}
        >
          data-layout &mdash; three changes
        </div>

        {CHANGES.map((c, i) => (
          <ChangeRow
            key={c.title}
            top={ROW_Y + i * ROW_PITCH}
            n={i + 1}
            title={c.title}
            sub={c.sub}
            t={rowIn[i]}
            gone={rowsGone}
            grammar={ROW_GRAMMAR[i]}
          />
        ))}

        {/* The verdict on the three rows. It used to live at y934 in 56px mono,
            up at chip_vectorize local 56 (abs 16826) — 165 frames before the
            end of the measured freeze, and gated by `rowsGone`, so it died with
            the thing it was commenting on and the last second of the beat's
            lower half carried nothing at all.
            It now takes the band the rows VACATE, at f16985, in 76px sans:
              26ch x 44.1 = 1147 wide, 86px line box = 98,642px^2 = 4.76%.
            That is a register change as well as an ink change — big type once,
            at the end of the argument, before the ledger goes quiet under it.
            BOUNDS: x 190 -> 1337, box y 700-786; the 76px descenders bottom out
            at y785 and ledger row 1's caps start at y796. Not gated by
            `rowsGone`: it arrives 7 frames AFTER the rows are fully clear. */}
        <div
          style={{
            position: "absolute",
            left: ROW_X,
            top: ROW_Y,
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -1,
            lineHeight: "86px",
            color: theme.warm,
            whiteSpace: "nowrap",
            opacity: popOpacity(closingLine),
            transformOrigin: "left center",
            transform: `scale(${popScale(closingLine)})`,
          }}
        >
          no one change owns the win
        </div>

        {/* ---- the dry punchline, as a ledger of what did and didn't move --
            Caps 796-1004, inside the 1015 bottom bound. This band and the
            change stack's band overlap in SPACE (rows now run 700-934), but
            never in TIME: rowsRecede runs 113-131 and ledger[0] does not start
            until 182, so there are 51 clear frames between the last row leaving
            and the first ledger row arriving. The swap reads as one list
            becoming another, which is what it is.
            The verdict line at y700-786 stays up THROUGH the ledger — it is the
            heading this list sits under, and it is what keeps the lower third
            from settling to a single static block at the end of the beat.
            SHORTENED: "where the numbers sat" is 21ch = 710px at the floor and
            would run into the value column. */}
        <LedgerRow
          top={786}
          t={ledger[0]}
          label="the physics"
          value="unchanged"
        />
        <LedgerRow
          top={862}
          t={ledger[1]}
          label="the electrons"
          value="unchanged"
        />
        <LedgerRow
          top={938}
          t={ledger[2]}
          label="where numbers sat"
          value="moved"
          hot
        />

        {/* ---- the citation, typeset in-engine -----------------------------
            Inside the sway wrapper, not outside it. Parked outside, it was the
            one element in the frame that did not drift, which reads as a
            pasted overlay next to content that does.

            UNDOCK / DOCK, unchanged as a grammar — but there is no longer an
            image to scale, so nothing here is ever below the mono floor. Three
            lines wipe on in the empty mid-frame; when the bar needs that space
            the title and byline leave and the arXiv ID travels to the corner
            and stays. Position is tweened; SIZE NEVER IS, because a size tween
            is exactly how the old panel's caption fell to 26px. */}
        <CiteLine t={citeTitle} left={CITE_X} top={CITE_Y} gone={citeGone} lit>
          {CITE_TITLE}
        </CiteLine>
        <CiteLine
          t={citeAuthors}
          left={CITE_X}
          top={CITE_Y + CITE_PITCH}
          gone={citeGone}
        >
          {CITE_AUTHORS}
        </CiteLine>
        <CiteLine
          t={citeId}
          left={interpolate(receiptDock, [0, 1], [CITE_X, CITE_DOCK_X])}
          top={interpolate(
            receiptDock,
            [0, 1],
            [CITE_Y + 2 * CITE_PITCH, CITE_DOCK_Y],
          )}
        >
          {CITE_ID}
        </CiteLine>
      </div>
    </div>
  );
};

/** A plate rectangle. Both ends of a dock, in absolute composition pixels. */
type PlateRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * A keyword that owns the frame and then becomes a label — it never vanishes.
 * Both the kicker and the product name use this, which is why they can share the
 * centre slot: the first has already docked to the header before the second
 * arrives. `wipeIn` swaps the entrance grammar to a mask wipe so the two
 * consecutive big-type moments do not enter identically.
 *
 * `plate` KNOCKS THE TYPE OUT OF PAPER instead of setting it in ink, and it is
 * the whole answer to the r12 D6 defect (see THE MASTHEAD). A 76px word is
 * ~0.5% of frame in glyph ink; the 1094 x 120 card it is knocked out of is
 * 6.33%, and its docked 1400 x 66 row is 4.46%. Same words, same dock, an order
 * of magnitude more lit area — bought by making a thing LARGER and running it
 * at luma 148, never by making thin strokes brighter.
 *
 * Two structural rules the plate has to keep:
 *  - The plate carries its own type. A card that can render before its words is
 *    an empty bordered box, which is invisible to every automated gate and is
 *    exactly the "grader PASSed it, the human eye says slop" failure. Here the
 *    same `inP` drives both, and the type is clipped BY THE PLATE'S PAINTED
 *    EDGE, so the words can never lead the paper.
 *  - The wipe is driven through sqrt(t). A left-to-right clipPath on a fixed
 *    width paints area as width^2, so a linear time curve would open slowly and
 *    miss the single-frame burst gate; sqrt(t) makes AREA advance linearly.
 *    6.331% over its 9-frame window = 0.703%/frame, past the 0.3% gate 2.3x
 *    over, and `areaPct * 6 / dur` = 6.331 * 6 / 9 = 4.22 >= 2.0.
 */
const BigDock: React.FC<{
  inP: number;
  dockP: number;
  big: { left: number; top: number; size: number };
  docked: { left: number; top: number; size: number };
  wipeIn?: boolean;
  plate?: { big: PlateRect; docked: PlateRect; textWidth: number };
  children: React.ReactNode;
}> = ({ inP, dockP, big, docked, wipeIn = false, plate, children }) => {
  const d = clamp01(dockP);
  const enter = wipeIn ? clamp01(inP) : popOpacity(inP);
  // Family/weight/tracking/colour cannot tween, so they snap once. The snap is
  // deliberately at d = 0.5 — mid-flight, where the element is moving fastest
  // and the change is masked by the motion. Snapping near the end (d ~ 0.9)
  // puts a visible reflow on an almost-stationary word.
  const asLabel = d > 0.5;
  // AREA-linear wipe. Only meaningful while the plate is still entering, which
  // is strictly before the dock begins, so it is measured against the big rect.
  const paintedW = plate ? Math.sqrt(clamp01(inP)) * plate.big.width : 0;
  // Where the type sits inside the paper, so the clip can follow the edge.
  const padX = plate ? big.left - plate.big.left : 0;
  const textReveal = plate
    ? clamp01((paintedW - padX) / plate.textWidth)
    : enter;
  return (
    <>
      {plate ? (
        <div
          style={{
            position: "absolute",
            left: interpolate(d, [0, 1], [plate.big.left, plate.docked.left]),
            top: interpolate(d, [0, 1], [plate.big.top, plate.docked.top]),
            width: interpolate(
              d,
              [0, 1],
              [plate.big.width, plate.docked.width],
            ),
            height: interpolate(
              d,
              [0, 1],
              [plate.big.height, plate.docked.height],
            ),
            background: PLATE,
            borderRadius: 6,
            opacity: inP > 0 ? 1 : 0,
            clipPath: `inset(0 ${(1 - Math.sqrt(clamp01(inP))) * 100}% 0 0)`,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: interpolate(d, [0, 1], [big.left, docked.left]),
          top: interpolate(d, [0, 1], [big.top, docked.top]),
          fontFamily: asLabel ? MONO : SANS,
          fontWeight: asLabel ? 400 : 800,
          fontSize: interpolate(d, [0, 1], [big.size, docked.size]),
          letterSpacing: asLabel ? 0.5 : -2,
          // Plated type is vertically centred in its row by the line box, so the
          // caller only ever positions the paper. Unplated type keeps lineHeight
          // 1 and is positioned by its own top, exactly as before.
          lineHeight: plate
            ? `${interpolate(d, [0, 1], [plate.big.height, plate.docked.height])}px`
            : 1,
          color: plate ? theme.bg : asLabel ? theme.dim : theme.ink,
          opacity: wipeIn ? (inP > 0 ? 1 : 0) : enter,
          transform: wipeIn ? "none" : `scale(${popScale(inP)})`,
          transformOrigin: "left center",
          clipPath: wipeIn
            ? `inset(0 ${(1 - textReveal) * 100}% 0 0)`
            : undefined,
          whiteSpace: "nowrap",
          // No glow on knocked-out type: a black shadow under black glyphs on
          // paper is invisible at best and a smudge at worst.
          textShadow: asLabel || plate ? "none" : `0 4px 28px ${theme.bg}`,
        }}
      >
        {children}
      </div>
    </>
  );
};

/**
 * Mono annotation hanging off the product name — what the code is, in the
 * caller's words. MONO_SIZE, the annotation floor.
 *
 * DE-COLLIDED. Both chips used to share `top: 220` with the docked name's
 * band (top 214), so QMCPACK + two chips rendered as one 1643px line that
 * READ as a sentence: "QMCPACK simulates electrons supercomputers". Three
 * separate captions, one garbled line. `top` is now the caller's, and the
 * two chips take their own 62px lanes as a hanging indent under the name.
 *
 * BOUNDS at 56px mono (33.8px/char), both chips at left 700:
 *   lane 1, top 214: "simulates electrons"  19ch = 642px -> x 700-1342
 *   lane 2, top 276: "on supercomputers"    17ch = 575px -> x 700-1275
 * Lane 1 shares the name's band, but the name is 7 chars of 64px mono ending
 * at x 419, so there is 281px of gutter and it reads as a two-column header,
 * not a sentence.
 *
 * LANE 2's OVERPRINT IS FIXED AT THE OTHER END. Its line box is y276-338,
 * which shares ink-space with the y296 band (boxes y296-358). "total run time"
 * lives there at x150-623 and cleared it by 77px — but "more than" ALSO lived
 * there, at x680-984, straight through this lane's x700-1275, and the frame
 * rendered `total run time  mo·on supercomputers·an` for ~7.5s. The lanes are
 * the sentence the narration says, so the RESULT BLOCK moved (to the bar band,
 * y392/y375) rather than these. NOTHING may be placed on the y296 band right
 * of x623 again. Both lanes end well inside the 1805 safe edge; any longer
 * string MUST be re-measured before it ships.
 */
const ContextChip: React.FC<{
  left: number;
  top: number;
  t: number;
  children: React.ReactNode;
}> = ({ left, top, t, children }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      fontFamily: MONO,
      fontSize: MONO_SIZE,
      lineHeight: LINE_H,
      color: theme.dim,
      whiteSpace: "nowrap",
      opacity: popOpacity(t),
      transform: `translateX(${(1 - popOpacity(t)) * -12}px)`,
    }}
  >
    {children}
  </div>
);

/**
 * One line of the paper citation, natively set at the mono floor. Mask wipe in,
 * opacity out — `gone` is the caller's exit so the two lines that don't survive
 * the dock can leave while the third travels.
 */
const CiteLine: React.FC<{
  t: number;
  left: number;
  top: number;
  /** 1 = present. Defaults to 1 for the line that stays. */
  gone?: number;
  /** The title line is ink; the byline and the ID are dim. */
  lit?: boolean;
  children: React.ReactNode;
}> = ({ t, left, top, gone = 1, lit = false, children }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      fontFamily: MONO,
      fontSize: MONO_SIZE,
      lineHeight: LINE_H,
      letterSpacing: 0.5,
      color: lit ? theme.ink : theme.dim,
      whiteSpace: "nowrap",
      opacity: t > 0 ? clamp01(gone) : 0,
      clipPath: `inset(0 ${(1 - clamp01(t)) * 100}% 0 0)`,
    }}
  >
    {children}
  </div>
);

/** SVG stroke that draws itself. pathLength=1 normalises every path so one
 *  0..1 progress drives strokes of different spans identically. */
const DrawnPath: React.FC<{
  d: string;
  draw: number;
  /** Exit opacity, kept out of `draw` so leaving is a fade, not a rewind. */
  fade?: number;
  color: string;
  width: number;
}> = ({ d, draw, fade = 1, color, width }) => (
  <path
    d={d}
    fill="none"
    stroke={color}
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    pathLength={1}
    strokeDasharray="1 1"
    strokeDashoffset={1 - clamp01(draw)}
    opacity={draw > 0 ? 0.85 * clamp01(fade) : 0}
  />
);

/**
 * One of the three bundled changes. Numbered, because the count IS the point —
 * the viewer has to be able to see that three things happened at once and that
 * no single one of them can be handed the 4.5x.
 *
 * A LINE, not a card. At the 56px floor a three-across card row cannot hold its
 * own type ("struct of arrays" alone is 541px, wider than a 350px card's whole
 * outer width), and PLAYBOOK's variety rule says cards are containers for
 * annotations, not the show.
 *
 * r7: A FULL-WIDTH SPEC LINE, not a packed strand. The old row was a flex run
 * of four short spans that all crowded into x190-1225 and left the right two
 * thirds of the band empty — 3.1% of frame by bounding box, but perceptually a
 * thin line of type down in one corner, which is the r6b invisible-reveal
 * failure. The sub now flushes RIGHT at x1610 with a dotted leader carrying the
 * eye across, so each row lights up 1420 x 70 = 99,400px^2 = 4.79% of frame
 * when it lands, and 14.4% when all three leave together at f16960.
 *
 * The leader is a hairline rule, not a filled bar — a grey rounded bar in this
 * band would read as an unloaded UI skeleton, which is the one thing a
 * three-row stack must never look like.
 *
 * The em-dash separator is gone: the leader does that job, and at these widths
 * a floating dash mid-gutter read as a stray hyphen.
 *
 * BOUNDS, worst case per column (the longest title and the longest sub are on
 * different rows, so this is deliberately not a single-row sum):
 *   left  numeral 46 + gap 18 + "cache blocking" 58px sans bold 470 -> x 724
 *   right "struct of arrays" 56px mono 541, flushed to 1610      -> x 1069
 * 345px of leader between them at the tightest, and the right edge is 194px
 * inside the 1804 safe margin.
 */
const ChangeRow: React.FC<{
  top: number;
  n: number;
  title: string;
  sub: string;
  t: number;
  gone: number;
  grammar: (typeof ROW_GRAMMAR)[number];
}> = ({ top, n, title, sub: subLine, t, gone, grammar }) => {
  const o = popOpacity(t);
  const w = clamp01(t);
  return (
    <div
      style={{
        position: "absolute",
        left: ROW_X,
        top,
        width: ROW_W,
        height: ROW_LH,
        display: "flex",
        alignItems: "center",
        gap: 18,
        whiteSpace: "nowrap",
        opacity: (grammar === "wipe" ? (t > 0 ? 1 : 0) : o) * gone,
        transformOrigin: "left center",
        transform:
          grammar === "slide"
            ? `translateX(${(1 - o) * -24}px)`
            : grammar === "pop"
              ? `scale(${popScale(t)})`
              : "none",
        clipPath:
          grammar === "wipe" ? `inset(0 ${(1 - w) * 100}% 0 0)` : undefined,
      }}
    >
      <span
        style={{
          fontSize: 76,
          fontWeight: 800,
          letterSpacing: -1,
          lineHeight: `${ROW_LH}px`,
          color: theme.warm,
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: SANS_SIZE,
          fontWeight: 700,
          letterSpacing: -0.5,
          lineHeight: `${ROW_LH}px`,
          color: theme.ink,
        }}
      >
        {title}
      </span>
      {/* Hairline leader, not a bar. `flex: 1` is what flushes the sub right
          and is therefore what makes the row full-width. */}
      <span
        style={{
          flex: 1,
          height: 0,
          borderTop: `2px dotted ${theme.stroke}`,
        }}
      />
      <span
        style={{
          fontFamily: MONO,
          fontSize: MONO_SIZE,
          lineHeight: `${ROW_LH}px`,
          color: theme.dim,
        }}
      >
        {subLine}
      </span>
    </div>
  );
};

/**
 * The punchline, itemised. The dry line lands better against a list that is two
 * thirds "unchanged" — the one row that moved is the only thing in the accent
 * colour, so the joke reads before the sentence finishes.
 * BOUNDS at 56px mono (33.8px/char): longest label "where numbers sat" is 17 chars
 * = 575px from the row's x 198, ending at x 773; the value column starts at
 * x 810 and the longest value "unchanged" (9ch = 305px) ends at x 1115 — clear
 * of the receipt panel at x 1257.
 */
const LedgerRow: React.FC<{
  top: number;
  t: number;
  label: string;
  value: string;
  hot?: boolean;
}> = ({ top, t, label, value, hot = false }) => {
  const o = popOpacity(t);
  return (
    <div
      style={{
        position: "absolute",
        left: 150,
        top,
        opacity: o,
        transform: `translateX(${(1 - o) * -14}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 30,
          width: hot ? 30 : 16,
          height: 4,
          backgroundColor: hot ? theme.accent : theme.stroke,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 48,
          top: 0,
          fontFamily: MONO,
          fontSize: MONO_SIZE,
          lineHeight: LINE_H,
          color: hot ? theme.ink : theme.dim,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: "absolute",
          left: 660,
          top: 0,
          fontFamily: MONO,
          fontWeight: hot ? 700 : 400,
          fontSize: MONO_SIZE,
          lineHeight: LINE_H,
          color: hot ? theme.accent : theme.dim,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
};
