import React from "react";
import { Easing, interpolate } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import {
  theme,
  TYPE,
  MIN_MONO_FONT_SIZE,
  MIN_SANS_FONT_SIZE,
  EXIT_FRAMES,
  ENTRANCE_MAX_FRAMES,
} from "../../components/theme";

// Loaded here rather than inherited: E005Lab sets the page font to system-ui,
// so a scene that relies on inheritance renders in a different face in the lab
// than in the episode — and the point of the lab is that what you scrub is what
// you ship.
const inter = loadInter("normal", {
  weights: ["500", "700", "900"],
  subsets: ["latin"],
});
const mono = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
const SANS = inter.fontFamily;
const MONO = mono.fontFamily;

/** Build steps, named exactly as in this beat's `build:` list in script.yaml. */
export type HookRaceStep =
  | "code_panels"
  | "race_bars"
  | "left_done"
  | "stamp_90x"
  | "on_chips"
  | "dim_to_stall";

export const HOOK_RACE_STEPS: HookRaceStep[] = [
  "code_panels",
  "race_bars",
  "left_done",
  "stamp_90x",
  "on_chips",
  "dim_to_stall",
];

/** timing.json: this beat is [0, 705); `whiteboard_world` starts at 705. */
const BEAT_FRAMES = 705;

/**
 * THE ramp windows this scene is choreographed against — ONE table, exported,
 * so the component and the assembler cannot silently disagree.
 *
 * The previous version of this file published these numbers in a doc comment
 * and then re-typed the interesting ones as literals further down (`RACE_TAIL`
 * derived from a hand-written 46, `TAIL_SPANS` from hand-written 78/47/195/88).
 * Nothing enforced the match, so a re-plan in Episode005.tsx would have moved
 * the picture while leaving the race arithmetic pointing at the old cut.
 * Everything timing-shaped below is now derived from this object.
 *
 * The windows OVERLAP on purpose (race_bars starts at 14 while code_panels runs
 * to 36) — a step's ramp runs to the next step's start plus a short cross-fade
 * tail, which is exactly what `schedule()` in Episode005.tsx produces.
 *
 * ASSEMBLER CONTRACT: give each step the relative weight in `HOOK_RACE_NOMINAL`
 * (import it — do not re-type it) and pin `stamp_90x` to the `ninetyx` mark.
 * That is what beat 1's plan does today, and it yields these ABSOLUTE ramps:
 *
 *   code_panels    0 ->  21     race_bars     19 ->  38
 *   left_done     36 ->  48     stamp_90x     47 ->  82   (mark `ninetyx` @50)
 *   on_chips      79 -> 196     dim_to_stall 188 -> 713
 *
 * Sub-reveals below are scheduled in STEP frames via `sub()` (the same helper
 * shape as TrickQuestion.tsx). Step frames map to episode frames by the ratio
 * between a step's actual ramp and its nominal length; every call is annotated
 * with the episode frame it lands on and the word it lands under, so the
 * 2-3-second rule can be audited by reading the source.
 */
export const HOOK_RACE_WINDOWS: Record<
  HookRaceStep,
  { readonly from: number; readonly to: number }
> = {
  code_panels: { from: 0, to: 36 }, // panels are up inside 1.2s
  race_bars: { from: 14, to: 46 }, // tracks draw on, counters climb
  left_done: { from: 38, to: 58 }, // loop A's bar COMPLETES, then DONE lands
  stamp_90x: { from: 47, to: 78 }, // entrance starts 3f BEFORE the mark at 50
  on_chips: { from: 88, to: 195 }, // "byte for byte / same length / big O of n"
  dim_to_stall: { from: 200, to: BEAT_FRAMES }, // the whole back half
};

/** Window LENGTHS — the `w` weights beat 1's plan must use. Derived, not typed. */
export const HOOK_RACE_NOMINAL = Object.fromEntries(
  HOOK_RACE_STEPS.map((s) => [
    s,
    HOOK_RACE_WINDOWS[s].to - HOOK_RACE_WINDOWS[s].from,
  ]),
) as Record<HookRaceStep, number>;

export interface HookRaceProps {
  /** 0..1 per step; absent = 0 = not started. Caller maps timing.json marks. */
  p: Partial<Record<HookRaceStep, number>>;
  /** Absolute frame, for idle micro-motion ONLY. Everything else is progress-driven. */
  frame?: number;
}

/**
 * The hook. 705 frames, one mark (`ninetyx` at 50).
 *
 * What this scene must NOT do is answer the question. No cache, no memory grid,
 * no latency ladder, and no ns/element figures — that receipt belongs to beat
 * 10. The two panels are byte-identical on purpose: the difference that causes
 * the 90x is deliberately not on screen yet.
 *
 * ENTRANCE GRAMMARS, in order of first appearance: mask wipe (panels, code
 * lines, byte chips, both command lines, the gap ghost), line draw-on (tracks,
 * stamp rule, brace, gap bracket), count-up (both counters), spring pop (DONE
 * badge, the O(n) chips, "waiting"), stamp-land (the 90x compresses in from
 * oversized), dock (the 90x shrinks into loop B's badge slot; loop A collapses
 * to a verdict card), camera move (the lane reframe, then loop A's exit), morph
 * (loop B's O(n) chip flies up and BECOMES the notation chip; the notation
 * caption crossfades in place). Eight kinds, none fired more than twice in a row.
 *
 * BOUNDS. Safe box is x [115,1805], y [65,1015]; every literal below is checked
 * against it with the ambient drift (+-4px x, +-3px y) already spent. Mono
 * advance is 0.6em, so an N-character string at size S is 0.6*N*S wide.
 *
 * READABILITY. The code panel — listing, title, byte chip, O(n) chip — is set
 * at `MIN_MONO_FONT_SIZE` (56px font-size = 40.9px CAP height), the floor token
 * from the type scale. It used to be 26px, an 18px cap: less than half the
 * floor, and on a phone the panels were grey texture rather than code. Since
 * the hook's entire claim is that the two listings are identical, a listing
 * nobody can read is the whole beat failing, so the CONTENT was cropped to four
 * lines to fit the floor rather than the type shrunk to fit nine.
 *
 * The one place a lane is ever scaled down (loop A's dock at 0.58) fades the
 * code, the chips, the title and the counter OUT rather than shrinking them
 * into illegibility, replacing them with a full-size verdict card.
 */

/**
 * The nominal frame at which loop A's bar reaches 100% — the end of `race_bars`,
 * which is also where `left_done`'s fill sub-stage finishes. It is ONLY used to
 * set the crawl rate of the losing bar (see RACE_TAIL); reading it off the
 * shared window table is what stops that rate from drifting away from the
 * picture the way a hand-typed 46 did.
 */
const LOOP_A_DONE_FRAME = HOOK_RACE_WINDOWS.race_bars.to;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });
const easeIn = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.in(Easing.cubic) });

/**
 * Snappy entrance length, in STEP frames. 8 sits mid-band of the 6-9f rule.
 * RAMP FAST, THEN HOLD: a step that owns 505 frames does not fade in over 505
 * frames, it fires ~20 sub-events of 8-16 frames each and holds between them.
 */
const ENTER = 8;

/**
 * Sub-reveal scheduler — same shape as TrickQuestion.tsx's `sub()`. `at`/`dur`
 * are FRAMES from the start of the step, measured against the step's NOMINAL
 * length, so the storyboard survives a re-plan of the beat.
 */
const sub = (
  v: number | undefined,
  step: HookRaceStep,
  at: number,
  dur: number = ENTER,
) => ease((clamp01(v ?? 0) * HOOK_RACE_NOMINAL[step] - at) / dur);

/** Exits are ease-IN and shorter than entrances — they get out of the way. */
const subOut = (
  v: number | undefined,
  step: HookRaceStep,
  at: number,
  dur: number = ENTER,
) => easeIn((clamp01(v ?? 0) * HOOK_RACE_NOMINAL[step] - at) / dur);

/**
 * The LINEAR sibling of `sub`, for anything that drives a `clipPath` wipe.
 *
 * PRODUCTION-LESSONS, "A RAMP IS NOT AN EVENT": an ease-out opens at 3/N of the
 * average rate and then decays, so a reveal shaped by `ease()` puts most of its
 * area change into its first two frames and dribbles the rest — which is fine
 * for a translate but wrong for a wipe, where the whole point is that AREA
 * advances at a constant rate and every frame of the reveal clears the
 * detector's 0.3%-in-one-frame gate rather than only the first.
 *
 * The wipes in this file are rectangles growing along one axis, so linear time
 * IS linear area; the `sqrt(t)` correction the lesson describes applies to
 * wipes whose painted area goes as width², which none of these are.
 */
const linSub = (
  v: number | undefined,
  step: HookRaceStep,
  at: number,
  dur: number = ENTER,
) => clamp01((clamp01(v ?? 0) * HOOK_RACE_NOMINAL[step] - at) / dur);

/**
 * Spring overshoot without spring(). spring() needs frame+fps, and this scene is
 * driven by two different clocks (the lab's ramp, the episode's marks), so a
 * keyframed overshoot is the only form that survives both. The 1.035 peak at 55%
 * is the visual equivalent of damping ~16: a crisp settle, not a cartoon bounce.
 * Scale starts at 0.94, never 0.
 */
const popScale = (v: number) =>
  interpolate(clamp01(v), [0, 0.55, 1], [0.94, 1.035, 1]);

/**
 * Deterministic thousands separator. toLocaleString() is locale-dependent, so it
 * can render one way in the studio and another on the render box — and this
 * number is the episode's evidence for "ninety times".
 */
const comma = (n: number) => {
  const s = String(Math.max(0, Math.round(n)));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return out;
};

// ---------------------------------------------------------------------------
// The source on both panels. Byte-identical, because the narration claims it is.
// ---------------------------------------------------------------------------

type TokKind = "k" | "f" | "n" | "p" | "i";
type Tok = readonly [string, TokKind];

/**
 * The hot loop of `walk()` from
 * `episodes/005-cpu-waits-on-memory/bench/bench.c` — four lines, dedented out
 * of the function body and set with compact operator spacing.
 *
 * WHY AN EXCERPT AND NOT THE WHOLE FUNCTION. The listing used to be all nine
 * lines at 26px, which is a 18px cap height — under half the 40px readability
 * floor, and on a phone the two panels were grey texture rather than code. The
 * narration's whole premise is "byte for byte it's the same code, same length,
 * same big oh of n"; if the viewer can't READ the panels, the premise never
 * lands and the episode has no hook. Two 760-wide lanes side by side can carry
 * about 21 mono characters at the floor size, so the fix is fewer, bigger lines
 * — the claim is that the two loops are the same SHAPE, and a shape reads
 * better with less text around it.
 *
 * What survives is the part the rest of the episode is about: the counted
 * `for` (the O(n) the chip will claim) and the two-statement pointer chase
 * (`p->value`, `p = p->next`) that beat 4 turns into the dependent load.
 * `size_t`, the declarations and `return sum` are the parts no line of
 * narration ever refers to. The braces stay: a `for` with two statements and
 * no braces is a different program, and shipping wrong C on a tech channel is
 * not a rounding error.
 *
 * Pre-tokenised by hand rather than run through a highlighter: the listing is a
 * fixed constant, so a parser buys nothing, and a mis-parse would put the wrong
 * word in accent colour during the highest-leverage 24 seconds of the episode.
 *
 * WIDTHS (JetBrains Mono advance is 0.6em, so N chars at 56px = 33.6 * N):
 *   `for (i=0; i<n; i++) {`  21 ch -> 706px
 *   `    sum += p->value;`   20 ch -> 672px
 *   `    p = p->next;`       16 ch -> 538px
 *   `}`                       1 ch ->  34px
 * Widest is 706px from left 30 = 736, inside the 760 lane with 24px to spare.
 */
