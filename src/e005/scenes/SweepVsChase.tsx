import React from "react";
import { Easing, interpolate } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { MemoryGrid, theme } from "../../components";
import { TYPE } from "../../components/theme";

// Same mono family as FakeTerminal/ReceiptPanel/HiddenAssumption. Annotations
// are machine readouts and must read as machine readouts; a second mono face in
// one episode is an identity leak.
const mono = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
const MONO = mono.fontFamily;
const SANS =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Build steps, named exactly as in this beat's `build:` list in script.yaml. */
export type SweepVsChaseStep =
  | "grid_widen"
  | "sweep_cursor"
  | "line_lights_whole"
  | "prefetch_ghosts"
  | "camera_move_right"
  | "scatter_nodes"
  | "pointer_hops_stall"
  | "split_screen_hold";

export const SWEEP_VS_CHASE_STEPS: SweepVsChaseStep[] = [
  "grid_widen",
  "sweep_cursor",
  "line_lights_whole",
  "prefetch_ghosts",
  "camera_move_right",
  "scatter_nodes",
  "pointer_hops_stall",
  "split_screen_hold",
];

export interface SweepVsChaseProps {
  /** 0..1 per step; absent = 0 = not started. Caller maps timing.json marks. */
  p: Partial<Record<SweepVsChaseStep, number>>;
  /** Absolute frame, for idle micro-motion ONLY. Everything else is progress-driven. */
  frame?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });
// Camera moves accelerate AND decelerate — an ease-out camera starts at full
// speed, which reads as a cut with extra steps rather than as travel.
const easeCam = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * A theme colour at low alpha. Derived, never a second hand-written literal:
 * the fills below used to be `rgba(248, 81, 73, 0.35)` — correct today, silently
 * off-palette the day theme.down changes, and indistinguishable from a stray hex
 * to anyone auditing the file.
 */
const alpha = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/**
 * Snappy entrance curve: settles from 0.94 with a small overshoot. Never from
 * 0 — scaling out of nothing is the pop-up-ad look the variety rules ban.
 */
const popScale = (t: number) =>
  interpolate(clamp01(t), [0, 0.55, 0.8, 1], [0.94, 1.03, 0.995, 1], {
    easing: Easing.out(Easing.quad),
  });

/**
 * CALLER CONTRACT — read before wiring this to timing.json.
 *
 * Window, from the CURRENT timing.json: `sweep_vs_chase` starts at frame 7092,
 * `drepper_experiment` at 8798, so this beat runs 1706 frames (56.9s) — the
 * longest in the episode. Two live marks, both beat-relative below:
 *
 *   sweep  word "That"  abs 7598  rel  506   ("That pattern's a sweep")
 *   chase  word "Every" abs 8686  rel 1594   ("Every hop stalls at full price")
 *
 * The step budget below is the narration's own phrasing, with the two marks as
 * hard anchors and the spans between them apportioned by word count. The caller
 * MUST ramp each step across its whole span (not across 8 frames) — hand one of
 * these a REVEAL_FRAMES ramp and you get a flurry followed by a 15-second dead
 * hold. Steps must also be monotonic, non-overlapping and left at 1 once
 * finished: `chaseP` and `leftMode` read two steps at once and a step that
 * decays back toward 0 rewinds the walk.
 *
 *   grid_widen         rel    0 ->  175   "this one picture is the entire episode"
 *   sweep_cursor       rel  175 ->  360   "the first read misses and pays full price"
 *   line_lights_whole  rel  360 ->  545   "the whole cache line comes back with it"
 *   prefetch_ghosts    rel  545 -> 1040   "...and once it locks on, the latency vanishes"
 *   camera_move_right  rel 1040 -> 1115   "now the same data as a linked list"
 *   scatter_nodes      rel 1115 -> 1230   "...wherever the allocator felt like"
 *   pointer_hops_stall rel 1230 -> 1590   "nothing on the chip can fetch ahead"
 *   split_screen_hold  rel 1590 -> 1706   ON the `chase` mark, held to the end
 *
 * EVENT LADDER through the beat's first 545 frames, which is where round-5
 * measured three static holds (+2..+109, +178..+270, +270..+367). Only events
 * over the grader's threshold (>=0.3% of the frame at |dLuma|>=25) are listed —
 * a 1px dashed bracket and a 4-character label are NOT events, which is exactly
 * why the old staging measured static:
 *
 *   0/16/32/48/64/80/96/112 the grid uncovers ROW BY ROW, each row arriving
 *   under a 1.56%-of-frame wash | 105 "row = one line" chip | 130 lane
 *   subtitle | 158 row-0 bracket + "64 B" | 176 cost strip on | 194 "read #1 -
 *   miss" chip | 240 wait bar fills + its label | 251 the price plate wipes
 *   into the rail (4.56% of frame) | 292 it grows and takes its "full price"
 *   label (another 4.56%) | 360 the line arrives whole | 372 the plate leaves
 *   (9.13%) | 412 "arrives whole" chip | 462-490 free-tag cascade | 495 SWEEP
 *
 * ROUND 10 rewrote rel 240-372 of that list. What was there — a 14px wait bar
 * creeping for 121 frames, its label, and a 10-character rail tag — measured
 * f7298-7457 (rel 206-365) as 5.33s of nothing: median inter-frame ink 0.000%,
 * peak 1.23% over any 6-frame window. Those three entries were all real, all on
 * their words, and all one to two orders of magnitude under the repaint the
 * detector (and the eye) needs. The tag is now the plate; see the PRICE_* block
 * for the arithmetic. Gaps through the rewritten stretch are 57 / 41 / 68 / 12 /
 * 40 frames, and if rel 360 is ever measured short (the row-0 line container is
 * 1.63% of frame over 8 frames — under the bar on its own) the worst case is
 * still 292 -> 372, 80 frames, 2.67s.
 *
 * Longest gap in that run is 68 frames (2.27s), and every gap after rel 545 is
 * under 70: the two long steps are carried by the six rail notes and by the
 * cost strip, which draws a bar every ~8 frames throughout. Ambient drift is
 * not counted as an event anywhere here.
 *
 * ROUND 11 CHANGED NOTHING IN THAT LADDER, and that is the point. The r10 grade
 * measured this beat at 105 content events, 18.46 per 10s — the highest rate in
 * the cut — and still failed it, on a SECOND metric the ladder above cannot
 * see: EMPTY FRAME, the fraction of the frame at luma >= 110, where any stretch
 * under 1% lit for >= 2s is an "empty run". Two windows failed it:
 *
 *   f7092-7200  3.63s at 0.35% lit   the beat's own opening
 *   f8150-8263  3.80s at 0.25% lit   the camera arriving in the right lane
 *
 * Both were fully staged and on their words. They were unlit, which is a
 * different property from unstaged and needs different arithmetic: an event is
 * a DIFFERENCE of >=25 luma, so theme.stroke (luma 91), a white wash at
 * IDLE_MIN_ALPHA (89) and MemoryGrid's transparent idle cell can all produce
 * events all day and put not one pixel over 110. Beat median is 7.1% lit, so
 * these two windows are not a beat-wide dimness problem — they are the two
 * places where the lit layer drains away and nothing replaces it. The fixes are
 * the `--- the arrival wash ---` and `--- the right lane's arrival wash ---`
 * blocks below, plus solid NodeMarks and the right lane's first chip at
 * `scatter_nodes` 0.05; every one of them re-lights an element that was already
 * on screen rather than adding a new one.
 *
 * The numbers also size entrances: an entrance has to be ~8 frames wall-clock,
 * and 8 frames is 4.6% of a 175-frame step and 1.6% of a 495-frame one. Without
 * this table the chips inside `prefetch_ghosts` would take a lazy 40 frames to
 * arrive and the beat would read sleepy — the failure that got ep003 called
 * unpostable. If the audio is regenerated, re-derive this table from
 * timing.json; a stale table silently slides both keyword moments off their
 * marks.
 */
const STEP_FRAMES: Record<SweepVsChaseStep, number> = {
  grid_widen: 175,
  sweep_cursor: 185,
  line_lights_whole: 185,
  prefetch_ghosts: 495,
  camera_move_right: 75,
  scatter_nodes: 115,
  pointer_hops_stall: 360,
  split_screen_hold: 116,
};
const ENTRANCE_FRAMES = 8;

/** Progress of an element that enters at `from` and takes ~8 frames to land. */
const entrance = (v: number, from: number, step: SweepVsChaseStep) =>
  entranceN(v, from, step, ENTRANCE_FRAMES);

/** Same, for the few elements too big to land in 8 frames (the grid wipe). */
const entranceN = (
  v: number,
  from: number,
  step: SweepVsChaseStep,
  frames: number,
) => clamp01((v - from) / (frames / STEP_FRAMES[step]));

// --- world layout ----------------------------------------------------------
// ONE coordinate space holding BOTH behaviours side by side, because the camera
// travels between them instead of popups swapping in place. Every screen
// position in this file is (world - camera) * scale + centre, so the safe-margin
// check only has to be done once per camera shot (see CAM_* below).
//
// REGION_W WAS 890, and that single number caused grader defect D9. The near
// shot is HEIGHT-bound, never width-bound: 780 * 1.15 = 897 of the 950 safe
// pixels vertically, but only 1024 of the 1690 safe pixels horizontally. Two
// thirds of a megapixel of frame sat empty, the annotation column was squeezed
// to 414px, and its type had to be 26px — which is 29.9px on screen, 40% under
// the 40px readability floor. Widening the region to 1430 (1430 * 1.15 = 1645,
// screen x 137..1782) buys the column 520px and its type 36px = 41.4px on
// screen, with CAM_NEAR untouched.
const REGION_W = 1430;
const REGION_H = 800;
// The LEFT near shot frames world x -119.8 .. 1549.8, so any right-lane content
// starting below x 1564 would peek into frame before it is narrated. 1600 also
// leaves 200px between the left lane's annotation column (which ends at 1400)
// and the right lane's first pixel, so the two lanes never overlap in world
// space even mid-pan when both are on screen.
const RIGHT_X = 1600;

// Region-local slots. Vertical budget, all verified against the near shot
// (camY 400, scale 1.15 -> world y 0 is screen 80, world y 802 is screen 1002):
//   header  -4..119   title -4..54 | rule 58..62 | subtitle 68..119
//   grid     120..600 (GRID_H 480), row-0 line container starts at 114
//   readout  612..661 (MemoryGrid's own, at GRID_Y + GRID_H + READOUT_GAP,
//            now at the mono floor: 48.7 grid-local = 56 on screen)
//   label    668..719 ("cost per read", TYPE_ANNO at lineHeight 1)
//   bars     720..800 (STRIP_BASE - STRIP_MAX_H .. STRIP_BASE)
//
// The header rows moved down-and-apart when the type went to the cap-height
// floor: a TYPE_HEAD line is 58 tall now, not 46, so the old rule at 52 would
// have been struck through the title. TITLE_Y goes slightly NEGATIVE to buy the
// subtitle its extra 12px without pushing it into the grid's row-0 bracket at
// y 114. At CAM_NEAR that puts the title's top at screen y 75 — inside the 65
// margin even with the +-3px ambient drift.
const TITLE_Y = -4;
const RULE_Y = 58;
const SUB_Y = 68;
// Where the big keyword docks: the title's own row, right of the title. At the
// floor a title line is 58px, so "LINKED LIST" would measure ~445px and its
// dock slot would land the counter-scaled word past the 1805 margin at the
// split (see the DOCK_X budget under `--- type scale ---`). The title is
// shortened to "LIST" instead of shrinking the type, which frees DOCK_X to sit
// at 220: 162px of title, a 58px gutter, and the docked word's far edge at
// screen 1590 in the wide shot.
const DOCK_X = 220;
const GRID_X = 0;
const GRID_Y = 120;
// 880, not 470: the column has to clear BOTH of the things that live under the
// grid and run wider than it — MemoryGrid's readout row (~620px) and this
// file's cost strip (63 * 13.5 + 8 = 858.5px). Clearing them in x is what frees
// the whole 92..688 vertical band for four cards at 36px type; the old column
// was boxed into 92..606 and had to shrink its type to fit.
const COL_X = 880;
// Content box is 520 - 36px padding = 484px. At the mono floor (TYPE_ANNO, and
// JetBrains Mono's advance is exactly 0.6em) that is 484 / (51 * 0.6) = 15.8
// characters, so EVERY chip title is now <= 15 chars. The old 18-21-char
// titles were sentences at 36px; they are cut to 1-4-word noun phrases rather
// than shrunk back under the floor. Right edge still lands at region x 1400 =
// screen 1747.75 in the near shot, 57px inside the 1805 margin.
const COL_W = 520;
// Slot tops, derived from the chip heights rather than a pretty pitch. With the
// pinned lineHeights below (1.15, so a TYPE_ANNO line is 59px) a chip is exactly
// 152px (title + sub) or 178px (title + WaitBar). The column's usable band is
// world y -13..813 (the near shot maps that to screen 65..1015), and these tops
// give a >=26px gutter in both lanes:
//   left   60..212 | 238..416 | 442..594 | 620..798
//   right  60..212 | 238..390 | 442..594 | 620..798
const CHIP_Y = [60, 238, 442, 620];
const STRIP_LABEL_Y = 668;
const STRIP_BASE = REGION_H;
const STRIP_MAX_H = 80;

// --- camera shots ----------------------------------------------------------
// Near shots frame one lane; the wide shot is the split screen. Verified in
// screen space: near puts the region at x 137..1782, y 80..1000; wide puts both
// lanes' split-visible content at x 130..1790, y 284..797. Both inside
// [115,1805] x [65,1015] with the +-3px ambient drift applied.
const CAM_NEAR = 1.15;
const CAM_WIDE = 0.64;
const CAM_LEFT_X = REGION_W / 2; // 715
const CAM_RIGHT_X = RIGHT_X + REGION_W / 2; // 2315
// The annotation columns are gone by the split, so a lane's SPLIT-VISIBLE
// content is only [SPLIT_L, SPLIT_R]: header, grid, cost strip, and the docked
// keyword at its counter-scaled position (DOCK_X * HEADER_WIDE = 352, plus at
// most 305px of word). Framing the wide shot on that, rather than on the full
// 1430-wide region, is what keeps CAM_WIDE at 0.64 instead of 0.55 — and 0.55
// would have put the counter-scaled header back under the readability floor.
const SPLIT_L = -14;
const SPLIT_R = 960;
const CAM_WIDE_X = (SPLIT_L + RIGHT_X + SPLIT_R) / 2; // 1273
// The lane's FULL content extent, which is NOT SPLIT_R. SPLIT_R frames the wide
// shot, where the annotation columns are already gone; `laneVis` culls on the
// widest thing the lane ever draws, and that is the annotation column's right
// edge at COL_X + COL_W = 1400. Using SPLIT_R there was defect D5's second
// cliff: mid-pan the lane was multiplied to zero while 520 world px of lit chip
// were still sitting in the middle of the safe box. Every end state is
// unchanged by the swap — near-left maps 1400 to screen 1747.75 and near-right
// to 1149.75..1747.75, and at the split both lanes' visible widths (905 / 645)
// are far past the ramp's top either way.
const LANE_R = COL_X + COL_W; // 1400
const CAM_Y = REGION_H / 2;

