/**
 * The DEAD SUB-REVEAL gate.
 *
 * Ten of the thirteen ep005 scenes stage their internal reveals the same way: a
 * published `NOMINAL` table giving each step's authored length in frames, and a
 * helper
 *
 *     sub(p, step, at, dur)  =>  ease((clamp01(p) * NOMINAL[step] - at) / dur)
 *
 * that converts the step's 0..1 progress back into that scene's own frame
 * space. The contract is invisible but strict: `at` is a frame offset INSIDE
 * the step, so it must be less than `NOMINAL[step]`.
 *
 * When it isn't, nothing breaks. Nothing throws, nothing renders wrong, nothing
 * looks suspicious in review. `p` still runs 0..1, the numerator just never
 * goes positive, `ease()` clamps at 0, and the sub-reveal SIMPLY NEVER RENDERS
 * A SINGLE FRAME. It is dead code that reads as live code.
 *
 * This is not hypothetical. Round 7 of ep005 shipped a render containing
 * exactly this: ThreeRules staged `rule1_draw` at offsets 405-429 against a
 * NOMINAL of 398, so with `p` pinned at 1 the numerator maxed out negative and
 * three authored reveals were absent from the cut. They were then "fixed" by
 * enlarging them, which changed nothing, because they had never been drawn.
 * The pacing grade blamed the beat for being static and it was, for a reason no
 * one could see by reading the scene.
 *
 * A defect that is silent, survives review, and wastes a whole render round is
 * the definition of something that should be checked mechanically.
 *
 *   npx tsx scripts/check_subreveals.ts
 *
 * TWO SEVERITIES:
 *   DEAD      at >= CEILING          — never renders. Always a bug.
 *   TRUNCATED at + dur > CEILING     — starts but never completes; the reveal
 *                                      is cut off mid-entrance at the step
 *                                      boundary. Usually a bug, occasionally
 *                                      deliberate for a reveal meant to be
 *                                      still moving as the next step takes
 *                                      over, so it warns rather than fails.
 *
 * CEILING IS NOT ALWAYS NOMINAL, and assuming it was is the hole this gate
 * shipped with. A step's `p` only reaches 1 if its ramp fits inside its beat.
 * In this episode the LAST step of every beat overruns the beat end by 8 frames
 * (3 for honest_walkback), because the plans deliberately let the final ramp
 * run past the cut so nothing is still easing when the scene changes. So `p`
 * tops out below 1 there, and the reachable local maximum is
 *
 *     ceiling = NOMINAL * min(1, (beatEnd - from) / ramp)
 *
 * three_rules' `hold_list` publishes a nominal of 379 but can only ever reach
 * ~371; a reveal authored at 375 renders zero frames while this gate, comparing
 * 375 < 379, prints PASS. That is the SAME silent-pass shape the file was
 * written to kill -- an instrument certifying a bound it never actually
 * measured -- reappearing one level up. The ceiling is now taken from the
 * resolved schedule rather than from the scene's own published table, and the
 * report names the clipped steps so the difference is visible, not implied.
 *
 * COVERAGE IS REPORTED, NOT ASSUMED. The episode speaks three staging dialects
 * (see the block comments below); all three are checked, but not all of them
 * are checkable to the same depth, and the difference is printed rather than
 * rounded off. Every scene lands in exactly one of three buckets in the summary:
 * frame-offset-checked, progress-unit-checked, or genuinely unchecked. A gate
 * that quietly skips a quarter of the episode while printing PASS is the
 * failure mode this whole file exists to prevent.
 *
 * A SCENE IS NOT ALWAYS A FILE IN scenes/. This gate scanned `src/e005/scenes`
 * only, on the assumption that a beat's reveals live in its scene file. Two
 * beats break it: modern_replication and drepper_curve render through
 * `src/components/RatioMorph.tsx` and `DrepperChart.tsx`, which carry 131 sub-
 * reveal call sites and their own step tables between them -- and were checked
 * by nothing, while the summary counted the episode as covered. That is this
 * file's own signature failure (an instrument reporting a bound it never
 * measured) at the level of which files it opens, and it survived four rounds.
 *
 * `src/components` is therefore scanned too, but ADMISSION IS BY CALL SITE, not
 * by directory: a component with zero sub-reveal calls has no reveals to check
 * and is not listed. Listing the whole shared library as "unchecked" would bury
 * the two files that matter under thirty that don't, and a report nobody reads
 * to the end is the same as no report.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { resolveEpisode } from "../src/episodes";

/**
 * Which episode's schedule and scene files this run measures. `--episode=<id>`,
 * defaulting to e005 — see src/episodes.ts. SCENE_DIR follows the episode;
 * COMPONENT_DIR does not, because src/components is shared by every episode.
 */
