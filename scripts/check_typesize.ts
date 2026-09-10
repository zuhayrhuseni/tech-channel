/**
 * The TYPE SIZE FLOOR gate.
 *
 * WHY THIS EXISTS: the r13 grade scored Readability 5/10 and the finding was
 * not "one caption is small", it was systematic -- `growth at n=1,000` at 27.5
 * px cap height, honest_walkback body copy at 30-35, the whole ending beat at
 * 32-37, `linked lists of doubles` at ~20, a RatioMorph axis label at ~20. The
 * rubric floor is 40 px of CAP HEIGHT at 1080p. On a phone, everything under it
 * is decoration that looks like information.
 *
 * The token tier was never the problem. `TYPE.annotation` is 56 px, which at
 * Inter's ~0.727 cap ratio is 40.7 px of cap -- it clears the floor with 2% to
 * spare. Every violation is a HARDCODED `fontSize:` at a call site that opted
 * out of the tier, which is why a design-token review kept coming back clean
 * while the render kept coming back unreadable. That is the same shape as the
 * contrast bug: a property that regresses silently, one literal at a time,
 * and is invisible in review because `fontSize: 34` looks like a decision.
 *
 * THE FLOOR. cap_px = fontSize x CAP_RATIO, and we want cap_px >= 40, so
 * fontSize >= 40 / 0.727 = 55.02, which ceils to 56 -- a 55px font is 39.99px
 * of cap and misses. Inter and JetBrains Mono are within a percent of each
 * other on cap ratio, so one number covers both.
 *
 *   npx tsx scripts/check_typesize.ts          # report + fail on violations
 *   npx tsx scripts/check_typesize.ts --report # never fail, just print
 *
 * EXEMPTING A SITE. Not all small type is a defect. Text the viewer is never
 * asked to READ -- terminal output used as texture, a dense code block whose
 * point is that it is dense, a source-receipt line that exists to be
 * photographed rather than parsed -- is legitimately below the floor. Mark it:
 *
 *     fontSize: 30, // typesize-exempt: FakeTerminal body, texture not copy --
 *                   // the beat never asks the viewer to read these lines
 *
 * The marker must give a REASON, for the same reason the contrast gate demands
 * one: an unexplained exemption is how a floor rots. "It looked fine in the
 * editor" is not a reason -- the editor is not 6 inches wide.
 *
 * WHAT THIS GATE CANNOT SEE, so do not trust it alone:
 *   - `fontSize: SOME_CONST` and `fontSize: x * 0.8` are reported as
 *     unresolved rather than guessed at. Read those by hand.
 *   - A cleared fontSize inside a wrapper scaled by `transform: scale(0.5)`
 *     renders at half. Static analysis cannot follow that; the render can.
 *   - It says nothing about contrast, so a 60 px label at 1.2:1 passes here
 *     and fails check_contrast. Both gates, every round.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { resolveEpisode } from "../src/episodes";

const CAP_RATIO = 0.727; // Inter / JetBrains Mono cap height as a fraction of em
const CAP_FLOOR = 40; // px at 1080p -- the rubric's readability floor
const MIN_FONT = Math.ceil(CAP_FLOOR / CAP_RATIO); // 56

const EXEMPT = /typesize-exempt:\s*\S/;

/**
 * SCOPE IS PER-EPISODE, NOT REPO-WIDE. This used to be `["src"]`, which walked
 * every episode ever made plus HelloWorld. That is why this gate was never in
 * gates_r8.sh: on the current tree it reports 74 hits, of which SIXTY-EIGHT are
 * in e002 / e003 / trailer / HelloWorld -- episodes that shipped before this
 * floor existed and are never going to be re-rendered. A gate that is red on
 * arrival for reasons unrelated to the episode you are gating is a gate whose
 * output gets skimmed and then ignored, which is the precise failure mode the
 * runner's own header warns about.
 *
 * Scoped to the episode under test plus `src/components` (shared, and genuinely
 * in its render path), ep005 reports 4. That is a number someone will actually
 * read.
 *
 * `--all` restores the old repo-wide walk for a deliberate audit.
 */
