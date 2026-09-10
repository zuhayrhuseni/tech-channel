import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import timing from "../../episodes/003-vibe-coding-hangover/timing.json";
import assets from "../../episodes/003-vibe-coding-hangover/assets.json";
import { AmbientBackground } from "../components/AmbientBackground";
import { BRoll } from "../components/BRoll";
import { FakeTerminal } from "../components/FakeTerminal";
import { SfxLayer, type SfxEvent } from "../components/SfxLayer";
import { KineticCaption } from "../components/KineticCaption";
import { LineReveal } from "../components/charts";
import { theme } from "../components/theme";
import { MONO, SANS } from "../trailer/fonts";
import { Cursor, Kw } from "../trailer/Kinetic";
import { BroadcastFrame } from "../e002/BroadcastFrame";
import {
  BreachTimeline,
  DebtCurve,
  DebtSplit,
  Inheritance,
  LeakWall,
  Relatable,
  ScrollingCapture,
  SkippedPattern,
  UncheckedBox,
  VibeCoding,
  rise,
  spread,
} from "./viz";

// timing.json uses audioMs / durationMs (same as e002). Total duration in
// frames = seconds * fps, rounded up so the audio never gets clipped.
export const E003_DURATION = Math.ceil((timing.audioMs / 1000) * timing.fps);

type MarkFn = (id: string, fallback?: number) => number;
type SceneProps = { m: MarkFn; dur: number };

// Typed views of the fetched assets (assets.json). staticFile paths come from
// `.file`. Circle annotations are intentionally dropped (creator note: "get rid
// of the circling animations") — the screenshots are shown zoomed-OUT and
// readable, so nothing needs ringing.
type Asset = { file: string; w: number; h: number };
const rawAssets = assets.assets as unknown as Record<
  string,
  { file: string; w: number; h: number }
>;
const asAsset = (a: (typeof rawAssets)[string]): Asset => ({
  file: a.file,
  w: a.w,
  h: a.h,
});
const A = {
  hook_moltbook: asAsset(rawAssets.hook_moltbook),
  receipts_replit: asAsset(rawAssets.receipts_replit),
};

// Per-beat background b-roll (assets.<beatId>.broll). Six talky beats carry a
// clip that plays BEHIND the scene content (above AmbientBackground). Read
// loosely — the source JSON only guarantees {file, kind} on these entries.
type BRollEntry = { file: string; kind: "video" | "image" };
const rawBroll = assets.assets as Record<
  string,
  { broll?: { file: string; kind: string } }
>;
const brollFor = (id: string): BRollEntry | null => {
  const b = rawBroll[id]?.broll;
  if (!b) return null;
  return { file: b.file, kind: b.kind === "image" ? "image" : "video" };
};

const Center: React.FC<{ children: React.ReactNode; top?: number }> = ({
  children,
  top = 400,
}) => (
  <div
    style={{
      position: "absolute",
      top,
      left: 120,
      right: 120,
      textAlign: "center",
    }}
  >
    {children}
  </div>
);

// ClaimCallout: an on-brand text plate overlaid on a ScrollingCapture so the
// spoken claim is always legible regardless of the pan. Enters ~3 frames before
// its word (via `rise`) and holds. Dark scrim behind for contrast over the shot.
const ClaimCallout: React.FC<{ at: number; label: string; quote: string }> = ({
  at,
  label,
  quote,
}) => {
  const frame = useCurrentFrame();
  const p = rise(frame, at, 12);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 210,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity: p,
          transform: `translateY(${(1 - p) * 22}px) scale(${0.96 + p * 0.04})`,
          maxWidth: 1280,
          padding: "26px 48px",
          borderRadius: 18,
          background: "rgba(5,7,10,0.82)",
          border: `2px solid ${theme.stroke}`,
          borderLeft: `6px solid ${theme.warm}`,
          boxShadow: "0 12px 48px #000a",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            color: theme.dim,
            letterSpacing: "0.06em",
            marginBottom: 12,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 68,
            color: theme.ink,
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            textShadow: `0 0 30px ${theme.warm}33`,
            overflowWrap: "break-word",
          }}
        >
          &ldquo;{quote}&rdquo;
        </div>
      </div>
    </div>
  );
};

// SourceChip: a small mono source-attribution chip that names the site the
// screenshot is from, so the source is unambiguous even before the headline is
// read. Rises in and holds; pinned to a corner, never overflows.
const SourceChip: React.FC<{
  at: number;
  label: string;
  where?: "tl" | "tr";
}> = ({ at, label, where = "tl" }) => {
  const frame = useCurrentFrame();
  const p = rise(frame, at, 8);
  const pos = where === "tl" ? { left: 120 } : { right: 120 };
  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        ...pos,
        opacity: p,
        transform: `translateY(${(1 - p) * -12}px)`,
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: 30,
          fontWeight: 700,
          color: theme.dim,
          background: "rgba(5,7,10,0.82)",
          border: `2px solid ${theme.stroke}`,
          borderRadius: 10,
          padding: "10px 20px",
          letterSpacing: "0.04em",
          display: "inline-block",
        }}
      >
        {label}
      </span>
    </div>
  );
};

