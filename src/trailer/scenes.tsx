import React from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Db, Distributed, Network } from "../components/TopicIcons";
import { theme } from "../components/theme";
import { MONO, SANS } from "./fonts";
import { Chip, Cursor, Kw, popAt, popStyle, usePop } from "./Kinetic";
import { BEATS, K } from "./schedule";

// All schedule frames are absolute; scenes run inside a Sequence, so every
// scene converts via its beat's base frame. lf = local frame of an event.
const lf = (abs: number, base: number) => abs - base;

const drift = (frame: number, seed: number, px = 6) =>
  `translateY(${Math.sin(frame / 50 + seed * 2.1) * px}px)`;

// ---------------------------------------------------------------- hook ---
// A generic "explainer card" gets contradicted, then the camera plunges one
// layer down to a glowing node tree — the channel's whole thesis in motion.
export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const B = BEATS.hook;

  // Card is on screen from frame 0 — no cold open.
  const cardIn = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 20,
  });
  const plunge = interpolate(
    frame,
    [lf(K.planner, B), lf(K.planner, B) + 45],
    [0, 620],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const deepIn = usePop(lf(K.planner, B) + 20);

  const skeleton = (w: number, i: number) => (
    <div
      key={i}
      style={{
        height: 16,
        width: w,
        borderRadius: 8,
        background: "#3d444d",
        margin: "14px 0",
      }}
    />
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translateY(${-plunge}px)`,
      }}
    >
      {/* keywords, top */}
      <div style={{ position: "absolute", top: 110, left: 120, right: 120 }}>
        <Kw at={lf(K.explanations, B)} size={92}>
          Most explanations
        </Kw>
        <Kw at={lf(K.stop, B)} size={92} color={theme.dim}>
          stop one layer up.
        </Kw>
      </div>

      {/* the usual explainer card */}
      <div
        style={{
          position: "absolute",
          top: 420,
          left: "50%",
          width: 760,
          padding: "36px 48px",
          borderRadius: 20,
          background: theme.panel,
          border: `2px solid ${theme.stroke}`,
          boxShadow: "0 1px 2px #0006, 0 12px 36px #0007",
          transform: `translateX(-50%) ${drift(frame, 1, 4)}`,
          opacity: cardIn,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 40, color: theme.dim }}>
          how-indexes-work.md
        </div>
        {[520, 640, 460].map(skeleton)}
        <div style={{ display: "flex", gap: 20, marginTop: 26 }}>
          <Chip at={lf(K.faster, B)} color={theme.up} size={44}>
            index → faster ✓
          </Chip>
          <Chip at={lf(K.slower, B)} color={theme.down} size={44}>
            sometimes slower ✗
          </Chip>
        </div>
      </div>

      {/* one layer down: glowing node tree, revealed by the plunge */}
      <div
        style={{
          position: "absolute",
          top: 1150,
          left: "50%",
          marginLeft: -450,
        }}
      >
        <div style={popStyle(deepIn)}>
          <svg width={900} height={420} viewBox="0 0 900 420" fill="none">
            {[
              [450, 60, 250, 190],
              [450, 60, 650, 190],
              [250, 190, 140, 330],
              [250, 190, 360, 330],
              [650, 190, 540, 330],
              [650, 190, 760, 330],
            ].map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={theme.accent}
                strokeWidth={3}
                opacity={0.6}
              />
            ))}
            {[
              [450, 60],
              [250, 190],
              [650, 190],
              [140, 330],
              [360, 330],
              [540, 330],
              [760, 330],
            ].map(([cx, cy], i) => {
              const p = spring({
                frame,
                fps,
                delay: lf(K.planner, B) + 22 + i * 3,
                config: { damping: 20, stiffness: 100 },
                durationInFrames: 18,
              });
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={26 * (0.6 + 0.4 * p)}
                  fill="#132339"
                  stroke={theme.accent}
                  strokeWidth={4}
                  opacity={p}
                />
              );
            })}
          </svg>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 42,
              color: theme.accent,
              textAlign: "center",
              textShadow: `0 0 30px ${theme.accent}66`,
            }}
          >
            the interesting part
            <Cursor />
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- what ---
export const TopicsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const B = BEATS.what;

  // Headline lands, holds ~1s, then shrinks into a header while the three
  // topic cards take the stage — keywords become labels, not exits.
  // Headline holds ~0.3s, then clears the stage just as the first card lands.
  const shrink = interpolate(
    frame,
    [lf(K.layerDown, B) + 8, lf(K.layerDown, B) + 20],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  const cards: Array<[React.FC, string, number]> = [
    [Db, "databases", lf(K.databases, B)],
    [Distributed, "distributed systems", lf(K.distributed, B)],
    [Network, "networking", lf(K.networking, B)],
  ];

  // Guide line drawing downward from frame 0 — covers "this channel goes"
  // so the beat never opens on bare background.
  const guide = interpolate(frame, [0, lf(K.layerDown, B)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          width: 4,
          marginLeft: -2,
          height: 330 * guide,
          background: `linear-gradient(180deg, transparent, ${theme.accent})`,
          opacity: 1 - shrink,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: interpolate(shrink, [0, 1], [400, 130]),
          width: "100%",
          textAlign: "center",
          transform: `scale(${1 - shrink * 0.45})`,
        }}
      >
        <Kw at={lf(K.layerDown, B) - 6} size={150} color={theme.accent}>
          ONE LAYER DOWN
        </Kw>
      </div>

      <div
        style={{
          position: "absolute",
          top: 430,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: 90,
          opacity: interpolate(
            frame,
            [lf(K.databases, B) - 10, lf(K.databases, B)],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        {cards.map(([Icon, label, at], i) => {
          const p = popAt(frame, fps, at);
          return (
            <div
              key={label}
              style={{
                width: 420,
                padding: "44px 0 30px",
                borderRadius: 24,
                background: theme.panel,
                border: `2px solid ${theme.stroke}`,
                boxShadow: "0 1px 2px #0006, 0 12px 36px #0007",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
                ...popStyle(p),
                transform: `${popStyle(p).transform} ${drift(frame, i, 5)}`,
              }}
            >
              <Icon />
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 44,
                  fontWeight: 700,
                  color: theme.ink,
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------ industry ---
export const IndustryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const B = BEATS.industry;
  const W = 1160;
  const H = 600;
  const LEN = 1400;

  // Chart constructs itself across the pre-narration window (beat opens on
  // a breath) — axes then gridlines, so nothing sits frozen before the data.
  const axes = interpolate(frame, [0, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const grid = (i: number) =>
    interpolate(frame, [30 + i * 14, 58 + i * 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  const line = (start: number) =>
    interpolate(frame, [start, start + 55], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
  const up = line(lf(K.hiring, B));
  const down = line(lf(K.layoffs, B));
  const headlineIn = usePop(lf(K.headlines, B) + 6); // trails the keyword — one focus at a time
  const stamp = spring({
    frame,
    fps: 30,
    delay: lf(K.contested, B),
    config: { damping: 14, stiffness: 160 },
    durationInFrames: 16,
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          top: 90,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Kw at={lf(K.industry, B)} size={84}>
          what’s actually happening
        </Kw>
      </div>

      {/* torn headline card slides behind the chart */}
      <div
        style={{
          position: "absolute",
          top: 330,
          right: 140,
          width: 460,
          padding: "30px 36px",
          borderRadius: 16,
          background: "#1c2128",
          border: `2px solid ${theme.stroke}`,
          transform: `rotate(5deg) ${drift(frame, 3, 5)}`,
          ...popStyle(headlineIn),
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 40,
            color: theme.dim,
          }}
        >
          “IT’S OVER”
        </div>
        {[330, 260].map((w, i) => (
          <div
            key={i}
            style={{
              height: 14,
              width: w,
              borderRadius: 7,
              background: "#3d444d",
              margin: "12px 0",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            top: -26,
            right: 24,
            fontFamily: MONO,
            fontSize: 38,
            fontWeight: 700,
            color: theme.warm,
            border: `3px solid ${theme.warm}`,
            borderRadius: 8,
            padding: "4px 14px",
            background: theme.panel,
            transform: `rotate(-7deg) scale(${0.5 + 0.5 * stamp})`,
            opacity: stamp,
            boxShadow: `0 0 30px ${theme.warm}44`,
          }}
        >
          [contested]
        </div>
      </div>

      <div style={{ position: "absolute", top: 270, left: 120 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
          <path
            d={`M70 ${H - 70}H${W - 60}`}
            stroke={theme.stroke}
            strokeWidth="3"
            strokeDasharray={W}
            strokeDashoffset={W * (1 - axes)}
          />
          <path
            d={`M70 ${H - 70}V50`}
            stroke={theme.stroke}
            strokeWidth="3"
            strokeDasharray={H}
            strokeDashoffset={H * (1 - axes)}
          />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M70 ${H - 70 - (i + 1) * 120}H${W - 60}`}
              stroke={theme.stroke}
              strokeWidth="1.5"
              opacity={0.5}
              strokeDasharray={W}
              strokeDashoffset={W * (1 - grid(i))}
            />
          ))}
          <path
            d={`M70 ${H / 2} C ${W * 0.4} ${H / 2 - 20}, ${W * 0.6} ${H * 0.3}, ${W - 100} ${H * 0.14}`}
            stroke={theme.up}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={LEN}
            strokeDashoffset={LEN * (1 - up)}
          />
          <path
            d={`M70 ${H / 2} C ${W * 0.4} ${H / 2 + 30}, ${W * 0.55} ${H * 0.72}, ${W - 100} ${H * 0.86}`}
            stroke={theme.down}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={LEN}
            strokeDashoffset={LEN * (1 - down)}
          />
          {up >= 1 && (
            <circle cx={W - 100} cy={H * 0.14} r="11" fill={theme.up} />
          )}
          {down >= 1 && (
            <circle cx={W - 100} cy={H * 0.86} r="11" fill={theme.down} />
          )}
        </svg>
        <div
          style={{
            position: "absolute",
            top: -8,
            left: 90,
            display: "flex",
            gap: 18,
          }}
        >
          <Chip at={lf(K.hiring, B)} color={theme.up}>
            hiring ↑
          </Chip>
          <Chip at={lf(K.layoffs, B)} color={theme.down}>
            layoffs ↓
          </Chip>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 160,
          display: "flex",
          gap: 24,
          alignItems: "baseline",
        }}
      >
        <Kw at={lf(K.data, B)} size={72} color={theme.accent}>
          the data
        </Kw>
        <Kw at={lf(K.headlines, B)} size={72} color={theme.dim}>
          vs the headlines
        </Kw>
      </div>
    </div>
  );
};

