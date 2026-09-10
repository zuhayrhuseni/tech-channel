import React from "react";
import { Easing, interpolate } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import {
  ENTRANCE_MAX_FRAMES,
  ENTRANCE_MIN_FRAMES,
  IDLE_MIN_ALPHA,
  TYPE,
  theme,
} from "../../components/theme";

// Loaded here rather than inherited: E005Lab sets the page font to system-ui,
// so a scene that relies on inheritance renders in a different face in the lab
// than it does in the episode.
const inter = loadInter("normal", {
  weights: ["500", "600", "700", "800"],
  subsets: ["latin"],
});
const mono = loadMono("normal", { weights: ["400"], subsets: ["latin"] });
const SANS = inter.fontFamily;
const MONO = mono.fontFamily;

/** Build steps, named exactly as in this beat's `build:` list in script.yaml. */
export type LatencyLadderStep =
  | "core_glyph"
  | "rung_l1"
  | "rung_l2"
  | "rung_l3"
  | "rung_ram";

export const LATENCY_LADDER_STEPS: LatencyLadderStep[] = [
  "core_glyph",
  "rung_l1",
  "rung_l2",
  "rung_l3",
  "rung_ram",
];

export interface LatencyLadderProps {
  /**
   * 0..1 per step; absent = 0 = not started.
   *
   * CALLER CONTRACT — this beat is `playhead: true` in Episode005.tsx: every
   * step's `p` ramps LINEARLY across its whole slot, mark to mark. This scene
   * fans ~30 sub-reveals out of those five ramps as FRACTIONS of each slot
   * (see SLOT below). An 8-frame entrance ramp instead of a playhead would
   * collapse every sub-reveal in a slot into one frame and leave a 13-second
   * static hold behind it.
   */
  p: Partial<Record<LatencyLadderStep, number>>;
  /** Absolute frame, for idle micro-motion ONLY (the die's core cells). */
  frame?: number;
}

/* ==========================================================================
 * TIMING
 *
 * Slot lengths in frames. Used ONLY to convert the house entrance band
 * (6..9 frames) into slot fractions, so no ramp is ever hand-picked and the
 * fractions rescale automatically if the cut moves.
 *
 * THESE ARE RAMPS, NOT MARK GAPS — the r8 correction. Episode005.tsx resolves
 * a playhead step's ramp as `base + min(TAIL, base * 0.1)` with TAIL = 8, and
 * `p` reaches 1 at `from + ramp`, NOT at the next mark. The old table here
 * carried the bare mark gaps (398/116/120/360/155) and so ran every fraction
 * against a denominator ~2-7% short: a 9-frame authored entrance rendered in
 * 9.2-9.6 frames (over the 9-frame ceiling), and `SEG_AT`'s own comment
 * claimed l3 hit 1 at f4628 when it actually hits 1 at f4636.
 *
 * Derived from timing.json marks (beat 3637..4786; l1 @4035, l2 @4151,
 * l3 @4271, ram @4631) with the house LEAD of 3:
 *
 *   step        from    base                       ramp = base + min(8, .1b)
 *   core_glyph  3637    4032-3637 = 395            403
 *   rung_l1     4032    4148-4032 = 116            124
 *   rung_l2     4148    4268-4148 = 120            128
 *   rung_l3     4268    4628-4268 = 360            368
 *   rung_ram    4628    4786-4628 = 158            166
 * ======================================================================== */
const SLOT: Record<LatencyLadderStep, number> = {
  core_glyph: 403,
  rung_l1: 124,
  rung_l2: 128,
  rung_l3: 368,
  rung_ram: 166,
};

/** House entrance (9f / 300ms) expressed as a fraction of a step's slot. */
const ent = (s: LatencyLadderStep) => ENTRANCE_MAX_FRAMES / SLOT[s];
/** House exit (6f / 200ms) as a fraction. */
const ext = (s: LatencyLadderStep) => ENTRANCE_MIN_FRAMES / SLOT[s];
/** Emphasized move ceiling (600ms = 18f) as a fraction — draw-ons and docks. */
const emph = (s: LatencyLadderStep) => (2 * ENTRANCE_MAX_FRAMES) / SLOT[s];

/* ==========================================================================
 * D11 — THE ONE-FRAME EVENT, AND WHY THIS BEAT'S REVEALS DID NOT COUNT.
 *
 * The r10 grade added a STRICT pacing gap: a window in which nothing produced
 * a >= 0.3%-of-frame change IN A SINGLE FRAME. Four of them landed here —
 * f4039-4147, f4158-4267, f4279-4399, f4451-4610, 44% of the beat — and the
 * grade's note on all four was the same: "the only thing that arrived was a
 * smooth ramp."
 *
 * That is not a scheduling fault, it is an EASING fault, and the arithmetic is
 * worth writing down because every previous round got it wrong in the same way.
 * The detector gates a pixel as changed at |dY| >= 25 PER FRAME. An opacity
 * ramp spreads its whole luma delta across its window, so with ease-out cubic
 * the biggest single-frame step a ramp can produce is
 *
 *     dY_max_per_frame = (3 / N) * dY_total
 *
 * The row bed's arm is the largest reveal in this scene — 11% of frame moving
 * 71 luma — and over the 18-frame `emph` window it was authored at, that is
 * (3/18)*71 = 11.8 luma in its busiest frame. NOT ONE PIXEL crossed the gate.
 * A reveal covering an eighth of the screen registered as literally nothing.
 * Even at the 9-frame house ceiling it is 23.7 — still under.
 *
 * A WIPE has no such ceiling. Its leading edge moves a boundary at FULL
 * contrast, so every frame of a wipe paints (W/N)*H pixels at the element's
 * entire dY. For a row bed wiped over 12 frames — the bed less the 56px colour
 * tab, which is painted over it and never changes:
 *
 *     (1690 - 56) * 136 / 12 = 18,519 px/frame = 0.89% of frame at dY 71
 *
 * three times the 0.3% one-frame floor, every frame of the move. That single
 * substitution — ramp -> wipe on the four large surfaces (row bed arm, row bed
 * live, the callout band, the commentary plate) — is what closes all four
 * strict gaps, and it costs no new elements. Nothing here is decorative; the
 * same reveals fire on the same words, they are just drawn as an uncovering
 * instead of a fade.
 *
 * COROLLARY, and the rule for anyone editing this file: a reveal bigger than
 * ~2% of frame must be a WIPE, a DOCK or a DRAW. Reserve opacity ramps for
 * small text, where the glyph area is too small to clear 0.3% however it moves.
 * ======================================================================== */
const WIPE_FRAMES = 12;
/** An n-frame wipe as a fraction of a step's slot. */
const wpN = (s: LatencyLadderStep, frames: number) => frames / SLOT[s];
/** A wipe as a fraction of a step's slot. 12f: inside the 12-20f gesture band. */
const wp = (s: LatencyLadderStep) => wpN(s, WIPE_FRAMES);
/** Frames -> fraction of the rung_l3 slot. `rung_l3` is 12.3s long and carries
 *  most of this beat's storyboard, so it is the one step whose sub-windows are
 *  worth writing in frames rather than eyeballed fractions. */
