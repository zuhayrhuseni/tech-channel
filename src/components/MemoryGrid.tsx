import React from "react";
import { interpolate } from "remotion";
import { theme, TYPE } from "./theme";

export type MemoryGridMode = "idle" | "line" | "sweep" | "chase";

export interface MemoryGridProps {
  /** Which story the grid is telling right now. */
  mode: MemoryGridMode;
  /**
   * 0..1 progress WITHIN the current mode. Deliberately not a frame count:
   * every timing in this episode comes from timing.json marks, which don't
   * exist until narration is generated. The caller maps frames -> progress, so
   * this component can be built, reviewed and unit-checked before a single
   * second of audio exists, and re-timed afterwards without being rewritten.
   */
  progress: number;
  /** Cache lines down the screen. Each row IS one 64-byte line. */
  rows?: number;
  /** Cells drawn per line. 8 cells x 8 bytes = the 64 bytes we narrate. */
  cols?: number;
  /** For `line` mode: which cell the CPU actually asked for. */
  requestedCell?: number;
  /** Scatter pattern for `chase`. Fixed default so renders are deterministic. */
  seed?: number;
  /** Show the prefetcher locking on during `sweep`. */
  showPrefetch?: boolean;
  /**
   * The scale this component is being rendered AT by its parent (camera zoom x
   * transform). The cost readout counter-scales by it so the line lands at
   * exactly TYPE.annotation (56px = 40.9px cap, the mono floor) ON SCREEN,
   * whatever the consumer's coordinate space. 1 = drawn 1:1.
   */
  readoutScale?: number;
  /**
   * Grid-local px between the grid's bottom edge and the readout's line box.
   * Consumers own their own vertical budget: at the floor the line is ~1 em
   * tall in grid-local units, which is 2.2x what it was at 26px, so a fixed
   * gap would push it into whatever the consumer parks under the grid.
   */
  readoutGap?: number;
  /**
   * Face for the readout. It is a machine readout and must be mono; the
   * consumer passes its own loaded family so the width math here (JetBrains
   * Mono's advance is exactly 0.6em) is not at the mercy of inheritance.
   */
  readoutFont?: string;
}

const CELL = 46;
const GAP = 5;
const LINE_GAP = 16;

