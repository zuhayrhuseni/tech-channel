/**
 * The WORD-SYNC gate.
 *
 * WHY THIS EXISTS: the scene files pin their reveals to word frames written in
 * COMMENTS, and several of those frames were MODELLED (~11.15 frames/word)
 * rather than measured. A modelled frame is invisible in review because the
 * comment looks derived -- it has a number, it has a word, it reads like it was
 * read off something. Two confirmed instances:
 *
 *   - HookRace `focus` resolved to f546 under a comment claiming its word was
 *     @545. The word "Your" is at f565. f545 is the `[deadpan]` AUDIO TAG.
 *     v3 PERFORMS tags, it does not SPEAK them -- so the cue fired 19 frames
 *     (0.63s) into a measured silence, on a token that makes no sound.
 *   - RealSystemPayoff `halfBandIn` fired at f16556 under a comment claiming
 *     "half" @16558; the measured word HALF is at f16543. Thirteen frames late.
 *
 * Sync is weighted 2x in docs/animation-review-rubric.md and LATE is the worst
 * failure mode it names. This gate makes the whole class decidable instead of
 * reviewable.
 *
 *   npx tsx scripts/check_wordsync.ts            # report + fail on defects
 *   npx tsx scripts/check_wordsync.ts --report   # never fail, just print
 *
 * ------------------------------------------------------------------------
 * GROUND TRUTH, and why it is not timing.json
 *
 * timing.json carries ONLY per-beat `startFrame`/`startMs` plus a handful of
 * named anchor `marks`. It is NOT a per-word source and using it as one is how
 * the frames-per-word model got invented in the first place.
 *
 * The real per-word alignment is ElevenLabs' own character alignment, cached
 * per v3 chunk in `.tts_cache/<hash>.json` as `{spoken:[[word, seconds]], dur}`.
 *
 * THE TRAP: `.tts_cache` holds MULTIPLE TAKES of the same chunk and the stale
 * ones are not marked. Nothing in the filename, the JSON, or the mtime says
 * which one shipped. `5c1e084d42ed2649` and `862f22cb4dfae688` both open with
 * "Why does one of these two loops finish NINETY times faster"; they disagree
 * by ~20 frames throughout, and only the second is in the cut. Picking wrong
 * poisons every frame downstream of it, silently.
 *
 * So the shipped take is identified by TWO INDEPENDENT discriminators and a
 * candidate has to satisfy both:
 *
 *   1. BOUNDARY ALIGNMENT. make_tts.py's v3 path slices each chunk into its
 *      beats and concatenates them in order, so a chunk's audio survives
 *      contiguously: its origin IS some beat's `startFrame` and
 *      `origin + round(dur * fps)` IS another beat's `startFrame` (or the
 *      episode end). Chunks span MULTIPLE beats -- there is no one-chunk-per-
 *      beat assumption anywhere in here. The residual is small and one-signed
 *      (the alignment's `dur` runs a few ms past the sliced wav), hence
 *      BOUNDARY_TOL_F below.
 *   2. SILENCE AGREEMENT. Score a placement by the fraction of its real words
 *      whose onset lands inside a MEASURED silence in narration.master.wav.
 *      The shipped take scores low (4-10%, which is just onsets grazing a
 *      detector edge); a stale take strands a quarter of its words in silence.
 *
 * Both, not either. On this episode boundary alignment alone leaves one of the
 * seven slots ambiguous (two candidates both landing on f13474) and silence
 * agreement splits them 0.080 vs 0.285. Where they do NOT agree the slot is
 * reported UNVERIFIED and every cue inside it is reported as unverified rather
 * than quietly graded against a guess.
 *
 * A THIRD, INDEPENDENT corroboration runs as a self-check: every `mark` in
 * timing.json names the word it landed on, and all 26 of them must find that
 * word, spelled the same, within 1 frame of the reconstructed timeline. That
 * covers all seven slots (the two hand anchors only cover two) and it is what
 * makes the f10421 slot safe to call verified rather than "best of two".
 *
 * Silences come from
 *   ffmpeg -i narration.master.wav -af silencedetect=noise=-35dB:d=0.3 -f null -
 * whose detections print on STDERR. Capturing stdout instead reports ZERO
 * silences and every check downstream then passes vacuously. Expect ~181
 * detections on ep005; the gate refuses to run if it sees none.
 *
 * v3 AUDIO TAGS ARE NOT WORDS. `[deadpan]`, `[pause]`, `[excited]`, `[softly]`,
 * `[warmly]`, em-dashes and bare ellipses all appear in `spoken` WITH
 * timestamps and all of them occupy silence. Pinning to one is defect #1
 * exactly. They are filtered before anything here counts as a word.
 *
 * ------------------------------------------------------------------------
 * WHAT IT ACTUALLY COMPUTES
 *
 * Every SFX cue is resolved through `e005SfxEvents()` -- the SAME function the
 * render calls -- so the frames here cannot disagree with the mix. The `at`/
 * offset arithmetic is never re-derived; re-deriving it by hand is how four of
 * the scene files' comment tables went stale.
 *
 * For each cue, against the nearest real spoken words:
 *
 *   LATE   the cue is nearer to the word BEHIND it than the word ahead, and
 *          sits more than LATE_TOL_F frames past that word's onset. The rubric
 *          tolerates ~185ms (5-6 frames); the house target is on the word to 3
 *          frames early. Late is the amateur tell and is a defect.
 *   ADRIFT the cue lands inside a measured silence AND is more than ORPHAN_F
 *          frames from the nearest real word in EITHER direction -- i.e. it is
 *          not "3 frames early for the next word", it is floating between two
 *          sentences with nothing to hit. That is defect #1's shape exactly.
 *
 * The two are NOT exclusive and a cue can be reported `LATE+ADRIFT`.
 *
 * NOTE ON "inside a silence", because the naive version of this check is
 * wrong and would have been worse than nothing: a PERFECT cue is inside a
 * silence. Landing 3 frames before a word means landing in the gap before that
 * word, and the gap before a sentence is a detected silence. So "in a silence"
 * on its own is not a defect and this gate does not treat it as one -- it is
 * only a defect together with the distance test. Silence membership is still
 * PRINTED for every cue so the judgement is visible.
 *
 * ------------------------------------------------------------------------
 * WHAT IT CANNOT SEE, so do not trust it alone:
 *
 *   - VISUAL cues. This grades the SFX plan only, because the SFX plan is the
 *     one place where every cue in the episode is resolved by a single shared
 *     function. Each scene's own reveal offsets are still comments-and-trust;
 *     a scene fix that is not mirrored into SFX_PLAN is invisible here and a
 *     SFX_PLAN entry whose `why` names a symbol the scene deleted still
 *     resolves fine. The two files drift independently.
 *   - WHICH WORD A CUE MEANT. It only knows which word a cue is NEAR. A cue
 *     that is beautifully on a word 40 frames from the word its `why` names
 *     passes cleanly. Only the `why` text says what was intended, and this
 *     gate does not read intent out of prose.
 *   - EARLY BY TOO MUCH. Early is legal by house rule, so a cue 90 frames
 *     ahead of everything is not flagged. `scripts/dump_sfx.ts` and the pacing
 *     proxy are where that shows up.
 *   - ANYTHING ABOUT THE PICTURE. A cue can be perfectly on its word and the
 *     reveal it is supposed to be scoring can be somewhere else entirely.
 *     Sync of sound to WORD is measurable; sync of sound to PICTURE is not,
 *     from source.
 *   - A SLOT WHOSE TAKE IS AMBIGUOUS. Reported, never guessed -- see the
 *     UNVERIFIED section of the output.
 *
 * ------------------------------------------------------------------------
 * EXEMPTING A CUE. A pre-roll whoosh that deliberately leads a camera move,
 * or a beat of sound over an intentional pause, is legitimately not on a word.
 * Mark it in the spec's `why` string or in a comment inside the spec object:
 *
 *     why: "... wordsync-exempt: pre-roll whoosh, leads the camera push by
 *           12f on purpose so the move lands into the sound",
 *
 * The reason is mandatory (the marker must be followed by real text). An
 * unexplained exemption is how a floor rots -- same rule as the dimmed-ink,
 * contrast and typesize gates.
 *
 * SELF-CHECK. Three hand-measured anchors are re-derived on every run. If they
 * do not reproduce, the take selection or the word extraction is wrong, every
 * number below it is wrong, and the gate exits 2 EVEN UNDER --report. A
 * measurement tool that can be wrong quietly is the thing this whole round of
 * work exists to stop.
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";

import { resolveEpisode } from "../src/episodes";

/**
 * Which episode this run grades. `--episode=<id>`, defaulting to e005 — see
 * src/episodes.ts. EPISODE and the default PLAN_SRC both follow from it, so
 * they cannot drift apart into "cues from one episode, exemptions from another".
 */