// --- type scale ------------------------------------------------------------
// The floor is 40px CAP HEIGHT ON SCREEN (theme.ts), i.e. a 58px sans / 56px
// mono font-size measured AFTER the camera. This scene renders in world units,
// so a token has to be divided by the camera scale it will be seen through —
// that division is the only reason these are not the raw token numbers.
//
//   TYPE_ANNO 51 = ceil(58 / CAM_NEAR): 58.6 sans / 58.6 mono on screen at the
//                  near shots, both above their floor. (The old 36 was 41.4 on
//                  screen — a 29px cap, 27% under.)
//   TYPE_HEAD 58 = the sans token itself, and the near shot only makes it
//                  bigger (66.7 on screen).
//
// Nothing at TYPE_ANNO survives the wide split shot (51 * 0.64 = 33), which is
// why the annotation column is faded OUT before the pull-out begins and the
// lane header counter-scales by HEADER_WIDE instead:
// 58 * 1.6 * 0.64 = 59.4 on screen, still over the sans floor.
//
// DOCK_X BUDGET (why the right lane's title had to be shortened): because
// HEADER_WIDE is pinned by the floor, HEADER_WIDE * CAM_WIDE is the constant
// 1.024, so the docked word's far screen edge is
//   960 + (RIGHT_X + DOCK_X * HEADER_WIDE - CAM_WIDE_X) * CAM_WIDE + wordWidth
//   = 1364 + 1.024 * DOCK_X  (for a 5-char word)
// and 1805 therefore caps DOCK_X at 430. "LINKED LIST" needs DOCK_X 470.
const TYPE_ANNO = Math.ceil(TYPE.label.fontSize / CAM_NEAR); // 51
const TYPE_HEAD = TYPE.label.fontSize; // 58
const HEADER_WIDE = 1.6;

// --- safe margins ----------------------------------------------------------
// Text bounds for this episode. Used numerically, not as a comment: `laneVis`
// below culls a lane the moment its visible width inside this box collapses,
// which is the structural fix for grader defect D4 (three annotation cards
// parked in the leftmost 2.5% of the frame for 18.6 seconds).
const SAFE_L = 115;
const SAFE_R = 1805;
// The screen-space edge mask, and the fix for grader ND-5/DF-11. The old ramp
// ran from x 40 to SAFE_L, i.e. it FEATHERED ACROSS THE BANNED BAND: every
// glyph sliding out of frame sat part-lit between 40 and 115 on its way, which
// is precisely the "up to 1,152 bright pixels inside the 6% margin" measured at
// f8142-8166 and f8712-8721. Alpha is now hard zero everywhere left of SAFE_L
// and right of SAFE_R, with the 6px feather INSIDE the box purely to antialias
// the cut. Verified against the leftmost thing this scene ever draws — the row-0
// bracket and glide band at region x -10, which map to screen 126.25 in both
// near shots and 138.9 at the split, so 123.25 at worst drift is still clear of
// the feather's opaque end at SAFE_L + 6.
const MASK_FEATHER = 6;
const EDGE_MASK =
  `linear-gradient(to right, transparent 0px, transparent ${SAFE_L}px, ` +
  `#000 ${SAFE_L + MASK_FEATHER}px, #000 ${SAFE_R - MASK_FEATHER}px, ` +
  `transparent ${SAFE_R}px, transparent 1920px)`;

// --- grid geometry ---------------------------------------------------------
// MIRRORS MemoryGrid's private CELL / GAP / LINE_GAP. It doesn't export them and
// this file may not edit it, but the pointer arrows and node marks have to land
// dead centre in real cells — if these three numbers ever drift from
// MemoryGrid.tsx the arrows quietly point at gutters. Change them together.
const CELL = 46;
const GAP = 5;
const LINE_GAP = 16;
const ROWS = 8;
const COLS = 8;
const TOTAL = ROWS * COLS;
const GRID_W = COLS * CELL + (COLS - 1) * GAP;
const GRID_H = ROWS * CELL + (ROWS - 1) * LINE_GAP;

// --- the arrival wash ------------------------------------------------------
// The lit band that sits BEHIND a grid row as it arrives. Both lanes use it, and
// both numbers are measured against the r10 EMPTY-FRAME metric rather than
// chosen — that metric is the fraction of the frame at luma >= 110, and any
// stretch under 1% lit for >= 2s is an "empty run".
//
// ALPHA. White at IDLE_MIN_ALPHA (0.35) composites to luma 89 over pure black.
// That clears the 3:1 CONTRAST floor and contributes exactly ZERO lit area,
// which is how this beat's own opening measured 0.35% lit for 3.63 seconds
// (f7092-7200) while eight row washes and eight rows of grid arrived inside it.
// Nothing else in `grid_widen` is above the gate either: theme.stroke is luma
// 91, MemoryGrid's idle cell is transparent, and its readout does not render
// outside sweep/chase — so the only lit pixels in the shot were the five glyphs
// of "ARRAY", ~0.3% of frame. 0.50 = luma 127.5 (5.28:1), 17 luma of headroom,
// which is what lets the metric's 8x box pooling eat the band's edges and still
// count its interior.
//
// HOLD. Raising the alpha alone buys nothing, because the wash is a DECAYING
// flash: on a 20-frame cubic-out decay a 0.50 band falls back under 0.4314
// (luma 110) in 0.95 frames. So a band now holds at FULL for HOLD frames after
// its row finishes uncovering and only then decays. On the left lane's 16-frame
// row pitch, 26 is a coverage ratio of 1.625 — one band is always at full and
// two are for 10 frames in every 16, i.e. 1.57%-3.13% lit continuously from
// gwF 9 (abs 7101) to gwF 147 (abs 7241), by which point the "row = one line"
// chip's tone band (2.70%) has been up for 37 frames.
//
// It is still a flash and not a bed. A permanent luma-127 layer under MemoryGrid
// would composite its loaded cells (accent @ 0.56) from luma 156 to 190 and
// flatten the component's whole contrast ladder; the left lane's last band is at
// zero by gwF 167 (abs 7261) and `leftMode` does not leave `idle` until
// `sweep_cursor` starts at abs 7269, so no cell is ever composited over one.
const WASH_ALPHA = 0.5;
const WASH_HOLD = 26;
const WASH_DECAY = 20;

// --- the right lane's arrival wash -----------------------------------------
// `camera_move_right` narrates "now the same data as a linked list", and the
// camera used to land on a grid that was, to the empty-frame metric, not there.
// MemoryGrid in `idle` mode is transparent cells inside luma-91 borders, it
// prints no readout outside sweep/chase, and NodeMarks had not started. So
// between the left lane's annotation column retiring and the right lane's first
// chip (abs 8261) the only lit pixels in the frame were "LIST" and its
// subtitle: 0.25% lit for 3.80 seconds, measured f8150-8263. That is the
// retire-cliff shape — a whole layer multiplied by 1 - t, four chip tone bands
// (~10.8% of frame) gone in eight frames with nothing arriving to replace them.
//
// r11 added this wash and r12 measured the run down to f8150-8180, 31 frames
// with twenty of them at EXACTLY 0.000% lit — grader defect D5. The wash was
// never the problem; its GATE was, in three places, and all three are fixed at
// the call site rather than here (see `headVis`, `detailLeft` and `rightOn`).
// What this block still owns is the pitch, and RWASH_FROM moves with them.
//
// The replacement is the beat's OWN OPENING GRAMMAR, reused on the lane it is a
// mirror of: the right grid's rows arrive under the same wash the left grid's
// did, which is what "the same data" means. In PAIRS rather than one at a time,
// and that is arithmetic, not taste — one band is 1.565% of frame, so a single
// band wiping on over 6 frames presents 1.565 * 6 / 6 = 1.57 against the
// content-event gate of 2.0 and does not count. A pair spans both rows AND the
// LINE_GAP between them: 423 x 120 world = 50,760 px, 67,130 on screen after
// CAM_NEAR, 3.24% of the frame, presenting 3.24 * 6 / 6 = 3.24. Over the gate.
//
// The clock is `rightF` — frames since `camera_move_right` began, carried
// across the step boundary into `scatter_nodes` so a pair can hold and decay
// past it. Because both steps convert progress to frames at their own nominal
// length, `rightF` is exactly `frame - 8132` for the whole of this stretch.
// Four pairs on a 10-frame pitch, each wiping on in 6, holding 15, decaying 14:
//
//   pair 0  wipe 8162-8168 | full 8168-8188 | gone 8202
//   pair 1  wipe 8172-8178 | full 8178-8198 | gone 8212
//   pair 2  wipe 8182-8188 | full 8188-8208 | gone 8222
//   pair 3  wipe 8192-8198 | full 8198-8218 | gone 8232
//
// and the right lane's first chip — `scatter_nodes` 0.02, lit from ~8215 —
// picks the ladder up while pair 3 is still at full.
//
// RWASH_FROM WAS 44 (pair 0 at abs 8179) AND THAT WAS DEFECT D5's arriving
// half. It was chosen against the OLD `rightOn` gate of 0.5, whose ease-out
// only crossed the wash's lit threshold (rightOn >= 0.8627, where a 0.50 band
// still composites over luma 110) at moveStep 0.645 = abs f8180 — which is
// precisely the frame the r12 render first measures above 1% lit, thirty-one
// frames after the left lane went dark. Moving this number alone would have
// bought nothing: the gate, not the pitch, set the lit onset. With `rightOn`
// now ramping 0.30 -> 0.45 the threshold is crossed at abs f8160, so 30 puts
// pair 0's wipe (8162-8168) against a lane that is already 93% up AND already
// 64% inside the safe box, rising to 100% at moveStep 0.444 = f8165.3 as the
// band finishes entering frame.
//
// HOLD IS 20, NOT 15, AND THE DECAY IS WHY. A band's DECAY is cosmetic but it
// is not lit: `ease` is cubic-out, so a 0.50 band falls under luma 110 (alpha
// 0.4314) once `1 - ease(x) < 0.8627`, i.e. `x < 0.0476` — two thirds of one
// frame into a 14-frame decay. A pair's LIT life is therefore its wipe plus its
// hold plus ~1, and nothing more, no matter how long the tail is drawn for. At
// hold 15 the last pair's lit life ended at abs 8214 and the right lane's first
// chip only crosses luma 110 at ~8215.7, which measured as a 2-frame hole at
// f8217-8218 (0.367% / 0.330% lit) in the first fixed render — a flicker, and
// the same handoff-through-a-gap mistake as D5 itself, three orders of
// magnitude smaller. 20 runs pair 3's hold to 8218 and its lit life to ~8219,
// six frames past the chip. The pitch is untouched, so this only ever means one
// extra pair at full at a time: peak lit goes 6.5% -> 9.7% of frame across
// f8188-8208, still under the left lane's own opening.
//
// It is gone by abs 8232, which is what keeps it off MemoryGrid's contrast
// ladder: `rightMode` stays `idle` until `pointer_hops_stall` at 8324, so no
// cell is ever composited over a lit band. The only things that do land under
// one are NodeMarks on rows 6-7 before 8218 — at most one node, by the hash
// stagger — and those are theme.dim at luma 147 over 127.
const RWASH_PAIRS = 4;
const RWASH_FROM = 30;
const RWASH_PITCH = 10;
const RWASH_WIPE = 6;
const RWASH_HOLD = 20;
const RWASH_DECAY = 14;

// --- the allocator pass -----------------------------------------------------
// ROUND 12. `scatter_nodes` runs abs 8210-8324 and its ENTIRE visual payload is
// NodeMarks. Round 11 sized those marks against the LIT metric (empty-frame,
// luma >= 110) and won that argument — 28 solid dim squares are 1.61% of frame
// where the old outlines were 0.000%. But it never checked the OTHER gate. The
// content-event detector wants either 0.3% of the frame changed in ONE frame or
// 2.0% inside a 6-frame window, and NodeMarks can satisfy neither at ANY
// timing: 1.61% is the total, spread over ~102 frames of hash stagger, which
// presents 1.61 * 6 / 102 = 0.095 against a floor of 2.0. Even collapsing all
// 28 into a single frame would only reach 1.61 < 2.0. The marks are not a
// reveal; they are a state. So f8231-8323 measured 3.10s with no content event
// — the longest static hold in the beat — and no amount of re-timing the marks
// could have fixed it. It needed a second element.
//
// This is that element: one band across rows 2-4, wiping left to right under
// the narration "wherever the allocator felt like putting 'em", lighting the
// nodes it passes over. It is the allocator making its pass, which is the
// sentence, so it is not decoration.
//
//   area   423 x 182 world = 76,986 px; x CAM_NEAR^2 (1.3225) = 101,814 on
//          screen = 4.911% of the 2,073,600-px frame
//   rate   4.911 * 6 / 8 = 3.68 vs the 2.0 authoring floor
//   1-fr   4.911 / 8 = 0.614% vs the 0.3% single-frame gate — 2.05x
//
// THE WIPE IS LINEAR AND THAT IS THE WHOLE POINT. `ease` here would spend its
// first frames at 3/8 of nominal speed and present 0.23%/frame, under the gate,
// and the run would still be dead. A ramp is not an event. It is also a
// rectangular inset wipe, so painted area advances with the edge — linearly —
// with no sqrt correction needed.
//
// Clock is `rightF`, same as ArrivalWash, so the two washes share a timebase:
//
//   wipe   rightF 140-148  = abs 8274-8282   ("putting" lands ~8278)
//   hold   rightF 148-160  = abs 8282-8294
//   decay  rightF 160-172  = abs 8294-8306
//
// which halves the dead run into 8231->8273 (43f) and 8284->8323 (40f), and is
// gone 18 frames before `pointer_hops_stall` at 8324 — so `rightMode` is still
// `idle` for the band's whole life and no MemoryGrid cell is ever composited
// over it, exactly the guarantee the RWASH block relies on.
//
// WHY ROWS 2-4 AND NOT THE WHOLE GRID. ArrivalWash's last pair sits on rows 6-7
// (grid-local y 366-486) and this sits at y 118-300, so the two never touch even
// though the first is long gone by 8244. Three rows is also the smallest band
// that clears the gate with margin; the whole grid would be the establishing
// shot again rather than a pass across it.
const APASS_AT = 140;
const APASS_WIPE = 8;
const APASS_HOLD = 12;
const APASS_DECAY = 12;
const APASS_ROW = 2;
const APASS_ROWS = 3;
// The band's alpha is written as a LITERAL 0.45 at the paint site, not lifted
// to a constant here: check_contrast resolves `alpha(theme.X, <number>)` and
// cannot follow an identifier, so a constant would make the site invisible to
// the audit and its contrast-exempt marker inert.

/**
 * MemoryGrid locks the prefetcher on once the cursor has ENTERED this many
 * lines' worth of evidence — its rule is `cursorRow >= 2`, and it then warms
 * rows cursorRow+1 and +2. So rows 0, 1 AND 2 are all paid for at full price;
 * row 2 is the read that triggers the lock, not the first read to benefit from
 * it. The cost strip has to agree with the grid on that, hence the +1 below.
 */