// AccentChip: a bottom-anchored keyword accent used over a screenshot. It is an
// ACCENT on the readable source, not a wall of words — one short phrase at a
// time, each dimming out before the next arrives. Centered, wraps, never
// exceeds the safe width.
const AccentChip: React.FC<{
  at: number;
  out?: number;
  text: string;
  color?: string;
}> = ({ at, out, text, color = theme.ink }) => {
  const frame = useCurrentFrame();
  const enter = rise(frame, at, 8);
  const exit = out !== undefined ? 1 - rise(frame, out, 8) : 1;
  const o = Math.min(enter, exit);
  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        right: 120,
        bottom: 170,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: o,
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 84,
          color,
          letterSpacing: "-0.02em",
          textAlign: "center",
          lineHeight: 1.05,
          textShadow: `0 2px 20px #000c, 0 0 40px ${color}33`,
          maxWidth: 1560,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// FreezeHighlight: a highlight bar that WIPES across (a mask-wipe reveal, not a
// pop) landing a labelled marker on the word "freeze" — the visual event the
// Register beat was missing while the article scrolled statically past the mark.
const FreezeHighlight: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const wipe = interpolate(frame, [at - 3, at + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const appear = rise(frame, at, 8);
  return (
    <div
      style={{
        position: "absolute",
        left: 200,
        right: 200,
        top: 470,
        pointerEvents: "none",
      }}
    >
      {/* the sweeping highlight band */}
      <div
        style={{
          height: 84,
          borderRadius: 12,
          background: `${theme.warm}22`,
          border: `2px solid ${theme.warm}`,
          borderLeft: `8px solid ${theme.warm}`,
          width: `${wipe * 100}%`,
          boxShadow: `0 0 40px ${theme.warm}33`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 40,
            fontWeight: 700,
            color: theme.warm,
            letterSpacing: "0.02em",
            marginLeft: 24,
            whiteSpace: "nowrap",
            opacity: appear,
          }}
        >
          froze ALL code changes
        </span>
      </div>
    </div>
  );
};

// HookMoltbook: the reworked intro. Opens on the Wiz writeup shown ZOOMED OUT
// and READABLE (the top band literally reads "Moltbook" + "Supabase database" +
// the exposure numbers), so within ~3-4s it is obvious THIS IS MOLTBOOK, IT GOT
// BREACHED. A source chip names wiz.io; fast keyword accents punctuate the read
// instead of covering it; the founder's admission lands as a callout on
// `bragged`. Screenshot scrolls gently through the readable page — never zooms.
const HookMoltbook: React.FC<{
  src: string;
  imgW: number;
  imgH: number;
  dur: number;
  bragged: number;
}> = ({ src, imgW, imgH, dur, bragged }) => (
  <>
    <ScrollingCapture
      src={src}
      imgW={imgW}
      imgH={imgH}
      dur={dur}
      scrollFrom={0}
      scrollTo={0.34}
    />
    <SourceChip at={6} label="wiz.io · security research" where="tr" />
    {/* fast accents — one short phrase at a time, each clearing before the next */}
    <AccentChip at={40} out={150} text="Moltbook" color={theme.accent} />
    <AccentChip
      at={165}
      out={bragged - 30}
      text="database left wide open"
      color={theme.down}
    />
    {/* the founder's admission, landing on its word */}
    <ClaimCallout
      at={bragged}
      label="the founder bragged"
      quote="wrote none of the code himself"
    />
  </>
);

// StagedWords: reveals 2-5 lines across a beat (tracks narration sub-points) so
// something new lands every ~3s; earlier lines dim as new ones arrive. Mirrors
// the e002 pattern (quiet-register, non-card text beats).
const StagedWords: React.FC<{
  dur: number;
  lines: Array<{ t: React.ReactNode; c?: string; s?: number }>;
}> = ({ dur, lines }) => {
  const frame = useCurrentFrame();
  const current = lines.filter(
    (_, i) => spread(dur, i, lines.length) <= frame,
  ).length;
  return (
    <div
      style={{
        position: "absolute",
        top: 300,
        left: 120,
        right: 120,
        display: "flex",
        flexDirection: "column",
        gap: 26,
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {lines.map((ln, i) => {
        const at = spread(dur, i, lines.length);
        const p = interpolate(frame, [at - 2, at + 9], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const isLatest = i === current - 1;
        const dim = i < current - 1 ? 0.4 : 1;
        return (
          <div
            key={i}
            style={{
              opacity: p * dim,
              transform: `translateY(${(1 - p) * 20}px) scale(${isLatest ? 1 : 0.92})`,
              filter: `blur(${(1 - p) * 5}px)`,
            }}
          >
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: ln.s ?? 76,
                color: ln.c ?? theme.ink,
                letterSpacing: "-0.02em",
                textShadow: `0 0 30px ${ln.c ?? theme.ink}33`,
              }}
            >
              {ln.t}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Two lines that DIVERGE — adoption climbs (76→84) while trust falls (40→29),
// widening the gap. Not a crossing (the data never crosses); the point is the
// spreading distance between "using it" and "believing it". The adoption count
// lands exactly on p84; the divergence caption lands on `drop`.
const TrustGap: React.FC<{ m: MarkFn }> = ({ m }) => {
  const frame = useCurrentFrame();
  const p84 = m("p84", 217);
  const drop = m("drop", 618);
  // Layer events so one fires every ≤3s across this ~35s beat — no 4s dead gap:
  //   0     header
  //   ~40   "adoption" label above the climbing line
  //   126→216  adoption line DRAWS, "84" lands ON p84 (word "eighty-four")
  //   ~280  "84% now use it" caption (the up-number restated as a beat)
  //   ~400  "trust" label as the second line starts drawing
  //   527→617  trust line DRAWS, "29" lands ON drop (word "It")
  //   ~660  "the gap widens" caption
  //   ~760  a highlight band sweeps the widening gap between the two endpoints
  //   ~860  "fewer of us believe it" caption
  const adoptLabelAt = 40;
  const usePctAt = p84 + 60;
  const trustLabelAt = p84 + 150;
  const gapAt = drop + 40;
  const bandAt = drop + 130;
  const believeAt = drop + 220;
  const spreadAt = drop + 310;
  // The highlight band widens SLOWLY across the tail (not a 14f snap) so it is a
  // continuous content event under the closing captions — always something
  // moving through the ~927→end stretch.
  const band = interpolate(frame, [bandAt, bandAt + 260], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 150,
          width: "100%",
          textAlign: "center",
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 34, color: theme.dim }}>
          Stack Overflow · 2025 developer survey
        </span>
      </div>
      {/* a highlight band behind the chart marking the widening gap (a real
          reveal, not drift) — sits under the line art, sweeps open on bandAt */}
      <div
        style={{
          position: "absolute",
          top: 300,
          left: "50%",
          width: 900 * band,
          height: 300,
          transform: "translateX(-450px)",
          background: `linear-gradient(180deg, ${theme.up}14, ${theme.down}14)`,
          borderLeft: `3px solid ${theme.warm}66`,
          borderRight: `3px solid ${theme.warm}66`,
          opacity: band,
          borderRadius: 6,
          pointerEvents: "none",
        }}
      />
      {/* Longer draw span (180f ≈ 6s) so each line is CONTINUOUSLY drawing into
          its mark — the adoption line fills 0→p84 with no dead lead-in, the
          trust line fills into `drop`, so the chart is never a static hold. */}
      <LineReveal
        fromFrame={0}
        yDomain={[20, 92]}
        drawFrames={180}
        series={[
          {
            label: "use AI tools",
            color: "up",
            land_at: p84,
            points: [
              { x: 0, y: 76 },
              { x: 0.5, y: 80 },
              { x: 1, y: 84 },
            ],
          },
          {
            label: "trust the output",
            color: "down",
            land_at: drop,
            points: [
              { x: 0, y: 40 },
              { x: 0.5, y: 35 },
              { x: 1, y: 29 },
            ],
          },
        ]}
      />
      {/* "adoption" tag above the climbing line */}
      <div
        style={{
          position: "absolute",
          top: 250,
          left: "50%",
          transform: "translateX(-220px)",
          opacity: rise(frame, adoptLabelAt, 9),
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 30,
            color: theme.up,
            letterSpacing: "0.04em",
          }}
        >
          adoption ↑
        </span>
      </div>
      {/* restated up-number as its own beat, ~2s after 84 lands */}
      <div
        style={{
          position: "absolute",
          top: 218,
          left: "50%",
          transform: "translateX(-40px)",
          opacity:
            rise(frame, usePctAt, 9) * (1 - rise(frame, trustLabelAt - 6, 9)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 52,
            color: theme.up,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.up}33`,
          }}
        >
          84% now use it
        </span>
      </div>
      {/* "trust" tag as the second line begins drawing */}
      <div
        style={{
          position: "absolute",
          top: 640,
          left: "50%",
          transform: "translateX(-220px)",
          opacity: rise(frame, trustLabelAt, 9),
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 30,
            color: theme.down,
            letterSpacing: "0.04em",
          }}
        >
          trust ↓
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 200,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, gapAt, 12),
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 32, color: theme.warm }}>
          the gap keeps widening
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 140,
          width: "100%",
          textAlign: "center",
          opacity:
            rise(frame, believeAt, 12) * (1 - rise(frame, spreadAt - 6, 12)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 48,
            color: theme.warm,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.warm}44`,
          }}
        >
          more lean on it · fewer believe it
        </span>
      </div>
      {/* final beat: the gap sized as a number, landing near the beat's end so
          the tail never parks (breaks the ~927→end stretch into ≤3s segments) */}
      <div
        style={{
          position: "absolute",
          bottom: 140,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, spreadAt, 12),
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
          a 55-point gap · and growing
        </span>
      </div>
    </>
  );
};

// WRITE dims, READ lifts with a punch (loud register, alternates the diagrams).
// Staged across the ~32s beat so an event fires every ~2-3s: WRITE lands, "the
// model does that now" bridges, WRITE→READ crosses, then the three parts of the
// real skill (read / doubt / catch) reveal one at a time, then the closing line.
const TheSkill: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const introAt = 8; // opening line so the beat doesn't start on a gap
  const writeAt = Math.round(dur * 0.1);
  const usedToAt = Math.round(dur * 0.2); // "you used to write it"
  const modelAt = Math.round(dur * 0.3); // "the model does that now"
  const readAt = Math.round(dur * 0.4);
  // three staged parts of the skill after READ lands, then a two-stage close
  const part1At = readAt + 90; // "reading it"
  const part2At = readAt + 180; // "doubting it"
  const part3At = readAt + 270; // "catching the one skipped thing"
  const closeAt = readAt + 350; // "that's the job now"
  const close2At = Math.min(readAt + 440, dur - 40); // "keep it" tail
  const Part: React.FC<{ at: number; text: string; color: string }> = ({
    at,
    text,
    color,
  }) => {
    const p = rise(frame, at, 10);
    return (
      <div style={{ opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 40,
            fontWeight: 700,
            color,
            letterSpacing: "0.02em",
          }}
        >
          {text}
        </span>
      </div>
    );
  };
  return (
    <>
      {/* opening line lands right at beat-start (dims out as WRITE takes over) */}
      <div
        style={{
          position: "absolute",
          top: 170,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, introAt, 9) * (1 - rise(frame, writeAt - 6, 9)),
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
          so what&rsquo;s left for you?
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 280,
          width: "100%",
          textAlign: "center",
        }}
      >
        <FadeKw at={writeAt} out={readAt} size={150} color={theme.dim}>
          WRITE
        </FadeKw>
      </div>
      {/* two bridge lines under WRITE, one at a time — dim out as READ takes over */}
      <div
        style={{
          position: "absolute",
          top: 500,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, usedToAt, 9) * (1 - rise(frame, modelAt - 6, 9)),
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
          you used to write it
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 500,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, modelAt, 9) * (1 - rise(frame, readAt - 6, 9)),
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
          the model does that now
        </span>
      </div>
      <KineticCaption
        text="READ"
        fromFrame={readAt}
        holdFrames={Math.max(24, dur - readAt - 20)}
        emphasis="punch"
        dockTo="bottom-left"
      />
      {/* the three parts reveal one at a time down the right side, kept high and
          right-aligned so they clear the READ keyword that docks bottom-left */}
      <div
        style={{
          position: "absolute",
          right: 160,
          top: 170,
          display: "flex",
          flexDirection: "column",
          gap: 28,
          alignItems: "flex-end",
          textAlign: "right",
        }}
      >
        <Part at={part1At} text="reading it" color={theme.accent} />
        <Part at={part2At} text="doubting it" color={theme.warm} />
        <Part
          at={part3At}
          text="catching the skipped thing"
          color={theme.down}
        />
      </div>
      {/* two-stage close so the tail never parks: "that's the job now" then a
          final "the skill you keep" landing near the beat end. */}
      <div
        style={{
          position: "absolute",
          bottom: 150,
          width: "100%",
          textAlign: "center",
          opacity:
            rise(frame, closeAt, 12) * (1 - rise(frame, close2At - 6, 12)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 52,
            color: theme.accent,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.accent}44`,
          }}
        >
          that&rsquo;s the job now
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 150,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, close2At, 12),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 52,
            color: theme.accent,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.accent}44`,
          }}
        >
          the skill worth keeping
        </span>
      </div>
    </>
  );
};

// Archaeologist: dense, real-looking-but-incomprehensible AI-generated code in
// a FakeTerminal — the visual of "reading your own app like a dead language".
// All values are obviously synthetic (fake hashes, generic names, no real
// paths/creds), so the anonymity gate is satisfied by construction. The debt
// curve bends in over the tail. Staged callouts keep it moving fast.
// Enough dense lines that, at a deliberately slow cps, the terminal keeps
// TYPING (a real content event: new characters/lines) across most of the beat
// instead of finishing in the first few seconds and freezing. As lines fill the
// window the block scrolls up (windowScroll below), so motion continues.
const ARCH_LINES = [
  "// module z9f_handler.compiled — regenerated 2025-04-14",
  "const _q=(a,b)=>a?.[b]??_k(a,b,0x1f);",
  "export async function h(ctx){",
  "  const t=await _q(ctx,'tok')||sign(ctx.u,SALT_7c);",
  "  for(const n of ctx.q){ _m[n.k]=xform(n.v,t,3); }",
  "  if(_gate(t)&&!ctx.f){ return _drain(_m,ctx.u,true); }",
  "  return wrap(_m,{r:ctx.r,z:0xdead,ok:_gate(t)});",
  "}",
  "function xform(v,t,d){ return d?xform(rot(v,t),t,d-1):v; }",
  "const _gate=(t)=>hash(t)%97===_seed&&t.length>11;",
  "// patch 0x3d — DO NOT EDIT (auto-generated, reason unknown)",
  "const _drain=(m,u,f)=>f?_flush(m,u):_stash(m,u,0x7);",
  "function rot(v,t){ return (v<<3)^(t&0x1f)^_seed; }",
  "export const boot=()=>_gate(sign(ENV.u,SALT_7c))?h:noop;",
];
const Archaeologist: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  // Staged callouts spaced ~2s apart across the whole beat so a real content
  // event fires every <3s: title → "you wrote this" → curve starts bending →
  // "debt compounds" → "and it never stops".
  const labelAt = 44; // ~1.5s: title plate
  const subAt = 150; // ~5s: the "you supposedly wrote it" sub-line
  const curveAt = Math.round(dur * 0.34); // curve begins bending mid-beat
  const curveSpan = Math.round(dur * 0.58); // ...and keeps bending across the tail
  const compoundAt = Math.round(dur * 0.62); // "it compounds" caption
  const neverAt = Math.round(dur * 0.8); // "and it never stops" caption
  const lastAt = Math.round(dur * 0.93); // final tail caption
  // Type slowly enough that the last line lands ~75% into the beat, then the
  // block gently scrolls so the newest lines stay visible (continuous motion).
  const totalChars = ARCH_LINES.reduce((n, l) => n + l.length + 1, 0);
  const typeFrames = Math.round(dur * 0.72);
  const cps = Math.max(24, Math.round((totalChars / typeFrames) * 30));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* dense unreadable code types on slowly from the start */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "translateY(-30px) scale(0.9)",
        }}
      >
        <FakeTerminal
          lines={ARCH_LINES}
          startFrame={4}
          cps={cps}
          title="~/project/app.compiled.js"
        />
      </div>
      {/* title plate: "reading it like a dead language" */}
      <div
        style={{
          position: "absolute",
          top: 84,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(5,7,10,0.86)",
          border: `2px solid ${theme.stroke}`,
          borderRadius: 18,
          padding: "20px 48px",
          boxShadow: "0 12px 48px #000a",
          opacity: rise(frame, labelAt, 8),
          maxWidth: 1600,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 72,
            color: theme.warm,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.warm}33`,
          }}
        >
          code you can&rsquo;t read
        </span>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            color: theme.dim,
            marginTop: 8,
            opacity: rise(frame, subAt, 8),
          }}
        >
          you supposedly wrote it last spring
        </div>
      </div>
      <DebtCurve at={curveAt} spanFrames={curveSpan} />
      {/* two late captions keep the tail moving as the curve finishes bending */}
      <div
        style={{
          position: "absolute",
          left: 140,
          bottom: 150,
          opacity:
            rise(frame, compoundAt, 8) * (1 - rise(frame, neverAt - 6, 8)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 56,
            color: theme.warm,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.warm}44`,
          }}
        >
          every read costs more
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 140,
          bottom: 150,
          opacity: rise(frame, neverAt, 8) * (1 - rise(frame, lastAt - 6, 8)),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 56,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.down}44`,
          }}
        >
          and it never stops
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 140,
          bottom: 150,
          opacity: rise(frame, lastAt, 8),
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 56,
            color: theme.down,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${theme.down}44`,
          }}
        >
          you just keep paying
        </span>
      </div>
    </div>
  );
};