// Deterministic pseudo-random in [0,1). Remotion renders each frame in its own
// process, so Math.random() would make the scatter flicker frame to frame — and
// workflow scripts ban it outright for the same reason. This is stable for a
// given (i, seed) forever, which is what object constancy requires.
function hash01(i: number, seed: number): number {
  let x = Math.imul(i ^ seed, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

// The order the chase visits CELLS: a fixed shuffle, so "scattered" looks
// genuinely scattered but is identical on every render.
function chaseOrder(n: number, seed: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
    .map((i) => ({ i, k: hash01(i, seed) }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.i);
}

/**
 * The episode's central picture: memory as a grid, one row per 64-byte cache
 * line. `cache_line` establishes it, `sweep_vs_chase` reuses the SAME grid so
 * the array walk and the pointer chase are visibly the same space — the script
 * calls for transforms over add/remove, and a shared coordinate space is what
 * makes that possible.
 */
export const MemoryGrid: React.FC<MemoryGridProps> = ({
  mode,
  progress,
  rows = 8,
  cols = 8,
  requestedCell = 19,
  seed = 7,
  showPrefetch = true,
  readoutScale = 1,
  readoutGap = 26,
  readoutFont = "inherit",
}) => {
  const p = Math.max(0, Math.min(1, progress));
  const total = rows * cols;
  const reqRow = Math.floor(requestedCell / cols);

  /* --- what's "live" this frame, per mode --------------------------------
   *
   * ROUND 13 | THESE USED TO BE ONE SET AND THAT INVERTED THE EPISODE.
   *
   * `loadedLines` answers "which grid ROWS do I paint as arrived?" — it is a
   * rendering detail, keyed by row because a row IS how this widget draws a
   * line. `linesPaid` answers "how many cache lines did this access pattern
   * actually buy?" — it is the economic claim the readout prints, and it is
   * the entire argument of the episode.
   *
   * In `line` and `sweep` those two happen to coincide, so one Set served both
   * and nobody noticed. In `chase` they diverge hard: the old code did
   *
   *     loadedLines.add(Math.floor(order[k] / cols));   // cell -> its row
   *
   * which collapses every chased cell onto one of only `rows` (= 8) buckets.
   * `loadedLines.size` therefore SATURATED AT 8 after ~24 hops, and the panel
   * printed "26 read · 8 lines" for the chase beside "64 read · 8 lines" for
   * the sweep — i.e. it told the viewer that the pointer chase and the array
   * sweep cost exactly the same. That is the opposite of the narration ("every
   * read that lands in a cold line pays full price"), the opposite of the
   * comment in the chase branch below, and it was on screen for ~10s during
   * the beat the script calls "the entire episode".
   *
   * The grid is a WINDOW onto memory, not the whole address space. The chased
   * nodes are scattered far outside it, so each hop lands in its own cold
   * line — the count is the number of hops, and it is not bounded by `rows`.
   * Splitting the two roles lets the row highlight stay row-keyed (correct for
   * drawing) while the counter reaches 64 for the chase and stays at 8 for the
   * sweep. That 8:1 is the number the whole episode is arguing about.
   */
  const loadedLines = new Set<number>();
  const prefetchedLines = new Set<number>();
  let linesPaid = 0;
  let cursor = -1;

  if (mode === "line") {
    // Ask for one byte; the whole line around it arrives. The reveal is staged:
    // first the single cell, then the line it belongs to.
    cursor = requestedCell;
    if (p > 0.45) {
      loadedLines.add(reqRow);
      linesPaid = 1; // one byte asked for, exactly one line paid for
    }
  } else if (mode === "sweep") {
    // Walk front to back. Every 8th cell crosses into a new line and pays once;
    // the other 7 are free — that's the whole argument for locality.
    const idx = Math.floor(p * total);
    cursor = Math.min(idx, total - 1);
    const upto = Math.floor(cursor / cols);
    for (let r = 0; r <= upto; r++) loadedLines.add(r);
    // Sequential: a new line is crossed every `cols` cells and the other
    // cols-1 reads ride along free. Rows and lines coincide here, so this is
    // the same number the old shared Set produced — the sweep panel is
    // unchanged by the round-13 split.
    linesPaid = upto + 1;
    // The prefetcher needs a couple of lines of evidence before it locks on.
    if (showPrefetch && upto >= 2) {
      for (let r = upto + 1; r <= Math.min(upto + 2, rows - 1); r++)
        prefetchedLines.add(r);
    }
  } else if (mode === "chase") {
    // The SAME number of element reads as the sweep, in arbitrary order —
    // that equality is the entire argument, so both modes must step over the
    // same denominator. Nothing can be fetched ahead, because the address of
    // the next node lives inside the node you haven't read yet, so every read
    // that lands in a cold line pays full price.
    const order = chaseOrder(total, seed);
    const idx = Math.floor(p * total);
    const upto = Math.min(idx, total - 1);
    // Row highlight: which rows of the visible window have been touched. This
    // one IS legitimately row-keyed — it decides what to paint, and a row is
    // how this widget draws a line. It saturates at `rows`, which is fine and
    // expected for a highlight.
    for (let k = 0; k <= upto; k++)
      loadedLines.add(Math.floor(order[k] / cols));
    // The cost, which is NOT row-keyed. The nodes are scattered across an
    // address space far larger than this window, so nothing can be fetched
    // ahead — the address of the next node lives inside the node you haven't
    // read yet. Every hop is a cold line at full price: hops, not rows.
    linesPaid = upto + 1;
    cursor = order[upto];
  }

  // Elements actually read so far — the honest denominator for "what did that
  // cost?". Without showing this next to the line count, the two panels read as
  // equally expensive at the same progress, which inverts the episode's point.
  const elementsRead =
    mode === "sweep" || mode === "chase"
      ? Math.min(Math.floor(p * total) + 1, total)
      : 0;

  const gridW = cols * CELL + (cols - 1) * GAP;
  const gridH = rows * CELL + (rows - 1) * LINE_GAP;

  return (
    <div
      style={{
        position: "relative",
        width: gridW,
        height: gridH,
        fontFamily: "inherit",
      }}
    >
      {Array.from({ length: rows }).map((_, r) => {
        const loaded = loadedLines.has(r);
        const prefetched = prefetchedLines.has(r);
        // A line that just arrived lifts slightly — motion carries the "this
        // came back as one unit" idea better than a colour change alone.
        const lift = loaded ? 1 : 0;
        return (
          <div
            key={r}
            style={{
              position: "absolute",
              top: r * (CELL + LINE_GAP),
              left: 0,
              width: gridW,
              height: CELL,
              transform: `translateY(${-lift * 3}px)`,
            }}
          >
            {/* The line container: what memory actually hands over. */}
            <div
              style={{
                position: "absolute",
                inset: `-6px -10px`,
                borderRadius: 8,
                border: `1px solid ${
                  loaded
                    ? theme.accent
                    : prefetched
                      ? theme.warm
                      : "transparent"
                }`,
                // The row wash GROUPS; the border (8.3:1 accent / 10.8:1 warm)
                // is what announces arrival, and the cells below carry the
                // pixel change. So this stays modest on purpose — but not as
                // modest as it was. At accent @0.10 it measured 1.10:1 against
                // pure black, i.e. not there at all. 0.20 = 1.29:1: still a
                // wash, now actually a wash.
                background: loaded
                  ? // contrast-exempt: grouping wash under the cells, 1.29:1.
                    // Arrival is announced by this row's 8.31:1 accent border
                    // and by the cells jumping to 3.09:1; the wash only has to
                    // say "these eight belong together".
                    "rgba(88, 166, 255, 0.20)"
                  : prefetched
                    ? // contrast-exempt: same grouping role, 1.20:1, under a
                      // 10.79:1 warm border. Speculative lines are deliberately
                      // quieter than fetched ones — that IS the distinction.
                      "rgba(227, 179, 65, 0.14)"
                    : "transparent",
                opacity: loaded || prefetched ? 1 : 0,
              }}
            />
            {Array.from({ length: cols }).map((__, c) => {
              const idx = r * cols + c;
              const isCursor = idx === cursor;
              const isRequested = mode === "line" && idx === requestedCell;
              // In sweep, cells already passed read as "used what we paid for".
              const consumed = mode === "sweep" && idx <= cursor;
              return (
                <div
                  key={c}
                  style={{
                    position: "absolute",
                    left: c * (CELL + GAP),
                    top: 0,
                    width: CELL,
                    height: CELL,
                    borderRadius: 4,
                    border: `1px solid ${isCursor ? theme.ink : theme.stroke}`,
                    // THE CELL INTERIORS ARE THE PICTURE. 64 of them, 46px
                    // square — they own nearly all the changing pixels in this
                    // component, so their contrast decides both whether a
                    // viewer sees "the line arrived" and whether the pacing
                    // detector scores it as an event at all.
                    //
                    // They were failing both. Measured against pure black:
                    //     loaded   accent @0.18 -> 1.25:1
                    //     consumed green  @0.22 -> 1.34:1
                    // against an idle border that now sits at 3.09:1 — the
                    // filled state was DIMMER than the empty one's outline.
                    // Worse, idle -> loaded moved luma by 28, and the detector
                    // gates at 25, so whether the beat's central reveal counted
                    // was decided by three levels of noise.
                    //
                    // Re-derived so the ladder climbs monotonically with how
                    // much you've paid:
                    //                              over black | over row wash
                    //     idle       transparent       1.00:1    (border 3.09)
                    //     loaded     accent @0.56      3.09:1  |  3.85:1
                    //     consumed   green  @0.86      6.21:1  |  6.57:1
                    //     requested  accent solid      8.31:1
                    //     cursor     ink solid        17.77:1
                    //
                    // Each rung clears the floor OVER PURE BLACK, not merely
                    // over the wash beneath it. A loaded cell does always sit
                    // on the loaded wash today (both keys off the same `loaded`
                    // flag), so the weaker alphas this started with would have
                    // looked fine — but that is a coupling between two
                    // independent branches, and the first edit that fills a
                    // cell without its row would drop it back under the floor
                    // silently. Costing every layer alone removes the trap.
                    //
                    // idle -> loaded is now dY 96 (was 28, three levels off the
                    // detector's dY>=25 gate). loaded -> consumed is dY 34,
                    // which matters because in `sweep` that IS the per-frame
                    // motion as the cursor eats along a line: at the old values
                    // those two states differed by dY 10 — hue only — so the
                    // "you paid once and got 7 free reads" argument, which is
                    // the whole beat, was invisible to the detector and nearly
                    // so to the eye.
                    background: isCursor
                      ? theme.ink
                      : isRequested
                        ? theme.accent
                        : consumed
                          ? "rgba(63, 185, 80, 0.86)"
                          : loaded
                            ? "rgba(88, 166, 255, 0.56)"
                            : "transparent",
                    boxShadow: isCursor ? `0 0 18px ${theme.ink}55` : "none",
                  }}
                />
              );
            })}
          </div>
        );
      })}

      {/* Cost readout — the point of the whole picture. Counts LINES fetched,
          not cells read, because lines are what you actually pay for.

          It used to be set at a hard-coded 26px: 19px of cap height, less than
          half the 40px floor, in the one element that carries the beat's whole
          quantitative argument. It is now TYPE.annotation (56px = 40.9px cap,
          the mono floor) counter-scaled by whatever the consumer draws this
          component at, so it measures 56px ON SCREEN in every lane.

          The string had to come down to pay for that. "N read · M lines
          fetched · prefetcher locked on" is 45 characters; at 0.6em advance
          that is 1585px at the floor, which breaches both consumers' boxes.
          "fetched" is redundant next to "lines" (nothing else happens to a
          line here) and "prefetcher locked on" says in three words what the
          warm colour already says — so 45 chars becomes 27, and 1585px
          becomes 818px. The separator margins came 10 -> 6 for the same
          reason: at this size they were reading as gaps, not punctuation. */}
      {(mode === "sweep" || mode === "chase") && (
        <div
          style={{
            position: "absolute",
            top: gridH + readoutGap,
            left: 0,
            color: theme.dim,
            fontFamily: readoutFont,
            fontSize: TYPE.annotation.fontSize / readoutScale,
            // Pinned to 1, not TYPE.annotation's 1.4: this is a single line
            // parked in a consumer-owned band, and 0.4em of leading it cannot
            // use is 0.4em it steals from whatever sits below the grid.
            lineHeight: 1,
            fontWeight: TYPE.annotation.fontWeight,
            letterSpacing: TYPE.annotation.letterSpacing,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: theme.ink }}>{elementsRead}</span> read
          <span style={{ margin: "0 6px", color: theme.stroke }}>·</span>
          {/* `linesPaid`, NOT `loadedLines.size` — see the round-13 note where
              the two are derived. `loadedLines` is row-keyed and saturates at
              `rows`, so printing its size claimed the chase and the sweep cost
              the same. Pluralization is conditional because the ending scene
              renders this at 1, and "1 lines" reads as a bug on a still.

              WIDTH CHECKED, not assumed: the chase readout's widest state
              grows from "64 read · 8 lines" (17ch) to "64 read · 64 lines"
              (18ch). SweepVsChase derives READOUT_W = 818 from the 27-char
              sweep string "64 read · 8 lines · prefetch on", so 18ch stays
              far inside the budget — nothing reflows or scissors. */}
          <span style={{ color: mode === "chase" ? theme.down : theme.up }}>
            {linesPaid}
          </span>{" "}
          {linesPaid === 1 ? "line" : "lines"}
          {mode === "sweep" && prefetchedLines.size > 0 && (
            <>
              <span style={{ margin: "0 6px", color: theme.stroke }}>·</span>
              <span style={{ color: theme.warm }}>prefetch on</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/** Opacity helper for docking the grid down as a small persistent reference. */
export function gridDockScale(progress: number): number {
  return interpolate(progress, [0, 1], [1, 0.42], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