const PREFETCH_LOCK_LINES = 2;
const PAID_LINES = PREFETCH_LOCK_LINES + 1;

/**
 * How far below its box the grid's clip lets MemoryGrid's readout show.
 * DERIVED from the camera, not a constant: the readout is counter-scaled by
 * `camScale` (see `readoutScale` at the call sites) so it measures the mono
 * floor ON SCREEN at every shot, which means it is 48.7 grid-local px tall at
 * the near shots and 87.5 at the split. A fixed 72 clipped it in half the
 * moment the camera pulled out — the P3 "10px sublabels" defect was that plus
 * the missing counter-scale.
 */
const clipUnder = (cs: number) =>
  READOUT_GAP + TYPE.annotation.fontSize / cs + 8;

/**
 * Grid-local gap under the grid before MemoryGrid's cost readout. 12, not its
 * default 26: the readout is now at the mono floor, so its line box is
 * TYPE.annotation / CAM_NEAR = 48.7 grid-local px tall instead of 26. From
 * GRID_Y 120 the grid ends at 600, so the readout runs 612..660.7 and the
 * "cost per read" strip label at STRIP_LABEL_Y 668 keeps a 7px gutter. At 26
 * the readout would end at 674.7 and print straight through that label.
 * clipUnder(CAM_NEAR) = 68.7 still clears it (660.7 - 600 = 60.7).
 */
const READOUT_GAP = 12;
/**
 * What the readout measures at the floor, so the clip below can be derived
 * rather than guessed. "64 read · 8 lines · prefetch on" is 27 chars; at
 * JetBrains Mono's exact 0.6em advance that is 27 * 0.6 * 48.7 = 789px, plus
 * 2 x 12px of separator margin and 27 x 0.2 letter-spacing = 818px.
 */
const READOUT_W = 818;

const cellCenter = (idx: number) => ({
  x: (idx % COLS) * (CELL + GAP) + CELL / 2,
  y: Math.floor(idx / COLS) * (CELL + LINE_GAP) + CELL / 2,
});