// --- per-beat scenes -----------------------------------------------------
const SCENES: Record<string, React.FC<SceneProps>> = {
  // FETCHED ASSET: Wiz writeup screenshot as establishing context; the founder's
  // "wrote none of it himself" admission is overlaid as an on-brand callout that
  // enters ~3 frames before `bragged` and holds — so the spoken point is visible
  // regardless of where the pan settles.
  hook_moltbook: ({ m, dur }) => {
    const a = A.hook_moltbook;
    const bragged = m("bragged", 464);
    return (
      <HookMoltbook
        src={a.file}
        imgW={a.w}
        imgH={a.h}
        dur={dur}
        bragged={bragged}
      />
    );
  },

  // CODE-SCENE: a 3-day breach timeline sliver + count-up numbers.
  hook_three_days: ({ m, dur }) => (
    <>
      <div
        style={{
          position: "absolute",
          top: 160,
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* The "threedays" mark sits at beat-start (local 0), so any entrance
            that starts AT local 0 is still climbing when the word hits (~150ms
            late, D8/FIX2). Start the entrance a few frames BEFORE local 0 (a
            negative `at`) so the title is already fully present ON the word —
            lands on/just before the mark rather than after it. */}
        <FastKw
          at={m("threedays", 8) === 8 ? -5 : m("threedays", 8) - 5}
          size={120}
          color={theme.down}
        >
          Three days.
        </FastKw>
      </div>
      <BreachTimeline at={m("threedays", 8) + 18} dur={dur} />
    </>
  ),

  // CODE-SCENE: one glowing UNCHECKED checkbox, held (the thumbnail idea).
  hook_the_box: ({ dur }) => <UncheckedBox at={8} dur={dur} />,

  // CODE-SCENE: "vibe coding" types on, cursor mashing accept-accept.
  setup_not_anti_ai: ({ dur }) => <VibeCoding dur={dur} />,

  // CODE-SCENE (quiet-diagram breather): two lines — adoption up, trust down —
  // drawing on, crossing near `drop`. LineReveal from the chart library.
  setup_trust_gap: ({ m }) => <TrustGap m={m} />,

  // CODE-SCENE: "LOOKS DONE" morphs into "IS DONE?", with staged ✓/doubt tags
  // on either side so the beat never parks on the bare word.
  setup_relatable: ({ dur }) => <Relatable dur={dur} />,

  // TEXT-BEAT: short bridge into the receipts run.
  receipts_open: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "A few of these." },
        { t: "Once you see the pattern…", c: theme.accent },
        { t: "you can't un-see it." },
      ]}
    />
  ),

  // FETCHED ASSET: The Register writeup, shown ZOOMED-OUT and readable so the
  // masthead + headline ("...faked data, told fibs galore") and the Replit body
  // are recognizable. Gentle scroll through the top of the article (the readable
  // Replit narrative); scroll range kept shallow so it lingers on the headline/
  // body and doesn't dwell on the mid-page ad banner. No zoom, no ring.
  receipts_replit: ({ m, dur }) => {
    const a = A.receipts_replit;
    const freeze = m("freeze", 481);
    return (
      <>
        <ScrollingCapture
          src={a.file}
          imgW={a.w}
          imgH={a.h}
          dur={dur}
          scrollFrom={0}
          scrollTo={0.22}
        />
        <SourceChip at={6} label="theregister.com" where="tr" />
        {/* accents punctuate the long (~47s) scroll so a keyword event fires
            every ~5-6s alongside the newly-scrolled article text (which is
            itself new content), rather than the shot reading as parked. */}
        <AccentChip
          at={60}
          out={freeze - 40}
          text="deleted the production database"
          color={theme.down}
        />
        {/* a highlight bar sweeps across the "froze all code changes" line as the
            narration hits the word "freeze" — a real content event lands ON the
            freeze mark instead of the article sitting static across it. */}
        <FreezeHighlight at={freeze} />
        <AccentChip
          at={freeze + 200}
          out={freeze + 380}
          text="then lied about it"
          color={theme.warm}
        />
        <AccentChip
          at={freeze + 420}
          out={freeze + 600}
          text="and hid the evidence"
          color={theme.down}
        />
        <AccentChip
          at={freeze + 640}
          out={freeze + 820}
          text="8 days of work · gone"
          color={theme.warm}
        />
        <AccentChip
          at={freeze + 860}
          text="the AI shipped it anyway"
          color={theme.down}
        />
      </>
    );
  },

  // CODE-SCENE: rapid dock/undock montage into a growing wall of leaks.
  receipts_montage: ({ m, dur }) => {
    const apps170 = m("apps170", 341);
    const scan = m("scan", 1168);
    // Restaged so a real content event fires every ~2-3s across the whole ~51s
    // beat (no chip parks). Timeline of events (rel frames), each ~60-90f apart:
    //   8     Lovable name enters big
    //   341   "170" COUNTS UP and lands ON apps170 (word "hundred")
    //   401   "18,000 people exposed" count-up sub lands (back-to-back line)
    //   491   Lovable docks + Base44 name enters
    //   581   Base44 "no password" value lands
    //   671   Base44 docks + Orchids name enters
    //   761   Orchids "zero-click" value lands
    //   851   Orchids docks; scan chip prep window opens
    //   1128  Escape.tech scan chip enters (scan - 40)
    //   1168  "5,600" scan count lands ON scan (word "five")
    // Spacing is a steady ~60-90f cadence; the middle chips each get their own
    // value-landing beat so they don't sit static between name-in and dock.
    const eighteenK = apps170 + 60; // "eighteen thousand people exposed"
    const lovableDock = eighteenK + 90; // ~3s after the 18k reveal lands
    const base = lovableDock; // Base44 name enters as Lovable docks
    const baseVal = base + 90; // Base44 value lands ~3s later
    const orchids = baseVal + 90; // Orchids name enters ~3s after that
    const orchidsVal = orchids + 90; // Orchids value lands ~3s later
    // The scan chip enters partway between Orchids and the scan mark so the tail
    // (~218-230s) keeps producing events instead of parking on the docked wall:
    //   ~941  Orchids docks / Escape.tech "5,600" begins counting up
    //   1168  "5,600 apps" lands ON scan (word "five")
    //   ~1230 closing "one sweep → holes/keys" summary line lands (staggered)
    const orchidsDock = orchidsVal + 90; // Orchids docks; scan chip enters here
    const scanIn = orchidsDock; // no gap — scan chip picks up as Orchids docks
    return (
      <LeakWall
        dur={dur}
        scanAt={scan}
        chips={[
          {
            name: "Lovable",
            value: "170 apps",
            at: 8,
            // Fills the ~10s dwell between the name entering ("There's Lovable")
            // and the number landing on apps170 so the chip never parks: a short
            // pre-caption appears mid-dwell, then the "170" TICKS UP slowly
            // (countFrom 160 ≈ 5s of motion) and lands exactly on apps170.
            pre: { at: 70, out: apps170 - 170, text: "public apps · scanned" },
            countAt: apps170,
            countValue: 170,
            countFrom: 160,
            countDisplay: (v) => `${Math.round(v)} apps`,
            dockAt: lovableDock,
            color: theme.down,
            sub: { at: eighteenK, value: 18000, label: "people exposed" },
          },
          {
            name: "Base44",
            value: "no password required",
            at: base,
            countAt: baseVal,
            dockAt: orchids,
            color: theme.warm,
          },
          {
            name: "Orchids",
            value: "zero-click takeover",
            at: orchids,
            countAt: orchidsVal,
            dockAt: orchidsDock,
            color: theme.down,
          },
          {
            name: "Escape.tech scan",
            value: "5,600 apps · one sweep",
            at: scanIn,
            // The scan chip enters ~10s before its number lands on `scan`; a
            // pre-caption fills the early dwell, then "5,600" TICKS UP slowly
            // (countFrom 220 ≈ 7s) and lands on the scan mark — never parks.
            pre: {
              at: scanIn + 60,
              out: scan - 230,
              text: "one automated sweep",
            },
            countAt: scan,
            countValue: 5600,
            countFrom: 220,
            countDisplay: (v) =>
              `${Math.round(v).toLocaleString("en-US")} apps · one sweep`,
            dockAt: scan + 200,
            color: theme.warm,
          },
        ]}
      />
    );
  },

  // CODE-SCENE: same app skeleton x3, red skipped-safeguards checklist stamps.
  receipts_pattern: ({ dur }) => <SkippedPattern dur={dur} />,

  // TEXT-BEAT: the pivot to the real point.
  core_setup: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "The security stuff isn't the scary part." },
        { t: "There's something underneath it.", c: theme.warm },
        { t: "Something you can't patch.", c: theme.down },
        { t: "This is the bit to remember.", c: theme.accent },
      ]}
    />
  ),

  // CODE-SCENE: human thread vs AI black box, then a slow fuse to 6 months.
  core_debt: ({ dur }) => <DebtSplit dur={dur} />,

  // CODE-SCENE (replaces the hieroglyph image, which didn't read): a dense
  // FakeTerminal of real-looking-but-incomprehensible AI-generated code with
  // neutral fake values — you are literally "reading your own app like a dead
  // language". A title plate calls it out, then the debt curve bends from
  // linear to exponential. Fast: the terminal types on, staged callouts land.
  core_archaeologist: ({ dur }) => <Archaeologist dur={dur} />,

  // CODE-SCENE: founder walks off, new hire inherits the black box.
  payoff_who_pays: ({ dur }) => <Inheritance dur={dur} />,

  // KEYWORD (loud register): WRITE dims, READ lifts with a punch.
  payoff_the_skill: ({ dur }) => <TheSkill dur={dur} />,

  // CLOSING FRAME: two lines land, an underline sweeps under the payoff line,
  // then the sources line arrives — staged so even the quiet close has an event
  // every ~2-3s instead of holding on the payoff for ~9s.
  close: ({ dur }) => <ClosingFrame dur={dur} />,
};

