import React from "react";
import { Easing, Img, interpolate, staticFile } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { MIN_MONO_FONT_SIZE, TYPE, theme } from "./theme";

const mono = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
const MONO = mono.fontFamily;

/** JetBrains Mono advance width, in em. Used to budget characters per line. */
const MONO_ADVANCE_EM = 0.6;
/** Horizontal padding inside the body block, per side. */
const PAD_X = 28;

/* ==========================================================================
 * CAPTION LANE
 *
 * The caption is provenance text. It used to render INSIDE the panel's width,
 * which is the ND-1 defect: a 300-340px evidence inset fits ~8 mono characters
 * at the 56px floor, and the real captions are 33 characters. They wrapped to
 * three lines over the timeline labels, or — with no spaces to wrap on —
 * overflowed ~1100px out of the box.
 *
 * The inset stays small (script.yaml carries a BINDING anonymity note on the
 * Drepper cover: it must not be held big or legible). The caption gets its own
 * LANE outside the panel instead, free to be as wide as the attribution needs.
 * Attribution is never silently shortened: credits.md requires the source stay
 * identifiable, so the lane widens, or the CALLER passes a shorter caption.
 * ======================================================================== */

/** Caption font-size. On the mono floor — provenance is on-screen text too. */
export const RECEIPT_CAPTION_FONT_SIZE = MIN_MONO_FONT_SIZE;
/** One caption line's height, in px. Reserve this much vertical band. */
export const RECEIPT_CAPTION_LINE_HEIGHT = Math.round(
  RECEIPT_CAPTION_FONT_SIZE * 1.4,
);
/** Air between the panel edge and the caption lane. */
export const RECEIPT_CAPTION_GAP = 14;

/**
 * Width the caption needs to render in full, on one line, at the floor size.
 * Call this at the CALL SITE to reserve the band before render, instead of
 * discovering the collision in the cut.
 *
 * MUST include letterSpacing. The lane renders with
 * `letterSpacing: TYPE.annotation.letterSpacing` (0.2px per character), and
 * budgeting advance-width ALONE under-reserves by `chars * 0.2`. At the real
 * 33-character captions that is 6.4px of overflow — enough for the lane's
 * `text-overflow: ellipsis` to eat the last two characters, which shipped
 * "johnnysswlab.com · the 2022 rer…". It was silent because the truncation
 * guard below compares capNeeds against laneW using THIS SAME function, so an
 * under-estimate here defeats its own warning. TRAIL_PX absorbs sub-pixel
 * layout rounding so the budget can never land exactly on the overflow edge.
 */
const TRAIL_PX = 2;
export const receiptCaptionWidth = (
  caption: string,
  fontSize: number = RECEIPT_CAPTION_FONT_SIZE,
) =>
  Math.ceil(
    caption.length *
      (Math.max(MIN_MONO_FONT_SIZE, fontSize) * MONO_ADVANCE_EM +
        TYPE.annotation.letterSpacing),
  ) + TRAIL_PX;

/** Which side of the panel the caption lane occupies. */
export type ReceiptCaptionPlacement = "below" | "above" | "right" | "left";

/**
 * Vertical budget applied when the caller passes no `maxHeight`. A body taller
 * than this CROPS to the cited lines — it never scales down to fit.
 */
const DEFAULT_MAX_HEIGHT = 820;

/**
 * Explicit crop window into `lines`. Receipts are evidence, not documents:
 * when captured output doesn't fit at the >=40px cap-height floor, you CROP to
 * the lines the narration actually cites. Shrink-to-fit is banned — a 4px
 * receipt body held for 14.5 seconds is 14.5 seconds of unreadable screen.
 */
export interface ReceiptCrop {
  /** First line of `lines` to show, 0-based. Default 0. */
  from?: number;
  /** How many lines to show. This is the whole receipt. */
  count: number;
  /**
   * Characters per line before mid-truncation with an ellipsis. Defaults to
   * whatever fits `width` at the floor font size, so lines can never spill.
   */
  chars?: number;
  /** Renders a "+N lines" marker so the viewer sees it's an excerpt. Default true. */
  marker?: boolean;
}