// Deterministic pseudo-random — copied verbatim from MemoryGrid so the node
// marks and pointer arrows sit on the exact cells its cursor visits. Math.random
// is banned outright: Remotion renders each frame in its own process, so a
// random scatter would flicker frame to frame.
function hash01(i: number, seed: number): number {
  let x = Math.imul(i ^ seed, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}
function chaseOrder(n: number, seed: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
    .map((i) => ({ i, k: hash01(i, seed) }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.i);
}
const CHASE_SEED = 7; // MemoryGrid's default; passed explicitly so it can't drift
const ORDER = chaseOrder(TOTAL, CHASE_SEED);

/**
 * How far into the shuffle the chase gets. Deliberately NOT 1: the pointer hops
 * have to be slow enough to show the mechanism (address revealed -> arrow drawn
 * -> hop). At 0.41 of 64 cells that's 26 hops across the 476 frames this beat
 * has left when the chase starts — ~19 frames per hop through
 * `pointer_hops_stall` and ~17 through the split — and it leaves the chase lane
 * still grinding while the sweep lane is finished, which is the honest picture
 * and the one the split screen is for.
 */
const CHASE_END = 0.41;
const CHASE_AT_HOPS_END = 0.3;
/** Nodes drawn = every cell the chase will actually reach, plus none it won't. */
const NODE_COUNT = Math.ceil(CHASE_END * TOTAL) + 1;

// --- cost strip ------------------------------------------------------------
// One thin bar per read, 64 of them, drawing on as the cursor passes. This is
// the quantitative payload of the whole beat and it carries NO numbers on
// purpose: the sweep's profile is two red spikes then a flat green field (the
// latency vanishing, exactly where the narration says it does) and the chase's
// is a solid wall of red. A stated ratio here would be inventing one — the only
// measured ratios in this episode live in beats 9 and 10.
const BAR_PITCH = 13.5;
const BAR_W = 8;
const BAR_SHORT = 0.16;

// --- the first read's price ------------------------------------------------
// ROUND 10, and the whole of it is one arithmetic mistake made three rounds
// running. The measured dead window was abs f7298-7457 — 5.33 seconds sitting
// entirely inside `sweep_cursor`, with median inter-frame ink 0.000%, a peak
// repaint of 1.23% over any 6-frame window, and detectable motion in 12% of its
// frames. The step was not unstaged. It was staged ENTIRELY IN THIN STROKES:
//
//   rel 242  the chip's WaitBar starts filling — 484 x 14 world px creeping
//            across 121 frames. That is 6,776 world px = 8,961 on screen after
//            CAM_NEAR, 0.43% of the frame IN TOTAL and 0.004% per frame.
//   rel 242  its 17-character label, "paying full price".
//   rel 289  a 10-character "full price" tag on a 6px tick — a 421 x 51 box
//            whose actual ink is the glyphs, well under 1% even counting the box.
//
// Every one of those is under the detector's bar (>=2% of frame repainted
// inside a 6-frame window) by more than an order of magnitude, and it does not
// help that there are three of them: AREA / DURATION is the quantity, not area,
// and certainly not count. A 6.7%-of-frame region wiped over 18 frames presents
// 2.2% per window and IS an event; the same region over 24 frames presents 1.7%
// and is NOT. Three 0.4% flickers spread over 160 frames are nothing at all.
//
// So the "full price" tag is PROMOTED from a tag into a plate — precisely the
// fix the Chip took when its 1.04:1 panel was found to be arriving at ten luma
// (see the Chip block comment). It is the same annotation, on the same words,
// at the same moment; it simply now repaints enough of the frame to exist. The
// tag it replaces is deleted rather than kept alongside, because two copies of
// "full price" 200px apart is the chrome this file already refused once for
// "prefetcher: locked on".
//
// GEOMETRY. The rail — the 421px band between the grid's right edge and the
// annotation column, x NOTE_X .. NOTE_X + NOTE_W — is the one region of the
// near shot that is empty for the whole of `sweep_cursor`, so nothing had to
// move to make room. Vertically PRICE_TOP 56 is 8px under the row-0 label slot
// ("64 B" occupies grid-local -3..48) and 4px right of the row-0 bracket's far
// edge (-10 + GRID_W + 22 = 415); the grown plate ends at 56 + 2 * 170 = 396,
// which is 96px clear of MemoryGrid's readout row at 492 and above every
// SweepNote row the next step uses. In screen space at CAM_NEAR that is
// x 619.6..1103.8, y 282.4..673.4 — inside [115,1805] x [65,1015] with the
// +-3px ambient drift applied.
//
// AREA / DURATION, the number that decides whether any of this was worth
// writing. One band is 421 x 170 = 71,570 world px, and CAM_NEAR squares to
// 1.3225, so 94,651 px on screen = 4.564% of the 2,073,600-px frame. Both
// stages use the house 8-frame `entrance`, so
//
//     4.564% * 6 / 8 = 3.42     against a gate of 2.0
//
// and because `ease` is cubic-out the FIRST SIX of those eight frames carry
// 1 - 0.25^3 = 98.4% of the band, i.e. 4.49% inside one 6-frame window. The
// exit is bigger still: the whole 421 x 340 plate leaving in 6 frames is 9.13%
// of frame, which is what covers the seam into `line_lights_whole`.
//
// Contrast is not marginal either, and it is black-to-red BOTH TIMES on
// purpose. theme.down on pure black is dY 130 (Rec.601) / 116 (Rec.709) against
// a gate of 25. The obvious alternative — an empty theme.stroke track that
// later fills red — was rejected: stroke-to-down is dY 39.6 on Rec.601 but only
// 25.2 on Rec.709, and a reveal whose visibility depends on which luma formula
// the grader happens to use is not a reveal. Two black-to-red fills in two
// stacked rectangles clear every threshold under either formula.
//
// STAGING. Two events, not one, because a single 8-frame event at rel +74 still
// leaves f7352 -> f7455 empty: 103 frames, 3.4s, over the hold ceiling on its
// own. Split head/tail the window's gaps are 47 / 41 / 62 frames — 1.57s /
// 1.37s / 2.07s — all inside the 3s bar. The two offsets are the narration's,
// not a pretty split: PRICE_TAIL_AT 0.62 is the "pays full price" anchor this
// file already calibrated the tag it replaces against (the old tag was 0.6, and
// the plate is 4 frames later only so its label lands ON the phrase rather than
// a beat ahead of it), and PRICE_HEAD_AT 0.4 puts the wordless first band on
// "the first read misses" — the cost appearing before it is named, which is the
// order the sentence says it in.
const PRICE_HEAD_AT = 0.4;
const PRICE_TAIL_AT = 0.62;
/** Grid-local top of the plate. See the geometry paragraph above. */
const PRICE_TOP = 56;
/** One stage's worth of height. Two of these stack into the finished plate. */
const PRICE_BAND_H = 170;
/**
 * Where "full price" sits inside the lower band. 235 centres a 51px line box on
 * the band's 170..340 extent (centre 260.5 against 255) and, with the plate's
 * `overflow: hidden`, means the growth itself wipes the words on rather than a
 * separate fade — one grammar for one event.
 */
const PRICE_LABEL_TOP = 235;

/**
 * The centrepiece: memory as one grid, walked two ways, laid out in a single
 * space with the camera travelling between them.
 *
 * Beat 7 (`cache_line`) establishes this grid; this beat widens it, sweeps it,
 * then moves right to the same grid full of scattered nodes. Nothing is ever
 * swapped in place — the array lane stays on screen behind the camera the whole
 * time and comes back for the split, which is what makes the last shot a
 * comparison rather than two things you have to remember.
 */
export const SweepVsChase: React.FC<SweepVsChaseProps> = ({ p, frame = 0 }) => {
  // STAGED UNCOVER — the fix for the beat opening on a 3.57s hold (rel +2..+109).
  // The grid used to uncover in one 14-frame wipe and then nothing else in
  // `grid_widen` cleared the grader's content-event threshold: a 1px dashed
  // bracket and a 4-character label are both far under 0.3% of the frame, so
  // f7094-7201 measured as one static shot. It now uncovers in THREE 9-frame
  // stages at rel 0 / 46 / 92 — roughly three rows each, ~4% of the frame per
  // stage — which is three real events spanning exactly the sentence that
  // narrates it ("this one picture is the entire episode"). Longest gap inside
  // the step is now 37 frames.
  //
  // ROUND 9. Three stages was still not enough, and the reason is D1, not
  // count: MemoryGrid's idle cell is `transparent` with a 1px `theme.stroke`
  // border, so uncovering three rows of it reveals almost no ink at all — at
  // the 8x pacing proxy a 1px border is an eighth of a pixel and contributes
  // dY ~13 whatever colour it is. The measured result was f7092-7199 (3.60s)
  // dead: the beat OPENED on nothing for its first three and a half seconds.
  //
  // Two changes. The uncover is now EIGHT stages, one per grid row, on a
  // 16-frame clock (rel 0,16,...,112 — last one lands at 121, well inside the
  // 175-frame step), so the reveal is a row-by-row build the eye can follow.
  // And each row arrives under a bright wash (see `rowWash`) so the reveal
  // actually moves pixels.
  //
  // ROUND 11, and this is the third time this same 3.6 seconds has been fixed.
  // r9's eight stages and the wash did move pixels — r10 measured the events —
  // and f7092-7200 came back AGAIN, at 0.35% lit, because "moves pixels" and
  // "is lit" are not the same test and the wash was painting luma 89. The
  // uncover clock below is therefore UNCHANGED; only the wash's alpha and
  // lifetime moved. See the `--- the arrival wash ---` block.
  const ROW_STEP = 16;
  const gw = p.grid_widen ?? 0;
  const gwF = clamp01(gw) * STEP_FRAMES.grid_widen;
  const uncoverStage = (from: number) => ease(clamp01((gwF - from) / 9));
  let widen = 0;
  for (let r = 0; r < ROWS; r++) widen += uncoverStage(r * ROW_STEP);
  widen /= ROWS;
  /**
   * The wash that makes the uncover visible. A band sits BEHIND each row and
   * holds at WASH_ALPHA for WASH_HOLD frames after that row finishes
   * uncovering, then decays over WASH_DECAY, so what the clip reveals is a
   * solid 423x58 world band — 32,446 px on screen at CAM_NEAR, 1.565% of the
   * frame — instead of four hairlines.
   *
   * ROUND 11. The hold is new and the alpha went 0.35 -> 0.50; both are sized
   * against the empty-frame metric in the `--- the arrival wash ---` block
   * above, which is also where the "why not a permanent bed" argument and the
   * gwF-167 retire live. The short version: at 0.35 this band painted luma 89
   * and the beat opened on 3.63 seconds under 1% lit, and without the hold a
   * brighter band would drop back under the gate within one frame of landing.
   */
  const rowWash = (r: number) =>
    WASH_ALPHA *
    (1 - ease((gwF - (r * ROW_STEP + 9 + WASH_HOLD)) / WASH_DECAY));
  // The horizontal widen is NOT staged. Only the vertical uncover is an
  // information reveal; a grid that jumps wider three times reads as a glitch.
  const widenX = ease(entranceN(gw, 0, "grid_widen", 9));
  const cursorStep = p.sweep_cursor ?? 0;
  const lightsStep = p.line_lights_whole ?? 0;
  const ghostStep = p.prefetch_ghosts ?? 0;
  const moveStep = p.camera_move_right ?? 0;
  const scatterStep = p.scatter_nodes ?? 0;
  const hopStep = p.pointer_hops_stall ?? 0;
  const splitStep = p.split_screen_hold ?? 0;

  // --- camera ---------------------------------------------------------------
  const toRight = easeCam(moveStep);
  // 0.22, not 0.35: at 116 nominal frames that ramp was 40.6 frames long, and
  // it is the whole visual arrival of the `chase` mark — graded as a 39-frame
  // entrance, 4x the ceiling. 0.22 is ~25 frames: still an accelerating,
  // decelerating travel rather than a cut, but it lands the split screen inside
  // a second of the word instead of drifting for a second and a third.
  const toWide = easeCam(clamp01((splitStep - 0.05) / 0.22));
  const camX = lerp(lerp(CAM_LEFT_X, CAM_RIGHT_X, toRight), CAM_WIDE_X, toWide);
  const camScale = lerp(CAM_NEAR, CAM_WIDE, toWide);
  // P3 — the split-screen sublabels. MemoryGrid's readout is the beat's whole
  // quantitative payload and it was counter-scaled by the CONSTANT CAM_NEAR, so
  // it was at the mono floor in the near shots and 0.64x of it at the split —
  // an unreadable cap in the one shot the comparison actually happens in.
  // Counter-scaling by the LIVE camera pins it to the floor ON SCREEN at every
  // shot; the readout is then the one element that holds its size through the
  // pull-out while everything else shrinks, which reads as a dock.
  // Width budget at the split: 818 world px at CAM_NEAR = 941 px on screen, so
  // the left lane's readout runs screen 145..1086 and the right lane's leftmost
  // pixel is at 1160; the right lane's chase string is 14 characters shorter
  // and ends near 1755, inside SAFE_R. Neither collides.
  const readoutW = (READOUT_W * CAM_NEAR) / camScale;
  // The one legal use of `frame`: a drift with no start and no end, so a frame
  // where nothing is being revealed still isn't a frozen photograph. ±3px only —
  // any more and the safe-margin arithmetic above stops holding.
  const driftX = Math.sin(frame / 118) * 3;
  const driftY = Math.cos(frame / 143) * 2;
  // Counter-scale for the lane header. The camera zooms out by 0.64/1.15 at the
  // split; the header grows by 1.6 so its type stays ~41px on screen instead of
  // dropping to 23px. It grows from the lane's top-left, and at 1.6 the tallest
  // thing in it (the rule, world y 56) lands at 90 — clear of the grid at 120.
  const headerScale = lerp(1, HEADER_WIDE, toWide);

  // --- safe-margin cull (grader D4) ----------------------------------------
  // Every lane is culled by its own screen geometry rather than by a hand-picked
  // step boundary, so no camera change can ever re-introduce the defect. A lane
  // fades out as the width it occupies INSIDE the safe box collapses; at zero
  // visible width it is fully gone, so nothing can sit clipped at a frame edge.
  //
  // Measured at every shot: left lane near = 1626px visible (opacity 1); left
  // lane at the right shot = 0 (its rightmost split-visible pixel, the cost
  // strip's world x 957, screen-maps to -715); both lanes at the wide shot =
  // 621px each (opacity 1). The only frames where this is fractional are the
  // ~8 inside the pan and the ~5 inside the pull-out, where the lane is
  // physically sliding through the frame edge anyway.
  const screenX = (worldX: number) => (worldX - camX) * camScale + 960 + driftX;
  // How much of the lane's real content (SPLIT_L..LANE_R, not SPLIT_R) is still
  // inside the safe box. At zero visible width the lane is gone, so nothing can
  // sit clipped at a frame edge; the 60/280 ramp is unchanged.
  const laneVis = (x0: number) =>
    clamp01(
      (Math.min(screenX(x0 + LANE_R), SAFE_R) -
        Math.max(screenX(x0 + SPLIT_L), SAFE_L) -
        60) /
        280,
    );
  // OVERHANG (grader ND-5/DF-11), and the FIRST of defect D5's two retire
  // cliffs. Width alone is not enough for TEXT: mid-pan the left lane still had
  // ~1025px inside the box while its TITLE hung off at screen x 36, which is
  // what chopped the "A" of ARRAY. The old code fixed that by multiplying the
  // WHOLE LANE by this term — and that is precisely the "never fade a whole
  // layer out unless something else is already lit" rule, broken. The lane's
  // leading pixel crosses SAFE_L - 260 at camX 946.9, i.e. abs f8157, and the
  // r12 render measures EXACTLY 0.000% lit from f8157: the grid, the cost strip
  // and 520px of annotation column were all still inside the safe box and were
  // all switched off because one word was near the edge.
  //
  // So the term now guards the thing it was written for — the header block and
  // the docked keyword, the only glyphs big enough to read as chopped — and the
  // diagram body pans out under EDGE_MASK instead, which is the space-domain
  // fix for the same defect and is absolute (hard zero outside 115/1805, 6px
  // feather inside). A grid and a card sliding off the frame edge during a
  // camera travel is what a pan looks like; a black frame is not.
  //
  // 260 is unchanged and still chosen from the pull-out: it turns the left
  // lane's header re-entry (screen -150 to 136 in the last ~10% of the camera
  // move) into a ~15-frame fade-up that lands with the shot. All three end
  // states are outside the ramp — SPLIT_L maps to 121.7 at both near shots and
  // 136.3 at the split, still clear at the -3px drift.
  const headVis = (x0: number) =>
    1 - clamp01((SAFE_L - screenX(x0 + SPLIT_L)) / 260);

  // --- annotation exits (graders D4 + D9) -----------------------------------
  // The cards are near-shot furniture: at CAM_WIDE their type drops to 33px, so
  // neither column may survive into the SPLIT shot. Right: rel 1590 -> 1598,
  // before the pull-out starts at rel 1596.
  //
  // LEFT WAS 0.05 -> 0.16, i.e. abs f8135.75 -> f8144, and that is defect D5's
  // second retire cliff. It is a whole-layer (1 - t) on 4 chips x 2.70% of frame
  // = 10.8%, fired eight frames into a camera move, at a point where the column
  // (world x 880..1400) is not merely inside the safe box but DEAD CENTRE of it
  // — the near shot's box shows world camX +- 734.8, so this column is fully
  // inside from camX 665 all the way to camX 1615, which the pan does not reach
  // until abs f8171. The r12 render shows the cost exactly: 16.98% lit at f8139,
  // 7.38% at f8144. The chips were switched off in the middle of the shot they
  // were still composed in, and 0.000% lit followed thirteen frames later.
  //
  // 0.62 -> 0.78 is abs f8178.5 -> f8190.5. The column now PANS OUT of frame
  // under EDGE_MASK — the camera leaves it behind, which is the sentence being
  // narrated ("now the same data as a linked list") — and the ramp only has to
  // guarantee the D4/D9 property, that the cards are at zero long before the
  // pull-out at rel 1590 (abs 8682). By f8183 `laneVis(0)` has taken the lane to
  // zero anyway (the column's last pixels leave the box at camX 2134.8), so this
  // ramp is a backstop, not the visible exit. The camera scale is CONSTANT at
  // CAM_NEAR for the whole travel, so no frame of it renders a card under the
  // readability floor.
  const detailLeft = 1 - ease(clamp01((moveStep - 0.62) / 0.16));
  const detailRight = 1 - ease(clamp01(splitStep / 0.07));

  // --- left lane: the sweep -------------------------------------------------
  // Three steps drive ONE continuous walk. `line` mode holds the first read as a
  // single lit cell and only lets the surrounding 64 bytes arrive past p=0.45,
  // which is precisely the sweep_cursor -> line_lights_whole staging; `sweep`
  // mode then picks the cursor up at the same cell and carries it down the grid.
  // Handing the whole thing to `sweep` from the start would light row 0 on the
  // first frame and collapse two steps into one.
  const leftMode = ghostStep > 0 ? "sweep" : cursorStep > 0 ? "line" : "idle";
  const lineP = 0.42 * ease(cursorStep) + 0.58 * ease(lightsStep);
  // Raw, not eased: the cursor is a metronome. An eased cursor decelerates into
  // the bottom of the grid and the cost strip stops filling at a steady rate,
  // which reads as the animation running out of energy.
  const sweepP = clamp01(ghostStep);
  const leftProgress = leftMode === "sweep" ? sweepP : lineP;
  // max(1, ...) matters: `line` mode has already drawn cost bar #1, and sweep
  // mode starts back at 0 reads. Without the floor, the first bar shrinks away
  // and regrows on the frame the mode switches — a flicker on the one bar the
  // whole strip is built around.
  // In `line` mode this used to SNAP 0 -> 1 on the first frame of sweep_cursor:
  // the baseline, the "cost per read" label and the first tall bar all appeared
  // inside one frame, which is a cut, not an entrance. Ramped over 8 frames it
  // is the step's first content event instead (rel ~176).
  const sweepReads =
    leftMode === "sweep"
      ? Math.max(1, sweepP * TOTAL)
      : ease(entrance(cursorStep, 0.005, "sweep_cursor"));

  // --- right lane: the chase ------------------------------------------------
  const rightMode = hopStep > 0 ? "chase" : "idle";
  const chaseP =
    CHASE_AT_HOPS_END * clamp01(hopStep) +
    (CHASE_END - CHASE_AT_HOPS_END) * clamp01(splitStep);
  const hopIdx = Math.min(Math.floor(chaseP * TOTAL), TOTAL - 2);
  const hopFrac = clamp01(chaseP * TOTAL - hopIdx);
  // The cursor teleports (that IS the chase), but the empty "ahead" slots track
  // it smoothly. Two big dashed boxes relocating every 15 frames is strobing;
  // gliding, they read as the prefetcher following and finding nothing.
  const aheadRow = lerp(
    Math.floor(ORDER[Math.max(0, hopIdx - 1)] / COLS),
    Math.floor(ORDER[hopIdx] / COLS),
    ease(hopFrac),
  );

  // --- the two keyword moments ---------------------------------------------
  // "SWEEP" lands on the `sweep` mark (abs 7598 = rel 506) and "CHASE" on the
  // `chase` mark (abs 8686 = rel 1594). Both come up big over a dimmed grid —
  // dim-the-rest, never a ring — and then dock beside their lane's title rather
  // than vanishing, so the word stays available as a label for the rest of the
  // beat.
  //
  // WHERE the word sits before it docks is grader defect P6 and it is fixed in
  // `Lane` below (see WORD_X): parking it over the grid traded one occlusion
  // (the annotation column, D10) for another (grid row 4, P6). The pre-dock slot
  // is now the empty rail between the grid and the column, which collides with
  // neither.
  //
  // Sized in frames rather than as a fraction of the step so the pop is ~10
  // frames either way. 0.73 of a 185-frame `line_lights_whole` that starts at
  // rel 360 puts SWEEP's entrance at rel 495 — 11 frames ahead of its mark, up
  // by rel 505. CHASE starts on rel 1590, 4 frames ahead of its. Slightly early
  // is the house rule; late is the amateur tell. (The old 0.78 was measured
  // against a superseded timing.json and landed SWEEP 90 frames early.)
  // Both pops are 9 frames now, not 10, and both docks 10 rather than 12 — the
  // whole band is 6-9 and a dock that outruns the pop it follows reads slack.
  // The two dock ramps are handed over RAW, unlike every other progress in this
  // file. `Lane` splits the dock into two eased legs (rise, then slide — see
  // WORD_X) and easing before the split is not the same operation: pre-easing
  // squeezed the 304px rise into 2.3 of the dock's 10 frames, which is a
  // teleport, not a dock. Lane eases each leg and the scale itself; the only
  // thing that needs the eased whole out here is `dim`.
  const sweepWordIn = entranceN(lightsStep, 0.73, "line_lights_whole", 9);
  const sweepWordDock = entranceN(ghostStep, 0.02, "prefetch_ghosts", 10);
  const chaseWordIn = entranceN(splitStep, 0, "split_screen_hold", 9);
  const chaseWordDock = entranceN(splitStep, 0.3, "split_screen_hold", 10);

  // The right lane only exists once the camera is on its way there — but WHEN
  // is defect D5's third cliff, this one on the arriving side.
  //
  // The 0.50 gate was justified by "MemoryGrid's readout row runs ~620px wider
  // and only clears 1805 at 0.494". That element IS NOT RENDERED HERE. Read
  // MemoryGrid: the readout is inside `{(mode === "sweep" || mode === "chase")
  // && ...}`, and `rightMode` stays `idle` until `pointer_hops_stall` at abs
  // f8324 — 117 frames after the pan ends. The gate was 40 frames of black paid
  // for a string that cannot be on screen. What the lane actually draws while
  // idle is the header, MemoryGrid's idle cells (transparent inside luma-90
  // borders), ArrivalWash, NodeMarks and a CostStrip whose every child is
  // multiplied by `clamp01(reads)` = 0.
  //
  // So the gate is now sized by the widest thing that IS drawn, per element:
  //
  //   grid + ArrivalWash  world 1590..2013, clears SAFE_R at camX 1278.2
  //                       = easeCam 0.352 = moveStep 0.444
  //   title "LIST"        world 1600..~1748, clears at moveStep ~0.359
  //   subtitle            the widest string the idle lane owns, ~510px, and it
  //                       is the ONE element still outside 1805 at 0.444 — so
  //                       it keeps the old 0.50 gate of its own, below.
  //
  // 0.30 -> 0.45 lands the lane at full opacity on moveStep 0.45 = abs f8165.7,
  // the frame its grid finishes entering the safe box, and takes it above the
  // wash's own lit threshold (rightOn >= 0.8627, where a WASH_ALPHA 0.50 band
  // still composites over luma 110) at moveStep 0.373 = abs f8160. The lane now
  // SLIDES IN behind the mask edge as the left lane slides out, which is the
  // >= 10-frame overlap D5 asked for and is also just what a pan is.
  const rightOn = ease(clamp01((moveStep - 0.3) / 0.15));
  // The subtitle keeps the old, stricter gate: at TYPE_ANNO it measures ~510
  // world px, so its far edge (world ~2110) is the last thing in the idle lane
  // to clear SAFE_R, at moveStep 0.472. Fading it up with the rest of the lane
  // would scissor "…scattered" against the mask edge for ~11 frames — the exact
  // right-hand twin of the ND-5 defect that the 0.50 number was written for.
  const rightSubOn = ease(clamp01((moveStep - 0.5) / 0.3));
  // Frames since `camera_move_right` began, carried across the step boundary
  // into `scatter_nodes`. The arrival wash has to hold and decay past that
  // boundary (see the RWASH_* block), and neither step's own progress can
  // express a clock that runs through both. Same progress -> frames conversion
  // the rest of the file uses; both steps are monotonic and non-overlapping, so
  // the sum is monotonic too.
  const rightF =
    clamp01(moveStep) * STEP_FRAMES.camera_move_right +
    clamp01(scatterStep) * STEP_FRAMES.scatter_nodes;

  return (
    // SAFE-MARGIN MASK. `laneVis` only culls a lane once its visible width
    // collapses below 60px, so during the pan right and during the pull-out a
    // lane is still physically sliding THROUGH the frame edge — which is what
    // put content in columns 0-2 of 960 at f8145-8169 and f8710-8720. Nothing
    // about that is a timing problem, so it is fixed in space rather than in
    // frames: this outermost wrapper is the one element in the scene with no
    // camera transform on it, so a gradient mask here is in screen coordinates.
    // See EDGE_MASK: hard zero OUTSIDE the 115/1805 margins with the feather
    // inside them, so not one lit pixel can land in the 6% band, and `laneVis`
    // dissolves the lane before it reaches that cut so nothing is scissored.
    <div
      style={{
        position: "absolute",
        inset: 0,
        fontFamily: SANS,
        WebkitMaskImage: EDGE_MASK,
        maskImage: EDGE_MASK,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transformOrigin: "0 0",
          transform: `translate(${960 - camX * camScale + driftX}px, ${
            540 - CAM_Y * camScale + driftY
          }px) scale(${camScale})`,
        }}
      >
        {/* ================= LEFT LANE — the array ========================= */}
        <Lane
          x={0}
          title="ARRAY"
          subtitle="walks front to back"
          // Off the wipe and onto its own words. It used to fade up with the
          // grid, which spent it as part of one event; at 0.74 (rel ~130) it
          // lands on "walking through it front to back" and is a ~1.5%-of-frame
          // event of its own in the middle of the step's quietest stretch.
          subtitleOpacity={entrance(gw, 0.74, "grid_widen") * detailLeft}
          titleIn={entrance(gw, 0, "grid_widen")}
          accent={theme.up}
          opacity={laneVis(0)}
          headerVis={headVis(0)}
          headerScale={headerScale}
          dim={sweepWordIn * (1 - ease(sweepWordDock))}
          word="SWEEP"
          wordIn={sweepWordIn}
          wordDock={sweepWordDock}
        >
          {/* Mask-wipe reveal: the grid uncovers top-to-bottom, one row at a
              time for free, and widens as it goes — the step is called
              grid_widen because beat 7 leaves this grid narrower.

              The insets are deliberately NEGATIVE on three sides. This div
              shrink-wraps MemoryGrid (GRID_W x GRID_H), and clip-path clips to
              that border box, so a plain `inset(0 0 X% 0)` silently ate every
              child that lives outside it: the 10px breathing room on the
              bracket, and — worst — MemoryGrid's own "N read · M lines fetched ·
              prefetcher locked on" readout, which sits at GRID_H + 26. The whole
              quantitative readout of the sweep was being clipped away. Bottom is
              animated in px, not %, because its finished value has to be past
              the box edge, and % can't express that.

              RIGHT inset is sized by the WIDEST child that hangs off the grid
              box, and that is NOT the row-0 label slot ("64 B", then "free") at
              x GRID_W + 16 — it is MemoryGrid's readout row. The label is what
              -170px was originally chosen for (it moved outside the box when it
              went from 24px to 36px; above the row it would have collided with
              the lane subtitle at y 58..103, and -14 would have clipped it away
              entirely). But -170 puts the clip edge at GRID_W + 170 = 573,
              and the readout was ~620px wide — so "prefetcher locked on" was
              being cut mid-glyph at every frame the sweep grid was on screen.

              The readout has since gone to the mono floor and its string has
              been cut from 45 chars to 27 to pay for it; READOUT_W measures the
              result at 818px. -425 puts the edge at GRID_W + 425 = 828, which
              clears 818 by 10 and still leaves a 52px gutter to COL_X at 880.
              Nothing else in this div reaches past 541 (the row-0 label slot at
              GRID_W + 16 plus a 4-char TYPE_ANNO label), so widening the clip
              reveals the readout and nothing else. */}
          <div
            style={{
              position: "absolute",
              left: GRID_X,
              top: GRID_Y,
              width: GRID_W,
              height: GRID_H,
              transformOrigin: "left center",
              transform: `scaleX(${interpolate(widenX, [0, 1], [0.88, 1])})`,
              clipPath: `inset(-40px -${readoutW + 10 - GRID_W}px ${lerp(GRID_H, -clipUnder(camScale), widen)}px -20px)`,
            }}
          >
            {/* The arrival wash, one band per row, BEHIND the grid so the
                cells and their borders stay on top of it. See `rowWash`. */}
            {Array.from({ length: ROWS }).map((_, r) => {
              const a = rowWash(r);
              return a <= 0.001 ? null : (
                <div
                  key={`wash${r}`}
                  style={{
                    position: "absolute",
                    left: -10,
                    top: r * (CELL + LINE_GAP) - 6,
                    width: GRID_W + 20,
                    height: CELL + 12,
                    borderRadius: 8,
                    background: `rgba(255, 255, 255, ${a.toFixed(3)})`,
                  }}
                />
              );
            })}
            <MemoryGrid
              mode={leftMode}
              progress={leftProgress}
              requestedCell={0}
              showPrefetch
              readoutScale={camScale}
              readoutGap={READOUT_GAP}
              readoutFont={MONO}
            />
            {/* Row 0 outlined and sized, on the grid. Line draw-on — the step
                before it was a mask wipe and the one after is a spring, so no
                grammar repeats. It then sits there dashed through the whole
                first read as the line that's on its WAY, and MemoryGrid's own
                solid container fills that exact box at line_lights_whole: the
                cache line arrives as a transform of an object already on
                screen, not as one more thing popping in. */}
            <LineOutline
              draw={entrance(gw, 0.9, "grid_widen")}
              handoff={ease(entranceN(lightsStep, 0, "line_lights_whole", 8))}
            />
            {/* "the next batch of numbers is already loaded" — the seven cells
                you didn't ask for, tagged free, cascading 3 frames apart. */}
            <FreeTags
              t={entranceN(lightsStep, 0.55, "line_lights_whole", 28)}
              // Grader P6(b): the "free" row label had an entrance and no exit,
              // so it was still parked in the rail at abs 7900 — 250 frames
              // after the sentence that says it — and again at abs 8716, where
              // the split shot renders its 51px world type at 33px on screen.
              // A label nobody is talking about is an ad (PLAYBOOK rule 5), and
              // one under the readability floor is an ad you can't read. It now
              // leaves on the first frames of `prefetch_ghosts`, which is both
              // where its sentence ends and 4 frames before SWEEP starts docking
              // up through this exact column — so the rise passes over an empty
              // rail and the next thing to occupy the slot is the "+1 line free"
              // note 30 frames later. The seven cell underlines STAY: those are
              // attached to real cells and are a record of what the read bought.
              labelOut={ease(entranceN(ghostStep, 0, "prefetch_ghosts", 6))}
            />
            {/* Ambient glide during the split hold. The sweep lane is finished
                by then, and a finished grid is a still photograph; a soft band
                running the length of it keeps the lane alive without claiming
                any new information. Frame-driven on purpose — it has no start
                and no end, it just runs while the shot is held. */}
            <GlideBand opacity={toWide} frame={frame} />
          </div>

          {/* PREFETCH NOTES — the sub-reveals that carry `prefetch_ghosts`
              (grader ND-4). That step is 495 frames — 16.5 seconds — of the
              richest narration in the episode, and it used to add exactly two
              things: the "chip notices" card at 0.24 and the "latency: hidden"
              label at 0.82. A grid filling and a read counter ticking are
              sub-threshold, so f7645-8136 measured as ONE 16.4-second hold.
              These six tags take one narrated idea each — it compounds / the
              straight line / okay, the prefetcher / pulling lines in early /
              they're already there / and the price stopped being paid — landing
              at ghostStep 0.10, 0.32, 0.46, 0.60, 0.74, 0.92. Interleaved with
              the two that already existed that is an event every ~69 frames
              (2.3s) across the whole step, with no gap over 70.

              They live in the 421px band between the grid's right edge and the
              annotation column: the one genuinely empty region of the near shot,
              so nothing had to be moved to make room. Each is anchored to the
              grid row it is about, and because the sweep cursor is at row ~ 8 *
              ghostStep, the notes track down the grid alongside it. Six
              different entrance grammars, so no two adjacent ones repeat. */}
          <div style={{ position: "absolute", left: GRID_X, top: GRID_Y }}>
            {/* The first read's price, in the rail, on "The first read misses
                and pays full price" — and the fix for the f7298-7457 dead
                window. This replaces a `SweepNote` that said the same words at
                the same moment and was, measurably, invisible: see the PRICE_*
                block for the area/duration arithmetic that condemned it and
                sizes this.

                It still LEAVES on the line arriving (6 frames, lightsStep 0.05)
                rather than sitting there contradicting the green tags that
                follow — and now that the plate is 9.13% of the frame, that exit
                is itself the largest single event in the neighbourhood and is
                what covers the seam into line_lights_whole. The rows it
                occupies (grid-local 56..396, i.e. rows 1-5) are all free again
                before the first `prefetch_ghosts` tag lands at rel +692. */}
            <PricePlate
              head={entrance(cursorStep, PRICE_HEAD_AT, "sweep_cursor")}
              tail={entrance(cursorStep, PRICE_TAIL_AT, "sweep_cursor")}
              out={ease(entranceN(lightsStep, 0.05, "line_lights_whole", 6))}
              detail={detailLeft}
            />
            <SweepNote
              row={1}
              enter="draw"
              text="+1 line free"
              color={theme.up}
              t={entrance(ghostStep, 0.1, "prefetch_ghosts")}
              detail={detailLeft}
            />
            <SweepNote
              row={2}
              enter="spine"
              text="straight line"
              color={theme.accent}
              t={entrance(ghostStep, 0.32, "prefetch_ghosts")}
              detail={detailLeft}
            />
            <SweepNote
              row={3}
              enter="pop"
              text="prefetcher"
              color={theme.warm}
              t={entrance(ghostStep, 0.46, "prefetch_ghosts")}
              detail={detailLeft}
            />
            <SweepNote
              row={5}
              enter="wipe"
              text="pulled early"
              color={theme.warm}
              t={entrance(ghostStep, 0.6, "prefetch_ghosts")}
              detail={detailLeft}
            />
            <SweepNote
              row={6}
              enter="slide"
              text="already here"
              color={theme.warm}
              t={entrance(ghostStep, 0.74, "prefetch_ghosts")}
              detail={detailLeft}
            />
            {/* Count-up, and the only number in the band. It is not a claim
                about hardware — it is a readout of THIS strip: `tall` marks
                i % 8 === 0 for the first PAID_LINES lines, so exactly 3 of the
                64 bars are full height. Counting 0 -> 3 as it lands is the
                entrance grammar and the payload at once. */}
            <SweepNote
              row={7}
              enter="count"
              text={`paid # of ${TOTAL}`}
              count={PAID_LINES}
              color={theme.up}
              t={entrance(ghostStep, 0.92, "prefetch_ghosts")}
              detail={detailLeft}
            />
          </div>

          {/* Staggered against the bracket rather than fired with it: the grid
              wipe finishes ~14 frames in, and with both of these at 0.62 the
              beat opened on a 94-frame stretch of nothing entering, changing or
              leaving. 0.30 / 0.60 breaks that into 38 / 53 / 70. */}
          <Chip
            y={CHIP_Y[0]}
            t={entrance(gw, 0.6, "grid_widen")}
            title="row = one line"
            sub="64 bytes at once"
            tone={theme.dim}
            detail={detailLeft}
          />
          <Chip
            y={CHIP_Y[1]}
            // 0.10, not 0.35. It lands on "The first read misses" instead of 65
            // frames after it, and moving it forward is what turns the +178..+270
            // hold into an event at rel ~194.
            t={entrance(cursorStep, 0.1, "sweep_cursor")}
            title="read #1 — miss"
            sub=""
            tone={theme.down}
            detail={detailLeft}
          >
            {/* Fills across the back half of the step. Without it the first
                read is a single lit cell held for five seconds while the
                narration describes it — the exact static hold this beat has no
                room for. Filling, it's the wait being paid in real time. */}
            <WaitBar
              fill={clamp01((cursorStep - 0.35) / 0.65)}
              color={theme.down}
              label="paying full price"
              labelOpacity={entrance(cursorStep, 0.35, "sweep_cursor")}
            />
          </Chip>
          <Chip
            y={CHIP_Y[2]}
            t={entrance(lightsStep, 0.28, "line_lights_whole")}
            title="arrives whole"
            sub="next 7 reads free"
            tone={theme.up}
            detail={detailLeft}
          />
          {/* NOT "prefetcher: locked on" — MemoryGrid prints exactly that
              phrase in its own readout, in the same warm, at the same moment
              (it locks at sweep p >= 0.25, this chip lands at rel 664 and the
              grid locks at rel 669). Two copies of one sentence a few hundred
              pixels apart is chrome. This says the thing the narration says
              instead, and the readout stays the machine's voice. No sub either:
              the bottom slot has 120px before it hits that readout row, which a
              title + WaitBar exactly fills, and the ghost lines plus
              "latency: hidden" already carry what a sub would have said. */}
          <Chip
            y={CHIP_Y[3]}
            t={entrance(ghostStep, 0.24, "prefetch_ghosts")}
            title="chip notices"
            sub=""
            tone={theme.warm}
            detail={detailLeft}
          >
            {/* The wait bar collapsing to a sliver IS "the latency just
                vanishes" — it shrinks rather than disappearing so the thing
                that got smaller is still the same object. */}
            <WaitBar
              fill={interpolate(
                clamp01((ghostStep - 0.6) / 0.28),
                [0, 1],
                [1, 0.06],
              )}
              color={theme.warm}
              label="latency: hidden"
              labelOpacity={entrance(ghostStep, 0.82, "prefetch_ghosts")}
            />
          </Chip>

          <CostStrip
            reads={sweepReads}
            tall={(i) => i % COLS === 0 && i < COLS * PAID_LINES}
            color={theme.up}
            tallColor={theme.down}
            labelOpacity={detailLeft}
          />
        </Lane>

        {/* ================= RIGHT LANE — the linked list ================== */}
        <Lane
          x={RIGHT_X}
          title="LIST"
          subtitle="same data, scattered"
          subtitleOpacity={rightSubOn * detailRight}
          titleIn={rightOn}
          accent={theme.down}
          opacity={rightOn * laneVis(RIGHT_X)}
          headerVis={headVis(RIGHT_X)}
          headerScale={headerScale}
          dim={chaseWordIn * (1 - ease(chaseWordDock))}
          word="CHASE"
          wordIn={chaseWordIn}
          wordDock={chaseWordDock}
        >
          <div style={{ position: "absolute", left: GRID_X, top: GRID_Y }}>
            {/* Behind MemoryGrid, exactly as the left lane's washes are: the
                cells and their borders stay on top of the band. This is the
                right lane's establishing reveal AND the fix for the f8150-8263
                empty window — see the RWASH_* block for both timetables. */}
            <ArrivalWash f={rightF} />
            <MemoryGrid
              mode={rightMode}
              progress={chaseP}
              seed={CHASE_SEED}
              showPrefetch={false}
              readoutScale={camScale}
              readoutGap={READOUT_GAP}
              readoutFont={MONO}
            />
            {/* The nodes land before anything walks them, staggered across the
                grid — the allocator putting them wherever it felt like. */}
            <NodeMarks
              scatter={clamp01(scatterStep)}
              visitedUpTo={rightMode === "chase" ? hopIdx : -1}
            />
            {/* Above NodeMarks, not below: the pass has to light the marks, and
                the ink highlights have to composite over the dim ones. Its own
                band is behind everything it overlaps except those highlights,
                because the wrapper's stacking is local. */}
            <AllocatorPass f={rightF} scatter={clamp01(scatterStep)} />
            {/* The rhyme that carries the whole comparison: the left lane has
                warm ghost lines sitting AHEAD of its cursor; here the same two
                slots are dashed and empty. Same position, same shape, nothing
                in them. */}
            <EmptyAhead
              t={ease(entranceN(hopStep, 0.2, "pointer_hops_stall", 8))}
              row={aheadRow}
              glyph={1 - toWide}
            />
            <PointerArrows on={hopStep > 0} hopIdx={hopIdx} hopFrac={hopFrac} />
          </div>

          <Chip
            y={CHIP_Y[0]}
            // 0.02, not 0.45. At 0.45 this landed at abs 8261 — the frame the
            // f8150-8263 empty run ENDED on, because this chip's tone band
            // (2.70% of frame, the brightest thing either lane owns) was the
            // first lit pixel after the left column retired 114 frames earlier.
            // It is also 51 frames into "nodes scattered wherever the allocator
            // felt like putting 'em", i.e. on "putting 'em"; here the words
            // "scattered anyway" land on "scattered", which is where they were
            // always meant to be.
            //
            // 0.02, not r12's 0.05, and the three frames are bought against the
            // narration's SILENCE, not its marks. `silencedetect` is useless on
            // narration.master.wav (the bed keeps it over -40 dB throughout), so
            // this is measured off the file's own per-frame RMS: the sentence
            // "with nodes scattered..." breaks at f8196-8210 (-42 to -50 dBFS)
            // and speech resumes at f8211. 0.05 fires the entrance at f8212.75,
            // AFTER the word; 0.02 fires it at f8209.3, 1.7 frames ahead of it,
            // which is the house rule. Lit from ~abs 8215, six frames inside the
            // arrival wash's last pair (full 8198-8218), so the two overlap
            // instead of handing off through a gap — at hold 15 they did not,
            // and f8217-8218 measured 0.33% lit.
            // Event: 2.70% * 6 / 8 = 2.03 against a gate of 2.0, and `ease`
            // being cubic-out puts 98.4% of the band inside the first six of
            // those eight frames — 2.66% in one 6-frame window.
            t={entrance(scatterStep, 0.02, "scatter_nodes")}
            title="same count"
            sub="scattered anyway"
            tone={theme.dim}
            detail={detailRight}
          />
          <Chip
            y={CHIP_Y[1]}
            t={entrance(hopStep, 0.12, "pointer_hops_stall")}
            title="address inside"
            sub="the last node"
            tone={theme.ink}
            detail={detailRight}
          />
          <Chip
            y={CHIP_Y[2]}
            t={entrance(hopStep, 0.5, "pointer_hops_stall")}
            title="no prefetch"
            sub="nothing ahead"
            tone={theme.down}
            detail={detailRight}
          />
          <Chip
            y={CHIP_Y[3]}
            t={entrance(hopStep, 0.28, "pointer_hops_stall")}
            title="wait per hop"
            sub=""
            tone={theme.down}
            detail={detailRight}
          >
            {/* Refills every single hop and never shrinks — the exact opposite
                of the left lane's collapsing bar, in the same slot, so the two
                sit on top of each other at the split. */}
            <WaitBar
              fill={hopFrac}
              color={theme.down}
              label="full price"
              labelOpacity={entrance(hopStep, 0.34, "pointer_hops_stall")}
            />
          </Chip>

          <CostStrip
            reads={rightMode === "chase" ? chaseP * TOTAL : 0}
            tall={() => true}
            color={theme.down}
            tallColor={theme.down}
            labelOpacity={detailRight}
          />
        </Lane>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

/**
 * One lane: title block, the grid, its annotation column, its cost strip, and
 * the big keyword that docks beside the title.
 */
const Lane: React.FC<{
  x: number;
  title: string;
  subtitle: string;
  subtitleOpacity: number;
  titleIn: number;
  accent: string;
  opacity: number;
  /**
   * The glyph-scissor guard, applied to the header block and the docked keyword
   * ONLY — never to the lane as a whole. See `headVis` at the call site: these
   * are the two elements big enough to read as chopped when the lane's leading
   * edge crosses SAFE_L, and putting the term on the wrapper instead is what
   * manufactured defect D5's 20-frame black run out of a camera pan.
   */
  headerVis: number;
  /**
   * Counter-scale for the header block, 1 at the near shots and HEADER_WIDE at
   * the split. The camera loses 44% of its scale at the pull-out; without this
   * the lane label and its docked keyword drop to 23px on screen, under the
   * 40px readability floor.
   */
  headerScale: number;
  /** How hard to dim the lane's contents while the big keyword is up. */
  dim: number;
  word: string;
  wordIn: number;
  wordDock: number;
  children: React.ReactNode;
}> = ({
  x,
  title,
  subtitle,
  subtitleOpacity,
  titleIn,
  accent,
  opacity,
  headerVis,
  headerScale,
  dim,
  word,
  wordIn,
  wordDock,
  children,
}) => {
  // Dock path: the rail beside the grid at 108px, up and across to the title's
  // own row at TYPE_HEAD. transformOrigin is the top-left so scale and position
  // stay in step.
  //
  // WORD_X WAS 20 — the word centred OVER the grid — and that is grader defect
  // P6. At 108px the pre-dock word occupies region y 300..408 and grid row 4
  // runs 368..414, so for the ~45 frames before CHASE docks (abs 8686..8731,
  // and the same again for SWEEP at abs 7591..7652) the keyword sat on top of
  // the grid and blanked a row of it. That is not a pacing problem and dimming
  // the lane underneath does not fix it: two elements were occupying one
  // rectangle, so one of them has to move.
  //
  // 490 puts the pre-dock word in the RAIL — the band between the grid's right
  // edge (GRID_W = 403) and the annotation column (COL_X = 880) — where the
  // whole grid stays readable underneath the keyword moment instead of losing a
  // row to it. Both lanes' rails are empty in their keyword windows: the left
  // lane's "free" row label now exits on `prefetch_ghosts` (see FreeTags) and
  // its first SweepNote lands 30 frames after the dock finishes; the right lane
  // has no rail furniture at all.
  //
  // 490 rather than NOTE_X (419) because the left lane's subtitle, "walks front
  // to back", measures ~484px at the TYPE_ANNO floor: starting at 490 is what
  // lets the rise below travel from y 300 to the title WITHOUT its box ever
  // crossing the subtitle. Far edge is 490 + ~350 = 840 — 40px clear of COL_X,
  // screen 1103 at both near shots and 1707 at the split, inside SAFE_R with
  // the ±3px drift.
  //
  // The word is still ~348 x 108 region px = 2.3% of the frame on screen at the
  // near shots, which is over the INK BUDGET target — this is one of the few
  // reveals in the episode that was never too small, so nothing here shrinks.
  const WORD_SIZE = 108;
  const WORD_X = 490;
  const WORD_Y = 300;
  const DOCKED = TYPE_HEAD / WORD_SIZE;
  // Eased here rather than at the two call sites: a linear opacity ramp AND a
  // linear rule draw-on are the mechanical-easing tell the motion floor bans,
  // and the left lane was passing a raw clamp ramp straight through.
  const ti = ease(titleIn);
  // The word is NOT a child of the scaled header: its DOCK TARGET is scaled
  // instead. Nesting it would have scaled its big pre-dock position too, so on
  // the right lane — where the dock and the pull-out overlap by nine frames —
  // the 108px CHASE would have started drifting before it began docking.
  // The dock is an L, not a diagonal, for the same reason WORD_X moved: a
  // straight line from the rail to the title drags the 108px word back across
  // grid rows 0-2 for the whole travel, which is the P6 occlusion again with
  // motion on it. It rises inside the rail first — x fixed, right of the grid —
  // and only slides left once it is at the title's row and clear of GRID_Y
  // entirely.
  //
  // `wordDock` arrives RAW and each leg is eased separately: 0..0.6 and 0.4..1
  // of a 10-frame dock is 6 frames a leg, inside the entrance band, with a
  // 2-frame overlap that rounds the corner instead of turning it. (Splitting an
  // already-eased ramp is what NOT to do — ease-out front-loads so hard that
  // the first leg finishes in 2.3 frames and the rise reads as a jump cut.)
  const dockUp = ease(clamp01(wordDock / 0.6));
  const dockOver = ease(clamp01((wordDock - 0.4) / 0.6));
  const wx = lerp(WORD_X, DOCK_X * headerScale, dockOver);
  const wy = lerp(WORD_Y, TITLE_Y, dockUp);
  const ws = lerp(1, DOCKED * headerScale, ease(wordDock));

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: REGION_W,
        height: REGION_H,
        opacity,
      }}
    >
      {/* ROUND 13 — DIM DEPTH 0.62 -> 0.42, and the number is derived, not tuned.
       *
       * This is the retire-cliff, and it was manufacturing the beat's darkest
       * stretch (f8686-8705, ~0.5s near-1% lit) at the CHASE keyword, where BOTH
       * lanes are dimmed at once and the pull-out shrink is running. Over
       * `theme.bg` (luma 0) a wrapper opacity `a` puts `theme.ink` at 236a, so a
       * full dim of 0.38 landed every glyph in this lane at luma 90 — under the
       * 110 lit gate, contributing 0.000%. The layer wasn't de-emphasised, it was
       * deleted, and only from the metric's point of view, which is the worst of
       * both: dark on screen AND invisible to the gate.
       *
       * Floor 0.58 -> 236 x 0.58 = 137, which is 27 clear of the gate. That
       * margin is not padding: glyph strokes are a few proxy pixels wide and
       * `scale=240:135` is bicubic, so thin bright ink measures BELOW its nominal
       * luma. A floor of 0.50 (118, margin 8) would compute as safe and still
       * measure dark. Same floor the HookRace recompose settled on, for the same
       * reason.
       *
       * The emphasis still reads: 1.00 vs 0.58 is a 1.7:1 step, and the focus
       * lane also carries scale and position against a dimmed neighbour. Buying
       * back 0.20 of opacity does not cost the shot; a half-second of black does.
       */}
      <div style={{ opacity: 1 - dim * 0.42 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transformOrigin: "0 0",
            transform: `scale(${headerScale})`,
            // The glyph-scissor guard lives here, on the three lines of text,
            // rather than on the lane wrapper — see `headerVis`.
            opacity: headerVis,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: TITLE_Y,
              color: theme.ink,
              fontSize: TYPE_HEAD,
              // Pinned to 1: at the floor the face's own leading would make the
              // line 67px and the accent rule at RULE_Y would strike through it.
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: 1,
              whiteSpace: "nowrap",
              opacity: ti,
              transform: `translateY(${(1 - ti) * 7}px)`,
            }}
          >
            {title}
          </div>
          {/* Line draw-on rather than another pop — three springs in a row is
              the banner-ad look. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: RULE_Y,
              height: 4,
              width: 160 * ti,
              background: accent,
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: SUB_Y,
              color: theme.dim,
              fontSize: TYPE_ANNO,
              // Pinned to 1 for the same reason: 68 + 51 = 119, which keeps the
              // subtitle clear of the grid's row-0 bracket at world y 114.
              lineHeight: 1,
              whiteSpace: "nowrap",
              opacity: subtitleOpacity,
            }}
          >
            {subtitle}
          </div>
        </div>
        {children}
      </div>

      <div
        style={{
          position: "absolute",
          left: wx,
          top: wy,
          transformOrigin: "0 0",
          transform: `scale(${ws * popScale(wordIn)})`,
          // On `dockOver`, not on `wordDock`: the word turns into its lane's
          // accent as it slides into the label slot, which is the frame where
          // it stops being the statement and starts being the label. Read off
          // the raw ramp this would have flipped 2 frames in, mid-rise, while
          // it was still the statement.
          color: dockOver > 0.5 ? accent : theme.ink,
          fontSize: WORD_SIZE,
          // Matches the title's pinned 1 so the docked word shares its baseline:
          // 108 * 1 * (58/108) = 58, the exact height of the title's line box.
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: -3,
          whiteSpace: "nowrap",
          // Same scissor guard as the header: a 108px keyword cut in half by
          // the mask edge is the one thing in this lane that would read as a
          // rendering fault rather than as travel.
          opacity: wordIn * headerVis,
        }}
      >
        {word}
      </div>
    </div>
  );
};

/**
 * Annotation panel. Panels are for annotations only — the diagram is full-bleed.
 *
 * `detail` fades the WHOLE card, not just its sub. At 36px the card reads at
 * 41.4px on screen in a near shot and 23px at the split, so there is no camera
 * position where a shrunken version of it is worth keeping: it leaves on its
 * lane's camera cue and does not come back.
 */
const Chip: React.FC<{
  y: number;
  t: number;
  title: string;
  sub: string;
  tone: string;
  detail: number;
  children?: React.ReactNode;
}> = ({ y, t, title, sub, tone, detail, children }) => (
  /* D1, and the reason rel 114-268 measured dead even though the ladder above
     lists five chips landing in it.

     The chip was `theme.panel` — rgba(14,14,16,0.72), which composites to luma
     10.7 on black: a contrast ratio of 1.04:1. A 520x152 card is 2.6% of the
     frame after the 1.15 camera, so the AREA was never the problem; the whole
     card arriving moved the picture by ten luma. Worse, `opacity: t` was a
     LINEAR 8-frame ramp, so even a bright card would have arrived at 1/8 of
     its delta per frame. Both are fixed here:

       1. the title row is a SOLID TONE BAND with black type on it —
          520 x 74.65 world = 55,900 px on screen = 2.70% of the frame, filled
          at luma 116 (down) to 181 (warm). Black on every tone this file
          passes reads 6.8:1 or better, so the band is the most legible thing
          on the chip as well as the brightest.
       2. `opacity: ease(t)` — cubic ease-out puts 33% of the delta on the
          FIRST frame (dY 38-60 depending on tone) instead of 12.5% (dY 14-22,
          under the 25 gate). This one character is the difference between a
          chip that registers and a chip that does not.

     The card body stays dark on purpose: theme.dim sub-copy needs a dark bed
     (6.55:1 there, 2.1:1 on anything bright enough to burst), so the burst
     lives in the band and the readability lives in the body.

     Heights are UNCHANGED to the pixel so CHIP_Y's 152/244 pitch still holds:
     old 2 + 14 + 58.65 + 6 + 58.65 + 14 = 153.3; new 6 + 74.65 + 64.65 + 8 =
     153.3. The 3px border replaces the 1px one (a 1px edge is an eighth of a
     pixel at the pacing proxy) and its extra 4px is paid for out of padding. */
  <div
    style={{
      position: "absolute",
      left: COL_X,
      top: y,
      width: COL_W,
      boxSizing: "border-box",
      background: theme.panel,
      border: `3px solid ${theme.stroke}`,
      borderRadius: 10,
      overflow: "hidden",
      opacity: ease(t) * clamp01(detail),
      transform: `scale(${popScale(t)}) translateY(${(1 - t) * 6}px)`,
      transformOrigin: "left top",
    }}
  >
    {/* Both rows are TYPE_ANNO with an explicit lineHeight, never the face's
        default: the widest title is now 14 mono chars, `nowrap` turns a 1px
        shortfall into text hanging out of the panel, and 14 * 51 * 0.6 = 428.4
        inside a 478px content box. The pinned lineHeight is also what makes the
        CHIP_Y pitch above arithmetic (152px / 178px cards) rather than a guess
        about font metrics. */}
    <div
      style={{
        padding: "8px 18px",
        background: tone,
        fontFamily: MONO,
        fontSize: TYPE_ANNO,
        lineHeight: 1.15,
        fontWeight: 700,
        color: theme.bg,
        whiteSpace: "nowrap",
      }}
    >
      {title}
    </div>
    {sub ? (
      <div
        style={{
          padding: "6px 18px 0",
          fontSize: TYPE_ANNO,
          lineHeight: 1.15,
          color: theme.dim,
          whiteSpace: "nowrap",
        }}
      >
        {sub}
      </div>
    ) : null}
    {children ? <div style={{ padding: "0 18px 8px" }}>{children}</div> : null}
  </div>
);

/** The per-read wait, as a bar. No units on purpose — see CostStrip. */
const WaitBar: React.FC<{
  fill: number;
  color: string;
  label: string;
  labelOpacity: number;
}> = ({ fill, color, label, labelOpacity }) => (
  <div style={{ marginTop: 12 }}>
    <div
      style={{
        height: 14,
        width: "100%",
        background: theme.stroke,
        borderRadius: 3,
      }}
    >
      <div
        style={{
          height: 14,
          width: `${clamp01(fill) * 100}%`,
          background: color,
          borderRadius: 3,
        }}
      />
    </div>
    <div
      style={{
        marginTop: 6,
        fontSize: TYPE_ANNO,
        lineHeight: 1.15,
        color: theme.dim,
        whiteSpace: "nowrap",
        opacity: clamp01(labelOpacity),
      }}
    >
      {label}
    </div>
  </div>
);

/**
 * One bar per read, drawing on as the cursor passes it. Sixty-four thin bars
 * read as a cost profile rather than a chart, which is what's wanted: the shape
 * is the argument, and it fills continuously across the longest step in the beat
 * instead of leaving a 15-second stretch with nothing new in it.
 */
const CostStrip: React.FC<{
  reads: number;
  tall: (i: number) => boolean;
  color: string;
  tallColor: string;
  /** Fine print, so it leaves with its lane's annotation column. */
  labelOpacity: number;
}> = ({ reads, tall, color, tallColor, labelOpacity }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: STRIP_LABEL_Y,
        fontSize: TYPE_ANNO,
        // Pinned to 1: at the floor a 1.25 line box would be 64px and run from
        // 668 to 732, i.e. 12px into the cost bars, which start at STRIP_BASE -
        // STRIP_MAX_H = 720. At 1 it ends at 719.
        lineHeight: 1,
        color: theme.dim,
        whiteSpace: "nowrap",
        opacity: clamp01(reads) * clamp01(labelOpacity),
      }}
    >
      cost per read
    </div>
    {/* The full 64-read extent, always drawn. Without it the chase strip — which
        only ever gets ~26 reads in — would read as "cheaper" rather than as
        "still going". */}
    <div
      style={{
        position: "absolute",
        left: 0,
        // 6px straddling STRIP_BASE, not a 2px hairline sitting on it. This
        // baseline IS the "cost strip on" event at rel 176, and 850 x 2 world
        // px is 1,700 px — 0.11% of the frame after the 1.15 camera, a third of
        // what the detector needs, so the event never existed. 850 x 6 = 6,745
        // px on screen = 0.33%, and theme.stroke's 3.09:1 means the arrival is
        // dY 91 across it. It straddles the baseline (top - 3) so the bars,
        // which are positioned from STRIP_BASE, still sit exactly on it, and
        // the strip's world footprint grows by 3px: 803 -> screen 1005, inside
        // the 1015 bound even with the +-2px ambient drift.
        top: STRIP_BASE - 3,
        width: (TOTAL - 1) * BAR_PITCH + BAR_W,
        height: 6,
        background: theme.stroke,
        opacity: clamp01(reads),
      }}
    />
    {Array.from({ length: TOTAL }).map((_, i) => {
      // x2 so a bar lands in ~half a read interval: at the sweep's pace that's
      // ~4 frames, at the chase's ~7. Snappy either way.
      const t = ease(clamp01((reads - i) * 2));
      if (t <= 0) return null;
      const isTall = tall(i);
      const h = STRIP_MAX_H * (isTall ? 1 : BAR_SHORT) * t;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: i * BAR_PITCH,
            top: STRIP_BASE - h,
            width: BAR_W,
            height: h,
            background: isTall ? tallColor : color,
            opacity: isTall ? 0.95 : 0.7,
            borderRadius: 2,
          }}
        />
      );
    })}
  </>
);

