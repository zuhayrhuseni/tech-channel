import "./index.css";
import { Composition } from "remotion";
import { ExampleEpisode, EXAMPLE_DURATION } from "./example/ExampleEpisode";

/**
 * COMPOSITION REGISTRY.
 *
 * One `<Composition>` per renderable episode. This ships with a single tiny
 * example so the repo compiles and `npm run dev` opens onto something real;
 * delete it once you have your own.
 *
 * Adding an episode is three steps:
 *   1. `episodes/NNN-slug/script.yaml`  -> narration + timing.json
 *   2. `src/eNNN/EpisodeNNN.tsx`        -> beat plan, SFX plan, scenes
 *   3. register it here, and add an entry to `src/episodes.ts`
 *
 * NEVER hard-code `durationInFrames`. Derive it from the episode's own
 * timing.json (`Math.ceil(audioMs / 1000 * fps)`) so the composition length can
 * never drift from the narration it is synced to — a re-voice that changes the
 * audio by 17 frames must move the composition with it.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        // npx remotion render ExampleEpisode
        id="ExampleEpisode"
        component={ExampleEpisode}
        durationInFrames={EXAMPLE_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
