import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "../theme";

export interface BarDatum {
  /** category label under the bar */
  label: string;
  /** raw numeric value; scaled against the max in the series */
  value: number;
  /** theme token key for the bar fill; defaults to accent */
  color?: "accent" | "up" | "down" | "warm";
  /** frame (relative to fromFrame) this bar should be fully grown ON its word */
  land_at?: number;
}

export interface BarRevealProps {
  data: BarDatum[];
  /** absolute frame the whole chart begins animating from */
  fromFrame?: number;
  /** overrides the auto max (nice round axis top); defaults to max(value) */
  maxValue?: number;
  /** suffix appended to every count-up number, e.g. "%" or "k" */
  unit?: string;
  /** decimals in the count-up readout */
  decimals?: number;
  /** stagger between bars in frames (motion floor: 2-4) */
  stagger?: number;
}

const W = 1100;
const H = 560;
const PAD_L = 70;
const PAD_R = 40;
const PAD_T = 40;
const PAD_B = 90;

const tokenColor = (c: BarDatum["color"]): string =>
  c === "up"
    ? theme.up
    : c === "down"
      ? theme.down
      : c === "warm"
        ? theme.warm
        : theme.accent;

// Rebuilt bar chart (PLAYBOOK: rebuild charts from raw numbers, never
// screenshot them). Bars GROW on their word from a ~0.94 scale-equivalent
// (height eased in, not popped from zero) with count-up numbers above.
export const BarReveal: React.FC<BarRevealProps> = ({
  data,
  fromFrame = 0,
  maxValue,
  unit = "",
  decimals = 0,
  stagger = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const local = frame - fromFrame;
  const top = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = data.length;
  const slot = plotW / n;
  const barW = Math.min(140, slot * 0.6);
  const baseline = PAD_T + plotH;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        {/* axis */}
        <path
          d={`M${PAD_L} ${PAD_T}V${baseline}H${W - PAD_R}`}
          stroke={theme.stroke}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {data.map((d, i) => {
          // each bar lands on its own word if land_at is given, else staggered
          const start = d.land_at != null ? d.land_at - fps * 0.3 : i * stagger;
          const grow = spring({
            frame: local - start,
            fps,
            config: { damping: 200 },
            durationInFrames: Math.round(fps * 0.35),
          });
          const g = Math.min(1, Math.max(0, grow));

          const fullH = (d.value / top) * plotH;
          const h = fullH * g;
          const cx = PAD_L + slot * i + slot / 2;
          const x = cx - barW / 2;
          const y = baseline - h;
          const fill = tokenColor(d.color);
          const shown = d.value * g;

          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={6}
                fill={fill}
                opacity={0.9}
              />
              {/* count-up number, fades in with the bar, sits above it */}
              <text
                x={cx}
                y={y - 16}
                fill={theme.ink}
                fontSize={34}
                fontWeight={700}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                textAnchor="middle"
                opacity={interpolate(g, [0, 0.4, 1], [0, 0, 1])}
              >
                {shown.toFixed(decimals)}
                {unit}
              </text>
              <text
                x={cx}
                y={baseline + 40}
                fill={theme.dim}
                fontSize={26}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                textAnchor="middle"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