/**
 * The row-0 label slot, shared by "64 B" and then "free". Grid-local, sitting
 * just off the grid's right edge on row 0's own centre line.
 *
 * It used to sit ABOVE the row at top -32. At 24px that fitted; at the cap-height
 * floor the label is 51px tall and would have had to start well above y -46,
 * i.e. through the lane subtitle. Out to the right, row 0 is the only thing at
 * that height and the annotation column is 461px further right, so the slot is
 * unconstrained in both directions. (The grid wrapper's clip-path carries a
 * -170px right inset for exactly this reason; the widest label, "64 B", is
 * 4 * 51 * 0.6 = 123px from x 419, ending at 542 — inside GRID_W + 170 = 573.)
 *
 * lineHeight is pinned to 1 and top to -3 so the 51px line box is centred on the
 * 46px cell row instead of hanging below it.
 */
const ROW_LABEL_X = GRID_W + 16;
const RowLabel: React.FC<{ text: string; opacity: number }> = ({
  text,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      left: ROW_LABEL_X,
      top: -3,
      fontFamily: MONO,
      fontSize: TYPE_ANNO,
      lineHeight: 1,
      color: theme.dim,
      whiteSpace: "nowrap",
      opacity: clamp01(opacity),
    }}
  >
    {text}
  </div>
);