const EP = resolveEpisode();
const EPISODE = EP.dir;
const TIMING = join(EPISODE, "timing.json");
const CACHE = join(EPISODE, ".tts_cache");
const MASTER = join(EPISODE, "narration.master.wav");
/**
 * Where the SFX_PLAN literal is READ FROM, for identity and exemptions only --
 * frames always come from the imported `e005SfxEvents()`, so pointing this
 * elsewhere cannot move a single cue. `--plan=<path>` exists so the exemption
 * path can be exercised against a scratch copy without editing the episode,
 * which is the only way to know the marker actually works rather than to
 * assume it.
 */
const PLAN_SRC =
  process.argv.find((a) => a.startsWith("--plan="))?.slice(7) ?? EP.planSrc;

/** Frames of slack on a chunk's end landing on a beat start. See BOUNDARY. */
const BOUNDARY_TOL_F = 6;
/** A take stranding more than this fraction of its words in silence is stale. */
const SILENCE_SCORE_MAX = 0.2;
/** Rubric tolerance for a late cue, ~185ms at 30fps. */
const LATE_TOL_F = 5;
/** Distance from the nearest real word past which a cue in silence is adrift. */
const ORPHAN_F = 9;

const EXEMPT = /wordsync-exempt:\s*\S/;
const REPORT_ONLY = process.argv.includes("--report");

