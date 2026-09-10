import { e005Schedule, E005_BEATS } from "../src/e005/Episode005";
const rows: any[] = [];
for (const b of e005Schedule()) {
  const win = E005_BEATS.find((x) => x.id === b.beat)!;
  const starts = Object.entries(b.slots)
    .map(([k, s]: any) => ({ k, from: s.from }))
    .sort((a, z) => a.from - z.from);
  // gap from beat start to first, between consecutive, and last to beat end
  let prev = win.start,
    prevK = "(beat start)";
  for (const s of starts) {
    rows.push({
      beat: b.beat,
      gap: s.from - prev,
      from: prev,
      to: s.from,
      after: prevK,
      next: s.k,
    });
    prev = s.from;
    prevK = s.k;
  }
  rows.push({
    beat: b.beat,
    gap: win.end - prev,
    from: prev,
    to: win.end,
    after: prevK,
    next: "(beat end)",
  });
}
rows.sort((a, z) => z.gap - a.gap);
console.log(
  "gaps between consecutive scheduled step STARTS, worst first (>=90f = 3s)",
);
for (const r of rows.filter((r) => r.gap >= 90))
  console.log(
    `  ${String(r.gap).padStart(4)}f ${(r.gap / 30).toFixed(2).padStart(5)}s  ${String(r.from).padStart(6)}-${String(r.to).padEnd(6)} ${r.beat.padEnd(22)} ${r.after} -> ${r.next}`,
  );
console.log(
  `\ntotal gaps >=90f: ${rows.filter((r) => r.gap >= 90).length} of ${rows.length}`,
);
