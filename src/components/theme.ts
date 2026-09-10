// Channel palette + typography scale + motion constants.
// Every component draws from here so the look stays uniform across videos.

/* ==========================================================================
 * TYPOGRAPHY
 *
 * WHY THIS EXISTS: with no scale, all 15 scenes hand-picked font sizes and
 * they drifted small — a round-2 render measured 67% of on-screen text bands
 * under the readability floor (median band 30px, worst 4px held 14.5s).
 * Never hand-pick a font size again; spread a token.
 *
 * THE FLOOR IS 40px CAP HEIGHT at 1920x1080, because the video is watched on
 * a phone. Cap height, NOT font-size — a 40px font-size renders ~28px of
 * actual letter and fails.
 *
 *   cap height = fontSize x CAP_RATIO
 *   sans (Inter-class UI/heading faces): CAP_RATIO ~ 0.70
 *   mono (JetBrains Mono):               CAP_RATIO ~ 0.73
 *
 * So a 40px cap floor = 58px sans font-size / 56px mono font-size.
 *
 * EVERY `fontSize` BELOW IS A FONT-SIZE IN px (not a cap height). The cap
 * height each one yields is written in the comment beside it. The smallest
 * token in the scale sits ON the floor; there is deliberately NO "small",
 * "caption", or "footnote" tier. If a string is too unimportant to render at
 * the floor, it does not belong on screen — cut it, don't shrink it.
 * ======================================================================== */

/** Readability floor, in CAP HEIGHT px at 1080p. Not a font-size. */
export const CAP_FLOOR_PX = 40;

/** Cap-height-to-font-size ratios for the two families in the system. */
export const SANS_CAP_RATIO = 0.7;
export const MONO_CAP_RATIO = 0.73;

/** font-size needed to hit a given CAP HEIGHT. capToFontSize(40) => 58 sans. */
export const capToFontSize = (capPx: number, ratio: number = SANS_CAP_RATIO) =>
  Math.ceil(capPx / ratio);

/** The cap height a given font-size actually renders. Inverse of the above. */
export const fontSizeToCap = (
  fontSizePx: number,
  ratio: number = SANS_CAP_RATIO,
) => fontSizePx * ratio;

/** Minimum legal font-size per family. Clamp against these, never below. */
export const MIN_SANS_FONT_SIZE = 58; // cap 40.6px — ON the floor
export const MIN_MONO_FONT_SIZE = 56; // cap 40.9px — ON the floor

/**
 * The scale. Tokens are spreadable CSS fragments:
 *
 *   <div style={{ ...TYPE.keyword, color: theme.ink }}>PREFETCH</div>
 *
 * or pull the number: `fontSize: TYPE.body.fontSize`.
 * Also reachable as `theme.type.*` for scenes that only import `theme`.
 */
export const TYPE = {
  /** 128px font-size = 90px cap. Full-frame title / ending thesis headline. One line, owns the frame. */
  display: {
    fontSize: 128,
    lineHeight: 1.06,
    fontWeight: 800,
    letterSpacing: -2.5,
  },
  /** 96px font-size = 67px cap. The big spoken-word moment; docks down to `label` after. */
  keyword: {
    fontSize: 96,
    lineHeight: 1.08,
    fontWeight: 800,
    letterSpacing: -1.6,
  },
  /** 76px font-size = 53px cap. Section / scene headline sitting above content. */
  headline: {
    fontSize: 76,
    lineHeight: 1.14,
    fontWeight: 700,
    letterSpacing: -1,
  },
  /** 64px font-size = 45px cap. Sentences, list items, chart values, callouts. */
  body: {
    fontSize: 64,
    lineHeight: 1.26,
    fontWeight: 500,
    letterSpacing: -0.3,
  },
  /**
   * 58px font-size = 40.6px cap. THE FLOOR (sans). Docked keywords, chips,
   * axis labels, source captions, legends. Nothing sans goes below this.
   */
  label: {
    fontSize: 58,
    lineHeight: 1.2,
    fontWeight: 600,
    letterSpacing: 0,
  },
  /** 68px font-size = 49.6px cap. Mono. Code panels, terminal output, receipts. */
  code: {
    fontSize: 68,
    lineHeight: 1.42,
    fontWeight: 400,
    letterSpacing: 0,
  },
  /**
   * 56px font-size = 40.9px cap. THE FLOOR (mono). Annotations, units,
   * measurement chips, receipt bodies. Nothing mono goes below this.
   */
  annotation: {
    fontSize: 56,
    lineHeight: 1.4,
    fontWeight: 400,
    letterSpacing: 0.2,
  },
} as const;

export type TypeToken = keyof typeof TYPE;

/**
 * Dev guard: clamps to the floor instead of letting a scene shrink to fit.
 * If your content doesn't fit at the floor, crop the content or widen the
 * container — shrinking is the bug this scale exists to kill.
 */
