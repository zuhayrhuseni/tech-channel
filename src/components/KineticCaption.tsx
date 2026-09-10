import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "./theme";

export interface KineticCaptionProps {
  /** 1-4-word spoken keyword phrase. */
  text: string;
  /** Frame the pop starts — lands ON the spoken word (from timing.json marks). */
  fromFrame: number;
  /** Frames held big before docking. Motion floor: keep >=24. Default 24. */
  holdFrames?: number;
  /** Corner the keyword shrinks into (docks, never vanishes). Default bottom-left. */
  dockTo?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /**
   * "punch" = the script's **word** emphasis: entrance starts 3 frames early
   * and scales with an overshoot (0.94 → ~1.06 → 1.0) so the word *hits* on a
   * stressed/"yelled" beat. "normal" = the standard monotonic pop.
   * Maps from the `**punch**` cue. See docs/research/emphasis-choreography-spec.md.
   */
  emphasis?: "punch" | "normal";
}

// Big-type keyword: springs in scale-from-0.94 ease-out on its spoken word,
// holds >=24 frames centered, then TRANSFORMS — shrinks and slides to a corner
// label rather than popping out (transforms over add/remove; docked keyword
// stays on screen as a running label). Heavy sans, theme tokens only.
export const KineticCaption: React.FC<KineticCaptionProps> = ({
  text,
  fromFrame,
  holdFrames = 24,
  dockTo = "bottom-left",
  emphasis = "normal",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pre-roll: a punch entrance begins 3 frames early so the *perceived* hit
  // lands on the word, not after it (PLAYBOOK #2 — late is the #1 amateur tell).
  const preRoll = emphasis === "punch" ? 3 : 0;
  const local = frame - fromFrame + preRoll;
  if (local < 0) return null;

  // Entrance: scale from ~0.94, ease-out (spring damping 200 ≈ 300ms band).
  const pop = spring({ frame: local, fps, config: { damping: 200 } });
  const enterOpacity = pop;
  // Punch adds an overshoot spring on top so the scale kicks to ~1.06 then
  // settles to 1.0 (0.94 → 1.06 → 1.0). Normal stays monotonic to 1.0.
  const overshoot =
    emphasis === "punch"
      ? spring({ frame: local, fps, config: { damping: 12, stiffness: 200 } })
      : 0;
  const enterScale = 0.94 + pop * 0.06 + Math.max(0, overshoot - 1) * 0.15;

  // Dock: after the hold, a second spring drives a continuous shrink + slide to
  // the corner. The element never disappears — it becomes a small label.
  const dockStart = holdFrames;
  const dock = spring({
    frame: local - dockStart,
    fps,
    config: { damping: 200 },
  });

  // Centered "big keyword" geometry, in 1920x1080 space.
  const bigFont = 120;
  const smallFont = 34;
  const font = bigFont + (smallFont - bigFont) * dock;

  // Center → corner travel. Positive x/y is toward the chosen corner.
  const margin = 80;
  const centerX = 960;
  const centerY = 540;
  const cornerX = dockTo.includes("left") ? margin : 1920 - margin;
  const cornerY = dockTo.includes("top") ? margin : 1080 - margin;
  const x = centerX + (cornerX - centerX) * dock;
  const y = centerY + (cornerY - centerY) * dock;

  // Interpolate the % translate offset from centered (-50%,-50%) to the corner
  // anchor (0% for left/top edge, -100% for right/bottom edge), so the box
  // hugs its corner once docked.
  const anchorX = dockTo.includes("left") ? 0 : -100;
  const anchorY = dockTo.includes("top") ? 0 : -100;
  const tx = -50 + (anchorX - -50) * dock;
  const ty = -50 + (anchorY - -50) * dock;

  // Docked label reads as annotation (dim); big keyword reads as spoken accent.
  const color = theme.ink;
  const dockedColor = theme.dim;
  const blendColor = dock < 0.5 ? color : dockedColor;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(${tx}%, ${ty}%) scale(${enterScale})`,
          opacity: enterOpacity,
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fontWeight: 800,
          fontSize: font,
          lineHeight: 1,
          letterSpacing: dock < 0.5 ? "-0.02em" : "0.02em",
          color: blendColor,
          whiteSpace: "nowrap",
          textShadow: dock < 0.5 ? "0 4px 24px rgba(0,0,0,0.45)" : "none",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
