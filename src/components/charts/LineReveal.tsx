import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Easing,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "../theme";

export interface LinePoint {
  /** x position along the series, 0..1 (fraction of the plot width) */
  x: number;
  /** raw value; scaled against the shared y-domain */
  y: number;
}

export interface LineSeries {
  label: string;
  points: LinePoint[];
  /** theme token key for the stroke; defaults to accent */
  color?: "accent" | "up" | "down" | "warm";
  /** frame (relative to fromFrame) this line finishes drawing on its word */
  land_at?: number;
}

export interface LineRevealProps {
  series: LineSeries[];
  /** absolute frame the whole chart begins animating from */
  fromFrame?: number;
  /** shared y-domain [min, max]; defaults to data extent */
  yDomain?: [number, number];
  /** frames each line takes to draw on; the classic "adoption up / trust down" */
  drawFrames?: number;
  /** stagger between series draw-starts in frames (motion floor: 2-4) */
  stagger?: number;
}

const W = 1100;
const H = 560;
const PAD_L = 70;
const PAD_R = 240; // wide right gutter so endpoint values + labels never clip
const PAD_T = 50;
const PAD_B = 70;
const DASH = 2600; // > any path length in this box, for the draw-on

const tokenColor = (c: LineSeries["color"]): string =>
  c === "up"
    ? theme.up
    : c === "down"
      ? theme.down
      : c === "warm"
        ? theme.warm
        : theme.accent;

// Rebuilt line chart (PLAYBOOK: rebuild from raw numbers). Each series DRAWS
// ON via strokeDashoffset — line-draw-on entrance grammar, not a pop. Built
// for the two-crossing-lines case (e.g. adoption up, trust down) on a shared
// axis, with a dot + count-up endpoint that lands when the line finishes.
export const LineReveal: React.FC<LineRevealProps> = ({
  series,
  fromFrame = 0,
  yDomain,
  drawFrames = 75,
  stagger = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - fromFrame;

  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const yMin = yDomain ? yDomain[0] : Math.min(...allY);
  const yMax = yDomain ? yDomain[1] : Math.max(...allY);
  const span = yMax - yMin || 1;

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const sx = (x: number) => PAD_L + x * plotW;
  const sy = (y: number) => PAD_T + (1 - (y - yMin) / span) * plotH;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        {/* axis */}
        <path
          d={`M${PAD_L} ${PAD_T}V${PAD_T + plotH}H${W - PAD_R}`}
          stroke={theme.stroke}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {series.map((s, i) => {
          const start =
            s.land_at != null ? s.land_at - drawFrames : i * stagger;
          const t = interpolate(local - start, [0, drawFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.cubic),
          });

          const pts = s.points.map((p) => [sx(p.x), sy(p.y)]);
          const d = pts
            .map(([x, y], k) => `${k === 0 ? "M" : "L"}${x} ${y}`)
            .join(" ");
          const color = tokenColor(s.color);
          const last = s.points[s.points.length - 1];
          const [ex, ey] = [sx(last.x), sy(last.y)];

          // endpoint count-up + dot appear as the line completes
          const done = interpolate(t, [0.85, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const pop = spring({
            frame: local - (start + drawFrames * 0.85),
            fps,
            config: { damping: 200 },
            durationInFrames: Math.round(fps * 0.3),
          });
          const shown = (yMin + (last.y - yMin)) * Math.min(1, t);

          return (
            <g key={s.label}>
              <path
                d={d}
                stroke={color}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={DASH}
                strokeDashoffset={DASH * (1 - t)}
              />
              <circle
                cx={ex}
                cy={ey}
                r={9 * Math.min(1, Math.max(0, pop))}
                fill={color}
                opacity={done}
              />
              <text
                x={ex + 18}
                y={ey + 8}
                fill={theme.ink}
                fontSize={30}
                fontWeight={700}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                opacity={done}
              >
                {shown.toFixed(0)}
              </text>
              {/* series label sits in the right gutter next to its endpoint —
                  textAnchor="start" keeps it inside the viewBox (no clipping) */}
              <text
                x={ex + 72}
                y={ey + 8}
                fill={color}
                fontSize={24}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                textAnchor="start"
                opacity={done}
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