/* ---------------------------------------------------------------- timing */

interface Beat {
  id: string;
  startMs: number;
  startFrame: number;
  marks?: Record<string, { word: string; ms: number; frame: number }>;
}
const timing = JSON.parse(readFileSync(TIMING, "utf8")) as {
  fps: number;
  durationMs: number;
  beats: Beat[];
};
const FPS = timing.fps;
const END_F = Math.round((timing.durationMs / 1000) * FPS);
const BEATS = timing.beats;
const BEAT_STARTS = BEATS.map((b) => b.startFrame);

/* -------------------------------------------------------------- silences */

/**
 * Detections arrive on STDERR. `-v error` + a grep on stdout silently yields
 * an empty list and every check downstream then passes for the wrong reason,
 * so the result is asserted non-empty rather than trusted.
 */
function silences(): [number, number][] {
  const stamp = `${MASTER}|${END_F}`;
  const cacheFile = join(
    tmpdir(),
    `wordsync-sil-${Buffer.from(stamp).toString("hex").slice(-24)}.txt`,
  );
  let raw: string;
  if (existsSync(cacheFile)) {
    raw = readFileSync(cacheFile, "utf8");
  } else {
    const r = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostats",
        "-i",
        MASTER,
        "-af",
        "silencedetect=noise=-35dB:d=0.3",
        "-f",
        "null",
        "-",
      ],
      { encoding: "utf8", maxBuffer: 64 << 20 },
    );
    raw = r.stderr ?? "";
    writeFileSync(cacheFile, raw);
  }
  const out: [number, number][] = [];
  let open: number | null = null;
  for (const line of raw.split("\n")) {
    const s = line.match(/silence_start:\s*([\d.]+)/);
    if (s) open = parseFloat(s[1]);
    const e = line.match(/silence_end:\s*([\d.]+)/);
    if (e && open !== null) {
      out.push([open, parseFloat(e[1])]);
      open = null;
    }
  }
  if (!out.length) {
    console.error(
      "FATAL: silencedetect returned no detections. ffmpeg prints them on " +
        "stderr; if this ran clean, the capture is reading stdout.",
    );
    process.exit(2);
  }
  return out;
}
const SIL = silences();
const inSilence = (frame: number): boolean => {
  const t = frame / FPS;
  return SIL.some(([a, b]) => t >= a && t < b);
};

