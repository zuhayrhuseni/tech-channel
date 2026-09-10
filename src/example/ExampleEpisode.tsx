import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
import { theme, TYPE } from "../components/theme";
import { SfxLayer, type SfxEvent } from "../components/SfxLayer";

/**
 * THE TEMPLATE EPISODE — delete this once you have your own.
 *
 * It is deliberately tiny (three beats, ~14s) and self-contained, but it is a
 * REAL episode in the shape the rest of the engine expects. Copy this file to
 * `src/e001/Episode001.tsx` and grow it; every gate in `scripts/gates.sh` reads
 * the structures below.
 *
 * WHAT A REAL EPISODE DOES DIFFERENTLY: it imports its beat table from its own
 * `timing.json`, which `make_tts.py` generates alongside the narration:
 *
 *     import timing from "../../episodes/001-my-episode/timing.json";
 *     export const DURATION = Math.ceil((timing.audioMs / 1000) * timing.fps);
 *
 * Here the table is inlined so the repo compiles before you have generated any
 * audio. That is the ONLY difference — do not inline frames in a real episode,
 * because hand-typed frame numbers rot silently the moment you re-voice a beat.
 */

const FPS = 30;

/**
 * BEATS — one entry per narration paragraph, in order.
 *
 * In a real episode `startFrame` comes from timing.json. `end` is the next
 * beat's start, so beats tile the timeline with no gaps and no overlaps.
 */
export const EXAMPLE_BEATS: Array<{ id: string; start: number; end: number }> =
  [
    { id: "hook", start: 0, end: 150 },
    { id: "explain", start: 150, end: 330 },
    { id: "payoff", start: 330, end: 420 },
  ];

export const EXAMPLE_DURATION = EXAMPLE_BEATS[EXAMPLE_BEATS.length - 1].end;

/**
 * NOMINAL — each step's authored length in frames, per beat.
 *
 * A "step" is one staged sub-reveal inside a beat. The engine converts a step's
 * 0..1 progress back into this frame space, so `at` offsets are read against
 * these numbers. `check_subreveals` fails the build if a reveal is authored at
 * an offset >= its step's reachable ceiling — such a reveal never renders a
 * single frame, throws nothing, and reads as working code.
 */
const NOMINAL: Record<string, number> = {
  title_in: 150,
  rows_in: 180,
  answer_in: 90,
};

/** clamp to 0..1 */
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * `lin(p, step, at, dur)` — a LINEAR reveal starting `at` frames into `step`.
 *
 * Linear on purpose. An ease-out over N frames has a best single-frame delta of
 * only (3/N) x total, which is too gradual to register as a content event in
 * `scripts/pacing.py`. Drive wipes with this, not with a spring.
 *
 * NOTE THE OFF-BY-ONE: this returns exactly 0 *at* its own offset, and callers
 * conventionally gate on `> 0`. So a reveal authored at local N first paints at
 * N+1 — to land on a word, author at (word - stepStart) - 1.
 */
const lin = (p: number, step: string, at: number, dur: number) =>
  clamp01((clamp01(p) * NOMINAL[step] - at) / dur);

/** Per-beat progress 0..1 for the beat containing `frame`. */
const beatProgress = (frame: number, id: string) => {
  const b = EXAMPLE_BEATS.find((x) => x.id === id);
  if (!b) return 0;
  return clamp01((frame - b.start) / (b.end - b.start));
};

/**
 * SFX_PLAN — one entry per cue.
 *
 * `at` is a FRACTION of the step, so cues move automatically when a re-voice
 * shifts the beat. `why` is mandatory in spirit: it names the physical thing on
 * screen the sound is scoring. A cue that cannot be justified in one sentence
 * is decoration, and decoration is what makes a video feel like an advert.
 *
 * ORDER IS LOAD-BEARING. `check_wordsync` recovers a cue's identity by matching
 * a beat's entries in AUTHORED order against resolved events in FRAME order.
 */
const SFX_PLAN: Array<{
  beat: string;
  step: string;
  sfx: SfxEvent["sfx"];
  at: number;
  why: string;
}> = [
  {
    beat: "hook",
    step: "title_in",
    sfx: "pop",
    at: 10 / NOMINAL.title_in,
    why: "the title wipes on — the first thing that appears, so it takes a pop rather than a tick",
  },
  {
    beat: "explain",
    step: "rows_in",
    sfx: "tick",
    at: 12 / NOMINAL.rows_in,
    why: "the first bucket row draws in; ticks punctuate the ladder, one per row",
  },
  {
    beat: "payoff",
    step: "answer_in",
    sfx: "thud",
    at: 6 / NOMINAL.answer_in,
    why: "the answer lands full-frame — the episode's biggest single change, so it gets weight",
  },
];