// Closing frame, staged. line1 → payoff line → underline sweep under it →
// sources line, each ~2-3s apart across the ~16s beat.
const ClosingFrame: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const line2At = Math.round(dur * 0.2);
  const underlineAt = Math.round(dur * 0.4);
  const sourcesAt = Math.round(dur * 0.66);
  // The underline sweeps slowly (over ~dur*0.35 ≈ 5s) so it is the continuous
  // motion carrying the quiet tail — no dead 4s gap before the drift-out.
  const underline = interpolate(
    frame,
    [underlineAt - 3, underlineAt + Math.round(dur * 0.42)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  return (
    <>
      <Center top={360}>
        <Kw at={10} size={64} color={theme.dim}>
          the model hands you the code.
        </Kw>
        <div
          style={{
            marginTop: 34,
            position: "relative",
            display: "inline-block",
          }}
        >
          <Kw at={line2At} size={104}>
            the understanding was the job.
          </Kw>
          {/* underline sweeps in under the payoff line as a distinct late event */}
          <div
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              bottom: -18,
              height: 6,
              background: theme.accent,
              borderRadius: 3,
              transform: `scaleX(${underline})`,
              transformOrigin: "left center",
              opacity: underline,
              boxShadow: `0 0 24px ${theme.accent}66`,
            }}
          />
        </div>
      </Center>
      <div
        style={{
          position: "absolute",
          bottom: 110,
          width: "100%",
          textAlign: "center",
          opacity: rise(frame, sourcesAt, 12),
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 30, color: theme.dim }}>
          sources in the description
          <Cursor />
        </span>
      </div>
    </>
  );
};