const CODE: readonly (readonly Tok[])[] = [
  [
    ["for", "k"],
    [" (", "p"],
    ["i", "i"],
    ["=", "p"],
    ["0", "n"],
    ["; ", "p"],
    ["i", "i"],
    ["<", "p"],
    ["n", "i"],
    ["; ", "p"],
    ["i", "i"],
    ["++", "p"],
    [") {", "p"],
  ],
  [
    ["    ", "i"],
    ["sum", "i"],
    [" += ", "p"],
    ["p", "i"],
    ["->", "p"],
    ["value", "f"],
    [";", "p"],
  ],
  [
    ["    ", "i"],
    ["p", "i"],
    [" = ", "p"],
    ["p", "i"],
    ["->", "p"],
    ["next", "f"],
    [";", "p"],
  ],
  [["}", "p"]],
];

/**
 * Computed, never typed in. The "same length" chip claims a byte count for the
 * code ON SCREEN; if someone edits a line and the chip is a literal, the hook
 * starts lying in its second sentence. The listing is pure ASCII, so string
 * length is byte length — and because it counts what is rendered rather than
 * what bench.c holds, cropping the listing keeps the chip honest instead of
 * quietly turning it into a claim about text the viewer can't see.
 */
const CODE_BYTES = CODE.map((l) => l.map((t) => t[0]).join("")).join(
  "\n",
).length;

const TOK_COLOR: Record<TokKind, string> = {
  k: theme.accent,
  f: theme.ink,
  n: theme.up,
  p: theme.dim,
  i: theme.ink,
};

// ---------------------------------------------------------------------------
// Geometry. A "lane" is a 760-wide column owning a code panel, a race track, a
// counter and a badge — one transformed group, so the mid-beat reframe is a
// camera move on two objects instead of eight elements finding new homes.
// Frame is 1920x1080; safe box is x [115,1805], y [65,1015].
//
// The vertical stack BELOW the panel (badge, track, counter, stamp, receipt) is
// untouched by the readability pass: the panel interior was re-derived to land
// its bottom edge at 592, four pixels above where it already was, so raising the
// code to the mono floor moved nothing downstream of it. Each row's box is
// sized from its font and checked against the next row's top.
// ---------------------------------------------------------------------------

const FRAME_CX = 960;

const LANE_W = 760;
const LANE_A_X = 140; // 140 .. 900
const LANE_B_X = 1020; // 1020 .. 1780, inside the 1805 right margin
const PANEL_TOP = 180;

/**
 * PANEL INTERIOR — re-derived at the mono readability floor.
 *
 * `MIN_MONO_FONT_SIZE` (56px font-size = 40.9px cap) is the smallest legal mono
 * in the type scale, and it is what the panel now uses for its title and its
 * listing. It is NOT hand-picked: 68px (`TYPE.code`) would put the widest code
 * line at 857px, which does not fit a 760 lane, so the panel takes the floor
 * token and the CONTENT was cropped to fit it — never the other way round.
 *
 * The rows, all inside the panel box 180 .. 592:
 *   title tab / bytes chip  184 .. 272   (56px mono, one row, no x overlap)
 *   code row 0           276 .. 350
 *   code row 1           350 .. 424
 *   code row 2           424 .. 498
 *   code row 3           498 .. 572   (`}`, 34px wide — the O(n) chip's row)
 * PANEL_BOTTOM lands at 592, ABOVE the badge box at 597 — so nothing below the
 * panel (badge, track, counter, stamp, receipt) moved by a pixel.
 */
const TITLE_SIZE = MIN_MONO_FONT_SIZE; // "loop A" -> 6 * 33.6 = 202px

/**
 * THE LANE NAMEPLATE — a solid, lane-coloured tab carrying the panel title.
 *
 * D6. The hook measured 2.2% mean lit area against an episode median of 6.51%,
 * with 12.0s of its 23.5s under 3% of the frame lit at luma >= 110. The cause
 * is structural, not a missing reveal: almost everything this scene draws is
 * TEXT, and mono glyph ink is only ~12-15% of its own box (the typewriter
 * lesson in PRODUCTION-LESSONS). Four lines of code that occupy 11.8% of the
 * frame as a box light barely 1.5% of it. You cannot fix a dark frame with more
 * type, and you cannot fix it with brighter hairlines either — a repaint under
 * luma 110 contributes EXACTLY 0.000%.
 *
 * So the two things that were already containers become FILLS: this nameplate,
 * and the race trough below. Both are large, both are chromatic, both are
 * on-screen for essentially the whole beat, and neither is decoration — the tab
 * is the panel's title bar (it is where "loop A" already lived) painted in the
 * lane's own colour, which is the same black-on-fill idiom `ResultChip` already
 * uses further down this file, and it states the A-is-blue / B-is-amber mapping
 * from ep 3 instead of leaving the viewer to infer it from the bars at ep 20.
 *
 * AREA. 336 x 88 = 29,568px = 1.426% of a 1920x1080 frame, per lane, at scale
 * 1. Loop B ends the beat at scale 1.08 -> 1.663%. `theme.accent` measures
 * luma 152.8 and `theme.warm` 175.0, both comfortably over the 110 gate, and at
 * 88px tall the tab is ~11 rows of the 240x135 proxy, so it pools at close to
 * its true luma instead of being eaten by swscale the way an 8px rule is.
 *
 * BOUNDS. Lane-local x 4..340 (inside the panel's 2px border, clear of the byte
 * chip at 410..730), y 184..272 (inside the panel's 180..592 box, 4px above the
 * listing at 276, and below the brace drops that stop at 180). Loop A -> screen
 * 144..480; loop B moved -> screen 624..987, y 184..279. Both inside
 * x[115,1805] / y[65,1015] with the +-4/+-3 drift spent.
 */
const TAB_X = 4;
const TAB_Y = 184;
const TAB_W = 336;
const TAB_H = 88;
const CODE_TOP = 276;
const CODE_SIZE = MIN_MONO_FONT_SIZE;
// 74px leading (1.32) for 56px type. Widest line is 21 chars = 706px at the
// 0.6em mono advance, so the listing clears the 760-wide panel from left 30.
const LINE_H = 74;
const PANEL_BOTTOM = CODE_TOP + CODE.length * LINE_H + 20; // 592
// Every mono row below the panel is ON the floor (56px = 40.9px cap). The
// stack was re-derived, not nudged: panel bottom 592 | badge 597..664 |
// track 666..708 (665..709 lifted) | counter 710..774 | stamp 787..919.
const BADGE_SIZE = MIN_MONO_FONT_SIZE;
const BADGE_Y = 630; // centre line of the DONE badge / docked 90x; box 597..664

/**
 * THE RACE TRACK — the other half of the D6 fix, and the bigger half.
 *
 * TWO changes, and they are separate ideas.
 *
 * 1. HEIGHT 26 -> 42. The band between the badge box (bottom 663.6) and the
 *    counter box (top 710) is 46px and the track was using 26 of it. Growing
 *    about the same centre line (687) puts it at 666..708, which spends the
 *    reserved space instead of leaving 20px of black in the middle of the one
 *    object the hook is actually about. Nothing else in the stack moves.
 *
 * 2. THE TROUGH IS NOW LIT. It was `theme.stroke`, which measures luma 90 —
 *    under the 110 gate, so two 760px bars that the viewer is asked to watch a
 *    race across contributed 0.000% to lit area for the entire beat. This is
 *    the #1 recurring bug in this repo and the track was one of its sites.
 *
 * WHY THIS EXACT COLOUR, AND WHY NOT `theme.dim`. The trough has to clear 110
 * (or it is invisible to the metric) AND stay at least 25 luma away from the
 * fill that crosses it (or loop A's bar sweeping to 100% stops registering as a
 * content event at all — the detector gates on |dY| >= 25, and that sweep is
 * the hook's whole first act). `theme.dim` is 147, only 5.8 from `theme.accent`
 * at 152.8: it would have bought lit area by deleting an event, which is
 * exactly the trade this fix is not allowed to make. That pins the trough into
 * [110, 127.8]:
 *
 *   #757F8D  Rec.601 = 0.299*117 + 0.587*127 + 0.114*141 = 125.6
 *     vs the 110 lit gate   +15.6   -> lit
 *     vs theme.accent 152.8  27.2   -> loop A's fill still clears |dY| >= 25
 *     vs theme.warm   175.0  49.4   -> loop B's fill and the gap band clear it
 *     vs theme.ink    236.0 110.4   -> the late track lift clears it
 *     vs theme.bg       0.0 125.6   -> the draw-on clears it
 *
 * It is the same blue-grey family as `theme.stroke` two stops up, and at full
 * opacity it measures well above the 3:1 idle floor `theme.stroke` sits on. It
 * is deliberately NOT a new palette token: every other piece of unfilled
 * structure in the episode is `theme.stroke` and should stay that way. This one
 * bar is special because it is 1.5% of the frame and it is the subject.
 */
const TRACK_Y = 666;
const TRACK_H = 42;
const TRACK_TROUGH = "#757F8D";
// 56px count at 1.15 leading -> box 710..774: 3px under the lifted track and
// 13px over the stamp at 787.
const COUNTER_Y = 710;
const COUNT_LINE_H = 1.15;
const COUNT_SIZE = MIN_MONO_FONT_SIZE;
const UNIT_SIZE = MIN_MONO_FONT_SIZE;

// Lower third, lane-local. Loop B is at scale 1 for the whole time the big 90x
// is on screen, so these read straight through as screen coordinates.
const STAMP_CY = 866; // 128px numeral -> 789 .. 917
// The one display-scale string in the beat, and it is a TOKEN, not a picked
// number: 132 was hand-set, `TYPE.display` is 128 (90px cap) and lands the
// numeral at 789..917, still inside the 787..919 row the stack reserves.
const STAMP_SIZE = TYPE.display.fontSize;
const RULE_Y = 934;
const SUB_Y = 944; // 56px -> 944 .. 1011, inside the 1015 floor
const SUB_SIZE = MIN_MONO_FONT_SIZE;
// At the mono floor the caption is 25 chars * 33.6 = 840px, so it can no longer
// hang off the lane centre (380 -> screen 1400 -> right edge 1820, out of
// bounds). Its centre moves in to lane-local 340 -> screen 1360, text 940..1780.
const SUB_CX = 340;
const SUB_W = 880;

// The gap bracket rides loop B AFTER it moves (x 620, scale 1.08), so lane-local
// 790 lands on screen at 180 + 610 * 1.08 = 839 and the label box at 852..902.
const GAP_RULE_Y = 790;
const GAP_LABEL_Y = 802;
// 56px -> lane-local box 802..869, which the 1.08 lane scale puts on screen at
// 852..924: clear of the counter above (822) and the receipt row below (946).
const GAP_LABEL_SIZE = MIN_MONO_FONT_SIZE;

// Screen-space, not lane-local. At the mono floor two stacked rows need 112px
// and only 91 exist between the gap label (bottom 924) and the 1015 floor — so
// the receipt is ONE row and the run's output extends it to the right instead
// of sitting under it. Box 946..1002: 22px under the gap label, 13 over the floor.
const CMD_Y = 946;
const CMD_SIZE = MIN_MONO_FONT_SIZE;

/** Chip box metrics, shared by Chip and MergingChip so the morph is exact. */
const CHIP_LINE_H = 1.2;
const CHIP_PAD_Y = 6;
const chipHeight = (size: number) => size * CHIP_LINE_H + CHIP_PAD_Y * 2 + 2;

/**
 * Where the O(n) chip sits inside a panel. At the mono floor the chip box is
 * 200 x 81 and lands at x 530..730, y 499..581 — inside the panel (bottom 592)
 * and vertically level with code row 3, which is the one-character `}` line at
 * x 30..64. It is the only row it can share without overlapping glyphs.
 */
const ON_CHIP_CX = LANE_W - 130; // 630 -> 530 .. 730
const ON_CHIP_CY = 540;
const ON_CHIP_W = 200; // "O(n)" = 4 * 33.6 = 134px
const ON_CHIP_SIZE = MIN_MONO_FONT_SIZE;

/** The byte chip shares the header row with the title and does not collide. */
const BYTES_SIZE = MIN_MONO_FONT_SIZE;
const BYTES_W = 320; // "61 bytes" = 8 * 33.6 = 269
const BYTES_CX = LANE_W - 190; // 570 -> 410 .. 730, clear of the title at 228
// The chip box is 81px tall — taller than the title's 67 — so it is centred on
// the 180..276 header band rather than hung off PANEL_TOP: at +45 its top edge
// sat 4px inside the panel border and read as overhanging it.
const BYTES_CY = PANEL_TOP + 48; // box 187 .. 269