/* ------------------------------------------------------------ tts chunks */

const AUDIO_TAG = /^\[[^\]]*\]$/;
const HAS_LETTER = /[A-Za-z0-9]/;

interface Chunk {
  hash: string;
  dur: number;
  words: [string, number][]; // real spoken words only, chunk-local seconds
}

/**
 * Real spoken words only. Returns null for any file whose `spoken` is not a
 * list of [string, number] -- `.tts_cache` also holds `plan.json` and older
 * shapes, and destructuring those throws mid-run.
 */
function realWords(spoken: unknown): [string, number][] | null {
  if (!Array.isArray(spoken)) return null;
  const out: [string, number][] = [];
  for (const item of spoken) {
    if (!Array.isArray(item) || item.length !== 2) return null;
    const [w, t] = item as [unknown, unknown];
    if (typeof w !== "string" || typeof t !== "number") return null;
    const s = w.trim();
    if (!s) continue;
    if (AUDIO_TAG.test(s)) continue; // v3 audio tag: performed, never spoken
    if (!HAS_LETTER.test(s)) continue; // bare em-dash / ellipsis token
    out.push([s, t]);
  }
  return out;
}

const chunks: Chunk[] = [];
const skipped: string[] = [];
for (const f of readdirSync(CACHE).sort()) {
  if (!f.endsWith(".json")) continue;
  let d: unknown;
  try {
    d = JSON.parse(readFileSync(join(CACHE, f), "utf8"));
  } catch {
    skipped.push(`${f} (unparseable)`);
    continue;
  }
  const o = d as { spoken?: unknown; dur?: unknown };
  if (!o || typeof o !== "object" || typeof o.dur !== "number") {
    skipped.push(`${f} (not a chunk alignment)`);
    continue;
  }
  const words = realWords(o.spoken);
  if (!words) {
    skipped.push(`${f} (unexpected \`spoken\` shape)`);
    continue;
  }
  chunks.push({ hash: basename(f, ".json"), dur: o.dur, words });
}

/* ------------------------------------------------------- take  selection */

interface Placement {
  origin: number;
  end: number;
  hash: string;
  score: number;
  runnerUp?: { hash: string; score: number };
  verified: boolean;
  note: string;
}

function silenceScore(c: Chunk, origin: number): number {
  if (!c.words.length) return 1;
  let bad = 0;
  for (const [, t] of c.words)
    if (inSilence(origin + Math.round(t * FPS))) bad++;
  return bad / c.words.length;
}

/**
 * Tile [0, END_F) left to right. At each origin the candidates are the chunks
 * whose length lands on a LATER beat start (or the episode end) within
 * BOUNDARY_TOL_F; among those the lowest silence score wins. A slot is
 * verified only when the winner clears SILENCE_SCORE_MAX and is not within a
 * factor of two of the runner-up -- two takes that score alike are exactly the
 * case where guessing is unsafe.
 */
function selectTakes(): Placement[] {
  const out: Placement[] = [];
  const used = new Set<string>();
  let origin = 0;
  while (origin < END_F - BOUNDARY_TOL_F) {
    const opts: { hash: string; end: number; score: number }[] = [];
    for (const c of chunks) {
      if (used.has(c.hash)) continue;
      const end = origin + Math.round(c.dur * FPS);
      const landing = [...BEAT_STARTS, END_F].find(
        (s) => s > origin && Math.abs(s - end) <= BOUNDARY_TOL_F,
      );
      if (landing === undefined) continue;
      opts.push({ hash: c.hash, end: landing, score: silenceScore(c, origin) });
    }
    opts.sort((a, b) => a.score - b.score);
    if (!opts.length) {
      out.push({
        origin,
        end: END_F,
        hash: "-",
        score: 1,
        verified: false,
        note: `no cached take is boundary-aligned at f${origin}`,
      });
      break;
    }
    const win = opts[0];
    const up = opts[1];
    const ok =
      win.score <= SILENCE_SCORE_MAX && (!up || up.score > 2 * win.score);
    out.push({
      origin,
      end: win.end,
      hash: win.hash,
      score: win.score,
      runnerUp: up ? { hash: up.hash, score: up.score } : undefined,
      verified: ok,
      note: ok
        ? `${opts.length} boundary-aligned candidate(s)`
        : up
          ? `AMBIGUOUS: ${up.hash} scores ${up.score.toFixed(3)} vs ${win.score.toFixed(3)}`
          : `silence score ${win.score.toFixed(3)} exceeds ${SILENCE_SCORE_MAX}`,
    });
    used.add(win.hash);
    origin = win.end;
  }
  return out;
}
const TAKES = selectTakes();