const EP = resolveEpisode();
const SCENE_DIR = join(__dirname, "..", ...EP.sceneDir.split("/"));
const COMPONENT_DIR = join(__dirname, "..", "src", "components");
const FAIL_ON_TRUNCATED = process.argv.includes("--strict");

/** Any sub-reveal call at all — the admission test for a component file. */
const ANY_CALL =
  /\b(sub|subOut|subIn|lsub|linSub|cue|stage|travelStage|travel|seg|exitSeg|entranceN|entrance)\(/;

/**
 * The files to scan, as (label, absolute path) pairs. Scene files are admitted
 * unconditionally — every one of them stages a beat, so a scene with no call
 * sites is itself a finding worth printing. Component files are admitted only
 * when they actually contain a sub-reveal call; see the header.
 */
const SOURCES: { label: string; path: string }[] = [
  ...readdirSync(SCENE_DIR)
    .filter((x) => x.endsWith(".tsx"))
    .map((x) => ({ label: x, path: join(SCENE_DIR, x) })),
  ...readdirSync(COMPONENT_DIR)
    .filter((x) => x.endsWith(".tsx"))
    .map((x) => ({ label: `components/${x}`, path: join(COMPONENT_DIR, x) }))
    .filter((s) => ANY_CALL.test(readFileSync(s.path, "utf8"))),
];

/**
 * step name -> the fraction of its own clock the step actually reaches.
 *
 * 1 for almost every step. Below 1 only where the ramp overruns the beat end,
 * which is one step per beat by design (see the header). Read off the RESOLVED
 * schedule, not off any table in a scene file: the scene tables are exactly
 * what can be out of date, and re-deriving the bound from the same source the
 * renderer uses is the only version of this check that can't drift away from it.
 *
 * Step names are globally unique across all fifteen beats (asserted below), so
 * a flat map is safe. If that ever stops being true, the assertion fires rather
 * than one beat's ceiling being silently applied to a same-named step in
 * another -- which would be this gate confidently checking the wrong bound.
 */
const REACH = new Map<string, number>();
for (const b of EP.schedule()) {
  const win = EP.beats.find((x) => x.id === b.beat);
  if (!win) continue;
  for (const [step, s] of Object.entries(b.slots)) {
    const slot = s as { from: number; to: number; ramp?: number };
    const ramp = slot.ramp ?? slot.to - slot.from;
    if (REACH.has(step))
      throw new Error(
        `step name "${step}" appears in more than one beat; the flat ceiling ` +
          `map above is no longer safe -- key it by beat before trusting this gate.`,
      );
    REACH.set(step, ramp > 0 ? Math.min(1, (win.end - slot.from) / ramp) : 1);
  }
}
/** Steps the beat end actually clips, for the report. */
const CLIPPED = [...REACH].filter(([, r]) => r < 1);

/**
 * Helpers with the signature (progress, "step", at, dur?).
 *
 * `lin` appears in BOTH this list and PROGRESS_HELPERS, because two scenes give
 * the same name two different signatures: TrickQuestion's `lin(p, "quote_card",
 * 12335, TYPE_FRAMES)` is a frame-dialect call, EndingTwoQuestions' `lin(t, a,
 * b)` is a progress-unit one. While `lin` was in only the progress list, its
 * eleven TrickQuestion typewriter reveals were checked by NEITHER path -- the
 * progress matcher saw the step string, failed to parse it as a number, and
 * filed it under "computed at runtime". A hole that presents as a harmless
 * unresolved-offset line is the most durable kind.
 *
 * The two are told apart by shape, not by name: arg 2 is a quoted string in the
 * frame dialect and never in the progress one. Each matcher tests for its own
 * shape, so a name can safely live in both lists.
 *
 * ADD A HELPER HERE THE MOMENT YOU WRITE ONE. `linSub` -- GoogleReceipts' linear
 * sibling of `sub`, added for count-ups because a cubic-out counter crawls --
 * was written and its call sites were invisible to this gate for a whole round:
 * `\bsub\(` does not match `linSub(`, there being no word boundary between "n"
 * and "s". The scene still printed as covered, with the new calls simply absent
 * from the count. This is the second time a helper has hidden this way (see
 * `travelStage` below), and both times the symptom was a number that looked
 * fine because nobody knew what it should have been.
 */
const HELPERS = ["sub", "subOut", "subIn", "lsub", "linSub", "cue", "lin"];
const CALL = new RegExp(
  `\\b(${HELPERS.join("|")})\\(` + // helper name
    `\\s*[^,()]*(?:\\([^()]*\\))?[^,()]*,` + // arg 1: the progress expression
    `\\s*"([A-Za-z0-9_]+)"\\s*,` + // arg 2: the step, always a string literal
    `\\s*(-?[\\d_]+(?:\\.\\d+)?)` + // arg 3: `at`, a frame offset
    `\\s*(?:,\\s*(-?[\\d_]+(?:\\.\\d+)?))?`, // arg 4: optional `dur`
  "g",
);

/**
 * TrickQuestion stages against ABSOLUTE composition frames, not step-relative
 * offsets: its `cue(p, step, atFrame, dur)` computes
 *
 *     (p * STEP_WINDOW[step].ramp - (atFrame - STEP_WINDOW[step].from)) / dur
 *
 * so the effective offset is `atFrame - from`, measured against `ramp`, and the
 * comparison every other scene makes -- `at` vs `NOMINAL[step]` -- is simply
 * the wrong arithmetic there.
 *
 * The first version of this gate didn't know that and reported all 50 of the
 * scene's reveals as DEAD, on the strength of "at 12859 vs NOMINAL 165". Fifty
 * confident findings, every one false, and acting on them would have destroyed
 * a working scene. Worth recording plainly: the instrument was wrong and its
 * output was fluent, which is exactly when a wrong instrument does damage.
 * Note also that `ramp` and NOMINAL genuinely differ (quote_card: 625 vs 542,
 * the `span` override) -- so the window table, not the nominal table, is the
 * truth for this scene.
 *
 * There are TWO window shapes in this episode and they mean opposite things.
 * The second key is what tells them apart, so it is matched explicitly rather
 * than guessed:
 *
 *   { from, ramp }  TrickQuestion — offsets are ABSOLUTE composition frames.
 *                   length = ramp, origin = from.
 *   { from, to }    HookRace — offsets are STEP-RELATIVE, exactly like the
 *                   plain-NOMINAL scenes; the window is only there to DERIVE
 *                   the step length. length = to - from, origin = 0.
 *
 * Reading a `{from, to}` table as if it were `{from, ramp}` would subtract an
 * origin that isn't there and mark HookRace's early reveals dead. Same class of
 * error as the TrickQuestion one above, so it gets the same explicitness.
 */
type Win = { length: number; origin: number };

/**
 * ROUND 13 — WHY THE BOUNDS ARE RESOLVED INSTEAD OF REQUIRED TO BE LITERALS.
 *
 * The first version of this matched `(-?\d+)` for `from`/`to`, which meant a
 * bound written as a named constant simply did not enter the map. HookRace's
 * `dim_to_stall: { from: 200, to: BEAT_FRAMES }` was unparseable, so the
 * consumer's `if (pub == null) continue;` skipped every reveal in that step --
 * SILENTLY. Worse, the CLIPPED report then printed the step as
 * "no frame-offset reveals authored in it", which is not an omission but an
 * affirmative false statement about coverage.
 *
 * That is this file's own failure mode: a gate that reports success over
 * something it never examined is more dangerous than no gate, because it stops
 * anyone from looking by hand. So bounds are now resolved against the scene's
 * module-level numeric constants, and anything still unresolvable is REPORTED
 * (see `windowUnresolved`) rather than dropped on the floor.
 *
 * Deliberately small grammar: a literal, a bare `IDENT`, or `IDENT ± literal`.
 * Anything richer (arithmetic on two idents, a call, a ternary) is not guessed
 * at -- it is named in the report and checked by hand. Guessing here would
 * re-create the exact class of bug this is fixing.
 */
function moduleConsts(src: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const [, k, v] of src.matchAll(
    /^(?:export\s+)?const\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*number\s*)?=\s*(-?[\d_]+(?:\.\d+)?)\s*;/gm,
  ))
    out.set(k, parseFloat(v.replace(/_/g, "")));
  return out;
}

