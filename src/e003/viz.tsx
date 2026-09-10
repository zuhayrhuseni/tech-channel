import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { theme } from "../components/theme";
import { MONO, SANS } from "../trailer/fonts";
import { Kw } from "../trailer/Kinetic";

// ---------------------------------------------------------------------------
// 003-specific scene helpers. All motion derives from useCurrentFrame only —
// pure components, seek-safe (no Date.now / Math.random). Theme tokens only.
// ---------------------------------------------------------------------------

// Reveal helper: eased 0->1 over ~7 frames, starting 3 frames before `at`
// (sync tolerance is asymmetric — land on or just before the word). Kept short
// so entrances are SNAPPY (creator note: "fast paced, ~6-9 frames not 15-20").
export const rise = (frame: number, at: number, len = 7) =>
  interpolate(frame, [at - 3, at - 3 + len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

// A tall browser screenshot presented as a scrolling capture. The fetched
// shots are tall columns (1400x4200). It scales the image to the frame WIDTH
// so the WHOLE column is legible and the source is instantly recognizable
// (you can read the headline / see "Moltbook"), then does a gentle, continuous
// VERTICAL SCROLL through the readable page. There is NO push-in zoom and NO
// circle annotation — the creator's notes: "can't even tell it's Moltbook —
// do zoomed-out scrolling not zoomed in" and "get rid of the circling". Scale
// is pinned at 1.0 (width-fit) for the whole beat so it never ends pushed in.
export const ScrollingCapture: React.FC<{
  src: string;
  imgW: number;
  imgH: number;
  dur: number;
  /** 0..1 fraction of the scrollable overflow to START the scroll on. */
  scrollFrom?: number;
  /** 0..1 fraction of the scrollable overflow to END the scroll on. */
  scrollTo?: number;
}> = ({ src, imgW, imgH, dur, scrollFrom = 0, scrollTo = 0.32 }) => {
  const frame = useCurrentFrame();

  // Scale so the image fills the 1920 width; it is then taller than 1080. At
  // scale 1 the whole column is legible — the wide, recognizable framing we
  // hold for the whole beat (never zoom in).
  const fit = 1920 / imgW;
  const scaledH = imgH * fit;
  // How far we can pan (px of scaled image beyond the viewport height).
  const overflow = Math.max(0, scaledH - 1080);

  // Gentle continuous scroll across the whole beat: brief settled hold at the
  // top (so the headline reads), then a slow ease through the page. No zoom.
  const HOLD = 14; // ~0.5s to read the top before we start moving
  const scroll = interpolate(
    frame,
    [HOLD, Math.max(HOLD + 20, dur - 8)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const fromY = scrollFrom * overflow;
  const toY = scrollTo * overflow;
  const panY = -(fromY + (toY - fromY) * scroll);
  const driftX = Math.sin(frame / 90) * 5;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${driftX}px, ${panY}px)`,
          transformOrigin: "center top",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{ width: 1920, height: "auto", display: "block" }}
        />
      </AbsoluteFill>
      {/* subtle top/bottom scrims so text scrolling past the edge reads as
          "framed" rather than hard-cut */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 90,
          background: `linear-gradient(180deg, ${theme.bg}, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background: `linear-gradient(0deg, ${theme.bg}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Horizontal timeline bar with a tiny "launch -> breached" sliver. React to how
// small three days is. Count-up numbers dock beneath as they're spoken.
export const BreachTimeline: React.FC<{ at: number; dur: number }> = ({
  at,
  dur,
}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [at, at + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const W = 1400;
  const sliver = 46; // px — the 3-day window, deliberately tiny vs the bar
  const flash = 0.5 + 0.5 * Math.sin(frame / 6); // slow pulse on the sliver
  // The three exposure counts land on a tight ~90f cadence right after the bar
  // draws (not the old wide 0.18/0.48/0.78 spread that left ~6s dead between
  // each), then a closing caption fills the tail. Each count-up is in motion for
  // ~18f, so a real event lands every ~3s across the beat.
  const c0 = at + 60;
  const c1 = c0 + 85;
  const c2 = c1 + 85;
  // three closing captions on the same ~85f cadence carry the tail to the beat
  // end so nothing parks (each shows for ~3s then hands off to the next).
  // cap the tail captions inside the beat so the last never lands past its end
  const tailAt = Math.min(c2 + 85, dur - 200);
  const tail2At = tailAt + 85;
  const tail3At = tailAt + 170;
  const tail = rise(frame, tailAt, 10) * (1 - rise(frame, tail2At - 6, 10));
  const tail2 = rise(frame, tail2At, 10) * (1 - rise(frame, tail3At - 6, 10));
  const tail3 = rise(frame, tail3At, 10);
  return (
    <div
      style={{
        position: "absolute",
        top: 300,
        left: "50%",
        transform: "translateX(-50%)",
        width: W,
      }}
    >
      <div
        style={{
          position: "relative",
          height: 90,
          borderRadius: 16,
          border: `2px solid ${theme.stroke}`,
          background: theme.panel,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: W * draw,
            background: `linear-gradient(90deg, ${theme.dim}33, ${theme.dim}11)`,
          }}
        />
        {/* the breach sliver at the very start */}
        <div
          style={{
            position: "absolute",
            top: -2,
            bottom: -2,
            left: 0,
            width: sliver * draw,
            background: theme.down,
            opacity: 0.5 + 0.5 * flash,
            boxShadow: `0 0 30px ${theme.down}`,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 16,
          fontFamily: MONO,
          fontSize: 28,
          color: theme.dim,
          opacity: draw,
        }}
      >
        <span style={{ color: theme.down }}>
          launch → fully breached · 3 days
        </span>
        <span>anyone who ever checked</span>
      </div>
      {/* count-up numbers land beneath the bar, one every ~3s */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 90,
          marginTop: 60,
        }}
      >
        <CountUp
          at={c0}
          value={1_500_000}
          display={(v) => (v / 1_000_000).toFixed(1) + "M"}
          label="login keys"
          color={theme.down}
        />
        <CountUp
          at={c1}
          value={35_000}
          display={(v) => Math.round(v / 1000) + "k"}
          label="email addresses"
          color={theme.warm}
        />
        <CountUp
          at={c2}
          value={0}
          display={() => "private DMs"}
          label="just sitting open"
          color={theme.dim}
          textOnly
        />
      </div>
      {/* three closing captions keep the tail moving after the last count lands —
          stacked in one slot, only one visible at a time via opacity */}
      <div style={{ position: "relative", height: 70, marginTop: 40 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: tail,
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 52,
              color: theme.down,
              letterSpacing: "-0.02em",
              textShadow: `0 0 30px ${theme.down}44`,
            }}
          >
            all of it · in 72 hours
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: tail2,
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 52,
              color: theme.warm,
              letterSpacing: "-0.02em",
              textShadow: `0 0 30px ${theme.warm}44`,
            }}
          >
            nobody was watching
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: tail3,
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 52,
              color: theme.dim,
              letterSpacing: "-0.02em",
            }}
          >
            until it was too late
          </span>
        </div>
      </div>
    </div>
  );
};

// A big count-up number that counts from beat-start and lands its final value
// on `at`, so it is in motion the whole time (motion floor).
export const CountUp: React.FC<{
  at: number;
  value: number;
  display: (v: number) => string;
  label: string;
  color?: string;
  textOnly?: boolean;
}> = ({ at, value, display, label, color = theme.ink, textOnly = false }) => {
  const frame = useCurrentFrame();
  const appear = rise(frame, at, 9);
  const count = interpolate(frame, [at, Math.max(at + 18, at + 18)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const shown = textOnly ? value : value * count;
  return (
    <div
      style={{
        textAlign: "center",
        opacity: appear,
        transform: `scale(${0.94 + appear * 0.06})`,
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 110,
          color,
          letterSpacing: "-0.03em",
          textShadow: `0 0 40px ${color}44`,
        }}
      >
        {display(shown)}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 30,
          color: theme.dim,
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// spread N reveals evenly across a beat (mirrors the e002 helper).
export const spread = (dur: number, i: number, n: number) =>
  Math.round(dur * (0.18 + (0.6 * i) / Math.max(1, n - 1)));

// One glowing UNCHECKED checkbox that then MULTIPLIES across a wall (app after
// app after app), staged across the whole beat so something new lands every
// ~3s: (1) box appears + UNCHECKED, (2) "one setting" callout, (3) the box
// multiplies into a grid on "app, after app, after app", (4) "this keeps
// happening" lands. Object constancy — the single box becomes the wall.
export const UncheckedBox: React.FC<{ at: number; dur?: number }> = ({
  at,
  dur = 796,
}) => {
  const frame = useCurrentFrame();

  // Sub-point timing across the beat (relative frames), on a ~90f cadence so an
  // event fires every ≤3s: box(8) → UNCHECKED(~28) → "one setting"(~140) →
  // grid multiplies(~250) → grid fills continuously → "everywhere"(~410) →
  // "this keeps happening"(~500+).
  const settingAt = Math.round(dur * 0.17);
  const multiplyAt = Math.round(dur * 0.3);
  const everywhereAt = Math.round(dur * 0.52);
  const stillAt = Math.round(dur * 0.66);
  const keepsAt = Math.round(dur * 0.82);

  // Hero box shrinks/moves up as the grid forms (transform, not disappear).
  const collapse = interpolate(frame, [multiplyAt, multiplyAt + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const S = 260 - collapse * 100; // 260 → 160 as it docks into the grid

  // A 6x3 wall of boxes; each unchecked box pops in staggered after multiplyAt.
  const cols = 6;
  const rows = 3;
  const cells = cols * rows;
  // Spread the grid fill across ~everywhereAt so the wall is CONTINUOUSLY
  // populating (a steady stream of new boxes) rather than snapping full in ~1s
  // and then holding. Each cell's entrance is spaced to reach the last cell
  // right around `everywhereAt`.
  const gridSpan = Math.max(60, everywhereAt - multiplyAt);
  const cellStep = gridSpan / (cells - 1);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* the growing wall — appears on "app after app after app" */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: "1fr",
          gap: 22,
          padding: "220px 200px 240px",
          alignContent: "center",
          justifyItems: "center",
        }}
      >
        {Array.from({ length: cells }).map((_, i) => {
          // the very first cell is the hero box (already on); the rest stream in
          // across ~gridSpan so the wall populates continuously (not a 1s snap).
          const cellAt =
            i === 0 ? at : Math.round(multiplyAt + 6 + i * cellStep);
          const cp = rise(frame, cellAt, 10);
          if (cp <= 0) return null;
          const sz = i === 0 ? S : 120;
          const g = 0.5 + 0.5 * Math.sin((frame + i * 7) / 22);
          return (
            <div
              key={i}
              style={{
                width: sz,
                height: sz,
                borderRadius: i === 0 ? 34 : 20,
                border: `${i === 0 ? 10 : 6}px solid ${theme.down}`,
                boxShadow: `0 0 ${20 + g * 40}px ${theme.down}${g > 0.5 ? "aa" : "55"}, inset 0 0 30px ${theme.down}22`,
                opacity: cp * (i === 0 ? 1 : 0.9),
                transform: `scale(${0.9 + cp * 0.1})`,
                background: `${theme.down}0d`,
              }}
            />
          );
        })}
      </div>

      {/* UNCHECKED label under the hero box — fades OUT just before "one
          setting" enters at the same spot, so they never overlap (clean handoff). */}
      <div
        style={{
          position: "absolute",
          top: 150,
          width: "100%",
          textAlign: "center",
          opacity:
            rise(frame, at + 20, 9) * (1 - rise(frame, settingAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 40,
            color: theme.down,
            letterSpacing: "0.12em",
          }}
        >
          UNCHECKED
        </span>
      </div>

      {/* (2) "one setting" callout */}
      <div
        style={{
          position: "absolute",
          top: 150,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, settingAt, 9) * (1 - collapse),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 64,
            color: theme.warm,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.warm}33`,
          }}
        >
          one setting
        </span>
      </div>

      {/* (3) "app after app after app" as the wall fills — dims out as the
          "everywhere" caption takes the same slot (clean handoff, no overlap) */}
      <div
        style={{
          position: "absolute",
          top: 130,
          width: "100%",
          textAlign: "center",
          opacity:
            rise(frame, multiplyAt, 9) * (1 - rise(frame, everywhereAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 36,
            color: theme.dim,
            letterSpacing: "0.04em",
          }}
        >
          app · after app · after app
        </span>
      </div>

      {/* (3b) "everywhere" mid-beat caption once the wall is mostly full, so the
          stretch between the grid filling and "keeps happening" keeps moving */}
      <div
        style={{
          position: "absolute",
          top: 130,
          width: "100%",
          textAlign: "center",
          opacity:
            rise(frame, everywhereAt, 9) * (1 - rise(frame, stillAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 60,
            color: theme.warm,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.warm}33`,
          }}
        >
          the same one · everywhere
        </span>
      </div>

      {/* (3c) "still nobody checks it" — bridges everywhere → keeps happening */}
      <div
        style={{
          position: "absolute",
          top: 130,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, stillAt, 9) * (1 - rise(frame, keepsAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 60,
            color: theme.dim,
            letterSpacing: "-0.02em",
          }}
        >
          still nobody checks it
        </span>
      </div>

      {/* (4) "this keeps happening" lands over the full wall */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, keepsAt, 9),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 72,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.down}44`,
          }}
        >
          this keeps happening
        </span>
      </div>
    </div>
  );
};

// A single big keyword that morphs from `a` to `b`: `a` dims/blurs out while
// `b` rises in on top — transform, not add/remove.
export const MorphWords: React.FC<{
  a: string;
  b: string;
  at: number;
  colorB?: string;
}> = ({ a, b, at, colorB = theme.warm }) => {
  const frame = useCurrentFrame();
  const morph = interpolate(frame, [at, at + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const inA = rise(frame, 8, 10);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ position: "relative", textAlign: "center" }}>
        <div
          style={{
            opacity: inA * (1 - morph),
            transform: `scale(${1 - morph * 0.06}) translateY(${morph * -12}px)`,
            filter: `blur(${morph * 8}px)`,
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 150,
              color: theme.ink,
              letterSpacing: "-0.03em",
              textShadow: `0 0 40px ${theme.ink}33`,
            }}
          >
            {a}
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: morph,
            transform: `scale(${0.94 + morph * 0.06}) translateY(${(1 - morph) * 14}px)`,
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 150,
              color: colorB,
              letterSpacing: "-0.03em",
              textShadow: `0 0 50px ${colorB}55`,
            }}
          >
            {b}
          </span>
        </div>
      </div>
    </div>
  );
};

// setup_relatable: "LOOKS DONE" → "IS DONE?" morph, with staged supporting
// tags on either side so the ~18s beat has an event every ~2-3s instead of the
// bare word holding for ~12s before the morph.
export const Relatable: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  // Cadence (rel frame, dur≈673):
  //   8    "LOOKS DONE" enters
  //   ~110 ✓ tests pass tag
  //   ~200 ✓ demo works tag
  //   ~300 morph → "IS DONE?"
  //   ~410 "did anyone actually check?" tag
  //   ~520 "probably not" tag
  const morphAt = Math.round(dur * 0.42);
  const okAt = Math.round(dur * 0.16);
  const ok2At = Math.round(dur * 0.29);
  const askAt = Math.round(dur * 0.58);
  const nopeAt = Math.round(dur * 0.74);
  const lastAt = Math.round(dur * 0.9);
  const Tag: React.FC<{
    at: number;
    out?: number;
    text: string;
    color: string;
    mono?: boolean;
  }> = ({ at, out, text, color, mono }) => {
    const p = rise(frame, at, 9);
    const o = out !== undefined ? p * (1 - rise(frame, out - 6, 9)) : p;
    return (
      <div style={{ opacity: o, transform: `translateY(${(1 - p) * 14}px)` }}>
        <span
          style={{
            fontFamily: mono ? MONO : SANS,
            fontWeight: mono ? 700 : 900,
            fontSize: mono ? 40 : 54,
            color,
            letterSpacing: "-0.01em",
            textShadow: `0 0 30px ${color}33`,
          }}
        >
          {text}
        </span>
      </div>
    );
  };
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <MorphWords
        a="LOOKS DONE"
        b="IS DONE?"
        at={morphAt}
        colorB={theme.warm}
      />
      {/* pre-morph supporting checks (dim out before the morph) */}
      <div
        style={{
          position: "absolute",
          top: 250,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Tag
          at={okAt}
          out={morphAt}
          text="✓ tests pass"
          color={theme.up}
          mono
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 720,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Tag
          at={ok2At}
          out={morphAt}
          text="✓ demo works"
          color={theme.up}
          mono
        />
      </div>
      {/* post-morph doubts */}
      <div
        style={{
          position: "absolute",
          top: 250,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Tag
          at={askAt}
          out={nopeAt}
          text="did anyone actually check?"
          color={theme.dim}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 200,
          width: "100%",
          textAlign: "center",
          opacity: 1 - rise(frame, lastAt - 6, 9),
        }}
      >
        <Tag at={nopeAt} text="probably not" color={theme.down} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 200,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Tag at={lastAt} text="that's the gap" color={theme.warm} />
      </div>
    </div>
  );
};

// "vibe coding" keyword + a cursor mashing accept-accept-accept below it.
// Staged across the ~23s beat so an event fires every ~2-3s: keyword → "not
// anti-AI" → the three accept buttons stamp one at a time (~90f apart) → "did
// you read any of it?" → "no". The bare keyword no longer holds for ~12s.
export const VibeCoding: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const notAntiAt = Math.round(dur * 0.14);
  const accept0 = Math.round(dur * 0.26);
  const acceptStep = Math.round(dur * 0.12); // ~90f between button stamps
  const keptAt = Math.round(dur * 0.62); // "and you kept clicking"
  const readAt = Math.round(dur * 0.74);
  const noAt = Math.round(dur * 0.87);
  const accepts = ["accept", "accept", "accept"];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
      }}
    >
      <Kw at={8} size={140} color={theme.accent}>
        &ldquo;vibe coding&rdquo;
      </Kw>
      {/* "this isn't anti-AI" caption — dims out as the buttons start stamping */}
      <div
        style={{
          position: "absolute",
          top: 250,
          width: "100%",
          textAlign: "center",
          opacity:
            rise(frame, notAntiAt, 9) * (1 - rise(frame, accept0 - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 52,
            color: theme.dim,
            letterSpacing: "-0.02em",
          }}
        >
          this isn&rsquo;t anti-AI
        </span>
      </div>
      <div style={{ display: "flex", gap: 26 }}>
        {accepts.map((t, i) => {
          const at = accept0 + i * acceptStep;
          const a = rise(frame, at, 8);
          // the "click": each button squishes right as it appears
          const click = interpolate(frame, [at, at + 6], [1, 0.9], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div key={i} style={{ opacity: a, transform: `scale(${click})` }}>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 34,
                  fontWeight: 700,
                  color: theme.up,
                  background: `${theme.up}1a`,
                  border: `2px solid ${theme.up}`,
                  borderRadius: 12,
                  padding: "14px 30px",
                }}
              >
                {t}
              </div>
            </div>
          );
        })}
        {/* cursor arrow that lands on the last button */}
        <CursorArrow appearAt={accept0 + 2 * acceptStep + 4} />
      </div>
      {/* bridge label between the last button and the doubt */}
      <div
        style={{
          position: "absolute",
          bottom: 220,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, keptAt, 9) * (1 - rise(frame, readAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 40,
            fontWeight: 700,
            color: theme.dim,
            letterSpacing: "0.04em",
          }}
        >
          accept · accept · accept
        </span>
      </div>
      {/* the "did you read any of it?" doubt, then "no" — the turn of the beat */}
      <div
        style={{
          position: "absolute",
          bottom: 220,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, readAt, 9) * (1 - rise(frame, noAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 56,
            color: theme.warm,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.warm}33`,
          }}
        >
          did you read any of it?
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 220,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, noAt, 9),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 72,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.down}44`,
          }}
        >
          no
        </span>
      </div>
    </div>
  );
};