/**
 * The notation row: the surviving O(n) chip and its caption, side by side in
 * the 65..180 band above the panels. Stacked (chip over caption) they needed
 * more than the 115px band; laid out as a row they need 1086 x 81 and centre at
 * 960 -> x 417..1503, y 79..161. Nothing is out of bounds and nothing overlaps
 * the panel tops. (The brace crossbar at y150 is at zero opacity by the time
 * the chip arrives — `chipsOut` cleared it 150 frames earlier.)
 */
const NOTE_CAP_SIZE = MIN_MONO_FONT_SIZE;
const NOTE_CAP_W = 1200; // "the notation says they're identical" = 35 * 33.6 = 1176
const NOTE_GAP = 26;
/**
 * r14 · D-HOOK f335-587 (8.43s with NO major event, inside the first 20s).
 *
 * The notation row was ~200px of chip plus 1176px of 56px dim mono glyphs: at
 * ~13% ink coverage that is roughly 9k px of actual paint, 0.4% of frame,
 * spread over a 9-frame eased entrance. A legal content event and nowhere near
 * the MAJOR gate (>=1% of frame in ONE frame, or >=5% inside six).
 *
 * So the row becomes a FILLED BANNER and the chip docks into it.
 *
 *   1480 x 104 = 153,920 px = 7.423% of frame
 *   linear left-to-right clipPath wipe, 6 step frames x 1.040 = 6.24 ep frames
 *   7.423 / 6.24 = 1.190 %/frame        >= the 1% one-frame MAJOR gate
 *   7.423% inside a 6-frame window       >= the 5% window gate
 *   7.423 * 6 / 6.24 = 7.14              >= the 2.0 reveal-rate floor
 *
 * CONSTANT HEIGHT, so a linear-in-time wipe is already linear in AREA — no
 * sqrt(t) needed (that correction is for wipes whose extent grows in two
 * dimensions). theme.accent is Rec.601 153, over the 110 lit threshold, and
 * dY vs bg is 153. Type flips to theme.bg for 8.3:1 on the field.
 *
 * BOUNDS: x220..1700 and y72..176 sit inside the 6% safe area and above the
 * panel tops at y180. Contents: chip 236..436, caption 462..1638 (35 mono
 * glyphs at 33.6px advance), 62px of right padding.
 */
const NOTE_BANNER_X = 220;
const NOTE_BANNER_W = 1480;
const NOTE_BANNER_Y = 72;
const NOTE_BANNER_H = 104;
const NOTE_ROW_X = NOTE_BANNER_X + 16; // 236
const MERGE_CX = NOTE_ROW_X + ON_CHIP_W / 2; // 336
const MERGE_CY = NOTE_BANNER_Y + NOTE_BANNER_H / 2; // 124

/**
 * THE VOID PLATE — the second of the two majors that ladder D-HOOK.
 *
 * After `laneDock` (ep 304-339) the entire lower-left quadrant is black: loop A
 * is a 0.58-scale card ending at y~490, loop B has moved to x620, and the
 * command line does not start until y946. Verified against r13 f520. That
 * ~450x370 hole is both why the window has no major event and why the frame
 * looks half-empty for 250 frames.
 *
 *   450 x 340 = 153,000 px = 7.379% of frame
 *   linear top-to-bottom clipPath wipe, 6 step frames x 1.040 = 6.24 ep frames
 *   7.379 / 6.24 = 1.183 %/frame        >= the 1% one-frame MAJOR gate
 *   7.379% inside a 6-frame window       >= the 5% window gate
 *   7.379 * 6 / 6.24 = 7.10              >= the 2.0 reveal-rate floor
 *
 * CONSTANT WIDTH, so linear time is linear area. theme.down #F85149 is Rec.601
 * 130, over the 110 lit gate; dY vs bg is 130. Black type on it is 6.0:1.
 *
 * It lands ep 516.6-522.9, i.e. ON the word "notation" at ~522, inside the
 * measured speech run f455-531 — not in a silence. It carries the sentence's
 * own counter-claim, so the banner above can keep saying the opposite; the two
 * statements sitting on screen together IS the hook's turn.
 *
 * BOUNDS: x140..590 (loop B's lane starts at screen x620), y560..900 (loop A's
 * card bottom is ~490, the command line's top is 946). Four lines of 56px mono
 * at lineHeight 1.25 = 280px of text, vertically centred at y590..870 inside a
 * 300px inner box. The longest line, "the notation", is 12 glyphs = 403.2px at
 * the 0.6em advance — inside the 410px inner width. Nothing is nowrap-clipped
 * and nothing spills.
 */
const VOID_X = 140;
const VOID_W = 450;
const VOID_Y = 560;
const VOID_H = 340;
const VOID_PAD = 20;
const VOID_LINE_H = 1.25;
const VOID_LINES = ["the thing", "causing it", "isn't in", "the notation"];

/** The brace over both panels, above the notation row's future home. */
const BRACE_Y = 150;
const BRACE_LABEL_Y = 76; // 56px -> 76 .. 143, 7px clear of the crossbar at 150
const BRACE_LABEL_SIZE = MIN_MONO_FONT_SIZE;
const BRACE_LABEL_W = 900; // "byte for byte — identical" = 24 * 33.6 = 806

/**
 * Loop A collapses to a finished card; loop B slides in and takes the frame.
 *
 * 0.58 puts loop A's panel at 140..581 and its verdict card at 163..547, clear
 * of loop B's new left edge at 620. The card is rendered at full size inside an
 * inverse-scaled wrapper, so the ONE downscaled lane in this scene carries no
 * shrunken type — the code, the chips, the title and the counter fade out on
 * the dock instead of surviving at 23px.
 */
const LANE_A_DOCK_SCALE = 0.58;
const LANE_A_EXIT_DX = -760; // slides the finished card clean off the left edge
const LANE_B_MOVED_X = 620;
const LANE_B_MOVED_SCALE = 1.08;
/**
/**
 * The verdict card is the ONE thing on screen for the whole ep 323..651 stretch
 * that used to sit under the floor (40px = 28px cap), so it takes the mono
 * floor too. At 56px nothing wider than 11 characters survives: loop B's panel
 * starts at screen x 620 and is drawn AFTER loop A, so anything longer is not
 * merely tight, it is painted over ("loop A — DONE" at 437px + letter-spacing
 * ran to ~613 and was clipped by loop B's panel edge in the first render of
 * this pass). Three short lines instead of two long ones: widest is the count
 * at 302px, screen 163..478. Three rows of 67px is 201px, which fits the
 * docked panel's 215..419 interior; a fourth row would not.
 */
const VERDICT_SIZE = MIN_MONO_FONT_SIZE;
const VERDICT_LX = 40; // lane-local; screen 140 + 40 * 0.58 = 163
const VERDICT_LY = 240; // lane-local; screen 180 + 60 * 0.58 = 215, box 215..416

/** Node count, from bench/output.txt. The race is honest against this. */
const NODES = 4194304;
/**
 * The headline ratio. SOURCE [11] measured 86.7-93.7x across 7 warm runs and
 * the script rounds DOWN to "ninety", so the picture rounds down too. Nothing
 * on screen may claim a tighter number than the narration does.
 */
const RATIO = 90;

/**
 * How far past T = 1 the virtual race runs by the last frame of the beat.
 *
 * Derived, not tuned: loop A's bar completes at LOOP_A_DONE_FRAME, so if the
 * race keeps running at the same rate it ends at BEAT_FRAMES / that many
 * loop-A-lengths, and loop B ends at 1/90 of it. Hard-coding a round number
 * here would put a bar on screen that disagrees with the clock being watched.
 */
const RACE_TAIL = BEAT_FRAMES / LOOP_A_DONE_FRAME - 1;

/**
 * How RACE_TAIL is split across the three steps that run after loop A finishes:
 * strictly in proportion to their window LENGTHS, so the crawl stays at one
 * constant speed instead of sprinting through the short step and stalling
 * through the long one. Read straight off the shared window table.
 */
const TAIL_SPANS = {
  stamp: HOOK_RACE_NOMINAL.stamp_90x,
  chips: HOOK_RACE_NOMINAL.on_chips,
  stall: HOOK_RACE_NOMINAL.dim_to_stall,
};
const TAIL_TOTAL = TAIL_SPANS.stamp + TAIL_SPANS.chips + TAIL_SPANS.stall;
const TAIL_W = {
  stamp: TAIL_SPANS.stamp / TAIL_TOTAL,
  chips: TAIL_SPANS.chips / TAIL_TOTAL,
  stall: TAIL_SPANS.stall / TAIL_TOTAL,
};

/**
 * Lane-local point -> screen point under a lane's current transform. Loop B's
 * O(n) chip flies out of its panel to the notation row, so its start position
 * AND its start scale have to come from the same transform that moved the lane
 * — hand-copied coordinates are how a "morph" silently becomes a jump cut, and
 * a forgotten scale is how it becomes a jump in size.
 */
const laneToScreen = (
  laneX: number,
  dx: number,
  s: number,
  lx: number,
  ly: number,
) => ({
  x: laneX + dx + lx * s,
  y: PANEL_TOP + (ly - PANEL_TOP) * s,
  scale: s,
});

