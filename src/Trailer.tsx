import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import timing from "../episodes/000-trailer/timing.json";
import { AmbientBackground } from "./components/AmbientBackground";
import { BeatFade } from "./components/BeatFade";
import {
  CareerScene,
  CloseScene,
  HookScene,
  IndustryScene,
  SourcesScene,
  TopicsScene,
} from "./trailer/scenes";
import { BEATS } from "./trailer/schedule";

export const TRAILER_DURATION = Math.ceil((timing.audioMs / 1000) * timing.fps);

// Slow global push-in — nothing on screen is ever fully static.
const Camera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1]);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  );
};

const SCENES: Array<
  [keyof typeof BEATS, keyof typeof BEATS, React.FC, boolean]
> = [
  ["hook", "what", HookScene, false],
  ["what", "industry", TopicsScene, true],
  ["industry", "career", IndustryScene, true],
  ["career", "promise", CareerScene, true],
  ["promise", "close", SourcesScene, true],
  ["close", "end", CloseScene, true],
];

export const Trailer: React.FC = () => {
  return (
    <AbsoluteFill>
      <Audio src={staticFile("000-trailer/narration.wav")} />
      <AmbientBackground />
      <Camera>
        {SCENES.map(([from, to, Scene, fadeIn]) => (
          <Sequence
            key={from}
            from={BEATS[from]}
            durationInFrames={BEATS[to] - BEATS[from]}
            name={from}
          >
            <BeatFade
              durationInFrames={BEATS[to] - BEATS[from]}
              fadeIn={fadeIn}
            >
              <Scene />
            </BeatFade>
          </Sequence>
        ))}
      </Camera>
    </AbsoluteFill>
  );
};
