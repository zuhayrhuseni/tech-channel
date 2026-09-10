import React from "react";
import { Easing, interpolate } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { MemoryGrid, gridDockScale } from "../../components";
import { IDLE_MIN_ALPHA, TYPE, theme } from "../../components/theme";

const MONO = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
}).fontFamily;
const SANS =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Build steps, named exactly as in this beat's `build:` list in script.yaml.
 * Same contract as DrepperChart/RatioMorph: when the render is wrong you read
 * the build list, see which step misfired, and fix that one number.
 */
export type CacheLineStep =
  | "byte_grid"
  | "one_cell_pulse"
  | "row_lights"
  | "row_label_64"
  | "apple_line_chip"
  | "free_tags_cascade";

export const CACHE_LINE_STEPS: CacheLineStep[] = [
  "byte_grid",
  "one_cell_pulse",
  "row_lights",
  "row_label_64",
  "apple_line_chip",
  "free_tags_cascade",
];

/**
 * RAMP LENGTH of each step's playhead, in frames — NOT the slot width.
 *
 * Episode005's scheduler runs this beat in PLAYHEAD mode, so `p` for a step is
 * linear over `slotWidth + tail` frames. Multiplying `p` by the number below
 * therefore returns EXACTLY "frames since this step started", which is the only
 * unit the 2-3-second rule can be audited in. Same device as
 * `TRICK_QUESTION_NOMINAL` in TrickQuestion.tsx — that file is the sanctioned
 * pattern and this one follows it verbatim.
 *
 * Derived from PLANS.cache_line (weights 110/108/82/130/304/447) against
 * timing.json's beat window 5823..7092 with `line` @6101 pinning `row_lights`:
 *
 *   step               abs slot        width  +tail  = NOMINAL
 *   byte_grid          5823..5962       139     8      147
 *   one_cell_pulse     5962..6098       136     8      144
 *   row_lights         6098..6183        85     8       93
 *   row_label_64       6183..6317       134     8      142
 *   apple_line_chip    6317..6631       314     8      322
 *   free_tags_cascade  6631..7092       461     8      469
 *
 * Every `sub()` below is annotated with the beat-relative frame it fires on and
 * the words it lands under. NOTHING here reads the clock: `frame` drives idle
 * micro-motion only.
 */
export const CACHE_LINE_NOMINAL: Record<CacheLineStep, number> = {
  byte_grid: 147,
  one_cell_pulse: 144,
  row_lights: 93,
  row_label_64: 142,
  apple_line_chip: 322,
  free_tags_cascade: 469,
};

export interface CacheLineProps {
  /** 0..1 per step; absent = 0 = not started. Caller maps timing.json marks. */
  p: Partial<Record<CacheLineStep, number>>;
  /** Absolute frame, for idle micro-motion ONLY. Everything else is progress-driven. */
  frame?: number;
}

/* ------------------------------------------------------------------------- */
/* Motion primitives                                                         */
/* ------------------------------------------------------------------------- */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });
const easeIn = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.in(Easing.cubic) });

/** Entrance length. 8 frames = 267ms, mid-band of the 6-9f house rule. */
const ENTER = 8;
/** Exits are shorter than entrances and get out of the way. */
const EXIT = 6;

/** Sub-reveal scheduler: `at`/`dur` are FRAMES from the start of the step. */
const sub = (
  v: number | undefined,
  step: CacheLineStep,
  at: number,
  dur: number = ENTER,
) => ease((clamp01(v ?? 0) * CACHE_LINE_NOMINAL[step] - at) / dur);

const subOut = (
  v: number | undefined,
  step: CacheLineStep,
  at: number,
  dur: number = EXIT,
) => easeIn((clamp01(v ?? 0) * CACHE_LINE_NOMINAL[step] - at) / dur);

/** Spring-ish overshoot, damping ~16. Scale never starts at 0 — 0.94 floor. */
const pop = (s: number) =>
  interpolate(clamp01(s), [0, 0.55, 0.8, 1], [0.94, 1.035, 0.995, 1]);

/**
 * LINEAR sub-reveal scheduler. Same signature as `sub`, no easing.
 *
 * D8. An eased ramp is not an entrance for anything whose entrance is a WIPE:
 * `Easing.out(cubic)` puts 33% of the travel in the first frame and 58% in the
 * first two, so an 8-frame "entrance" driven through it arrives in two frames
 * (MEASURED f6098 -> f6100: ink 0.000% -> 1.515% -> 1.556% -> ~0). Area swept
 * per frame must be CONSTANT for the reveal to read as 8 frames long, which
 * means the clip edge has to move linearly. Used only for wipes; springs and
 * pops keep `sub`.
 */
const lin = (
  v: number | undefined,
  step: CacheLineStep,
  at: number,
  dur: number = ENTER,
) => clamp01((clamp01(v ?? 0) * CACHE_LINE_NOMINAL[step] - at) / dur);

/* ------------------------------------------------------------------------- */
/* Geometry. Safe area is x [115, 1805], y [65, 1015]; every literal below is  */
/* checked against it, using JetBrains Mono's 0.6em advance and heavy Inter's  */
/* ~0.58em worst case.                                                        */
/* ------------------------------------------------------------------------- */

// MemoryGrid's cell metrics are NOT exported (there is no shared geom module
// for the grid the way chartGeom.ts serves the two charts). These must mirror
// MemoryGrid.tsx exactly — if CELL/GAP/LINE_GAP drift there, every annotation
// below points at the wrong cell and the bracket brackets nothing.
const CELL = 46;
const GAP = 5;
const LINE_GAP = 16;
const ROWS = 8;
const COLS = 8;
const GRID_W = COLS * CELL + (COLS - 1) * GAP; // 403
const GRID_H = ROWS * CELL + (ROWS - 1) * LINE_GAP; // 480
/** Frames between row arrivals during `byte_grid`. 8 rows land over rel 0..112. */
const ROW_STEP = 16;
/** Each row's eight cells fill over this many frames. In the 6-9f house band. */
const CELL_FILL_IN = 6;

/**
 * ONE value for "a byte that is present but is not the subject", used by BOTH
 * of this beat's pictures — the 64 grid cells and, later, the 64 strip ticks.
 * They are the same sixty-four bytes, so they are the same grey.
 *
 * H10 (empty-frame gate). MemoryGrid draws an un-loaded cell as `transparent`
 * inside a 1px `theme.stroke` border, and `theme.stroke` is luma 91 — under the
 * 110 the empty-frame meter counts as lit. So the establishing shot's 645x768
 * grid, 23.9% of the frame, contributed **0.000% lit area**: the beat opened on
 * an outline of a picture. f5823-5963 measured 0.47% lit for 4.70s and f5965-
 * 6026 0.49% for 2.07s, and both windows are that one fact.
 *
 * The subject of this beat is a contiguous 64-byte block, so the fix and the
 * content are the same thing: draw the bytes as FILL. White @0.46 composites to
 * luma 117 on black (121 over the settled row wash) — over the 110 lit gate,
 * and 4.42:1, comfortably over IDLE_MIN_CONTRAST.
 *
 * Eight cells at 46px, drawn at the establishing scale 1.6, cover
 * 8 x (46 x 1.6)^2 = 43,335 px = 2.09% of frame PER ROW; all eight rows are
 * 16.7%. Solid fill, so it survives the meter's 8x8 box pooling — unlike type,
 * which pools down to ~40% of its bounding box.
 *
 * WHY 0.46 AND NOT MORE: the loaded row has to stay brighter than the idle one
 * or the beat's one word mark inverts. Solid `theme.accent` is luma 156, so an
 * idle byte at 121 leaves dY 35 for the arrival — over the detector's 25 gate
 * with margin, and every level brighter here spends that margin.
 */
const IDLE_BYTE_ALPHA = Math.max(IDLE_MIN_ALPHA, 0.46);
const IDLE_BYTE = `rgba(255, 255, 255, ${IDLE_BYTE_ALPHA})`;

/**
 * MemoryGrid's default requested cell. Deliberately the default: beat 8
 * (`sweep_vs_chase`) reuses this same grid with its own defaults, so the
 * viewer's eye lands on the same coordinate space — object constancy across
 * the cut is the whole reason the grid is a shared component.
 */
const REQUESTED_CELL = 19;
const REQ_ROW = Math.floor(REQUESTED_CELL / COLS); // 2
const REQ_COL = REQUESTED_CELL % COLS; // 3

// Three camera stations, one coordinate space. Establishing (big, right of the
// text column) -> column (pushed left, smaller, annotation column takes the
// right 1100px) -> dock (corner reference while the strip owns the frame).
const SCALE_ESTAB = 1.6; // 645 x 768 — the establishing shot owns the frame
const SCALE_COL = 1.25; // 504 x 600
const GRID_X_ESTAB = 470;
const GRID_X_COL = 150;
const GRID_X_DOCK = 140;
const GRID_Y_ESTAB = 180;
const GRID_Y_COL = 200;
const GRID_Y_DOCK = 110;

/** Establishing-phase text region: x 1170..1805 fits 18 mono chars at the floor. */
const RIGHT_X = 1170;

/** Column-phase annotation region, to the right of the pushed-left grid. */
const COL_SPINE = GRID_X_COL + GRID_W * SCALE_COL + 40; // 694 — bracket spine
const COL_X = COL_SPINE + 40; // 734 — text left edge, 1071px of room
const PANEL_W = 1000; // 734..1734, inside the 1805 margin

/** The Intel receipt lives full-width along the bottom, under everything. */
const CITE_X = 150;
const CITE_Y = 856;

// The unfolded line, full-bleed. 64 ticks = the 64 bytes we narrate, so the
// count on screen is literally countable — no "trust me" diagram.
const BYTES = 64;
const STRIP_X = 150;
const STRIP_Y = 560;
const STRIP_W = 1600;
const STRIP_H = 110;
const TICK_PITCH = STRIP_W / BYTES; // 25
const TICK_W = 18;
const TICK_H = 66;
const TICK_TOP = STRIP_Y + 22;
const tickX = (i: number) =>
  STRIP_X + i * TICK_PITCH + (TICK_PITCH - TICK_W) / 2;