export const HookRace: React.FC<HookRaceProps> = ({ p, frame = 0 }) => {
  const panels = clamp01(p.code_panels ?? 0);
  const bars = clamp01(p.race_bars ?? 0);
  const done = clamp01(p.left_done ?? 0);
  const stamp = clamp01(p.stamp_90x ?? 0);
  const chips = clamp01(p.on_chips ?? 0);
  const stall = clamp01(p.dim_to_stall ?? 0);

  // ---- code_panels | ramp ep 0..21, nominal 36 (step frame * 0.583 = ep) ---
  // The plates carry a floor so episode frame 0 is NOT an empty background
  // plate: at p = 0 both panels are already drawn at 45% with their top third
  // showing, and they finish inside 3 frames. First real content is now ep 0,
  // the whole subject ("two identical code panels") is legible by ep 15.
  const wipeA = sub(panels, "code_panels", 0, 5); // ep 0.0 .. 2.9
  const wipeB = sub(panels, "code_panels", 2, 5); // ep 1.2 .. 4.1
  /**
   * The lane nameplates, as LINEAR left-to-right clip wipes (see `linSub`).
   *
   *   area 336 x 88 = 29,568px = 1.426% of frame, at lane scale 1
   *   6 step frames * 0.583 = 3.50 episode frames
   *   1.426 * 6 / 3.50 = 2.44  >= 2.0   (the authoring rule)
   *   per frame 1.426 / 3.50 = 0.407%   >= the 0.3%-in-one-frame burst gate
   *
   * A 3.5-frame reveal is under the 6-frame entrance floor, but this is the
   * step's own ramp, not a number picked here: `code_panels` resolves to 21
   * episode frames against a nominal of 36, so every sub-reveal in it runs at
   * 0.583x. The tab arrives with the title it carries and on the same schedule
   * the title already had — nothing was retimed to buy the arithmetic above.
   */
  const headerA = linSub(panels, "code_panels", 5, 6); // ep 2.9 .. 6.4
  const headerB = linSub(panels, "code_panels", 7, 6); // ep 4.1 .. 7.6
  // Four lines instead of nine, so the per-line stagger widens from 1.6 to 3.6
  // step frames to cover the SAME stretch of the window: the listing still
  // finishes arriving at ep ~25, and `code_panels` still spends its whole slot
  // revealing something rather than going quiet at ep 16.
  const codeA = (i: number) => sub(panels, "code_panels", 6 + i * 3.6, 6);
  const codeB = (i: number) => sub(panels, "code_panels", 8 + i * 3.6, 6);
  // last line of loop A: ep 9.8 .. 13.3; loop B: ep 11.0 .. 14.5 (was 11.0/12.1
  // with nine lines — the listing lands on the same beat, just legibly)

  // ---- race_bars | ramp ep 19..38, nominal 32 (step frame * 0.594 = ep) ----
  // `at + dur` can never exceed the step's NOMINAL length: p tops out at 1, so a
  // sub-window that ends past the nominal never reaches 1 and the element sits
  // permanently half-revealed. Every window in this file is checked against it.
  const trackA = sub(bars, "race_bars", 0, 10); // ep 19.0 .. 24.9  line draw-on
  const trackB = sub(bars, "race_bars", 3, 10); // ep 20.8 .. 26.7
  const counterIn = sub(bars, "race_bars", 10, 10); // ep 25.0 .. 30.9  count-up
  const unitsIn = sub(bars, "race_bars", 15, 10); // ep 27.9 .. 33.8

  // ---- left_done | ramp ep 36..48, nominal 20 (step frame * 0.60 = ep) -----
  // The fill finishes FIRST, then the bar turns green, then DONE lands. Popping
  // DONE while loop A's bar is at 98% is the kind of half-second lie the eye
  // catches even when it can't name it.
  const doneFill = sub(done, "left_done", 0, 10); // ep 36.0 .. 42.0
  const doneTint = sub(done, "left_done", 10, 5); // ep 42.0 .. 45.0  accent->green
  const doneBadge = sub(done, "left_done", 10, 10); // ep 42.0 .. 48.0  spring pop

  // ---- stamp_90x | ramp ep 47..82, nominal 31 (step frame * 1.129 = ep) ----
  const stampIn = sub(stamp, "stamp_90x", 0, 6); // ep 47.0 .. 53.8  mark @50
  const warmTint = sub(stamp, "stamp_90x", 8, 12); // ep 56.0 .. 69.6
  const ruleIn = sub(stamp, "stamp_90x", 11, 9); // ep 59.4 .. 69.6  line draw-on
  const subIn = sub(stamp, "stamp_90x", 18, 10); // ep 67.3 .. 78.6  (28 < 31)

  // ---- on_chips | ramp ep 79..196, nominal 107 (step frame * 1.093 = ep) ---
  const brace = sub(chips, "on_chips", 0, 16); // ep  79 .. 96   "Byte" @96
  const braceLabel = sub(chips, "on_chips", 8, 16); // ep  88 .. 105  "byte" @111
  /**
   * THE BYTE-FOR-BYTE PASS — the fill for the ep 102..193 hold.
   *
   * ep 105 -> 147 was 42 frames with nothing entering, and the two events that
   * did fire in the rest of the window (the byte chips, the O(n) chips) are
   * 320x81 boxes of thin dim type: too little of the frame changes for either
   * the grader or an eye on a phone to register them as an event.
   *
   * So the fill is the CLAIM, not decoration: while the narration says "byte
   * for byte", a band lights each line of BOTH listings in turn — the two
   * panels being checked against each other, a line at a time. Four discrete
   * events at ep 112 / 120 / 129 / 138, each a 720x62 band in both lanes
   * (~5% of the frame), then all four clear together on the byte chips at
   * ep 147, which makes that entrance a large event too instead of a small one.
   *
   * Nothing is added to the frame — it lights code that is already there — and
   * it says nothing about WHY the two loops differ, which is beat 10's job.
   * Loop B trails by two step frames: a 2-4f stagger reads as one gesture
   * crossing both panels, not as two separate entrances.
   */
  const scanA = (i: number) => sub(chips, "on_chips", 30 + i * 8, 8);
  const scanB = (i: number) => sub(chips, "on_chips", 32 + i * 8, 8);
  const scanOut = subOut(chips, "on_chips", 60, 8); // ep 145 .. 154 (68 < 107)
  const bytesA = sub(chips, "on_chips", 62, 9); // ep 147 .. 157  "length" @157
  const bytesB = sub(chips, "on_chips", 66, 9); // ep 151 .. 161
  const onA = sub(chips, "on_chips", 88, 8); // ep 175 .. 183  "big oh of n" @172-195
  const onB = sub(chips, "on_chips", 92, 8); // ep 180 .. 188
  const braceRecede = sub(chips, "on_chips", 96, 11); // ep 184 .. 196

  // ---- dim_to_stall | ramp ep 188..713, nominal 505 -----------------------
  // Step frame * 1.040 + 188 = episode frame. This step owns 71% of the beat,
  // so it is not one ramp — it is a storyboard of nineteen sub-events. The
  // grader measured a 10.9s static hold from ep 379 to ep 704 in the previous
  // cut; the four events that fixed it are marked NEW below.
  const chipsOut = subOut(stall, "dim_to_stall", 0, 20); // ep 188..209 brace + byte chips clear
  const stampCapOut = subOut(stall, "dim_to_stall", 0, 14); // ep 188..203 rule + caption clear
  const dockStamp = sub(stall, "dim_to_stall", 4, 40); // ep 192..234 90x docks into the badge slot
  const cmdIn = sub(stall, "dim_to_stall", 14, 30); // ep 203..234 "I raced 'em on my own laptop"
  /**
   * D9a — ep 253..304 measured as a static hold even though `cmdResult` fired
   * at 253. Cause: the result was 12 characters of `theme.dim` mono appended
   * to the command row, ~0.35% of the frame, which the content-event gate
   * cannot see and the eye barely can. It is now TWO FILLED chips carrying
   * the two numbers the race actually produced, landing on separate words:
   *   A  670x104 = 3.361% of frame, 9f -> 3.361*6/9 = 2.24
   *   B  603x104 = 3.025% of frame, 8f -> 3.025*6/8 = 2.27
   * Fill lumas on #000000: accent #58A6FF = 156, warm #E3B341 = 181.
   * Chip colours are the LANE colours (A accent, B warm), so the numbers are
   * already attributed before either is read aloud.
   * Numbers are verbatim from `bench/output.txt` — not rounded, not invented.
   */
  const cmdResult = sub(stall, "dim_to_stall", 63, 9); // ep 253..262 "last night"       (NEW)
  const cmdResultB = sub(stall, "dim_to_stall", 86, 8); // ep 277..286 "one of 'em just"  (NEW)
  // The chips are the receipt for one sentence. They clear on the lane
  // reframe, which is also what keeps them out of the gap bracket's row
  // (screen 852..924) when it draws on at ep 425.
  const cmdResultOut = subOut(stall, "dim_to_stall", 112, EXIT_FRAMES); // ep 304..310
  const laneDock = sub(stall, "dim_to_stall", 112, 34); // ep 304..339 "ran away with it" @321
  const verdictIn = sub(stall, "dim_to_stall", 130, 8); // ep 323..331 the finished card lands
  // Shortened 40 -> 34 step frames so the chip is DOCKED at ep 400, one frame
  // before the banner wipes through its slot. The banner draws its own copy of
  // the chip (dark on the accent field), so the flying one hard-swaps out at
  // `bannerIn > 0` — a cross-fade here would print two chips through each other
  // for six frames, the same failure the caption swap was already fixed for.
  const merge = sub(stall, "dim_to_stall", 170, 34); // ep 365..400 "nothing you learned" @368
  /* MAJOR #1 of the hook's back half — the notation banner, ep 401.2..407.4, on
     "in algorithms class" (@407, inside the measured speech run f358-431).
     7.423% of frame at 1.190 %/frame; see NOTE_BANNER_X for the full
     arithmetic. `linSub`, not `sub`: an eased wipe opens at 3/N of its average
     rate and would land at 0.45 %/frame, under the gate. */
  // The plate, the chip and the caption are all INSIDE this one clip and all at
  // full opacity, so the banner can never render as an empty box waiting for
  // its text — the wipe reveals finished content or nothing.
  const bannerIn = linSub(stall, "dim_to_stall", 205, 6); // ep 401..407
  const gapIn = sub(stall, "dim_to_stall", 228, 10); // ep 425..435 "that gap" @430
  const gapLabel = sub(stall, "dim_to_stall", 244, 8); // ep 442..450
  /**
   * THE GAP, MEASURED — the fill for the ep 397..497 hold.
   *
   * The window already had events at ep 401 / 425 / 442 / 483, but three of the
   * four are hairlines and small dim type: a 3px rule and a 7-character label
   * change too little of the frame to read as anything happening, which is why
   * a hundred frames of it graded as one static hold. Two fixes, no new chrome:
   *
   *   1. the bracket is loop B's colour and twice as heavy (below), so drawing
   *      it on at ep 425 is actually a visible event;
   *   2. at ep 468 the label SEQUENCES from "the gap" to "the gap — <count>",
   *      a live count-DOWN of the nodes loop B still owes. Out then in, never
   *      crossfaded: both strings share a centre, so any overlap frame prints
   *      one through the other (the lesson the notation caption already
   *      learned 46 frames later).
   *
   * Event starts across the window are now 401, 425, 442, 468, 483 — a 26-frame
   * worst gap. And the number is a restatement of the gap, never its cause: it
   * says how much work is left, not why the work is slow.
   */
  const gapCountOut = subOut(stall, "dim_to_stall", 264, EXIT_FRAMES); // ep 462..468
  const gapCountIn = sub(stall, "dim_to_stall", 270, EXIT_FRAMES); // ep 469..475
  /**
   * The gap band, retimed from an 18-step ease to a 6-step LINEAR wipe.
   *
   * It was authored as `width: remainder * ghost` AND `opacity: 0.48 * ghost`
   * over 18 step frames = 18.7 episode frames. Two problems, both from the
   * lesson list: the opacity half is a colour ease (never an event), and 18.7
   * frames is twice the 9-frame entrance ceiling — it read as a slow wash on
   * the single sentence the back half of the hook turns on.
   *
   *   area  = the unfilled remainder, 0.89 * 821 * 45.4 = 33,200px = 1.601%
   *   6 step frames * 1.040 = 6.24 episode frames  (inside the 6-9 band)
   *   1.601 * 6 / 6.24 = 1.54     (under the 2.0 target — see below)
   *   per frame 1.601 / 6.24 = 0.257%
   *
   * 1.54 is short of 2.0 and there is no honest way to reach it here: the band
   * cannot be bigger than the track it lives in, and 6.24 frames is already the
   * floor of the entrance band. What it CAN be is bright — `theme.warm` (175)
   * over the new trough (125.6) is |dY| 49.4, where the old 0.48 alpha over
   * `theme.stroke` composited to 133.5 against 90, a |dY| of 43.5 spread over
   * three times as many frames. Same object, ~3x the rate. Reported rather than
   * rounded up: this is the one reveal in the beat that the area rule can't be
   * satisfied for without inventing geometry.
   */
  const gapGhost = linSub(stall, "dim_to_stall", 284, 6); // ep 483..489 "doesn't show up" @483
  // EXIT LENGTHS. These two used to run 16 and 34 step frames — 0.55s and 1.18s
  // of continuous opacity ramp back to back, which the grader read as one
  // 1.77s fade across ep 515-568. An exit is ~200ms; a recompose is not a
  // special case of an exit, it is an exit and an entrance happening at once.
  // Starts are UNCHANGED, so both still land on their word; only the ramps
  // shortened, which makes each one a sharper content event, not a softer one.
  /* MAJOR #2 of the hook's back half — the void plate, ep 516.6..522.9, ON the
     word "notation" (@522, inside the measured speech run f455-531).
     7.379% of frame at 1.183 %/frame; see VOID_X for the full arithmetic.

     THIS REPLACES THE IN-PLACE CAPTION RELABEL. The old `relabelOut`/`relabel`
     pair swapped 35 dim glyphs for 19 warm ones at the same x — a few thousand
     px of ink, a non-event by any gate, and it deleted the claim the sentence
     is arguing WITH. Now the banner keeps saying "the notation says they're
     identical" and the plate lands underneath it saying the opposite, which is
     the sentence's actual shape. Nothing is duplicated: the two strings share
     only the word "notation". */
  /* R14 — the three word frames on these lines were MODELLED, not measured, and
     one of them was hiding a cue stranded in dead air. Measured against the
     shipped take (`.tts_cache/862f22cb4dfae688.json`, origin f0 — confirmed
     twice: its `dur` 82.407s = f2472 = `memory_wall.startFrame`, and `NINETY`
     at f50 = the `ninetyx` mark). Beware: `5c1e084d42ed2649.json` holds a STALE
     earlier take of this same beat and disagrees by ~20 frames throughout; the
     silence at 17.67-18.82s in `narration.master.wav` is what tells them apart.

     `focus` was the real defect. It fired at ep546 against a claimed word @545,
     but f545 is the `[deadpan]` TAG, not a word — v3 performs tags, it does not
     speak them. The measured word "Your" is at f565, so the recompose was
     running 19 frames (0.63s) early, inside the measured silence f530..f565.
     Moved to land 3 frames before the word. */
  const voidIn = linSub(stall, "dim_to_stall", 316, 6); // ep 516..523; "at" @514, "all." @520 (NOT "notation" @501 — this lands on the phrase's tail, deliberately)
  const focus = sub(stall, "dim_to_stall", 359, ENTRANCE_MAX_FRAMES); // ep 562..571 "Your" @565
  const gapOut = subOut(stall, "dim_to_stall", 376, 22); // ep 579..602 "though." @601 — an exit, so opening 22f early is intended
  /**
   * THE LAST THING LIT — loop B's track, retimed from a 30-step colour ease to
   * a 6-step LINEAR wipe of `theme.ink` across the trough.
   *
   * `interpolateColors(lift, [stroke, dim])` over 31 episode frames was the
   * textbook non-event: a colour ease whose best single-frame step is (3/31) of
   * its total, i.e. ~10 luma levels, against a gate of 25. The beat's closing
   * image — the bar the CPU has been staring at all day — was changing colour
   * at a rate nothing could measure and an eye on a phone would not catch.
   *
   *   area  = 821 x 45.4 = 37,273px = 1.798% of frame (loop B at scale 1.08)
   *   6 step frames * 1.040 = 6.24 episode frames  (inside the 6-9 band)
   *   1.798 * 6 / 6.24 = 1.73     (under the 2.0 target — see below)
   *   per frame 1.798 / 6.24 = 0.288%
   *   |dY| = 236.0 - 125.6 = 110.4, more than 4x the 25 gate
   *
   * 1.73 falls short of 2.0 for the same reason the gap band does: the object
   * is the track, the track is 1.8% of the frame, and 6.24 frames is the
   * entrance floor. Reaching 2.0 would mean either a 5-frame entrance (illegal)
   * or lighting something that isn't the track (decoration). Stated, not
   * fudged — and it is ~5x the rate of the ease it replaces (1.798*6/31=0.35).
   */
  const trackLift = linSub(stall, "dim_to_stall", 410, 6); // ep 614..620 "staring at it all day"
  const laneExit = sub(stall, "dim_to_stall", 412, 32); // ep 617..651 loop A leaves       (NEW)
  const waiting = sub(stall, "dim_to_stall", 472, 8); // ep 679..687 "waiting" @683
  // Event starts after ep 379: 401, 425, 442, 483, 519, 546, 579, 614, 679.
  // Largest start-to-start gap is 65 frames (2.2s), then a 16-frame hold into
  // the cut at 705. Nothing in the beat sits still for three seconds.

  /**
   * Virtual race time, in units where loop A finishes at exactly T = 1.
   *
   * Loop B has to keep crawling for the whole beat, but a crawl driven by
   * `frame` would desync the moment the assembler nudges a window — and the
   * contract reserves `frame` for motion with no start or end. So T is a
   * monotone weighted sum of the steps: it advances whenever ANY step advances,
   * which is exactly "the race is still running".
   *
   * `doneFill` (not raw `done`) carries the last 15%, so T hits 1 as the bar
   * fills and the DONE badge that follows describes a bar that is actually full.
   *
   * The three tail weights are the three windows' LENGTHS, normalised — not
   * round numbers. Hand-picked weights spent 15% of the race over 31 frames and
   * 50% of it over 505, so loop B's bar sprinted and then crawled to a fifth of
   * its own speed. A race that visibly decelerates is a lie about the thing the
   * whole hook is measuring.
   */
  const T =
    0.85 * ease(bars) +
    0.15 * doneFill +
    RACE_TAIL *
      (TAIL_W.stamp * stamp + TAIL_W.chips * chips + TAIL_W.stall * stall);

  const fillA = clamp01(T);
  const fillB = clamp01(T / RATIO);

  // Lane transforms. Loop A becomes a finished CARD rather than being deleted —
  // object constancy across the "ran away with it" line — and only leaves the
  // frame 300 frames later, on "it's been staring at it all day".
  const aScale = interpolate(laneDock, [0, 1], [1, LANE_A_DOCK_SCALE]);
  const aDx = LANE_A_EXIT_DX * laneExit;
  const bScale = interpolate(laneDock, [0, 1], [1, LANE_B_MOVED_SCALE]);
  const bDx = interpolate(laneDock, [0, 1], [0, LANE_B_MOVED_X - LANE_B_X]);

  /**
   * Focus collapse for "Your CPU knows what it is, though."
   *
   * The previous cut multiplied EVERYTHING by (1 - 0.86 * dim), which drove the
   * panel, the command line, the notation chip and loop A to ~0.1 opacity — the
   * grader called the last four seconds near-illegible, and it was right. This
   * version recomposes instead of crushing: the losing panel and the spent
   * receipts recede, the track and the counter that carry the last line stay at
   * 0.85-1.0.
   *
   * D6 / THE RETIRE-CLIFF. The recede floors were 0.40-0.45, and those two
   * numbers are on the wrong side of a hard edge nobody had costed. `theme.ink`
   * is luma 236, so ink at alpha 0.45 composites to 106 over black and 0.40 to
   * 94 — BOTH UNDER THE 110 LIT GATE. This one ramp is therefore what
   * manufactured the darkest stretch of the darkest beat in the episode: lit
   * area measured 2.997% at ep 530 and 0.515% at ep 616, and most of that
   * collapse is loop B's four-line listing and loop A's verdict card silently
   * crossing out of the metric while still being drawn. A recompose that
   * extinguishes what it recedes is not a recompose.
   *
   * The floors are now set FROM the gate rather than picked by eye — the
   * smallest alpha that keeps `theme.ink` lit with margin:
   *
   *   236 * 0.62 = 146.3   loop B's listing   (was 0.45 -> 106, dark)
   *   236 * 0.58 = 136.9   loop A's card      (was 0.40 ->  94, dark)
   *   236 * 0.58 = 136.9   the notation row   (was 0.40 ->  94, dark)
   *
   * The hierarchy is unchanged in kind and barely changed in degree: loop B's
   * track and the "waiting" label still sit at 1.0 against a panel at 0.62,
   * which is the same recompose read, only one that survives being measured.
   * The ramp is still a content event — an ease-out opens at 3/N, so the first
   * frame of the 9-frame collapse moves ink by 236*0.38*3/9 = 29.9, past the
   * detector's |dY| >= 25 (it was 43.1 at the old floor, so the burst narrows
   * rather than disappearing).
   */
  const aDim = (1 - 0.42 * focus) * (1 - laneExit); // 1.0 -> 0.58
  const bPanelDim = 1 - 0.38 * focus; // 1.0 -> 0.62
  const bCounterDim = 1 - 0.15 * focus; // 1.0 -> 0.85
  const cmdDim = 1 - 0.45 * focus; // 1.0 -> 0.55
  const noteDim = 1 - 0.42 * focus; // 1.0 -> 0.58 (the flying chip, pre-banner)
  /* Two more floors set FROM the gate, for the two new plates. Both are FIELDS,
     not ink, so the arithmetic is on their own luma, not on 236:
       accent 153 -> 110 needs alpha >= 0.719, so the banner floors at 0.78
                     (153 * 0.78 = 119.3, lit with margin)
       down   130 -> 110 needs alpha >= 0.846, so the plate floors at 0.90
                     (130 * 0.90 = 117.0, lit with margin)
     A 0.58 recede on either of these would extinguish 7.4% of the frame at
     exactly the moment the beat can least afford it — the same retire-cliff
     the note above is about, on the two biggest objects in the shot. */
  const bannerDim = 1 - 0.22 * focus; // 1.0 -> 0.78
  const voidDim = 1 - 0.1 * focus; // 1.0 -> 0.90

  const onChipB = laneToScreen(LANE_B_X, bDx, bScale, ON_CHIP_CX, ON_CHIP_CY);

  // The in-panel chip and the flying chip are the same box at the same place at
  // the same scale, so the handoff is a hard swap on the first frame of the
  // merge. Crossfading them instead double-draws one chip at 2x brightness for
  // a few frames, which is what a "morph" must never look like.
  const chipHandoff = merge > 0 ? 0 : 1;

  // Ambient only: a slow figure-of-eight drift, ~4px, with no start and no end.
  // Invisible as motion, but the frame is never dead still.
  const driftX = Math.sin(frame / 220) * 4;
  const driftY = Math.cos(frame / 260) * 3;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        fontFamily: SANS,
        transform: `translate(${driftX}px, ${driftY}px)`,
      }}
    >
      {/* ---- the brace: one statement, both panels --------------------------
          Drawn on from the centre outward, then two drops to the panel tops. A
          brace is the anti-circle — it says "these two" without ringing them. */}
      <Brace
        p={brace}
        label={braceLabel}
        opacity={(1 - 0.6 * braceRecede) * (1 - chipsOut)}
      />

      {/* ---- loop A --------------------------------------------------------- */}
      <Lane
        x={LANE_A_X}
        dx={aDx}
        scale={aScale}
        opacity={aDim}
        title="loop A"
        titleIn={headerA}
        wipe={wipeA}
        codeAt={codeA}
        scanAt={scanA}
        scanOut={scanOut}
        track={trackA}
        fill={fillA}
        fillColor={theme.accent}
        tintColor={theme.up}
        tint={doneTint}
        counterIn={counterIn}
        counterDim={1}
        unitsIn={unitsIn}
        count={NODES * fillA}
        bytesChip={bytesA * (1 - chipsOut)}
        onChip={onA * chipHandoff}
        badge={doneBadge}
        badgeText="DONE"
        badgeColor={theme.up}
        panelDim={1}
        contentOut={laneDock}
      >
        {/*
          The dock's replacement for eight shrunken elements. Rendered inside an
          inverse-scaled wrapper so it travels with the lane (and leaves with it)
          while staying at 40px on screen — the reason the code, the chips, the
          title and the counter can safely fade out under it.
        */}
        <div
          style={{
            position: "absolute",
            left: VERDICT_LX,
            top: VERDICT_LY,
            transform: `scale(${1 / aScale})`,
            transformOrigin: "0% 0%",
            fontFamily: MONO,
            fontSize: VERDICT_SIZE,
            lineHeight: 1.2,
            fontWeight: 700,
            letterSpacing: 1,
            whiteSpace: "nowrap",
            opacity: verdictIn,
          }}
        >
          <div style={{ color: theme.dim, fontWeight: 400 }}>loop A</div>
          <div style={{ color: theme.up }}>DONE</div>
          <div style={{ color: theme.dim, fontWeight: 400 }}>
            {comma(NODES)}
          </div>
        </div>
      </Lane>

      {/* ---- loop B --------------------------------------------------------- */}
      <Lane
        x={LANE_B_X}
        dx={bDx}
        scale={bScale}
        opacity={1}
        title="loop B"
        titleIn={headerB}
        wipe={wipeB}
        codeAt={codeB}
        scanAt={scanB}
        scanOut={scanOut}
        track={trackB}
        lift={trackLift}
        ghost={gapGhost * (1 - gapOut)}
        fill={fillB}
        fillColor={theme.warm}
        tintColor={theme.warm}
        tint={warmTint}
        counterIn={counterIn}
        counterDim={bCounterDim}
        unitsIn={unitsIn}
        count={NODES * fillB}
        bytesChip={bytesB * (1 - chipsOut)}
        onChip={onB * chipHandoff}
        panelDim={bPanelDim}
        contentOut={0}
      >
        {/* Lane-local, so all of this rides loop B's move to the centre. */}

        {/* the big 90x, and its shrink into loop B's badge slot */}
        <Stamp
          inP={stampIn}
          dock={dockStamp}
          rule={ruleIn * (1 - stampCapOut)}
          sub={subIn * (1 - stampCapOut)}
        />

        {/* the unfilled remainder, bracketed and then named */}
        <GapBracket
          fill={fillB}
          draw={gapIn * (1 - gapOut)}
          label={gapLabel * (1 - gapOut)}
          countOut={gapCountOut}
          count={gapCountIn * (1 - gapOut)}
        />

        {/* the crawling head, once everything else has been recomposed away */}
        <Waiting fill={fillB} p={waiting} frame={frame} />
      </Lane>

      {/* ---- the receipt for "I raced 'em on my own laptop last night" -------
          Rendered natively, never screen-captured: a real capture carries the
          shell prompt, and the shell prompt carries a username. */}
      <CommandLine
        p={cmdIn}
        resultA={cmdResult}
        resultB={cmdResultB}
        resultOut={cmdResultOut}
        opacity={cmdDim}
      />

      {/* ---- loop B's O(n) chip flies up and BECOMES the notation row --------
          One chip travels, not two. Loop A's copy is removed as its lane docks
          (see `contentOut`): a full-size duplicate flying out of a 0.58-scale
          card left two identical O(n) chips sitting over loop B's panel at
          ep 380, which read as a stale element rather than as a merge. */}
      {bannerIn <= 0 && (
        <MergingChip from={onChipB} p={merge} opacity={noteDim} />
      )}
      <NotationBanner p={bannerIn} opacity={bannerDim} />

      {/* ---- the counter-claim, in the hole loop A left behind ------------- */}
      <VoidPlate p={voidIn} opacity={voidDim} />
    </div>
  );
};

