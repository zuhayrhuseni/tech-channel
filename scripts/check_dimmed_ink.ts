/**
 * The DIMMED-INK gate.
 *
 * WHY THIS EXISTS: two r14 agents, working on different scenes and unaware of
 * each other, independently found the same defect and described it the same
 * way -- "the beat's own narrated words were painting 0.000% lit".
 *
 *   - TrickQuestion's `LaneBed` stacked an `opacity` ramp ON TOP OF a clip
 *     wipe, so the wipe's leading edge composited to ~17 luma against a >=25
 *     delta gate. The largest reveal in the beat was invisible at its own front.
 *   - HonestWalkback's slide type carried a second `lieA * 0.38` factor, net
 *     0.2356, driving theme.ink to 236 x 0.2356 = luma 55.6.
 *
 * Both are the same shape as the retire-cliff already in PRODUCTION-LESSONS:
 * a multiplier that is invisible in review because each factor looks
 * reasonable on its own, and only the PRODUCT crosses the threshold. Nobody
 * reviews a product.
 *
 * THE THRESHOLD. The pacing proxy calls a pixel lit at Rec.601 luma >= 110.
 * theme.ink is 236, so ink stops being lit at opacity 110/236 = 0.466. An
 * element painted in ink and capped below that contributes 0.000% to the lit
 * metric for its entire life -- it is on screen and it does not exist.
 *
 *   npx tsx scripts/check_dimmed_ink.ts          # report + fail on violations
 *   npx tsx scripts/check_dimmed_ink.ts --report # never fail, just print
 *
 * WHAT IT ACTUALLY COMPUTES. For each `opacity:` expression it takes the
 * product of the LITERAL factors only, treating every variable as 1.0. That
 * makes the result a CEILING: the true opacity is this or lower. If the
 * ceiling is already under 0.466, no runtime value can rescue it. That
 * asymmetry is the whole point -- it means a hit is a proof, not a guess,
 * and it is why this gate reports few things and each one is real.
 *
 * WHAT IT CANNOT SEE, so do not trust it alone:
 *   - A product of two VARIABLES that both run low at the same time. That is
 *     exactly the HonestWalkback bug once `0.38` is folded into a token, and
 *     this gate would miss it. Only the render measures that.
 *   - An ancestor opacity on a parent div. Same blind spot as the type gate
 *     has for ancestor `transform: scale()` -- static analysis does not walk
 *     the tree.
 *   - Whether the element is NARRATED CONTENT or a deliberate scrim. A dim
 *     ghost layer SHOULD be under the floor. That judgement is human, which
 *     is why the exemption below demands a reason rather than a flag.
 *
 * EXEMPTING A SITE. Scrims, ghost/echo layers, b-roll dimmers and idle
 * texture are legitimately unlit -- that is their job. Mark them:
 *
 *     opacity: 0.3 * sp, // dimmed-ink-exempt: idle grid texture behind the
 *                        // diagram, never narrated, must not compete
 *
 * An unexplained exemption is how a floor rots -- same rule as the contrast
 * and typesize gates.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const INK_LUMA = 236; // theme.ink #E6EDF3 in Rec.601
const LIT_LUMA = 110; // the pacing proxy's lit threshold
const FLOOR = LIT_LUMA / INK_LUMA; // 0.466

const EXEMPT = /dimmed-ink-exempt:\s*\S/;
const ROOTS = ["src"];

/**
 * Split on `*` that sit at paren/bracket depth 0.
 *
 * Returns null if the expression has a top-level `+` or `-`, because then it
 * is a SUM and not a product, and multiplying its parts is meaningless. The
 * first draft of this gate did exactly that and reported `1 - close * 0.3`
 * (which ranges 0.7..1.0) as a 0.300 cap. A gate that cries wolf gets
 * ignored, and an ignored gate is worse than no gate -- that is the whole
 * lesson of the round this file was written in.
 *
 * A leading unary minus is not a top-level operator, hence the i > 0 test.
 */
function topLevelFactors(expr: string): string[] | null {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (depth === 0 && i > 0 && (ch === "+" || ch === "-")) return null;
    if (ch === "*" && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * The largest value this factor can take. Unknown => 1.0, which keeps the
 * whole result a ceiling and keeps every hit a proof.
 */
function ceilingOf(factor: string): number {
  const lit = factor.match(/^(\d+(?:\.\d+)?)$/);
  if (lit) return parseFloat(lit[1]);
  // interpolate(x, [0, 1], [1, 0.22]) -- the output range's max bounds it.
  const interp = factor.match(/interpolate\s*\([^)]*\[([^\]]*)\]\s*\)/);
  if (interp) {
    const nums = interp[1]
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !Number.isNaN(n));
    if (nums.length) return Math.max(...nums);
  }
  return 1.0;
}

type Hit = { file: string; line: number; ceil: number; text: string };
const bad: Hit[] = [];
const exempt: Hit[] = [];

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
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((ln, i) => {
      if (/^\s*(\/\/|\*)/.test(ln)) return; // comment, not code
      const m = ln.match(/\bopacity:\s*([^,\n]+?),?\s*$/);
      if (!m) return;
      const expr = m[1].trim();
      if (!expr.includes("*")) return; // single factor: not this bug class
      const factors = topLevelFactors(expr);
      if (!factors) return; // a sum, not a product -- not decidable here
      const ceil = factors.reduce((a, f) => a * ceilingOf(f), 1);
      if (ceil >= FLOOR) return;
      // prettier wraps trailing comments onto the next line -- check both.
      const marked = EXEMPT.test(ln) || EXEMPT.test(lines[i + 1] ?? "");
      const hit = { file, line: i + 1, ceil, text: ln.trim() };
      (marked ? exempt : bad).push(hit);
    });
  }
}

console.log(
  `dimmed-ink floor: opacity ceiling >= ${FLOOR.toFixed(3)} ` +
    `(theme.ink ${INK_LUMA} x opacity must reach the lit threshold ${LIT_LUMA})`,
);

if (exempt.length) {
  console.log(`\n--- EXEMPTED (${exempt.length}) ---`);
  for (const e of exempt)
    console.log(
      `  ceil ${e.ceil.toFixed(3)} -> luma ${(e.ceil * INK_LUMA).toFixed(0).padStart(3)}  ${e.file}:${e.line}`,
    );
}

console.log(`\n--- CANNOT EVER BE LIT (${bad.length}) ---`);
for (const b of bad)
  console.log(
    `  ceil ${b.ceil.toFixed(3)} -> luma ${(b.ceil * INK_LUMA).toFixed(0).padStart(3)}  ` +
      `${b.file}:${b.line}\n      ${b.text.slice(0, 96)}`,
  );

if (bad.length === 0) {
  console.log(
    `\nPASS: no opacity expression caps ink below the lit threshold ` +
      `without a stated reason.`,
  );
} else {
  console.log(
    `\nFAIL: ${bad.length} site(s) cap opacity under ${FLOOR.toFixed(3)}.\n` +
      `If the element is narrated content, raise it -- it is currently ` +
      `contributing 0.000% to the lit metric.\n` +
      `If it is a scrim, ghost or idle texture, mark ` +
      `"dimmed-ink-exempt: <reason>".`,
  );
}
if (bad.length && !process.argv.includes("--report")) process.exit(1);
