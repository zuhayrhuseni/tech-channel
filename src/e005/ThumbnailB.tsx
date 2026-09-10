/* ==========================================================================
 * ep005 THUMBNAIL — VARIANT B, "the two walks"
 *
 * This is the concept `episodes/005-cpu-waits-on-memory/packaging.md` actually
 * specifies, and it was never built: one memory grid, an ORDERED walk across
 * the left half, a SCATTERED walk across the right half, labeled 9 and 450.
 * Variant A (`Thumbnail.tsx`) implements the other sourced spec — the two
 * true-scale bars from script.yaml lines 14-17. Both carry the same two
 * numbers; they differ in what the picture is. Render both, squint at 25%,
 * pick one, and record the decision in packaging.md.
 *
 * WHY THIS ONE MIGHT WIN: it is the episode's own central image
 * (`sweep_vs_chase`) — the frame the script says *is* the episode — so it
 * pays the thumbnail off inside the video, which is the recognizability loop.
 * WHY IT MIGHT LOSE: a tangle can read as noise at 25%, where a 1:50 bar ratio
 * cannot. That is exactly what the squint render is for.
 *
 * RULES IT HOLDS TO (faceless-playbook packaging):
 *   - Does NOT repeat the title. The title asks "why 90x"; this shows 9 vs 450.
 *   - Two on-screen numbers + one unit caption. Under the 3-word ceiling.
 *   - One focal object (the grid) on a black field.
 *   - Bottom-right ~15% (x > 1632, y > 918) is empty for the runtime badge —
 *     the grid deliberately stops at y 900 so nothing enters that corner.
 *   - Drawn from `theme.ts` tokens only. No hand-picked palette.
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

/** The two measurements, from SOURCE [5] (Drepper §3.3.2). Sourced, not invented. */
const SEQ = 9;
const RAND = 450;

/* --- Grid geometry -------------------------------------------------------
 * 16 columns x 5 rows at a 100px pitch. x 160..1760 (inside the 115px safe
 * margin), y 400..900. The bottom edge at 900 clears the runtime-badge zone
 * that starts at y 918, so the grid never has to be shortened on the right.
 * The number row sits above it at y 100..356, inside the 65px top margin.
 */
const COLS = 16;
const ROWS = 5;
const PITCH = 100;
const GRID_X = 160;
const GRID_Y = 400;
const GRID_W = COLS * PITCH; // 1600
const HALF = COLS / 2; // left half = ordered walk, right half = scattered

/** Center of cell (c, r) in composition pixels. */
const cx = (c: number) => GRID_X + c * PITCH + PITCH / 2;
const cy = (r: number) => GRID_Y + r * PITCH + PITCH / 2;

/**
 * The ordered walk: a boustrophedon sweep of the left half — every cell, in
 * order, row by row. It renders as five parallel horizontals, which is what
 * "sequential" looks like from across the room.
 */
const SEQ_PATH: [number, number][] = [];
for (let r = 0; r < ROWS; r++) {
  const cs = r % 2 === 0 ? [0, HALF - 1] : [HALF - 1, 0];
  SEQ_PATH.push([cs[0], r], [cs[1], r]);
}

/**
 * The scattered walk: twelve hand-picked cells in the right half, ordered so
 * consecutive hops are long and cross each other. Hand-picked and FROZEN, not
 * generated — Math.random is unavailable in this codebase by design, and a
 * fixed tangle means the thumbnail is byte-reproducible across renders.
 */
const RAND_PATH: [number, number][] = [
  [11, 3],
  [8, 0],
  [14, 4],
  [9, 2],
  [15, 0],
  [12, 4],
  [8, 3],
  [13, 1],
  [10, 0],
  [15, 3],
  [9, 4],
  [14, 2],
];

const toPoints = (path: [number, number][]) =>
  path.map(([c, r]) => `${cx(c)},${cy(r)}`).join(" ");

/**
 * Thumbnail number tier: 2x the in-video `display` token. Derived from the
 * token so a scale change propagates. A still judged at 25% in a crowded grid
 * needs a bigger top end than a full-frame video headline does.
 */
const NUM = TYPE.display.fontSize * 2;

/** Walk stroke width. 24px = 6px at the 25% squint size — still clearly a line. */
const WALK_W = 24;

export const E005ThumbnailB: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: SANS }}>
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {/* The memory grid: one dot per cell. Dots rather than ruled lines so
            the grid stays texture and the two walks stay the subject. */}
        {Array.from({ length: ROWS }).map((_, r) =>
          Array.from({ length: COLS }).map((_, c) => (
            <circle
              key={`${c}-${r}`}
              cx={cx(c)}
              cy={cy(r)}
              r={6}
              fill={theme.stroke}
            />
          )),
        )}

        {/* ORDERED — sequential access, 9 cycles/element. */}
        <polyline
          points={toPoints(SEQ_PATH)}
          fill="none"
          stroke={theme.up}
          strokeWidth={WALK_W}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* SCATTERED — random access, 450 cycles/element. The dots mark the
            cells it actually touches, so the long hops read as jumps between
            real addresses rather than as decoration. */}
        <polyline
          points={toPoints(RAND_PATH)}
          fill="none"
          stroke={theme.down}
          strokeWidth={WALK_W}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {RAND_PATH.map(([c, r], i) => (
          <circle
            key={`hit-${i}`}
            cx={cx(c)}
            cy={cy(r)}
            r={16}
            fill={theme.down}
          />
        ))}
      </svg>

      {/* "9" — centered over the ordered half. */}
      <div
        style={{
          position: "absolute",
          left: GRID_X,
          top: 100,
          width: GRID_W / 2,
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

      {/* "450" — centered over the scattered half. letterSpacing 0, not
          negative: at 256px Inter 900 a tight track closes the gap between the
          4 and the 5 until the 4's diagonal touches the 5's spine. */}
      <div
        style={{
          position: "absolute",
          left: GRID_X + GRID_W / 2,
          top: 100,
          width: GRID_W / 2,
          textAlign: "center",
          color: theme.down,
          fontSize: NUM,
          fontWeight: 900,
          letterSpacing: 0,
          lineHeight: 1,
        }}
      >
        {RAND}
      </div>

      {/* Unit caption. Mono, because it annotates a measurement (house rule:
          mono for annotations, heavy sans for spoken keywords). Bottom-LEFT so
          the runtime badge never lands on it. */}
      <div
        style={{
          position: "absolute",
          left: GRID_X,
          top: 946,
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