const ROOTS = process.argv.includes("--all")
  ? ["src"]
  : [resolveEpisode().srcRoot, "src/components"];

type Hit = { file: string; line: number; size: number; text: string };
const bad: Hit[] = [];
const exempt: Hit[] = [];
const unresolved: { file: string; line: number; text: string }[] = [];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
  }
  return out;
}

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    lines.forEach((ln, i) => {
      const m = ln.match(/fontSize:\s*([^,\n}]+)/);
      if (!m) return;
      const raw = m[1].trim();
      // The exemption may sit on this line, on the line after (prettier wraps
      // trailing comments down), or in the COMMENT BLOCK DIRECTLY ABOVE.
      //
      // That third case was missing and it silently swallowed real exemptions.
      // Above the line is where anyone naturally writes a multi-line rationale
      // -- and a one-line reason is usually not enough to justify going under
      // the readability floor, so the gate was hardest to satisfy exactly where
      // the justification was most thorough. Four correctly-reasoned exemptions
      // were written above their `fontSize:` and reported as failures anyway.
      //
      // Scan backwards over the contiguous run of comment lines immediately
      // preceding this one; stop at the first line that is not a comment, so an
      // exemption cannot leak from an unrelated block further up.
      const markedAbove = (): boolean => {
        for (let j = i - 1; j >= 0; j--) {
          const t = (lines[j] ?? "").trim();
          if (!t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*"))
            return false;
          if (EXEMPT.test(t)) return true;
        }
        return false;
      };
      const marked =
        EXEMPT.test(ln) || EXEMPT.test(lines[i + 1] ?? "") || markedAbove();
      const num = raw.match(/^(\d+(?:\.\d+)?)$/);
      if (!num) {
        if (!marked) unresolved.push({ file, line: i + 1, text: ln.trim() });
        return;
      }
      const size = parseFloat(num[1]);
      if (size >= MIN_FONT) return;
      const hit = { file, line: i + 1, size, text: ln.trim() };
      (marked ? exempt : bad).push(hit);
    });
  }
}

const cap = (s: number) => (s * CAP_RATIO).toFixed(1);

console.log(
  `type floor: fontSize >= ${MIN_FONT}px (cap height >= ${CAP_FLOOR}px at 1080p, ` +
    `cap ratio ${CAP_RATIO})`,
);

if (unresolved.length) {
  console.log(
    `\n--- NON-LITERAL fontSize (${unresolved.length}) -- not checkable statically, read by hand ---`,
  );
  for (const u of unresolved) console.log(`  ${u.file}:${u.line}  ${u.text}`);
}

if (exempt.length) {
  console.log(`\n--- EXEMPTED (${exempt.length}) ---`);
  for (const e of exempt)
    console.log(
      `  ${String(e.size).padStart(3)}px  cap ${cap(e.size).padStart(5)}  ${e.file}:${e.line}`,
    );
}

console.log(`\n--- BELOW FLOOR (${bad.length}) ---`);
const byFile = new Map<string, Hit[]>();
for (const b of bad) byFile.set(b.file, [...(byFile.get(b.file) ?? []), b]);
for (const [f, hits] of [...byFile.entries()].sort(
  (a, b) => b[1].length - a[1].length,
)) {
  console.log(`  ${f}  (${hits.length})`);
  for (const h of hits.sort((a, b) => a.size - b.size))
    console.log(
      `      ${String(h.size).padStart(3)}px  cap ${cap(h.size).padStart(5)}  :${h.line}  ${h.text.slice(0, 78)}`,
    );
}

if (bad.length === 0) {
  console.log(
    `\nPASS: every literal fontSize clears the ${CAP_FLOOR}px cap-height floor ` +
      `or carries a reason.`,
  );
} else {
  console.log(
    `\nFAIL: ${bad.length} literal fontSize value(s) under ${MIN_FONT}px across ` +
      `${byFile.size} file(s).\n` +
      `Raise them to a TYPE tier, or mark "typesize-exempt: <reason>" if the ` +
      `text is texture the viewer is never asked to read.`,
  );
}
if (bad.length && !process.argv.includes("--report")) process.exit(1);
