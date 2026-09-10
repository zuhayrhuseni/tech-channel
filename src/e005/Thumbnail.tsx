/* ==========================================================================
 * ep005 THUMBNAIL — rendered as a Remotion Still from the same design tokens
 * as the episode (PLAYBOOK #10), never drawn by hand in an image editor.
 *
 * THE SPEC IT IMPLEMENTS (script.yaml lines 14-17, verbatim intent):
 *   dark background, ONE focal object — a tiny green bar next to a towering
 *   red bar, labeled "9" and "450", with a small "cycles / element" caption.
 *   Three tokens on the image: 9 · vs · 450. It does NOT repeat the title
 *   (the title says "90x"; the thumbnail says "9 vs 450") — that is the
 *   1+1=3 rule: title states the concept, thumbnail carries the surprise.
 *
 * WHY THE GREEN BAR IS A SLIVER AND THAT IS CORRECT. The bars are drawn to
 * TRUE scale: 9 and 450 cycles/element from SOURCE [5] (Drepper §3.3.2), a
 * 1:50 ratio. At BAR_H 700 the green bar is 14px tall. That is not a
 * rendering bug to "fix" by fudging the scale — the whole episode argues that
 * the gap is bigger than anyone's intuition, so a thumbnail that softened the
 * ratio to make the green bar look like a bar would be lying about the thesis
 * to look tidier. It reads as a bright line at the baseline, which is the
 * point.
 *
 * SQUINT TEST (faceless-playbook): legible at 25% = 480x270. The number tier
 * is deliberately ONE STEP ABOVE the in-video `display` token — see NUM below
 * — because a thumbnail is judged shrunk and surrounded by competitors, not
 * full-frame. Everything else spreads tokens unmodified.
 *
 * BOTTOM-RIGHT 15% IS KEPT EMPTY for YouTube's runtime badge. The caption is
 * therefore bottom-LEFT, not centered under the bars.
 * ======================================================================== */
import { AbsoluteFill } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { theme, TYPE } from "../components/theme";

const inter = loadInter("normal", {
  weights: ["400", "800", "900"],
  subsets: ["latin"],
});
const mono = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
const SANS = inter.fontFamily;
const MONO = mono.fontFamily;

/** The two measurements the image is about. Sourced, not invented. */
const SEQ = 9;
const RAND = 450;

/* Geometry. One baseline, two bars, true scale.
 *
 * R12 BUG FIX — the previous layout put each number in a box at
 * `BASE_Y - BAR_H - NUM * 1.02`. For the tall bar that is 872 - 700 - 261 =
 * **-89**, i.e. "450" was positioned off the top of the frame and rendered
 * clipped through the middle of the digits. It had never been looked at.
 * Stacking a 256px number ON TOP OF a 700px bar cannot fit in 1080px with a 6%
 * safe margin — 700 + 261 + 2 x 65 = 1091 > 1080 — so the tall bar's label now
 * sits BESIDE its top edge instead of above it, which also fills the dead right
 * third the old layout left black. The short bar keeps its label above, where
 * there is 600px of empty column and no fit problem.
 *
 * Safe area: 6% = 115px left/right, 65px top/bottom. Bottom-right 15%
 * (x > 1632, y > 918) stays empty for YouTube's runtime badge — checked below.
 */
const BASE_Y = 902; // baseline both bars stand on
const BAR_H = 700; // height of the TALL bar; the short one derives from it
const BAR_W = 300;
const SEQ_H = Math.max(10, Math.round((BAR_H * SEQ) / RAND)); // 14px — true 1:50
const GREEN_X = 300;
const RED_X = 1200; // right edge 1500, clear of the 1805 margin and the badge

/**
 * Thumbnail number tier: 2x the in-video `display` token. Derived from the
 * token rather than typed so a palette/scale change still propagates, and
 * justified above — a still judged at 25% in a crowded grid needs a bigger
 * top end than a full-frame video headline does.
 */
const NUM = TYPE.display.fontSize * 2;

export const E005Thumbnail: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: SANS }}>
      {/* Baseline. The only chrome in the image — it exists so the sliver
          reads as "a bar that is almost nothing" rather than as a stray line. */}
      <div
        style={{
          position: "absolute",
          left: GREEN_X - 60,
          top: BASE_Y,
          width: RED_X + BAR_W + 60 - (GREEN_X - 60),
          height: 4,
          backgroundColor: theme.stroke,
        }}
      />

      {/* GREEN — sequential layout, 9 cycles/element. */}
      <div
        style={{
          position: "absolute",
          left: GREEN_X,
          top: BASE_Y - SEQ_H,
          width: BAR_W,
          height: SEQ_H,
          backgroundColor: theme.up,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: GREEN_X,
          top: BASE_Y - SEQ_H - NUM * 1.02,
          width: BAR_W,
          textAlign: "center",
          color: theme.up,
          fontSize: NUM,
          fontWeight: 900,
          letterSpacing: -6,
          lineHeight: 1,
        }}
      >
        {SEQ}
      </div>

      {/* RED — random layout, 450 cycles/element. */}
      <div
        style={{
          position: "absolute",
          left: RED_X,
          top: BASE_Y - BAR_H,
          width: BAR_W,
          height: BAR_H,
          backgroundColor: theme.down,
        }}
      />
      {/* "450" sits BESIDE the tall bar's top edge, right-aligned into the gap
          between the two bars, because stacking it above would push it off the
          frame (see the geometry note). Box top 190 vs the bar top at 202, so
          the digits read as level with the top of the bar. */}
      <div
        style={{
          position: "absolute",
          left: RED_X - 660,
          top: BASE_Y - BAR_H - 12,
          width: 600,
          textAlign: "right",
          color: theme.down,
          fontSize: NUM,
          fontWeight: 900,
          // 0, not -8: at 256px Inter 900 a -8px track closed the gap between
          // the 4 and the 5 until the diagonal of the 4 touched the 5's spine.
          letterSpacing: 0,
          lineHeight: 1,
        }}
      >
        {RAND}
      </div>

      {/* "vs" — the third and last token. Deliberately small and dim: it is
          connective tissue, not a competitor for the two numbers. Parked in the
          open channel below "450" and right of the green column; it clears the
          "450" box (ends y 446) and the "9" box (ends x 600). */}
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 690,
          width: 400,
          textAlign: "center",
          color: theme.dim,
          ...TYPE.display,
          fontWeight: 800,
        }}
      >
        vs
      </div>

      {/* Unit caption. Mono, because it annotates a measurement — house rule:
          mono for annotations, heavy sans for spoken keywords. Bottom-LEFT so
          the runtime badge in the bottom-right never lands on it. */}
      <div
        style={{
          position: "absolute",
          left: GREEN_X - 60,
          top: BASE_Y + 46,
          color: theme.dim,
          fontFamily: MONO,
          ...TYPE.annotation,
        }}
      >
        cycles / element
      </div>
    </AbsoluteFill>
  );
};
