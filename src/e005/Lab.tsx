import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DrepperChart, MemoryGrid, RatioMorph, theme } from "../components";
import type { DrepperStep, RatioMorphStep } from "../components";
import { BENCH_OUTPUT } from "./bench";
import { E005_BEATS, E005_SCENES, e005BeatProgress } from "./Episode005";

/**
 * A scrub-able preview of this episode's timing-independent pieces.
 *
 * It exists so a broken visual can be found and fixed WITHOUT re-generating
 * narration or re-rendering the episode: every component here takes 0..1
 * progress rather than frames, so this lab drives them with a plain frame ramp
 * and the real episode drives the identical components from timing.json marks.
 * Same component, two clocks. Open it with `npx remotion studio` and scrub.
 *
 * This is not scratch — keep it. When step 8 of the build list looks wrong, the
 * fix loop is: scrub here, edit the component, scrub again. No API credits, no
 * full render.
 *
 * TWO SECTIONS, and they answer different questions:
 *
 *   frames 0-1049   COMPONENT scenes — MemoryGrid modes and the DrepperChart ->
 *                   RatioMorph handoff, driven by a hand-written window table.
 *                   These are shared components, not beats; they exist to be
 *                   judged in isolation and, for scenes 4/5, side by side.
 *   frames 1050+    BEAT scenes — one per narration beat that has a scene in
 *                   `scenes/`, mounted through the episode's OWN `E005_SCENES`
 *                   map and its OWN `e005BeatProgress()`. The only difference
 *                   from the real render is that the beat's real window (up to
 *                   1400 frames) is squeezed into `BEAT_SCENE` frames, so a
 *                   whole beat can be scrubbed in a couple of seconds.
 *
 * That second section deliberately re-uses the episode's wiring rather than
 * re-declaring windows here. A lab with its own copy of the schedule will drift
 * from the render, and then a PASS in the lab stops meaning anything. The
 * compression is uniform, so ORDER, OVERLAP and RELATIVE SPACING are true here;
 * absolute speed is not. Judge choreography here, judge pacing in the render.
 */

const SCENE = 150; // frames per lab scene — preview only, never a real timing

/**
 * Frames per beat scene. Longer than SCENE because a beat is a whole
 * mini-storyboard of up to 13 sub-reveals — at 150 frames the widest steps get
 * ~4 frames each and scrubbing can't land inside them.
 */
const BEAT_SCENE = 300;

/**
 * Beats already covered by the component scenes above: `drepper_experiment` is
 * scenes 3-4 and `modern_replication` is scenes 5-6, and those two are
 * previewed together on purpose (the bars must be continuous across the cut).
 * Don't add them again down here — a second, differently-timed preview of the
 * same handoff is how the handoff gets "fixed" in the wrong direction.
 */
const COVERED_ABOVE = new Set(["drepper_experiment", "modern_replication"]);

const LAB_BEATS = E005_BEATS.filter((b) => !COVERED_ABOVE.has(b.id));

const COMPONENT_SCENES = 7;
const BEATS_FROM = SCENE * COMPONENT_SCENES;

export const E005_LAB_DURATION = BEATS_FROM + BEAT_SCENE * LAB_BEATS.length;

export const E005Lab: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = Math.floor(frame / SCENE);
  const local = (frame % SCENE) / SCENE;

  if (frame >= BEATS_FROM) {
    const i = Math.min(
      LAB_BEATS.length - 1,
      Math.floor((frame - BEATS_FROM) / BEAT_SCENE),
    );
    const t = ((frame - BEATS_FROM) % BEAT_SCENE) / BEAT_SCENE;
    return <BeatScene beat={LAB_BEATS[i]} t={t} frame={frame} />;
  }

  return (
    <AbsoluteFill
      style={{ backgroundColor: theme.bg, fontFamily: "system-ui, sans-serif" }}
    >
      <Caption text={LABELS[scene] ?? ""} />
      {scene === 0 && <GridScene mode="line" p={local} />}
      {scene === 1 && <GridScene mode="sweep" p={local} />}
      {scene === 2 && <GridScene mode="chase" p={local} />}
      {(scene === 3 || scene === 4) && (
        <DrepperScene p={local} stamp={scene === 4} frame={frame} />
      )}
      {(scene === 5 || scene === 6) && (
        <RatioScene p={local} dock={scene === 6} />
      )}
    </AbsoluteFill>
  );
};

const LABELS = [
  "MemoryGrid · line — one byte asked for, 64 arrive",
  "MemoryGrid · sweep — prefetcher locks on",
  "MemoryGrid · chase — same reads, every line cold",
  "DrepperChart · steps 1-5 (mid-rise y-axis rescale)",
  "DrepperChart · steps 6-8 — HOLD HERE, compare with the next scene",
  "RatioMorph · steps 1-7 — bars must start where DrepperChart left them",
  "RatioMorph · step 8 dock_to_corner",
];

const GridScene: React.FC<{ mode: "line" | "sweep" | "chase"; p: number }> = ({
  mode,
  p,
}) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
    <MemoryGrid mode={mode} progress={p} />
  </AbsoluteFill>
);

const DREPPER_WINDOWS: Array<[DrepperStep, number, number]> = [
  ["axes", 0.0, 0.12],
  ["bar_seq_9", 0.1, 0.24],
  ["silence_hold", 0.26, 0.4],
  ["bar_random_launch", 0.42, 0.6],
  ["yaxis_rescale", 0.48, 0.68],
  ["thud_land_450", 0.62, 0.74],
  ["caveat_caption", 0.76, 0.86],
  ["same_on_stamp", 0.88, 1.0],
];