export interface ReceiptPanelProps {
  /**
   * 0..1 entrance progress. Not a frame count — every timing in this episode
   * comes from timing.json marks that don't exist until narration is generated,
   * so the caller owns frames->progress and this panel can be built and
   * reviewed before there is any audio.
   */
  progress: number;
  /**
   * Chrome-bar title. ANONYMITY: neutral only ("~/project", "bench/output.txt").
   * A real terminal capture would put the shell prompt — and the account name in
   * it — on screen, which is CLAUDE.md hard rule 1. Rendering the output
   * natively is why this component exists instead of a screen recording.
   */
  title?: string;
  /** Mono text receipt: captured program output, verbatim. */
  lines?: string[];
  /**
   * REQUIRED whenever `lines` is longer or wider than fits at the floor size.
   * Naming the window at the call site is the point: the author decides which
   * cited lines survive, instead of the component silently shrinking them.
   */
  crop?: ReceiptCrop;
  /**
   * Optional height budget in px. If the cropped body still won't fit, the
   * panel crops FURTHER (and warns) — it never reduces the font size.
   */
  maxHeight?: number;
  /** Image receipt: an acquired screenshot path, relative to public/. */
  src?: string;
  /**
   * Attribution — every receipt names its source. Rendered in its OWN LANE
   * outside the panel box (see CAPTION LANE above), so it is never constrained
   * by `width` and never wraps over a sibling. It does not affect the panel's
   * layout size: the panel still measures `width` x its own height.
   */
  caption?: string;
  /**
   * Tints the caption. Use `theme.warm` when the receipt backs OUR measurement
   * rather than a cited one, so provenance is colour-coded the same way the
   * bar it supports is.
   */
  captionColor?: string;
  /** Which side the lane sits on. Default "below". */
  captionPlacement?: ReceiptCaptionPlacement;
  /**
   * Lane width in px. Defaults to exactly what the caption needs at the floor
   * (`receiptCaptionWidth(caption)`) — i.e. it is never truncated by default.
   * Pass a narrower lane only when you have measured the space; the caption
   * then ellipses and the component warns, because a clipped source is a
   * credits.md problem, not a layout solution. Pass a shorter caption instead.
   */
  captionWidth?: number;
  /**
   * For "below"/"above": which panel edge the lane is anchored to. "left"
   * grows the lane rightward from the panel's left edge (default); "right"
   * grows it leftward from the panel's right edge — use that when the panel
   * sits near the right of the safe area.
   */
  captionAnchor?: "left" | "right";
  /**
   * Max caption lines. Default 1: hard nowrap + ellipsis. Use 2 only when you
   * have reserved 2 * RECEIPT_CAPTION_LINE_HEIGHT of vertical band.
   */
  captionLines?: number;
  width?: number;
  /**
   * Mono body size, in px font-size. CLAMPED UP to MIN_MONO_FONT_SIZE (56px
   * font-size = 40.9px cap height). Passing something smaller does not shrink
   * the text — it is ignored. Use `crop` to make the content fit.
   */
  fontSize?: number;
  /** Highlight lines whose text matches — the one number the narration says. */
  emphasize?: RegExp;
}

/** Head-truncate to a character budget, marking the cut so it reads as a crop. */
const clip = (line: string, chars: number) =>
  line.length <= chars ? line : `${line.slice(0, Math.max(1, chars - 1))}…`;

/**
 * A small evidence inset: the source screenshot or the captured output that
 * backs a spoken claim. PLAYBOOK: "real headline screenshots only as receipts",
 * never a beat's main picture — so this is deliberately sized and styled to sit
 * beside the argument rather than replace it.
 *
 * Text never renders below the 40px cap-height floor. Content that doesn't fit
 * is cropped, never scaled down.
 */