/**
 * Idle fill for an un-tagged byte — the SAME `IDLE_BYTE` the grid cells use,
 * because they are the same sixty-four bytes seen twice. IDLE_MIN_ALPHA (0.35)
 * is the FLOOR, and the `dim` term in the tick loop takes 25% off the top while
 * the asked byte is the subject — so the resting alpha is 0.46 (luma 117,
 * 4.58:1) and the dimmed state lands at 0.345 (luma 88, 2.95:1), i.e. the floor
 * is respected in the tick's WORST state rather than its best.
 */
const IDLE_TICK = IDLE_BYTE;

/** Free-tag row under the strip. Squares, never dots-as-rings. */
const DOT_Y = 690;
const DOT = 12;

/**
 * Which of the 64 bytes the code actually asked for. Cell 3 of the grid row
 * covers bytes 24-31, so the highlighted tick has to live inside that span or
 * the zoom-in contradicts the grid it zoomed out of.
 */
const ASKED_BYTE = 27;
const ASKED_CX = tickX(ASKED_BYTE) + TICK_W / 2; // 837.5
/** "you asked for this one" = 22 mono chars at the 56px floor = 739px. */
const ASKED_LABEL_W = 900;

/**
 * The free-tag cascade, and the count-up it drives.
 *
 * DF-8 was this counter running 0 -> 63 over 210 frames (7.0s) — twelve times
 * the emphasised-move ceiling, and the only motion in the stretch, which
 * manufactured two of the beat's five static holds. It is now ONE gesture: 63
 * tags sweeping left to right in 28 frames (0.44f stagger, 6f each), so the
 * readout climbs 0 -> 63 in ~1.1s and the dots visibly CAUSE the number. The
 * frames the slow counter used to occupy are filled with real sub-reveals
 * (dots->bar morph, two exits, the payoff line and its underline) instead.
 */
const CASCADE_AT = 254;
const CASCADE_SPAN = 28;
const TAG_STAGGER = CASCADE_SPAN / BYTES; // 0.4375 frames
const TAG_DUR = 6;

/**
 * `cache_line` — the beat that earns the rest of the episode: one byte is
 * asked for, sixty-four arrive.
 *
 * 1269 frames (42.3s), far too long for one held picture, so it is three
 * movements sharing ONE coordinate space:
 *
 *   1. the grid draws on row by row; one cell lights; "one byte at a time" is
 *      said and struck out; the row lights around the cell on the word CACHE.
 *   2. a camera move pushes the grid left, the big keyword DOCKS into the
 *      annotation column, "64 bytes" lands whole, and the Apple aside plays out
 *      as a nine-event card that dims and leaves on "Anyway".
 *   3. the lit row UNFOLDS into a full-width 64-byte strip, the grid docks to
 *      the corner, the ledger flips, the 63 free bytes sweep in, and the
 *      payoff lands.
 *
 * Storyboard (beat-relative frames; step start is in parentheses):
 *
 *   0    memory label + row 1 — eight FILLED bytes, 2.09% of frame lit
 *        0-112 rows 2-8, 16f apart, wash flash + eight filled bytes each
 *   20   "half the cycles"       48   "waiting" (display)  80  half-full bar
 *   139  open column exits (H5: the open is now 12 events, not 4.5s of nothing)
 *   139  cell springs in         163  leader to the label
 *   175  "1 byte requested"      201  "one byte"
 *   223  "at a time"             247  strike through both
 *   275  THE MARK: whole row lights (8f) + "cache line" keyword, together
 *   315  establishing column exits  338  x86 chip ("on x eighty-six")
 *   353  camera move + keyword docks
 *   379  bracket draws           398  "64 bytes" lands whole, on its word
 *   457  Intel receipt line 1
 *   471  receipt line 2          494  Apple panel frame
 *   512  panel rail              534  "Apple Silicon"
 *   566  "OS reports"            590  128 counts up (28f)
 *   634  bar A                   662  bar B (double)
 *   698  "its own episode"       738  panel dims
 *   770  panel exits             792  receipt exits
 *   808  row unfolds -> strip    828  64 ticks materialise
 *   834  grid docks              858  "one cache line, unfolded"
 *   904  asked tick lights       914  leader
 *   926  "you asked for this one"
 *   958  ledger card             1004 "wasteful?"
 *   1044 strike                  1060 ledger flips
 *   1022 ledger cost bar fills
 *   1062 63 tags sweep (28f) + counter 0->63 (1.07s, well under the 3s cap)
 *   1096 STRIP FLOODS green      1104 dots merge into one bar
 *   1114 strip title exits       1122 "64 bytes, one fetch" lands
 *   1138 "wasteful?" exits
 *   1160 ledger exits            1180 payoff line
 *   1220 payoff underline
 *
 * 52 content events in 42.3s = 12.3 per 10s; the widest authored gap is 54
 * frames (1.8s).
 */