/** Absolute word timeline, plus the frame span each take is trusted over. */
interface AbsWord {
  word: string;
  frame: number;
  take: string;
}
const WORDS: AbsWord[] = [];
for (const t of TAKES) {
  const c = chunks.find((x) => x.hash === t.hash);
  if (!c) continue;
  for (const [w, s] of c.words)
    WORDS.push({
      word: w,
      frame: t.origin + Math.round(s * FPS),
      take: t.hash,
    });
}
WORDS.sort((a, b) => a.frame - b.frame);

const takeAt = (frame: number): Placement | undefined =>
  TAKES.find((t) => frame >= t.origin && frame < t.end);

/* ------------------------------------------------------------ self-check */

interface Anchor {
  label: string;
  want: number;
  got: number | null;
}
function anchorFrame(take: string, seconds: number): number | null {
  const t = TAKES.find((p) => p.hash === take);
  if (!t) return null;
  return t.origin + Math.round(seconds * FPS);
}
const anchors: Anchor[] = [
  {
    label: "take selection: hook chunk is 862f22cb (not the stale 5c1e084d)",
    want: 1,
    got: TAKES[0]?.hash === "862f22cb4dfae688" ? 1 : 0,
  },
  {
    label: '"Your" (hook_race, 862f22cb @18.848s) = f565',
    want: 565,
    got: anchorFrame("862f22cb4dfae688", 18.848),
  },
  {
    label: "the [deadpan] tag (@18.160s) = f545 and is NOT a word",
    want: 545,
    got:
      WORDS.some((w) => w.frame === 545) === false
        ? anchorFrame("862f22cb4dfae688", 18.16)
        : -1,
  },
  {
    label: "HALF (eec0742d @14.000s, origin f16123) = f16543",
    want: 16543,
    got: anchorFrame("eec0742d2991092e", 14.0),
  },
  {
    label: '"four" (eec0742d @25.664s) = f16893 = the `speedup` mark',
    want: BEATS.find((b) => b.id === "real_system_payoff")?.marks?.speedup
      ?.frame as number,
    got: anchorFrame("eec0742d2991092e", 25.664),
  },
  {
    label:
      '"Big" (eec0742d @34.693s) = f17164 = ending_two_questions.startFrame',
    want: BEATS.find((b) => b.id === "ending_two_questions")
      ?.startFrame as number,
    got: anchorFrame("eec0742d2991092e", 34.693),
  },
];

/**
 * The hand-measured anchors only touch two of the seven slots. timing.json's
 * `marks` cover ALL of them and are independent of everything above: they were
 * written by make_tts.py from the SHIPPED alignment, and each one names the
 * word it landed on. So every mark must find its own word, spelled the same,
 * within 1 frame -- the ±1 is real and is only rounding, because a mark is
 * computed beat-local and then shifted, while this timeline is computed
 * chunk-local and then shifted.
 *
 * If a slot picked the wrong take, its marks land on the wrong words and this
 * fails loudly. It is the cheapest whole-episode corroboration available and
 * it is why the ambiguous slot at f10421 can be reported as verified rather
 * than merely "best of two".
 */
