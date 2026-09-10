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
import timing from "../../episodes/002-two-job-markets/timing.json";
import { AmbientBackground } from "../components/AmbientBackground";
import { theme } from "../components/theme";
import { MONO, SANS } from "../trailer/fonts";
import { Cursor, Kw } from "../trailer/Kinetic";
import { BroadcastFrame } from "./BroadcastFrame";
import { PopIn, SideNote, Sweep, usePop } from "./motion";
import { Bars, Diverging, Ladder, LineChart, Stat } from "./viz";

export const E002_DURATION = Math.ceil((timing.audioMs / 1000) * timing.fps);

type MarkFn = (id: string, fallback?: number) => number;
type SceneProps = { m: MarkFn; dur: number };

// spread N reveals evenly across a beat so something pops every ~2-3s and
// the last one isn't stranded at the very end (3-second rule).
const spread = (dur: number, i: number, n: number) =>
  Math.round(dur * (0.15 + (0.66 * i) / Math.max(1, n - 1)));

const Center: React.FC<{ children: React.ReactNode; top?: number }> = ({
  children,
  top = 380,
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

// Short argument beat (<~8s): phrase pops, underline sweeps, answer pops.
const Words: React.FC<{
  a: string;
  b?: string;
  at?: number;
  colorB?: string;
  size?: number;
  sweep?: boolean;
}> = ({ a, b, at = 6, colorB = theme.dim, size = 96, sweep = true }) => (
  <Center>
    <Kw at={at} size={size}>
      {a}
    </Kw>
    {sweep && (
      <Sweep at={at + 10} width={Math.min(520, a.length * size * 0.34)} />
    )}
    {b && (
      <div style={{ marginTop: 22 }}>
        <Kw at={at + 16} size={size} color={colorB}>
          {b}
        </Kw>
      </div>
    )}
  </Center>
);

// Long text beat: stages 3–5 lines across the beat (tracks the narration's
// sub-points) so something reveals every ~3s; earlier lines dim as new ones
// land, keeping continuous motion instead of one parked phrase.
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
        top: 280,
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
              transition: "none",
            }}
          >
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: ln.s ?? 78,
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

const QuoteCard: React.FC<{ quote: string; who: string }> = ({
  quote,
  who,
}) => {
  const p = usePop(8);
  return (
    <div
      style={{
        position: "absolute",
        top: 320,
        left: "50%",
        transform: `translateX(-50%) scale(${0.92 + p * 0.08})`,
        opacity: p,
        width: 1250,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 62,
          color: theme.ink,
          lineHeight: 1.3,
        }}
      >
        “{quote}”
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 34,
          color: theme.accent,
          marginTop: 34,
        }}
      >
        — {who}
      </div>
    </div>
  );
};