const DrepperScene: React.FC<{ p: number; stamp: boolean; frame: number }> = ({
  p,
  stamp,
  frame,
}) => {
  // Scene 3 runs the rescale; scene 4 picks up after it and adds the caveat +
  // stamp, so the last frame of scene 4 is the state RatioMorph must inherit.
  const t = stamp ? 0.6 + p * 0.4 : p * 0.68;
  const steps: Partial<Record<DrepperStep, number>> = {};
  for (const [name, a, b] of DREPPER_WINDOWS) {
    steps[name] = interpolate(t, [a, b], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return <DrepperChart p={steps} frame={frame} />;
};

// Staggers the eight build steps across the scene the way the narration will:
// each step gets a window, later steps overlap the tail of earlier ones so
// nothing hard-cuts. The real episode replaces these windows with mark frames.
const WINDOWS: Array<[RatioMorphStep, number, number]> = [
  ["bars_compress", 0.0, 0.18],
  ["bar_68", 0.14, 0.3],
  ["bar_125", 0.3, 0.46],
  ["axis_relabel", 0.2, 0.36],
  ["footnote_chip", 0.42, 0.54],
  ["bench_terminal", 0.56, 0.7],
  ["bar_90_between", 0.62, 0.82],
  ["dock_to_corner", 0.88, 1.0],
];

const RatioScene: React.FC<{ p: number; dock: boolean }> = ({ p, dock }) => {
  // Scene 3 previews steps 1-7 held open; scene 4 replays and then docks, so
  // both halves can be judged without scrubbing back and forth.
  const t = dock ? 0.55 + p * 0.45 : p * 0.86;
  const steps: Partial<Record<RatioMorphStep, number>> = {};
  for (const [name, a, b] of WINDOWS) {
    steps[name] = interpolate(t, [a, b], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return <RatioMorph p={steps} benchLines={BENCH_OUTPUT} />;
};

/**
 * What to actually look for in each beat — the thing most likely to be wrong,
 * not a description of the beat. A caption that says "the hook" tells you
 * nothing you didn't know; "the 90x stamp must land on the word" is a test.
 */
const BEAT_NOTES: Record<string, string> = {
  hook_race: "90x stamp lands ON `ninetyx`; left lane finishes first",
  whiteboard_world: "n and n-squared curves draw; n-squared exits the board",
  hidden_assumption: "card flips, bar flies out, freeze holds on `counts`",
  memory_wall: "the two lines diverge and the count-up hits its range",
  latency_ladder:
    "each rung's label lands on its own spoken name (l1/l2/l3/ram)",
  google_receipts: "capture reads WIDE — you can tell what the page is",
  cache_line: "one byte asked for, the whole 64-byte row lights up",
  sweep_vs_chase: "steps are strictly sequential here — no two overlap",
  trick_question: "options, then the race, then the answer chip",
  honest_walkback: "the walkback slide arrives on `sayno`, not after it",
  three_rules: "three rules draw in order; the AoS -> SoA morph is a morph",
  real_system_payoff: "ledger rows, then the bar compresses into the count-up",
  ending_two_questions:
    "grid returns UNDER `dock_live`; drift_out runs to the last frame",
};

/**
 * One narration beat, mounted exactly as the episode mounts it, with its real
 * window linearly compressed into BEAT_SCENE frames.
 *
 * `frame` deliberately stays the LAB's frame rather than the mapped episode
 * frame. Scenes use it only for periodic idle motion (drift, caret blink, core
 * pulse) — all phase, no schedule — so feeding it the lab clock keeps that
 * motion at real speed while the reveals run fast. Mapping it too would make
 * every caret blink 4x too quick and read as a bug that isn't there.
 */
const BeatScene: React.FC<{
  beat: { id: string; start: number; end: number };
  t: number;
  frame: number;
}> = ({ beat, t, frame }) => {
  const Scene = E005_SCENES[beat.id];
  const mapped = beat.start + (beat.end - beat.start) * t;
  const p = e005BeatProgress(beat.id, mapped);
  return (
    <AbsoluteFill
      style={{ backgroundColor: theme.bg, fontFamily: "system-ui, sans-serif" }}
    >
      {Scene ? <Scene p={p} frame={frame} /> : null}
      <Caption
        text={`${beat.id} — ${BEAT_NOTES[beat.id] ?? ""}`}
        sub={`episode frame ${Math.round(mapped)}  ·  beat ${beat.start}-${beat.end} (${beat.end - beat.start}f) compressed into ${BEAT_SCENE}f`}
      />
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ text: string; sub?: string }> = ({ text, sub }) => (
  <div
    style={{
      position: "absolute",
      left: 48,
      top: 36,
      color: theme.dim,
      // typesize-exempt: DEV-ONLY SURFACE. Lab is registered in Root.tsx as its
      // own `E005Lab` composition for previewing components in isolation; it is
      // not mounted by Episode005 and never reaches a rendered frame. These two
      // captions label the lab's own panes for whoever is scrubbing it.
      fontSize: 24,
      letterSpacing: 0.5,
      zIndex: 10,
    }}
  >
    {text}
    {sub ? (
      // typesize-exempt: dev-only, same as above.
      <div style={{ fontSize: 17, opacity: 0.7, marginTop: 6 }}>{sub}</div>
    ) : null}
  </div>
);
