import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../components/theme";
import { MONO, SANS } from "../trailer/fonts";
import { ValueTag } from "./motion";

// Reveal helper: eased 0->1 over ~9 frames, starting 3 frames before `at`
// (sync tolerance is asymmetric — land on or just before the word).
export const rise = (frame: number, at: number, len = 9) =>
  interpolate(frame, [at - 3, at - 3 + len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

const fmt = (v: number, dp = 0) => (v >= 0 ? "+" : "") + v.toFixed(dp);

// Big count-up stat. `at` is the LANDING frame (the mark) — the number
// counts continuously from beat-start and hits its final value on the word,
// so it's in motion the whole time and lands on cue.
export const Stat: React.FC<{
  at: number;
  value: number;
  label: string;
  suffix?: string;
  signed?: boolean;
  color?: string;
  dp?: number;
  x?: string | number;
  y?: number;
}> = ({
  at,
  value,
  label,
  suffix = "%",
  signed = true,
  color,
  dp = 0,
  x = "50%",
  y = 300,
}) => {
  const frame = useCurrentFrame();
  const appear = rise(frame, 8, 14);
  const count = interpolate(frame, [8, Math.max(26, at)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const p = appear;
  const shown = value * count;
  const c = color ?? (value >= 0 ? theme.up : theme.down);
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: x,
        transform: `translateX(-50%) scale(${0.94 + p * 0.06})`,
        opacity: p,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 200,
          color: c,
          letterSpacing: "-0.04em",
          textShadow: `0 0 50px ${c}44`,
        }}
      >
        {(signed ? fmt(shown, dp) : shown.toFixed(dp)) + suffix}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 40,
          color: theme.dim,
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// Grouped bar chart; bars grow, value labels count up. Values can be signed.
export const Bars: React.FC<{
  at: number;
  items: Array<{
    label: string;
    value: number;
    color?: string;
    display?: string;
  }>;
  maxAbs?: number;
  stagger?: number;
  suffix?: string;
  y?: number;
}> = ({ at, items, maxAbs, stagger = 10, suffix = "%", y = 250 }) => {
  const frame = useCurrentFrame();
  const peak = maxAbs ?? Math.max(...items.map((i) => Math.abs(i.value)));
  const H = 440;
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 90,
      }}
    >
      {items.map((it, i) => {
        // grow continuously, landing on the mark (staggered slightly)
        const p = interpolate(
          frame,
          [8, Math.max(26, at + i * stagger)],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.cubic),
          },
        );
        const h = (Math.abs(it.value) / peak) * H * p;
        const c = it.color ?? (it.value >= 0 ? theme.up : theme.down);
        return (
          <div
            key={it.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 220,
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: 56,
                color: c,
                opacity: p,
              }}
            >
              {it.display ??
                (it.value >= 0 ? "+" : "") + Math.round(it.value * p) + suffix}
            </div>
            <div
              style={{
                height: H,
                display: "flex",
                alignItems: "flex-end",
                marginTop: 14,
              }}
            >
              <div
                style={{
                  width: 150,
                  height: h,
                  background: `linear-gradient(180deg, ${c}, ${c}55)`,
                  borderRadius: "10px 10px 0 0",
                  boxShadow: `0 0 40px ${c}33`,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 32,
                color: theme.ink,
                marginTop: 18,
                textAlign: "center",
                opacity: p,
              }}
            >
              {it.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Line chart over a baseline. Series points are normalized 0..1 (x,y);
// y=0 is bottom. Each series draws in over its own `at`.
export const LineChart: React.FC<{
  series: Array<{
    at: number;
    color: string;
    pts: Array<[number, number]>;
    label?: string;
  }>;
  baselineY?: number; // normalized position of the "2019/2020 = baseline" rule
  baselineLabel?: string;
  shade?: { x0: number; x1: number; at: number; label?: string };
}> = ({ series, baselineY, baselineLabel, shade }) => {
  const frame = useCurrentFrame();
  const W = 1400;
  const H = 620;
  const PX = 90;
  const PY = 70;
  const X = (x: number) => PX + x * (W - 2 * PX);
  const Y = (y: number) => H - PY - y * (H - 2 * PY);
  const path = (pts: Array<[number, number]>) =>
    pts.map(([x, y], i) => `${i ? "L" : "M"}${X(x)} ${Y(y)}`).join(" ");
  const axes = rise(frame, 0, 14);
  return (
    <div
      style={{
        position: "absolute",
        top: 240,
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        <path
          d={`M${PX} ${H - PY}H${W - PX}`}
          stroke={theme.stroke}
          strokeWidth={3}
          strokeDasharray={W}
          strokeDashoffset={W * (1 - axes)}
        />
        <path
          d={`M${PX} ${H - PY}V${PY}`}
          stroke={theme.stroke}
          strokeWidth={3}
          strokeDasharray={H}
          strokeDashoffset={H * (1 - axes)}
        />
        {baselineY != null && (
          <>
            <path
              d={`M${PX} ${Y(baselineY)}H${W - PX}`}
              stroke={theme.dim}
              strokeWidth={2}
              strokeDasharray="10 10"
              opacity={axes * 0.7}
            />
            {baselineLabel && (
              <text
                x={W - PX}
                y={Y(baselineY) - 14}
                textAnchor="end"
                fontFamily={MONO}
                fontSize={26}
                fill={theme.dim}
                opacity={axes}
              >
                {baselineLabel}
              </text>
            )}
          </>
        )}
        {shade &&
          (() => {
            const s = rise(frame, shade.at, 18);
            return (
              <rect
                x={X(shade.x0)}
                y={PY}
                width={(X(shade.x1) - X(shade.x0)) * s}
                height={H - 2 * PY}
                fill={`${theme.warm}22`}
              />
            );
          })()}
        {series.map((s, i) => {
          const d = path(s.pts);
          // draw continuously, landing the line on its mark
          const draw = interpolate(frame, [10, Math.max(40, s.at)], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.cubic),
          });
          const LEN = 2600;
          return (
            <path
              key={i}
              d={d}
              stroke={s.color}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={LEN}
              strokeDashoffset={LEN * (1 - draw)}
            />
          );
        })}
      </svg>
    </div>
  );
};

// Two lines diverging from a shared origin. Value tags pop at the endpoints
// (offset clear of the dot); descriptive labels sit along the left of each
// line so nothing is occluded.
export const Diverging: React.FC<{
  atUp: number;
  atDown: number;
  upLabel: string;
  downLabel: string;
  upVal: string;
  downVal: string;
}> = ({ atUp, atDown, upLabel, downLabel, upVal, downVal }) => {
  const frame = useCurrentFrame();
  const W = 1300;
  const H = 620;
  const LEN = 1500;
  // draw continuously, each line landing on its mark word
  const draw = (land: number) =>
    interpolate(frame, [8, Math.max(30, land)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
  const up = draw(atUp);
  const down = draw(atDown);
  const ex = W - 90;
  const uy = H * 0.12;
  const dy = H * 0.9;
  return (
    <div
      style={{
        position: "absolute",
        top: 240,
        left: "50%",
        transform: "translateX(-50%)",
        width: W,
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        <path
          d={`M70 ${H / 2}H${W}`}
          stroke={theme.stroke}
          strokeWidth={1.5}
          opacity={0.5}
          strokeDasharray="8 8"
        />
        <path
          d={`M70 ${H / 2} C ${W * 0.4} ${H / 2 - 20}, ${W * 0.6} ${H * 0.28}, ${ex} ${uy}`}
          stroke={theme.up}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={LEN}
          strokeDashoffset={LEN * (1 - up)}
        />
        <path
          d={`M70 ${H / 2} C ${W * 0.4} ${H / 2 + 30}, ${W * 0.55} ${H * 0.78}, ${ex} ${dy}`}
          stroke={theme.down}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={LEN}
          strokeDashoffset={LEN * (1 - down)}
        />
        {up >= 1 && <circle cx={ex} cy={uy} r={12} fill={theme.up} />}
        {down >= 1 && <circle cx={ex} cy={dy} r={12} fill={theme.down} />}
      </svg>
      {/* value tags pop as each line lands on its mark, offset clear of the dot */}
      <ValueTag
        at={Math.max(30, atUp)}
        x={ex - 30}
        y={uy - 78}
        text={upVal}
        color={theme.up}
        size={60}
      />
      <ValueTag
        at={Math.max(30, atDown)}
        x={ex - 30}
        y={dy + 26}
        text={downVal}
        color={theme.down}
        size={60}
      />
      {/* descriptions appear early as context, along the left */}
      <div
        style={{
          position: "absolute",
          top: uy - 6,
          left: 90,
          fontFamily: MONO,
          fontSize: 32,
          color: theme.up,
          opacity: rise(frame, 10, 12),
        }}
      >
        {upLabel}
      </div>
      <div
        style={{
          position: "absolute",
          top: dy - 6,
          left: 90,
          fontFamily: MONO,
          fontSize: 32,
          color: theme.down,
          opacity: rise(frame, 18, 12),
        }}
      >
        {downLabel}
      </div>
    </div>
  );
};

// Ladder whose BOTTOM rung (the first job) is pulled out on `atRemoved`.
// Rungs top->bottom are indices 0..3; index 3 is the bottom (removed one).
export const Ladder: React.FC<{ atBuild: number; atRemoved: number }> = ({
  atBuild,
  atRemoved,
}) => {
  const frame = useCurrentFrame();
  const rungs = [0, 1, 2, 3];
  const gone = rise(frame, atRemoved, 12);
  return (
    <div
      style={{
        position: "absolute",
        top: 250,
        left: "50%",
        transform: "translateX(-50%)",
        width: 460,
        height: 560,
      }}
    >
      {[0, 1].map((r) => (
        <div
          key={r}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 10,
            background: theme.stroke,
            left: r ? 450 : 0,
            borderRadius: 5,
          }}
        />
      ))}
      {rungs.map((r) => {
        const p = rise(frame, atBuild + r * 8, 12); // build top-down
        const isBottom = r === 3;
        const opacity = isBottom ? p * (1 - gone) : p;
        return (
          <div
            key={r}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 34,
              top: r * 170,
              background: isBottom ? theme.down : theme.dim,
              borderRadius: 8,
              opacity,
              transform: isBottom ? `translateX(${gone * 240}px)` : "none",
              boxShadow: isBottom ? `0 0 24px ${theme.down}66` : "none",
            }}
          />
        );
      })}
      {gone > 0.4 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 3 * 170,
            height: 34,
            border: `3px dashed ${theme.down}`,
            borderRadius: 8,
            opacity: gone,
          }}
        />
      )}
    </div>
  );
};

// Section chip that persists at top-left of a section's beats.
export const SectionTag: React.FC<{
  at: number;
  children: React.ReactNode;
}> = ({ at, children }) => {
  const frame = useCurrentFrame();
  const p = rise(frame, at, 12);
  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: 90,
        fontFamily: MONO,
        fontSize: 30,
        color: theme.accent,
        opacity: p * 0.9,
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </div>
  );
};