/** A bound: literal, `IDENT`, or `IDENT ± literal`. null when not resolvable. */
function resolveBound(
  expr: string,
  consts: Map<string, number>,
): number | null {
  const e = expr.trim();
  if (/^-?[\d_]+(?:\.\d+)?$/.test(e)) return parseFloat(e.replace(/_/g, ""));
  const bare = e.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  if (bare) return consts.get(bare[1]) ?? null;
  const arith = e.match(
    /^([A-Za-z_][A-Za-z0-9_]*)\s*([+-])\s*(\d+(?:\.\d+)?)$/,
  );
  if (arith) {
    const base = consts.get(arith[1]);
    if (base == null) return null;
    return arith[2] === "+" ? base + +arith[3] : base - +arith[3];
  }
  return null;
}

const BOUND = String.raw`([A-Za-z_][A-Za-z0-9_]*\s*[+-]\s*\d+|-?[\d_]+|[A-Za-z_][A-Za-z0-9_]*)`;

function parseStepWindow(
  src: string,
  unresolved: string[],
): Record<string, Win> | null {
  const m = src.match(/const\s+[A-Z_]*(?:STEP_WINDOW|WINDOWS)[^=]*=\s*\{/);
  if (!m) return null;
  const body = src.slice(m.index!);
  const consts = moduleConsts(src);
  const out: Record<string, Win> = {};
  for (const [, k, from, ramp] of body.matchAll(
    new RegExp(
      String.raw`(\w+)\s*:\s*\{\s*from:\s*${BOUND}\s*,\s*ramp:\s*${BOUND}\s*\}`,
      "g",
    ),
  )) {
    const f = resolveBound(from, consts);
    const r = resolveBound(ramp, consts);
    if (f == null || r == null)
      unresolved.push(`${k}: { from: ${from}, ramp: ${ramp} }`);
    else out[k] = { length: r, origin: f };
  }
  for (const [, k, from, to] of body.matchAll(
    new RegExp(
      String.raw`(\w+)\s*:\s*\{\s*(?:readonly\s+)?from:\s*${BOUND}\s*,\s*(?:readonly\s+)?to:\s*${BOUND}\s*\}`,
      "g",
    ),
  )) {
    if (k in out) continue;
    const f = resolveBound(from, consts);
    const t = resolveBound(to, consts);
    if (f == null || t == null)
      unresolved.push(`${k}: { from: ${from}, to: ${to} }`);
    else out[k] = { length: t - f, origin: 0 };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Pull `key: number` pairs out of a NOMINAL object literal in source text.
 * Parsed rather than imported so the three scenes that keep the table module-
 * local (GoogleReceipts, MemoryWall, HonestWalkback) are covered too -- an
 * import-only version would have skipped them, and silently.
 */
function parseNominal(src: string): Record<string, number> | null {
  const m = src.match(/(?:export\s+)?const\s+[A-Z_]*NOMINAL[^=]*=\s*\{/);
  if (!m) return null;
  const start = src.indexOf("{", m.index!);
  let depth = 0,
    end = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const out: Record<string, number> = {};
  for (const [, k, v] of src
    .slice(start, end)
    .matchAll(/(?:^|\n)\s*"?([A-Za-z0-9_]+)"?\s*:\s*(-?[\d_]+(?:\.\d+)?)\s*,/g))
    out[k] = parseFloat(v.replace(/_/g, ""));
  return Object.keys(out).length ? out : null;
}

/**
 * THE THIRD SHAPE: offsets in PROGRESS UNITS rather than frames.
 *
 * The remaining three scenes never name a step in the call at all -- they take
 * the step's 0..1 progress directly and slice sub-windows out of it:
 *
 *   LatencyLadder      stage(v, a, w)              -> ease(raw(v, a, a + w))
 *   SweepVsChase       entranceN(v, from, step, f) -> clamp01((v - from) / ...)
 *   EndingTwoQuestions seg(t, a, b)                -> interpolate(t, [a, b], ...)
 *
 * It is the SAME defect with a different unit. `v` cannot exceed 1, so an
 * offset >= 1 makes the numerator permanently negative, clamp01 pins it at 0,
 * and the reveal never renders -- exactly as `at >= NOMINAL` does in frame
 * space. Skipping these three as "a different idiom" would have left a quarter
 * of the episode unguarded against the very bug this file was written for.
 *
 * An offset that is a plain numeric literal, or a module-level `const NAME =
 * 0.42`, is resolved and checked. One computed at runtime (`fr(30, "step")`,
 * `SEG_AT - PACKET_AT`) can't be evaluated statically; those are counted and
 * named in the report rather than passed over in silence.
 *
 * THE HELPER LIST IS THE COVERAGE. A helper missing from it is not reported as
 * unchecked -- it is invisible, which is strictly worse, because the summary
 * then counts the scene as covered. That happened: `travelStage` was absent
 * while `travel` was present, and `\btravel\(` does not match `travelStage(`,
 * so LatencyLadder's two RAM-travel windows were neither checked nor counted
 * while the scene printed as verified. Any new sub-window helper must be added
 * here at the moment it is written.
 */
const PROGRESS_HELPERS = [
  "stage",
  "travelStage", // must precede "travel": alternation is first-match, and a
  "travel", //      bare "travel" would otherwise swallow the longer name.
  "seg",
  "exitSeg",
  "lin",
  "entranceN", // likewise before "entrance".
  "entrance",
];
const PCALL = new RegExp(
  `\\b(${PROGRESS_HELPERS.join("|")})\\(` +
    `\\s*[^,()]*(?:\\([^()]*\\))?[^,()]*,` + // arg 1: progress
    `\\s*([^,()]+?)\\s*(?:,|\\))`, // arg 2: the offset, literal or not
  "g",
);

type Finding = {
  file: string;
  line: number;
  step: string;
  at: number;
  dur: number | null;
  /** The bound actually enforced: the reachable ceiling, not the published one. */
  nominal: number;
  /** What the scene's own table claims, kept so the report can show both when
   *  they differ -- "at 375 vs NOMINAL 379" reads as a near miss, whereas
   *  "at 375 vs reachable 371 (published 379)" names the real cause. */
  published: number;
  kind: "DEAD" | "TRUNCATED";
};

const findings: Finding[] = [];
/** Per-scene coverage, so the summary can name what each dialect actually saw. */
type Cover = {
  frame: number;
  progress: number;
  nonLiteral: number;
  hasNominal: boolean;
  /** The exact offset expressions this gate could NOT evaluate, verbatim. */
  unresolved: string[];
  /** Steps in this scene whose reachable ceiling is below their published length. */
  clipped: Set<string>;
  /** Window entries whose from/to bounds this gate could NOT resolve, verbatim. */
  windowUnresolved: string[];
  /** step -> count of calls against a step absent from this scene's table. */
  unknownStep: Map<string, number>;
};
const cover = new Map<string, Cover>();
let checkedCalls = 0;
let progressCalls = 0;
let nonLiteral = 0;
let unknownStepCalls = 0;

for (const { label: f, path } of SOURCES) {
  const src = readFileSync(path, "utf8");
  const lineAt = (idx: number) => src.slice(0, idx).split("\n").length;
  const cov: Cover = {
    frame: 0,
    progress: 0,
    nonLiteral: 0,
    hasNominal: false,
    unresolved: [],
    clipped: new Set<string>(),
    windowUnresolved: [],
    unknownStep: new Map<string, number>(),
  };
  cover.set(f, cov);

  // Module-level numeric constants, so `travelStage(l3, PACKET_AT, ...)` is
  // CHECKED rather than merely counted as unresolvable. These named offsets are
  // the ones most worth checking: a bare 0.42 gets eyeballed at the call site,
  // whereas a constant defined 300 lines away is exactly where an offset drifts
  // past 1 without anyone noticing.
  const consts = new Map<string, number>();
  for (const [, k, v] of src.matchAll(
    /^const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?[\d.]+)\s*;/gm,
  ))
    consts.set(k, parseFloat(v));

  // Parameter names of the sub-window helpers themselves, so a wrapper that
  // forwards its own argument isn't mistaken for an unresolvable offset.
  const helperParams = new Set<string>();
  for (const h of PROGRESS_HELPERS) {
    const d = src.match(new RegExp(`const\\s+${h}\\s*=\\s*\\(([^)]*)\\)`));
    if (!d) continue;
    for (const p of d[1].split(","))
      helperParams.add(p.trim().split(":")[0].trim());
  }

  // --- the progress-unit dialect, checked in every scene that uses it -------
  for (const m of src.matchAll(PCALL)) {
    const arg = m[2].trim();
    // A DELEGATING WRAPPER is not an unchecked offset. SweepVsChase's
    // `entrance(v, from, step) => entranceN(v, from, step, ENTRANCE_FRAMES)`
    // forwards its own parameter, so the inner call's offset is whatever the
    // OUTER call passed -- and every outer call is already checked below. Left
    // unclassified it printed `NOT CHECKABLE: from`, a finding about nothing,
    // in a list whose entire value is that every line in it is worth reading.
    // One wolf-cry and the list stops being read.
    if (helperParams.has(arg)) continue;
    // A quoted arg 2 means this is a frame-dialect call that merely shares a
    // helper name (see HELPERS). The frame matcher owns it; claiming it here
    // would double-count it and, worse, report it as unresolvable.
    if (/^["']/.test(arg)) continue;
    const resolved = /^-?\d+(\.\d+)?$/.test(arg)
      ? arg
      : consts.has(arg)
        ? String(consts.get(arg))
        : null;
    if (resolved == null) {
      nonLiteral++;
      cov.nonLiteral++;
      cov.unresolved.push(`${arg} (line ${lineAt(m.index!)})`);
      continue;
    }
    progressCalls++;
    cov.progress++;
    const a = parseFloat(resolved);
    if (a >= 1)
      findings.push({
        file: f,
        line: lineAt(m.index!),
        step: `${m[1]}() progress-unit`,
        at: a,
        dur: null,
        // The progress-unit dialect has no step to clip: its bound is the
        // universal `offset < 1`, so published and enforced are the same 1 and
        // the report's "(clipped by beat end)" note correctly stays off.
        nominal: 1,
        published: 1,
        kind: "DEAD",
      });
  }

  // A window table, where present, OUTRANKS the nominal table: it is what the
  // scene's own helper actually divides by.
  const windows = parseStepWindow(src, cov.windowUnresolved);
  const nominal = windows
    ? Object.fromEntries(Object.entries(windows).map(([k, w]) => [k, w.length]))
    : parseNominal(src);
  const originFor = (step: string) =>
    windows ? (windows[step]?.origin ?? 0) : 0;
  if (!nominal) continue;
  cov.hasNominal = true;

  for (const m of src.matchAll(CALL)) {
    const step = m[2];
    // Rebase absolute-frame idioms onto the step's own origin. For every other
    // scene originFor() is 0 and this is a no-op.
    const at = parseFloat(m[3].replace(/_/g, "")) - originFor(step);
    const dur = m[4] != null ? parseFloat(m[4].replace(/_/g, "")) : null;
    const pub = nominal[step];
    if (pub == null) {
      // NOT a no-op. This branch used to be a bare `continue` with a comment
      // asserting the step came from another module -- an assumption the gate
      // never tested. It is equally the shape of a step whose window failed to
      // parse, which is how HookRace's `dim_to_stall` reveals went unchecked
      // while the summary still counted the scene as covered. Record it and
      // print it; an unexamined call is a coverage hole either way, and the
      // human reading the report is the one qualified to tell the two apart.
      cov.unknownStep.set(step, (cov.unknownStep.get(step) ?? 0) + 1);
      unknownStepCalls++;
      continue;
    }
    checkedCalls++;
    cov.frame++;
    // The enforced bound is what `p` can actually reach, which is the published
    // length only when the step's ramp fits inside its beat. See REACH above.
    const reach = REACH.get(step) ?? 1;
    const nom = pub * reach;
    if (reach < 1) cov.clipped.add(step);
    if (at >= nom)
      findings.push({
        file: f,
        line: lineAt(m.index!),
        step,
        at,
        dur,
        nominal: nom,
        published: pub,
        kind: "DEAD",
      });
    else if (dur != null && at + dur > nom)
      findings.push({
        file: f,
        line: lineAt(m.index!),
        step,
        at,
        dur,
        nominal: nom,
        published: pub,
        kind: "TRUNCATED",
      });
  }
}

const dead = findings.filter((f) => f.kind === "DEAD");
const trunc = findings.filter((f) => f.kind === "TRUNCATED");

// Three buckets, and the point of splitting them is that they are NOT equally
// strong evidence. A frame-offset scene is checked against its own published
// step lengths -- that is the real contract. A progress-unit scene is only
// checked against the universal `offset < 1` bound, which catches the dead-
// reveal bug but says nothing about whether the offset is well-placed inside
// the step. Collapsing the two into one "checked" number would overstate what
// this gate knows, and overstating coverage is how a gate stops being read.
const scenes = [...cover.entries()];
const frameScenes = scenes.filter(([, c]) => c.hasNominal && c.frame > 0);
const progScenes = scenes.filter(([, c]) => !c.hasNominal && c.progress > 0);
const unchecked = scenes.filter(
  ([, c]) => !(c.hasNominal && c.frame > 0) && c.progress === 0,
);

console.log(`=== sub-reveal offsets vs published step lengths ===`);
console.log(
  `    ${checkedCalls} frame-offset reveals across ${frameScenes.length} scenes` +
    `  |  ${progressCalls} progress-unit offsets across ${progScenes.length} scenes`,
);

const show = (label: string, list: Finding[], note: string) => {
  if (!list.length) return;
  console.log(`\n--- ${label} (${list.length}) --- ${note}`);
  for (const f of list.sort((a, b) => b.at - b.nominal - (a.at - a.nominal)))
    console.log(
      `  ${f.file}:${f.line}  step "${f.step}"  at ${f.at}` +
        (f.dur != null ? ` dur ${f.dur}` : "") +
        `  vs ceiling ${f.nominal.toFixed(1)}` +
        // Naming the clip is most of the fix. Without it the line reads as an
        // off-by-four against the published table and gets "fixed" by editing
        // the offset, when the actual cause is that the step's ramp runs past
        // its beat end and those last frames are never rendered at all.
        (f.published !== f.nominal
          ? ` (published ${f.published}, clipped by beat end)`
          : "") +
        (f.kind === "DEAD"
          ? `  -> starts ${(f.at - f.nominal).toFixed(0)}f AFTER the step ends`
          : `  -> ${(f.at + (f.dur ?? 0) - f.nominal).toFixed(0)}f of the entrance is cut off`),
    );
};

show("DEAD — never renders a single frame", dead, "always a bug");
show(
  "TRUNCATED — entrance clipped at the step boundary",
  trunc,
  "usually a bug",
);

// PRINTED EVEN WHEN EVERYTHING PASSES. These are the steps whose usable length
// is smaller than the number written in the scene's own table -- the trap that
// makes an offset look safe at the call site. Anyone about to author a reveal
// late in one of these steps needs the real ceiling in front of them, and the
// only reliable moment to hand it over is every run, not the run where it has
// already been violated.
if (CLIPPED.length) {
  console.log(
    `\n--- REACHABLE CEILING BELOW PUBLISHED LENGTH (${CLIPPED.length} steps) ---` +
      `\n    The last step of a beat is authored to run past the cut, so its ` +
      `\`p\` never reaches 1.` +
      `\n    Offsets in these steps are checked against the smaller number:`,
  );
  for (const [step, r] of CLIPPED.sort((a, b) => a[1] - b[1])) {
    const owner = scenes.find(([, c]) => c.clipped.has(step));
    // "no reveals authored in it" is a CLAIM ABOUT THE CODE, and this report has
    // no standing to make it unless every call against the step was actually
    // examined. When the step shows up in `unknownStep` the truth is the
    // opposite -- reveals exist and were skipped -- and printing the reassuring
    // sentence there is how `dim_to_stall` stayed invisible for four rounds.
    const skipped = scenes.find(([, c]) => c.unknownStep.has(step));
    console.log(
      `  ${step.padEnd(24)} reaches ${(r * 100).toFixed(1)}% of its clock` +
        (owner
          ? `   (${owner[0]})`
          : skipped
            ? `   !! ${skipped[1].unknownStep.get(step)} reveal(s) in ${skipped[0]} NOT CHECKED`
            : `   (no frame-offset reveals authored in it)`),
    );
  }
}

if (progScenes.length) {
  console.log(
    `\n--- PROGRESS-UNIT ONLY (${progScenes.length} scenes) — no NOMINAL table; ` +
      `checked against the universal offset < 1 bound ---`,
  );
  for (const [f, c] of progScenes)
    console.log(`  ${f} — ${c.progress} offset(s) verified`);
}

// Unresolvable offsets are listed for EVERY scene, not just the progress-unit
// ones. A scene with a NOMINAL table can still use progress-unit sub-windows,
// and the first version printed these only under the progress-unit heading --
// so the summary said "5 skipped" while the body showed four. A total that
// doesn't reconcile with the list beneath it is how a report stops being
// trusted, and this file's whole claim is that its coverage number is honest.
const withUnresolved = scenes.filter(([, c]) => c.unresolved.length);
if (withUnresolved.length) {
  console.log(
    `\n--- OFFSETS NOT STATICALLY CHECKABLE (${nonLiteral}) — computed at runtime; read these by hand ---`,
  );
  for (const [f, c] of withUnresolved)
    for (const u of c.unresolved) console.log(`  ${f}:  ${u}`);
}

// THE HOLE THAT HID `dim_to_stall`. Both of these were previously silent: a
// window entry the parser couldn't read just never entered the map, and a call
// against a step missing from the map hit a bare `continue`. Neither showed up
// anywhere in the output, so the scene still counted as covered and the summary
// still said PASS. Coverage you can't see isn't coverage.
const withBadWindows = scenes.filter(([, c]) => c.windowUnresolved.length);
if (withBadWindows.length) {
  console.log(
    `\n--- STEP-WINDOW BOUNDS NOT RESOLVABLE — every reveal in these steps is UNCHECKED ---`,
  );
  for (const [f, c] of withBadWindows)
    for (const w of c.windowUnresolved) console.log(`  ${f}:  ${w}`);
}

const withUnknownSteps = scenes.filter(([, c]) => c.unknownStep.size);
if (withUnknownSteps.length) {
  console.log(
    `\n--- REVEALS AGAINST A STEP NOT IN THE SCENE'S TABLE (${unknownStepCalls}) ---` +
      `\n    Either the step is defined in another module (fine, check once), or its` +
      `\n    window failed to parse (a real hole). This gate cannot tell them apart:`,
  );
  for (const [f, c] of withUnknownSteps)
    for (const [step, n] of [...c.unknownStep].sort())
      console.log(`  ${f}:  ${step.padEnd(24)} ${n} reveal(s) skipped`);
}

if (unchecked.length) {
  console.log(
    `\n--- NOT CHECKED (${unchecked.length} scenes) — verify these by hand ---`,
  );
  for (const [f, c] of unchecked)
    console.log(
      `  ${f} — no NOMINAL table and no literal progress-unit offsets` +
        (c.nonLiteral
          ? ` (${c.nonLiteral} runtime-computed offsets present)`
          : ""),
    );
}

const failed = dead.length > 0 || (FAIL_ON_TRUNCATED && trunc.length > 0);
console.log(
  `\n${failed ? "FAIL" : "PASS"}: ${dead.length} dead, ${trunc.length} truncated` +
    ` | coverage ${frameScenes.length} frame-offset + ${progScenes.length} progress-unit` +
    ` scenes, ${unchecked.length} unchecked, ${nonLiteral} non-literal offsets skipped` +
    `, ${unknownStepCalls} unknown-step reveals skipped`,
);
if (failed) process.exit(1);
