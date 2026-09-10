/**
 * Throwaway diagnostic: for an absolute frame window, print every build step
 * whose ramp overlaps it, with the local progress `p` at the window's edges.
 *
 *   npx tsx scripts/_window.ts 3968 4110
 *
 * This exists because the pacing table reports ABSOLUTE frames while the
 * scenes are authored in three different staging dialects; without it, the
 * mapping from "f3968-4110 is dead" to "which sub-reveal, at what fraction"
 * is done by eye, and doing it by eye is what produced the last two rounds.
 */
import { e005Schedule, E005_BEATS } from "../src/e005/Episode005";

const A = Number(process.argv[2]);
const Z = Number(process.argv[3]);

for (const b of e005Schedule()) {
  const win = E005_BEATS.find((x) => x.id === b.beat)!;
  if (win.end < A || win.start > Z) continue;
  console.log(`beat ${b.beat}  f${win.start}-${win.end}`);
  const slots = Object.entries(b.slots as Record<string, any>).sort(
    (x, y) => x[1].from - y[1].from,
  );
  for (const [k, s] of slots) {
    const span = s.to - s.from;
    const pAt = (f: number) =>
      Math.max(0, Math.min(1, (f - s.from) / span)).toFixed(3);
    // A step is "live" in the window if its ramp is still running anywhere in
    // it — a step that reached 1 before A contributes nothing new.
    const live = s.to >= A && s.from <= Z;
    console.log(
      `  ${live ? "LIVE" : "    "} ${k.padEnd(22)} from=${String(s.from).padStart(6)} ` +
        `to=${String(s.to).padStart(6)} span=${String(span).padStart(4)}  ` +
        `p(${A})=${pAt(A)} -> p(${Z})=${pAt(Z)}`,
    );
  }
  console.log();
}
