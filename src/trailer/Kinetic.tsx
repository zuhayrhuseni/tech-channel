import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../components/theme";
import { MONO, SANS } from "./fonts";

// One spring value drives opacity+scale+translate+blur so they stay
// phase-locked. Scale from 0.94, never 0 — from-zero reads cartoonish.
// Plain function (not a hook) so it's legal inside .map loops.
// Starts 3 frames before the nominal mark: fades reach visible light 2-3
// frames after they start, so without the offset every cue lands late.
export const popAt = (frame: number, fps: number, at: number) =>
  spring({
    frame,
    fps,
    delay: Math.max(0, at - 3),
    config: { damping: 200 },
    durationInFrames: 14,
  });

export const usePop = (at: number, delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return popAt(frame, fps, at + delay);
};

export const popStyle = (p: number): React.CSSProperties => ({
  opacity: p,
  transform: `scale(${0.94 + p * 0.06}) translateY(${(1 - p) * 26}px)`,
  filter: `blur(${(1 - p) * 7}px)`,
});

// Big spoken keyword. Lands on its word; optionally holds then shrinks
// toward a header position instead of vanishing (continuity trick).
export const Kw: React.FC<{
  at: number;
  size?: number;
  color?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at, size = 120, color = theme.ink, children, style }) => {
  const p = usePop(at);
  return (
    <div
      style={{
        fontFamily: SANS,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: "-0.03em",
        color,
        textShadow: `0 0 40px ${color}44, 0 2px 4px #000a`,
        lineHeight: 1.04,
        ...popStyle(p),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Mono label/badge — annotations, chips, citations.
export const Chip: React.FC<{
  at: number;
  color?: string;
  border?: boolean;
  size?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at, color = theme.dim, border = true, size = 42, children, style }) => {
  const p = usePop(at);
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: size,
        fontWeight: 700,
        color,
        padding: "10px 22px",
        borderRadius: 10,
        border: border ? `2px solid ${color}88` : "none",
        background: theme.panel,
        boxShadow: "0 1px 2px #0006, 0 8px 24px #0005",
        width: "fit-content",
        ...popStyle(p),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Small always-on motion: blinking cursor block for mono text.
export const Cursor: React.FC<{ color?: string }> = ({
  color = theme.accent,
}) => {
  const frame = useCurrentFrame();
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.55em",
        height: "1.1em",
        marginLeft: "0.15em",
        verticalAlign: "text-bottom",
        background: color,
        opacity: Math.floor(frame / 16) % 2 === 0 ? 1 : 0.15,
      }}
    />
  );
};

// Shrink helper: 1 until `from`, eases to `to` scale/offset afterwards.
export const useShrink = (from: number, frames = 12) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, from + frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};
