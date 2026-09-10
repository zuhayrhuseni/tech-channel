/**
 * Shared geometry for the episode's two linked charts.
 *
 * `drepper_experiment` (beat 9) ends with two bars — 9 and 450 cycles — and
 * `modern_replication` (beat 10) opens by COMPRESSING those same two bars to
 * the left rather than deleting them and popping a new chart in. That is a
 * house rule ("transforms over add/remove", object constancy), and it only
 * actually reads as a transform if the bars start beat 10 exactly where they
 * finished beat 9.
 *
 * Hand-tuning those coordinates in two files is how that silently breaks: one
 * gets nudged, the "morph" becomes a jump cut, and nothing fails loudly. So
 * both components import from here instead. Change a number and both move.
 */

/** Height of the plot area, baseline to axis top. */
export const PLOT_H = 430;

/** Y of the shared baseline. Set so the group sits near the vertical centre. */
export const BASELINE = 715;

/** Horizontal pitch between bar centres. Sized to clear the widest sub-label. */
export const SLOT = 165;

export const BAR_W = 92;

/** Left edge of the 2007 bar group BEFORE beat 10 compresses it. */
export const DREPPER_LEFT = 660;

/** Left edge it compresses TO, where it lives as a dimmed reference. */
export const DREPPER_COMPRESSED_LEFT = 210;

/** Scale the compressed group shrinks to. */
export const DREPPER_COMPRESSED_SCALE = 0.52;

/**
 * Opacity beat 9 ENDS on, after `same_on_stamp` dims the chart behind the
 * stamp. Beat 10 must open the same bars at this value and dim further from
 * there — opening at full brightness would flash on the cut and give away that
 * these are two components, not one continuous object.
 *
 * BOTH OF THESE ARE DELIBERATELY BELOW THE 3:1 IDLE FLOOR, and that is the
 * point of them. Measured over pure black:
 *
 *            ink   dim   warm  accent  stroke
 *     0.42   3.50  1.95  2.52   2.16    1.39
 *     0.38   3.03  1.79  2.24   1.95    1.33
 *
 * The r8 contrast pass flagged this as dropping the chart core to 1.5–2.2:1 for
 * the last 252 frames of the beat and escalated it rather than changing it,
 * which was right. It is not idle structure that failed to clear a floor; it is
 * a READ ELEMENT BEING RETIRED. By then the chart has been read, the stamp owns
 * the frame, and in beat 10 the 2007 group is a ghost the viewer compares the
 * SHAPE of — the narration there says "the gap got wider", and never asks
 * anyone to read "9" or "450" off it. Raising it to 3:1 would put the retired
 * chart in direct competition with the new numbers it exists to be smaller
 * than, which inverts the thing the floor protects. Same verdict, same reason,
 * as LatencyLadder's band tint and HiddenAssumption's frozen chip.
 *
 * THE RULE THIS IMPLIES: anything that must still be legible through the
 * recede has to be `theme.ink`, which is the only token that survives (3.50:1
 * / 3.03:1). Everything in the ghost group is currently accent/down/stroke
 * chrome, so nothing depends on it — but a future pass that adds a label here
 * and reaches for `theme.dim` (1.79:1) will have written something invisible.
 */
export const DREPPER_STAMP_DIM = 0.42;

/** Opacity the compressed reference settles at once beat 10 owns the frame. */
export const DREPPER_REFERENCE_DIM = 0.38;

/** Size of the big value labels above the bars, shared so the morph matches. */
export const VALUE_FONT_SIZE = 52;

/**
 * Y-axis top after the mid-rise rescale, in cycles/element. Both charts must
 * agree: this is the scale the 9-cycle bar is a sliver against, and beat 10
 * inherits that sliver unchanged.
 */
export const CYCLES_AXIS_TOP = 500;

/* ---- RESERVED LANES ------------------------------------------------------
   Additive; RatioMorph does not read these, so the beat-9 -> beat-10 morph is
   unaffected. They exist because a caption was hand-placed at the sequential
   bar's value label and the two overprinted into `stil9 9` for 22 seconds.

   A bar VALUE label is exactly BAR_W wide, centred on its bar, and a bar only
   ever sits in slot 0 or slot 1 — so in chart-group x the labels can never
   leave [VALUE_LANE_LEFT, VALUE_LANE_RIGHT]. And a value label always sits
   ABOVE the baseline (its bottom edge is BASELINE - barHeight - 12, and
   barHeight >= 2). Those two facts hold at EVERY animation progress and at any
   axis scale, which is what makes the caption lane below provably disjoint. */

/** Leftmost x, in chart-group coords, a bar value label can occupy. */
export const VALUE_LANE_LEFT = 0;
/** Rightmost x, in chart-group coords, a bar value label can occupy. */
export const VALUE_LANE_RIGHT = SLOT + BAR_W;

/**
 * Reserved lane for a caption that annotates a bar, in ABSOLUTE page coords.
 * Both conditions for disjointness are met, with margin:
 *   x: 150..390, which ends 270px left of the value column (DREPPER_LEFT+0);
 *      it also clears the rotated axis label at x400-470.
 *   y: BASELINE+16 .. +72, i.e. entirely BELOW the baseline, where no value
 *      label can ever reach. Aligned with the bar sub-labels' row, clear of
 *      the docked MiniRow stack (bottom y707) and the caveat band (top y812).
 * 240px holds 7 mono chars at the 56px floor (7 x 33.6 = 235.2).
 */
export const CAPTION_LANE_X = 150;
export const CAPTION_LANE_W = 240;
export const CAPTION_LANE_Y = BASELINE + 16;
export const CAPTION_LANE_H = 56;

/** The two measured values from SOURCE [5] §3.3.2, in cycles per element. */
export const SEQ_CYCLES = 9;
export const RANDOM_CYCLES = 450;