// A big keyword with a FAST entrance (mostly present within ~2-3 frames of
// `at`) — for words that land exactly on a beat boundary, where a spring would
// still be climbing when the word is spoken. Scale from 0.94, never 0.
const FastKw: React.FC<{
  at: number;
  size: number;
  color: string;
  children: React.ReactNode;
}> = ({ at, size, color, children }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: SANS,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: "-0.03em",
        color,
        opacity: p,
        transform: `scale(${0.94 + p * 0.06}) translateY(${(1 - p) * 14}px)`,
        textShadow: `0 0 40px ${color}44, 0 2px 4px #000a`,
        lineHeight: 1.04,
      }}
    >
      {children}
    </span>
  );
};

// A big keyword that fades/dims out at `out` (used to cross-dissolve WRITE→READ).
const FadeKw: React.FC<{
  at: number;
  out: number;
  size: number;
  color: string;
  children: React.ReactNode;
}> = ({ at, out, size, color, children }) => {
  const frame = useCurrentFrame();
  const enter = rise(frame, at, 12);
  const exit = interpolate(frame, [out - 10, out + 4], [1, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const o = Math.min(enter, exit);
  return (
    <span
      style={{
        fontFamily: SANS,
        fontWeight: 900,
        fontSize: size,
        color,
        letterSpacing: "-0.03em",
        opacity: o,
        textShadow: `0 0 40px ${color}33`,
      }}
    >
      {children}
    </span>
  );
};

const sectionFor = (id: string): string => {
  if (id.startsWith("hook")) return "The Breach";
  if (id.startsWith("setup")) return "Vibe Coding";
  if (id.startsWith("receipts")) return "The Receipts";
  if (id.startsWith("core")) return "The Real Debt";
  return "The Skill";
};

// Beat wrapper: quick eased cross-fade + slight rise on enter, fade on exit.
const BeatWrap: React.FC<{ dur: number; children: React.ReactNode }> = ({
  dur,
  children,
}) => {
  const frame = useCurrentFrame();
  // Snappy cross-fade in (2 frames) so a beat's first keyword lands ON its word
  // rather than being gated behind a longer wrapper fade (FIX2).
  const enter = interpolate(frame, [0, 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [dur - 7, dur - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const o = Math.min(enter, exit);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: o,
        transform: `translateY(${(1 - enter) * 16}px)`,
      }}
    >
      {children}
    </div>
  );
};

const Camera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.05]);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  );
};

