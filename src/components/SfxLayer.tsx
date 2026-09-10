import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";

// Synthetic Content-ID-safe sound-design layer. All WAVs under public/sfx/ are
// ffmpeg-generated (sine / noise), so there is zero licensing or Content-ID risk.
//
// Pure: no Date.now / Math.random / external state. Frame timing is driven
// entirely by <Sequence from={...}>, which Remotion resolves deterministically.

// The palette. The first five shipped e005; the eight below them were added for
// e006 because five cues across ten minutes is why the sound design read as
// sparse. Every cue has a motivated on-screen job — see docs/research/sfx-palette.md
// for the job, the measurements and the exact ffmpeg command that regenerates it.
// Do not add a cue here without adding its generating command to that file.
export type SfxName =
  // — original five —
  | "tick"
  | "pop"
  | "whoosh"
  | "thud"
  | "transition"
  // — added for e006 —
  | "click" // a chip/label docking into a slot
  | "key" // one character/line of a typewriter or code reveal
  | "latch" // a diagram settling into its end state
  | "swish" // a short directional dock/undock move
  | "riser" // a ~350ms build into a big reveal
  | "chime" // a payoff number landing
  | "drop" // sub weight under a large number or a full-frame change
  | "fall"; // the slow path / the thing that fails

export interface SfxEvent {
  /** Absolute frame (composition timeline) at which this cue plays. */
  frame: number;
  sfx: SfxName;
  /** Optional per-event gain override (0..1). Defaults to the table below. */
  volume?: number;
}

export interface SfxLayerProps {
  events: SfxEvent[];
  /** Play the ambient room bed under the whole video. */
  bed?: boolean;
  /**
   * Which bed to play. MUST be at least `durationInFrames` long.
   *
   * There is deliberately no `loop` here. ep003's first cut looped a 20-second
   * bed and produced five audible silent seams at the joins — the exact defect
   * PRODUCTION-LESSONS names ("one CONTINUOUS ambient bed spanning the whole
   * video ... no loops"). A short bed is therefore a sourcing bug to be fixed
   * by generating a longer one, not something this component papers over.
   *
   * The default `sfx/bed.wav` runs 435s and covers e003 (429.2s). ep005 runs
   * 616.7s, so it passes its own 620s bed.
   */
  bedSrc?: string;
  /** Bed gain override. Default keeps it a floor, well under the narration. */
  bedVolume?: number;
  /** Composition length, so the bed is trimmed to the video. */
  durationInFrames: number;
}

