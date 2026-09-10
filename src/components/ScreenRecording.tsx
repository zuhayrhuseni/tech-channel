import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "./theme";

export interface ScreenRecordingProps {
  /** staticFile-relative path from assets.json, e.g. "ep-003/rec/demo.webm". */
  src: string;
  fromFrame?: number;
  durationInFrames: number;
  /**
   * Zoom into a region of the recording. [x, y, w, h] in 1920x1080 space —
   * the rectangle to fill the frame. The push happens on `atFrame` (relative
   * to this sequence). Omit to stay on the always-on Ken-Burns only.
   */
  zoom?: {
    region: [number, number, number, number];
    atFrame?: number;
  } | null;
  /** [cx, cy, r] in 1920x1080 space; draws a hand-drawn-style ring on. */
  circle?: {
    at: [number, number, number];
    atFrame?: number;
  } | null;
}

// A captured screen recording as B-roll: OffthreadVideo (frame-accurate,
// deterministic under render) played MUTED so no embedded audio can trip
// Content-ID, with an always-on slow Ken-Burns push-in + micro-drift (screen
// never static, PLAYBOOK non-negotiable #1). Optional zoom-into-region on a
// mark, and an optional SVG ring that DRAWS ON (line-draw-on entrance grammar,
// not a pop) — same idiom as AnnotatedImage. Pure: all motion derives from
// useCurrentFrame, nothing time-based.
export const ScreenRecording: React.FC<ScreenRecordingProps> = ({
  src,
  fromFrame = 0,
  durationInFrames,
  zoom = null,
  circle = null,
}) => (
  <Sequence from={fromFrame} durationInFrames={durationInFrames}>
    <Inner
      src={src}
      durationInFrames={durationInFrames}
      zoom={zoom}
      circle={circle}
    />
  </Sequence>
);

const Inner: React.FC<Omit<ScreenRecordingProps, "fromFrame">> = ({
  src,
  durationInFrames,
  zoom = null,
  circle = null,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Always-on Ken-Burns push-in across the whole clip + micro-drift.
  const p = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const baseScale = interpolate(p, [0, 1], [1, 1.06]);
  const driftX = Math.sin(frame / 90) * 6;
  const driftY = Math.cos(frame / 110) * 4;

  // Optional zoom into a region. We animate a spring 0->1 from atFrame and
  // interpolate an extra scale + translate that maps the region's center to
  // the frame center. Composited on top of the base Ken-Burns.
  let zoomScale = 1;
  let zoomX = 0;
  let zoomY = 0;
  if (zoom) {
    const [rx, ry, rw, rh] = zoom.region;
    const at = zoom.atFrame ?? 0;
    const t = spring({ frame: frame - at, fps, config: { damping: 200 } });
    // Fill the frame with the region — pick the tighter axis so it fully covers.
    const targetScale = Math.min(1920 / rw, 1080 / rh);
    const regionCx = rx + rw / 2;
    const regionCy = ry + rh / 2;
    // Translate needed (pre-scale space) to bring region center to screen center.
    const targetX = (960 - regionCx) * targetScale;
    const targetY = (540 - regionCy) * targetScale;
    zoomScale = interpolate(t, [0, 1], [1, targetScale]);
    zoomX = interpolate(t, [0, 1], [0, targetX]);
    zoomY = interpolate(t, [0, 1], [0, targetY]);
  }

  const totalScale = baseScale * zoomScale;

  // Ring draw-on (same construction as AnnotatedImage).
  const ringAt = (circle?.atFrame ?? 0) + 6;
  const draw = spring({ frame: frame - ringAt, fps, config: { damping: 200 } });
  const r = circle ? circle.at[2] : 0;
  const circumference = 2 * Math.PI * r;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${driftX + zoomX}px, ${driftY + zoomY}px) scale(${totalScale})`,
        }}
      >
        <OffthreadVideo
          src={staticFile(src)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      {circle && (
        <AbsoluteFill>
          <svg viewBox="0 0 1920 1080" width="100%" height="100%">
            <circle
              cx={circle.at[0]}
              cy={circle.at[1]}
              r={r}
              fill="none"
              stroke={theme.warm}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={(1 - Math.min(1, draw)) * circumference}
              transform={`rotate(-90 ${circle.at[0]} ${circle.at[1]})`}
            />
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