// Sparse, tasteful sound design (absolute composition frames). A soft pop at
// every beat entrance (16), a whoosh where each ScrollingCapture camera-push
// begins (~18f after its beat start), and a thud on three big reveals: the
// three-day breach count, the leak-wall scan, and the READ payoff. bed=true adds
// a low room ambience under the whole video. ~21 events total — deliberately not
// one-per-reveal (that fatigues).
const sfxEvents = (beats: typeof timing.beats): SfxEvent[] => {
  const byId = (id: string) => beats.find((b) => b.id === id);
  const markFrame = (id: string, mark: string, fallback: number) => {
    const b = byId(id);
    const m = (b?.marks as Record<string, { frame: number }> | undefined)?.[
      mark
    ];
    return m ? m.frame : fallback;
  };
  const events: SfxEvent[] = [];

  // 1. section-entrance pop on every beat start (16).
  for (const b of beats) events.push({ frame: b.startFrame, sfx: "pop" });

  // 2. whoosh where the two ScrollingCapture pushes begin.
  const moltbook = byId("hook_moltbook");
  const replit = byId("receipts_replit");
  if (moltbook) events.push({ frame: moltbook.startFrame + 18, sfx: "whoosh" });
  if (replit) events.push({ frame: replit.startFrame + 18, sfx: "whoosh" });

  // 3. thud on three big reveals.
  events.push({
    frame: markFrame("hook_three_days", "threedays", 634),
    sfx: "thud",
  });
  events.push({
    frame: markFrame("receipts_montage", "scan", 7132),
    sfx: "thud",
  });
  const skill = byId("payoff_the_skill");
  if (skill) {
    // READ lands at ~round(dur*0.5) into the beat (TheSkill.readAt).
    const next = beats[beats.indexOf(skill) + 1];
    const dur = (next ? next.startFrame : E003_DURATION) - skill.startFrame;
    events.push({
      frame: skill.startFrame + Math.round(dur * 0.5),
      sfx: "thud",
    });
  }

  return events;
};

