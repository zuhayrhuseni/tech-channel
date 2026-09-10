/**
 * Dump the resolved e005 schedule so a re-voice can be audited without a render.
 *
 * WHY: the beat plans in Episode005.tsx pin steps to MARKS, so a re-voice moves
 * the pins automatically -- but the `w` weights that fill the space BETWEEN
 * pins do not move, and neither do the scene-side absolute-frame storyboards
 * (TrickQuestion's STEP_WINDOW, RatioMorph's RATIO_MORPH_NOMINAL). When marks
 * shift, those two tables silently disagree with reality: `p` still runs 0..1,
 * so nothing crashes and nothing looks broken in code -- the sub-reveals just
 * fire at the wrong moment in the sentence. This prints the ground truth.
 *
 *   npx tsx scripts/dump_schedule.ts [beatId ...] [--episode=e005]
 *
 * `--episode` defaults to e005 (src/episodes.ts). It is a FLAG because the
 * positionals here are beat ids.
 *
 * `ramp/nominal` is the clock rate the scene is being run at. 1.00 means the
 * scene's own storyboard timing is being honoured exactly; anything else means
 * every authored sub-reveal duration inside that step is being scaled by it.
 */
import { resolveEpisode } from "../src/episodes";

const EP = resolveEpisode();
const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sched = EP.schedule();

for (const b of sched) {
  if (want.length && !want.includes(b.beat)) continue;
  const win = EP.beats.find((x) => x.id === b.beat)!;
  console.log(
    `\n=== ${b.beat}  ${win.start}..${win.end}  (${win.end - win.start}f) ===`,
  );
  const rows = Object.entries(b.slots);
  if (!rows.length) {
    console.log("  (no plan)");
    continue;
  }
  console.log(
    `  ${"step".padEnd(22)}${"from".padStart(7)}${"to".padStart(8)}${"slot".padStart(7)}${"ramp".padStart(7)}`,
  );
  for (const [step, s] of rows) {
    const slot =
      (s as { to: number; from: number }).to - (s as { from: number }).from;
    const ramp = (s as { ramp?: number }).ramp ?? slot;
    console.log(
      `  ${step.padEnd(22)}${String((s as { from: number }).from).padStart(7)}` +
        `${String((s as { to: number }).to).padStart(8)}` +
        `${String(slot).padStart(7)}${String(ramp).padStart(7)}`,
    );
  }
}