// ---------------------------------------------------------------------------

interface LaneProps {
  x: number;
  dx: number;
  scale: number;
  opacity: number;
  title: string;
  titleIn: number;
  wipe: number;
  /** Per-line reveal, so the stagger is scheduled in step frames not fractions. */
  codeAt: (i: number) => number;
  /** 0..1 per code line: the byte-for-byte pass lighting that line. */
  scanAt?: (i: number) => number;
  /** 0..1, clears every band at once when the byte chips take over. */
  scanOut?: number;
  track: number;
  /** 0..1 emphasis on the track itself, for the last-thing-lit moment. */
  lift?: number;
  /** 0..1 mask wipe over the UNFILLED remainder of the track. */
  ghost?: number;
  fill: number;
  fillColor: string;
  /** Second colour the fill and the counter crossfade to (green on finish). */
  tintColor: string;
  tint: number;
  counterIn: number;
  counterDim: number;
  unitsIn: number;
  count: number;
  bytesChip: number;
  onChip: number;
  /** Loop B has no badge of its own — the 90x stamp docks into that slot. */
  badge?: number;
  badgeText?: string;
  badgeColor?: string;
  panelDim: number;
  /**
   * 0..1. Fades everything that would become illegible under a dock: the code
   * listing, both chips, the title, the counter and the badge. The lane keeps
   * its panel and its finished bar, and `children` supplies a full-size card.
   */
  contentOut: number;
  children?: React.ReactNode;
}