const normWord = (s: string) => s.replace(/[^A-Za-z0-9-]/g, "").toLowerCase();
let markMiss = 0;
let markExact = 0;
let markTotal = 0;
for (const b of BEATS) {
  for (const [name, m] of Object.entries(b.marks ?? {})) {
    markTotal++;
    const hit = WORDS.find(
      (w) =>
        Math.abs(w.frame - m.frame) <= 1 &&
        normWord(w.word) === normWord(m.word),
    );
    if (!hit) {
      markMiss++;
      const near = WORDS.reduce((p, c) =>
        Math.abs(c.frame - m.frame) < Math.abs(p.frame - m.frame) ? c : p,
      );
      console.log(
        `  FAIL  mark ${b.id}.${name} "${m.word}"@f${m.frame} -> nearest ` +
          `reconstructed word "${near.word}"@f${near.frame}`,
      );
    } else if (hit.frame === m.frame) markExact++;
  }
}
anchors.push({
  label:
    `all ${markTotal} timing.json marks land on their own word within 1f ` +
    `(${markExact} of them exact)`,
  want: 0,
  got: markMiss,
});

console.log(
  "--- SELF-CHECK (hand-measured anchors + every timing.json mark) ---",
);
let selfFail = 0;
for (const a of anchors) {
  const ok = a.got === a.want;
  if (!ok) selfFail++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"}  want ${String(a.want).padStart(6)}  ` +
      `got ${String(a.got).padStart(6)}   ${a.label}`,
  );
}
if (selfFail) {
  console.error(
    `\nFATAL: ${selfFail} anchor(s) did not reproduce. Take selection or word ` +
      `extraction is wrong, so every frame below it is wrong. Fix the gate.`,
  );
  process.exit(2);
}

/* ---------------------------------------------------------- the SFX plan */

interface Spec {
  beat: string;
  sfx: string;
  step?: string;
  mark?: string;
  why: string;
  exempt: boolean;
  exemptText: string;
}

/**
 * Read the string value of `key:` out of an object literal's source text.
 * A regex cannot do this: half the `why` strings are single-quoted and contain
 * an escaped apostrophe or an embedded double quote, and a naive character
 * class truncates them at the first one -- which silently hides the exemption
 * marker if it happens to sit past the truncation.
 */
function readString(text: string, key: string): string | undefined {
  const m = text.match(new RegExp(`\\b${key}:\\s*(["'\`])`));
  if (!m || m.index === undefined) return undefined;
  const quote = m[1];
  let out = "";
  for (let i = m.index + m[0].length; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      out += text[i + 1] ?? "";
      i++;
    } else if (ch === quote) return out;
    else out += ch;
  }
  return out;
}

/**
 * Parse SFX_PLAN's object literals out of the source. This is only for
 * IDENTITY (which beat, which step, the `why`, the exemption marker) -- every
 * FRAME comes from `e005SfxEvents()`. The scanner tracks string literals and
 * comments so a brace inside a `why` cannot desync the depth count.
 */
function parseSpecs(): Spec[] {
  const src = readFileSync(PLAN_SRC, "utf8");
  const head = src.indexOf("const SFX_PLAN: SfxSpec[] = [");
  if (head < 0) throw new Error("SFX_PLAN not found in " + PLAN_SRC);
  // NB `indexOf("[", head)` finds the `[` in `SfxSpec[]`, not the array's --
  // the scanner then hits `]` on its first character and returns nothing.
  const body = src.slice(src.indexOf("= [", head) + 3);

  const specs: Spec[] = [];
  let depth = 0;
  let start = -1;
  let lead = 0; // where the run of comments before this object begins
  let str: string | null = null;
  let line = false;
  let block = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    const next = body[i + 1];
    if (line) {
      if (ch === "\n") line = false;
      continue;
    }
    if (block) {
      if (ch === "*" && next === "/") {
        block = false;
        i++;
      }
      continue;
    }
    if (str) {
      if (ch === "\\") i++;
      else if (ch === str) str = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      str = ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      line = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      block = true;
      i++;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const text = body.slice(start, i + 1);
        // Comments immediately above the object carry exemptions too.
        const preamble = body.slice(lead, start);
        const field = (k: string) => readString(text, k);
        const beat = field("beat");
        const sfx = field("sfx");
        if (beat && sfx) {
          const why = field("why") ?? "";
          // Look in the PARSED `why` first so the reason stops at the string's
          // end rather than running on into the source's closing quote.
          const blob = why + "\n" + text + "\n" + preamble;
          specs.push({
            beat,
            sfx,
            step: field("step"),
            mark: field("mark"),
            why,
            exempt: EXEMPT.test(blob),
            exemptText:
              blob.match(/wordsync-exempt:\s*([^\n]*)/)?.[1]?.trim() ?? "",
          });
        }
        lead = i + 1;
        start = -1;
      }
    } else if (depth === 0 && ch === "]") {
      break;
    }
  }
  return specs;
}
const SPECS = parseSpecs();

