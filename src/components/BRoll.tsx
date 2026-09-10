import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { theme } from "./theme";

export interface BRollProps {
  /** staticFile-relative path from assets.json, e.g. "ep-003/broll/abc.mp4". */
  src: string;
  /** "video" plays an OffthreadVideo (muted); "image" shows an Img. */
  kind: "video" | "image";
  fromFrame?: number;
  durationInFrames: number;
  /**
   * Scrim strength over the b-roll (0-1). The dark theme.bg gradient sits on
   * top so foreground text stays readable. Default 0.55 — b-roll is texture,
   * not the star. Push higher for busier clips, lower for near-black ones.
   */
  dim?: number;
}

// Full-bleed background b-roll scene. Plays a VIDEO clip (OffthreadVideo, muted,
// cover) or falls back to an IMAGE (Img cover), both with a subtle always-on
// slow Ken-Burns push-in + micro-drift so the screen is never static (PLAYBOOK
// non-negotiable #1). A dark theme.bg gradient scrim sits ON TOP so it reads as
// texture behind the scene content, never competing with foreground text. Sits
// BEHIND scene content — render it first in the stack. Muted so no embedded
// audio can trip Content-ID. Pure: all motion derives from useCurrentFrame.
export const BRoll: React.FC<BRollProps> = ({
  src,
  kind,
  fromFrame = 0,
  durationInFrames,
  dim = 0.55,
}) => (
  <Sequence from={fromFrame} durationInFrames={durationInFrames}>
    <Inner
      src={src}
      kind={kind}
      durationInFrames={durationInFrames}
      dim={dim}
    />
  </Sequence>
);

const Inner: React.FC<Omit<BRollProps, "fromFrame">> = ({
  src,
  kind,
  durationInFrames,
  dim = 0.55,
}) => {
  const frame = useCurrentFrame();

  // Slow Ken-Burns push-in across the whole clip + micro-drift.
  const p = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(p, [0, 1], [1.04, 1.1]);
  const driftX = Math.sin(frame / 100) * 6;
  const driftY = Math.cos(frame / 120) * 4;

  const media =
    kind === "video" ? (
      <OffthreadVideo
        src={staticFile(src)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    ) : (
      <Img
        src={staticFile(src)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );

  // Scrim: dark theme.bg gradient over the media. Slightly lighter in the
  // centre, heavier at the edges so foreground text carries.
  const a = Math.max(0, Math.min(1, dim));
  const scrim = `radial-gradient(ellipse at center, ${hexA(theme.bg, a * 0.82)} 0%, ${hexA(
    theme.bg,
    Math.min(1, a * 1.1),
  )} 100%)`;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${driftX}px, ${driftY}px) scale(${scale})`,
        }}
      >
        {media}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: scrim }} />
    </AbsoluteFill>
  );
};

// theme.bg is a 6-digit hex (#0D1117); append an alpha byte for the scrim.
function hexA(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