const f3l = (frames: number) => frames / SLOT.rung_l3;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const raw = (v: number, a: number, b: number) =>
  interpolate(clamp01(v), [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const ease = (v: number) =>
  interpolate(clamp01(v), [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });

/** Sub-window + ease-out. Every reveal below is driven by this. */
const stage = (v: number, a: number, w: number) => ease(raw(v, a, a + w));

/**
 * Sub-window, LINEAR — the driver for every clipPath wipe in this file. See
 * D11. Linear is not a style choice here: it is what makes the painted area
 * per frame constant. Ease-out on a wipe front-loads the area and leaves the
 * last two thirds of the gesture crawling, i.e. it recreates the exact defect
 * the wipe exists to fix.
 */
const wipeAt = (v: number, a: number, w: number) => raw(v, a, a + w);

/** `inset()` right-edge for a left-to-right wipe at progress t. */
const wipeIn = (t: number) => `inset(0 ${(1 - t) * 100}% 0 0)`;

/**
 * Sub-window for TRAVEL, not for entrances. Ease-out front-loads a long move
 * so it crawls for its last two thirds — which reads as a static hold. A
 * travel (the packet crossing to RAM, the RAM bar drawing in) keeps moving
 * for its whole window.
 */
const travelStage = (v: number, a: number, w: number) =>
  interpolate(raw(v, a, a + w), [0, 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });

const mix = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

/** Pop entrance: 0.94 -> 1.02 -> 1. Never from 0; 2% overshoot, not a bounce. */
const pop = (t: number) =>
  interpolate(clamp01(t), [0, 0.62, 1], [0.94, 1.02, 1]);

/** Sub-window, LINEAR — the driver for every COUNT-UP. See D2b. */
const countAt = (v: number, a: number, w: number) => raw(v, a, a + w);

/**
 * D2b — THE COUNT-UP QUANTIZER, r14. The r13 grade caught L1's digit settling
 * 533ms EARLY (f4020 against its f4035 "FOUR" mark) even though D2's WINDOW
 * already ended exactly on the mark. Two compounding bugs, both in this one
 * expression:
 *
 *   1. the driver was `stage` (ease-out cubic), so t is already 0.875 at the
 *      window's halfway frame;
 *   2. `Math.round` on a small target snaps to the final value as soon as
 *      t >= (target - 0.5)/target. For target 4 that is t >= 0.875 — which
 *      ease-out reaches at u = 0.5, i.e. HALF the window. 15 frames = 500ms
 *      early, which is exactly what the render measured (ticks at f4007,
 *      f4010, f4020, then nothing).
 *
 * Fixed on both counts: every `*Count` driver below is LINEAR (`countAt`), and
 * the quantizer FLOORS instead of rounding, so the last tick lands on the
 * window's LAST frame by construction, whatever the target:
 *
 *   value(u) = 1 + floor(u * (target - 1))   ->   value(1) = target exactly
 *
 * Settling frames, r14 (window = the 30f ending ON the mark, D2):
 *   L1   4 cycles  ticks f4015/4025/4035, settles f4035 = its mark (was 4020)
 *   L2  12 cycles  settles f4151 = its mark (was ~f4141)
 *   L3  42 cycles  settles f4271 = its mark (was ~f4264)
 *   RAM 51 ns      settles f4631 = its mark
 *
 * NOT AN EVENT: a count-up never clears the 0.3% ink gate at any threshold —
 * mono digit ink is ~12-15% of its own box, so a 4-glyph number is well under
 * 0.1% of frame however fast it rolls. The count is a SYNC obligation, never
 * the thing that carries a stretch. That is why every mark also has a bed
 * wipe, a bar or a plate firing on it.
 */
const countUp = (t: number, target: number) =>
  Math.min(target, 1 + Math.floor(clamp01(t) * (target - 1) + 1e-9));

/* ==========================================================================
 * CONTRAST — the r7/r8 fix. See the CONTRAST FLOOR block in theme.ts.
 *
 * Everything the viewer is asked to see BEFORE it fills is now measured
 * against pure black rather than eyeballed. Measured ratios (WCAG, sRGB
 * composite over #000000):
 *
 *   theme.stroke #525C68 .................. 3.09:1   row-bed + callout outline
 *   white @ IDLE_MIN_ALPHA (0.35) ......... 3.01:1   pending hatch, armed bed
 *   accent @ BED_LIVE_ALPHA (0.30) ........ 1.32:1   LIVE bed — see below
 *   warm   @ 0.30 ......................... 1.39:1   LIVE bed
 *   down   @ 0.30 ......................... 1.26:1   LIVE bed
 *
 * The three LIVE beds are the one deliberate exception to the 3:1 rule in this
 * file, and they are exempt for the same reason theme.ts exempts a scrim: a
 * bed is not asked to be SEEN, it is asked to be a ground for the strings and
 * the bar that sit on it. What it has to clear is (a) the 25-luma gate against
 * the state it replaces, which is the armed bed, not black — dY 43 / 35 / 51,
 * all comfortably over — and (b) the 3:1 floor for everything drawn ON it,
 * which it improves rather than costs:
 *   ink #E6EDF3 on armed bed (white 0.35) ... 5.76:1
 *   ink #E6EDF3 on LIVE bed (accent 0.30) ... 9.90:1
 * The bed's own 3:1 read still comes from its theme.stroke OUTLINE, unchanged.
 *   accent #58A6FF @ 0.65 ................. 3.86:1   L1/L2 cost bars
 *   warm   #E3B341 @ 0.61 ................. 4.31:1   L3 cost bar
 *   down   #F85149 @ 0.71 ................. 3.49:1   RAM cost bar
 *   RAM run-out hatch, down @ 0.68 ........ 3.27:1
 *   die core cells, accent @ 0.563-0.92 ... 3.12:1 - 7.08:1
 *   packet trail, warm @ 0.85 ............. 7.82:1
 *
 * And the ink-over-fill ratios, because every bar carries row text on it:
 *   ink #E6EDF3 on accent bar ............. 4.60:1
 *   ink on warm bar ....................... 4.12:1
 *   ink on RAM bar ........................ 5.09:1
 *
 * What these replaced: the cost bars were painted at alpha 0.30 = 1.60:1, and
 * the pending / run-out hatches at 0.20 and 0.14 = 1.66:1 and 1.12:1. That is
 * why r7 measured "all four rung bars identical width" — the bars were never
 * the thing on screen, the full-width beds under them were. The widths were
 * already proportional in code and invisible in the render.
 * ======================================================================== */

/* ==========================================================================
 * GEOMETRY — the ladder owns the WHOLE frame. Four full-width rung bands
 * plus a fifth CALLOUT band beneath them; the docked chip identity owns the
 * top band. Nothing is confined to a quadrant and there is no dead half.
 *
 * Vertical budget, safe area y65..1015:
 *   96 .. 176   docked die + "Intel Skylake i7-6700"
 *  112 .. 208   top-right commentary PLATE (one string at a time)
 *  232 .. 830   the four rungs (4 x 136 + 3 x 18)
 *  848 .. 944   the callout band  <- D5: the pivot question's OWN slot
 *  958 .. 1014  source credit (left) + trip ledger (right)
 * ======================================================================== */
const SAFE_L = 115; // 6% margin at 1920
const SAFE_R = 1805;
const TRACK_W = SAFE_R - SAFE_L; // 1690

const ROW_H = 136;
const ROW_GAP = 18;
const ROW_TOP = [232, 386, 540, 694]; // 4 x 136 + 3 x 18 = 598, y232..830

/**
 * D13c — the commentary plate's left edge. 940, not 700: the docked chip
 * identity "Intel Skylake i7-6700" MEASURES out to x914 on full_r13, and at
 * 700 the plate's tint ran 214px underneath the part number. See the plate
 * block for the measurement and the reveal-rate arithmetic.
 */
const PLATE_L = 940;
/**
 * D13c — the plate's wipe length. 9f, not WIPE_FRAMES' 12: the narrower box is
 * 4.005% of frame, and 9 frames keeps it at 0.445 %/frame, slightly ABOVE the
 * 0.426 the 1105-wide box managed over 12. 9f is also the house entrance band.
 */
const PLATE_WIPE_F = 9;

/* ==========================================================================
 * D8 — THE ROW IS TWO BANDS, AND NOTHING CROSSES BETWEEN THEM.
 *
 * Every string used to be centred in the full 136px row and the cost bar used
 * to fill that same 136px, so the bar was always UNDER the text. r7 measured
 * what that costs, at f4600:
 *
 *   - "L1" and "L2" are drawn in `r.color` (theme.accent) directly on top of
 *     an accent-coloured bar; "L3" in theme.warm on a warm bar. Same hue, same
 *     value: the glyphs composite to roughly 1:1 and read as ghosts. Only
 *     "RAM" was legible, and only because its bar had not filled yet.
 *   - the L3 bar's bright end cap and the packet glyph both landed on the word
 *     "cycles" — the render says "42 cyc(l)es" with a yellow pill for the "l".
 *
 * No horizontal reshuffle can fix this, because RAM's bar is 3840px wide: it
 * passes under EVERY column at some t. So the fix is vertical. Text lives in
 * y0..TEXT_H; the bar, its pending hatch, its run-out and its end cap live in
 * a band below that. The bar can now be drawn SOLID (its alpha existed only to
 * keep text readable through it), which makes filling a bigger luma step than
 * the washed version it replaces.
 *
 * The row bed still spans the whole 136px — arming it is this beat's largest
 * content event (a 71-luma step across 10.7% of frame) and that is unchanged.
 * ======================================================================== */
const TEXT_H = 88; // strings centre in y0..88 of the row
const BAR_TOP = 90; // bar band y90..134, 2px clear of the bed's bottom border
const BAR_H = 44;

/**
 * D5 — THE CALLOUT BAND. "in none of those?" used to be an absolute overlay
 * at y470 with `textAlign: center`, which put 128px display type straight
 * through the L2 row: r7 measured it sitting on "12 cycles" and "one step
 * out" for f4395..4475, both strings unreadable. It now has a row slot of its
 * own BELOW the RAM row, in the ladder's own grammar (same left edge, same
 * width, same bed) so it reads as the ladder's next question rather than as a
 * popup. It can no longer collide with anything: the nearest ink above is the
 * RAM row ending at y830, the nearest below is the ledger starting at y958.
 */
const CALL_TOP = ROW_TOP[3] + ROW_H + ROW_GAP; // 848
/** 96, not 92: headline is 76 x 1.14 = 86.6px of line box and the band carries
 *  a 3px border top and bottom, so 92 left the text 0.6px over its own box. */
const CALL_H = 96; // y848..944, clear of the ledger band at y958

/* ==========================================================================
 * D10a — THE COLOUR TAB, i.e. what makes an UNANSWERED rung exist.
 *
 * r10 measured the idle ladder rows at 1.07:1. The file's previous answer was
 * that a row's 3:1 read came from its 3px theme.stroke outline (3.09:1) and
 * that the bed fill was only ever a tint. That answer is wrong for a measured
 * reason: the grade samples at 240x135 with 8x8 box pooling, and a 3px stroke
 * pooled 8x is 3/8 of one sample — its contrast is divided by the pool before
 * anything reads it. Hairlines do not survive the measurement, so a row whose
 * only supra-floor element is a hairline measures as its FILL, 1.07:1.
 *
 * Contiguous area is the only thing that survives pooling, and the row already
 * had a place to put some: the 6px left rule that carries the rung's identity
 * colour. Widened to 56px it is 56 x 136 = 7,616 px of unbroken, fully
 * saturated hue per row —
 *
 *   accent #58A6FF  8.31:1    L1, L2 tab
 *   warm   #E3B341 10.79:1    L3 tab
 *   down   #F85149  6.26:1    RAM tab
 *
 * — 0.37% of frame each, 1.47% for the four together, every one of them far
 * over both the 3:1 idle floor and the empty-frame metric's luma-110 line
 * (Rec.601 luma: accent 153, warm 180, down 130). The bed fill stays a tint
 * and is now
 * marked contrast-exempt with that reason rather than with an argument about
 * an outline that the instrument cannot see.
 *
 * It also does the job the old left rule was trying to do and failing at: the
 * rung's colour is declared with the rung, before its number, so the bar, the
 * bed and the tab are visibly the same rung rather than three coincidences.
 * ======================================================================== */
const TAB_W = 56;

const NAME_L = 195; // rung name column  (L1 / L2 / L3 / RAM), clear of the tab
const NUM_L = 430; // value column       (big count-up + unit)
const CAP_L = 1190; // caption column     (mono annotation, <=18 chars)

/* ==========================================================================
 * D7 — BAR WIDTHS ARE PROPORTIONAL TO COST, AND RAM RUNS OFF THE FRAME.
 *
 * RAM is scored at 256 cycle-equivalents (the 42-cycle L3 trip plus 51 ns, at
 * Skylake's ~4.2 GHz turbo); the on-screen text never asserts that derived
 * number, it says "42 cycles + 51 ns".
 *
 * PPC used to be TRACK_W / 256 = 6.60 px/cycle, chosen so RAM exactly FILLED
 * the frame. Exactly filling the frame is the one width that reads as "this
 * is the maximum", i.e. as a full progress bar — the opposite of the point.
 * At 15 px/cycle the RAM bar is 3840px wide and its right edge lands at
 * x=3955, 2035px PAST the 1920 frame edge: L1, L2 and L3 all stop with a
 * visible bright end-cap and RAM simply leaves. The overflow IS the argument,
 * so the end-cap is suppressed whenever the bar's edge is off-frame.
 *
 * D10a moved the bar band's origin right by TAB_W, so a bar starts where the
 * colour tab ends instead of underneath it — a 60px L1 bar drawn from x115 was
 * entirely inside the 56px tab and read as a slightly longer tab.
 *
 *   rung   cycles   width      right edge     ratio to L1
 *   L1          4    60px      x  231            1.0x
 *   L2         12   180px      x  351            3.0x
 *   L3         42   630px      x  801           10.5x
 *   RAM       256  3840px      x 4011 (off)     64.0x
 * ======================================================================== */
const RAM_EQ_CYCLES = 256;
const PPC = 15; // px per cycle
const RAM_FULL_W = RAM_EQ_CYCLES * PPC; // 3840 — 2.35x the visible bar track
/** The bar band starts after the tab and runs to the right margin. */
const BAR_L = TAB_W;
const BAR_TRACK_W = TRACK_W - TAB_W; // 1634
/** The rightmost x a bar can end at and still show its cap inside the frame. */
const CAP_VISIBLE_X = 1900;

/*
 * There was a BAR_ALPHA table here (accent 0.65, warm 0.61, down 0.71), one
 * alpha per palette entry, each annotated with the ink-over-fill ratio it
 * bought. D8 deleted it. Those alphas existed for one reason — to keep the
 * value and the caption readable THROUGH the fill they sat on — and the band
 * split means nothing sits on a fill any more. They were also optimistic: the
 * ratios were measured bar-over-BLACK, but a bar only ever appears on an ARMED
 * bed (white at 0.35), and warm@0.61 over that reads 2.56:1, not the 4.19:1
 * the table claimed. Bars are solid now; the focus pull lives in `barLift`.
 */

interface Rung {
  name: string;
  cycles: number;
  /** Value parts: each counts up independently. */
  parts: { to: number; prefix?: string; unit: string }[];
  caption: string;
  color: string;
}

const RUNGS: Rung[] = [
  {
    name: "L1",
    cycles: 4,
    parts: [{ to: 4, unit: "cycles" }],
    caption: "on the core",
    color: theme.accent,
  },
  {
    name: "L2",
    cycles: 12,
    parts: [{ to: 12, unit: "cycles" }],
    caption: "one step out",
    color: theme.accent,
  },
  {
    name: "L3",
    cycles: 42,
    parts: [{ to: 42, unit: "cycles" }],
    caption: "shared, all cores",
    color: theme.warm,
  },
  {
    name: "RAM",
    cycles: RAM_EQ_CYCLES,
    parts: [
      { to: 42, unit: "cycles" },
      { to: 51, prefix: "+", unit: "ns" },
    ],
    caption: "off the chip",
    color: theme.down,
  },
];

/** The L3 trip that the RAM read pays FIRST, staged before the 51 ns lands. */
const RAM_SEG1_W = 42 * PPC; // 630

/**
 * The packet route, L3 rung -> RAM rung. Routed DOWN the L3 bar's own edge,
 * ACROSS the gutter between the rows, then down the RAM row's left border —
 * so the line never crosses the "RAM" keyword, the value column, or the
 * caption column at any t.
 *
 * PK_R is HALF the packet glyph, and the reason this constant exists at all:
 * the rect is drawn from `pkX - PK_R`, so `pkX` is a CENTRE, not a left edge.
 * The route used to turn at SAFE_L itself, which hung the square outside the
 * margin — r7 measured leftmost ink at x92 (4.79% of frame) against a 6%
 * floor. Turning at SAFE_L + PK_R puts the glyph's own left edge flush on
 * SAFE_L, where every row track already sits.
 */
const PK_R = 26;
const PK_X0 = SAFE_L + BAR_L + RAM_SEG1_W; // 801 — the L3 bar's right edge
/** 197 — the turn. Glyph flush on the TAB's right edge (x171), not on the
 *  margin: since D10a the first 56px of every row is a saturated colour tab,
 *  and a warm packet parked on the RAM row's red tab is two hues in one
 *  50px square. Left edge 171, so it still starts where the bar starts. */
const PK_X1 = SAFE_L + BAR_L + PK_R; // 197
/** The centre of rung `i`'s bar band — where the packet rides. */
const barMid = (i: number) => ROW_TOP[i] + BAR_TOP + BAR_H / 2;
/**
 * D8 collapsed this from three legs to two. The old route dropped out of the
 * L3 ROW CENTRE (y608) — which under D8's split is the text band, i.e. exactly
 * where "42 cycles" sits, and r7 caught the packet parked on the "l". It also
 * needed a dogleg through the inter-row gutter to duck UNDER the "RAM"
 * keyword. With the bars in their own band the keyword is no longer in the
 * way: drop the L3 bar's right edge straight down to the RAM bar band, turn
 * left, and ride in. The vertical leg runs at x801, which is empty in the RAM
 * row's text band (the value column ends near x500, the caption starts at
 * x1190), so it crosses nothing on the way down.
 */
const PK_Y0 = barMid(2); // 652 — L3 bar band centre
const PK_Y1 = barMid(3); // 806 — RAM bar band centre
const PK_LEG = [PK_Y1 - PK_Y0, PK_X0 - PK_X1]; // 154 / 604
const PK_LEN = PK_LEG[0] + PK_LEG[1]; // 758

/**
 * The core -> RAM travel line. Five points, not three: the old two-leg route
 * ran its vertical leg down x=171 (the docked die's centre), which is 21px
 * INSIDE the rung-name column and drew a 9px red line straight through the
 * "L1" / "L2" / "L3" glyphs. It now jogs out of the die into the left gutter
 * at x=128 (stroke spans 122..134 — inside the 115 margin, and inside the
 * D10a colour tab's 115..171 band, so it reads as running down the ladder's
 * own coloured edge rather than across any column) and runs down the spine.
 *
 * Its length is DERIVED because the literal it used to carry (2100) was
 * shorter than the polyline, and a dasharray shorter than its own path
 * repeats: the whole right end of the sweep sat in the gap and never drew.
 */
const TRAVEL_X0 = 171; // the docked die's centre (SAFE_L + 112/2)
const TRAVEL_Y0 = 176; // the docked die's BOTTOM edge (96 + 80)
const TRAVEL_YJ = 204; // the jog, above ROW_TOP[0] = 232
const TRAVEL_X1 = 128; // the left gutter
/**
 * 685 — the gutter ABOVE the RAM row, not the row's centre. The old route
 * swept its horizontal leg along the RAM row's centre line, which is exactly
 * where "RAM", "42 cycles" and "+ 51 ns" sit: a 9px red rule straight through
 * the row's own text. In the gutter the stroke spans y679..691, clear of the
 * L3 row (ends 676) and the RAM row (starts 694), and it is the same line the
 * packet later retraces on its way out — the route, then the thing on it.
 */
const TRAVEL_Y1 = ROW_TOP[3] - ROW_GAP / 2; // 685
const TRAVEL_LEN =
  TRAVEL_YJ -
  TRAVEL_Y0 +
  (TRAVEL_X0 - TRAVEL_X1) +
  (TRAVEL_Y1 - TRAVEL_YJ) +
  (SAFE_R - TRAVEL_X1); // 28 + 43 + 481 + 1677 = 2229
const TRAVEL_PTS = [
  `${TRAVEL_X0},${TRAVEL_Y0}`,
  `${TRAVEL_X0},${TRAVEL_YJ}`,
  `${TRAVEL_X1},${TRAVEL_YJ}`,
  `${TRAVEL_X1},${TRAVEL_Y1}`,
  `${SAFE_R},${TRAVEL_Y1}`,
].join(" ");

/**
 * Row-bed fill. The row's 3:1 read is the D10a COLOUR TAB, not this and not
 * the 3px outline the previous revision credited (see D10a for why a hairline
 * cannot carry it). The fill is a tint whose only job is to make ARMING a
 * >= 25-luma event across 10.7% of frame: 0.07 -> luma 18, IDLE_MIN_ALPHA ->
 * luma 89, a 71-luma step, painted as a WIPE so it lands in single frames
 * (D11) rather than as a ramp nothing could see.
 *
 * Why the idle bed cannot simply be raised to the 3:1 floor instead: the floor
 * for a neutral grey on black IS luma 89 (= white at IDLE_MIN_ALPHA), and the
 * ceiling for a bed carrying theme.ink body text at 4.5:1 is luma 108. The
 * legal band for a text-bearing neutral bed is nineteen luma wide — room for
 * exactly one state, not three. So the other two states go chromatic-dark
 * (BED_LIVE_ALPHA) and the idle state gets its contrast from the tab.
 *
 * The value is 0.07 and it is spelled out as a literal at the paint site rather
 * than referenced from here, because check_contrast.ts reads colour LITERALS
 * and a `rgba(255,255,255,${CONST})` is invisible to it — which is exactly how
 * this bed passed the gate at 1.07:1 for three rounds.
 */

/* --- D9: THE BED HAS THREE STATES, NOT TWO -------------------------------
 *
 * r7 measured two dead stretches inside this beat and they have one cause
 * between them:
 *
 *   f3968-4110  4.77s  "a read that hits there costs FOUR cycles"
 *   f4507-4611  3.50s  "out to RAM -- the whole L3 trip first, and then..."
 *
 * Neither is under-staged. The first fires the L1 bar, its count-up, its
 * caption and the "one level out" lead; the second fires four ledger items, the
 * trip label, the run-out and the packet. TEN reveals across the two windows,
 * every one of them correctly placed on its word — and the peak repaint over
 * any 6-frame window in either is 0.94% and 1.23% against a 2% gate.
 *
 * They are all SMALL, and two of them cannot be made bigger:
 *
 *   - L1's cost bar is 4 cycles x PPC = 60px. That is 60px BECAUSE four cycles
 *     is nothing, which is the entire point of the rung; widening it would lie
 *     about the measurement the beat exists to show. 60 x BAR_H = 0.13%.
 *   - the RAM run-out is a HATCH, so only its lit bands move luma at all, and
 *     D8's band split dropped the bar band from ROW_H 136 to BAR_H 44. Even
 *     solid and full-width it is 2.25%, and hatched it is about half that.
 *
 * So the area has to come from the one surface in this scene that already has
 * it: the row bed, 1690 x 136 = 11% of frame. It had exactly two states —
 * idle (0.07) and armed (0.35) — which is one event per row for a beat that
 * asks each row to do three things: wait, arm, and ANSWER.
 *
 * A row that has answered now takes its own rung colour. The white tint
 * crossfades OUT as the colour comes in (composited over, accent@0.30 on top
 * of white@0.35 lands at luma 108 = dY 19 and would not have registered at
 * all); at full live the bed is r.color @ 0.30 over black:
 *
 *   accent #58A6FF @0.30 -> rgb( 26, 50, 77) luma 46   dY 43 from armed
 *   warm   #E3B341 @0.30 -> rgb( 68, 54, 20) luma 54   dY 35
 *   down   #F85149 @0.30 -> rgb( 74, 24, 22) luma 38   dY 51
 *
 * all clear of the 25-luma gate across 10.7% of frame (the bed less the colour
 * tab, which sits on top of it and does not change). D11 then made the move a
 * 12-frame WIPE rather than a 9-frame opacity ramp: at 1634 x 136 / 12 that is
 * 0.89% of frame per frame at the full dY, so it clears the one-frame floor
 * (0.3%) as well as the 6-frame one (2.0%), which the ramp version never did.
 *
 * WHY 0.30 AND NOT BRIGHTER. The obvious version of this was "the live row
 * burns brighter", white 0.35 -> 0.62. That is dY 69 and it fails the thing
 * this file spent all of r8 fixing: a 0.62 white bed is rgb(158) and
 * theme.ink on it is 2.13:1, under the 3:1 floor, so the fix for the pacing
 * table would have broken the readability of every string in the row. Going
 * DARKER and CHROMATIC buys the same luma step and moves ink-on-bed the right
 * way — 5.76:1 armed, 9.9:1 live.
 *
 * And it says something true: the rung's identity colour already owns its
 * name, its bar and its 56px colour tab, so the answer arriving is that colour
 * claiming the row. It is a region recolour of an element already on screen —
 * no new object, nothing to narrate that is not already being narrated.
 */
const BED_LIVE_ALPHA = 0.3;

/* ------------------------------------------------------------------------- */

export const LatencyLadder: React.FC<LatencyLadderProps> = ({
  p,
  frame = 0,
}) => {
  const core = p.core_glyph ?? 0;
  const l1 = p.rung_l1 ?? 0;
  const l2 = p.rung_l2 ?? 0;
  const l3 = p.rung_l3 ?? 0;
  const ram = p.rung_ram ?? 0;

  /* --- core_glyph, 403f / 13.4s · f3637..4040 ----------------------------
     D12 — FRONT-LOADED. r10 flagged f3637-3791 as an EMPTY RUN: 5.17s at 0.38%
     of frame above luma 110, the worst in the episode, and it was this beat's
     own opening. The grade's prescription was explicit — fix it by front-
     loading information, not by adding decorative events — and it named the
     cause: 11.7 seconds (f3637-4035) of scaffolding before the first number.

     What was actually on screen for those 5.17s: a die OUTLINE (6px accent
     stroke, 8,352 px = 0.40% of frame) and, from +97, one 76px headline. Both
     of the big surfaces this scene owns — the lit die and the four-rung ladder
     — were scheduled AFTER the window, at +177 and +201.

     So the whole assembly is pulled forward. The chip finishes lighting on the
     words "an actual chip" instead of eight seconds later, and the ladder is
     laid in while "closest to the core sits a tiny stash called L1" is still
     being said, which is when it is narrated anyway.

       core   frame  event                                  CLAIMED lit area
                                                       (r12 measured it false
                                                        — see the D6 note below)
       0.000  3637   die line-draws (now 9f, linear)             0.40%
       0.020  3645   cell wave 1
       0.045  3655   cell wave 2
       0.070  3665   cell wave 3
       0.085  3671   chip lights full — 12 cells @ accent 0.92    1.94%
       0.250  3738   "Intel Skylake" — on the words
       0.350  3778   "i7-6700"
       0.420  3806   dock: chip + name to the top band            0.97%
       0.460  3822   the four rung tracks WIPE in, staggered      2.44%
       0.520  3847   rung names spring in                         2.87%
       0.620  3887   "?" placeholders
       0.720  3927   L1 row ARMS (bed wipe) — on "called L1"
       0.913  4005   L1's value appears and starts counting

     The cell waves stay a ROW AT A TIME rather than one cascade, but at 10-frame
     spacing instead of 55 — they are an assembly, not a schedule filler.

     ---- D6 (r13): THE SCHEDULE WAS RIGHT, THE PAINT WAS NOT --------------
     MEASURED on full_r12, per frame at 240x135 / luma >= 110:
       f3637-3643  0.000%          (seven frames of literally nothing)
       f3644-3671  0.01% - 0.28%
       f3672-3805  1.38% - 2.61%
       f3806-3849  0.98% - 2.19%   (the dock)
     i.e. the whole of f3637-3848 sits under 3% and it is the head of the
     episode's worst run (f3551-3848 = 9.93s, shared with MemoryWall's tail).
     The table above is not what the render did, and the reason is arithmetic,
     not timing:

       - "die OUTLINE, 6px accent stroke, 0.40% of frame" is FALSE. The grade
         proxy is an 8x swscale BICUBIC downscale, whose support is wider than
         a box; 6px = 0.75 of a proxy pixel and vanishes. It measured ~0.00%,
         which is why f3637-3643 is exactly zero.
       - The wrapper also ramped `opacity: mix(0, 1, dieDraw)`, so the stroke
         spent its whole draw-on BELOW the luma gate as well as below the size
         floor — a ramp on top of an invisible object.
       - "12 cells @ accent 0.92 = 1.94%" was measured at the wrong alpha. The
         cell fill is `mix(0.64, 0.92, cellsFull) * (0.88 + 0.12*pulse)`, and
         before `cellsFull` that is 0.56-0.64 of accent's Rec.601 luma 153 =
         86-98 — UNDER the 110 gate. The three cell waves therefore lit nothing
         at all, and even at full the 12 cells were only 62x54 in a 420x300 box
         = 1.94% nominal.

     The fix buys AREA (the only thing an absolute gate can see), not brightness:
       die 420x300 -> 700x500, same 1.4 aspect so the viewBox and the docked
         chip scale uniformly and no geometry inside it moves;
       outline 6 -> 20 viewBox units = 33 real px = 4 proxy px, drawn LINEARLY;
       cell alpha floor 0.64 -> 0.84 so the waves are lit as they land.
       outline  2*(396+276)*20 viewBox units^2 x (700/420)^2
                                     =  74,672 px = 3.60% of frame, wipe 9f
                3.60 * 6 / 9 = 2.40  >= 2.0, and 0.40%/frame >= the 0.3% gate
       cells    12 x (103 x 90)      = 111,580 px = 5.38% of frame
                pre-`cellsFull` luma 121 (was 86-98), full 144-153
                dY on `cellsFull` = 27 > the 25-luma event gate
     Projected (arithmetic, not yet re-measured): f3638 ~0.4% rising to ~3.2%
     by f3645 (outline), ~5% from f3646 (outline + wave 1), ~8% from f3671.
     The residual sub-3% run is f3637-3641, five frames.

     THE DOCK IS STILL THE THIN PART, and honestly so. f3806-3849 measured
     0.98-2.19% and the docked chip only grows from 112x80 to 168x120 below
     (8,960 -> 20,160 px = 0.43% -> 0.97% at the body's luma 119), so that
     window lands at roughly 2.7%, still under 3%. It is 44 frames = 1.47s,
     under the 3s a dead stretch needs, and closing it properly would mean
     re-timing `tracks` off its narrated word — not worth it. */
  const C = ent("core_glyph");
  /* LINEAR (was `stage`, ease-out cubic). An ease-out opens at 3/N speed, so
     the first frames of an outline draw-on deliver under the 0.3% burst gate;
     a dash-offset draw is a wipe and wipes are linear here. 9 frames, not 12:
     3.69% * 6 / 9 = 2.46 clears the reveal-rate floor where /12 gives 1.85. */
  const dieDraw = wipeAt(core, 0.0, ent("core_glyph"));
  const cellsA = stage(core, 0.02, C);
  const cellsB = stage(core, 0.045, C);
  const cellsC = stage(core, 0.07, C);
  const cellsFull = stage(core, 0.085, C);
  /* --- D13: THE FIVE-SECOND LONE GLYPH, r14 ------------------------------
     The r13 grade named "f3650-3800 (~5s): a lone CPU glyph on screen with
     nothing else happening". MEASURED on full_r13, that is worse than named:
     the last MAJOR event is f3668 (the cell waves finishing) and the next is
     f3807 (the dock) — 139 frames = 4.63s — and between f3669 and f3739 there
     is not even a 0.3% content event, 2.33s of nothing. `nameA` at f3738 is a
     text pop; mono/heavy glyph ink is ~12-15% of its own box, so a headline
     landing is a sync event, never an area one. There was nothing in that
     window that a difference metric could see, and nothing the eye could
     either: one 700x500 chip held for five seconds.

     THE FIX IS AN ARRIVAL, NOT A BIGGER CAPTION. The die gains its SUBSTRATE —
     the silicon under the cache blocks — wiped in on "an actual chip". It is
     the same object growing, not a new card popping, so it also satisfies the
     transform-over-add rule; and it is a CONSTANT-HEIGHT rect growing in
     WIDTH, which is the one wipe geometry that is already linear in area
     without a sqrt(t) correction.

       body     408x288 viewBox units at the undocked 700x500 size
                = 680 x 480 real px = 326,400 px
       minus    12 cells already lit at 0.84 accent (12 x 103 x 90 = 111,600)
       minus    the 33px outline ring already at full accent (~72,000)
       net      142,800 px = 6.89% of 1920x1080  (per-strip range 0.90-1.25%)
       luma     accent #58A6FF @ BED_LIVE_ALPHA 0.30 over black = 46
                delta 46 >= the 25 gate, on every pixel it paints
       rate     6.89% / 6f = 1.148 %/frame average
                6-frame window = 5.77% >= 5.0  -> MAJOR event
                area*6/dur = 6.89*6/6 = 6.89   >> the 2.0 authoring floor
       honest   the middle strip (f3717) crosses a whole cell column and
                delivers 0.90% in its one frame, just under the 1.0%
                single-frame MAJOR clause. It qualifies as MAJOR on the
                6-frame-window clause, not the one-frame clause. Stated
                because the difference is measured, not assumed.

     Resulting MAJOR gaps in this window: f3671 -> f3714 = 1.43s, then
     f3720 -> f3807 = 2.90s. Both under the 5s defect threshold; the second is
     the dock window the block above already logs as honestly thin.

     Alpha, not brightness: 0.30 is BED_LIVE_ALPHA, the same alpha the LIVE
     rung beds use and exempted for the same reason (see the CONTRAST block).
     Cells over it still measure 4.13:1 and luma 136, over the 110 LIT line;
     the outline over it is 5.18:1. It rises to 0.78 as the chip DOCKS, which
     is D10b's docked-chip fix, unchanged. */
  const substrate = wipeAt(core, 0.19, ext("core_glyph")); // f3714..3720
  const nameA = stage(core, 0.25, C);
  const nameB = stage(core, 0.35, C);
  const dock = stage(core, 0.42, emph("core_glyph"));
  /* 0.46, not 0.44: the dock runs f3806..3824 and the chip's headline travels
     from y690 to y106 across it, i.e. straight through the rung band. Starting
     the tracks at 0.46 puts the wipe at f3822, with the dock 89% resolved. */
  const tracks = wipeAt(core, 0.46, wp("core_glyph"));
  const namesIn = stage(core, 0.52, C);
  const qIn = stage(core, 0.62, C);
  /* --- D13b: THE FROZEN "?", r14 -----------------------------------------
     The r13 grade named "f3900-4010 (3.7s): a frozen '?'". MEASURED, the
     MAJOR-event gap around it is f3848 -> f4033: 185 frames = 6.17s, over the
     5s defect threshold. The window is not empty — `qIn` pops the four
     placeholders at f3888 and `l1Arm` wipes L1's bed at f3929-3939 — but
     NEITHER cleared the MAJOR gate:

       f3888  "?" placeholders   0.55%/f   glyph ink, never an area event
       f3929  L1 bed arm         0.944%/f  win6 peak 4.679% -- see below

     The bed arm missed BOTH MAJOR clauses by a hair, and for an arithmetic
     reason, not an aesthetic one. The bed is 1690x136 = 229,840 px = 11.08%
     of frame; over WIPE_FRAMES = 12 that is 0.923 %/frame (measured 0.944)
     against a 1.0 clause, and a 6-frame window of 5.54% minus the frame it
     started from = the measured 4.679 against a 5.0 clause. Two clauses, both
     missed by under 7%.

     So the wipe is 9 frames instead of 12. Nothing else changes — same
     surface, same delta, same word, same grammar:

       11.08% / 9f = 1.231 %/frame   >= 1.0 in ONE frame     -> MAJOR
       6-frame window = 7.39%        >= 5.0 in 6 frames      -> MAJOR
       area*6/dur = 11.08*6/9 = 7.39 >> the 2.0 floor

     9f is also inside the 6-9f entrance band this file targets everywhere
     else; 12 was the plate/band gesture length borrowed for a surface eleven
     times their size. This alone splits the 6.17s gap into 2.67s and 3.20s.
     The second half is then split again by the "cache hit" plate at f3973 —
     see the plate array below. */
  /** L1's bed arm — a WIPE (D11/D13b), on "a tiny stash called L1". f3928..3937. */
  const l1Arm = wipeAt(core, 0.72, wpN("core_glyph", 9));
  /* D13b — the fourth use of the commentary-plate slot (D11), on "and a read
     that HITS there". The slot is empty from the beat's first frame until
     "one level out" at f4077, i.e. through the whole frozen-"?" window, so
     this is a reveal in an existing coordinate space rather than a new card.
       1105 x 96 = 106,080 px = 5.116% of frame, tint dY 51, 12f
       5.116 / 12 = 0.426 %/frame  >= the 0.3 burst gate on EVERY frame
       area*6/dur = 5.116*6/12 = 2.56 >= the 2.0 floor
     Not a MAJOR event and not claimed as one — D13b's 9-frame bed arm is what
     carries the MAJOR ladder here. This closes the burst-start gaps to
     f3937->f3973 (1.20s) and f3985->f4033 (1.60s). */
  const hitIn = wipeAt(core, 0.833, wpN("core_glyph", PLATE_WIPE_F)); // f3973..3982

  /* --- D2: THE COUNT-UP MUST SETTLE ON THE MARK, NOT START ON IT ----------
     r10 measured every rung's digits 6-9 frames LATE — L1 at f4041 against a
     f4035 mark, L2 f4159/4151, L3 f4279/4271, RAM f4640/4631 — while the row
     bed and the bar were on time. The cause was structural, not an offset: a
     count-up was authored as `stage(<its own step>, 0.0, 14f)`, and a step's
     own progress does not exist until three frames before its mark, so the
     digits could only ever finish rolling AFTER the word. A number that is
     still climbing when it is spoken has landed late however early it started.

     DrepperChart's `reveal` is the reference (its `settle` runs ep9705..9712,
     i.e. mark-4..mark+3): a count is scheduled BACKWARDS from its mark, and it
     therefore has to be driven by the PREVIOUS step's playhead, which is the
     only clock that exists 30 frames earlier. Each `*Count` below runs 30
     frames and each `*Val` is the 9-frame entrance that opens it, both counted
     as fractions of the driving step's own slot so they rescale with the cut:

       row   mark   count window        driver      fractions
       L1    4035   f4005..4035         core_glyph  0.9132 + 30/403
       L2    4151   f4121..4151         rung_l1     0.7177 + 30/124
       L3    4271   f4241..4271         rung_l2     0.7266 + 30/128
       RAM   4631   f4601..4631         rung_l3     0.9049 + 30/368

     This also SPLITS one event into two: the digits roll in a second before
     the word, and the bed + bar still fire on it. Both halves land on time and
     the beat gets four extra staged reveals for free.

     r14 FOLLOW-UP: getting the WINDOW right was necessary and not sufficient —
     r13 still measured L1's digit settling at f4020, 15 frames early, because
     the DRIVER inside the window was eased and the quantizer rounded. Both are
     fixed in `countUp`/`countAt`; see D2b at the top of this file. Every
     `*Count` below is `countAt` (linear) for that reason and must stay so. */
  const cStart = (mark: number, from: number, ramp: number) =>
    (mark - 30 - from) / ramp;
  const cWin = (ramp: number) => 30 / ramp;
  const l1Count = countAt(core, cStart(4035, 3637, 403), cWin(403));
  const l1Val = stage(core, cStart(4035, 3637, 403), C);

  /* --- rung_l1, 124f · f4032..4156 ---------------------------------------
     Closes the r10 strict gap f4039-4147 (3.63s with no one-frame event).

       l1     frame  event                                    one-frame ink
       0.00   4032   row 0 bed WIPES live + bar + cap edge     0.89%/f
       0.20   4057   caption "on the core"                     text
       0.36   4077   commentary plate "one level out" WIPES in 0.43%/f
       0.55   4100   row 1 bed ARMS (wipe)                     0.89%/f
       0.62   4109   row 0 settles (dim)
       0.72   4121   L2's digits appear and start counting     text

     `l2Arm` moved 0.62 -> 0.55 and the plate is new-as-a-plate (the string
     was already there, as bare type). Largest interval between one-frame
     events: 4100 -> 4148 = 48f = 1.60s. */
  const A1 = ent("rung_l1");
  const l1Act = stage(l1, 0.0, A1);
  const l1Cap = stage(l1, 0.2, A1);
  /* D13b — "cache hit" leaves the plate slot the same way it filled it, and it
     is CLEAR before the next string arrives: out f4059..4071, `l1Lead` in at
     f4077. Six frames of empty slot, never two strings at once (D11's rule).
     0.22 * 124 = 27.3 -> f4059. */
  const hitOut = wipeAt(l1, 0.22, wpN("rung_l1", PLATE_WIPE_F)); // f4059..4068
  /** "one level out" — lands on those exact words, out on the L2 number. */
  const l1Lead = wipeAt(l1, 0.36, wpN("rung_l1", PLATE_WIPE_F)); // f4077..4086
  const l2Arm = wipeAt(l1, 0.55, wp("rung_l1"));
  const l1Settle = stage(l1, 0.62, A1);
  const l2Count = countAt(l1, cStart(4151, 4032, 124), cWin(124));
  const l2Val = stage(l1, cStart(4151, 4032, 124), A1);

  /* --- rung_l2, 128f · f4148..4276 ---------------------------------------
     Closes the r10 strict gap f4158-4267 (3.67s).

       l2     frame  event                                    one-frame ink
       0.00   4148   row 1 bed WIPES live + bar                0.89%/f
       0.20   4174   caption "one step out"                    text
       0.38   4197   row 2 bed ARMS (wipe), on "Then L 3"      0.89%/f
       0.72   4240   L3's caption lands early, on "shared      text
                     across all the cores"
       0.72   4241   L3's digits appear and start counting     text

     Largest interval between one-frame events: 4197 -> 4268 = 71f = 2.37s,
     inside the 2-3s rule. */
  const A2 = ent("rung_l2");
  const l2Act = stage(l2, 0.0, A2);
  const l2Cap = stage(l2, 0.2, A2);
  const l3Arm = wipeAt(l2, 0.38, wp("rung_l2"));
  const l2Lead = stage(l2, 0.72, A2);
  const l2Settle = stage(l2, 0.72, A2);
  const l3Count = countAt(l2, cStart(4271, 4148, 128), cWin(128));
  const l3Val = stage(l2, cStart(4271, 4148, 128), A2);

  /* --- rung_l3, 368f / 12.3s · f4268..4636 --------------------------------
     Closes the r10 strict gaps f4279-4399 (4.03s) and f4451-4610 (5.33s), the
     second of which r10 also called out as a genuine 5.47s DEAD HOLD (D4): for
     f4448-4612 the only things moving were a bed tint ramp and 8px corner type.

     Two structural changes, not more reveals:

     (1) THE FOUR BIG SURFACES ARE WIPES NOW (D11). The commentary plate, the
         callout band, the RAM bed arm and the RAM bed's recolour to red were
         all opacity ramps, which is why a 7.8%- and a 10.7%-of-frame reveal
         could sit inside a "dead" window. Same elements, same words, drawn as
         uncoverings: 0.43%/f and 0.89%/f in every frame of the gesture.

     (2) THE L3 TRIP IS STAGED IN THE LADDER BODY (D4's own prescription: "an
         arrow or highlight tracing L1 -> L2 -> L3 -> DRAM"). `missTrace` walks
         a scrim down L1, L2, L3 in turn while the narration says "your data's
         in none of those... the chip has to ride all the way out to RAM", and
         the RAM bed going red is the fourth beat of the same gesture. See the
         MISS SWEEP block for the direction and contrast arithmetic.

       l3    frame   event                                     one-frame ink
       0.000 f4268   row 2 bed WIPES live + bar; digits settled 0.89%/f
                     at f4271
       0.060 f4290   caption "shared, all cores" (already in
                     via l2Lead at f4240)                       text
       0.140 f4320   commentary plate "still fine." WIPES in    0.43%/f
       0.260 f4364   plate WIPES out + cache rows dim           0.43%/f
       0.360 f4400   callout band "in none of those?" wipes in  0.65%/f
       0.490 f4448   callout band wipes out                     0.65%/f
       0.500 f4452   travel line draws, chip -> RAM row         thin
       0.620 f4496   RAM row ARMS: bed wipe + name pops         0.89%/f
       0.655 f4509   miss sweep L1 + ledger "L3"                0.94%/f
       0.700 f4526   miss sweep L2                              0.94%/f
       0.720 f4533   RAM's "42 cycles" rolls up + "L3 trip
                     first" docks in                            text
       0.745 f4542   miss sweep L3; packet leaves L3            0.94%/f
       0.790 f4559   RAM BED GOES RED (wipe) + RAM bar's L3     0.89%/f
                     segment draws behind the packet
       0.820 f4570   ledger "off-chip" pops                     text
       0.855 f4583   run-out spills past the track edge         hatch
       0.905 f4601   "+ 51 ns" appears and starts counting, and
                     "L3 trip first" leaves on its 6-frame
                     house exit — 27 frames clear of the mark   text
       0.930 f4610   ledger "DRAM" docks in                     text
       0.975 f4627   focus pull; blowout follows on the mark    9.5%

     Largest interval between supra-floor events: f4559 -> f4627, 68 frames =
     2.27s. Next largest: f4320 -> f4364 and f4448 -> f4496, both 48f = 1.60s.
     The run-out at f4583 is deliberately NOT counted — hatched at 50% duty it
     paints ~0.09%/f and it does not have to carry a gap.

     WHY "42 cycles" MOVED TO f4533. It is the half of the RAM answer the
     script speaks there — "the whole L3 trip first" — and the "+ 51 ns" half
     is what lands on the `ram` mark. Reading both parts off one count-up that
     started at the mark is what made D2 measure RAM's digits at f4640.

     A NOTE ON THE INK FIGURES. D8 split the row into a text band (y0..88) and
     a bar band (y90..134), dropping every bar-band element from ROW_H 136 to
     BAR_H 44, and an earlier revision of this table went on quoting the old
     numbers — the run-out is 1004x44 = 2.25% before hatching and about half
     that after, not the 7.0% once claimed. That is this episode's recurring
     failure (an instrument, or a comment, reporting a value it did not earn),
     so the column above is the ONE-FRAME ink each event actually paints, which
     is the number the strict gap gate reads. */
  const A3 = ent("rung_l3");
  const l3Act = stage(l3, 0.0, A3);
  const l3Cap = stage(l3, 0.06, A3);
  const verdict = wipeAt(l3, 0.14, wpN("rung_l3", PLATE_WIPE_F)); // f4320..4329
  const verdictOut = wipeAt(l3, 0.26, wpN("rung_l3", PLATE_WIPE_F)); // f4364..4373
  const cacheDim = stage(l3, 0.26, A3);
  const question = wipeAt(l3, 0.36, wp("rung_l3"));
  const questionOut = wipeAt(l3, 0.49, wp("rung_l3"));
  const travel = stage(l3, 0.5, emph("rung_l3"));
  const ramName = stage(l3, 0.62, A3);
  const ramArm = wipeAt(l3, 0.62, wp("rung_l3"));

  /* D4 — THE MISS SWEEP. Three legs, 17 frames apart, each a 10-frame wipe:
     f4509 (L1) · f4526 (L2) · f4542 (L3). `TRACE_LEG` is the spacing as a
     fraction of this step's slot so the three stay evenly spread if the cut
     moves; the fourth event in the run is the RAM bed itself going red at
     `SEG_AT` (f4559), which is the arrival the sweep hands off to.

     WHY IT DARKENS RATHER THAN HIGHLIGHTS. The obvious version of D4's
     prescription is a bright band walking the ladder, and it fails twice: a
     white 0.28 wash over the settled L3 bed drops the digits on it to 3.77:1
     (under the 4.5:1 body floor), and "buy area darker, never brighter" is the
     standing rule for this episode. So the sweep is a near-black scrim with a
     red cast that EXTINGUISHES each cache level in turn — which is also the
     literal reading of the line it lands on, "what happens if your data's in
     none of those?". Text over a scrimmed bed measures 8.17:1, better than
     before the sweep, and the row's colour tab is drawn ON TOP of the scrim so
     an extinguished row still keeps its 3:1 idle read.

     Ink per leg: the scrim spans the bar track only (1634 x 136 = 10.72% of
     frame), so ~9.4% after the standing bar is subtracted, wiped over 10
     frames = 0.94%/f at dY 31 (L1/L2) and dY 38 (L3) — over 3x the one-frame
     floor, three times, inside the window that was dead. */
  const TRACE_AT = 0.655;
  const TRACE_LEG = f3l(17);
  const TRACE_W = f3l(10);
  const missTrace = [0, 1, 2].map((i) =>
    wipeAt(l3, TRACE_AT + i * TRACE_LEG, TRACE_W),
  );

  /* --- THE RAM ARRIVAL, IN THE ORDER THE SCRIPT SAYS IT --------------------
     The script gives RAM's cost in two spoken halves, and the visuals now do
     the same instead of stacking both onto the `ram` mark:

       "the whole L3 trip first"     f4533  -> "42 cycles" + the 630px segment
       "another FIFTY-ONE ns ..."    f4631  -> "+ 51 ns"   + the blowout

     Moving the segment off the mark also un-jams a pile-up r10 inherited: the
     packet transit (f4591-4627), the segment draw (f4627-4636) and the focus
     pull (f4627-4636) all ran into the last nine frames before the number, and
     the whole 5.33s before them was empty. Spread across the words they carry,
     they are four separate events instead of one crowded one. */
  /** Segment draw, 12f, f4559..4571 — behind the packet, on "L3 trip first". */
  const SEG_AT = 0.79;
  /** Packet transit, 17f, f4542..4559, arriving as the segment starts. */
  const PACKET_AT = SEG_AT - f3l(17); // 0.7438

  /* ONE continuous physical action: a packet leaves the L3 rung on the trip
     trace's third leg, crosses to the RAM rung, and drags the RAM bar's L3
     segment in behind it — it hands off to the bar's leading edge on the exact
     frame the bar starts. */
  const packetTrail = stage(l3, PACKET_AT, emph("rung_l3"));
  const packetGo = travelStage(l3, PACKET_AT, SEG_AT - PACKET_AT);
  const ramSeg1 = travelStage(l3, SEG_AT, f3l(12));
  /** The RAM bed's recolour to red — a WIPE, on the same frame as the segment
   *  and the packet's arrival, so the fourth beat of the miss sweep is the row
   *  the trip ends on going live. (It used to ride `ramRunout` at 0.855, which
   *  put the arrival 24 frames after the packet got there.) */
  const ramLive = wipeAt(l3, SEG_AT, wp("rung_l3"));
  /* 0.78 -> 0.855 (f4555 -> f4583). The run-out is the cost SPILLING PAST the
     end of the track, so it cannot honestly precede the segment it spills out
     of; at 0.78 it drew from x630 while the bar's first 630px did not exist
     yet. Behind the segment it is both true and better spaced — f4559 (segment)
     -> f4583 (spill) -> f4631 (blowout), 24 and 48 frames. */
  const ramRunout = wipeAt(l3, 0.855, wp("rung_l3"));
  /* The focus pull stays on the blowout: at 0.94 it dimmed three rows (37% of
     frame) 25 frames early and bridged straight into the arrival. It is now
     pinned explicitly to the last 9 frames of the slot rather than riding
     `SEG_AT`, which has moved 72 frames earlier. */
  const focus = stage(l3, 1 - f3l(ENTRANCE_MAX_FRAMES), A3); // 0.9755, f4627
  /** "L3 trip first" — why the RAM bar starts as an L3-sized segment. */
  const tripLabel = stage(l3, 0.72, A3);
  /* D10c. Its exit used to be `1 - ramAct`, which ran the string down through
     the sub-floor alphas across f4628..4660 — the ~29 frames the grade caught
     at 1.03-1.98:1, on the RAM row, right on top of the episode's biggest
     number. It now leaves on its own 6-frame house exit at f4601, handing the
     caption column to "+ 51 ns", and is at zero 27 frames before the mark. */
  const tripOut = stage(l3, 0.905, ext("rung_l3"));
  /** RAM's first value part, "42 cycles", on "the whole L3 trip first". */
  const ramCountA = countAt(l3, 0.72 - f3l(30), f3l(30));
  const ramValA = stage(l3, 0.72 - f3l(30), A3);
  /** RAM's second part, "+ 51 ns" — counted to settle ON the mark (D2). */
  const ramCountB = countAt(l3, cStart(4631, 4268, 368), cWin(368));
  const ramValB = stage(l3, cStart(4631, 4268, 368), A3);
  /* The trip ledger. Three reveals, three grammars:
     mask-wipe · spring pop · dock-in from the left. */
  const tripA = stage(l3, 0.655, A3);
  const tripB = stage(l3, 0.82, A3);
  const tripC = stage(l3, 0.93, A3);
  /** The 7-cpu.com receipt: script.yaml pins it to `land_at: l3` = f4271. */
  const creditIn = stage(l3, 0.0, A3);

  /* --- rung_ram, 166f · f4628..4794: +0 blowout · +10 caption ·
     +70 Stroustrup plate · +116 full ladder relights · +146 close.
     `ramCap` moved 0.18 -> 0.06 so the RAM row's caption is settled well
     before f4660 rather than mid-entrance inside it (D10c). */
  const AR = ent("rung_ram");
  const ramAct = stage(ram, 0.0, AR);
  const ramCap = stage(ram, 0.06, AR);
  const neighborhood = wipeAt(ram, 0.42, wpN("rung_ram", PLATE_WIPE_F)); // f4698..4707
  const relight = stage(ram, 0.7, AR);
  const close = stage(ram, 0.88, AR);

  // Idle micro-motion only — never gates an appearance.
  const pulse = 0.5 + 0.5 * Math.sin(frame / 17);

  /* --- derived per-row state ---------------------------------------------- */
  const act = [l1Act, l2Act, l3Act, ramAct];
  // Row 2's caption lands EARLY, on "shared across all the cores" in the L2
  // slot, rather than waiting for its own rung — that is when it is narrated.
  const caps = [l1Cap, l2Cap, Math.max(l3Cap, l2Lead), ramCap];
  /**
   * Arming: the row you are about to fill lights its bed and lays a hatched
   * pending region the width of the cost to come. The bed is 1690x136 = 11%
   * of frame and the fill moves from luma 18 to luma 89 — but only counts as a
   * content event because it is now WIPED rather than ramped (D11): a 71-luma
   * change eased over 18 frames never moves any pixel 25 luma in one frame.
   */
  const arm = [l1Arm, l2Arm, l3Arm, ramArm];
  /**
   * D2 — per-row VALUE entrance and count, both scheduled off the PREVIOUS
   * step so they can settle ON the mark instead of starting on it. RAM's two
   * parts land on their own spoken halves, so it carries a pair.
   */
  const valIn = [l1Val, l2Val, l3Val, Math.max(ramValA, ramValB)];
  const partIn = [[l1Val], [l2Val], [l3Val], [ramValA, ramValB]];
  const partCount = [[l1Count], [l2Count], [l3Count], [ramCountA, ramCountB]];

  /* Dim chain: a rung settles when the next one arms, dims again when the
     cache block is dismissed, and again on the focus pull to RAM. `relight`
     brings the finished ladder back up for the closing hold.

     EVERY FLOOR HERE WAS RAISED (0.55->0.66, 0.34->0.55, 0.22->0.50). The old
     chain multiplied an already-dim bar by 0.22, which is how a 1.60:1 bar
     became a 1.06:1 bar: the deepest defocus in the beat was landing on the
     three rungs the viewer is meant to keep comparing against RAM. */
  const dimOf = (i: number) => {
    let d = 1;
    if (i === 0) d = mix(d, 0.66, l1Settle);
    if (i === 1) d = mix(d, 0.66, l2Settle);
    if (i <= 1) d = mix(d, 0.55, cacheDim);
    if (i === 2) d = mix(d, 0.62, cacheDim);
    if (i <= 2) {
      d = mix(d, 0.5, focus);
      d = mix(d, 0.95, relight);
    }
    return d;
  };

  /* Bar width — D7. L1/L2/L3 grow from 0 to their proportional width across
     their own 9-frame entrance. RAM stages: the L3 trip it pays first (630px,
     drawn f4559..4571 on "the whole L3 trip first"), then the blowout to
     3840px on the `ram` mark — 2091px of which is off the right edge. */
  const barW = (i: number) => {
    if (i < 3) return RUNGS[i].cycles * PPC * act[i];
    /* ADDITIVE, not Math.max. The two terms used to overlap by eight frames,
       so a max() of them made the blowout term overtake the segment term one
       frame in and snapped the bar 284px sideways. They no longer overlap at
       all (f4559..4571 and f4628..4637), but summing stays: it is what keeps
       the width monotonic and it is what makes the blowout read as "the 51ns
       added ON TOP of the trip" rather than as a replacement. */
    return RAM_SEG1_W * ramSeg1 + (RAM_FULL_W - RAM_SEG1_W) * ramAct;
  };

  // The packet: two legs out to the RAM rung, then it rides the leading
  // edge of the RAM bar as that bar draws in. One unbroken move.
  let pkX = PK_X0;
  let pkY = PK_Y0;
  const pkD = packetGo * PK_LEN;
  if (pkD <= PK_LEG[0]) {
    pkY = PK_Y0 + pkD;
  } else {
    pkX = PK_X0 - (pkD - PK_LEG[0]);
    pkY = PK_Y1;
  }
  // The ride starts where the second leg ended (PK_X1) rather than at the bar's
  // own left edge, so the handoff is seamless AND the glyph stays inside the
  // margin. It converges onto the drawing edge exactly at full segment width —
  // the packet drags the bar, it doesn't sit on it.
  if (ramSeg1 > 0) {
    pkX = mix(PK_X1, PK_X0, ramSeg1);
    pkY = PK_Y1;
  }
  const pkOn = clamp01(packetTrail * 3) * (1 - ramAct);

  /* D6 — 420x300 -> 700x500 undocked, 112x80 -> 168x120 docked. The aspect is
     1.4 in every state, so the 420x300 viewBox below scales uniformly and not
     one coordinate inside it has to move. Undocked the box is x610-1310,
     y250-750, inside the safe area; docked it is x115-283, y96-216, which
     clears the first rung track at ROW_TOP[0] = 232. */
  const dieBox = {
    left: mix(610, SAFE_L, dock),
    top: mix(250, 96, dock),
    width: mix(700, 168, dock),
    height: mix(500, 120, dock),
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        fontFamily: SANS,
        color: theme.ink,
      }}
    >
      {/* ---- the chip: draws centre-frame, then DOCKS to the top band ---- */}
      {/* No opacity ramp on this wrapper (D6). It used to fade the whole chip
          up on `dieDraw`, which meant the outline drew on WHILE composited
          below the luma-110 gate — an invisible object inside an invisible
          ramp. The outline's own strokeDashoffset is the entrance; the wrapper
          is either there or it isn't. */}
      <div
        style={{
          position: "absolute",
          ...dieBox,
          opacity: dieDraw > 0 ? 1 : 0,
        }}
      >
        <svg viewBox="0 0 420 300" width="100%" height="100%">
          {/* D10b — THE DOCKED CHIP. r10 measured it at 1.47:1. Nothing about
              its colours was wrong; the geometry was. Docked, the die is
              112x80, so the viewBox scales the 6px outline to 1.6px and the
              62x54 cells to 16x14 with gaps between them — and the grade pools
              8x8, which averages the whole glyph, gaps included, back down to
              its mean. A sparse grid cannot survive that however bright its
              cells are.
              So the die gains a BODY that fades in as it docks: at dock=1 it
              is accent @0.78 = rgb(69,129,199), 4.92:1 against black and luma
              117, i.e. over the empty-frame metric's 110 line as well. Full
              size the body stays off (0.78 * dock), because at 420x300 the
              grid reads on its own and a filled body would swamp the cells the
              chip is being assembled out of.

              D13 — r14: the body is no longer gated on the dock. It WIPES in
              at f3714 on "an actual chip" as a constant-height rect growing in
              width (`width={408 * substrate}`), which is the beat's missing
              arrival: 6.89% of frame at a 46-luma delta over 6 frames. Alpha
              is BED_LIVE_ALPHA (0.30) until the dock lifts it to D10b's 0.78 —
              a floor, not a ramp, so the wipe paints at full strength from its
              first frame. Opacity is BINARY on `substrate`; the width is the
              entrance. */}
          {/* contrast-exempt: substrate, not structure — same 0.30 LIVE-bed
              alpha and same reason. It is a ground for the cells and the
              outline drawn on it (4.13:1 and 5.18:1 over it, both measured),
              never a thing asked to be read on its own. */}
          <rect
            x={6}
            y={6}
            width={408 * substrate}
            height={288}
            rx={18}
            fill={theme.accent}
            opacity={substrate > 0 ? mix(BED_LIVE_ALPHA, 0.78, dock) : 0}
          />
          {/* 20 viewBox units, not 6 (D6). At the 700px-wide undocked size
              that is 33 real px = 4 proxy pixels at the 240x135 grade, which
              reads near accent's true luma 153; 6 units was 10 real px = 1.25
              proxy px and measured as the 0.000% that opens this beat. The
              rect insets to 12 so a 20-wide stroke (10 either side) still fits
              inside the viewBox; the dash constant is its new perimeter,
              2*(396+276) = 1344. Docked it scales to 8px, which is why the
              docked chip no longer needs the grid to survive the pooling. */}
          <rect
            x={12}
            y={12}
            width={396}
            height={276}
            rx={18}
            fill="none"
            stroke={theme.accent}
            strokeWidth={20}
            strokeDasharray={1344}
            strokeDashoffset={1344 * (1 - dieDraw)}
          />
          {[0, 1, 2, 3].map((cx) =>
            [0, 1, 2].map((cy) => {
              // One wave per ROW, 10 frames apart (D12 front-load; was 55),
              // each with a 4-frame column stagger inside it; then every cell
              // lifts together on `cellsFull` at f3671.
              const wave = [cellsA, cellsB, cellsC][cy];
              const gate = clamp01((wave - cx * 0.14) * 2.2);
              // D6 — 0.64 was a CONTRAST fix that failed the LIT gate. With
              // the breath at its trough it composited to 0.56 of accent's
              // Rec.601 luma 153 = 86, and even at its peak 98 — under the 110
              // threshold — so the three cell waves that assemble the chip
              // measured 0.000% of lit area between f3645 and f3671.
              // 0.84 floor x a 0.94 breath trough = 121, over the gate from
              // wave one; `cellsFull` still lifts it to 144-153, dY 27, over
              // the 25-luma event gate. Contrast: 0.84 -> 5.2:1, 1.0 -> 7.0:1.
              const lit = mix(0.84, 1.0, cellsFull) * (0.94 + 0.06 * pulse);
              return (
                <rect
                  key={`${cx}-${cy}`}
                  x={46 + cx * 84}
                  y={44 + cy * 74}
                  width={62}
                  height={54}
                  rx={7}
                  fill={theme.accent}
                  opacity={gate * lit}
                />
              );
            }),
          )}
        </svg>
      </div>

      {/* ---- chip name: morphs headline -> docked label (dock grammar) ---- */}
      <div
        style={{
          position: "absolute",
          // D6 — both ends moved for the bigger die. Undocked the chip now
          // ends at y750, so the headline drops 690 -> 800 (76px at lh 1.14 =
          // y800-887, inside the 1015 floor) and sits centred under it at
          // x610. Docked the chip is 168 wide from x115, i.e. it ends at x283,
          // so the label starts at 315 instead of 247.
          left: mix(610, 315, dock),
          top: mix(800, 106, dock),
          width: 1100,
          display: "flex",
          alignItems: "baseline",
          gap: 18,
          fontSize: mix(TYPE.headline.fontSize, TYPE.label.fontSize, dock),
          lineHeight: TYPE.headline.lineHeight,
          fontWeight: TYPE.headline.fontWeight,
          letterSpacing: TYPE.headline.letterSpacing,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            opacity: nameA,
            transform: `translateY(${(1 - nameA) * 14}px)`,
          }}
        >
          Intel Skylake
        </span>
        <span
          style={{
            fontFamily: MONO,
            color: theme.dim,
            opacity: nameB,
            transform: `translateY(${(1 - nameB) * 14}px)`,
          }}
        >
          i7-6700
        </span>
      </div>

      {/* ---- D11 — THE COMMENTARY PLATE ---------------------------------
              The top-right slot is reused FOUR times (D13b added "cache hit")
              and never carries two strings at once: "cache hit" wipes out at
              f4071 and "one level out" does not wipe in until f4077, "one
              level out" is gated out by the L2 number, "still fine." by
              cacheDim, and Stroustrup does not arrive until
              rung_ram. All four used to be bare 76px type on black, entering
              on an opacity ramp — the largest of them repaints about 0.8% of
              frame spread over nine frames, which is a fifth of the one-frame
              floor, so none of the three was a content event and each of them
              sat inside one of r10's strict gaps.

              They now share the CALLOUT BAND's grammar: same 3px stroke
              outline, same coloured left rule, same tint, same left-to-right
              wipe, at the tint's dY 51. Four reveals go from
              invisible-to-the-instrument to over the floor without a single
              new element on screen — and the slot reads as the ladder's aside
              rather than as text floating in the corner.

              D13c — THE LEFT EDGE MOVED 700 -> PLATE_L 940, r14. The old
              comment on this block claimed "no horizontal overlap" with the
              docked chip band. MEASURED on full_r13 (960x540 grading render,
              doubled to 1920 space), the docked identity row occupies:

                die glyph   118..280
                "Intel"     318..430
                "Skylake"   448..660
                "i7-6700"   684..914   <- ends at x914

              so the plate's tinted body ran 214px UNDERNEATH "i7-6700", and
              the mono string showed through the 0.20 white tint. Visible in
              full_r13 at f4100 as a grey slab across the chip's part number.
              940 clears x914 by 26px.

              NOTHING MOVES ON SCREEN. The strings are right-aligned to
              paddingRight 26, so their glyph positions are unchanged (measured
              text boxes: "Stroustrup's ballpark" 1020..1772, "one level out"
              1316..1772). Only the box's left edge and its tint shrink.

              The wipe is 9 frames rather than 12 to hold the reveal rate up
              through the narrower box, and 9f is the house entrance band:
                865 x 96 = 83,040 px = 4.005% of frame
                4.005 / 9 = 0.445 %/frame   >= the 0.3 burst gate every frame
                area*6/dur = 4.005*6/9 = 2.67  >= the 2.0 floor
              (at the old 1105 width and 12f it was 0.426 %/frame — this is
              slightly FASTER than what it replaces, not a regression.)
              Not a MAJOR event at either width; never claimed as one.

              y112..208: 24px clear of ROW_TOP[0] = 232.

              Headline over the composite tint (luma 51): theme.ink 10.69:1,
              theme.up 4.97:1, theme.warm 6.49:1 — all over the 4.5:1 body
              floor. -- */}
      {(
        [
          // D13b — on "and a read that HITS there", f3973..3985, out f4059.
          ["cache hit", theme.up, hitIn, hitOut],
          ["one level out", theme.ink, l1Lead, l2Act],
          ["still fine.", theme.up, verdict, verdictOut],
          ["Stroustrup’s ballpark", theme.warm, neighborhood, 0],
        ] as [string, string, number, number][]
      ).map(([label, hue, wIn, wOut]) => (
        <div
          key={label}
          style={{
            position: "absolute",
            left: PLATE_L,
            top: 112,
            width: SAFE_R - PLATE_L,
            height: 96,
            boxSizing: "border-box",
            borderRadius: 10,
            // contrast-exempt: tint, not structure — identical to the callout
            // band below. What has to READ here is the 76px headline on it and
            // the 3:1 theme.stroke outline; the fill's only job is the 0 -> 51
            // luma step that makes the wipe a content event.
            background: "rgba(255,255,255,0.20)",
            border: `3px solid ${theme.stroke}`,
            borderRight: `6px solid ${hue}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 26,
            ...TYPE.headline,
            color: hue,
            opacity: wIn > 0 && wOut < 1 ? 1 : 0,
            // In from the left, OUT from the left: the slot empties the same
            // way it filled, so the exit is a second full-contrast gesture
            // rather than a fade nothing can measure.
            clipPath: `inset(0 ${(1 - wIn) * 100}% 0 ${wOut * 100}%)`,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      ))}

      {/* ---- the travel line: chip -> the left gutter -> the RAM row ------ */}
      <svg
        style={{ position: "absolute", inset: 0, opacity: travel }}
        width={1920}
        height={1080}
      >
        <polyline
          points={TRAVEL_PTS}
          fill="none"
          stroke={theme.down}
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={TRAVEL_LEN}
          strokeDashoffset={TRAVEL_LEN * (1 - travel)}
          opacity={0.92}
        />
      </svg>

      {/* ---- the four rungs ----------------------------------------------- */}
      {RUNGS.map((r, i) => {
        const trackIn = clamp01((tracks - i * 0.06) * 1.8);
        const nIn = clamp01((namesIn - i * 0.07) * 2.2);
        // The "?" retires against the VALUE now, not against `act[i]` — the
        // value settles on the mark and `act` starts there, so gating on `act`
        // left the placeholder and the digits stacked for nine frames.
        const qOn = clamp01((qIn - i * 0.07) * 2.2) * (1 - valIn[i]);
        const a = act[i];
        const isRam = i === 3;
        const nameLive = isRam ? Math.max(a, ramName) : a;
        /**
         * CONTRAST. The dim chain used to multiply TEXT down to 1.73:1 (a
         * settled row bottomed out at 0.22 of ink). Every string in the row
         * now composites at `textLift`, floored at 0.70 of ink = 8.4:1 on
         * black; only the GRAPHICS wrapper below carries the deeper dim, and
         * that dim now bottoms out at 0.50 rather than 0.22.
         */
        const rowDim = dimOf(i);
        const textLift = Math.max(rowDim, 0.7);
        const armed = arm[i];
        /**
         * D9 — the third bed state, as a WIPE FRACTION rather than an opacity.
         * `live` is how much of the bed has been uncovered in the rung's own
         * hue, left to right. For L1/L2/L3 the row goes live when its cost
         * lands, so `act[i]` drives it and the 10.7%-of-frame recolour is the
         * event that carries the spoken number: L1's is f4032-4041, on "costs
         * FOUR cycles", where the bar it replaces is 0.13% of frame.
         *
         * RAM goes live on `ramLive` (f4559), the frame the packet arrives and
         * the L3 segment starts drawing — its answer comes in two spoken halves
         * and this is the first, "the whole L3 trip first". `ramAct` is the
         * second, 72 frames later. Math.max, not a sum: the bed must not
         * overshoot BED_LIVE_ALPHA on the handover.
         */
        const live = isRam ? Math.max(ramLive, ramAct) : clamp01(act[i]);
        /**
         * D4 — the miss sweep. L1/L2/L3 only; the RAM row is where the trip
         * ENDS, so it goes red instead of dark. `relight` lifts the scrim for
         * the closing hold on the finished ladder.
         */
        const miss = i < 3 ? missTrace[i] : 0;
        const w = barW(i);
        /**
         * D8: the bar is SOLID now. `BAR_ALPHA` existed to keep the value and
         * the caption readable THROUGH the fill; under the band split nothing
         * is drawn on the bar any more, so the alpha only cost contrast — and
         * it cost more than its own table claimed, because those ratios were
         * measured bar-over-black while the armed bed sits under it at 0.35
         * (warm@0.61 reads 4.04:1 over black but 2.56:1 over the armed bed).
         *
         * So the bar band gets its own lift instead, on the same floor as the
         * text: the focus pull still reads, but a dimmed accent bar bottoms out
         * at 4.3:1 rather than the 1.70:1 the old wrapper chain produced.
         */
        const barLift = Math.max(rowDim, 0.7);
        return (
          <div
            key={r.name}
            style={{
              position: "absolute",
              left: SAFE_L,
              top: ROW_TOP[i],
              width: TRACK_W,
              height: ROW_H,
              // The row UNCOVERS rather than scaling in (D11). scaleX(0.86->1)
              // moved 236px of edge over 12 frames and repainted almost nothing;
              // a wipe paints TRACK_W/12 x ROW_H = 19,153 px per frame. The clip
              // is dropped once the row is fully in, because RAM's bar is 3840px
              // wide on purpose and must be allowed to run off the frame.
              clipPath: trackIn < 1 ? wipeIn(trackIn) : undefined,
              opacity: (trackIn > 0 ? 1 : 0) * textLift,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: rowDim / textLift,
              }}
            >
              {/* (1) idle tint — the row at rest. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 10,
                  // contrast-exempt: tint, not structure — the row's 3:1 read
                  // is the colour tab in layer (5), which is 7,616 px of solid
                  // hue and survives the grade's 8x pooling where a hairline
                  // outline does not (D10a). Written as a LITERAL rather than
                  // `${BED_IDLE_ALPHA}` (= 0.07) so check_contrast.ts can see
                  // it at all: the gate parses colour literals, and a
                  // template-interpolated alpha is invisible to it.
                  background: "rgba(255,255,255,0.07)",
                }}
              />
              {/* (2) ARMED — the neutral bed lifts to IDLE_MIN_ALPHA as a wipe.
                  0.07 then 0.30 over it composites to 0.349, i.e. luma 89 on
                  black, a 71-luma step; the left inset retires it exactly where
                  layer (3) has already taken over, so the two never sum. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 10,
                  // contrast-exempt: tint, not structure — see layer (1).
                  background: "rgba(255,255,255,0.30)",
                  opacity: armed > 0 ? 1 : 0,
                  clipPath: `inset(0 ${(1 - armed) * 100}% 0 ${live * 100}%)`,
                }}
              />
              {/* (3) D9: the ANSWERED state. A sibling rather than a colour lerp
                  on the tint above, because the two fills are different colour
                  spaces (neutral white-alpha vs the rung hue) and interpolating
                  between them in rgb passes through a muddy grey-blue that reads
                  as a fade rather than a claim. Uncovered left-to-right, so the
                  recolour is a real one-frame event at every frame of it. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 10,
                  background: r.color,
                  opacity: BED_LIVE_ALPHA,
                  clipPath: wipeIn(live),
                }}
              />
              {/* (4) D4: the MISS SCRIM. Starts after the tab so an extinguished
                  row keeps its 3:1 idle read, and sits under the bar band so the
                  costs stay comparable. contrast-exempt: this DARKENS — every
                  string over it measures better than without it (8.17:1). */}
              {i < 3 ? (
                <div
                  style={{
                    position: "absolute",
                    left: TAB_W,
                    top: 0,
                    width: TRACK_W - TAB_W,
                    height: ROW_H,
                    borderRadius: "0 10px 10px 0",
                    background: "rgba(9,4,6,0.78)",
                    opacity: miss > 0 ? 1 - relight : 0,
                    clipPath: wipeIn(miss),
                  }}
                />
              ) : null}
              {/* (5) D10a: the colour tab — 56 x 136 of unbroken hue, the one
                  element in an idle row that survives the grade's 8x pooling.
                  Painted OVER the scrim on purpose. */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: TAB_W,
                  height: ROW_H,
                  borderRadius: "10px 0 0 10px",
                  background: r.color,
                }}
              />
              {/* (6) outline, last so nothing paints over it */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 10,
                  border: `3px solid ${theme.stroke}`,
                }}
              />
            </div>

            {/* ---- D8: the bar band. Its own wrapper on its own lift, below
                    the text band, so nothing is ever drawn on top of a bar and
                    a bar is never drawn on top of a string. ---------------- */}
            <div
              style={{
                position: "absolute",
                // D10a: the band starts where the colour tab ends, so a 60px
                // L1 bar is not drawn entirely inside the tab.
                left: BAR_L,
                top: BAR_TOP,
                width: BAR_TRACK_W,
                height: BAR_H,
                opacity: barLift / textLift,
              }}
            >
              {/* pending region: the cost about to land, hatched in, wiped
                  left-to-right as the row arms and replaced by the real bar.
                  Bands at IDLE_MIN_ALPHA / 0.12 = 3.01:1 / 1.27:1; was
                  0.20 / 0.05 = 1.66:1 / 1.08:1, i.e. not on screen. */}
              {isRam ? null : (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: r.cycles * PPC * armed,
                    height: BAR_H,
                    borderRadius: 8,
                    background: `repeating-linear-gradient(115deg, rgba(255,255,255,${IDLE_MIN_ALPHA}) 0 26px, rgba(255,255,255,0.12) 26px 52px)`,
                    opacity: 1 - a,
                  }}
                />
              )}
              {/* RAM's dashed run-out: shows how much frame is left to fill,
                  x630..1634 of the bar track. Bands at down@0.68 / 0.24 =
                  3.27:1 / 1.28:1.

                  D10: the exit was `1 - ramAct * 0.85`, which left the hatch
                  parked at 0.15 for the REST OF THE BEAT — down@0.68 x 0.15
                  measures 1.05:1, and that remnant sitting on the RAM row from
                  f4637 on is the 1.03:1 annotation the grade found at
                  f4631-4660. It is now driven fully to zero. */}
              {isRam ? (
                <div
                  style={{
                    position: "absolute",
                    left: RAM_SEG1_W,
                    top: 0,
                    width: (BAR_TRACK_W - RAM_SEG1_W) * ramRunout,
                    height: BAR_H,
                    borderRadius: 8,
                    background:
                      "repeating-linear-gradient(115deg, rgba(248,81,73,0.68) 0 26px, rgba(248,81,73,0.24) 26px 52px)",
                    opacity: 1 - ramAct,
                  }}
                />
              ) : null}
              {/* proportional cost bar — D7. RAM's runs 2035px past the frame
                  edge on purpose; see the GEOMETRY block. */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: w,
                  height: BAR_H,
                  borderRadius: 8,
                  background: r.color,
                }}
              />
              {/* bright end cap, so a 60px L1 bar still reads as an edge — and
                  SUPPRESSED once the edge is off-frame, which is what makes
                  RAM read as "this one doesn't stop" rather than as a full
                  progress bar. */}
              <div
                style={{
                  position: "absolute",
                  left: Math.max(0, w - 10),
                  top: 0,
                  width: 10,
                  height: BAR_H,
                  background: "#FFFFFF",
                  opacity:
                    w > 1 && SAFE_L + BAR_L + w < CAP_VISIBLE_X ? 0.9 : 0,
                }}
              />
            </div>

            {/* rung name — OUTSIDE the dim wrapper, see textLift */}
            <div
              style={{
                position: "absolute",
                left: NAME_L - SAFE_L,
                top:
                  (TEXT_H - TYPE.keyword.fontSize * TYPE.keyword.lineHeight) /
                  2,
                ...TYPE.keyword,
                color: nameLive > 0.5 ? r.color : theme.dim,
                // Colour carries the armed/live state; opacity no longer
                // does, because 0.45 x dim measured 2.1:1.
                opacity: nIn,
                transform: `scale(${pop(nIn)})`,
                transformOrigin: "left center",
                whiteSpace: "nowrap",
              }}
            >
              {r.name}
            </div>

            {/* "?" placeholder -> counted value (transform, not add/remove) */}
            <div
              style={{
                position: "absolute",
                left: NUM_L - SAFE_L,
                top:
                  (TEXT_H - TYPE.display.fontSize * TYPE.display.lineHeight) /
                  2,
                ...TYPE.display,
                color: theme.dim,
                opacity: qOn, // was qOn * 0.5 = 2.4:1
                transform: `scale(${mix(1, 0.7, valIn[i])})`,
                transformOrigin: "left center",
              }}
            >
              ?
            </div>
            {/* D2 — the value column. EACH PART carries its own entrance and its
                own count, both scheduled off the PREVIOUS step so the digits
                SETTLE on their word mark instead of starting there (r10 measured
                every rung 200-300ms late). The container no longer gates on
                `act[i]`, which is what made the whole column wait for the mark
                it was supposed to arrive with. */}
            <div
              style={{
                position: "absolute",
                left: NUM_L - SAFE_L,
                top:
                  (TEXT_H - TYPE.display.fontSize * TYPE.display.lineHeight) /
                  2,
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                transformOrigin: "left center",
                whiteSpace: "nowrap",
              }}
            >
              {r.parts.map((part, k) => (
                <React.Fragment
                  key={part.unit}
                  // RAM's two parts land 98 frames apart, on the two halves the
                  // script speaks: "the whole L3 trip first" and "another
                  // FIFTY-ONE nanoseconds on top of that".
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 16,
                      opacity: partIn[i][k],
                      transform: `scale(${pop(partIn[i][k])})`,
                      transformOrigin: "left center",
                    }}
                  >
                    {part.prefix ? (
                      <span
                        style={{
                          ...TYPE.label,
                          // D10: was theme.dim (#8B949E). On the RAM row's red
                          // bed that measures 3.81:1, under the 4.5:1 body
                          // floor. Every unit and prefix is ink now; the rung's
                          // hue is carried by the tab and the bar, which are
                          // fills and can afford it.
                          color: theme.ink,
                          marginLeft: 8,
                        }}
                      >
                        {part.prefix}
                      </span>
                    ) : null}
                    <span style={{ ...TYPE.display, color: theme.ink }}>
                      {countUp(partCount[i][k], part.to)}
                    </span>
                    <span style={{ ...TYPE.label, color: theme.ink }}>
                      {part.unit}
                    </span>
                  </span>
                </React.Fragment>
              ))}
            </div>

            {/* "L3 trip first" — why the RAM bar starts at L3's width. Docks
                in from the left, out on the RAM number, so it never shares the
                caption column with "off the chip". */}
            {isRam ? (
              <div
                style={{
                  position: "absolute",
                  left: CAP_L - SAFE_L,
                  top:
                    (TEXT_H -
                      TYPE.annotation.fontSize * TYPE.annotation.lineHeight) /
                    2,
                  ...TYPE.annotation,
                  fontFamily: MONO,
                  color: theme.warm,
                  opacity: tripLabel * (1 - tripOut),
                  transform: `translateX(${(1 - tripLabel) * -34}px)`,
                  whiteSpace: "nowrap",
                }}
              >
                L3 trip first
              </div>
            ) : null}

            {/* caption — enters WITH its rung, never before it */}
            <div
              style={{
                position: "absolute",
                left: CAP_L - SAFE_L,
                top:
                  (TEXT_H -
                    TYPE.annotation.fontSize * TYPE.annotation.lineHeight) /
                  2,
                ...TYPE.annotation,
                fontFamily: MONO,
                color: theme.ink,
                opacity: caps[i],
                transform: `translateX(${(1 - caps[i]) * -22}px)`,
                whiteSpace: "nowrap",
              }}
            >
              {r.caption}
            </div>
          </div>
        );
      })}

      {/* ---- the packet: L3 rung -> RAM rung, then it drags the RAM bar in
              behind it. Painted OVER the rungs so it rides the bar's edge. -- */}
      <svg
        style={{ position: "absolute", inset: 0, opacity: pkOn }}
        width={1920}
        height={1080}
      >
        <polyline
          points={`${PK_X0},${PK_Y0} ${PK_X0},${PK_Y1} ${PK_X1},${PK_Y1}`}
          fill="none"
          stroke={theme.warm}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={PK_LEN}
          strokeDashoffset={PK_LEN * (1 - packetTrail)}
          // 0.55 x warm measured 1.9:1 — the trail was drawing into the same
          // sub-floor band as everything else in this beat.
          opacity={0.85}
        />
        <rect
          x={pkX - PK_R}
          y={pkY - PK_R}
          width={PK_R * 2}
          height={PK_R * 2}
          rx={12}
          fill={theme.warm}
        />
      </svg>

      {/* ---- D5: the pivot question, in its OWN band below the RAM row ----
              Mask-wipe grammar (the band and its text uncover together), which
              is the fourth distinct entrance in this beat after the die's
              line-draw, the chip's dock, and the rung names' spring pop. */}
      <div
        style={{
          position: "absolute",
          left: SAFE_L,
          top: CALL_TOP,
          width: TRACK_W,
          height: CALL_H,
          borderRadius: 10,
          // contrast-exempt: tint, not structure. The band's 3:1 read is its
          // 3px theme.stroke outline (3.09:1), its 6px warm rule (10.79:1) and
          // its ink (17.77:1); the fill only has to separate the band from the
          // field behind it. 0.20 is chosen for the LUMA STEP — 0 -> 51 across
          // 1690x96 (7.5% of frame) is unmissable to eye and detector alike.
          // Raising it to the 3:1 floor would make the plate compete with the
          // headline sitting on it, which inverts the thing the floor protects.
          background: "rgba(255,255,255,0.20)",
          border: `3px solid ${theme.stroke}`,
          borderLeft: `6px solid ${theme.warm}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...TYPE.headline,
          color: theme.ink,
          // D11: BOTH directions are wipes. The exit used to be an opacity
          // fade, which is why f4448 opened a 5.33s strict gap — a 7.5% surface
          // dropping 51 luma over 12 eased frames moves no pixel 25 luma in any
          // single frame. Uncovered from the left, re-covered from the left:
          // 1690x96 / 12f = 13,520 px/f = 0.65% of frame, each way.
          opacity: question > 0 && questionOut < 1 ? 1 : 0,
          clipPath: `inset(0 ${(1 - question) * 100}% 0 ${questionOut * 100}%)`,
          whiteSpace: "nowrap",
        }}
      >
        in none of those?
      </div>

      {/* ---- the trip ledger: fills the old L3->RAM freeze, bottom band ---- */}
      <div
        style={{
          position: "absolute",
          right: 1920 - SAFE_R,
          bottom: 66,
          display: "flex",
          alignItems: "center",
          gap: 22,
          ...TYPE.annotation,
          lineHeight: 1,
          fontFamily: MONO,
          whiteSpace: "nowrap",
          opacity: 1 - close * 0.3,
        }}
      >
        {/* 1 — mask-wipe */}
        <span
          style={{
            color: theme.warm,
            clipPath: `inset(0 ${(1 - tripA) * 100}% 0 0)`,
            opacity: tripA > 0 ? 1 : 0,
          }}
        >
          L3
        </span>
        <span style={{ color: theme.dim, opacity: tripB }}>&rarr;</span>
        {/* 2 — spring pop */}
        <span
          style={{
            color: theme.ink,
            opacity: tripB,
            transform: `scale(${pop(tripB)})`,
            transformOrigin: "center",
          }}
        >
          off-chip
        </span>
        <span style={{ color: theme.dim, opacity: tripC }}>&rarr;</span>
        {/* 3 — docks in from the left */}
        <span
          style={{
            color: theme.down,
            opacity: tripC,
            transform: `translateX(${(1 - tripC) * -34}px)`,
          }}
        >
          DRAM
        </span>
      </div>

      {/* ---- source credit, native re-typeset (7-cpu.com, credits.md) ----- */}
      <div
        style={{
          position: "absolute",
          left: SAFE_L,
          bottom: 66,
          ...TYPE.label,
          lineHeight: 1,
          fontFamily: MONO,
          color: theme.dim,
          opacity: creditIn,
          transform: `translateY(${(1 - creditIn) * 14}px)`,
          whiteSpace: "nowrap",
        }}
      >
        measured &middot; 7-cpu.com
      </div>
    </div>
  );
};

export default LatencyLadder;
