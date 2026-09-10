/**
 * The CONTRAST FLOOR gate.
 *
 * WHY THIS EXISTS: rounds 5 through 7 of ep005 all chased the same symptom --
 * beats that measured busy and looked dead -- and all three misdiagnosed it as
 * reveal AREA. Round 7 enlarged ~30 sub-reveals and moved the median event ink
 * from 0.80% to 0.81% of frame, because area was never the problem. The r7
 * video-grader found the actual cause by measuring pixels: 87.8% of the
 * episode's pixels sat below luma 40 and idle geometry was drawn at ~1.05:1
 * against pure black. Unfilled structure was being painted as white or accent
 * at alpha 0.05-0.18 over #000000.
 *
 * That is not a rendering bug and not a pacing bug. It is a colour-literal bug,
 * repeated in nineteen places, and it is invisible in code review because
 * `rgba(255,255,255,0.12)` reads as a perfectly reasonable hairline until you
 * work out that over black it is 1.08:1.
 *
 * The stake is bigger than aesthetics. The pacing detector gates on |dY| >= 25.
 * On a luma-17 background an element at luma 40 gives dY 23 -- just under. So
 * whether a reveal COUNTED AS A CONTENT EVENT AT ALL was being decided by two
 * luma levels of an alpha nobody had ever computed. A single careless 0.15
 * could silently delete a sub-reveal from the pacing table.
 *
 * So the floor gets a gate. Contrast is a property you can check statically,
 * and a property that can regress silently is exactly the kind that needs one.
 *
 *   npx tsx scripts/check_contrast.ts          # report + fail on violations
 *   npx tsx scripts/check_contrast.ts --report # never fail, just print
 *
 * EXEMPTING A SITE. Some low-contrast paint is correct: drop shadows, scrims,
 * vignettes, gradient stops, and grouping washes that sit UNDER an element
 * whose own border already carries the signal. Mark those at the call site:
 *
 *     background: "rgba(88, 166, 255, 0.20)", // contrast-exempt: row wash,
 *                                             // arrival is on the 8.3:1 border
 *
 * The marker must give a REASON. "contrast-exempt" alone is not accepted --
 * an unexplained exemption is how the floor rots back to 1.05:1.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import {
  contrastOnBg,
  IDLE_MIN_CONTRAST,
  theme as THEME,
} from "../src/components/theme";

const REPORT_ONLY = process.argv.includes("--report");
const ROOT = join(__dirname, "..", "src");

/** Properties whose value is paint the viewer is meant to SEE as structure. */
const PAINT_PROP =
  /\b(background|backgroundColor|border|borderColor|borderTop|borderBottom|borderLeft|borderRight|color|fill|stroke|outline)\b/;

/**
 * Categories where low contrast is the POINT, keyed off the surrounding text.
 * Deliberately narrow: `shadow` and `scrim` are genuinely always-exempt, but
 * anything vaguer (a variable called `subtle`, say) has to earn it with an
 * explicit marker, because "it's meant to be subtle" is precisely the reasoning
 * that produced the 1.05:1 grid.
 */
const ALWAYS_EXEMPT =
  /boxShadow|textShadow|dropShadow|filter:|scrim|vignette|linear-gradient|radial-gradient|backdropFilter/i;

const EXEMPT_MARKER = /contrast-exempt:.*/;

/**
 * The bug class is narrower than "anything dark", and saying so precisely is
 * what keeps this gate worth running.
 *
 * A near-black fill -- rgba(0,0,0,0.88), rgba(13,17,23,0.6) -- is a BACKING
 * PLATE. It is dark on purpose, it is what the bright thing sits on, and
 * raising it would wash out the very contrast this gate is defending. Flagging
 * plates would bury the real hits in noise and the gate would get muted, which
 * is the normal way a linter dies.
 *
 * The actual defect is always the same shape: a colour that is PERFECTLY
 * VISIBLE at full strength, destroyed by an alpha nobody costed. accent at
 * alpha 1.0 is 8.31:1; at 0.18 it is 1.25:1. So the test is on the SOURCE
 * colour, not the composite -- if the paint would clear the floor opaque, then
 * a sub-floor result means the alpha is the bug and raising it is the fix.
 */
const sourceIsStructural = (r: number, g: number, b: number) =>
  contrastOnBg(r, g, b) >= IDLE_MIN_CONTRAST;