export const CacheLine: React.FC<CacheLineProps> = ({ p, frame = 0 }) => {
  /* --- movement 1 ------------------------------------------------------- */
  // H5: the open used to be 4.57s of nothing. MemoryGrid at progress 0 draws
  // only 1px `theme.stroke` outlines — ~0.18% of the frame per row, i.e. BELOW
  // the content-event threshold, so "the grid is drawing" was invisible to both
  // the meter and the eye. Rows now arrive on an explicit 16-frame clock and
  // each arrival carried a 0.35-accent wash flash so the construction was a
  // real staged event (H10 has since cut that wash to 0.16 — the filled bytes
  // do that job now, and see `rowWash` for why the loud version had to go),
  // and the right column runs its own three sub-reveals
  // under "half the fleet's cycles go to waiting".
  //
  // H10 (r10 grade, EMPTY-FRAME gate): H5 fixed the pacing meter and left the
  // brightness one untouched. The arrivals counted as events, but everything
  // that arrived was under luma 110, so f5823-5963 still measured 0.47% lit for
  // 4.70s and f5965-6026 0.49% for 2.07s. The rate was never the problem — 54
  // events in 42.3s is 12.77/10s — the EMPTINESS was. Each row now arrives as
  // eight FILLED bytes (`IDLE_BYTE`, luma 121): 2.09% of frame per row in
  // geometry, 16.7% for the whole grid. MEASURED on stills at scale 0.5:
  // 1.53% lit by rel 2, 3.62% by rel 20, 5.54% by rel 40, 15.6% by rel 120,
  // and 13.9-14.6% across the whole of the second window. Both empty runs
  // close; the only sub-1% frames left in the beat are rel 0-1 (0.07s).
  const gFrames = clamp01(p.byte_grid ?? 0) * CACHE_LINE_NOMINAL.byte_grid; // 0..147
  const memIn = sub(p.byte_grid, "byte_grid", 0, 10); // rel 0    "memory"
  // "memory" clears on the TAIL of one_cell_pulse (abs 6088..6094), NOT on
  // row_lights rel 0. It shares a slot with the `cache line` keyword, and
  // `subOut` is ease-IN: at step frame 2 easeIn(2/6) = 0.037, so "memory" was
  // still at 96% opacity while the keyword was already at 58% — two strings
  // printing through each other on the beat's one word mark (seen at f6100).
  // The slot is now empty four frames before the keyword lands.
  const memOut = subOut(p.one_cell_pulse, "one_cell_pulse", 126, 6); // abs 6088
  const halfLine = sub(p.byte_grid, "byte_grid", 20, 9); // rel 20   "half the cycles"
  const waitWord = sub(p.byte_grid, "byte_grid", 48, 9); // rel 48   "waiting"
  const waitBar = sub(p.byte_grid, "byte_grid", 80, 12); // rel 80   the half-full bar
  /** The open column clears out ahead of the requested-byte column landing. */
  const openOut = subOut(p.one_cell_pulse, "one_cell_pulse", 0); // rel 139

  const cellP = sub(p.one_cell_pulse, "one_cell_pulse", 0); // rel 139  the byte
  const leaderP = sub(p.one_cell_pulse, "one_cell_pulse", 24, 10); // rel 163
  const reqLabel = sub(p.one_cell_pulse, "one_cell_pulse", 36, 9); // rel 175
  const oneByte = sub(p.one_cell_pulse, "one_cell_pulse", 62, 9); // rel 201  "one byte"
  const atATime = sub(p.one_cell_pulse, "one_cell_pulse", 84, 9); // rel 223  "at a time"
  const strikeA = sub(p.one_cell_pulse, "one_cell_pulse", 108, 10); // rel 247  "never"
  const strikeB = sub(p.one_cell_pulse, "one_cell_pulse", 114, 10);

  // D2 (P0). `line` @6101 is the ONLY mark in this beat and it sits on the
  // spoken word CACHE — the term the whole episode is about. The old staging
  // fanned the reveal out: outline drew over 14f at rel 275, the fill started
  // at rel 295, the keyword at rel 309, and an 8-cell sheen then swept until
  // rel 351 — which reads as one 96-frame progressive fill and put the words
  // `cache line` 3.1s BEHIND the word. Everything that says "the whole line
  // came back" now fires together at step-rel 0 (rel 275 = mark - the 3-frame
  // lead) in ONE 8-frame spring light. There is no second fill stage.
  /**
   * D8. The line STREAMS in, left to right, over the full 8 frames.
   *
   * MEASURED before: f6098 0.000% -> f6099 1.515% -> f6100 1.556% -> f6101
   * 0.972% -> f6102 0.725% -> ~0. The whole row arrived in two frames because
   * `popA(ease-out)` front-loads: ease(1/8) = 0.331 -> popA = 0.637, and
   * ease(2/8) = 0.578 -> popA = 1.05 (clamped). An 8-frame entrance that is
   * over in two is a pop.
   *
   * Now: alpha is CONSTANT and a linear clip edge crosses the row. The overlay
   * box is (GRID_W + 20) x (CELL + 12) = 423 x 58 design px at S = 1.6 (camP is
   * still 0 through row_lights) = 676.8 x 92.8 on screen = 3.03% of frame.
   * Per wipe frame: 676.8 / 8 = 84.6 px x 92.8 = 7,851 px = 0.379% of frame,
   * on EVERY one of the eight frames — over the 0.3% burst gate eight times
   * rather than once. Both proxy dimensions (10.6 x 11.6 proxy px) clear the
   * ~8px stroke-attenuation floor. dY under the edge: 0 -> 31 on the row bed
   * (accent at 0.20), 121 -> 156 on the eight cells (IDLE_BYTE -> solid
   * accent). Rate: 3.03 x 6 / 8 = 2.27, over the 2.0 bar.
   */
  const arriveWipe = lin(p.row_lights, "row_lights", 0, ENTER); // rel 275
  const kwIn = sub(p.row_lights, "row_lights", 0, ENTER); // rel 275  ON "CACHE"
  /** rel 315 — the establishing column clears; three big blocks leave at once. */
  const rightOut = subOut(p.row_lights, "row_lights", 40);
  /** rel 338 — "and on x eighty-six", into the space the column just vacated. */
  const x86P = sub(p.row_lights, "row_lights", 63, 9);

  /* --- movement 2 ------------------------------------------------------- */
  const camP = sub(p.row_label_64, "row_label_64", 0, 20); // rel 353  camera move
  const bracketP = sub(p.row_label_64, "row_label_64", 26, 9); // rel 379
  // No count-up: a ticking number is not a content event, and ramping it is
  // what made "64 bytes" settle 5.3s after the mark. It lands whole, on the
  // spoken "sixty-four bytes" (~rel 400), in one 8-frame pop. The beat still
  // gets its count-up grammar — from the Apple 128, 190 frames later.
  const countIn = sub(p.row_label_64, "row_label_64", 38, ENTER); // rel 398
  const cite1 = sub(p.row_label_64, "row_label_64", 104, 9); // rel 457
  const cite2 = sub(p.row_label_64, "row_label_64", 118, 9); // rel 471

  /* --- D14: THE EMPTY PANEL, r14 -----------------------------------------
     The r13 grade named "empty olive panel f6300-6355 (1.83s)". Two separate
     bugs, and the timing one was the smaller of the two.

     1. THE CONTAINER WAS SCHEDULED AHEAD OF ITS CONTENT. `panelIn` was rel 0
        = abs f6317; the "Apple Silicon" tag inside it carried its OWN clip on
        `appleTitle` at rel 40 = abs f6357. So for 40 frames (1.33s) the frame
        held a bordered olive box with nothing in it. That is invisible to
        every automated gate — a `theme.stroke` border is luma 90, under the
        110 LIT line, so an empty bordered box contributes 0.000% lit area and
        the b-roll drifting behind the scrim satisfies the difference test on
        its own. Grader PASS, human eye says slop.
     2. THE ARRIVAL WAS AN EASE-OUT OPACITY RAMP ON A 19%-OF-FRAME SURFACE, so
        it measured 0.000% ink on EVERY frame of its entrance. MEASURED on
        full_r13: f6320..6325 report a 6-frame window of 18.85-19.04% while
        the one-frame ink column reads 0.000, 0.157, 0.000, 0.000, 0.000,
        0.000. The single biggest surface in the beat arrived and the meter
        never saw a frame of it. (Ease-out's best single-frame step is
        (3/N)*delta; on a 9-frame ramp from luma 0 to 64 that is 21 < the 25
        gate. This is D8's rule, applied to the panel itself rather than to
        the things inside it.)

     THE FIX IS STRUCTURAL, NOT A TIMING NUDGE. There is now exactly ONE
     reveal for this panel — a linear left-to-right clip wipe — and every
     child (rail, title tag) lives INSIDE it with no clip of its own. No
     ordering of drift, easing or rounding can render this panel empty,
     because the panel and its contents are the same uncovering.

       area   1000 x 392 = 392,000 px = 18.90% of 1920x1080
       MEASURED equivalent on full_r13 f6314 -> f6330: 19.090% at |d|>=25
       luma   panel #0E0E10 (14) + a 0.30 warm #E3B341 (180) wash
              = 0.30*180 + 0.70*14 = 63.9  ->  delta 64 >= the 25 gate
       rate   18.90% / 9f = 2.10 %/frame
              >= 1.0 %/frame in ONE frame       -> MAJOR event
              >= 5.0% in a 6-frame window (12.6) -> MAJOR event
              area*6/dur = 18.90*6/9 = 12.6     >> the 2.0 authoring floor
       shape  a CONSTANT-HEIGHT rect, so a linear clip edge already paints
              area linearly — no sqrt(t) correction needed here (that is only
              for wipes whose swept height varies).

     PLACED ON ITS WORD, NOT AHEAD OF IT. `silencedetect -38dB:0.30` measures
     a 1.40s SILENCE at f6318-6360 — the scripted "/" after "Intel's own
     manual". The old f6317 arrival fired on the first frame of that silence
     and then sat there empty through all of it. The wipe now runs f6357..6366:
     it opens 3 frames before "Quick [detour]" resumes at f6360 and is
     complete 6 frames after it. Nothing is on screen during the pause that
     the pause has not been earned by.

     The wash is NOT multiplied by the wipe. Every strip the clip uncovers
     arrives at the full 0.30 alpha immediately; multiplying would recreate
     the ramp inside the wipe. `panelSettle` starts after the wipe closes. */
  const panelWipe = lin(p.apple_line_chip, "apple_line_chip", 40, 9); // abs f6357..6366
  /** Decay of the arrival wash. A settle, deliberately not an entrance ramp. */
  const panelSettle = sub(p.apple_line_chip, "apple_line_chip", 49, 18); // abs f6366
  /**
   * D9c — abs f6360..f6494 (4.47s) MEASURED as a visually static hold.
   *
   * Round 4's note above this line claimed the window was fixed by "a 210x82
   * chip popping in beside x86 (0.83% of frame)". It was not. Measured on
   * full_r11 the whole window peaks at 0.355% ink and its two nominal events
   * score 0.315% (f6425) and 0.355% (f6494) — both within noise of the 0.3%
   * burst gate — while the `arm64` chip the note credits with 0.83% actually
   * measured 0.145% at f6458, because a 1px-bordered box with mono type inside
   * paints almost nothing: it is an OUTLINE, not an area. Everything else in
   * the window (a ticking count-up at rel 590, two 110x30 and 220x30 bars at
   * rel 634/662) is an order of magnitude under the bar. On screen the two
   * bars read as a stray grey dash beside the text.
   *
   * Rebuilt as ONE literal picture of "the OS reports a hundred and twenty
   * eight — double that": two measured bars, full panel width, the arm64 one
   * exactly twice the x86 one, each carrying its own number. The bars ARE the
   * comparison, so nothing here is decorative and nothing is a chip.
   *
   *   rel  abs   what                                area   dur  first frame  rate
   *    40  6357  PANEL wipes in, title inside (D14) 18.90%   9f     2.100%    12.60
   *    66  6383  arm64 chip pops (moved, D14)        0.83%   8f     0.355%*    0.62
   *    96  6413  arm64 bar, 940x76 warm (luma 175)   3.446%  8f     1.139%     2.58
   *   138  6455  x86 bar, 470x76 dim (luma 147)      1.723%  6f     0.726%     1.72
   *   168  6485  arm64 chip fills warm               0.83%   8f     0.355%*    0.62
   *   204  6521  footer wipes in
   *
   *   * = measured on full_r11, not modelled. First-frame figures for the new
   *   reveals are ease-out's own front-load, (1-(1-1/N)^3) x area, which is the
   *   metric the 0.3% burst gate reads. Worst start-to-start gap in the window
   *   drops from 134 frames (4.47s) to 56 frames (1.87s).
   *
   * The panel is also 34px shorter than the block it replaces, so it clears the
   * Intel citation quote below it with more room than before, not less.
   */
  const appleNum = sub(p.apple_line_chip, "apple_line_chip", 96, 28); // 28f count-up
  const barB = sub(p.apple_line_chip, "apple_line_chip", 96, 8); // rel 590  "128"
  const barA = sub(p.apple_line_chip, "apple_line_chip", 138, 5); // rel 632  "double that"
  /* D14 — moved rel 40 -> 66 (abs f6357 -> f6383). It used to fire on the
     same frame as the panel's title; it now lands on the spoken "Apple
     Silicon" and buys the window a separate event instead of doubling one. */
  const armIn = sub(p.apple_line_chip, "apple_line_chip", 66, 8); // abs f6383
  const armFill = sub(p.apple_line_chip, "apple_line_chip", 168, 8); // rel 662
  const appleFoot = sub(p.apple_line_chip, "apple_line_chip", 204, 9); // rel 698
  const appleDim = sub(p.apple_line_chip, "apple_line_chip", 244, 12); // rel 738
  const appleOut = subOut(p.apple_line_chip, "apple_line_chip", 276, 10); // rel 770 "Anyway"
  const citeOut = subOut(p.apple_line_chip, "apple_line_chip", 298); // rel 792

  /* --- movement 3 ------------------------------------------------------- */
  const t = p.free_tags_cascade;
  const unfold = sub(t, "free_tags_cascade", 0, 20); // rel 808  row -> strip
  const columnOut = subOut(t, "free_tags_cascade", 0); // column clears
  const dockP = sub(t, "free_tags_cascade", 26, 14); // rel 834  grid docks
  const stripTitle = sub(t, "free_tags_cascade", 50, 9); // rel 858
  const askedHot = sub(t, "free_tags_cascade", 96, ENTER); // rel 904
  const askedLead = sub(t, "free_tags_cascade", 106, 9); // rel 914
  const askedTag = sub(t, "free_tags_cascade", 118, 9); // rel 926
  const paid = sub(t, "free_tags_cascade", 150, 9); // rel 958  PAID FOR
  // MEASURED DEAD WINDOW: abs f6800-6890 = step-rel 169-259 (median ink
  // 0.012%). The events were all here already — 196 / 214 / 236 / 252 — they
  // were just drawn below the gate: the ledger was theme.panel (1.04:1), the
  // objection was unfilled type (at the 8x proxy a bold 96px word averages to
  // ~30% coverage, so its first ease-out frame moves a proxy pixel by dY 20,
  // under 25), and the strike was 5px. Two SOLID bursts now bracket the
  // window — the cost-bar track at rel 172 and the flip at rel 252, 80 frames
  // apart — with the objection plate and the bar fill carrying median ink in
  // between. Nothing was re-ordered; the beat's storyboard is unchanged.
  const paidBed = sub(t, "free_tags_cascade", 172, 8); // rel 980   cost track drops in
  const wasteful = sub(t, "free_tags_cascade", 196, 9); // rel 1004
  const strikeW = sub(t, "free_tags_cascade", 236, 12); // rel 1044
  const paidBar = sub(t, "free_tags_cascade", 214, 12); // rel 1022  cost bar fills
  const flip = sub(t, "free_tags_cascade", 252, 12); // rel 1060  ledger flips
  const mergeP = sub(t, "free_tags_cascade", 296, 14); // rel 1104  dots -> one bar
  // DF-8 residual: the cascade (28f) is NOT allowed to be the only thing
  // happening across its 447-frame slot. These three land after it and fill the
  // stretch the counter used to occupy — a full-strip colour transform, then a
  // title swap (out, THEN in — never crossfaded).
  const stripFlood = sub(t, "free_tags_cascade", 288, 14); // rel 1096  strip -> "free"
  const titleOut = subOut(t, "free_tags_cascade", 306); // rel 1114
  const titleSwap = sub(t, "free_tags_cascade", 314, 9); // rel 1122
  const wastefulOut = subOut(t, "free_tags_cascade", 330); // rel 1138
  const ledgerOut = subOut(t, "free_tags_cascade", 352); // rel 1160
  const payoff = sub(t, "free_tags_cascade", 372, 9); // rel 1180
  const payoffRule = sub(t, "free_tags_cascade", 412, 14); // rel 1220

  const tFrames = clamp01(t ?? 0) * CACHE_LINE_NOMINAL.free_tags_cascade;
  const tickIn = (i: number) => ease((tFrames - (20 + i * 0.45)) / 6); // rel 828..877
  const tagP = (i: number) =>
    ease((tFrames - CASCADE_AT - i * TAG_STAGGER) / TAG_DUR);
  let freeCount = 0;
  for (let i = 0; i < BYTES; i++)
    if (i !== ASKED_BYTE && tagP(i) > 0.6) freeCount++;

  /* --- camera + dock ---------------------------------------------------- */
  // One live coordinate origin, so every annotation tracks the grid through
  // both the camera move and the dock instead of detaching mid-move.
  const baseLeft = interpolate(camP, [0, 1], [GRID_X_ESTAB, GRID_X_COL]);
  const baseTop = interpolate(camP, [0, 1], [GRID_Y_ESTAB, GRID_Y_COL]);
  const camScale = interpolate(camP, [0, 1], [SCALE_ESTAB, SCALE_COL]);
  const gridLeft = interpolate(dockP, [0, 1], [baseLeft, GRID_X_DOCK]);
  const gridTop = interpolate(dockP, [0, 1], [baseTop, GRID_Y_DOCK]);
  const S = camScale * gridDockScale(dockP);

  // MemoryGrid in `line` mode only changes state at progress 0.45 (the row
  // loads). Mapping the two steps onto either side of that threshold is how
  // this scene "drives" the shared component rather than reimplementing it.
  // MemoryGrid's `line` mode is a BINARY switch (`p > 0.45` lights the row's
  // container AND all eight cells in one frame), so it can never BE the
  // entrance. It is held off until the scene's own wipe has finished covering
  // the row — at which point my overlay is fully opaque above it and the flip
  // is invisible. D8: the flip used to fire at `arriveP >= 0.995`, i.e. 6.63
  // frames into an 8-frame ramp, which put MemoryGrid's 3px row lift 5 frames
  // AFTER an arrival that had already finished in two — a second discrete pop
  // (MEASURED f6105, 1.361% ink). It now lands on the wipe's last frame, so
  // the lift is the settle of one continuous gesture instead of an aftershock.
  const lineArrived = arriveWipe >= 1;
  /** Alpha is no longer the entrance — the clip edge is. See `arriveWipe`. */
  const arrivalFill = arriveWipe > 0 ? 1 : 0;
  const gridProgress = lineArrived ? 1 : 0.2 * cellP;
  // Handing MemoryGrid -1 keeps the cursor cell off screen entirely (floor(-1/8)
  // = -1 matches no row), so the requested byte can make a proper entrance
  // instead of being on from frame one. The hand-off threshold is ~1, NOT 0.5:
  // MemoryGrid paints its cursor cell at full ink with a hard 18px glow the
  // instant requestedCell becomes valid, so handing over while the overlay
  // square was still at 50% opacity flashed the cell mid-entrance.
  // `|| lineArrived` is not belt-and-braces: MemoryGrid derives the row it
  // lights from requestedCell, so -1 during row_lights would light nothing.
  const requestedCell = cellP >= 0.995 || lineArrived ? REQUESTED_CELL : -1;
  // Mirrors MemoryGrid's 3px lift of a loaded line; overlays that skip it would
  // visibly detach from the row the moment it lights.
  //
  // ONE lift for the whole row, and it is MemoryGrid's binary one, because
  // MemoryGrid is not ours to re-time. The arrival overlay used to ease its own
  // lift (`-3 * arrivalFill`) while everything MemoryGrid draws stayed put, so
  // for the 8 entrance frames the two sat up to 4.8px apart (3px x the 1.6
  // camera scale). That was invisible while the cells underneath were
  // transparent. With them filled it is a TEAR: MemoryGrid's solid-ink cursor
  // cell peeks out below the overlay and disappears on the handoff frame.
  //
  // Measured at f6104 -> f6105, both ways: eased overlay 0.70% of frame at
  // dY 60 (as a tear), fully binary 1.50% at dY 67 (as one coherent 4.8px
  // translation of the whole row). The bigger number is the better picture —
  // it is the row settling as a unit, which is the gesture this beat is about,
  // and it lands inside the arrival spring rather than fighting it.
  const rowLift = gridProgress > 0.45 ? -3 : 0;

  // Quantised wipe: the clip edge snaps one row at a time, so the grid *builds*
  // (eight discrete arrivals, ROW_STEP frames apart) instead of fading in as a
  // blob. Row 1 is on screen by rel 1 — the beat never opens on an empty frame.
  const rowsShown =
    gFrames <= 0 ? 0 : Math.min(ROWS, Math.floor(gFrames / ROW_STEP) + 1);
  /**
   * Arrival tint on landing, settling to a faint persistent one.
   *
   * Peak was 0.35. That was H5's substitute for a reveal: with the cells
   * transparent, an accent wash was the only thing big enough to make a row
   * arriving register. The cells now carry the arrival themselves (2.09% of
   * frame at dY 117), and against a filled row a 0.35 accent wash no longer
   * reads as a tint — it reads as THE ROW LIGHTING UP, which is the exact
   * gesture rel 275 exists to make on the word `cache`. Eight rehearsals of a
   * beat's one payoff is worse than no rehearsal. 0.16 peak keeps the grouping
   * flicker (composite 131 vs the settled 121) and gives the payoff its blue
   * back.
   */
  const rowWash = (r: number) =>
    0.05 + 0.11 * (1 - ease((gFrames - r * ROW_STEP - 6) / 14));
  /**
   * The eight bytes of row `r` filling in. Same 16-frame clock as the quantised
   * clip above, but ramped over CELL_FILL_IN instead of snapping — a 2.09%
   * solid block appearing in ONE frame is a flicker, not an entrance.
   *
   * Arithmetic per row: 2.09% of frame over 6 frames = 2.09 x 6 / 6 = 2.09,
   * over the 2.0 perceptual bar; and an ease-out's best single frame moves
   * (3/6) x 117 = 58 luma, over the 25 gate, across the whole 2.09%. Eight of
   * these, 16 frames apart, carry the open.
   */
  const rowFill = (r: number) => ease((gFrames - r * ROW_STEP) / CELL_FILL_IN);
  const revealedH = rowsShown * (CELL + LINE_GAP) - LINE_GAP / 2;
  const clipBottom = Math.max(0, GRID_H + 28 - (revealedH + 14));

  // Idle micro-motion. The only legal use of `frame`: it has no start and no
  // end, so it can never fight a progress-driven reveal.
  const breathe = 0.5 + 0.5 * Math.sin(frame / 13);
  const driftX = Math.sin(frame / 97) * 3;
  const driftY = Math.sin(frame / 131) * 2;

  /* --- derived geometry ------------------------------------------------- */
  const rowTopAbs = gridTop + (REQ_ROW * (CELL + LINE_GAP) + rowLift) * S;
  const rowHAbs = CELL * S;
  const cellRightAbs = gridLeft + (REQ_COL * (CELL + GAP) + CELL) * S;
  const cellMidY = rowTopAbs + rowHAbs / 2;

  // The big keyword docks from the establishing headline slot into the column.
  const kwLeft = interpolate(camP, [0, 1], [GRID_X_ESTAB, COL_X]);
  const kwTop = interpolate(camP, [0, 1], [76, 262]);
  const kwSize = interpolate(
    camP,
    [0, 1],
    [TYPE.keyword.fontSize, TYPE.label.fontSize],
  );
  const kwTrack = interpolate(camP, [0, 1], [-1.6, 0]);

  const colAlpha = 1 - columnOut;

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: SANS }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${driftX}px, ${driftY}px)`,
        }}
      >
        {/* ---- the grid, and everything pinned to it ---------------------- */}
        <div
          style={{
            position: "absolute",
            left: gridLeft,
            top: gridTop,
            width: GRID_W,
            height: GRID_H,
            transform: `scale(${S})`,
            transformOrigin: "top left",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -14,
              top: -14,
              width: GRID_W + 28,
              height: GRID_H + 28,
              clipPath: `inset(0px 0px ${clipBottom}px 0px)`,
            }}
          >
            <div style={{ position: "absolute", left: 14, top: 14 }}>
              {/* Row arrival wash — sits BEHIND the grid so the cell strokes
                  stay readable. Each row lands at full accent and settles to a
                  faint tint, which is what makes "the grid is being built"
                  visible at all (the 1px strokes alone are sub-threshold). */}
              {Array.from({ length: rowsShown }).map((_, r) => (
                <div
                  key={`wash${r}`}
                  style={{
                    position: "absolute",
                    left: -10,
                    // tracks MemoryGrid's 3px lift so the wash never detaches
                    // from the row once that row is the loaded line
                    top:
                      r * (CELL + LINE_GAP) - 6 + (r === REQ_ROW ? rowLift : 0),
                    width: GRID_W + 20,
                    height: CELL + 12,
                    borderRadius: 8,
                    background: theme.accent,
                    opacity: rowWash(r),
                  }}
                />
              ))}
              {/* THE BYTES THEMSELVES. MemoryGrid leaves an un-loaded cell
                  `transparent` behind a 1px stroke, which is a drawing of a
                  grid rather than a grid — see IDLE_BYTE. These fills sit
                  BETWEEN the grouping wash and the arrival overlay, so the
                  ladder over pure black reads:
                    idle byte    white @0.46 over the settled wash   luma 121
                    loaded byte  solid theme.accent                  luma 156
                    requested    theme.ink                           luma 236
                  and the row that lights is still the brightest thing in the
                  grid. Lifts with REQ_ROW so the fills never detach from the
                  row once it is the loaded line. */}
              {Array.from({ length: rowsShown }).map((_, r) => (
                <div
                  key={`fill${r}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: r * (CELL + LINE_GAP) + (r === REQ_ROW ? rowLift : 0),
                    width: GRID_W,
                    height: CELL,
                    opacity: rowFill(r),
                  }}
                >
                  {Array.from({ length: COLS }).map((__, c) => (
                    <div
                      key={c}
                      style={{
                        position: "absolute",
                        left: c * (CELL + GAP),
                        top: 0,
                        width: CELL,
                        height: CELL,
                        borderRadius: 4,
                        background: IDLE_BYTE,
                      }}
                    />
                  ))}
                </div>
              ))}
              {/* The whole line lighting AT ONCE. Same rect as MemoryGrid's
                  line container (inset -6px -10px), so the fill lands exactly
                  on the row already on screen and lifts 3px — a transform of
                  something present, not another card popping in. No clip wipe
                  and no staged outline: a directional draw-on here would be
                  the progressive fill D2 flagged. Border, body and all eight
                  cells come up together on one damping-16 alpha spring.

                  H10: this used to unmount at `lineArrived` and hand the row
                  back to MemoryGrid. It can't any more — with idle bytes filled
                  at luma 121, MemoryGrid's loaded cell (accent @0.56 over that
                  = luma 141) is only dY 20 above idle and the beat's ONE word
                  mark would have stopped registering. The overlay now stays
                  drawn for the rest of the beat at SOLID accent, and because
                  MemoryGrid then paints accent @0.56 on top of solid accent —
                  0.56a + 0.44a = a — the handoff is arithmetically a no-op, not
                  merely a close match. dY at arrival is 156 - 121 = 35. */}
              {arriveWipe > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: -10,
                    top: REQ_ROW * (CELL + LINE_GAP) - 6,
                    width: GRID_W + 20,
                    height: CELL + 12,
                    borderRadius: 8,
                    border: `1px solid ${theme.accent}`,
                    // 0.20, not 0.10. This overlay exists to be pixel-identical
                    // to MemoryGrid's loaded row so the `lineArrived` handoff is
                    // a no-op — and MemoryGrid's wash was raised from 0.10 to
                    // 0.20 by the central D1 fix. Left at 0.10 this overlay had
                    // silently become a MISMATCH: the row would have jumped
                    // 0.10 -> 0.20 and the cells 0.18 -> 0.56 on the handoff
                    // frame, i.e. a visible pop on the beat's one mark.
                    //
                    // H10: now that the overlay OUTLIVES the handoff, keeping
                    // this painted underneath MemoryGrid's own 0.20 would
                    // composite to 0.36 (luma 31 -> 56, dY 25) on the handoff
                    // frame — the pop moved rather than went away. Two accent
                    // washes can only agree at alpha 1, so this one hands the
                    // BODY over cleanly (mine off exactly as MemoryGrid's comes
                    // on) while the CELLS above stay solid, where 0.56-over-
                    // solid is an identity. `lineArrived` and MemoryGrid's
                    // p > 0.45 flip on the same frame by construction:
                    // gridProgress starts at 0.46 the instant lineArrived.
                    background: `rgba(88, 166, 255, ${
                      lineArrived ? 0 : 0.2 * arrivalFill
                    })`,
                    opacity: clamp01(arrivalFill),
                    // D8 — THE ENTRANCE. A linear clip edge crossing the row
                    // left to right, one eighth of its width per frame. Alpha
                    // is constant at 1 the whole way (see `arriveWipe`); an
                    // eased alpha ramp on this box delivered the entire row in
                    // two frames and then nothing.
                    clipPath: `inset(0 ${((1 - arriveWipe) * 100).toFixed(2)}% 0 0)`,
                    // `rowLift`, not `-3 * arrivalFill`: see the rowLift note.
                    // The overlay easing its own lift is what tore the row away
                    // from MemoryGrid's cell borders for the 8 entrance frames.
                    transform: `translateY(${rowLift}px)`,
                  }}
                >
                  {/* The eight cell fills, ramped to SOLID accent (8.31:1).
                      MemoryGrid paints accent @0.56 over these from
                      `lineArrived` on, and 0.56 of a colour over that same
                      colour is that colour — so this is the one value at which
                      the handoff cannot pop. Area 8 x (46 x 1.6)^2 = 43,335 px
                      = 2.09% of frame. They are SOLID from frame one and the
                      parent's clip edge uncovers them — nothing here ramps in
                      alpha. dY 121 -> 156 on the cells, 0 -> 31 on the bed
                      between them, 236 on the `cache line` keyword arriving
                      alongside. */}
                  {arrivalFill > 0 &&
                    Array.from({ length: COLS }).map((_, c) => (
                      <div
                        key={c}
                        style={{
                          position: "absolute",
                          left: 10 + c * (CELL + GAP),
                          top: 6,
                          width: CELL,
                          height: CELL,
                          borderRadius: 4,
                          background: `rgba(88, 166, 255, ${clamp01(arrivalFill)})`,
                        }}
                      />
                    ))}
                </div>
              )}
              <MemoryGrid
                mode="line"
                progress={gridProgress}
                rows={ROWS}
                cols={COLS}
                requestedCell={requestedCell}
              />
              {/* The staggered 8-cell sheen that used to sweep here (rel
                  331-351) is GONE. Landing after the row already lit, it read
                  as the tail of a slow progressive fill on the beat's key
                  term — D2. The eight cells now light with the row, above. */}
              {/* The requested byte, drawn here rather than left to MemoryGrid
                  so it can spring in on its word. Same ink fill, so the
                  hand-off underneath is invisible. */}
              <div
                style={{
                  position: "absolute",
                  left: REQ_COL * (CELL + GAP),
                  top: REQ_ROW * (CELL + LINE_GAP) + rowLift,
                  width: CELL,
                  height: CELL,
                  borderRadius: 4,
                  background: theme.ink,
                  opacity: cellP,
                  transform: `scale(${pop(cellP)})`,
                  boxShadow: `0 0 ${(14 + 8 * breathe).toFixed(1)}px ${theme.ink}66`,
                }}
              />
              {/* One-shot SQUARE shockwave on entrance — never a ring; there
                  are no circle annotations anywhere in this episode. Gated on
                  cellP > 0 because its opacity ramp starts at 0.85, so rendered
                  unconditionally it parks a bright box on cell 19 from frame
                  one and gives the reveal away. */}
              {cellP > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: REQ_COL * (CELL + GAP),
                    top: REQ_ROW * (CELL + LINE_GAP) + rowLift,
                    width: CELL,
                    height: CELL,
                    borderRadius: 4,
                    border: `2px solid ${theme.ink}`,
                    opacity: interpolate(cellP, [0, 0.7], [0.85, 0], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    transform: `scale(${interpolate(cellP, [0, 1], [1, 1.5])})`,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* ---- "memory" names the space before anything happens in it ------
             It leaves the instant the row lights, and the big keyword takes the
             same slot — a swap, not two headings stacked. */}
        <Text
          x={GRID_X_ESTAB}
          y={100}
          alpha={memIn * (1 - memOut)}
          token="annotation"
          color={theme.dim}
          mono
          wipe={memIn}
          style={{
            letterSpacing: 6,
            transform: `translateY(${memOut * -14}px)`,
          }}
        >
          memory
        </Text>

        {/* ---- the open column: "half the fleet's cycles go to waiting" -----
             Three staged reveals across the 147-frame open, and all three are
             GONE by rel 145 — the requested-byte column lands at rel 175 into a
             cleared frame, never on top of these. */}
        <Text
          x={RIGHT_X}
          y={150}
          alpha={halfLine * (1 - openOut)}
          token="annotation"
          color={theme.dim}
          mono
          wipe={halfLine}
          style={{ transform: `translateY(${openOut * -14}px)` }}
        >
          half the cycles
        </Text>
        {/* H10: `headline` (76px) put ~0.28% of frame over the lit gate. This
            is the open's one big-type moment and the calibration says two lines
            of display type carry 5-7.5% — one line at `display` (128px, 475px
            wide at x 1170, ending 1645, inside the 1805 margin) is ~1.53% lit,
            5.5x what it was, for a token change and no re-timing. */}
        <Text
          x={RIGHT_X}
          y={232}
          alpha={waitWord * (1 - openOut)}
          token="display"
          color={theme.ink}
          style={{
            transform: `scale(${pop(waitWord)}) translateY(${openOut * -14}px)`,
            transformOrigin: "left top",
          }}
        >
          waiting
        </Text>
        {/* The claim drawn rather than asserted: a track, half of it filled.
            No number on screen — beat 6 owns the figure, this is the echo.

            H10, two bugs in five lines. (1) The whole bar was drawn at
            `opacity: 0.9`, which took theme.down from luma 116 to 104 and put
            the only saturated thing in the open UNDER the 110 lit gate — a
            reveal paying for nothing. (2) The fill sat on a `theme.stroke`
            track (luma 91), so filling it moved luma by exactly 25, sitting ON
            the detector's gate. The track is now an outline, so the fill lands
            on black at dY 116, and the bar is 560x56 rather than 520x30:
            277 x 50 = 0.67% of frame lit. It rides the rel-80 row arrival
            (2.09%, single-frame) for its content event — this is a lit-area
            fix, not a new event, and its timing is unchanged. */}
        {waitBar > 0 && openOut < 1 && (
          <div
            style={{
              position: "absolute",
              left: RIGHT_X,
              top: 392, // 392..448; display "waiting" ends at 368
              width: 560,
              height: 56,
              boxSizing: "border-box",
              borderRadius: 4,
              border: `3px solid ${theme.stroke}`,
              opacity: 1 - openOut,
              transform: `translateY(${openOut * -14}px)`,
            }}
          >
            <div
              style={{
                width: 277 * waitBar,
                height: 50,
                borderRadius: 2,
                background: theme.down,
              }}
            />
          </div>
        )}

        {/* ---- the keyword: full size over the grid, then DOCKED into the
             column by the camera move (dock/undock grammar). ---------------- */}
        {kwIn > 0 && colAlpha > 0 && (
          <div
            style={{
              position: "absolute",
              left: kwLeft,
              top: kwTop,
              fontFamily: SANS,
              fontSize: kwSize,
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: kwTrack,
              color: theme.ink,
              whiteSpace: "nowrap",
              opacity: kwIn * colAlpha,
              transform: `scale(${pop(kwIn)})`,
              transformOrigin: "left top",
            }}
          >
            cache line
          </div>
        )}

        {/* ---- establishing-phase right column ---------------------------- */}
        {/* leader from the lit cell across to the label it names */}
        <div
          style={{
            position: "absolute",
            left: cellRightAbs + 8,
            top: cellMidY,
            width: (RIGHT_X - 10 - (cellRightAbs + 8)) * leaderP,
            height: 3,
            background: theme.dim,
            opacity: 0.7 * (1 - rightOut),
          }}
        />
        <Text
          x={RIGHT_X}
          y={380}
          alpha={reqLabel * (1 - rightOut)}
          token="annotation"
          color={theme.ink}
          mono
          wipe={reqLabel}
        >
          1 byte requested
        </Text>
        {/* "never hands you one byte at a time" — said, then cancelled. The
            strike is a line draw-on, not a circle. */}
        <StruckLine
          x={RIGHT_X}
          y={520}
          alpha={oneByte * (1 - rightOut)}
          strike={strikeA}
          width={353}
        >
          one byte
        </StruckLine>
        <StruckLine
          x={RIGHT_X}
          y={612}
          alpha={atATime * (1 - rightOut)}
          strike={strikeB}
          width={396}
        >
          at a time
        </StruckLine>

        {/* ---- column-phase bracket: draws down the row it measures -------- */}
        <div
          style={{
            position: "absolute",
            left: COL_SPINE,
            top: rowTopAbs - 10,
            width: 3,
            height: (rowHAbs + 20) * bracketP,
            background: theme.accent,
            opacity: colAlpha,
          }}
        />
        {[0, 1].map((end) => (
          <div
            key={end}
            style={{
              position: "absolute",
              left: COL_SPINE - 16,
              top: end === 0 ? rowTopAbs - 10 : rowTopAbs + rowHAbs + 7,
              width: 16 * bracketP,
              height: 3,
              background: theme.accent,
              opacity: colAlpha,
            }}
          />
        ))}

        {/* ---- the number, whole, on its word (no count-up) ---------------- */}
        <Text
          x={COL_X}
          y={330}
          alpha={countIn * colAlpha}
          token="keyword"
          color={theme.ink}
          style={{
            transform: `scale(${pop(countIn)})`,
            transformOrigin: "left top",
          }}
        >
          64 bytes
        </Text>
        {/* "x86" is not decoration: the Apple Silicon panel sits directly below
            saying 128, and without the architecture named the two numbers read
            as a contradiction. Narration says "on x86 that line is sixty-four
            bytes", so the screen says it too. */}
        <div
          style={{
            position: "absolute",
            left: 1210,
            top: 352,
            padding: "12px 20px",
            borderRadius: 8,
            border: `1px solid ${theme.stroke}`,
            fontFamily: MONO,
            ...TYPE.annotation,
            lineHeight: 1.2,
            color: theme.dim,
            whiteSpace: "nowrap",
            opacity: x86P * colAlpha,
            transform: `scale(${pop(x86P)})`,
            transformOrigin: "left center",
          }}
        >
          x86
        </div>

        {/* `arm64` next to `x86`: the architecture the panel below is actually
            talking about, named rather than implied. Chip box is 1373..1583 x
            352..434 — clear of "64 bytes" (ends 1179) and the 1805 margin.
            Grammar: spring pop, then a warm FILL on the second beat (dock/
            undock's cousin) so this is two events, not one. */}
        <div
          style={{
            position: "absolute",
            left: 1373,
            top: 352,
            padding: "12px 20px",
            borderRadius: 8,
            border: `1px solid ${theme.warm}`,
            fontFamily: MONO,
            ...TYPE.annotation,
            lineHeight: 1.2,
            color: theme.warm,
            whiteSpace: "nowrap",
            opacity: armIn * colAlpha * (1 - appleOut),
            transform: `scale(${pop(armIn)})`,
            transformOrigin: "left center",
          }}
        >
          arm64
          {/* Mask-wipe, not a cross-fade: every pixel is either warm-on-black
              (10.8:1) or black-on-warm (10.8:1), never a half-blended mush
              that dips under 3:1 for four frames. */}
          <div
            style={{
              position: "absolute",
              inset: -1,
              borderRadius: 8,
              background: theme.warm,
              color: theme.bg,
              padding: "13px 21px",
              boxSizing: "border-box",
              clipPath: `inset(0 ${(1 - armFill) * 100}% 0 0)`,
            }}
          >
            arm64
          </div>
        </div>

        {/* ---- the Apple Silicon aside ------------------------------------
             Nine staged events across a 314-frame digression. One card held
             that long is a 10s static hold, which is exactly what the round-2
             measurement caught at f6420-6516. */}
        <div
          style={{
            position: "absolute",
            left: COL_X,
            // 450, not 500: the panel grew from 326px to 392px tall when the
            // value row became two 78px bars. 450+392 = 842, still clear of
            // the Intel receipt at CITE_Y 856, and clear below the arm64 chip
            // (top 352, 82px tall -> bottom 434).
            top: 450,
            width: PANEL_W,
            padding: "26px 26px 26px 34px",
            boxSizing: "border-box",
            borderRadius: 12,
            border: `1px solid ${theme.stroke}`,
            background: theme.panel,
            // Static hold rel 481..602 (4.03s): `theme.panel` is rgba(14,14,16)
            // over pure black — the card ARRIVING measured ~10 luma, under the
            // content-event floor, so the biggest move in the window was
            // invisible to the meter and nearly invisible to the eye. It now
            // lands with a warm wash across its full 1000x230 body (11% of the
            // frame, ~54 luma) that settles back to a tint over 18 frames.
            // Inset shadow, not an overlay div: it paints above the background
            // and BELOW the card's text, so nothing is veiled.
            // D14 — the wash no longer ramps with the entrance; the clip below
            // is the entrance. Full 0.30 from the wipe's first frame, then it
            // settles to a 0.114 tint over 18f once the wipe has closed.
            boxShadow: `inset 0 0 0 9999px rgba(227, 179, 65, ${(
              0.3 *
              (1 - 0.62 * panelSettle)
            ).toFixed(3)})`,
            // D14 — binary, not a ramp. `appleOut`/`appleDim` are exits and
            // may ramp; an ENTRANCE opacity ramp on a 19%-of-frame surface is
            // the bug this block documents.
            opacity:
              (panelWipe > 0 ? 1 : 0) *
              (1 - appleOut) *
              (1 - 0.55 * appleDim) *
              colAlpha,
            // D14 — `scale(pop(panelIn))` deleted. It was two bugs in one: it
            // made the arrival a transform ramp instead of a wipe, AND its
            // 0.94 floor shrank the panel's TYPE.annotation children to a
            // 56 * 0.727 * 0.94 = 38.3px cap during the entrance, under the
            // 40px readability floor. The panel does not scale at all now.
            transform: `translateY(${appleOut * 26}px)`,
            transformOrigin: "left top",
            // D14 — THE ONE REVEAL. Constant height, so a linear clip edge
            // paints area linearly: 18.90% of frame / 9f = 2.10 %/frame.
            // Children have no clips of their own; they are uncovered by this.
            clipPath: `inset(0 ${((1 - panelWipe) * 100).toFixed(2)}% 0 0)`,
          }}
        >
          {/* D14 — left accent rail, STATIC inside the panel's clip. It used
              to draw down on its own `railP` at rel 18 (abs f6335), i.e. 22
              frames before the title it shared a container with — one of the
              two reveals that made the box look like a loading skeleton. It is
              6px wide = 0.75 proxy px, so it never was an event; it is panel
              chrome and now arrives with the panel. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 6,
              height: "100%",
              borderRadius: 3,
              background: theme.warm,
            }}
          />
          {/* The title tag: 465x83 of near-solid #E3B341, black-on-warm at
              10.8:1. Box is 768..1233, well inside the panel's 1000px body.

              D14 — its own `clipPath` on `appleTitle` (rel 40) is DELETED. The
              tag is now uncovered by the PANEL's clip, on the same frames, so
              the container can never be on screen without it. This is the
              whole point of the fix: one clip, one arrival, no orderable gap
              between the box and its contents. */}
          <div
            style={{
              position: "relative",
              display: "inline-block",
              padding: "8px 14px",
              borderRadius: 6,
              background: theme.warm,
              fontFamily: MONO,
              ...TYPE.annotation,
              lineHeight: 1.2,
              letterSpacing: 1,
              color: theme.bg,
              whiteSpace: "nowrap",
            }}
          >
            Apple Silicon
          </div>
          {/* NOTE (script.yaml notes, binding): the OS *reports* 128. Never
              claim the line IS 128 — L1D still measures 64.

              D9c: the old layout put the value as thin warm TEXT (~0.3% of
              frame) next to two 30px-tall stub bars (110x30 = 0.16%, 220x30 =
              0.34%). Every reveal in the 4.5s window sat under the 2.0
              area*6/dur floor, so f6360-6494 measured as a static hold. The
              value and the comparison are now the SAME object: two FILLED
              bars carrying their own black-on-fill labels, mask-wiped in.
              B is exactly twice A's length, so "double that" is drawn, not
              asserted, and the label is inside the ink instead of beside it.
                B  940x78 = 3.536% of frame, 8f  -> 3.536*6/8  = 2.65
                A  470x78 = 1.768% of frame, 5f  -> 1.768*6/5  = 2.12
              Fill lumas: warm #E3B341 = 181, dim #8B949E = 147, both on
              #000000 bg — a >140 luma delta over the full bar area. */}
          <div style={{ position: "relative", marginTop: 12 }}>
            {/* B lands first (rel 590) with the count-up running inside it. */}
            <div
              style={{
                width: 940,
                height: 78,
                borderRadius: 4,
                background: theme.warm,
                // NOT display:flex. A flex container drops whitespace-only
                // text nodes between its children, so the `{" "}` either side
                // of the count-up span vanished and the label rendered
                // "OS reports128 B". Block + a line-height equal to the bar
                // height centres the text and keeps the spaces.
                paddingLeft: 12,
                boxSizing: "border-box",
                fontFamily: MONO,
                ...TYPE.annotation,
                lineHeight: "78px",
                color: theme.bg,
                whiteSpace: "pre",
                clipPath: `inset(0 ${(1 - barB) * 100}% 0 0)`,
              }}
            >
              arm64 · OS reports{" "}
              {/* fixed 3-char slot so the count-up can't reflow the label */}
              <span
                style={{
                  display: "inline-block",
                  width: 100.8,
                  textAlign: "right",
                }}
              >
                {Math.round(128 * appleNum)}
              </span>
              {" B"}
            </div>
            {/* A lands second (rel 632) at exactly half B's length. */}
            <div
              style={{
                marginTop: 8,
                width: 470,
                height: 78,
                borderRadius: 4,
                background: theme.dim,
                // NOT display:flex. A flex container drops whitespace-only
                // text nodes between its children, so the `{" "}` either side
                // of the count-up span vanished and the label rendered
                // "OS reports128 B". Block + a line-height equal to the bar
                // height centres the text and keeps the spaces.
                paddingLeft: 12,
                boxSizing: "border-box",
                fontFamily: MONO,
                ...TYPE.annotation,
                lineHeight: "78px",
                color: theme.bg,
                whiteSpace: "pre",
                clipPath: `inset(0 ${(1 - barA) * 100}% 0 0)`,
              }}
            >
              x86 · 64 B
            </div>
          </div>
          <div
            style={{
              fontFamily: MONO,
              ...TYPE.annotation,
              lineHeight: 1.2,
              marginTop: 14,
              color: theme.dim,
              opacity: appleFoot * 0.85,
              clipPath: `inset(0 ${(1 - appleFoot) * 100}% 0 0)`,
            }}
          >
            its own episode, someday
          </div>
        </div>

        {/* ---- the Intel receipt, full width along the bottom --------------
             SOURCE [4], verbatim. It outlives the sentence that cited it and
             only leaves on "Anyway --".
             The document is the Intel 64 and IA-32 *Optimization Reference
             Manual* — NOT the SDM, which is a different book and does not carry
             this sentence. script.yaml SOURCE [4] is the binding spelling. */}
        <Text
          x={CITE_X}
          y={CITE_Y}
          alpha={cite1 * (1 - citeOut)}
          token="annotation"
          color={theme.dim}
          mono
          wipe={cite1}
          style={{ lineHeight: 1.25 }}
        >
          Intel Optimization Manual
        </Text>
        <Text
          x={CITE_X}
          y={CITE_Y + 72}
          alpha={cite2 * (1 - citeOut)}
          token="annotation"
          color={theme.ink}
          mono
          wipe={cite2}
          style={{ lineHeight: 1.25 }}
        >
          &ldquo;first-level cache lines are 64 bytes.&rdquo;
        </Text>

        {/* ---- movement 3: the row unfolds into 64 bytes ------------------- */}
        <Strip
          unfold={unfold}
          flood={stripFlood}
          gridLeft={gridLeft}
          rowTopAbs={rowTopAbs}
          rowHAbs={rowHAbs}
          gridScale={S}
        />
        {unfold > 0.2 &&
          Array.from({ length: BYTES }).map((_, i) => {
            const asked = i === ASKED_BYTE;
            const tag = asked ? 0 : tagP(i);
            const inP = tickIn(i);
            if (inP <= 0) return null;
            // When the asked byte lights, the other 63 fall back — a contrast
            // shift across the whole 1600px strip, which is a real content
            // event where a glow on one 18px tick would not be. The tags then
            // bring each one back as it is tagged free.
            // D1. The fall-back used to be a 40% alpha cut applied ON TOP of an
            // idle fill that was already far under the floor, so the dimmed
            // state was ~1.4:1 for the 158 frames between `askedHot` and the
            // cascade. The cut is now 25% of a fill that starts at 4.58:1, so
            // the dimmed state bottoms out at 2.95:1 — still a visible
            // contrast shift across all 1600px, but the strip never goes
            // under IDLE_MIN_CONTRAST while it is the subject of the frame.
            const dim = asked ? 1 : 1 - 0.25 * askedHot * (1 - tag);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: tickX(i),
                  top: TICK_TOP,
                  width: TICK_W,
                  height: TICK_H,
                  borderRadius: 3,
                  // Was `${theme.accent}47` — accent at 28% alpha composites to
                  // luma ~44 on black, 1.35:1, and the opacity term below then
                  // multiplied it by another 0.45, landing the idle tick at
                  // ~1.4:1. These 63 ticks are the structure the viewer has to
                  // see BEFORE the cascade fills them, i.e. exactly the case
                  // IDLE_MIN_ALPHA exists for. White at 0.46 (IDLE_MIN_ALPHA
                  // plus the headroom the 0.75 dim below consumes) = luma 117,
                  // 4.58:1; dimmed it is 2.95:1, on the 3.0 floor.
                  background: tag > 0 ? theme.up : IDLE_TICK,
                  opacity: inP * dim,
                  transform: `scaleY(${interpolate(inP, [0, 1], [0.4, 1])})`,
                  transformOrigin: "center",
                }}
              />
            );
          })}
        {/* The byte the code actually asked for: it starts life identical to
            its 63 neighbours and is only singled out when the narration
            singles it out. Grows taller than the strip so it reads at a
            glance — no ring, no circle. */}
        {unfold > 0.2 && askedHot > 0 && (
          <div
            style={{
              position: "absolute",
              left: tickX(ASKED_BYTE) - 4,
              top: TICK_TOP - 14,
              width: TICK_W + 8,
              height: TICK_H + 28,
              borderRadius: 3,
              background: theme.ink,
              opacity: askedHot,
              transform: `scaleY(${interpolate(askedHot, [0, 1], [0.65, 1])})`,
              transformOrigin: "center",
              boxShadow: `0 0 ${(12 + 10 * breathe).toFixed(1)}px ${theme.ink}66`,
            }}
          />
        )}

        {/* the 63 free tags, sweeping left to right in one 28-frame gesture,
            then MERGING into a single bar (transform, not add/remove) */}
        {unfold > 0.2 &&
          mergeP < 1 &&
          Array.from({ length: BYTES }).map((_, i) =>
            i === ASKED_BYTE ? null : (
              <div
                key={`tag${i}`}
                style={{
                  position: "absolute",
                  left: interpolate(
                    mergeP,
                    [0, 1],
                    [tickX(i) + TICK_W / 2 - DOT / 2, tickX(i)],
                  ),
                  top: DOT_Y,
                  width: interpolate(mergeP, [0, 1], [DOT, TICK_PITCH]),
                  height: DOT,
                  borderRadius: interpolate(mergeP, [0, 1], [3, 0]),
                  background: theme.up,
                  opacity: tagP(i),
                  transform: `scale(${pop(tagP(i))})`,
                }}
              />
            ),
          )}
        {/* ...and at mergeP = 1 the 63 tiles hand off to one continuous bar.
            The swap happens only when the tiles already ARE the bar, so there
            is never a frame with both drawn at partial opacity. */}
        {mergeP >= 1 && (
          <div
            style={{
              position: "absolute",
              left: tickX(0),
              top: DOT_Y,
              width: tickX(BYTES - 1) + TICK_W - tickX(0),
              height: DOT,
              borderRadius: 3,
              background: theme.up,
            }}
          />
        )}

        {/* The strip's title, swapped once the flood lands. The first line
            fully exits (rel 306-312) before the second arrives (rel 314) —
            no crossfade, no two headings stacked. */}
        <Text
          x={400}
          y={150}
          alpha={stripTitle * (1 - titleOut)}
          token="annotation"
          color={theme.dim}
          mono
          wipe={stripTitle}
          style={{ transform: `translateY(${titleOut * -16}px)` }}
        >
          one cache line, unfolded
        </Text>
        <Text
          x={400}
          y={150}
          alpha={titleSwap}
          token="annotation"
          color={theme.up}
          mono
          wipe={titleSwap}
        >
          64 bytes, one fetch
        </Text>

        {/* ---- the byte that was actually asked for ----------------------- */}
        <div
          style={{
            position: "absolute",
            left: ASKED_CX - 1,
            top: TICK_TOP - 70 * askedLead,
            width: 3,
            height: 70 * askedLead,
            background: theme.dim,
            opacity: 0.75,
          }}
        />
        <Text
          x={ASKED_CX - ASKED_LABEL_W / 2}
          y={430}
          alpha={askedTag}
          token="annotation"
          color={theme.ink}
          mono
          style={{
            width: ASKED_LABEL_W,
            textAlign: "center",
            transform: `translateY(${(1 - askedTag) * 10}px)`,
          }}
        >
          you asked for this one
        </Text>

        {/* ---- the objection, said out loud and then struck through --------
             D1. This was white type on black — which the eye reads fine but
             the pacing proxy does not: an 8x downscale of a bold 96px word
             averages ~30% glyph coverage, so its first ease-out frame moves a
             proxy pixel by dY ~20 and the whole objection graded as nothing.
             It is now a FILLED objection chip: 540x134 = 3.49% of the frame in
             theme.down (#F85149, luma 116), whose first frame is dY 38 — a
             real burst, in the middle of the window that measured dead.
             Black on #F85149 reads 6.76:1; the strike is theme.ink at 14px,
             3.1:1 against the chip, and is now the ONLY cancellation signal
             (the old grey-out would have dropped the type to ~2.6:1 on the
             chip, under the floor, so it goes). */}
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 760, // chip runs 760..894, inside the y<=1015 safe bottom
            padding: "14px 28px",
            borderRadius: 10,
            background: theme.down,
            opacity: wasteful * (1 - wastefulOut),
            transform: `scale(${pop(wasteful)}) translateY(${wastefulOut * 30}px)`,
            transformOrigin: "left center",
          }}
        >
          <span
            style={{
              position: "relative",
              display: "inline-block",
              fontFamily: SANS,
              ...TYPE.keyword,
              lineHeight: 1.1,
              color: theme.bg,
              whiteSpace: "nowrap",
            }}
          >
            wasteful?
            <span
              style={{
                position: "absolute",
                left: 0,
                top: "52%",
                width: `${strikeW * 100}%`,
                height: 14,
                background: theme.ink,
              }}
            />
          </span>
        </div>

        {/* ---- the ledger, which FLIPS instead of being replaced -----------
             opacity lives on the OUTER div: putting it on the preserve-3d
             element makes Chrome flatten the 3D context and the flip degrades
             into both faces smearing over each other. */}
        <div
          style={{
            position: "absolute",
            left: 1080,
            top: 730,
            width: 660,
            perspective: 1200,
            opacity: paid * (1 - ledgerOut),
          }}
        >
          <div
            style={{
              position: "relative",
              // 260, not 212: the front face now carries the cost bar under the
              // value. 730 + 260 = 990, inside the 1015 safe bottom.
              height: 260,
              transformStyle: "preserve-3d",
              transform: `rotateX(${flip * 180}deg) scale(${pop(paid)}) translateY(${ledgerOut * 34}px)`,
            }}
          >
            <LedgerFace
              tone={theme.warm}
              caption="PAID FOR"
              value="64 bytes"
              bed={paidBed}
              bar={paidBar}
            />
            <LedgerFace
              tone={theme.up}
              caption="ALREADY THERE"
              value={`${freeCount} bytes free`}
              back
            />
          </div>
        </div>

        {/* ---- the line the beat exists for -------------------------------
             Lands only after the ledger and the objection have both left, so
             the frame is never two competing states at once. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 800,
            width: 1920,
            textAlign: "center",
            opacity: payoff,
          }}
        >
          <span
            style={{
              position: "relative",
              display: "inline-block",
              fontFamily: SANS,
              ...TYPE.headline,
              fontWeight: 800,
              color: theme.ink,
              whiteSpace: "nowrap",
              transform: `scale(${pop(payoff)})`,
            }}
          >
            use what you already paid for
            <span
              style={{
                position: "absolute",
                left: 0,
                bottom: -14,
                width: `${payoffRule * 100}%`,
                height: 4,
                background: theme.up,
              }}
            />
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * The lit row BECOMES the strip: one rectangle interpolating from the row's
 * live screen rect to the strip's. An add/remove here (row fades, strip pops)
 * would break object constancy at exactly the moment the viewer is being told
 * these are the same 64 bytes.
 *
 * The grid keeps its row lit behind this and docks to the corner — so the strip
 * reads as a zoom into a place that still exists, not a replacement for it.
 */
const Strip: React.FC<{
  unfold: number;
  /** 0..1 — after the 63 tags land, the whole strip goes "already paid for". */
  flood: number;
  gridLeft: number;
  rowTopAbs: number;
  rowHAbs: number;
  gridScale: number;
}> = ({ unfold, flood, gridLeft, rowTopAbs, rowHAbs, gridScale }) => {
  if (unfold <= 0) return null;
  // Source rect = MemoryGrid's line container (inset -6px -10px, scaled).
  const fromX = gridLeft - 10 * gridScale;
  const fromY = rowTopAbs - 6 * gridScale;
  const fromW = (GRID_W + 20) * gridScale;
  const fromH = rowHAbs + 12 * gridScale;
  return (
    <div
      style={{
        position: "absolute",
        left: interpolate(unfold, [0, 1], [fromX, STRIP_X]),
        top: interpolate(unfold, [0, 1], [fromY, STRIP_Y]),
        width: interpolate(unfold, [0, 1], [fromW, STRIP_W]),
        height: interpolate(unfold, [0, 1], [fromH, STRIP_H]),
        borderRadius: 8,
        // 3px: a 1px border is an eighth of a pixel at the pacing proxy.
        border: `3px solid ${theme.accent}`,
        // Was accent @ 0x1A = 10% — luma 16 on black, so the unfold of a
        // 1600x110 shape (8.5% of the frame) moved the proxy by dY 16 and
        // graded as nothing. 0x38 = 22% is luma 34 (dY 34, over the gate) and
        // is deliberately NOT brighter than that: the 64 ticks sitting on this
        // bed are white @ 0.46 (luma 117), which is 3.46:1 against luma 34 and
        // would fall to 2.93:1 against luma 47. The bed is a container; the
        // ticks are the content, and the content keeps the floor.
        background: `${theme.accent}38`,
      }}
    >
      {/* The flood: the whole 1600px strip changes state in one move (~8% of
          the frame), which is what "the other sixty-three are already sitting
          there" needs — a colour change on 12px dots is not it. */}
      {flood > 0 && (
        <div
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: 8,
            border: `3px solid ${theme.up}`,
            // Was up @ 0x24 = 14%, which moved the bed 34 -> 50: dY 16, under
            // the gate, so the beat's biggest state change was invisible to
            // the meter. 0x61 = 38% takes it to luma 78 (dY 44).
            background: `${theme.up}61`,
            opacity: flood,
          }}
        />
      )}
    </div>
  );
};

