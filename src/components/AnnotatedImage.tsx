import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "./theme";

export interface AnnotatedImageProps {
  /** staticFile-relative path from assets.json, e.g. "ep-003/img/abc.jpg". */
  src: string;
  fromFrame?: number;
  durationInFrames: number;
  /** [cx, cy, r] in 1920x1080 space; draws a hand-drawn-style ring on. */
  circle?: [number, number, number] | null;
  /** Ken-Burns end scale. Never below 1.0 (keeps it crisp within 2x source). */
  zoomTo?: number;
}

// A fetched image or screenshot as a scene: always-on slow Ken-Burns push-in +
// micro-drift (screen never static, PLAYBOOK non-negotiable #1), with an
// optional SVG ring that DRAWS ON (line-draw-on entrance grammar, not a pop).
export const AnnotatedImage: React.FC<AnnotatedImageProps> = ({
  src,
  fromFrame = 0,
  durationInFrames,
  circle = null,
  zoomTo = 1.06,
}) => (
  <Sequence from={fromFrame} durationInFrames={durationInFrames}>
    <Inner
      src={src}
      durationInFrames={durationInFrames}
      circle={circle}
      zoomTo={zoomTo}
    />
  </Sequence>
);

const Inner: React.FC<Required<Omit<AnnotatedImageProps, "fromFrame">>> = ({
  src,
  durationInFrames,
  circle,
  zoomTo,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(p, [0, 1], [1, zoomTo]);
  const driftX = Math.sin(frame / 90) * 6;
  const driftY = Math.cos(frame / 110) * 4;

  const draw = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const r = circle ? circle[2] : 0;
  const circumference = 2 * Math.PI * r;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${driftX}px, ${driftY}px) scale(${scale})`,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      {circle && (
        <AbsoluteFill>
          <svg viewBox="0 0 1920 1080" width="100%" height="100%">
            <circle
              cx={circle[0]}
              cy={circle[1]}
              r={r}
              fill="none"
              stroke={theme.warm}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={(1 - Math.min(1, draw)) * circumference}
              transform={`rotate(-90 ${circle[0]} ${circle[1]})`}
            />
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