type Hit = {
  file: string;
  line: number;
  text: string;
  colour: [number, number, number];
  ratio: number;
  exempt: string | null;
};

const files: string[] = [];
(function walk(dir: string) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(ROOT);

/** rgba(r,g,b,a) composited over pure black -- the background this episode uses. */
const RGBA = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g;
/** #rrggbbaa -- the hex-alpha idiom (`${theme.accent}1A`) that hides an alpha. */
const HEXA = /#([0-9a-fA-F]{6})([0-9a-fA-F]{2})\b/g;
/**
 * `alpha(theme.down, 0.35)` -- a token dimmed through a helper.
 *
 * THE THIRD WAY TO HIDE AN ALPHA, and the one that cost the most to find. This
 * gate reads colour LITERALS, so any alpha that reaches the DOM through a
 * variable or a helper call is invisible to it. RatioMorph's warm plate sat at
 * 2.9983:1 -- a genuine miss -- and this gate reported the file clean, because
 * the alpha was the named constant PLATE_ALPHA_WARM rather than a number inside
 * an rgba(). The scene's own hand-written guard caught it; the general gate did
 * not. A checker whose blind spot is "the tidy way to write it" rewards writing
 * it untidily.
 *
 * Named constants still can't be resolved from here without evaluating the
 * module, so this closes the helper form only, and the token-assertion block
 * below is what keeps the tokens themselves honest. Scenes with a ladder of
 * derived alphas should keep a module-level guard of their own, as RatioMorph
 * does -- that is the pattern, not a workaround.
 */
const TOKEN_ALPHA = /\balpha\(\s*theme\.([a-zA-Z]+)\s*,\s*([\d.]+)\s*\)/g;

const hits: Hit[] = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  // A paint value routinely spans several lines -- prettier breaks a ternary
  // like `background: loaded ? "rgba(...)" : "transparent"` across four of
  // them, and the colour literals land on lines that contain no property name
  // at all. Matching line-by-line therefore misses exactly the multi-state
  // fills that matter most (MemoryGrid's cell background is a four-way ternary
  // and was silently skipped by the first version of this gate). So a property
  // line claims the more-indented lines that follow it.
  const paintLines = new Set<number>();
  lines.forEach((text, i) => {
    if (!PAINT_PROP.test(text)) return;
    paintLines.add(i);
    const indent = text.search(/\S/);
    for (let j = i + 1; j < lines.length && j <= i + 10; j++) {
      const nxt = lines[j];
      if (!nxt.trim()) break;
      const ni = nxt.search(/\S/);
      if (ni <= indent) break;
      paintLines.add(j);
    }
  });

  lines.forEach((text, i) => {
    if (!paintLines.has(i)) return;
    if (ALWAYS_EXEMPT.test(text)) return;

    // An exemption applies to the line it sits on, or to the line directly
    // below the comment block it sits in. Scanning a symmetric window around
    // the hit instead -- the obvious first implementation -- let one branch of
    // a ternary claim the marker written for the branch BELOW it, which is the
    // one failure mode a gate like this must not have: an exemption silently
    // covering a site nobody exempted. So: walk back only through an unbroken
    // run of comment lines, and stop at the first line of real code.
    let marker: string | null = text.match(EXEMPT_MARKER)?.[0] ?? null;
    for (let j = i - 1; j >= 0 && !marker; j--) {
      // Strip a leading ternary token: prettier puts the `?` / `:` on the same
      // line as the comment that opens that branch, so the first line of an
      // exemption block routinely reads `? // contrast-exempt: ...`.
      const t = lines[j].trim().replace(/^[?:]\s*/, "");
      if (!(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")))
        break;
      marker = t.match(EXEMPT_MARKER)?.[0] ?? null;
    }

    const push = (r: number, g: number, b: number, a: number) => {
      if (!sourceIsStructural(r, g, b)) return; // a backing plate, not structure
      const [cr, cg, cb] = [r * a, g * a, b * a]; // over #000000
      const ratio = contrastOnBg(cr, cg, cb);
      if (ratio >= IDLE_MIN_CONTRAST) return;
      hits.push({
        file: file.replace(join(__dirname, ".."), "").replace(/^\//, ""),
        line: i + 1,
        text: text.trim().slice(0, 74),
        colour: [cr, cg, cb],
        ratio,
        exempt: marker,
      });
    };

    let m: RegExpExecArray | null;
    RGBA.lastIndex = 0;
    while ((m = RGBA.exec(text))) push(+m[1], +m[2], +m[3], parseFloat(m[4]));
    TOKEN_ALPHA.lastIndex = 0;
    while ((m = TOKEN_ALPHA.exec(text))) {
      // Record<string, unknown>, not Record<string, string>: theme carries a
      // nested `type` scale alongside its colour tokens, so the narrower cast
      // is a type error rather than a convenience. The typeof guard below is
      // what actually makes this safe -- `alpha(theme.type, 0.5)` is nonsense
      // no gate should crash on, and it is silently skipped instead.
      const tok = (THEME as Record<string, unknown>)[m[1]];
      const hex = typeof tok === "string" ? tok : undefined;
      if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) continue;
      push(
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
        parseFloat(m[2]),
      );
    }
    HEXA.lastIndex = 0;
    while ((m = HEXA.exec(text))) {
      const h = m[1];
      push(
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        parseInt(m[2], 16) / 255,
      );
    }
  });
}

// --- the token assertions. These are not style; they are the floor itself. ---
const tokenFails: string[] = [];
{
  const { theme, IDLE_FILL } = require("../src/components/theme");
  const hex = (h: string) =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
      number,
      number,
      number,
    ];
  const check = (name: string, c: [number, number, number]) => {
    const r = contrastOnBg(c[0], c[1], c[2]);
    const ok = r >= IDLE_MIN_CONTRAST;
    // FOUR decimals, not two. RatioMorph's warm plate measured 2.9983:1 -- a
    // real miss -- and printed as "3.00:1", which reads as a float-boundary
    // quirk in the checker rather than a value that is actually under the
    // floor. An hour went into doubting the instrument instead of fixing the
    // number. A gate must never round a failure into looking like a pass.
    console.log(
      `  ${ok ? "OK  " : "FAIL"} ${name.padEnd(24)} ${r.toFixed(4)}:1`,
    );
    if (!ok) tokenFails.push(name);
  };
  console.log("=== theme tokens that carry IDLE STRUCTURE ===");
  check("theme.stroke", hex(theme.stroke));
  check("theme.dim", hex(theme.dim));
  check("theme.ink", hex(theme.ink));
  check("theme.accent", hex(theme.accent));
  const im = IDLE_FILL.match(/([\d.]+)\)\s*$/);
  check(
    "IDLE_FILL",
    [255, 255, 255].map((v) => v * parseFloat(im[1])) as [
      number,
      number,
      number,
    ],
  );
  console.log(
    `  (theme.hairline is deliberately below the floor -- it is the` +
      ` decorative-only token, not structure.)`,
  );
}