// -------------------------------------------------------------- career ---
export const CareerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const B = BEATS.career;

  const arrive = usePop(lf(K.precise, B) - 9);
  const narrow = interpolate(
    frame,
    [lf(K.precise, B), lf(K.precise, B) + 30],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const half = interpolate(narrow, [0, 1], [230, 60]);

  const wall: React.CSSProperties = {
    position: "absolute",
    top: 330,
    height: 470,
    width: 560,
    background: "#161B22", // opaque: queue dots must vanish behind, not ghost through
    border: `2px solid ${theme.stroke}`,
    borderRadius: 16,
    boxShadow: "0 1px 2px #0006, 0 12px 36px #0007",
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 160,
          display: "flex",
          gap: 26,
          alignItems: "baseline",
        }}
      >
        <Kw at={lf(K.gettingIn, B)} size={88}>
          getting in
        </Kw>
        <Kw at={lf(K.harder, B)} size={88} color={theme.warm}>
          is harder.
        </Kw>
      </div>

      <div style={{ ...popStyle(arrive), position: "absolute", inset: 0 }}>
        {/* candidates queuing toward the gap — rendered under the walls so
            they disappear "inside" and re-emerge lit in the gap */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const speed = 3.1 + (i % 3) * 0.8;
          const x = ((frame * speed + i * 260) % 1450) - 240;
          const lane = 530 + (i % 4) * 14 - 21;
          const gapEdge = 960 - half + 10;
          const through = x > gapEdge - 30;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: lane,
                left: x,
                width: 14,
                height: 14,
                borderRadius: 7,
                background: through ? theme.accent : theme.dim,
                opacity: x < 60 || x > 1860 ? 0 : through ? 0.95 : 0.5,
                boxShadow: through ? `0 0 14px ${theme.accent}` : "none",
              }}
            />
          );
        })}
        <div style={{ ...wall, right: `calc(50% + ${half}px)` }} />
        <div style={{ ...wall, left: `calc(50% + ${half}px)` }} />
        <div
          style={{
            position: "absolute",
            top: 330,
            height: 470,
            left: "50%",
            transform: "translateX(-50%)",
            width: half * 2,
            background: `linear-gradient(180deg, ${theme.accent}33, ${theme.accent}11)`,
            boxShadow: `0 0 60px ${theme.accent}33`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 840,
            width: "100%",
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 48,
            fontWeight: 700,
            color: theme.accent,
          }}
        >
          narrower — not closed.
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------- promise ---
export const SourcesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const B = BEATS.promise;

  const cards = [0, 1, 2];
  const stamp = usePop(lf(K.unsettled, B));

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          top: 130,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Kw at={lf(K.publicSources, B)} size={110}>
          public sources.
        </Kw>
      </div>

      <div
        style={{
          position: "absolute",
          top: 400,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        {cards.map((i) => {
          const p = popAt(frame, fps, 2 + i * 10); // stack starts at beat start — no dead intro
          return (
            <div
              key={i}
              style={{
                width: 900,
                padding: "26px 36px",
                borderRadius: 14,
                background: theme.panel,
                border: `2px solid ${theme.stroke}`,
                display: "flex",
                alignItems: "center",
                gap: 26,
                boxShadow: "0 1px 2px #0006, 0 8px 24px #0005",
                ...popStyle(p),
                transform: `${popStyle(p).transform} ${drift(frame, i, 3)}`,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 42,
                  fontWeight: 700,
                  color: theme.accent,
                }}
              >
                [{i + 1}]
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 15,
                    width: 480 - i * 60,
                    borderRadius: 7,
                    background: "#3d444d",
                  }}
                />
                <div
                  style={{
                    height: 15,
                    width: 320,
                    borderRadius: 7,
                    background: "#2c333b",
                    marginTop: 12,
                  }}
                />
              </div>
              <div style={{ fontFamily: MONO, fontSize: 42, color: theme.dim }}>
                ↗
              </div>
              {i === 1 && (
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 36,
                    fontWeight: 700,
                    color: theme.warm,
                    border: `3px solid ${theme.warm}`,
                    borderRadius: 8,
                    padding: "4px 14px",
                    transform: `rotate(-5deg)`,
                    ...popStyle(stamp),
                  }}
                >
                  [unsettled]
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 130,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <Chip
          at={lf(K.description, B)}
          color={theme.dim}
          size={42}
          border={false}
        >
          linked in the description ↓
        </Chip>
        <Chip at={lf(K.sayso, B)} color={theme.accent} size={42}>
          flagged, never fudged
        </Chip>
      </div>
    </div>
  );
};

// --------------------------------------------------------------- close ---
export const CloseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const B = BEATS.close;
  const icons = [Db, Distributed, Network, Db, Network, Distributed];

  const pulseTile = Math.floor(frame / 24) % 6;
  const highlight = usePop(lf(K.anywhere, B));

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          top: 150,
          left: "50%",
          transform: "translateX(-50%)",
          display: "grid",
          gridTemplateColumns: "repeat(3, 380px)",
          gap: 30,
        }}
      >
        {icons.map((Icon, i) => {
          const p = popAt(frame, fps, lf(K.video, B) + i * 4);
          const lit = highlight > 0 && i === pulseTile;
          return (
            <div
              key={i}
              style={{
                height: 240,
                borderRadius: 18,
                background: theme.panel,
                border: `2px solid ${lit ? theme.accent : theme.stroke}`,
                boxShadow: lit
                  ? `0 0 40px ${theme.accent}44`
                  : "0 8px 24px #0005",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(0.62) ${drift(frame, i, 4)}`,
                ...{ opacity: p },
              }}
            >
              <Icon />
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 190,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Kw at={lf(K.weeks, B)} size={84} style={{ display: "inline-block" }}>
          every two weeks.
        </Kw>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 90,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Kw
          at={lf(K.anywhere, B)}
          size={64}
          color={theme.accent}
          style={{ display: "inline-block" }}
        >
          start anywhere
          <Cursor />
        </Kw>
      </div>
    </div>
  );
};