/**
 * A grid-anchored annotation living in the band between the grid's right edge
 * and the annotation column — the sub-reveal vehicle for `prefetch_ghosts`.
 *
 * It shares the row-0 label's column (NOTE_X) so the tags and the "64 B"/"free"
 * label read as one vertical rail rather than as free-floating chrome, and it is
 * a bare tick + word, NOT a panel: cards are containers, and six more cards on
 * the diagram would be exactly the banner-ad look the variety rules ban.
 *
 * WIDTH BUDGET, why every string here is <= 13 characters: the band is
 * COL_X - NOTE_X - 40 = 421px, the tick and its gutter eat 20, and JetBrains
 * Mono's advance is 0.6em, so at the TYPE_ANNO floor a character is 30.6px and
 * 13 of them are 397.8. The far edge lands at region x 837 — 43px clear of the
 * annotation column and screen x 1099 in the near shot. Text that does not fit
 * gets SHORTENED; nothing here is allowed to drop below the floor.
 *
 * Vertically each tag is centred on its grid row's cells, and row 7 — the last
 * one used — ends at grid-local y 482.5, clear of MemoryGrid's readout at 506.
 */
const NOTE_X = ROW_LABEL_X;
const NOTE_W = COL_X - NOTE_X - 40;
const NOTE_TICK = 6;
const NOTE_GUTTER = 14;
type NoteEnter = "draw" | "spine" | "pop" | "wipe" | "slide" | "count";

