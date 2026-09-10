import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// Two families max: heavy grotesque for spoken keywords, mono for labels
// and data callouts. Hierarchy comes from weight/size, not more fonts.
const inter = loadInter("normal", {
  weights: ["500", "700", "900"],
  subsets: ["latin"],
});
const mono = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

export const SANS = inter.fontFamily;
export const MONO = mono.fontFamily;