const TwoPanel: React.FC<{ at: number; left: string; right: string }> = ({
  at,
  left,
  right,
}) => (
  <div
    style={{
      position: "absolute",
      top: 340,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      gap: 60,
    }}
  >
    {[
      ["first job", theme.accent, left, "left" as const],
      ["third job", theme.warm, right, "right" as const],
    ].map(([, col, txt, dir], i) => (
      <PopIn
        key={i}
        at={at + i * 12}
        from={dir as "left" | "right"}
        style={{
          width: 620,
          height: 400,
          borderRadius: 24,
          background: theme.panel,
          border: `2px solid ${theme.stroke}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 66,
            color: col as string,
            textAlign: "center",
          }}
        >
          {txt as string}
        </div>
      </PopIn>
    ))}
  </div>
);

const Weighted: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const total = 1400;
  return (
    <div
      style={{
        position: "absolute",
        top: 420,
        left: "50%",
        transform: "translateX(-50%)",
        width: total,
      }}
    >
      <div
        style={{
          display: "flex",
          height: 120,
          borderRadius: 16,
          overflow: "hidden",
          border: `2px solid ${theme.stroke}`,
        }}
      >
        <div
          style={{
            width: total * 0.72 * p,
            background: `linear-gradient(180deg, ${theme.dim}, #6b7480)`,
          }}
        />
        <div
          style={{
            width: total * 0.28 * p,
            background: `linear-gradient(180deg, ${theme.warm}, #b98a24)`,
          }}
        />
      </div>
      {/* labels BELOW the bar, light text, never clipped */}
      <div style={{ display: "flex", marginTop: 18 }}>
        <div style={{ width: total * 0.72, textAlign: "center", opacity: p }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 32,
              color: theme.ink,
              fontWeight: 700,
            }}
          >
            rates-driven correction · 72%
          </span>
        </div>
        <div style={{ width: total * 0.28, textAlign: "center", opacity: p }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 32,
              color: theme.warm,
              fontWeight: 700,
            }}
          >
            AI · 28%
          </span>
        </div>
      </div>
      <PopIn at={at + 26} style={{ marginTop: 30, textAlign: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 34, color: theme.dim }}>
          mostly predates AI — AI shapes what's left
        </span>
      </PopIn>
    </div>
  );
};

// Bars build one-by-one across most of the beat (keeps motion going), and
// the "senior shortage" tall bars pop a tag as they arrive.
const PipelineGap: React.FC<{ at: number; dur: number }> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const years = ["'26", "'27", "'28", "'29", "'30", "'31"];
  const step = Math.max(14, Math.round((dur * 0.55) / years.length));
  return (
    <div
      style={{
        position: "absolute",
        top: 360,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 40,
        alignItems: "flex-end",
      }}
    >
      {years.map((y, i) => {
        const bAt = at + i * step;
        const p = interpolate(frame, [bAt, bAt + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const gap = i < 4;
        const h = (gap ? 40 : 300) * p;
        const c = gap ? theme.down : theme.up;
        return (
          <div
            key={y}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            {!gap && (
              <PopIn at={bAt + 8} style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontWeight: 700,
                    fontSize: 30,
                    color: theme.up,
                  }}
                >
                  scarce
                </span>
              </PopIn>
            )}
            <div
              style={{
                width: 120,
                height: h,
                background: `linear-gradient(180deg, ${c}, ${c}55)`,
                borderRadius: "8px 8px 0 0",
                boxShadow: gap ? "none" : `0 0 24px ${theme.up}44`,
              }}
            />
            <div style={{ fontFamily: MONO, fontSize: 30, color: theme.dim }}>
              {y}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- per-beat scenes -----------------------------------------------------
const SCENES: Record<string, React.FC<SceneProps>> = {
  hook: ({ m, dur }) => (
    <>
      <Diverging
        atUp={m("up", 300)}
        atDown={m("down", 480)}
        upVal="+7%"
        downVal="−76%"
        upLabel="startup engineers"
        downLabel="entry-level hires"
      />
      <SideNote
        at={spread(dur, 0, 2)}
        side="r"
        top={470}
        label="same report · same year"
        color={theme.accent}
      />
      <SideNote
        at={spread(dur, 1, 2)}
        side="l"
        top={560}
        label="SignalFire · 80M+ companies"
        color={theme.dim}
      />
    </>
  ),
  stakes_argument: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "Both numbers are real." },
        { t: "One says the field is fine.", c: theme.up },
        { t: "One says it's over.", c: theme.down },
        { t: "They just measure different things." },
      ]}
    />
  ),
  stakes_why_care: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "Which market is yours?", c: theme.accent },
        { t: "Shrinking field → get out." },
        { t: "Narrow door → find another door." },
        { t: "Not the same plan." },
      ]}
    />
  ),
  stakes_roadmap: ({ dur }) => {
    const srcs = [
      ["SignalFire", "hiring data"],
      ["BLS", "gov projections"],
      ["Indeed", "job postings"],
      ["NY Fed", "grad unemployment"],
    ];
    return (
      <div
        style={{
          position: "absolute",
          top: 380,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: 36,
        }}
      >
        {srcs.map(([s, sub], i) => (
          <PopIn
            key={s}
            at={spread(dur, i, 4)}
            style={{
              width: 320,
              padding: "30px 0",
              borderRadius: 16,
              background: theme.panel,
              border: `2px solid ${theme.accent}55`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: 40,
                color: theme.accent,
              }}
            >
              {s}
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 26,
                color: theme.dim,
                marginTop: 10,
              }}
            >
              {sub}
            </div>
          </PopIn>
        ))}
      </div>
    );
  },
  s1_open: () => (
    <Words
      a="Start with the case that"
      b="everything's fine."
      colorB={theme.up}
    />
  ),
  s1_signalfire: ({ m, dur }) => (
    <>
      <Stat
        at={m("down25", 400)}
        value={-25}
        label="total big-tech hiring vs 2019"
        y={280}
      />
      <SideNote
        at={spread(dur, 0, 3)}
        side="r"
        top={300}
        label="every big tech employer"
        color={theme.down}
      />
      <SideNote
        at={spread(dur, 1, 3)}
        side="r"
        top={430}
        label="trailing 12 months"
        color={theme.dim}
      />
      <SideNote
        at={spread(dur, 2, 3)}
        side="l"
        top={520}
        label="“that's bad.”"
        color={theme.dim}
      />
    </>
  ),
  s1_but_eng: ({ m, dur }) => (
    <>
      <Bars
        at={m("share46", 200)}
        items={[
          { label: "2019", value: 46, color: theme.dim, display: "46%" },
          { label: "2025", value: 55, color: theme.up, display: "55%" },
        ]}
        y={230}
      />
      <SideNote
        at={spread(dur, 0, 3)}
        side="r"
        top={280}
        label="engineering only −11%"
        value="↓"
        color={theme.warm}
      />
      <SideNote
        at={spread(dur, 1, 3)}
        side="r"
        top={410}
        label="share of ALL new hires"
        color={theme.accent}
      />
      <SideNote
        at={spread(dur, 2, 3)}
        side="r"
        top={540}
        label="pie shrank — its slice grew"
        color={theme.up}
      />
    </>
  ),
  s1_startups: ({ m, dur }) => (
    <>
      <Stat
        at={m("up7", 90)}
        value={7}
        label="startup engineering hiring vs 2019"
        color={theme.up}
        y={280}
      />
      <SideNote
        at={spread(dur, 0, 2)}
        side="r"
        top={320}
        label="not down — UP"
        color={theme.up}
      />
      <SideNote
        at={spread(dur, 1, 2)}
        side="l"
        top={460}
        label="through the “collapse”"
        color={theme.dim}
      />
    </>
  ),
  s1_bls: ({ m, dur }) => (
    <>
      <Bars
        at={m("bls15", 300)}
        items={[
          { label: "software devs", value: 15 },
          { label: "all jobs", value: 3, color: theme.dim },
        ]}
        y={230}
      />
      <SideNote
        at={spread(dur, 0, 3)}
        side="r"
        top={280}
        label="2024 – 2034 projection"
        color={theme.accent}
      />
      <SideNote
        at={spread(dur, 1, 3)}
        side="r"
        top={410}
        label="“much faster than average”"
        color={theme.up}
      />
      <SideNote
        at={spread(dur, 2, 3)}
        side="r"
        top={540}
        label="≈129,200 openings / year"
        value="+"
        color={theme.accent}
      />
    </>
  ),
  s1_programmers_setup: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "One more number." },
        { t: "Same release." },
        { t: "The most useful number in this video.", c: theme.accent },
      ]}
    />
  ),
  s1_programmers: ({ m, dur }) => (
    <>
      <div
        style={{
          position: "absolute",
          top: 150,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Kw at={6} size={60} color={theme.dim}>
          “computer programmers”
        </Kw>
      </div>
      <Stat
        at={m("minus6", 200)}
        value={-6}
        label="projected 2024–2034"
        color={theme.down}
        y={340}
      />
      <SideNote
        at={spread(dur, 0, 2)}
        side="r"
        top={360}
        label="the codified job"
        color={theme.down}
      />
      <SideNote
        at={spread(dur, 1, 2)}
        side="r"
        top={490}
        label="same agency · same day"
        color={theme.dim}
      />
    </>
  ),
  s1_punchline: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "+15 and −6.", s: 120 },
        { t: "One forecast.", c: theme.warm },
        { t: "The market sorts by how much judgment a job needs.", s: 56 },
        { t: "The codified parts go.", c: theme.down },
      ]}
    />
  ),
  s1_rehook: () => (
    <Words a="But that's not the number" b="everyone's looking at." />
  ),
  s2_second_number: ({ m, dur }) => (
    <>
      <Bars
        at={m("down65", 300)}
        items={[
          { label: "major tech cos", value: -65 },
          { label: "early-stage startups", value: -76 },
        ]}
        y={230}
      />
      <SideNote
        at={spread(dur, 0, 2)}
        side="r"
        top={300}
        label="under 1 year experience"
        color={theme.down}
      />
      <SideNote
        at={spread(dur, 1, 2)}
        side="r"
        top={430}
        label="same report as the growth"
        color={theme.dim}
      />
    </>
  ),
  s2_hold_it: ({ m, dur }) => (
    <>
      <Diverging
        atUp={m("both", 60)}
        atDown={m("both", 60) + 14}
        upVal="MORE"
        downVal="¾ FEWER"
        upLabel="engineers overall"
        downLabel="beginners"
      />
      <SideNote
        at={spread(dur, 0, 1)}
        side="r"
        top={300}
        label="the same startups"
        color={theme.accent}
      />
    </>
  ),
  s2_what_it_means: () => (
    <Center top={330}>
      <Kw at={6} size={92}>
        They didn't stop hiring.
      </Kw>
      <Sweep at={20} width={620} color={theme.warm} />
      <div style={{ marginTop: 26 }}>
        <Kw at={30} size={92} color={theme.warm}>
          They stopped hiring people who need teaching.
        </Kw>
      </div>
    </Center>
  ),
  s2_nyfed: ({ m, dur }) => (
    <>
      <Bars
        at={m("csrate", 200)}
        suffix="%"
        y={220}
        maxAbs={7}
        items={[
          { label: "CS grads", value: 6.1, color: theme.down, display: "6.1%" },
          {
            label: "recent grads (all)",
            value: 5.6,
            color: theme.dim,
            display: "5.6%",
          },
          {
            label: "all college grads",
            value: 3.0,
            color: theme.dim,
            display: "~3%",
          },
        ]}
      />
      <SideNote
        at={spread(dur, 0, 2)}
        side="r"
        top={250}
        label="the viral chart"
        color={theme.accent}
      />
      <SideNote
        at={spread(dur, 1, 2)}
        side="r"
        top={380}
        label="2023 data · Feb 2025 release"
        color={theme.dim}
      />
    </>
  ),
  s2_inversion: ({ dur }) => (
    <>
      <Center top={280}>
        <Kw at={8} size={130} color={theme.down}>
          higher, not lower
        </Kw>
        <Sweep at={22} width={640} color={theme.down} />
        <div style={{ marginTop: 26 }}>
          <Kw at={30} size={54} color={theme.dim}>
            than the average college graduate
          </Kw>
        </div>
      </Center>
      <SideNote
        at={spread(dur, 0, 1)}
        side="r"
        top={520}
        label="in a field projected to grow 15%"
        color={theme.up}
      />
    </>
  ),
  s2_resolve: () => (
    <Words a="Demand is real." b="All of it sits above the entry level." />
  ),
  s3_question: () => (
    <Words a="So — did AI" b="do this?" colorB={theme.accent} size={130} />
  ),
  s3_honesty: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "This part is genuinely contested.", c: theme.warm },
        { t: "The people disagreeing aren't idiots." },
        { t: "Same years — different reading." },
      ]}
    />
  ),
  s3_case_for: ({ m, dur }) => (
    <>
      <Ladder atBuild={10} atRemoved={m("removed", 90)} />
      <SideNote
        at={spread(dur, 0, 2)}
        side="r"
        top={300}
        label="bounded · specified · low-context"
        color={theme.accent}
      />
      <SideNote
        at={m("removed", 90)}
        side="r"
        top={470}
        label="remove the rung, remove the junior job"
        color={theme.down}
      />
    </>
  ),
  s3_layoff_cites: ({ dur }) => (
    <>
      <Stat
        at={10}
        value={54}
        label="of 2026 layoffs cite AI / automation"
        color={theme.warm}
        signed={false}
        y={280}
      />
      <SideNote
        at={spread(dur, 0, 2)}
        side="r"
        top={320}
        label="self-reported"
        color={theme.dim}
      />
      <SideNote
        at={spread(dur, 1, 2)}
        side="l"
        top={460}
        label="not a neutral source"
        color={theme.dim}
      />
    </>
  ),
  s3_but_timing: () => (
    <Words a="But the timing" b="refuses to cooperate." colorB={theme.down} />
  ),
  s3_indeed: ({ m }) => (
    <>
      <LineChart
        baselineY={0.85}
        baselineLabel="Feb 2020 = baseline"
        shade={{ x0: 0.28, x1: 0.72, at: m("window", 260) }}
        series={[
          {
            at: m("pct275", 200),
            color: theme.accent,
            pts: [
              [0, 0.85],
              [0.28, 0.8],
              [0.5, 0.45],
              [0.72, 0.3],
              [1, 0.32],
            ],
          },
        ]}
      />
      <SideNote
        at={40}
        side="l"
        top={520}
        label="software postings"
        value="−27.5%"
        color={theme.accent}
      />
      <SideNote
        at={m("window", 260)}
        side="r"
        top={520}
        label="the drop was 2022–2024 — before AI tools"
        color={theme.warm}
      />
    </>
  ),
  s3_before_chatgpt: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "The decline started before ChatGPT shipped." },
        { t: "Indeed's own researchers say so.", c: theme.accent },
        { t: "Hard for the AI story to swallow.", c: theme.warm },
      ]}
    />
  ),
  s3_alternative: ({ m, dur }) => (
    <>
      <LineChart
        series={[
          {
            at: m("rates", 220),
            color: theme.warm,
            pts: [
              [0, 0.15],
              [0.4, 0.2],
              [0.7, 0.75],
              [1, 0.8],
            ],
          },
        ]}
        shade={{
          x0: 0.55,
          x1: 1,
          at: m("correction", 420),
          label: "correction",
        }}
      />
      <SideNote
        at={spread(dur, 0, 3)}
        side="l"
        top={280}
        label="zero interest rates"
        color={theme.dim}
      />
      <SideNote
        at={spread(dur, 1, 3)}
        side="l"
        top={400}
        label="over-hiring ahead of demand"
        color={theme.dim}
      />
      <SideNote
        at={spread(dur, 2, 3)}
        side="r"
        top={520}
        label="AI walked into an empty room"
        color={theme.warm}
      />
    </>
  ),
  s3_surprise: ({ m, dur }) => (
    <>
      <Diverging
        atUp={m("rebound", 90)}
        atDown={m("overall", 110)}
        upVal="+15%"
        downVal="−7%"
        upLabel="software postings"
        downLabel="whole economy"
      />
      <SideNote
        at={spread(dur, 0, 1)}
        side="l"
        top={300}
        label="since Feb 2025"
        color={theme.accent}
      />
    </>
  ),
  s3_rebound_caveat: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "Still deeply underwater.", c: theme.down },
        { t: "Up 15 from down 27." },
        { t: "But recovering faster than the market.", c: theme.up },
        { t: "Not what automation looks like." },
      ]}
    />
  ),
  s3_signalfire_quote: () => (
    <QuoteCard
      quote="What we're seeing on the ground is a little inconsistent with that."
      who="SignalFire, head of research"
    />
  ),
  s3_verdict: ({ m, dur }) => (
    <>
      <div
        style={{
          position: "absolute",
          top: 210,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Kw at={6} size={64}>
          where I land — hold it loosely
        </Kw>
      </div>
      <Weighted at={m("mostly", 160)} />
      <SideNote
        at={spread(dur, 0, 1)}
        side="r"
        top={760}
        label="70% confident, not 100%"
        color={theme.dim}
      />
    </>
  ),
  s3_uncertainty: () => <Words a="I could be wrong" b="about the weighting." />,
  payoff_frame: () => (
    <Words
      a="So what do you"
      b="actually do?"
      colorB={theme.accent}
      size={120}
    />
  ),
  payoff_one: ({ m, dur }) => (
    <>
      <div
        style={{
          position: "absolute",
          top: 170,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Kw at={6} size={58} color={theme.dim}>
          “is engineering cooked?” is the wrong question
        </Kw>
      </div>
      <TwoPanel at={m("unanswerable", 60)} left="first job" right="third job" />
      <SideNote
        at={spread(dur, 0, 1)}
        side="r"
        top={760}
        label="two markets · opposite directions"
        color={theme.accent}
      />
    </>
  ),
  payoff_two: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "The door narrowed.", s: 96 },
        { t: "−65% narrower.", c: theme.down, s: 84 },
        { t: "It isn't about you.", c: theme.warm, s: 96 },
        { t: "The real variable is how long you keep going.", s: 60 },
      ]}
    />
  ),
  payoff_three: ({ dur }) => (
    <>
      <PipelineGap at={12} dur={dur} />
      <SideNote
        at={spread(dur, 0, 3)}
        side="l"
        top={240}
        label="freeze junior hiring now"
        color={theme.down}
      />
      <SideNote
        at={spread(dur, 1, 3)}
        side="r"
        top={240}
        label="senior shortage in 5 years"
        color={theme.up}
      />
      <SideNote
        at={spread(dur, 2, 3)}
        side="r"
        top={760}
        label="scarce thing in 2031 = whoever got in now"
        color={theme.accent}
      />
    </>
  ),
  payoff_limit: ({ dur }) => (
    <StagedWords
      dur={dur}
      lines={[
        { t: "Which specialization?" },
        { t: "I don't know." },
        { t: "The data doesn't say.", c: theme.dim },
        { t: "Anyone certain is guessing with extra steps." },
      ]}
    />
  ),
  close: ({ dur }) => (
    <>
      <StagedWords
        dur={dur}
        lines={[
          { t: "The field grew.", c: theme.up },
          { t: "The door narrowed.", c: theme.down },
          { t: "Both true — different numbers." },
          { t: "So ask: which number?", c: theme.accent, s: 120 },
          { t: "Neither answer is about your door.", s: 56 },
        ]}
      />
      <div
        style={{
          position: "absolute",
          bottom: 110,
          width: "100%",
          textAlign: "center",
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 30, color: theme.dim }}>
          sources in the description
          <Cursor />
        </span>
      </div>
    </>
  ),
};