/* --------------------------------------------------- events <-> identity */

const EVENTS = EP.sfxEvents();

/**
 * `e005SfxEvents()` returns only {frame, sfx}: no beat, no step, no `why`.
 * Identity is recovered by bucketing events into beat windows and lining them
 * up against SFX_PLAN's per-beat entries, which are authored chronologically.
 *
 * The alignment is only ACCEPTED when the bucket's sfx-name sequence in frame
 * order is identical to the plan's sfx-name sequence for that beat. If it is
 * not, the beat's cues are still GRADED (frames are ground truth) but reported
 * with no `why` and CANNOT be exempted -- guessing an identity in order to
 * silence a cue is the failure mode this file exists to prevent.
 */
const beatWindow = (i: number): [number, number] => [
  BEAT_STARTS[i],
  i + 1 < BEAT_STARTS.length ? BEAT_STARTS[i + 1] : END_F,
];

interface Cue {
  frame: number;
  sfx: string;
  beat: string;
  spec?: Spec;
}
const CUES: Cue[] = [];
const unmatchedBeats: string[] = [];
for (let i = 0; i < BEATS.length; i++) {
  const [a, b] = beatWindow(i);
  const ev = EVENTS.filter((e) => e.frame >= a && e.frame < b);
  const sp = SPECS.filter((s) => s.beat === BEATS[i].id);
  const aligned =
    ev.length === sp.length && ev.every((e, k) => e.sfx === sp[k].sfx);
  if (!aligned && (ev.length || sp.length)) unmatchedBeats.push(BEATS[i].id);
  ev.forEach((e, k) =>
    CUES.push({
      frame: e.frame,
      sfx: e.sfx,
      beat: BEATS[i].id,
      spec: aligned ? sp[k] : undefined,
    }),
  );
}
const orphanEvents = EVENTS.length - CUES.length;

/* ------------------------------------------------------------- the check */

/**
 * LATE and ADRIFT are not exclusive and are not ranked against each other by
 * taxonomy -- a cue 22 frames past the last word of a sentence is both. The
 * verdict names every flag that fired; SEVERITY is what orders the list, and
 * it is `lateBy` for a late cue (late is the worst failure the rubric names)
 * and the distance to the nearest word otherwise.
 */
type Verdict = "UNVERIFIED" | "OK" | string;
interface Finding {
  cue: Cue;
  prev?: AbsWord;
  next?: AbsWord;
  silent: boolean;
  lateBy: number;
  earlyBy: number;
  verdict: Verdict;
  severity: number;
}

const findings: Finding[] = CUES.map((cue) => {
  const take = takeAt(cue.frame);
  let prev: AbsWord | undefined;
  let next: AbsWord | undefined;
  for (const w of WORDS) {
    if (w.frame <= cue.frame) prev = w;
    else {
      next = w;
      break;
    }
  }
  const silent = inSilence(cue.frame);
  const lateBy = prev ? cue.frame - prev.frame : Infinity;
  const earlyBy = next ? next.frame - cue.frame : Infinity;

  if (!take || !take.verified)
    return {
      cue,
      prev,
      next,
      silent,
      lateBy,
      earlyBy,
      verdict: "UNVERIFIED",
      severity: 1,
    };

  const late = lateBy <= earlyBy && lateBy > LATE_TOL_F;
  const adrift = silent && lateBy > ORPHAN_F && earlyBy > ORPHAN_F;
  const flags = [late ? "LATE" : "", adrift ? "ADRIFT" : ""].filter(Boolean);
  return {
    cue,
    prev,
    next,
    silent,
    lateBy,
    earlyBy,
    verdict: flags.length ? flags.join("+") : "OK",
    severity: late ? 1000 + lateBy : adrift ? Math.min(lateBy, earlyBy) : 0,
  };
});