const SweepNote: React.FC<{
  row: number;
  t: number;
  /** Fades with its lane's annotation column — 51px world type is 33px at the split. */
  detail: number;
  text: string;
  /** `#` is replaced by the count-up value when `count` is given. */
  count?: number;
  /** 0..1 exit, ~6 frames, for the notes whose row is reused later in the beat. */
  out?: number;
  enter: NoteEnter;
  color: string;
}> = ({ row, t, detail, text, count, out = 0, enter, color }) => {
  const op = clamp01(t) * clamp01(detail) * (1 - clamp01(out));
  if (op <= 0) return null;
  const e = ease(clamp01(t));
  const top = row * (CELL + LINE_GAP) + CELL / 2 - TYPE_ANNO / 2;
  // The spine literally draws the straight line the cursor has just walked:
  // from row 0's centre down to this tag. Its word arrives after the line does.
  const spineH = top + TYPE_ANNO / 2 - CELL / 2;
  const textIn = enter === "spine" ? clamp01((e - 0.45) / 0.55) : 1;
  const shown =
    count === undefined
      ? text
      : text.replace("#", String(Math.round(e * count)));
  return (
    <div
      style={{
        position: "absolute",
        left: NOTE_X,
        top,
        width: NOTE_W,
        height: TYPE_ANNO,
        opacity: op,
        transform:
          enter === "pop"
            ? `scale(${popScale(t)})`
            : enter === "slide"
              ? `translateX(${(1 - e) * -28}px)`
              : "none",
        transformOrigin: "left center",
      }}
    >
      {enter === "spine" ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: CELL / 2 - top,
            width: 3,
            height: spineH * e,
            background: color,
            opacity: 0.75,
            borderRadius: 2,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: NOTE_TICK,
          height: TYPE_ANNO,
          background: color,
          borderRadius: 2,
          transformOrigin: "center top",
          transform: `scaleY(${enter === "draw" ? e : 1})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: NOTE_TICK + NOTE_GUTTER,
          top: 0,
          fontFamily: MONO,
          fontSize: TYPE_ANNO,
          // Pinned to 1 so the 51px line box is exactly the tick's height and
          // the pair sits centred on the 46px cell row.
          lineHeight: 1,
          fontWeight: 700,
          color: color === theme.dim ? theme.ink : color,
          whiteSpace: "nowrap",
          opacity: enter === "draw" ? clamp01((e - 0.3) / 0.7) : textIn,
          clipPath:
            enter === "wipe" ? `inset(0 ${(1 - e) * 100}% 0 0)` : undefined,
        }}
      >
        {shown}
      </div>
    </div>
  );
};

/**
 * THE FIRST READ'S PRICE — a plate, not a tag.
 *
 * One rectangle in the rail, revealed in two stages, and the only element in
 * `sweep_cursor` sized against the detector rather than against the eye alone.
 * The full derivation (why the tag it replaces was invisible, the geometry, the
 * area/duration and luma arithmetic) is in the PRICE_* block above the scene —
 * read that before changing any number here, because every one of them is
 * load-bearing against a measured threshold.
 *
 * Two stages, two grammars, deliberately:
 *
 *   head — MASK-WIPE. `clipPath: inset(0 X% 0 0)` sweeps the upper band in
 *          left-to-right in 8 frames. The step's previous entrance was the
 *          "read #1 — miss" chip's spring pop and the next is the row-0
 *          bracket's morph into MemoryGrid's line container, so nothing
 *          repeats and the four-grammar rule is satisfied inside one step.
 *   tail — GROWTH of the same object. The plate is ONE div whose height runs
 *          170 -> 340; the bottom edge sweeping down is a second contiguous
 *          black-to-red fill of an identical-sized rectangle, and because it is
 *          the same object growing rather than a second card popping in, it
 *          reads as the price turning out to be bigger, which is what "FULL
 *          price" means.
 *
 * `overflow: hidden` is not cosmetic. The label is parked at PRICE_LABEL_TOP,
 * below the head band's 170px extent, so it is physically outside the box until
 * the growth reaches it — the words are wiped on by the same motion that
 * enlarges the plate instead of fading in on a ramp of their own. One event,
 * one grammar, and the label cannot appear before the growth that narrates it.
 *
 * The type is black on theme.down (6.8:1 — the same pairing the Chip's tone
 * band uses) at the mono floor, 10 characters * 51 * 0.6 = 306px inside a
 * 421 - 40 = 381px content box, so `nowrap` cannot overflow.
 */
const PricePlate: React.FC<{
  /** 0..1, the upper band's left-to-right wipe. */
  head: number;
  /** 0..1, the downward growth that doubles the plate and reveals its label. */
  tail: number;
  /** 0..1 exit, 6 frames, on the cache line arriving. */
  out: number;
  /** Fades with its lane's annotation furniture on the camera cue. */
  detail: number;
}> = ({ head, tail, out, detail }) => {
  const op = clamp01(detail) * (1 - clamp01(out));
  if (head <= 0 || op <= 0) return null;
  const h = ease(clamp01(head));
  const t = ease(clamp01(tail));
  return (
    <div
      style={{
        position: "absolute",
        left: NOTE_X,
        top: PRICE_TOP,
        width: NOTE_W,
        height: PRICE_BAND_H * (1 + t),
        background: theme.down,
        borderRadius: 10,
        overflow: "hidden",
        opacity: op,
        // The wipe clips the WHOLE plate, which matters only during `head`:
        // by the time `tail` runs, `h` is long since 1 and this is inset(0).
        clipPath: `inset(0 ${((1 - h) * 100).toFixed(2)}% 0 0)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 20,
          top: PRICE_LABEL_TOP,
          fontFamily: MONO,
          fontSize: TYPE_ANNO,
          // Pinned to 1 like every other annotation here, so the 51px line box
          // is exactly what PRICE_LABEL_TOP was centred against.
          lineHeight: 1,
          fontWeight: 700,
          color: theme.bg,
          whiteSpace: "nowrap",
        }}
      >
        full price
      </div>
    </div>
  );
};

/**
 * Row 0, outlined and sized. Bracket-style box, never a ring — circle
 * annotations are banned channel-wide.
 */
const LineOutline: React.FC<{ draw: number; handoff: number }> = ({
  draw,
  handoff,
}) => {
  if (draw <= 0 || handoff >= 1) return null;
  const t = ease(draw);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: -10,
          top: -6,
          // border-box + the +2 on each axis reproduces the OLD outer box to
          // the pixel (right edge GRID_W + 12, bottom CELL + 8), so the outline
          // still lands exactly on MemoryGrid's line container at the handoff.
          // The stroke itself goes 1px -> 3px because a 1px dashed edge is
          // roughly a twentieth of a pixel at the 8x pacing proxy: the row-0
          // bracket is listed as the rel-158 event and it was, measurably, not
          // one. 3px dashed accent is 8.31:1 and actually draws on.
          boxSizing: "border-box",
          width: (GRID_W + 22) * t,
          height: CELL + 14,
          borderRadius: 8,
          border: `3px dashed ${theme.accent}`,
          opacity: (1 - handoff) * 0.8,
        }}
      />
      <RowLabel
        text="64 B"
        opacity={clamp01((t - 0.55) / 0.45) * (1 - handoff)}
      />
    </>
  );
};

/**
 * The seven cells nobody asked for, marked free. Staggered 3 frames apart — the
 * cascade is what makes it read as one line arriving, where seven simultaneous
 * marks would read as seven separate events.
 *
 * The per-cell mark is a RULE, not the word "free". A cell is 46px wide and the
 * readability floor is 36px world type, at which "free" is 86px and would run
 * across two neighbours; there is no legible way to put a word inside a cell at
 * this scale. So the seven cells get a green underline each and the word is
 * said ONCE at full size, in the row-label slot the "64 B" tag has just vacated
 * (handoff completes at line_lights_whole 0.043, these start at 0.55) — a label
 * transforming into another label rather than seven tiny ones popping in.
 *
 * `labelOut` is the label's LIFE, not a nicety. The slot is a handoff chain —
 * "64 B" becomes "free" becomes the sweep notes — and a link that never lets go
 * stops being an annotation and becomes chrome (see the call site).
 */
const FreeTags: React.FC<{ t: number; labelOut: number }> = ({
  t,
  labelOut,
}) => {
  if (t <= 0) return null;
  return (
    <>
      {Array.from({ length: COLS - 1 }).map((_, k) => {
        const c = k + 1;
        // 3-frame stagger inside a 28-frame window = 0.107 of the window each.
        const tt = ease(clamp01((t - k * 0.107) / 0.29));
        if (tt <= 0) return null;
        return (
          <div
            key={c}
            style={{
              position: "absolute",
              left: c * (CELL + GAP),
              // Below row 0's line container (which insets -6) and above row 1,
              // which starts at CELL + LINE_GAP = 62.
              top: 56,
              width: CELL * tt,
              height: 4,
              borderRadius: 2,
              background: theme.up,
              opacity: tt,
            }}
          />
        );
      })}
      <RowLabel
        text="free"
        opacity={clamp01(t / 0.29) * (1 - clamp01(labelOut))}
      />
    </>
  );
};

/**
 * The right lane's grid arriving: four two-row bands wiping on left-to-right,
 * holding, then decaying. Same paint and same job as the left lane's `rowWash`
 * — a lit bed that makes a transparent grid exist — driven off `rightF` rather
 * than a step progress because it has to live across a step boundary. Every
 * number, and the empty window it closes, is derived in the RWASH_* block.
 *
 * The wipe is deliberately not the left lane's grammar: that one is uncovered
 * by the grid's clip-path descending, this one is a horizontal mask wipe, so
 * the two establishing shots rhyme without repeating.
 */