const CursorArrow: React.FC<{ appearAt: number }> = ({ appearAt }) => {
  const frame = useCurrentFrame();
  const a = rise(frame, appearAt, 6);
  const nudge = Math.sin(frame / 5) * 3;
  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        bottom: -10,
        opacity: a,
        transform: `translate(${nudge}px, ${nudge}px)`,
      }}
    >
      <svg
        width="46"
        height="46"
        viewBox="0 0 24 24"
        fill={theme.ink}
        stroke={theme.bg}
        strokeWidth={1}
      >
        <path d="M4 2 L4 20 L9 15 L12 22 L15 21 L12 14 L19 14 Z" />
      </svg>
    </div>
  );
};

// A chip that flies in, its number counts up, then it docks into a growing grid
// (the "wall of leaks"). Used by the montage. Position given as a grid slot.
export interface LeakChip {
  name: string;
  value: string;
  /** frame (rel) the chip NAME enters big in the center */
  at: number;
  /** frame (rel) the value/number lands; defaults to `at` */
  countAt?: number;
  /** If set, the main value COUNTS UP from 0 to `countValue` and lands on
   *  `countAt` (a real count-up event on the mark, not a static string that
   *  fades in). `value` is then used only for the docked-label text. */
  countValue?: number;
  /** formats the counting value; defaults to the raw locale number. */
  countDisplay?: (v: number) => string;
  /** how many frames before `countAt` the count-up STARTS (default 20). A large
   *  value makes the number tick slowly across a long dwell (continuous motion)
   *  instead of a quick 20f pop right on the mark. */
  countFrom?: number;
  /** frame (rel) the chip docks down into the wall; defaults to next chip's `at` */
  dockAt?: number;
  color?: string;
  /** An intermediate reveal on this chip's OWN beat, so a chip that stays on
   *  screen a long time keeps producing motion instead of sitting static. The
   *  number counts up from 0 and lands its final value on `at` (rel frame). */
  sub?: { at: number; value: number; suffix?: string; label: string };
  /** A short caption shown BEFORE the count lands, so a chip whose name enters
   *  well ahead of its number keeps producing an event in the dwell between. */
  pre?: { at: number; out: number; text: string };
}