const defects = findings.filter(
  (f) => f.verdict !== "OK" && f.verdict !== "UNVERIFIED",
);
const exempted = defects.filter((f) => f.cue.spec?.exempt);
const live = defects.filter((f) => !f.cue.spec?.exempt);
live.sort((a, b) => b.severity - a.severity || a.cue.frame - b.cue.frame);
const unverified = findings.filter((f) => f.verdict === "UNVERIFIED");

/* -------------------------------------------------------------- printing */

const tc = (f: number) =>
  `${Math.floor(f / FPS / 60)}:${String(Math.floor((f / FPS) % 60)).padStart(2, "0")}`;

console.log(
  `\n--- TAKE SELECTION (${TAKES.length} chunk slot(s), ` +
    `${chunks.length} cached alignments, ${skipped.length} skipped) ---`,
);
for (const t of TAKES)
  console.log(
    `  f${String(t.origin).padStart(5)}..${String(t.end).padStart(5)}  ` +
      `${t.hash}  silence ${t.score.toFixed(3)}  ` +
      `${t.verified ? "verified" : "UNVERIFIED"}  (${t.note})`,
  );
for (const s of skipped) console.log(`  skipped ${s}`);

console.log(
  `\n${WORDS.length} real spoken words on the absolute timeline; ` +
    `${SIL.length} measured silences; ${EVENTS.length} SFX cues.`,
);
if (unmatchedBeats.length)
  console.log(
    `  identity NOT recoverable for beat(s): ${unmatchedBeats.join(", ")} ` +
      `-- graded, but no \`why\` and not exemptable.`,
  );
if (orphanEvents)
  console.log(`  ${orphanEvents} cue(s) resolved outside every beat window.`);

if (unverified.length)
  console.log(
    `\n--- UNVERIFIED (${unverified.length}) --- cues in a slot whose shipped ` +
      `take could not be pinned; NOT graded.\n` +
      unverified
        .map((f) => `  f${f.cue.frame} ${f.cue.sfx} (${f.cue.beat})`)
        .join("\n"),
  );

if (exempted.length) {
  console.log(`\n--- EXEMPTED (${exempted.length}) ---`);
  for (const f of exempted)
    console.log(
      `  ${f.verdict} f${f.cue.frame} ${f.cue.sfx} ${f.cue.beat}` +
        `/${f.cue.spec?.step ?? f.cue.spec?.mark ?? "-"}\n` +
        `      reason: ${f.cue.spec?.exemptText}`,
    );
}

console.log(`\n--- OFF THE WORD (${live.length}), worst first ---`);
for (const f of live) {
  const s = f.cue.spec;
  console.log(
    `  ${f.verdict.padEnd(11)} f${String(f.cue.frame).padStart(5)} ${tc(f.cue.frame)}  ` +
      `${f.cue.sfx.padEnd(6)} ${f.cue.beat}/${s?.step ?? s?.mark ?? "?"}` +
      (f.silent ? "  [in a measured silence]" : ""),
  );
  console.log(
    `      prev word ${f.prev ? `"${f.prev.word}" @f${f.prev.frame} (${f.lateBy}f behind the cue)` : "-"}` +
      `   next word ${f.next ? `"${f.next.word}" @f${f.next.frame} (cue is ${f.earlyBy}f early)` : "-"}`,
  );
  if (s?.why) console.log(`      why: ${s.why.slice(0, 150)}`);
}

if (!live.length) {
  console.log(
    `\nPASS: every resolved SFX cue is on its word or ahead of it, and none ` +
      `is adrift in a measured silence.`,
  );
} else {
  console.log(
    `\nFAIL: ${live.length} cue(s) off the word.\n` +
      `  LATE   = past the word it is nearest to by more than ${LATE_TOL_F}f ` +
      `(~185ms). Move it to the word's frame minus 3.\n` +
      `  ADRIFT = inside a measured silence and more than ${ORPHAN_F}f from ` +
      `any real word. Usually pinned to a v3 audio tag or a modelled frame.\n` +
      `  If a cue is deliberately off the word, write ` +
      `"wordsync-exempt: <reason>" in its \`why\`.`,
  );
}
if (live.length && !REPORT_ONLY) process.exit(1);