const violations = hits.filter((h) => !h.exempt);
const exempted = hits.filter((h) => h.exempt);

console.log(
  `\n=== paint below the ${IDLE_MIN_CONTRAST.toFixed(1)}:1 idle floor ===`,
);
console.log(
  `    scanned ${files.length} files; ${violations.length} unexplained, ${exempted.length} exempt`,
);
if (violations.length) {
  console.log(`\n${"ratio".padStart(7)}  site`);
  for (const h of violations.sort((a, b) => a.ratio - b.ratio)) {
    console.log(`${h.ratio.toFixed(4).padStart(8)}:1  ${h.file}:${h.line}`);
    console.log(`           ${h.text}`);
  }
  console.log(
    `\nEach of these is drawn as structure and measures below ${IDLE_MIN_CONTRAST}:1 over` +
      `\nblack -- invisible on a phone, and close enough to the detector's dY>=25` +
      `\ngate that it may not register as a content event at all. Raise the alpha,` +
      `\nor mark it "contrast-exempt: <reason>" if the low value is deliberate.`,
  );
}
if (exempted.length) {
  console.log(`\n--- exempt (reason given) ---`);
  for (const h of exempted.sort((a, b) => a.ratio - b.ratio))
    console.log(
      `${h.ratio.toFixed(4).padStart(8)}:1  ${h.file}:${h.line}  ${h.exempt}`,
    );
}

const failed = tokenFails.length > 0 || violations.length > 0;
console.log(
  `\n${failed ? "FAIL" : "PASS"}: ${tokenFails.length} token failures, ` +
    `${violations.length} unexplained low-contrast sites`,
);
if (failed && !REPORT_ONLY) process.exit(1);