export const LeakWall: React.FC<{
  chips: LeakChip[];
  dur: number;
  scanAt?: number;
}> = ({ chips, dur, scanAt }) => {
  const frame = useCurrentFrame();
  // The summary line lands a beat AFTER the scan count so the "5,600" count-up
  // (on the scan mark) and the "→ holes/keys" summary read as two events, not
  // one — keeping the montage tail moving past the mark.
  const closeAt = scanAt != null ? scanAt + 60 : Math.round(dur * 0.78);
  // Once a chip is "done" it docks into the growing wall at the bottom; while
  // active it sits big in the center. Docking is a continuous transform, so a
  // prior chip stays visible as a label — no dead air between chips.
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* the growing wall at the bottom */}
      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          bottom: 130,
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          justifyContent: "center",
        }}
      >
        {chips.map((c, i) => {
          const dockAt =
            c.dockAt ?? (i + 1 < chips.length ? chips[i + 1].at : c.at + 40);
          const docked = rise(frame, dockAt, 9);
          if (docked <= 0) return null;
          return (
            <div
              key={i}
              style={{
                opacity: docked,
                transform: `scale(${0.9 + docked * 0.1})`,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 24,
                  color: theme.dim,
                  border: `2px solid ${theme.down}55`,
                  borderLeft: `5px solid ${theme.down}`,
                  borderRadius: 8,
                  padding: "8px 14px",
                  background: theme.panel,
                }}
              >
                {c.name} · {c.value}
                {c.sub
                  ? ` · ${c.sub.value.toLocaleString("en-US")} ${c.sub.label}`
                  : ""}
              </div>
            </div>
          );
        })}
      </div>
      {/* the active big chip in the center */}
      {chips.map((c, i) => {
        const dockAt =
          c.dockAt ?? (i + 1 < chips.length ? chips[i + 1].at : c.at + 40);
        const on = rise(frame, c.at, 8);
        const off = interpolate(frame, [dockAt - 8, dockAt], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const o = Math.min(on, off);
        if (o <= 0) return null;
        const col = c.color ?? theme.down;
        // the value fades in on its own beat (may be later than the name). For a
        // counting value it appears ~20f early so the count-up motion is visible
        // arriving at the mark; for a static string it snaps in on countAt.
        const countLead = c.countFrom ?? 20;
        const val =
          c.countValue !== undefined
            ? rise(frame, (c.countAt ?? c.at) - countLead, 10)
            : rise(frame, c.countAt ?? c.at, 10);
        // optional: the main value COUNTS UP and lands on countAt (a real
        // number event on the mark). Count starts `countLead` frames before the
        // mark so it is in motion arriving AT the word, then holds its value.
        const countTo = c.countAt ?? c.at;
        const mainCount =
          c.countValue !== undefined
            ? interpolate(frame, [countTo - countLead, countTo], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              })
            : 1;
        const mainValueText =
          c.countValue !== undefined
            ? c.countDisplay
              ? c.countDisplay(c.countValue * mainCount)
              : Math.round(c.countValue * mainCount).toLocaleString("en-US")
            : c.value;
        // optional intermediate reveal: a number that counts up on its own beat
        // so a long-lived chip keeps moving through the middle of its dwell.
        const sub = c.sub;
        const subIn = sub ? rise(frame, sub.at, 9) : 0;
        const subCount = sub
          ? interpolate(frame, [sub.at, sub.at + 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            })
          : 0;
        // optional pre-count caption (fills the dwell between name and number)
        const pre = c.pre;
        const preIn = pre
          ? rise(frame, pre.at, 9) * (1 - rise(frame, pre.out - 6, 9))
          : 0;
        return (
          <div
            key={`big-${i}`}
            style={{
              position: "absolute",
              top: 320,
              left: 0,
              right: 0,
              textAlign: "center",
              opacity: o,
              transform: `scale(${0.94 + on * 0.06})`,
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: 96,
                color: theme.ink,
                letterSpacing: "-0.02em",
              }}
            >
              {c.name}
            </div>
            {pre && (
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 40,
                  color: theme.dim,
                  marginTop: 14,
                  opacity: preIn,
                  transform: `translateY(${(1 - preIn) * 10}px)`,
                }}
              >
                {pre.text}
              </div>
            )}
            <div
              style={{
                fontFamily: MONO,
                fontSize: 52,
                color: col,
                marginTop: 14,
                opacity: val,
                transform: `translateY(${(1 - val) * 12}px)`,
              }}
            >
              {mainValueText}
            </div>
            {sub && (
              <div
                style={{
                  marginTop: 26,
                  opacity: subIn,
                  transform: `translateY(${(1 - subIn) * 16}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: SANS,
                    fontWeight: 900,
                    fontSize: 84,
                    color: theme.warm,
                    letterSpacing: "-0.02em",
                    textShadow: `0 0 40px ${theme.warm}44`,
                  }}
                >
                  {Math.round(sub.value * subCount).toLocaleString("en-US")}
                  {sub.suffix ?? ""}
                </span>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 30,
                    color: theme.dim,
                    marginTop: 4,
                  }}
                >
                  {sub.label}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {/* the closing summary, STAGED in two parts after the scan count so the
          montage tail keeps producing events (holes, then keys) instead of
          parking on the docked wall. */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity:
            rise(frame, closeAt, 9) * (1 - rise(frame, closeAt + 90 - 6, 9)),
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 34, color: theme.warm }}>
          one sweep → 2,000+ holes found
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity:
            rise(frame, closeAt + 90, 9) *
            (1 - rise(frame, closeAt + 180 - 6, 9)),
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 34, color: theme.down }}>
          400+ live keys · just lying there
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: rise(frame, closeAt + 180, 9),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 52,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.down}44`,
          }}
        >
          and this was ONE scan
        </span>
      </div>
    </div>
  );
};

// Repeated app skeleton with a red "skipped safeguards" checklist stamping
// across in sync. Object constancy — one frame reused three times.
export const SkippedPattern: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const skips = [
    "lock the door behind you",
    "don't trust the browser",
    "check who can read this",
  ];
  // Stage events ~2-3s apart across the whole ~33s beat so nothing parks:
  //   8/98/188   the three "ships fine" skeletons appear one at a time
  //   ~290/380/470  the red skipped-safeguard items stamp in, staggered
  //   ~610       "same pattern, every time" caption lands
  const skelStep = 90; // ~3s between each skeleton appearing
  const stampStart = Math.round(dur * 0.28);
  const stampStep = 85; // ~2.8s between each red stamp
  const patternAt = stampStart + 3 * stampStep; // right after the last stamp
  // four more tail captions after "same pattern" on the same ~85f cadence so
  // the last stretch never parks (last one lands near the beat end)
  const tail2At = patternAt + stampStep;
  const tail3At = patternAt + 2 * stampStep;
  const tail4At = patternAt + 3 * stampStep;
  const tail5At = patternAt + 4 * stampStep;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
      }}
    >
      {/* three identical app skeletons — arriving one at a time */}
      <div style={{ display: "flex", gap: 40 }}>
        {[0, 1, 2].map((i) => {
          const a = rise(frame, 8 + i * skelStep, 10);
          return (
            <div
              key={i}
              style={{
                width: 260,
                height: 360,
                borderRadius: 16,
                border: `2px solid ${theme.stroke}`,
                background: theme.panel,
                opacity: a,
                transform: `scale(${0.94 + a * 0.06})`,
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  height: 18,
                  width: "60%",
                  background: theme.stroke,
                  borderRadius: 6,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "90%",
                  background: theme.stroke,
                  borderRadius: 6,
                  opacity: 0.6,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "80%",
                  background: theme.stroke,
                  borderRadius: 6,
                  opacity: 0.6,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "88%",
                  background: theme.stroke,
                  borderRadius: 6,
                  opacity: 0.6,
                }}
              />
              <div
                style={{
                  marginTop: "auto",
                  height: 40,
                  borderRadius: 8,
                  background: `${theme.up}22`,
                  border: `2px solid ${theme.up}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{ fontFamily: MONO, fontSize: 20, color: theme.up }}
                >
                  ships fine
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* the red skipped checklist stamps in on the right — one every ~3s. Each
          box and its label stamp with a 3f stagger (box, then label) for a real
          two-part event, spread across the beat rather than bunched. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {skips.map((s, i) => {
          const at = stampStart + i * stampStep;
          const box = rise(frame, at, 8);
          const label = rise(frame, at + 3, 8);
          return (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 18 }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 10,
                  border: `3px solid ${theme.down}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: box,
                  transform: `scale(${0.9 + box * 0.1})`,
                }}
              >
                <span
                  style={{
                    color: theme.down,
                    fontSize: 34,
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  ×
                </span>
              </div>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 32,
                  color: theme.down,
                  textDecoration: "line-through",
                  textDecorationColor: `${theme.down}88`,
                  opacity: label,
                  transform: `translateX(${(1 - label) * 30}px)`,
                }}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>
      {/* late caption so the tail keeps moving after the last stamp */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          textAlign: "center",
          opacity:
            rise(frame, patternAt, 8) * (1 - rise(frame, tail2At - 6, 8)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 60,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.down}44`,
          }}
        >
          same pattern · every time
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          textAlign: "center",
          opacity: rise(frame, tail2At, 8) * (1 - rise(frame, tail3At - 6, 8)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 60,
            color: theme.warm,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.warm}44`,
          }}
        >
          ship first · secure never
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          textAlign: "center",
          opacity: rise(frame, tail3At, 8) * (1 - rise(frame, tail4At - 6, 8)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 60,
            color: theme.dim,
            letterSpacing: "-0.02em",
          }}
        >
          nobody circles back
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          textAlign: "center",
          opacity: rise(frame, tail4At, 8) * (1 - rise(frame, tail5At - 6, 8)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 60,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.down}44`,
          }}
        >
          and it ships anyway
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          textAlign: "center",
          opacity: rise(frame, tail5At, 8),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 60,
            color: theme.warm,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.warm}44`,
          }}
        >
          every · single · time
        </span>
      </div>
    </div>
  );
};

