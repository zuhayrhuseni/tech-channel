import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { REVEAL_FRAMES, theme } from "./theme";

// hook: build [surface_layer, deeper_layer], land_at "faster".
// Two stacked slabs. The surface slab appears on the mark; the deeper slab
// follows a beat later, accent-lit — the layer the channel goes down to.
export const LayerPeel: React.FC<{ markFrame: number }> = ({ markFrame }) => {
  const frame = useCurrentFrame();

  const reveal = (start: number) =>
    // Onset 3 frames early: sync tolerance is asymmetric — a visual may
    // slightly precede its word but must never trail it (ITU-R BT.1359).
    interpolate(frame, [start - 3, start - 3 + REVEAL_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

  const surface = reveal(markFrame);
  const deeper = reveal(markFrame + 30);

  const slab: React.CSSProperties = {
    width: 720,
    height: 130,
    borderRadius: 16,
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          ...slab,
          top: 380,
          background: theme.stroke,
          border: `3px solid ${theme.dim}`,
          opacity: surface,
          marginTop: (1 - surface) * -20,
        }}
      />
      <div
        style={{
          ...slab,
          top: 560,
          background: "#132339",
          border: `3px solid ${theme.accent}`,
          boxShadow: `0 0 ${deeper * 60}px ${theme.accent}44`,
          opacity: deeper,
          marginTop: (1 - deeper) * -20,
        }}
      />
    </div>
  );
};