/**
 * D1. The ledger used to be a `theme.panel` card with `theme.dim` type on it.
 * theme.panel is rgba(14,14,16,0.72) — it composites to luma ~10.7 on black,
 * a contrast ratio of **1.04:1**. The card was, measured, not on screen: a
 * 660x260 rectangle (8.3% of the frame) whose arrival moved black by 10 luma,
 * a quarter of the 25-luma event gate. That is why `paid` (step-rel 150) and
 * `flip` (rel 252) both graded as nothing and this stretch measured dead.
 *
 * The fix is not a brighter card — a luma-89 body would drop theme.dim to
 * 2.05:1 and the value type with it. The caption becomes a SOLID TONE PLATE
 * with black type on it, so the brightest thing on the card is also the thing
 * the card is about:
 *
 *   plate 660x91 = 60,060 px = 2.90% of frame, filled warm #E3B341 (luma 181)
 *   or up #3FB950 (luma 151). Arrival moves 0 -> 181; even the first frame of
 *   the ease-out (0.33) is dY 60. Well over the gate, on 9.7x the area it
 *   needs. Black-on-warm reads 10.5:1, black-on-green ~8.4:1.
 *
 * The cost bar bed goes 30px -> 56px tall (608x56 = 1.64% of frame) and gets
 * its own `bed` cue so the track ARRIVES as an event and the fill is a second,
 * separate one — two sub-reveals out of what used to be half of one.
 */