const sectionFor = (id: string): string => {
  if (id === "hook") return "Two Numbers";
  if (id.startsWith("stakes")) return "The Stakes";
  if (id.startsWith("s1")) return "Part 1 · Is it fine?";
  if (id.startsWith("s2")) return "Part 2 · The entry level";
  if (id.startsWith("s3")) return "Part 3 · Did AI do it?";
  return "What to do";
};

// Beat wrapper: quick eased cross-fade + slight rise on enter, fade on exit.
const BeatWrap: React.FC<{ dur: number; children: React.ReactNode }> = ({
  dur,
  children,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 7], [0, 1], {
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

export const Episode002: React.FC = () => {
  const beats = timing.beats;
  return (
    <AbsoluteFill>
      <Audio src={staticFile("002-two-job-markets/narration.wav")} />
      <AmbientBackground />
      <Camera>
        {beats.map((b, i) => {
          const start = b.startFrame;
          const end =
            i + 1 < beats.length ? beats[i + 1].startFrame : E002_DURATION;
          const dur = Math.max(1, end - start);
          const Scene = SCENES[b.id];
          const marks = b.marks as Record<string, { frame: number }>;
          const m: MarkFn = (id, fallback = 8) =>
            marks[id] ? marks[id].frame - start : fallback;
          return (
            <Sequence
              key={b.id}
              from={start}
              durationInFrames={dur}
              name={b.id}
            >
              <BeatWrap dur={dur}>
                {Scene ? <Scene m={m} dur={dur} /> : null}
              </BeatWrap>
            </Sequence>
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