export const clampFontSize = (
  fontSizePx: number,
  family: "sans" | "mono" = "sans",
) => {
  const floor = family === "mono" ? MIN_MONO_FONT_SIZE : MIN_SANS_FONT_SIZE;
  return Math.max(floor, Math.round(fontSizePx));
};

/* ==========================================================================
 * PALETTE — dark, one accent, semantic green/red for data lines.
 * ======================================================================== */
export const theme = {
  bg: "#000000", // pure black (creator call) — NOT the old dark-blue #0D1117
  ink: "#E6EDF3",
  dim: "#8B949E",
  /**
   * Structure lines: panel borders, axes, dividers, unfilled geometry.
   *
   * Was #30363D, which measures 1.72:1 against pure black — below the 3:1
   * floor, i.e. invisible on a phone until something fills it. See the
   * CONTRAST FLOOR section below for why that single fact caused a whole
   * render round to be misdiagnosed. #525C68 keeps the same blue-grey hue at
   * 3.09:1.
   */
  stroke: "#525C68",
  /**
   * The OLD stroke value, kept for genuinely decorative hairlines that sit
   * BEHIND content and are never the thing a viewer is asked to look at
   * (background rules, ambient lattice). If unfilled geometry has to READ —
   * a grid cell, a rung bar, a ledger row — it must use `stroke`, not this.
   */
  hairline: "#30363D",
  accent: "#58A6FF",
  warm: "#E3B341",
  up: "#3FB950",
  down: "#F85149",
  panel: "rgba(14, 14, 16, 0.72)", // neutral dark card, not blue-tinted
  /** The typography scale, mirrored so `import { theme }` alone is enough. */
  type: TYPE,
} as const;

/* ==========================================================================
 * MOTION
 * ======================================================================== */

/**
 * Entrance duration band, in frames at 30fps. House rule (PRODUCTION-LESSONS):
 * snappy entrances are 6-9 frames. 15-20 frames reads sleepy — that slowness
 * was the #1 slop tell. Never ramp an entrance outside this band.
 */
export const ENTRANCE_MIN_FRAMES = 6; // 200ms — floor
export const ENTRANCE_MAX_FRAMES = 9; // 300ms — ceiling

/** Clamp any hand-chosen entrance length into the legal band. */
export const clampEntranceFrames = (frames: number) =>
  Math.min(
    ENTRANCE_MAX_FRAMES,
    Math.max(ENTRANCE_MIN_FRAMES, Math.round(frames)),
  );

/** Exits are faster than entrances: ~200ms ease-in. */
export const EXIT_FRAMES = 6;

// Default entrance ramp = the ceiling of the band (300ms ease-out at 30fps).
// Research-backed band for element reveals is 200-400ms; linear reads mechanical.
export const REVEAL_FRAMES = ENTRANCE_MAX_FRAMES;

/* ==========================================================================
 * INK BUDGET — how BIG a sub-reveal has to be to read as motion.
 *
 * This is the r6b lesson and it cost a whole render cycle to learn. That round
 * measured 35.3 content events per 10s (7x the 5.0 floor) and STILL logged 30
 * static holds over 3s across 20.2% of the runtime. Those two numbers are not
 * in conflict: the reveals were all there, all authored correctly, all landing
 * on time — they were just too SMALL to see.
 *
 * The measured split, from the r6b grade:
 *   - median sub-reveal inside a flagged hold repainted 0.30% of frame
 *   - the two reveals that unambiguously registered were 2.07% and 2.70%
 *   - the detector's floor (|dY| >= 25 luma over >= 0.3% of frame at 240x135)
 *     sits at the BOTTOM of that range
 *
 * So the automated gate and the human eye disagree by nearly an order of
 * magnitude, and the gate is the wrong one to design against. 0.3% is the
 * DETECTION threshold — enough for a script to prove something changed. ~2.0%
 * is the PERCEPTUAL threshold — enough for a viewer watching at speed to
 * notice without looking for it. Passing the former while missing the latter
 * produces exactly what shipped in r6b: a technically busy, visibly dead frame.
 *
 * The corollary matters more than the number: when a beat reads static, the fix
 * is almost never MORE reveals. Adding a fourth 0.3% flicker to a beat that
 * already has three buys nothing but clutter. Make the reveals you already have
 * about 5x larger.
 *
 * Practical shapes that clear the budget (at 1920x1080):
 *   - a full-height axis wipe, ~100 x 150px at 960-wide proxy scale
 *   - type at the 58px sans / 56px mono floor, full-bleed rather than
 *     column-width
 *   - a row of 20px chips spanning the frame, not 10px chips spanning a third
 * Shapes that never clear it: a 199px axis relabel, a 70x22px chip, an 8px
 * byline, a single word swapped inside an existing block.
 * ======================================================================== */

/** Canvas area in px^2. Every fraction below is a share of this. */
export const CANVAS_AREA = 1920 * 1080;