const LedgerFace: React.FC<{
  tone: string;
  caption: string;
  value: string;
  back?: boolean;
  /** 0..1 — the empty cost-bar track dropping in, its own sub-reveal. */
  bed?: number;
  /** 0..1 — the cost bar drawing across the front face, a beat before the flip. */
  bar?: number;
}> = ({ tone, caption, value, back = false, bed = 0, bar = 0 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      boxSizing: "border-box",
      borderRadius: 12,
      // 3px, not 1px: at the 8x pacing proxy a 1px edge is an eighth of a
      // pixel and contributes dY ~13 no matter what colour it is.
      border: `3px solid ${theme.stroke}`,
      background: theme.panel,
      overflow: "hidden",
      backfaceVisibility: "hidden",
      transform: back ? "rotateX(180deg)" : "none",
    }}
  >
    <div
      style={{
        padding: "10px 26px",
        background: tone,
        fontFamily: MONO,
        ...TYPE.annotation,
        lineHeight: 1.2,
        letterSpacing: 2,
        color: theme.bg,
        whiteSpace: "nowrap",
      }}
    >
      {caption}
    </div>
    <div
      style={{
        padding: "4px 26px 0",
        fontFamily: MONO,
        ...TYPE.code,
        lineHeight: 1.2,
        color: tone,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
    {bed > 0 && (
      <div
        style={{
          position: "absolute",
          left: 26,
          right: 26,
          // Inside the 3px border box: plate 87.2 + value 4+81.6 = 172.8, so
          // content ends at 175.8 and the track runs 181..237 of 254. Clear of
          // the value above and 17px off the card's bottom edge.
          bottom: 20,
          height: 56,
          borderRadius: 4,
          background: theme.stroke,
          transform: `scaleY(${bed})`,
          transformOrigin: "bottom",
        }}
      >
        <div
          style={{
            width: `${clamp01(bar) * 100}%`,
            height: "100%",
            borderRadius: 4,
            background: tone,
          }}
        />
      </div>
    )}
  </div>
);

/** A big sans line with a strike that draws across it. Never a circle. */
const StruckLine: React.FC<{
  x: number;
  y: number;
  alpha: number;
  strike: number;
  width: number;
  children: React.ReactNode;
}> = ({ x, y, alpha, strike, width, children }) => {
  if (alpha <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontFamily: SANS,
        ...TYPE.headline,
        fontWeight: 800,
        color: strike > 0.5 ? theme.dim : theme.ink,
        whiteSpace: "nowrap",
        opacity: alpha,
        transform: `scale(${pop(alpha)})`,
        transformOrigin: "left center",
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "54%",
          width: width * strike,
          height: 5,
          background: theme.down,
        }}
      />
    </div>
  );
};

/**
 * Every string on screen goes through here, and the size comes from a TYPE
 * token — never a hand-picked px. The scale's floor is 40px CAP height
 * (58px sans / 56px mono font-size); there is no tier below it, which is how a
 * 14px "32 KB"-class label becomes impossible to write by accident.
 */
const Text: React.FC<{
  x: number;
  y: number;
  alpha: number;
  token: keyof typeof TYPE;
  color: string;
  mono?: boolean;
  /** 0..1 mask-wipe reveal (left to right). Omit for a plain fade/translate. */
  wipe?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ x, y, alpha, token, color, mono = false, wipe, style, children }) => {
  if (alpha <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontFamily: mono ? MONO : SANS,
        ...TYPE[token],
        color,
        opacity: alpha,
        whiteSpace: "nowrap",
        ...(wipe !== undefined
          ? { clipPath: `inset(0 ${(1 - clamp01(wipe)) * 100}% 0 0)` }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
};
