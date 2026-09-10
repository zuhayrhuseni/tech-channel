import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

// career: build [entry_narrowing], land_at "precise". A doorway whose gap
// closes to a slit — the entry level narrowing, not disappearing.
export const NarrowingEntry: React.FC<{ markFrame: number }> = ({
  markFrame,
}) => {
  const frame = useCurrentFrame();

  const t = interpolate(frame, [markFrame, markFrame + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Fade completes on the mark word so the doorway is visibly arriving as
  // the word is spoken; the narrowing motion itself starts on the mark.
  const appear = interpolate(frame, [markFrame - 9, markFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Gap shrinks 420px -> 90px. Still open at the end: harder, not closed.
  const half = interpolate(t, [0, 1], [210, 45]);

  const wall: React.CSSProperties = {
    position: "absolute",
    top: 300,
    height: 480,
    width: 520,
    background: theme.stroke,
    border: `3px solid ${theme.dim}`,
    borderRadius: 12,
  };

  return (
    <div style={{ position: "absolute", inset: 0, opacity: appear }}>
      <div style={{ ...wall, right: `calc(50% + ${half}px)` }} />
      <div style={{ ...wall, left: `calc(50% + ${half}px)` }} />
      <div
        style={{
          position: "absolute",
          top: 300,
          height: 480,
          left: "50%",
          transform: "translateX(-50%)",
          width: half * 2,
          background: `${theme.accent}22`,
        }}
      />
    </div>
  );
};
