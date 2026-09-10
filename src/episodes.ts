/**
 * EPISODE REGISTRY — one map, one entry per episode.
 *
 * WHY THIS EXISTS. The repo-level gates in `scripts/` (dump_schedule,
 * dump_sfx, check_wordsync, check_subreveals) were each written against ep005
 * and imported `e005Schedule` / `e005SfxEvents` / `E005_BEATS` directly from
 * `src/e005/Episode005`. That made every one of them an ep005 tool with a
 * generic name: ep006 would have inherited four scripts that measure the wrong
 * episode while printing a confident PASS. This module is the single place
 * that knows which symbols and which paths belong to which episode; the
 * scripts look one up and are otherwise episode-agnostic.
 *
 * DELIBERATELY NOT A PLUGIN SYSTEM. No auto-discovery, no dynamic import, no
 * convention-over-configuration. Adding ep006 is one literal added to
 * `EPISODES` below, and the type checker will name every field it is missing.
 *
 * `schedule` and `sfxEvents` are typed as `typeof e005*` on purpose: it keeps
 * the internal `Slot` interface (Episode005.tsx line ~406, not exported) out of
 * this file's surface while still forcing a future episode's exports to be
 * structurally identical to ep005's. If ep006's schedule shape ever genuinely
 * needs to differ, that is a decision worth making explicitly here rather than
 * discovering it in a gate's output.
 */
import {
  E005_BEATS,
  E005_DURATION,
  e005Schedule,
  e005SfxEvents,
} from "./e005/Episode005";
import e005Timing from "../episodes/005-cpu-waits-on-memory/timing.json";

export interface EpisodeTools {
  /** Registry key, e.g. `e005`. */
  id: string;
  /** Remotion composition id, as registered in `src/Root.tsx`. */
  composition: string;
  /** Episode directory, REPO-RELATIVE (holds timing.json, narration, .tts_cache). */
  dir: string;
  /** Where this episode's per-beat scene files live, repo-relative. */
  sceneDir: string;
  /**
   * The episode's whole source tree, repo-relative — the scope a per-episode
   * source gate should walk. `check_typesize` walked `src` and reported 74 hits
   * of which 68 belonged to episodes that shipped before that floor existed;
   * scoping it here is what makes its output readable.
   */
  srcRoot: string;
  /** The file holding the SFX_PLAN literal, repo-relative. */
  planSrc: string;
  /** Composition length in frames — the SAME derivation the render asserts. */
  duration: number;
  fps: number;
  schedule: typeof e005Schedule;
  sfxEvents: typeof e005SfxEvents;
  beats: typeof E005_BEATS;
}

export const EPISODES: Record<string, EpisodeTools> = {
  e005: {
    id: "e005",
    composition: "Episode005",
    dir: "episodes/005-cpu-waits-on-memory",
    sceneDir: "src/e005/scenes",
    srcRoot: "src/e005",
    planSrc: "src/e005/Episode005.tsx",
    duration: E005_DURATION,
    fps: e005Timing.fps,
    schedule: e005Schedule,
    sfxEvents: e005SfxEvents,
    beats: E005_BEATS,
  },
};

/**
 * The episode every script falls back to when argv says nothing. This is what
 * keeps every existing ep005 invocation in the repo working unchanged.
 */
export const DEFAULT_EPISODE = "e005";

/**
 * Pick the episode out of argv.
 *
 * A NAMED FLAG, NOT A POSITIONAL. `dump_sfx.ts` already reads argv[2] as a gap
 * threshold and `dump_schedule.ts` reads its positionals as beat ids, so a
 * positional episode argument would have silently changed the meaning of every
 * existing call site — the exact class of breakage this refactor is supposed to
 * avoid. `--episode=<id>` cannot collide with either.
 *
 * An unknown id is fatal rather than a fallback to the default: quietly
 * measuring ep005 because "e006" was misspelled is the worst possible outcome
 * for a gate whose whole job is to be trusted.
 */
export const resolveEpisode = (argv: string[] = process.argv): EpisodeTools => {
  const flag = argv.find((a) => a.startsWith("--episode="))?.slice(10);
  const id = flag ?? DEFAULT_EPISODE;
  const ep = EPISODES[id];
  if (!ep) {
    throw new Error(
      `unknown episode "${id}" -- known ids: ${Object.keys(EPISODES).join(", ")}. ` +
        `Add it to EPISODES in src/episodes.ts.`,
    );
  }
  return ep;
};