// Per-cue default gains.
//
// ROUND 12 — these were previously 0.28-0.34 across the board, on top of WAVs
// whose peaks ran from -31.2 to -11.2 dBFS. The old comment claimed "the raw
// WAVs are already quiet; these keep cues present" — it had the sign backwards:
// quiet assets ATTENUATED a further ~10 dB are not present, they are gone. The
// e005 r11 grade measured tick at an effective peak of -41.7 dBFS against a bed
// at -26.7, i.e. 15 dB UNDER the thing it was supposed to punctuate. Onset
// energy at the 67 cue frames came out 0.66-0.95x that of *random* frames in
// every band: only matched filtering could find the cues at all. The sound
// design was technically present and functionally absent.
//
// The root cause was asset levels, not gains. tick/pop/thud/whoosh were all
// generated 2026-08-31 and never leveled; transition.wav (generated 2026-09-02)
// was already at -11.2 and was the only cue that worked. So all five assets are
// now peak-normalized to a common -12.0 dBFS, which is reproducible with:
//
//   peak=$(ffmpeg -i IN.wav -af volumedetect -f null /dev/null 2>&1 \
//            | grep max_volume | sed 's/.*max_volume: //; s/ dB//')
//   ffmpeg -y -i IN.wav -af "volume=$(python3 -c "print(-12.0-($peak))")dB" \
//            -c:a pcm_s16le OUT.wav
//
// Originals are kept at public/sfx/.orig-preR12/.
//
// With every asset at -12.0 dBFS peak, the gains below are pure balance and the
// resulting effective peaks are:
//
//   tick/pop   -24.0 dBFS   small, frequent — punctuation, not an event
//   whoosh     -21.0 dBFS   camera moves
//   thud       -20.0 dBFS   big reveals
//   transition -18.9 dBFS   section riser, the loudest cue by design
//
// against an e005 bed (bedVolume 0.14) at -27.8 dBFS peak / -43.2 dBFS mean —
// so cues clear the bed's peak by 4-9 dB and its mean by 19-24 dB. Headroom is
// safe: a thud at -20.0 landing on the -4.1 dBTP narration peak sums to about
// -2.8 dBFS, still inside the -1 dBTP ceiling. Re-measure with verify.sh after
// any change here.
//
// The eight e006 cues were generated the same way and are also peak-normalized
// to -12.0 dBFS, so their gains are pure balance too and slot into the ladder
// above rather than restating it. Verified with volumedetect, not assumed —
// every one measures -12.0 dB max_volume. Their effective peaks:
//
//   key        -30.0 dBFS   the quietest thing in the palette, deliberately. A
//                           typewriter fires this dozens of times in a row; at
//                           tick's -24.0 that is a woodpecker, not texture. It
//                           sits ~2 dB under the e005 bed's -27.8 peak, so it
//                           reads as the bed acquiring a grain rather than as
//                           discrete events. If a code reveal needs to be *heard*
//                           rather than felt, that is a `click`, not a `key`.
//   click      -26.0 dBFS   2 dB under tick. Same punctuation register, but a
//                           dock is a smaller event than a beat mark and there
//                           are more of them; leading tick keeps the hierarchy.
//   swish      -23.5 dBFS   2.5 dB under whoosh, which is the whole point — it
//                           is the short move, whoosh is the camera move. If
//                           they were level the distinction would only live in
//                           duration and the mix would read as two whooshes.
//   chime      -23.0 dBFS   a payoff, so above the punctuation cues — but its
//                           400ms decay puts far more energy under the narration
//                           than a 40ms tick does, and matching thud here would
//                           make it a notification ding. Loud enough to land,
//                           quiet enough to duck under the next word.
//   fall       -22.5 dBFS   a downward gesture under continuing narration. Level
//                           with chime's neighbourhood on purpose: they are the
//                           two "verdict" cues, one good and one bad, and a
//                           failure that shouts is editorializing.
//   latch      -22.0 dBFS   2 dB under thud. A settle is a real event but a
//                           smaller one than a reveal; this is the gap that
//                           stops every diagram from feeling like a climax.
//   riser      -20.5 dBFS   1.6 dB under transition. It builds into a reveal
//                           inside a section, so it must not out-announce the
//                           cue that changes sections — transition stays the
//                           loudest thing in the video, by design.
//   drop       -20.0 dBFS   level with thud, and that is not an oversight: it is
//                           thud's job for a full-frame change, one octave lower
//                           and gliding. NEVER schedule both within ~10 frames —
//                           two sub cues at -20.0 sum to about -14 dBFS and eat
//                           the headroom the thud-on-narration-peak sum above
//                           depends on. Pick one.
//
// The two sub-bass cues (thud, drop) are the only ones that meaningfully move
// true peak when they land on a narration peak; everything added here is at or
// below thud. So the headroom argument above is unchanged and no new cue widens
// it. Re-measure with verify.sh after any change here anyway.
const SFX_GAIN: Record<SfxName, number> = {
  tick: 0.25,
  pop: 0.25,
  whoosh: 0.355,
  thud: 0.4,
  transition: 0.45, // section-change riser — the loudest cue, by design
  click: 0.2,
  key: 0.126,
  latch: 0.316,
  swish: 0.266,
  riser: 0.376,
  chime: 0.282,
  drop: 0.398,
  fall: 0.299,
};

const SFX_SRC: Record<SfxName, string> = {
  tick: "sfx/tick.wav",
  pop: "sfx/pop.wav",
  whoosh: "sfx/whoosh.wav",
  thud: "sfx/thud.wav",
  transition: "sfx/transition.wav", // fire on section changes (new PLAYBOOK beat)
  click: "sfx/click.wav",
  key: "sfx/key.wav",
  latch: "sfx/latch.wav",
  swish: "sfx/swish.wav",
  riser: "sfx/riser.wav",
  chime: "sfx/chime.wav",
  drop: "sfx/drop.wav",
  fall: "sfx/fall.wav",
};

// Default bed gain, for the default `sfx/bed.wav` (~-44 LUFS at unity): 0.16
// puts its effective floor well below the narration. An episode shipping its
// own bed at a different level passes its own `bedVolume`.
const BED_VOLUME = 0.16;

export const SfxLayer: React.FC<SfxLayerProps> = ({
  events,
  bed = false,
  bedSrc = "sfx/bed.wav",
  bedVolume = BED_VOLUME,
  durationInFrames,
}) => {
  return (
    <AbsoluteFill>
      {bed ? (
        <Audio
          src={staticFile(bedSrc)}
          volume={bedVolume}
          // Trim the bed to the composition length so it never outruns the
          // render. NOT looped — see `bedSrc`.
          endAt={durationInFrames}
        />
      ) : null}

      {events.map((e, i) => {
        // Guard: don't schedule a cue past the end of the video.
        if (e.frame >= durationInFrames) return null;
        const vol = e.volume ?? SFX_GAIN[e.sfx];
        return (
          <Sequence
            key={`${e.sfx}-${e.frame}-${i}`}
            from={Math.max(0, Math.round(e.frame))}
            name={`sfx:${e.sfx}`}
          >
            <Audio src={staticFile(SFX_SRC[e.sfx])} volume={vol} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
