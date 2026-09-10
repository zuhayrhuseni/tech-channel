import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

// industry: build [two_diverging_lines]. One series up, one down, drawn from
// a shared origin — the "same year, two numbers" visual.
const W = 1100;
const H = 560;
const LEN = 1300; // > path length, for dash draw

export const DivergingLines: React.FC = () => {
  const frame = useCurrentFrame();

  // 3s draw: slow enough to track, no hold-then-freeze pop.
  const t = interpolate(frame, [0, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const dot = (x: number, y: number, color: string) =>
    t >= 1 ? <circle cx={x} cy={y} r="10" fill={color} /> : null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        <path
          d={`M60 ${H - 60}H${W - 40}`}
          stroke={theme.stroke}
          strokeWidth="3"
        />
        <path d={`M60 ${H - 60}V40`} stroke={theme.stroke} strokeWidth="3" />
        <path
          d={`M60 ${H / 2} C ${W * 0.4} ${H / 2 - 20}, ${W * 0.6} ${H * 0.32}, ${W - 80} ${H * 0.16}`}
          stroke={theme.up}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={LEN}
          strokeDashoffset={LEN * (1 - t)}
        />
        <path
          d={`M60 ${H / 2} C ${W * 0.4} ${H / 2 + 30}, ${W * 0.55} ${H * 0.75}, ${W - 80} ${H * 0.88}`}
          stroke={theme.down}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={LEN}
          strokeDashoffset={LEN * (1 - t)}
        />
        {dot(W - 80, H * 0.16, theme.up)}
        {dot(W - 80, H * 0.88, theme.down)}
      </svg>
    </div>
  );
};