/** Resolve the plan to absolute frames. The render and the gates share this. */
export const exampleSfxEvents = (): SfxEvent[] =>
  SFX_PLAN.map((c) => {
    const b = EXAMPLE_BEATS.find((x) => x.id === c.beat)!;
    return {
      frame: b.start + Math.round(c.at * NOMINAL[c.step]),
      sfx: c.sfx,
    };
  }).sort((a, b) => a.frame - b.frame);

/** The resolved schedule, for `scripts/dump_schedule.ts`. */
export const exampleSchedule = (): Array<{
  beat: string;
  slots: Record<string, { from: number; to: number; ramp: number }>;
}> =>
  EXAMPLE_BEATS.map((b) => {
    const steps = Object.keys(NOMINAL).filter((s) =>
      SFX_PLAN.some((c) => c.beat === b.id && c.step === s),
    );
    return {
      beat: b.id,
      slots: Object.fromEntries(
        steps.map((s) => [
          s,
          { from: b.start, to: b.end, ramp: NOMINAL[s] },
        ]),
      ),
    };
  });

/* ------------------------------------------------------------------------- */

/** A left-to-right wipe. Linear in width, which is linear in painted area. */
const Wipe: React.FC<{ t: number; children: React.ReactNode }> = ({
  t,
  children,
}) => (
  <div style={{ clipPath: `inset(0 ${(1 - t) * 100}% 0 0)` }}>{children}</div>
);

const Hook: React.FC<{ p: number }> = ({ p }) => {
  const t = lin(p, "title_in", 6, 9);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 140px" }}>
      <Wipe t={t}>
        <div style={{ ...TYPE.display, color: theme.ink }}>
          Where does a key go?
        </div>
      </Wipe>
    </AbsoluteFill>
  );
};

const Explain: React.FC<{ p: number }> = ({ p }) => {
  // Staggered rows. Each is its own reveal, ~2-3s apart, so the beat has a
  // content event throughout rather than one entrance and 6s of nothing.
  const rows = ["hash the key", "take it modulo the size", "that's the bucket"];
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 140px" }}>
      {rows.map((label, i) => {
        const t = lin(p, "rows_in", 8 + i * 45, 9);
        if (t <= 0) return null;
        return (
          <Wipe key={label} t={t}>
            <div
              style={{
                ...TYPE.headline,
                color: i === rows.length - 1 ? theme.accent : theme.ink,
                marginBottom: 28,
              }}
            >
              {label}
            </div>
          </Wipe>
        );
      })}
    </AbsoluteFill>
  );
};

const Payoff: React.FC<{ p: number }> = ({ p }) => {
  const t = lin(p, "answer_in", 4, 8);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 140px" }}>
      <Wipe t={t}>
        <div style={{ ...TYPE.display, color: theme.warm }}>O(1), usually.</div>
      </Wipe>
    </AbsoluteFill>
  );
};

export const ExampleEpisode: React.FC = () => {
  const frame = useCurrentFrame();

  // A slow ambient drift keeps the frame from being perfectly static. It is
  // NOT a content event — `pacing.py` scores it at ~0 — so never let it stand
  // in for an actual reveal.
  const drift = interpolate(frame, [0, EXAMPLE_DURATION], [0, -18]);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <AbsoluteFill style={{ transform: `translateY(${drift}px)` }}>
        {EXAMPLE_BEATS.map((b) => {
          const p = beatProgress(frame, b.id);
          return (
            <Sequence
              key={b.id}
              from={b.start}
              durationInFrames={b.end - b.start}
            >
              {b.id === "hook" && <Hook p={p} />}
              {b.id === "explain" && <Explain p={p} />}
              {b.id === "payoff" && <Payoff p={p} />}
            </Sequence>
          );
        })}
      </AbsoluteFill>

      <SfxLayer
        events={exampleSfxEvents()}
        durationInFrames={EXAMPLE_DURATION}
      />
    </AbsoluteFill>
  );
};

export const EXAMPLE_FPS = FPS;
