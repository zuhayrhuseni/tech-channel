/**
 * Fails if the benchmark numbers shown on screen have drifted from the numbers
 * actually measured.
 *
 * `src/e005/bench.ts` is hand-transcribed from `bench/output.txt` because
 * Remotion components can't read the filesystem at render time. That
 * transcription is the episode's ONLY on-screen receipt for its headline
 * "ninety times" claim — a silent drift between the two would put a fabricated
 * measurement in front of the viewer while the narration cites it as real.
 * Cheap check, expensive failure mode.
 *
 *   npx tsx scripts/check_bench.ts
 */
import { readFileSync } from "node:fs";
import { BENCH_OUTPUT } from "../src/e005/bench";

const SOURCE = "episodes/005-cpu-waits-on-memory/bench/output.txt";

// Trailing whitespace and a trailing blank line are invisible on screen, so
// they are the only differences tolerated. Everything else fails.
const norm = (s: string) => s.replace(/[ \t]+$/, "");

const fileLines = readFileSync(SOURCE, "utf8")
  .replace(/\n+$/, "")
  .split("\n")
  .map(norm);
const codeLines = BENCH_OUTPUT.map(norm);

const diffs: string[] = [];
const n = Math.max(fileLines.length, codeLines.length);
for (let i = 0; i < n; i++) {
  if (fileLines[i] !== codeLines[i]) {
    diffs.push(
      `  line ${i + 1}\n    ${SOURCE}: ${JSON.stringify(fileLines[i] ?? null)}\n    bench.ts:   ${JSON.stringify(codeLines[i] ?? null)}`,
    );
  }
}

if (diffs.length > 0) {
  console.error(
    `✗ BENCH DRIFT — src/e005/bench.ts no longer matches ${SOURCE}:\n`,
  );
  console.error(diffs.join("\n"));
  console.error(
    "\nThe on-screen receipt must be verbatim. Re-transcribe bench.ts, or re-run\n" +
      "the benchmark and update BOTH the output file and the script's SOURCE [11].",
  );
  process.exit(1);
}

console.log(`✓ bench receipt matches ${SOURCE} (${codeLines.length} lines)`);