/**
 * One competitor: code panel, race track, count-up, badge.
 *
 * transformOrigin sits at the panel's top-left corner, which is why loop A
 * shrinks toward x=140 instead of drifting out of its column when it docks.
 *
 * `panelDim`, `counterDim` and `contentOut` are separate from the lane's own
 * `opacity` on purpose: the last line of the hook recedes the panel, the code
 * and the chips but NOT loop B's track, and a single opacity on the group could
 * not express that.
 */
const Lane: React.FC<LaneProps> = ({
  x,
  dx,
  scale,
  opacity,
  title,
  titleIn,
  wipe,
  codeAt,
  scanAt,
  scanOut = 0,
  track,
  lift = 0,
  ghost = 0,
  fill,
  fillColor,
  tintColor,
  tint,
  counterIn,
  counterDim,
  unitsIn,
  count,
  bytesChip,
  onChip,
  badge = 0,
  badgeText = "",
  badgeColor = theme.ink,
  panelDim,
  contentOut,
  children,
}) => {
  // Grows about its own centre line (687), so the bar thickens in place rather
  // than sliding down onto the counter. 42 -> 43.7 at full lift, i.e. box
  // 666..708 -> 665.2..708.9: still 1.6px clear of the badge box (bottom 663.6)
  // and 1.1px clear of the counter box (top 710).
  //
  // The growth factor dropped from 0.4 to 0.04 because the track now STARTS at
  // 42px. At 0.4 a lifted bar would be 58.8px and would climb into both of its
  // neighbours; and the lift no longer needs to be carried by height, because
  // it is now a `theme.ink` wipe across the trough (see `trackLift`), which is
  // a |dY| of 110 where the old height jump was worth a few proxy rows.
  const trackH = TRACK_H * (1 + 0.04 * lift);
  const trackTop = TRACK_Y + (TRACK_H - trackH) / 2;
  // Everything that must not survive a downscale.
  //
  // D4 — `contentOut` is the 34-frame lane-dock ramp, so `1 - contentOut` was
  // a 1.13s linear opacity bleed on the lane's contents: a slow wash that
  // reads as a dissolve, not as an exit, and that parks the badge and counter
  // at 0.3-0.5 opacity (under the 3:1 floor) for most of a second. The dock is
  // a MOVE, not a fade — the contents clear in the first ~6 frames of it and
  // the remaining 28 frames are pure motion.
  const inner = panelDim * (1 - clamp01(contentOut * 6));

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: LANE_W,
        height: 1080,
        opacity,
        transform: `translateX(${dx}px) scale(${scale})`,
        transformOrigin: `0px ${PANEL_TOP}px`,
      }}
    >
      {/* ---- the code panel. Mask-wipe down, not a pop, and it starts from a
              45%/one-third floor so episode frame 0 already has content on it:
              the editor should feel like it was already open. --------------- */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: PANEL_TOP,
          width: LANE_W,
          height: PANEL_BOTTOM - PANEL_TOP,
          // 2px, matching HiddenAssumption's CardFace. At ep 0-15 this box is an
          // EMPTY CONTAINER — the one thing on screen before the listing arrives
          // — and `theme.panel` over pure black is 1.05:1, so the border is the
          // only thing that makes the panel exist. A 1px line at 3.09:1 is the
          // contrast floor spent on half the ink; 2px is the same colour with
          // enough area to survive a phone screen.
          border: `2px solid ${theme.stroke}`,
          borderRadius: 12,
          background: theme.panel,
          opacity: (0.45 + 0.55 * wipe) * panelDim,
          clipPath: `inset(0 0 ${(1 - (0.35 + 0.65 * wipe)) * 100}% 0)`,
        }}
      />

      {/* ---- the nameplate: which loop this is, on a solid lane-coloured tab.
              See TAB_* above for why a fill and not more type. Black on the
              lane colour is 8.3:1 (accent) / 11.1:1 (warm) — the same
              black-on-fill idiom `ResultChip` uses for the two measurements.

              It is deliberately NOT multiplied by `panelDim`. The focus
              collapse recedes the CODE; the nameplate is the label on the
              thing being pointed at, and `theme.warm` at 0.62 composites to
              112, two levels off the lit gate — a floor that tight is how the
              retire-cliff gets reintroduced by the same edit that fixed it.
              `contentOut` still clears it, so loop A's tab leaves on the dock
              exactly as its title used to. ------------------------------- */}
      <div
        style={{
          position: "absolute",
          left: TAB_X,
          top: TAB_Y,
          width: TAB_W,
          height: TAB_H,
          borderRadius: 8,
          background: fillColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          fontSize: TITLE_SIZE,
          lineHeight: CHIP_LINE_H,
          fontWeight: 700,
          color: theme.bg,
          letterSpacing: 1,
          opacity: 1 - clamp01(contentOut * 6),
          // Linear left-to-right mask wipe — `titleIn` is a `linSub`, so area
          // advances at a constant 0.407% of frame per episode frame instead of
          // front-loading the way an ease would.
          clipPath: `inset(0 ${(1 - titleIn) * 100}% 0 0)`,
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>
      {/* Wipe, not pop. The two byte chips and the two O(n) chips arrive back
          to back; if all four popped that is four identical entrances in a row,
          which is the exact thing that reads as banner ads. */}
      <Chip
        p={bytesChip}
        opacity={inner}
        grammar="wipe"
        cx={BYTES_CX}
        cy={BYTES_CY}
        width={BYTES_W}
        text={`${CODE_BYTES} bytes`}
        color={theme.dim}
        size={BYTES_SIZE}
      />

      {/* ---- the listing, wiped in line by line ------------------------------ */}
      <div
        style={{
          position: "absolute",
          left: 30,
          top: CODE_TOP,
          fontFamily: MONO,
          fontSize: CODE_SIZE,
          lineHeight: `${LINE_H}px`,
          opacity: inner,
        }}
      >
        {CODE.map((line, i) => {
          const lp = codeAt(i);
          // The band is a mask WIPE left-to-right (reading order), the same
          // grammar the listing itself arrived on, so the pass reads as
          // re-reading the code rather than as a new object.
          const sp = scanAt ? scanAt(i) * (1 - scanOut) : 0;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                whiteSpace: "pre",
                height: LINE_H,
                opacity: lp,
                clipPath: `inset(0 ${(1 - lp) * 100}% 0 0)`,
                transform: `translateY(${(1 - lp) * 5}px)`,
              }}
            >
              {/* Lane-local 20..740 inside a 760 lane, drawn BEFORE the tokens
                  and behind them (both positioned, so DOM order wins).
                  0.30, not 0.14. This band IS the byte-for-byte pass — the four
                  content events that fill ep 112-147 — and at 0.14 the accent
                  over pure black lands at luma 21 against a luma-0 plate, which
                  is dY=21: UNDER the 25-luma gate the pacing detector uses and
                  under anything an eye catches on a phone. It was an event that
                  existed in the DOM and not in the video. At 0.30 the band is
                  luma 46 (dY=46, ~2x the gate) and the code on top of it still
                  reads at 11.9:1 for `theme.ink` and 4.85:1 for `theme.dim` —
                  brightening the band costs the listing nothing. */}
              <div
                style={{
                  position: "absolute",
                  left: -10,
                  top: 6,
                  width: 720,
                  height: LINE_H - 12,
                  borderRadius: 6,
                  background: theme.accent,
                  opacity: 0.3 * sp,
                  // dimmed-ink-exempt: a band UNDER code, capped by the code's
                  // legibility, not by the lit gate. The block above sets 0.30
                  // deliberately — it is the floor that clears the 25-luma
                  // difference gate while `theme.ink` on top still reads 11.9:1.
                  // Crossing 0.466 to become "lit" would take that under 8:1
                  // and trade the readable thing for the measurable one.
                  clipPath: `inset(0 ${(1 - sp) * 100}% 0 0)`,
                }}
              />
              <span style={{ position: "relative" }}>
                {line.map((t, j) => (
                  <span
                    key={j}
                    style={{
                      color: TOK_COLOR[t[1]],
                      fontWeight: t[1] === "f" ? 700 : 400,
                    }}
                  >
                    {t[0]}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>

      {/* the O(n) chip, inside the panel, next to the code it describes */}
      <Chip
        p={onChip}
        opacity={inner}
        cx={ON_CHIP_CX}
        cy={ON_CHIP_CY}
        width={ON_CHIP_W}
        text="O(n)"
        color={theme.accent}
        size={ON_CHIP_SIZE}
      />

      {/* ---- badge slot ------------------------------------------------------ */}
      <div
        style={{
          position: "absolute",
          left: LANE_W - 300,
          top: BADGE_Y - (BADGE_SIZE * CHIP_LINE_H) / 2,
          width: 300,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: BADGE_SIZE,
          lineHeight: CHIP_LINE_H,
          fontWeight: 700,
          letterSpacing: 2,
          color: badgeColor,
          // D4: same snap as `inner` — these two opacities were the other half
          // of the 1.13s wash, and a badge sitting at 0.4 for 20 frames is
          // below the contrast floor without being gone.
          opacity: badge * (1 - clamp01(contentOut * 6)),
          transform: `scale(${popScale(badge)})`,
          whiteSpace: "nowrap",
        }}
      >
        {badgeText}
      </div>

      {/* ---- race track: draws on as a line, then fills ---------------------- */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: trackTop,
          width: LANE_W * track,
          height: trackH,
          borderRadius: trackH / 2,
          // THE TROUGH — see TRACK_TROUGH above for the whole derivation. The
          // short version: this used to be `theme.stroke`, which is luma 90,
          // which is UNDER the detector's luma-110 lit gate, which means two
          // 760px bars the viewer is asked to watch a race across counted for
          // exactly 0.000% of lit area across the darkest beat in the episode.
          // #757F8D is luma 125.6 — lit, and still 27.2 away from the accent
          // fill that crosses it, so loop A's bar completing is still a content
          // event rather than a repaint the difference gate cannot see.
          background: TRACK_TROUGH,
        }}
      />
      {/* THE LAST THING LIT. `theme.ink` wiped left-to-right across the trough
          on "it's been staring at it all day" — a linear clipPath, not the
          colour ease this used to be. 1.798% of frame, |dY| 110.4, 6.24
          episode frames; the arithmetic is at `trackLift`. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: trackTop,
          width: LANE_W * track,
          height: trackH,
          borderRadius: trackH / 2,
          background: theme.ink,
          clipPath: `inset(0 ${(1 - clamp01(lift)) * 100}% 0 0)`,
        }}
      />
      {/* the unfilled remainder, lit as one continuous band on "the thing
          causing it doesn't show up" — the gap stops being a hairline bracket
          and becomes an object the size of the claim */}
      <div
        style={{
          position: "absolute",
          left: LANE_W * fill,
          top: trackTop,
          width: Math.max(0, LANE_W * track - LANE_W * fill),
          height: trackH,
          borderRadius: trackH / 2,
          background: theme.warm,
          // FULL STRENGTH, and revealed by a clip rather than by its own width
          // times its own alpha. The old form ramped opacity 0 -> 0.48 while
          // the box grew, which is a colour ease wearing a wipe's clothes: the
          // band spent its whole entrance below the strength it was solved for.
          // At alpha 1 over the new trough this is |dY| 49.4 (175.0 vs 125.6)
          // from the first painted pixel, and the solid fill to its left is a
          // different hue at a different luma, so done / not-done / not-yet
          // still read as three things.
          opacity: 1,
          clipPath: `inset(0 ${(1 - clamp01(ghost)) * 100}% 0 0)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: trackTop,
          width: LANE_W * track * fill,
          height: trackH,
          borderRadius: trackH / 2,
          background: fillColor,
        }}
      />
      {/* the finish colour crossfades over the top rather than swapping, so the
          change reads as the bar completing and not as a one-frame glitch */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: trackTop,
          width: LANE_W * track * fill,
          height: trackH,
          borderRadius: trackH / 2,
          background: tintColor,
          opacity: tint,
        }}
      />

      {/* ---- count-up. This is what actually carries the ratio: the frame loop A
              lands on 4,194,304, loop B reads a ninetieth of it. ------------- */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: COUNTER_Y,
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          lineHeight: COUNT_LINE_H,
          opacity: counterIn * counterDim * (1 - clamp01(contentOut * 6)),
          transform: `translateY(${(1 - counterIn) * 6}px)`,
        }}
      >
        <span style={{ position: "relative", display: "inline-block" }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: COUNT_SIZE,
              fontWeight: 700,
              color: theme.ink,
              letterSpacing: -1,
            }}
          >
            {comma(count)}
          </span>
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              fontFamily: MONO,
              fontSize: COUNT_SIZE,
              fontWeight: 700,
              color: tintColor,
              letterSpacing: -1,
              opacity: tint,
              whiteSpace: "nowrap",
            }}
          >
            {comma(count)}
          </span>
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: UNIT_SIZE,
            color: theme.dim,
            opacity: unitsIn,
            whiteSpace: "nowrap",
          }}
        >
          nodes
        </span>
      </div>

      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------

/**
 * A bordered annotation chip, positioned by its CENTRE.
 *
 * Centre-based on purpose: MergingChip has to start life at the exact box the
 * in-panel chip occupied, and matching two top-left corners through a lane
 * scale is how that quietly drifts. The height is computed from the font size
 * rather than left to the browser's default line box, so the bounds maths above
 * is arithmetic instead of a guess.
 *
 * `grammar` picks the entrance so the scene can rotate between a spring pop and
 * a mask wipe instead of firing four identical pops in a row.
 */
const Chip: React.FC<{
  p: number;
  opacity: number;
  cx: number;
  cy: number;
  width: number;
  text: string;
  color: string;
  size: number;
  grammar?: "pop" | "wipe";
}> = ({ p, opacity, cx, cy, width, text, color, size, grammar = "pop" }) => {
  const h = chipHeight(size);
  return (
    <div
      style={{
        position: "absolute",
        left: cx - width / 2,
        top: cy - h / 2,
        width,
        height: h,
        boxSizing: "border-box",
        textAlign: "center",
        padding: `${CHIP_PAD_Y}px 0`,
        border: `1px solid ${theme.stroke}`,
        borderRadius: 8,
        fontFamily: MONO,
        fontSize: size,
        lineHeight: `${size * CHIP_LINE_H}px`,
        fontWeight: 700,
        color,
        opacity: p * opacity,
        transform: grammar === "pop" ? `scale(${popScale(p)})` : undefined,
        clipPath:
          grammar === "wipe" ? `inset(0 ${(1 - p) * 100}% 0 0)` : undefined,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

/**
 * The 90x, and its dock.
 *
 * It lands oversized and compresses — a stamp arrives, it does not fly in from a
 * corner. Later it shrinks into loop B's empty badge slot instead of vanishing,
 * so the number stays on screen and stays attached to the bar it describes for
 * the whole back half of the hook, while the lower third clears for the receipt.
 */
const Stamp: React.FC<{
  inP: number;
  dock: number;
  rule: number;
  sub: number;
}> = ({ inP, dock, rule, sub: subP }) => {
  // Docks to the same centre as the DONE badge on loop A (LANE_W - 300 + 150),
  // so the two lanes end up with symmetric verdicts in the same slot.
  //
  // The docked size is the SANS floor, not the badge's MONO floor: this is the
  // only sans string in the beat, and sans caps are 0.70 of the font size where
  // mono caps are 0.73 — so BADGE_SIZE (56) rendered a 39.2px cap here, under
  // the 40px floor, for the 470 frames the number is docked. 58 puts it at 40.6
  // and the box at lane-local 595..653, still 3px clear of the panel bottom and
  // well above the track.
  const cx = interpolate(dock, [0, 1], [LANE_W / 2, LANE_W - 150]);
  const cy = interpolate(dock, [0, 1], [STAMP_CY, BADGE_Y]);
  const size = interpolate(dock, [0, 1], [STAMP_SIZE, MIN_SANS_FONT_SIZE]);
  const land = interpolate(inP, [0, 1], [1.14, 1]);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: cx - 200,
          top: cy - size * 0.6,
          width: 400,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: size,
          fontWeight: 900,
          letterSpacing: -4,
          lineHeight: 1,
          color: theme.warm,
          opacity: inP,
          transform: `scale(${land}) rotate(-3deg)`,
          transformOrigin: "50% 50%",
          // Black halo so the number stays readable if it ever overlaps a rule.
          textShadow: `0 0 30px ${theme.bg}`,
          whiteSpace: "nowrap",
        }}
      >
        90×
      </div>
      {/* line draw-on under the number — the visual tie back to the bar colour */}
      <div
        style={{
          position: "absolute",
          left: LANE_W / 2 - 110 * rule,
          top: RULE_Y,
          width: 220 * rule,
          height: 3,
          borderRadius: 2,
          background: theme.warm,
          opacity: 0.8,
        }}
      />
      {/* "same time" is load-bearing. The bar under this caption keeps moving
          for another 170 frames, so a bare "1/90 of the work" would read as a
          live readout of a bar that is visibly past 1/90 — it is a statement
          about the instant loop A finished, and it has to say so. */}
      <div
        style={{
          position: "absolute",
          left: SUB_CX - SUB_W / 2,
          top: SUB_Y,
          width: SUB_W,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: SUB_SIZE,
          lineHeight: CHIP_LINE_H,
          color: theme.dim,
          opacity: subP,
          transform: `translateY(${(1 - subP) * 6}px)`,
          whiteSpace: "nowrap",
        }}
      >
        same time — 1/90 the work
      </div>
    </>
  );
};

/**
 * Brackets the part of loop B's track that has not happened yet, and names it.
 *
 * It is a bracket, not a ring. The rename that used to live here ("the gap" ->
 * "not in the notation") moved up to the notation caption, where the words
 * "in the notation" actually have something to point at.
 */
const GapBracket: React.FC<{
  fill: number;
  draw: number;
  label: number;
  /** 0..1 empties the label slot before the measured version fills it. */
  countOut: number;
  /** 0..1 brings in "the gap — <nodes still owed>". */
  count: number;
}> = ({ fill, draw, label, countOut, count }) => {
  const x0 = LANE_W * fill + 16;
  const w = Math.max(0, LANE_W - x0) * draw;
  const cx = x0 + w / 2;

  return (
    <>
      {/* Loop B's own colour at 5px, not a 3px grey hairline. theme.stroke on
          black is a ~14% contrast line: it was drawing an event nobody could
          see on the sentence the whole back half of the hook turns on. */}
      <div
        style={{
          position: "absolute",
          left: x0,
          top: GAP_RULE_Y,
          width: w,
          height: 5,
          background: theme.warm,
          opacity: 0.8,
        }}
      />
      {/* end serifs, pointing back up at the track. Held at 12px tall: the
          counter row's box bottoms out at lane-local 774 and a taller serif
          would climb into it. */}
      {[x0, x0 + w].map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: GAP_RULE_Y - 12,
            width: 5,
            height: 12,
            background: theme.warm,
            opacity: 0.8 * draw,
          }}
        />
      ))}
      {/* The label slot. 760 wide centred on the bracket: cx runs lane-local
          428..452 over the label's life, so the box spans 48..832 — screen
          672..1519 under loop B's moved transform, inside the safe box. The
          measured string is 19 chars = 638px at the mono floor, so it fits the
          slot with room and never wraps. */}
      <div
        style={{
          position: "absolute",
          left: cx - 380,
          top: GAP_LABEL_Y,
          width: 760,
          height: GAP_LABEL_SIZE * CHIP_LINE_H,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: GAP_LABEL_SIZE,
          lineHeight: CHIP_LINE_H,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            color: theme.dim,
            opacity: label * (1 - countOut),
          }}
        >
          the gap
        </span>
        {/* Counts DOWN as loop B crawls: nodes it still owes, derived from the
            same fill the bracket is drawn from, so the number can never
            disagree with the bar it is measuring. */}
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            color: theme.warm,
            opacity: count,
          }}
        >
          the gap — {comma(NODES * (1 - fill))}
        </span>
      </div>
    </>
  );
};

/**
 * The last image of the hook: loop B's head, still inching, finally named.
 *
 * The caret blink is the only frame-driven thing in the scene — a blink has no
 * start and no end, which is exactly the carve-out the contract allows. Its
 * visibility is still progress-gated.
 */
const Waiting: React.FC<{ fill: number; p: number; frame: number }> = ({
  fill,
  p,
  frame,
}) => {
  const head = LANE_W * fill;
  const on = Math.floor(frame / 14) % 2 === 0; // ~1 Hz, a cursor not a strobe
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: head + 16,
          // BADGE_Y - 36, not - 24: the track grew from 26px to 42px and its
          // top edge came up from 676 to 666 (665.2 lifted), so the label's old
          // 606..673 box would have sat 8px INSIDE the bar it is naming. At -36
          // the box is 594..661 — 2px below the panel bottom at 592 and 4px
          // above the lifted track. fillB tops out near 0.17, so head <= 129
          // and "waiting" runs lane-local 145..380, screen 776..1030 under loop
          // B's moved transform, clear of the 1805 right margin.
          top: BADGE_Y - 36,
          fontFamily: MONO,
          fontSize: MIN_MONO_FONT_SIZE,
          lineHeight: CHIP_LINE_H,
          fontWeight: 700,
          color: theme.warm,
          opacity: p,
          transform: `scale(${popScale(p)})`,
          transformOrigin: "0% 50%",
          whiteSpace: "nowrap",
        }}
      >
        waiting
      </div>
      <div
        style={{
          position: "absolute",
          left: head + 2,
          // 8px wide, not 4. At the 240x135 grading proxy 4px is 0.5 of a pixel
          // — swscale's bicubic support is wider than a box, so a sub-8px rule
          // does not merely dim, it disappears. 8px is exactly 1 proxy pixel and
          // is the narrowest thing in this file that survives the downscale.
          // Box 658..708 hugs the track (666..708) without reaching the counter
          // row at 710.
          top: TRACK_Y - 8,
          width: 8,
          height: TRACK_H + 8,
          background: theme.warm,
          opacity: on ? p : 0,
        }}
      />
    </>
  );
};

/**
 * The brace over both panels for "byte for byte".
 *
 * Draw-on grammar: the crossbar grows out of the centre, then the two drops
 * extend down to the panel tops. It is the only element in the scene that
 * addresses both lanes at once, which is the entire claim of that sentence.
 */
const Brace: React.FC<{ p: number; label: number; opacity: number }> = ({
  p,
  label,
  opacity,
}) => {
  const barP = clamp01(p / 0.7);
  const dropP = clamp01((p - 0.6) / 0.4);
  const cxA = LANE_A_X + LANE_W / 2; // 520
  const cxB = LANE_B_X + LANE_W / 2; // 1400
  const halfW = ((cxB - cxA) / 2) * barP;

  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <div
        style={{
          position: "absolute",
          left: FRAME_CX - halfW,
          top: BRACE_Y,
          width: halfW * 2,
          height: 2,
          background: theme.stroke,
        }}
      />
      {[cxA, cxB].map((x) => (
        <div
          key={x}
          style={{
            position: "absolute",
            left: x,
            top: BRACE_Y,
            width: 2,
            height: 30 * dropP,
            background: theme.stroke,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: FRAME_CX - BRACE_LABEL_W / 2,
          top: BRACE_LABEL_Y,
          width: BRACE_LABEL_W,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: BRACE_LABEL_SIZE,
          lineHeight: CHIP_LINE_H,
          color: theme.dim,
          opacity: label,
          transform: `translateY(${(1 - label) * 6}px)`,
          whiteSpace: "nowrap",
        }}
      >
        byte for byte — identical
      </div>
    </div>
  );
};

/**
 * The compile-and-run line, plus the run's own first line of output.
 *
 * Verbatim from the header comment of bench/bench.c, and deliberately free of
 * any path: a real terminal capture would put the shell prompt — and therefore a
 * username — into the highest-retention seconds this channel has.
 *
 * The result line is the sub-reveal that keeps ep 253 alive: without it the gap
 * between the command landing (ep 203) and the lane reframe (ep 304) is 101
 * frames of nothing, which is the 3-second rule broken by a second and a half.
 */
// Shortened at the type raise, not shrunk to fit: `-o bench` is implied by
// `./bench` on the same line, so the flag that actually matters to a perf claim
// (-O2) survives and 9 characters do not.
const CMD = "$ cc -O2 bench.c && ./bench";
// JetBrains Mono advance width is 0.6em; the box is sized from the string so the
// left-to-right wipe starts at the first glyph instead of in empty space.
// 27 chars at 56px -> 907px, centred at 960, x 506..1413.
const CMD_ADV = CMD_SIZE * 0.6;
const CMD_W = CMD.length * CMD_ADV;

/**
 * The two measurements the run printed, as filled chips (D9a).
 *
 * Both strings are verbatim from `bench/output.txt`. Text sits on the mono
 * floor in black on a solid lane-coloured fill, so each chip is ~3% of the
 * frame rather than the ~0.35% the old dim-grey inline string was.
 *
 * Geometry: the pair is centred at 960 on the row ABOVE the command, in the
 * band the docked 90x numeral vacates at ep 234 (it occupied 789..917) and
 * that the gap bracket does not claim until ep 425. Chips are 104 tall at
 * top 800 -> 800..904, 42px clear of the command row at 946.
 */
const RESULT_H = 104;
const RESULT_Y = 800;
const RESULT_GAP = 24;
const RESULT_PAD_X = 16;
const resultW = (s: string) => s.length * CMD_ADV + RESULT_PAD_X * 2;
const RESULT_A = "sequential  1.18 ns"; // 670px
const RESULT_B = "random  107.74 ns"; // 603px
const RESULT_ROW_W = resultW(RESULT_A) + RESULT_GAP + resultW(RESULT_B); // 1297

const ResultChip: React.FC<{ text: string; fill: string; p: number }> = ({
  text,
  fill,
  p,
}) => (
  <div
    style={{
      width: resultW(text),
      height: RESULT_H,
      borderRadius: 6,
      background: fill,
      color: theme.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: MONO,
      fontSize: CMD_SIZE,
      lineHeight: `${CMD_SIZE}px`,
      whiteSpace: "pre",
      // Mask-wipe, not a fade: every pixel is black-on-fill at full strength
      // or absent, so the reveal never spends frames as a low-contrast wash.
      clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
    }}
  >
    {text}
  </div>
);

const CommandLine: React.FC<{
  p: number;
  resultA: number;
  resultB: number;
  resultOut: number;
  opacity: number;
}> = ({ p, resultA, resultB, resultOut, opacity }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: FRAME_CX - RESULT_ROW_W / 2,
        top: RESULT_Y,
        display: "flex",
        gap: RESULT_GAP,
        opacity: opacity * (1 - resultOut),
        transform: `translateY(${resultOut * 18}px)`,
      }}
    >
      <ResultChip text={RESULT_A} fill={theme.accent} p={resultA} />
      <ResultChip text={RESULT_B} fill={theme.warm} p={resultB} />
    </div>
    <div
      style={{
        position: "absolute",
        left: FRAME_CX - CMD_W / 2,
        top: CMD_Y,
        width: CMD_W,
        fontFamily: MONO,
        fontSize: CMD_SIZE,
        lineHeight: `${CMD_SIZE}px`,
        whiteSpace: "pre",
        opacity,
      }}
    >
      <span
        style={{
          display: "inline-block",
          opacity: p,
          clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
        }}
      >
        <span style={{ color: theme.dim, fontWeight: 700 }}>$ </span>
        <span style={{ color: theme.up }}>{CMD.slice(2)}</span>
      </span>
    </div>
  </>
);

/**
 * Loop B's O(n) chip, flying from its panel up to the notation row.
 *
 * Transform over add/remove: nothing is deleted and nothing pops — the chip
 * that described the code becomes the chip the caption talks about. On
 * "notation" it desaturates from accent to dim, which is the visible half of
 * "the thing causing it doesn't show up in the notation at all".
 *
 * It starts at the LANE's scale, not at 1, so the handoff frame is not a jump
 * in size.
 */
const MergingChip: React.FC<{
  from: { x: number; y: number; scale: number };
  p: number;
  opacity: number;
}> = ({ from, p, opacity }) => {
  if (p <= 0) return null;
  const x = interpolate(p, [0, 1], [from.x, MERGE_CX]);
  const y = interpolate(p, [0, 1], [from.y, MERGE_CY]);
  const s = interpolate(p, [0, 1], [from.scale, 1]);
  const h = chipHeight(ON_CHIP_SIZE);

  return (
    <div
      style={{
        position: "absolute",
        left: x - ON_CHIP_W / 2,
        top: y - h / 2,
        width: ON_CHIP_W,
        height: h,
        boxSizing: "border-box",
        textAlign: "center",
        padding: `${CHIP_PAD_Y}px 0`,
        border: `1px solid ${theme.stroke}`,
        borderRadius: 8,
        fontFamily: MONO,
        fontSize: ON_CHIP_SIZE,
        lineHeight: `${ON_CHIP_SIZE * CHIP_LINE_H}px`,
        fontWeight: 700,
        color: theme.accent,
        opacity: clamp01(opacity),
        transform: `scale(${s})`,
        transformOrigin: "50% 50%",
        whiteSpace: "nowrap",
      }}
    >
      O(n)
    </div>
  );
};

/**
 * THE NOTATION BANNER — the flown chip's landing pad, and MAJOR #1 of the
 * hook's back half. See NOTE_BANNER_X for the measured arithmetic.
 *
 * One `clipPath` on the wrapper reveals plate, chip and caption together, so
 * there is no frame on which an empty bordered box exists. The wipe is linear
 * (`p` comes from `linSub`) and the plate's height is constant, so the swept
 * AREA advances at a constant 1.190% of frame per episode frame.
 *
 * No transform is applied to this subtree, so the 56px mono inside it renders
 * at 56px — 40.7px of cap height, over the readability floor.
 */
const NotationBanner: React.FC<{ p: number; opacity: number }> = ({
  p,
  opacity,
}) => {
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: NOTE_BANNER_X,
        top: NOTE_BANNER_Y,
        width: NOTE_BANNER_W,
        height: NOTE_BANNER_H,
        background: theme.accent,
        borderRadius: 10,
        opacity: clamp01(opacity),
        clipPath: `inset(0 ${(1 - clamp01(p)) * 100}% 0 0)`,
      }}
    >
      {/* The chip, redrawn on the field: a dark box on accent rather than an
          accent box on black, which is the same object under new lighting. */}
      <div
        style={{
          position: "absolute",
          left: NOTE_ROW_X - NOTE_BANNER_X,
          top: (NOTE_BANNER_H - chipHeight(ON_CHIP_SIZE)) / 2,
          width: ON_CHIP_W,
          height: chipHeight(ON_CHIP_SIZE),
          boxSizing: "border-box",
          textAlign: "center",
          padding: `${CHIP_PAD_Y}px 0`,
          background: theme.bg,
          borderRadius: 8,
          fontFamily: MONO,
          fontSize: ON_CHIP_SIZE,
          lineHeight: `${ON_CHIP_SIZE * CHIP_LINE_H}px`,
          fontWeight: 700,
          color: theme.accent,
          whiteSpace: "nowrap",
        }}
      >
        O(n)
      </div>
      <div
        style={{
          position: "absolute",
          left: NOTE_ROW_X - NOTE_BANNER_X + ON_CHIP_W + NOTE_GAP, // 242
          top: (NOTE_BANNER_H - NOTE_CAP_SIZE * CHIP_LINE_H) / 2,
          width: NOTE_CAP_W,
          height: NOTE_CAP_SIZE * CHIP_LINE_H,
          fontFamily: MONO,
          fontSize: NOTE_CAP_SIZE,
          lineHeight: `${NOTE_CAP_SIZE * CHIP_LINE_H}px`,
          fontWeight: 600,
          // theme.bg on theme.accent: 153 vs 0, the field's own contrast pair.
          color: theme.bg,
          whiteSpace: "nowrap",
        }}
      >
        the notation says they&apos;re identical
      </div>
    </div>
  );
};

/**
 * THE VOID PLATE — MAJOR #2 of the hook's back half, in the hole loop A left.
 * See VOID_X for the measured arithmetic. Constant width, linear top-down clip,
 * contents inside the clip, no ancestor scale.
 */
const VoidPlate: React.FC<{ p: number; opacity: number }> = ({
  p,
  opacity,
}) => {
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: VOID_X,
        top: VOID_Y,
        width: VOID_W,
        height: VOID_H,
        background: theme.down,
        borderRadius: 12,
        opacity: clamp01(opacity),
        clipPath: `inset(0 0 ${(1 - clamp01(p)) * 100}% 0)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: `0 ${VOID_PAD}px`,
        boxSizing: "border-box",
        fontFamily: MONO,
        fontSize: MIN_MONO_FONT_SIZE,
        lineHeight: `${MIN_MONO_FONT_SIZE * VOID_LINE_H}px`,
        fontWeight: 700,
        // theme.bg on theme.down: 130 vs 0, 6.0:1.
        color: theme.bg,
        whiteSpace: "nowrap",
      }}
    >
      {VOID_LINES.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
};
