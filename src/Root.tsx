import "./index.css";
import { Composition, Still } from "remotion";
import { Trailer, TRAILER_DURATION } from "./Trailer";
import { Episode002, E002_DURATION } from "./e002/Episode002";
import { Episode003, E003_DURATION } from "./e003/Episode003";
import { Episode005, E005_DURATION } from "./e005/Episode005";
import { E005Lab, E005_LAB_DURATION } from "./e005/Lab";
import { E005Thumbnail } from "./e005/Thumbnail";
import { E005ThumbnailB } from "./e005/ThumbnailB";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        // npx remotion render Trailer
        id="Trailer"
        component={Trailer}
        durationInFrames={TRAILER_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        // npx remotion render Episode002
        id="Episode002"
        component={Episode002}
        durationInFrames={E002_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        // npx remotion render Episode003
        id="Episode003"
        component={Episode003}
        durationInFrames={E003_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        // npx remotion render Episode005
        // Duration comes from timing.json's audioMs, so it always matches the
        // narration exactly — never hard-code it here.
        id="Episode005"
        component={Episode005}
        durationInFrames={E005_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        // Scrub-able preview of ep005's timing-independent components. Not a
        // deliverable — it never renders to an mp4, it exists so a broken
        // visual can be fixed without regenerating narration.
        id="E005Lab"
        component={E005Lab}
        durationInFrames={E005_LAB_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
      <Still
        // npx remotion still E005Thumbnail <out.png>
        // A Still, not a 1-frame Composition: the thumbnail is a packaging
        // deliverable rendered from the SAME design tokens as the episode
        // (PLAYBOOK #10), so a palette change can never leave the thumbnail
        // looking like a different channel.
        id="E005Thumbnail"
        component={E005Thumbnail}
        width={1920}
        height={1080}
      />
      <Still
        // npx remotion still E005ThumbnailB <out.png>
        // The SHIPPING thumbnail — see the header of ThumbnailB.tsx and the
        // squint comparison in packaging.md. `E005Thumbnail` (the bar variant)
        // stays registered on purpose: the playbook runs YouTube Test &
        // Compare on every upload, so it is the B slot, not dead code.
        id="E005ThumbnailB"
        component={E005ThumbnailB}
        width={1920}
        height={1080}
      />
    </>
  );
};