/**
 * Hard floor for a staged sub-reveal, as a fraction of frame area. Below this
 * a reveal may satisfy the grader's detector and still be invisible; treat a
 * sub-reveal under this size as not existing when you count events in a beat.
 */
export const REVEAL_INK_MIN_FRACTION = 0.015;

/** What to aim for. The r6b reveals that actually registered were 2.0-2.7%. */
export const REVEAL_INK_TARGET_FRACTION = 0.02;

/** The floor and target expressed in px^2, for sizing an element directly. */
export const REVEAL_INK_MIN_PX = CANVAS_AREA * REVEAL_INK_MIN_FRACTION; // ~31,100
export const REVEAL_INK_TARGET_PX = CANVAS_AREA * REVEAL_INK_TARGET_FRACTION; // ~41,500

/**
 * Does an element of this bounding box clear the ink floor? Bounding box, not
 * glyph coverage — a text block's box is the right unit because the eye tracks
 * the block arriving, not the strokes.
 *
 * Use it as a design-time check while sizing a reveal, not as a runtime assert:
 * a reveal can legitimately fall short if it fires in the same frame as a
 * sibling and the two together clear the floor.
 */
export const clearsInkFloor = (widthPx: number, heightPx: number) =>
  widthPx * heightPx >= REVEAL_INK_MIN_PX;

/**
 * The smallest square that clears the floor: ~176px a side. Handy sanity check
 * — if a reveal is smaller than a 176x176 patch and nothing else moves with it,
 * the beat will grade as a static hold no matter how correct its timing is.
 */
export const REVEAL_INK_MIN_SIDE = Math.round(Math.sqrt(REVEAL_INK_MIN_PX));

/* ==========================================================================
 * CONTRAST FLOOR — how BRIGHT idle structure has to be to exist at all.
 *
 * READ THIS BEFORE ENLARGING ANYTHING. The INK BUDGET section above says a
 * reveal that repaints too little area is invisible. That is true, and it is
 * ALSO not what was wrong with ep005. Round 7 acted on the ink budget alone —
 * it enlarged ~30 reveals across 8 scenes — and moved the median event ink
 * from 0.80% to 0.81% of frame. A null result.
 *
 * The r7 grade found the actual cause by measuring pixels instead of areas:
 *   - 87.8% of all pixels sit below luma 40; median frame luma is 17
 *   - only 3.0% of pixels exceed luma 150
 *   - idle geometry was drawn at ~1.05:1 — grid cell interiors RGB(13,21,32)
 *     against gaps at RGB(15,23,36)
 *
 * Where that came from: unfilled structure was drawn as white or accent at
 * alpha 0.05–0.18 OVER PURE BLACK, which lands at luma 13–46, i.e. 1.08:1 to
 * 1.55:1. The old `stroke` (#30363D) was itself only 1.72:1.
 *
 * Why it poisoned every measurement: the pacing detector gates on
 * |dY| >= 25 luma. On a luma-17 background an element at luma 40 gives dY=23
 * — JUST under the gate. Whether a reveal "counts" was being decided by two
 * luma levels, which is why a percent-of-frame hold table swung from 16.0% to
 * 87.6% of runtime on one unchanged cut depending on the threshold picked.
 *
 * THE RULE: anything a viewer is asked to SEE BEFORE IT FILLS — grid cells,
 * ladder rung bars, ledger rows, chart axes, empty containers — must clear
 * 3:1 against the background. Contrast first, then area, then count. An
 * enlargement at 1.2:1 buys nothing; the same element at 3:1 often needs no
 * enlargement at all.
 *
 * Genuinely decorative layers that sit behind content may stay dim — use
 * `theme.hairline`. Dimness is a deliberate choice for background, never a
 * default for structure.
 * ======================================================================== */

/** WCAG relative luminance of an sRGB channel triplet (0-255). */
export const relativeLuminance = (r: number, g: number, b: number) => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** Contrast ratio of an sRGB colour against the pure-black channel bg. */
export const contrastOnBg = (r: number, g: number, b: number) =>
  (relativeLuminance(r, g, b) + 0.05) / 0.05;

/** The floor for structure a viewer must see before it fills. */
export const IDLE_MIN_CONTRAST = 3.0;

/**
 * Minimum alpha for WHITE over pure black to clear the floor. 0.35 measures
 * exactly 3.00:1; the old idle range (0.05–0.18) measured 1.08–1.55:1.
 * Below this an element is present in the DOM and absent from the video.
 */
export const IDLE_MIN_ALPHA = 0.35;

/** White idle structure at the contrast floor. Use instead of a bare alpha. */
export const IDLE_FILL = `rgba(255, 255, 255, ${IDLE_MIN_ALPHA})`;

/** Does this colour clear the idle floor? Design-time check, not a runtime assert. */
export const clearsContrastFloor = (r: number, g: number, b: number) =>
  contrastOnBg(r, g, b) >= IDLE_MIN_CONTRAST;