const ArrivalWash: React.FC<{ f: number }> = ({ f }) => (
  <>
    {Array.from({ length: RWASH_PAIRS }).map((_, j) => {
      const at = RWASH_FROM + j * RWASH_PITCH;
      const e = ease(clamp01((f - at) / RWASH_WIPE));
      const a =
        WASH_ALPHA *
        (1 - ease((f - (at + RWASH_WIPE + RWASH_HOLD)) / RWASH_DECAY));
      if (e <= 0 || a <= 0.001) return null;
      const r = j * 2;
      return (
        <div
          key={j}
          style={{
            position: "absolute",
            left: -10,
            top: r * (CELL + LINE_GAP) - 6,
            width: GRID_W + 20,
            // Both rows plus the LINE_GAP between them: 46 + 16 + 46 + 12 = 120.
            // Spanning the gap is what makes the pair one band rather than two
            // stacked ones, and it is 3.24% of frame instead of 3.13%.
            height: 2 * CELL + LINE_GAP + 12,
            borderRadius: 8,
            background: `rgba(255, 255, 255, ${a.toFixed(3)})`,
            clipPath: `inset(0 ${((1 - e) * 100).toFixed(2)}% 0 0)`,
          }}
        />
      );
    })}
  </>
);

/**
 * The allocator's pass across the middle of the grid — the second element
 * `scatter_nodes` needed, derived in the APASS_* block above.
 *
 * Everything lives inside one wrapper so the band AND the nodes it lights share
 * a single clip-path: the wipe edge travels left to right and each node turns
 * from `theme.dim` to `theme.ink` as the edge crosses it, rather than 14 marks
 * popping independently. That is a transform of something already on screen,
 * not another card arriving — the grammar this beat has already spent on chips.
 *
 * The ink marks are drawn ON TOP of the existing NodeMarks rather than
 * recolouring them, which is what lets the highlight retire by fading: the dim
 * node underneath is untouched and simply comes back. Recolouring would have
 * needed an rgb lerp between two solid tokens, and the retire would have been a
 * hard swap of 14 marks at whatever frame the band's alpha crossed a threshold.
 */
const AllocatorPass: React.FC<{ f: number; scatter: number }> = ({
  f,
  scatter,
}) => {
  // LINEAR. Not `ease`. See the APASS_* block: an eased wipe opens at 3/8 speed
  // and presents 0.23%/frame against a 0.3% gate, which is the exact failure
  // this component exists to fix.
  const e = clamp01((f - APASS_AT) / APASS_WIPE);
  const a =
    1 - ease(clamp01((f - (APASS_AT + APASS_WIPE + APASS_HOLD)) / APASS_DECAY));
  if (e <= 0 || a <= 0.001) return null;
  const NODE_IN = 8 / STEP_FRAMES.scatter_nodes;
  return (
    // Anchored on the band's own left edge, not the grid's, so the clip-path
    // percentage is measured against exactly the width being revealed.
    <div
      style={{
        position: "absolute",
        left: -10,
        top: 0,
        width: GRID_W + 20,
        height: GRID_H,
        opacity: a,
        clipPath: `inset(0 ${((1 - e) * 100).toFixed(2)}% 0 0)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: APASS_ROW * (CELL + LINE_GAP) - 6,
          width: GRID_W + 20,
          height: APASS_ROWS * CELL + (APASS_ROWS - 1) * LINE_GAP + 12,
          borderRadius: 8,
          // contrast-exempt: transient reveal wash, 32 frames end to end,
          // carrying no text of its own and nothing anyone is asked to read off
          // it. The idle floor protects read elements; the read elements here
          // are the nodes ON it, and they are theme.ink at 9.0:1 against this
          // band. 0.45 composites to luma 58.5, which is 2.3x the pacing
          // detector's dY >= 25 — the metric this band exists to satisfy — while
          // leaving MemoryGrid's cell borders visible through it (they tint to
          // luma 108 over a 58.5 band, so the grid structure survives the pass
          // instead of being replaced by a slab). At the 0.65 the 3:1 floor
          // would require, the band becomes the brightest new object in the
          // frame and the marks stop being the subject of their own sentence.
          // Same verdict as GlideBand below, opposite reason: that one must not
          // register as an event, this one must, and neither needs to be legible
          // in the sense the floor means.
          background: alpha(theme.down, 0.45),
        }}
      />
      {Array.from({ length: NODE_COUNT }).map((_, k) => {
        const idx = ORDER[k];
        const r = Math.floor(idx / COLS);
        if (r < APASS_ROW || r >= APASS_ROW + APASS_ROWS) return null;
        // Same stagger NodeMarks uses, so a highlight can never appear over a
        // node that has not landed yet.
        const t = ease(clamp01((scatter - hash01(k, 31) * 0.9) / NODE_IN));
        if (t <= 0) return null;
        const c = cellCenter(idx);
        const s = 30;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: c.x - s / 2 + 10,
              top: c.y - s / 2,
              width: s,
              height: s,
              borderRadius: 4,
              background: theme.ink,
              opacity: t,
            }}
          />
        );
      })}
    </div>
  );
};

/**
 * The list nodes, dropped into cells the chase will actually visit. Staggered by
 * a hash of the index rather than by position, so they land in scattered order —
 * a top-to-bottom cascade would imply the allocator laid them out in order,
 * which is the opposite of the point.
 */
const NodeMarks: React.FC<{ scatter: number; visitedUpTo: number }> = ({
  scatter,
  visitedUpTo,
}) => (
  <>
    {Array.from({ length: NODE_COUNT }).map((_, k) => {
      const idx = ORDER[k];
      // `scatter` is the RAW step progress, not an eased one, and each node gets
      // a fixed 8-frame entrance staggered by its hash across the first 90% of
      // the step (last node settles at 0.97). Easing the input made the per-node
      // entrance depend on where in the ease it fell — the late nodes were
      // ramping for ~35 frames, four times the ceiling.
      const NODE_IN = 8 / STEP_FRAMES.scatter_nodes;
      const t = ease(clamp01((scatter - hash01(k, 31) * 0.9) / NODE_IN));
      if (t <= 0) return null;
      const c = cellCenter(idx);
      const visited = k <= visitedUpTo;
      // ROUND 11: 30, not 18, and SOLID, not an outline round a transparent
      // hole. These 28 marks are the entire visual payload of `scatter_nodes`
      // and they were painting nothing measurable. An 18px box with a 2px
      // border is 20.7 x 20.7 screen px after CAM_NEAR — 2.6 x 2.6 at the 8x
      // pooling both grader metrics use — and its ink was a 2px stroke, which
      // pools to nothing. So the step's 114 frames of "nodes scattered wherever
      // the allocator felt like" contributed 0.000% lit and helped nothing when
      // f8150-8263 measured 0.25% lit. At 30 world px the mark is 34.5 on
      // screen, 4.3 pooled px with a solid 3x3 interior, and 28 of them at
      // 1,190 px each are 1.61% of the frame. 30 also still leaves an 8px ring
      // of MemoryGrid's 46px cell showing, so a node never blanks the cursor
      // cell it lands on.
      //
      // ROUND 12 CORRECTION — the arithmetic above is right and the conclusion
      // drawn from it was wrong. 1.61% is a LIT figure, and lit was never the
      // gate this step was failing. Against the CONTENT-EVENT gate these marks
      // are unfixable at any size a 46px cell can hold: the 28 entrances are
      // spread over ~102 frames by the hash stagger, so they present
      // 1.61 * 6 / 102 = 0.095 against a floor of 2.0, and even landing all 28
      // on one frame would reach only 1.61. The 3.10s dead run at f8231-8323
      // was therefore NOT a timing problem with NodeMarks and could not have
      // been fixed by re-timing them. See AllocatorPass above for the element
      // that actually closes it; these marks stay exactly as Round 11 left
      // them, and are what the pass lights up.
      const s = 30;
      return (
        <div
          key={k}
          style={{
            position: "absolute",
            left: c.x - s / 2,
            top: c.y - s / 2,
            width: s,
            height: s,
            borderRadius: 4,
            border: `3px solid ${visited ? theme.down : theme.dim}`,
            // Both states are now SOLID tokens rather than an alpha of one.
            // The fill was theme.down @ 0.65 (3.06:1) against a transparent
            // unvisited state, which meant "has the chase touched this node" —
            // the scene's one claim — was carried by a 2px stroke at 2.6 pooled
            // px. Solid theme.dim (6.83:1, luma 147) reads as a node sitting in
            // a cell and solid theme.down (6.26:1) as one the chase has paid
            // for; the distinction is hue, at full strength, at a size the eye
            // and both detectors can resolve.
            background: visited ? theme.down : theme.dim,
            opacity: t,
            transform: `scale(${popScale(t)})`,
          }}
        />
      );
    })}
  </>
);

/**
 * Two dashed, empty line slots where the sweep lane had its prefetch ghosts.
 * Placed on the rows after the cursor's row for the same reason the ghosts were
 * — that's where a prefetcher would look. Dashed and marked "?" because nothing
 * on the chip knows where the next node is until this one comes back.
 *
 * Bracket-and-dim, never a ring: circle annotations are banned channel-wide.
 */
const EmptyAhead: React.FC<{ t: number; row: number; glyph: number }> = ({
  t,
  row,
  glyph,
}) => {
  return (
    <>
      {[1, 2].map((d) => {
        const r = row + d;
        // Fade over the last row instead of `if (r > ROWS - 1) return null`.
        // `row` tracks a cursor that teleports anywhere in the grid, so it sits
        // on rows 6 and 7 often, and the hard cut made one or both boxes blink
        // out and back — an element vanishing with no exit, several times a
        // second, on the one rhyme the comparison rests on.
        const edge = clamp01(ROWS - r);
        if (edge <= 0) return null;
        return (
          <div
            key={d}
            style={{
              position: "absolute",
              left: -10,
              top: r * (CELL + LINE_GAP) - 6,
              width: GRID_W + 20,
              height: CELL + 12,
              borderRadius: 8,
              // 3px, not 1px: this empty slot is the whole rhyme against the
              // left lane's ghost lines, and at the 8x pacing proxy a 1px
              // dashed edge is a twentieth of a pixel — its arrival moved
              // nothing at all. 3px also survives the 0.64 split-shot camera.
              border: `3px dashed ${theme.stroke}`,
              opacity: t * edge * (d === 1 ? 1 : 0.6),
            }}
          >
            <div
              style={{
                position: "absolute",
                right: 12,
                // The dashed slot is CELL + 12 = 58 tall, which is exactly one
                // TYPE_HEAD line at lineHeight 1 — so the "?" fills it instead
                // of hanging 14px out of the bottom as it would at 1.25.
                top: 0,
                fontFamily: MONO,
                fontSize: TYPE_HEAD,
                lineHeight: 1,
                color: theme.dim,
                // READABILITY FLOOR. TYPE_HEAD is 58 world px = a 42.3px cap at
                // CAM_NEAR, on the floor. At the split shot the camera is 0.64,
                // which renders the same glyph at a 27px cap — 33% under. The
                // rule is cut, never shrink: the glyph fades out as the camera
                // pulls back and the dashed empty slot (which is the actual
                // information) carries the beat on its own.
                opacity: clamp01(glyph),
              }}
            >
              ?
            </div>
          </div>
        );
      })}
    </>
  );
};

/**
 * The pointer chain, drawn only BEHIND the cursor. This is the mechanism, not
 * decoration: the arrow out of a node cannot exist until that node has been
 * read, so it draws in during the back half of each hop and the cursor only
 * moves once it has landed. Nothing is ever drawn ahead — that absence is the
 * whole reason the chase is slow.
 */
const TRAIL = 5;
const PointerArrows: React.FC<{
  on: boolean;
  hopIdx: number;
  hopFrac: number;
}> = ({ on, hopIdx, hopFrac }) => {
  if (!on) return null;
  const segs: Array<{ k: number; draw: number; fade: number }> = [];
  for (let k = Math.max(0, hopIdx - TRAIL); k <= hopIdx; k++) {
    const isLive = k === hopIdx;
    segs.push({
      k,
      draw: isLive ? ease(clamp01((hopFrac - 0.55) / 0.4)) : 1,
      fade: isLive ? 1 : 0.22 + 0.5 * (1 - (hopIdx - k) / TRAIL),
    });
  }
  return (
    <svg
      width={GRID_W}
      height={GRID_H}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
    >
      {segs.map(({ k, draw, fade }) => {
        if (draw <= 0) return null;
        const a = cellCenter(ORDER[k]);
        const b = cellCenter(ORDER[k + 1]);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        // Stop short of the target cell centre so the head reads as pointing AT
        // the node rather than sitting on top of it.
        const tipX = a.x + Math.cos(ang) * (len - 12) * draw;
        const tipY = a.y + Math.sin(ang) * (len - 12) * draw;
        return (
          <g key={k} opacity={fade}>
            <line
              x1={a.x}
              y1={a.y}
              x2={tipX}
              y2={tipY}
              stroke={theme.down}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {draw > 0.88 ? (
              <polygon
                points={arrowHead(tipX, tipY, ang)}
                fill={theme.down}
                opacity={interpolate(draw, [0.88, 1], [0, 1])}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
};

function arrowHead(x: number, y: number, ang: number): string {
  const s = 9;
  const p1 = [x, y];
  const p2 = [x - Math.cos(ang - 0.4) * s, y - Math.sin(ang - 0.4) * s];
  const p3 = [x - Math.cos(ang + 0.4) * s, y - Math.sin(ang + 0.4) * s];
  return [p1, p2, p3]
    .map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`)
    .join(" ");
}

/**
 * A soft band running down the finished sweep grid during the split hold.
 * Frame-driven and therefore never used to reveal anything — it exists so the
 * last shot of a 57-second beat isn't a still photograph. Faded at both ends of
 * its travel so the wrap has no visible seam.
 */
const GlideBand: React.FC<{ opacity: number; frame: number }> = ({
  opacity,
  frame,
}) => {
  if (opacity <= 0) return null;
  const PERIOD = 96;
  const phase = (((frame % PERIOD) + PERIOD) % PERIOD) / PERIOD;
  return (
    <div
      style={{
        position: "absolute",
        left: -10,
        top: phase * (GRID_H - 48),
        width: GRID_W + 20,
        height: 48,
        borderRadius: 8,
        // contrast-exempt: ambient, and deliberately staying that way. This band
        // reveals nothing (see the doc above) — it is frame-driven, not
        // progress-driven. Raising it to the 3:1 idle floor would make a loud
        // green rectangle sweep the grid every 96 frames, competing with the
        // content it sits behind, AND it would start tripping the pacing
        // detector's dY>=25 gate on pure ambient motion. That is scoring the
        // test rather than passing it: PRODUCTION-LESSONS is explicit that
        // ambient drift is NOT a content event, so a drift layer bright enough
        // to be counted as one makes every pacing measurement downstream a lie.
        background: alpha(theme.up, 0.16),
        opacity: opacity * Math.sin(Math.PI * phase),
      }}
    />
  );
};
