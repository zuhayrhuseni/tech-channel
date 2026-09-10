/**
 * VERBATIM contents of `episodes/005-cpu-waits-on-memory/bench/output.txt`.
 *
 * This is the episode's only on-screen receipt for its headline "ninety times"
 * — so if this array ever drifts from the file, the video is showing a
 * fabricated measurement. `npm run check:bench` fails the build on any
 * difference; run it before rendering. Do not "tidy" the spacing.
 */
export const BENCH_OUTPUT: string[] = [
  "nodes      : 4194304",
  "node size  : 64 bytes (one cache line)",
  "working set: 256 MiB  (far outside last-level cache)",
  "",
  "sequential layout :    1.18 ns/element",
  "random layout     :  107.74 ns/element",
  "",
  "  same big-O. same code. 91.6x slower.",
];