export const ReceiptPanel: React.FC<ReceiptPanelProps> = ({
  progress,
  title,
  lines,
  crop,
  maxHeight,
  src,
  caption,
  captionColor = theme.dim,
  captionPlacement = "below",
  captionWidth,
  captionAnchor = "left",
  captionLines = 1,
  width = 980,
  fontSize = TYPE.annotation.fontSize,
  emphasize,
}) => {
  const p = interpolate(Math.max(0, Math.min(1, progress)), [0, 1], [0, 1], {
    easing: Easing.out(Easing.cubic),
  });

  // Floor clamp. This is the whole fix: a caller asking for 19px gets 56px.
  const size = Math.max(MIN_MONO_FONT_SIZE, Math.round(fontSize));
  const lineH = Math.round(size * 1.4);

  // Characters that fit the panel at this size — the horizontal crop budget.
  const fitChars = Math.max(
    4,
    Math.floor((width - PAD_X * 2) / (size * MONO_ADVANCE_EM)),
  );

  let body: string[] = [];
  let hiddenCount = 0;
  let showMarker = false;

  if (lines && lines.length) {
    const from = Math.max(0, crop?.from ?? 0);
    const chars = crop?.chars ?? fitChars;

    // Vertical budget: an explicit crop wins; otherwise maxHeight bounds it;
    // otherwise the receipt is short enough to show whole.
    let count = crop?.count ?? lines.length - from;
    {
      // A vertical budget ALWAYS applies. Without one, an uncropped receipt
      // grew past the safe area, and the only ways out are shrink (banned) or
      // crop. So: crop, always, and say so. DEFAULT_MAX_HEIGHT is the tallest
      // body a 1080 frame can hold with margins.
      const budget = maxHeight ?? DEFAULT_MAX_HEIGHT;
      const fits = Math.max(1, Math.floor((budget - 34) / lineH));
      if (count > fits) {
        if (!crop || crop.count > fits) {
          console.warn(
            `[ReceiptPanel] ${count} lines won't fit ${budget}px at the ` +
              `${MIN_MONO_FONT_SIZE}px floor. Cropping to ${fits}. Pass an explicit ` +
              `crop={{ from, count: ${fits} }} so the cited lines are chosen deliberately.`,
          );
        }
        count = fits;
      }
    }

    const shown = lines.slice(from, from + count);
    body = shown.map((l) => clip(l, Math.min(chars, fitChars)));
    hiddenCount = lines.length - shown.length;
    showMarker = (crop?.marker ?? true) && hiddenCount > 0;
  }

  // ---- caption lane geometry -------------------------------------------
  // Measured at the floor, outside the panel box, laid out absolutely so the
  // panel keeps measuring exactly `width` x its own height.
  const capNeeds = caption ? receiptCaptionWidth(caption) : 0;
  const laneW = Math.max(1, Math.round(captionWidth ?? capNeeds));
  const capLines = Math.max(1, Math.round(captionLines));
  if (caption && capNeeds > laneW * capLines) {
    console.warn(
      `[ReceiptPanel] caption "${caption}" needs ${capNeeds}px at the ` +
        `${RECEIPT_CAPTION_FONT_SIZE}px floor but the lane is ${laneW}px x ${capLines} line(s), ` +
        `so the source will be truncated. Widen captionWidth (or move the lane with ` +
        `captionPlacement / captionAnchor) — or pass a shorter caption that still names the ` +
        `source. Never ship a clipped attribution.`,
    );
  }

  const lanePos: React.CSSProperties =
    captionPlacement === "below"
      ? { top: "100%", marginTop: RECEIPT_CAPTION_GAP }
      : captionPlacement === "above"
        ? { bottom: "100%", marginBottom: RECEIPT_CAPTION_GAP }
        : captionPlacement === "right"
          ? { left: "100%", marginLeft: RECEIPT_CAPTION_GAP, top: 0 }
          : { right: "100%", marginRight: RECEIPT_CAPTION_GAP, top: 0 };
  if (captionPlacement === "below" || captionPlacement === "above") {
    if (captionAnchor === "right") lanePos.right = 0;
    else lanePos.left = 0;
  }

  return (
    <div
      style={{
        // Anchors the caption lane. `overflow` stays visible on purpose — the
        // lane is MEANT to leave the panel's box.
        position: "relative",
        width,
        opacity: p,
        // Rises as it fades in, and scales from 0.94 — never from 0, per the
        // motion floor. 14px of travel is enough to read as "arriving".
        transform: `translateY(${(1 - p) * 14}px) scale(${0.94 + p * 0.06})`,
        fontFamily: MONO,
      }}
    >
      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${theme.stroke}`,
          background: theme.panel,
          boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
        }}
      >
        {title && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 22px",
              borderBottom: `1px solid ${theme.stroke}`,
              background: "rgba(13,17,23,0.6)",
            }}
          >
            <Dot color={theme.down} />
            <Dot color={theme.warm} />
            <Dot color={theme.up} />
            <span
              style={{
                marginLeft: 14,
                color: theme.dim,
                // Floor, not decoration: the chrome title is on-screen text too.
                ...TYPE.annotation,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </span>
          </div>
        )}

        {body.length > 0 && (
          <div
            style={{
              padding: `20px ${PAD_X}px 22px`,
              fontSize: size,
              lineHeight: `${lineH}px`,
            }}
          >
            {body.map((l, i) => {
              const hot = emphasize?.test(l) ?? false;
              return (
                <div
                  key={i}
                  style={{
                    whiteSpace: "pre",
                    minHeight: lineH,
                    color: hot ? theme.ink : theme.dim,
                    fontWeight: hot ? 700 : 400,
                  }}
                >
                  {l}
                </div>
              );
            })}
            {showMarker && (
              <div
                style={{
                  minHeight: lineH,
                  color: theme.stroke,
                  ...TYPE.annotation,
                  lineHeight: `${lineH}px`,
                }}
              >
                {`+${hiddenCount} lines`}
              </div>
            )}
          </div>
        )}

        {src && (
          <Img
            src={staticFile(src)}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        )}
      </div>

      {caption && (
        <div
          style={{
            position: "absolute",
            ...lanePos,
            width: laneW,
            color: captionColor,
            fontFamily: MONO,
            fontSize: RECEIPT_CAPTION_FONT_SIZE,
            fontWeight: TYPE.annotation.fontWeight,
            letterSpacing: TYPE.annotation.letterSpacing,
            lineHeight: `${RECEIPT_CAPTION_LINE_HEIGHT}px`,
            textAlign:
              captionPlacement === "left" || captionAnchor === "right"
                ? "right"
                : "left",
            // Single line by default: hard nowrap, ellipsis, no wrap onto a
            // neighbour's pixels. Multi-line is opt-in and still bounded.
            overflow: "hidden",
            ...(capLines === 1
              ? { whiteSpace: "nowrap", textOverflow: "ellipsis" }
              : {
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: capLines,
                  overflowWrap: "anywhere",
                  maxHeight: capLines * RECEIPT_CAPTION_LINE_HEIGHT,
                }),
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      width: 14,
      height: 14,
      borderRadius: "50%",
      background: color,
      display: "inline-block",
    }}
  />
);
