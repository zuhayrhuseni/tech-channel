import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

// Eases a beat's visuals out over the last 200ms of its sequence instead of
// a 1-frame hard cut. Exits ease-in per motion convention.
const EXIT_FRAMES = 6;

export const BeatFade: React.FC<{
  durationInFrames: number;
  fadeIn?: boolean;
  children: React.ReactNode;
}> = ({ durationInFrames, fadeIn = true, children }) => {
  const frame = useCurrentFrame();
  const out = interpolate(
    frame,
    [durationInFrames - EXIT_FRAMES, durationInFrames - 1],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const inn = fadeIn
    ? interpolate(frame, [0, EXIT_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      })
    : 1;
  return (
    <div
      style={{ position: "absolute", inset: 0, opacity: Math.min(inn, out) }}
    >
      {children}
    </div>
  );
};
