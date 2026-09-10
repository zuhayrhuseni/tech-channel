/**
 * Print every SFX cue at the absolute frame it will actually be mixed at, with
 * the silent gaps between them called out.
 *
 * Written because the r12 grade found a 34.3s stretch with no cue at all, and
 * the only way anyone could have known that from the source is by resolving
 * `at:` fractions over slot spans by hand -- which is exactly the arithmetic
 * that had already gone stale three times in this file's own comments. This
 * calls the SAME `sfxEvents()` the render calls, so it cannot disagree with
 * the mix.
 *
 *   npx tsx scripts/dump_sfx.ts [gapFrames] [--episode=e005]
 *
 * `--episode` defaults to e005 (src/episodes.ts). It is a FLAG, not a
 * positional, because argv[2] here is already the gap threshold.
 */
import { resolveEpisode } from "../src/episodes";

const EP = resolveEpisode();
// First non-flag positional. Was `process.argv[2]`, which would now swallow
// `--episode=` as a gap threshold and quietly report every gap (NaN compares
// false), i.e. the tool would silently stop finding the thing it exists for.
const GAP_ARG = process.argv.slice(2).find((a) => !a.startsWith("--"));
const GAP_F = Number(GAP_ARG ?? 150); // report gaps longer than this
const ev = EP.sfxEvents();
let prev = 0;
for (const e of ev) {
  const gap = e.frame - prev;
  console.log(
    `${String(e.frame).padStart(6)}  ${(e.frame / EP.fps).toFixed(1).padStart(7)}s  ${e.sfx.padEnd(7)}` +
      (gap > GAP_F
        ? `   <-- SILENT ${(gap / EP.fps).toFixed(1)}s since f${prev}`
        : ""),
  );
  prev = e.frame;
}
// The episode length was the literal `18557` here. It is the one number in this
// file that a re-voice moves, and a stale one understates the tail silence --
// the exact defect this tool was written to catch.
console.log(
  `\n${ev.length} cues; tail ${((EP.duration - prev) / EP.fps).toFixed(1)}s after the last`,
);
