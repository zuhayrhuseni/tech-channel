import React from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "../components/theme";
import { MONO } from "../trailer/fonts";

// Crisp spring with a confident (not bouncy) settle — the "pop".
// damping ~16 = decisive snap, refined not cartoonish.
export const usePop = (at: number, damping = 16) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame,
    fps,
    delay: Math.max(0, at - 2),
    config: { damping, stiffness: 170, mass: 0.7 },
  });
};

// Linear-ish exit fade after `out` (frames).
export const useExit = (out?: number, len = 8) => {
  const frame = useCurrentFrame();
  if (out == null) return 1;
  return interpolate(frame, [out, out + len], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
};

type Dir = "up" | "down" | "left" | "right" | "scale";

// Pops children in at `at` (scale overshoot + slide + blur→sharp), optional exit.
export const PopIn: React.FC<{
  at: number;
  out?: number;
  from?: Dir;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at, out, from = "up", children, style }) => {
  const p = usePop(at);
  const e = useExit(out);
  const o = Math.min(p, e);
  const dist = (1 - p) * 26;
  const tf = {
    up: `translateY(${dist}px)`,
    down: `translateY(${-dist}px)`,
    left: `translateX(${dist}px)`,
    right: `translateX(${-dist}px)`,
    scale: "",
  }[from];
  return (
    <div
      style={{
        opacity: o,
        transform: `${tf} scale(${0.9 + p * 0.1})`,
        filter: `blur(${(1 - Math.min(1, p)) * 6}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// A labeled callout that pops onto a margin. Optional big value + accent bar.
export const SideNote: React.FC<{
  at: number;
  out?: number;
  side?: "l" | "r";
  top: number;
  label: string;
  value?: string;
  color?: string;
  from?: Dir;
}> = ({
  at,
  out,
  side = "r",
  top,
  label,
  value,
  color = theme.accent,
  from,
}) => {
  const pos = side === "r" ? { right: 120 } : { left: 120 };
  return (
    <PopIn
      at={at}
      out={out}
      from={from ?? (side === "r" ? "left" : "right")}
      style={{ position: "absolute", top, ...pos, maxWidth: 460 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          background: theme.panel,
          border: `2px solid ${color}66`,
          borderLeft: `6px solid ${color}`,
          borderRadius: 12,
          padding: "16px 22px",
          boxShadow: "0 8px 30px #0007",
        }}
      >
        {value && (
          <div
            style={{ fontFamily: MONO, fontWeight: 700, fontSize: 46, color }}
          >
            {value}
          </div>
        )}
        <div
          style={{
            fontFamily: MONO,
            fontSize: 28,
            color: theme.ink,
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
      </div>
    </PopIn>
  );
};

// A value tag that pops directly onto a chart element (bar top, endpoint).
export const ValueTag: React.FC<{
  at: number;
  x: number;
  y: number;
  text: string;
  color: string;
  size?: number;
}> = ({ at, x, y, text, color, size = 48 }) => (
  <PopIn
    at={at}
    from="down"
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: "translateX(-50%)",
    }}
  >
    <div
      style={{
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: size,
        color,
        textShadow: `0 0 20px ${color}55`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  </PopIn>
);

// Underline that sweeps in under a keyword.
export const Sweep: React.FC<{
  at: number;
  width: number;
  color?: string;
  thickness?: number;
}> = ({ at, width, color = theme.accent, thickness = 8 }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [at, at + 12], [0, width], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        height: thickness,
        width: w,
        background: color,
        borderRadius: thickness,
        margin: "18px auto 0",
        boxShadow: `0 0 20px ${color}88`,
      }}
    />
  );
};

// Continuous drifting data motes — subtle secondary motion for quiet beats.
export const Motes: React.FC<{ n?: number; color?: string }> = ({
  n = 5,
  color = theme.accent,
}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const x = ((frame * (0.6 + (i % 3) * 0.25) + i * 400) % 2100) - 100;
        const y = 200 + ((i * 137) % 700) + Math.sin(frame / 40 + i) * 20;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 8,
              height: 8,
              borderRadius: 4,
              background: color,
              opacity: 0.35,
              boxShadow: `0 0 12px ${color}`,
            }}
          />
        );
      })}
    </>
  );
};
