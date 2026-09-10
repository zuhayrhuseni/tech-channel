import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { REVEAL_FRAMES, theme } from "./theme";

// what: build [icon_db, icon_distributed, icon_network], staggered from the
// beat start. Stroke-drawn icons, no text.
const S = 200; // icon viewbox size on screen

export const Db: React.FC = () => (
  <svg width={S} height={S} viewBox="0 0 100 100" fill="none">
    <ellipse
      cx="50"
      cy="24"
      rx="30"
      ry="12"
      stroke={theme.ink}
      strokeWidth="4"
    />
    <path
      d="M20 24v52c0 6.6 13.4 12 30 12s30-5.4 30-12V24"
      stroke={theme.ink}
      strokeWidth="4"
    />
    <path
      d="M20 50c0 6.6 13.4 12 30 12s30-5.4 30-12"
      stroke={theme.ink}
      strokeWidth="4"
    />
  </svg>
);

export const Distributed: React.FC = () => (
  <svg width={S} height={S} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="22" r="11" stroke={theme.ink} strokeWidth="4" />
    <circle cx="24" cy="72" r="11" stroke={theme.ink} strokeWidth="4" />
    <circle cx="76" cy="72" r="11" stroke={theme.ink} strokeWidth="4" />
    <path
      d="M44 31 30 62M56 31l14 31M35 72h30"
      stroke={theme.dim}
      strokeWidth="4"
    />
  </svg>
);

export const Network: React.FC = () => (
  <svg width={S} height={S} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="34" stroke={theme.ink} strokeWidth="4" />
    <ellipse
      cx="50"
      cy="50"
      rx="14"
      ry="34"
      stroke={theme.ink}
      strokeWidth="4"
    />
    <path d="M16 50h68M20 34h60M20 66h60" stroke={theme.dim} strokeWidth="4" />
  </svg>
);

const icons = [Db, Distributed, Network];
const STAGGER = 40; // ~1.3s: each concept lands before the next appears

export const TopicIcons: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 160,
      }}
    >
      {icons.map((Icon, i) => {
        const t = interpolate(
          frame,
          [i * STAGGER, i * STAGGER + REVEAL_FRAMES],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          },
        );
        return (
          <div
            key={i}
            style={{ opacity: t, transform: `translateY(${(1 - t) * 24}px)` }}
          >
            <Icon />
          </div>
        );
      })}
    </div>
  );
};