// core_debt: human code = a traceable thread to a "reason"; AI code = a black
// box with no thread; then a slow fuse burns toward "6 months".
export const DebtSplit: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  // Stage sub-points on a steady ~90f (~3s) cadence so nothing sits static
  // across this long (~34s) beat. Events (rel frame, dur≈1008):
  //   8    human box + label appear
  //   8→98 human thread DRAWS to "reason" (continuous, not a snap)
  //   ~160 "you can find why" caption
  //   ~250 AI black box appears
  //   ~340 "no one can say why" caption
  //   ~430 fuse lights and begins burning
  //   ~430→650 fuse burns toward 6 months (continuous)
  //   ~650 "fine for a week" caption
  //   ~740 "fine for the demo" restated
  //   ~860 "the bill comes later" lands
  const humanAt = 8;
  const humanReasonAt = 160;
  const aiAt = 250;
  const aiWhyAt = 340;
  const fuseAt = 430;
  const fineAt = 650;
  const billAt = Math.min(860, dur - 60);
  // The human thread draws over ~90f (a continuous line-draw-on event), not the
  // 8f pop that left it static for seconds afterward.
  const human = rise(frame, humanAt, 8);
  const humanDraw = interpolate(frame, [humanAt, humanAt + 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const ai = rise(frame, aiAt, 8);
  // The fuse burns all the way to the "bill" beat so its spark is continuous
  // motion right up to the last caption (no static stretch mid-beat or tail).
  const fuse = interpolate(frame, [fuseAt, billAt], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* LEFT: human code with a thread you can trace to a reason */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 260,
          width: 640,
          opacity: human,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            color: theme.dim,
            marginBottom: 22,
          }}
        >
          human code · messy but knowable
        </div>
        <svg width="640" height="300" viewBox="0 0 640 300">
          <rect
            x="20"
            y="20"
            width="180"
            height="80"
            rx="12"
            fill={theme.panel}
            stroke={theme.stroke}
            strokeWidth={2}
          />
          <path
            d="M200 60 C 320 60, 340 200, 460 200"
            stroke={theme.up}
            strokeWidth={5}
            fill="none"
            strokeDasharray={400}
            strokeDashoffset={400 * (1 - humanDraw)}
            strokeLinecap="round"
          />
          {/* the thread lands on a "reason" the code exists — tagged with a dot +
              underline that arrive AS the thread finishes drawing (NO ring/circle
              anywhere, per creator note). */}
          <circle
            cx="464"
            cy="200"
            r={7 * humanDraw}
            fill={theme.up}
            opacity={humanDraw}
          />
          <text
            x="486"
            y="208"
            textAnchor="start"
            fontFamily={MONO}
            fontSize={26}
            fill={theme.up}
            opacity={humanDraw}
          >
            reason
          </text>
          <path
            d={`M486 216 H${486 + 96 * humanDraw}`}
            stroke={theme.up}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={humanDraw}
          />
          <text
            x="110"
            y="66"
            textAnchor="middle"
            fontFamily={MONO}
            fontSize={24}
            fill={theme.ink}
          >
            it works
          </text>
        </svg>
        {/* mid-beat sub-reveal on the human side: you CAN trace it back */}
        <div style={{ opacity: rise(frame, humanReasonAt, 8) }}>
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 46,
              color: theme.up,
              letterSpacing: "-0.02em",
            }}
          >
            you can find why
          </span>
        </div>
      </div>
      {/* RIGHT: AI black box, no thread */}
      <div
        style={{
          position: "absolute",
          right: 160,
          top: 260,
          width: 640,
          opacity: ai,
          textAlign: "right",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            color: theme.dim,
            marginBottom: 22,
          }}
        >
          AI code · nobody read it
        </div>
        <svg
          width="640"
          height="300"
          viewBox="0 0 640 300"
          style={{ display: "inline-block" }}
        >
          <rect
            x="230"
            y="20"
            width="200"
            height="120"
            rx="14"
            fill="#05070a"
            stroke={theme.down}
            strokeWidth={3}
          />
          <text
            x="330"
            y="90"
            textAnchor="middle"
            fontFamily={MONO}
            fontSize={26}
            fill={theme.down}
          >
            black box
          </text>
          <text
            x="330"
            y="200"
            textAnchor="middle"
            fontFamily={MONO}
            fontSize={24}
            fill={theme.dim}
          >
            no thread · no author
          </text>
        </svg>
      </div>
      {/* mid-beat sub-reveal on the AI side: nobody can say WHY it works */}
      <div
        style={{
          position: "absolute",
          right: 160,
          top: 590,
          width: 640,
          textAlign: "right",
          opacity: rise(frame, aiWhyAt, 8),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 46,
            color: theme.down,
            letterSpacing: "-0.02em",
          }}
        >
          no one can say why
        </span>
      </div>
      {/* the fuse burning toward 6 months */}
      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          bottom: 210,
          opacity: rise(frame, fuseAt - 6, 8),
        }}
      >
        <div
          style={{
            position: "relative",
            height: 8,
            background: theme.stroke,
            borderRadius: 4,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${fuse * 100}%`,
              background: `linear-gradient(90deg, ${theme.warm}, ${theme.down})`,
              borderRadius: 4,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -8,
              left: `calc(${fuse * 100}% - 12px)`,
              width: 24,
              height: 24,
              borderRadius: 12,
              background: theme.down,
              boxShadow: `0 0 26px ${theme.down}`,
              opacity: fuse < 1 ? 1 : 0,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 16,
            fontFamily: MONO,
            fontSize: 28,
            color: theme.dim,
          }}
        >
          <span>the demo</span>
          <span style={{ color: theme.down, opacity: fuse }}>
            6 months &rarr; the bill
          </span>
        </div>
      </div>
      {/* late staged text so the tail of the beat keeps moving: "fine for a
          week" dims out as "the bill comes later" lands */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 110,
          textAlign: "center",
          opacity: rise(frame, fineAt, 8) * (1 - rise(frame, billAt - 4, 8)),
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 34, color: theme.dim }}>
          fine for a week &middot; fine for the demo
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 130,
          textAlign: "center",
          opacity:
            rise(frame, billAt, 8) * (1 - rise(frame, billAt + 90 - 6, 8)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 60,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.down}44`,
          }}
        >
          the bill comes later
        </span>
      </div>
      {/* final tail beat so the last ~5s never parks on the "bill" line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 110,
          textAlign: "center",
          opacity: rise(frame, billAt + 90, 8),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 60,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.down}44`,
          }}
        >
          and it always comes
        </span>
      </div>
    </div>
  );
};

// debt curve bending from linear to exponential (drawn over the ruins image).
// `spanFrames` lets the caller stretch the draw across a long beat so the curve
// keeps BENDING progressively (a real content event) instead of snapping in and
// freezing. The endpoint marker slides along the path as it draws.
export const DebtCurve: React.FC<{ at: number; spanFrames?: number }> = ({
  at,
  spanFrames = 26,
}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [at, at + spanFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const W = 620;
  const H = 360;
  const LEN = 1400;
  const d = "M40 320 C 200 315, 300 300, 400 220 S 520 40, 580 30";
  // A dot rides the front of the drawn stroke so there is always visible motion
  // while the curve bends (front-of-line follows the exponential blow-up).
  const dotX = 40 + (580 - 40) * draw;
  const dotY = 320 - (320 - 30) * Math.pow(draw, 2.4);
  return (
    <div
      style={{
        position: "absolute",
        right: 140,
        bottom: 150,
        width: W,
        height: H,
        background: "rgba(5,7,10,0.72)",
        borderRadius: 18,
        border: `2px solid ${theme.stroke}`,
        padding: 20,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 26,
          color: theme.dim,
          marginBottom: 6,
        }}
      >
        debt · it multiplies
      </div>
      <svg width={W - 40} height={H - 70} viewBox={`0 0 ${W} ${H}`}>
        <path d={`M40 320 H580`} stroke={theme.stroke} strokeWidth={2} />
        <path d={`M40 320 V20`} stroke={theme.stroke} strokeWidth={2} />
        <path
          d={d}
          stroke={theme.down}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={LEN}
          strokeDashoffset={LEN * (1 - draw)}
        />
        {draw > 0.02 && draw < 0.995 && (
          <circle cx={dotX} cy={dotY} r={9} fill={theme.down} opacity={0.9} />
        )}
      </svg>
    </div>
  );
};

// payoff_who_pays: founder figure walks off; a "new hire" inherits the box.
export const Inheritance: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  // Events on a ~90f (~3s) cadence across the ~25s beat so nothing parks:
  //   8    box + founder appear
  //   ~90  "who owns this?" caption
  //   ~150→300 founder WALKS off (slow, continuous motion)
  //   ~300 "long gone" caption
  //   ~390 new hire arrives
  //   ~480 "you inherit it" caption
  //   ~570 "sorry in advance" caption
  //   ~660 "no map · no author" final
  const ownsAt = Math.round(dur * 0.13);
  const walkAt = Math.round(dur * 0.2);
  const goneAt = Math.round(dur * 0.4);
  const hireAt = Math.round(dur * 0.52);
  const inheritAt = Math.round(dur * 0.63);
  const sorryAt = Math.round(dur * 0.75);
  const finalAt = Math.round(dur * 0.88);
  // The founder walks off slowly (continuous motion, ~150f) rather than a 26f
  // dart, so the middle of the beat keeps moving instead of holding.
  const walk = interpolate(frame, [walkAt, walkAt + 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const hire = rise(frame, hireAt, 10);
  const Figure: React.FC<{ color: string; label: string }> = ({
    color,
    label,
  }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <svg width="90" height="150" viewBox="0 0 90 150">
        <circle
          cx="45"
          cy="30"
          r="24"
          fill="none"
          stroke={color}
          strokeWidth={5}
        />
        <path
          d="M45 54 V110 M45 70 L15 100 M45 70 L75 100 M45 110 L20 148 M45 110 L70 148"
          stroke={color}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span style={{ fontFamily: MONO, fontSize: 26, color }}>{label}</span>
    </div>
  );
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 120,
      }}
    >
      {/* founder walks off to the left */}
      <div
        style={{ opacity: 1 - walk, transform: `translateX(${-walk * 400}px)` }}
      >
        <Figure color={theme.dim} label="the founder · long gone" />
      </div>
      {/* the inherited black box in the middle */}
      <div style={{ opacity: rise(frame, 8, 9) }}>
        <div
          style={{
            width: 240,
            height: 160,
            borderRadius: 14,
            background: "#05070a",
            border: `3px solid ${theme.down}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 26, color: theme.down }}>
            no author · no map
          </span>
        </div>
      </div>
      {/* the new hire arrives on the right */}
      <div
        style={{ opacity: hire, transform: `translateX(${(1 - hire) * 60}px)` }}
      >
        <Figure color={theme.accent} label="whoever they hire next" />
      </div>
      {/* top caption slot — one line at a time on the ~90f cadence */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 170,
          textAlign: "center",
          opacity: rise(frame, ownsAt, 9) * (1 - rise(frame, goneAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 56,
            color: theme.dim,
            letterSpacing: "-0.02em",
          }}
        >
          so who owns this now?
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 170,
          textAlign: "center",
          opacity: rise(frame, goneAt, 9) * (1 - rise(frame, inheritAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 56,
            color: theme.dim,
            letterSpacing: "-0.02em",
          }}
        >
          the founder&rsquo;s long gone
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 170,
          textAlign: "center",
          opacity:
            rise(frame, inheritAt, 9) * (1 - rise(frame, sorryAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 56,
            color: theme.accent,
            letterSpacing: "-0.02em",
          }}
        >
          someone else inherits it
        </span>
      </div>
      {/* bottom caption slot — sorry, then the final line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          textAlign: "center",
          opacity: rise(frame, sorryAt, 8) * (1 - rise(frame, finalAt - 6, 8)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 56,
            color: theme.warm,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.warm}44`,
          }}
        >
          if that&rsquo;s you &mdash; sorry in advance
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          textAlign: "center",
          opacity: rise(frame, finalAt, 8),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 56,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 40px ${theme.down}44`,
          }}
        >
          no map · no author · your problem
        </span>
      </div>
    </div>
  );
};