export const Episode003: React.FC = () => {
  const beats = timing.beats;
  return (
    <AbsoluteFill>
      <Audio src={staticFile("003-vibe-coding-hangover/narration.wav")} />
      <SfxLayer
        bed
        durationInFrames={E003_DURATION}
        events={sfxEvents(beats)}
      />
      <AmbientBackground />
      <Camera>
        {beats.map((b, i) => {
          const start = b.startFrame;
          const end =
            i + 1 < beats.length ? beats[i + 1].startFrame : E003_DURATION;
          const dur = Math.max(1, end - start);
          const Scene = SCENES[b.id];
          const marks = b.marks as Record<string, { frame: number }>;
          const m: MarkFn = (id, fallback = 8) =>
            marks[id] ? marks[id].frame - start : fallback;
          const broll = brollFor(b.id);
          return (
            <React.Fragment key={b.id}>
              {/* Background b-roll for the six talky beats: sits ABOVE the global
                  AmbientBackground but BEHIND this beat's scene content (rendered
                  first). BRoll's scrim keeps the foreground text readable. */}
              {broll ? (
                <BRoll
                  src={broll.file}
                  kind={broll.kind}
                  fromFrame={start}
                  durationInFrames={dur}
                  // The close beat's sunrise clip peaks bright right where the
                  // white payoff text sits — darken its scrim so the text keeps
                  // contrast (FIX3). Other beats stay at the standard 0.6.
                  dim={b.id === "close" ? 0.72 : 0.6}
                />
              ) : null}
              <Sequence from={start} durationInFrames={dur} name={b.id}>
                <BeatWrap dur={dur}>
                  {Scene ? <Scene m={m} dur={dur} /> : null}
                </BeatWrap>
              </Sequence>
            </React.Fragment>
          );
        })}
      </Camera>
      {/* broadcast chrome — rendered once; section tracks the absolute frame */}
      <BroadcastFrame
        sections={beats.map((b) => ({
          from: b.startFrame,
          label: sectionFor(b.id),
        }))}
      />
    </AbsoluteFill>
  );
};
