import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { theme, REVEAL_FRAMES } from "./theme";

// Load the same mono family the rest of the channel uses. Self-contained so the
// component works even if the trailer font module isn't imported.
const mono = loadMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
const MONO = mono.fontFamily;

export interface FakeTerminalProps {
  /**
   * Lines of code/prompt to type out, in order. Rendered with light syntax
   * coloring. ANONYMITY: every path/prompt here must be neutral — use
   * ~/project, fake tokens, no real names. This component cannot enforce that;
   * the acquire anonymity gate does.
   */
  lines: string[];
  /** Frame at which typing begins (relative to this component's timeline). */
  startFrame?: number;
  /** Characters per second the typewriter reveals. */
  cps?: number;
  /** Optional window title shown in the chrome bar. Neutral only. */
  title?: string;
}

// A rebuilt terminal / code editor for B-roll of an AI "writing code". Safer
// than screen-capturing a real editor: neutral paths and fake creds are
// guaranteed by construction, nothing leaks from the creator's machine. The
// typewriter is driven by useCurrentFrame (deterministic, seek-safe), a mono
// cursor blinks on the last revealed character, and lines fade+rise in as the
// cursor reaches them. Pure component — no data fetching, no side effects.
export const FakeTerminal: React.FC<FakeTerminalProps> = ({
  lines,
  startFrame = 0,
  cps = 22,
  title = "~/project",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Whole-panel entrance: scale from 0.94 (never 0), ease-out via spring.
  const panelIn = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 200 },
  });
  const panelScale = interpolate(panelIn, [0, 1], [0.94, 1]);
  const panelOpacity = interpolate(panelIn, [0, 1], [0, 1]);

  // Typewriter: total characters revealed grows linearly with time. We walk the
  // lines and hand each one only the slice of characters it currently owns.
  const elapsed = Math.max(0, frame - startFrame);
  const charsPerFrame = cps / fps;
  const revealed = Math.floor(elapsed * charsPerFrame);

  let budget = revealed;
  const rendered: { text: string; typing: boolean; started: boolean }[] = [];
  for (const line of lines) {
    const len = line.length;
    if (budget <= 0) {
      rendered.push({ text: "", typing: false, started: false });
      continue;
    }
    if (budget >= len) {
      rendered.push({ text: line, typing: false, started: true });
      budget -= len + 1; // +1 virtual char for the newline pause
    } else {
      rendered.push({
        text: line.slice(0, budget),
        typing: true,
        started: true,
      });
      budget = 0;
    }
  }

  // Blinking block cursor: on for ~half a second, off for ~half. Sits on the
  // line currently being typed, or the last line once typing completes.
  const blink = Math.floor(frame / (fps * 0.53)) % 2 === 0;
  const doneTyping = revealed >= lines.reduce((n, l) => n + l.length + 1, 0);
  const activeIdx = rendered.findIndex((r) => r.typing);
  const cursorLine = activeIdx === -1 ? lines.length - 1 : activeIdx;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        fontFamily: MONO,
      }}
    >
      <div
        style={{
          width: 1180,
          transform: `scale(${panelScale})`,
          opacity: panelOpacity,
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${theme.stroke}`,
          background: theme.panel,
          backdropFilter: "blur(2px)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
      >
        {/* window chrome — three dots + optional neutral title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: `1px solid ${theme.stroke}`,
            background: "rgba(13,17,23,0.6)",
          }}
        >
          <Dot color={theme.down} />
          <Dot color={theme.warm} />
          <Dot color={theme.up} />
          {title && (
            <span
              style={{
                marginLeft: 14,
                color: theme.dim,
                // typesize-exempt: window chrome. This is the titlebar filename
                // next to the three dots -- it exists so the panel reads as "a
                // terminal" at a glance, and it is never narrated. Raising it to
                // the 56px floor would make the chrome compete with the code.
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: 0.3,
              }}
            >
              {title}
            </span>
          )}
        </div>

        {/* code body */}
        <div
          style={{
            padding: "26px 30px 34px",
            // typesize-exempt: the code body is TEXTURE BY DESIGN. Both ep005
            // uses (HiddenAssumption, SweepVsChase) show dense code the viewer
            // is meant to recognise as code and NOT read -- PRODUCTION-LESSONS
            // picks exactly this over a metaphor for "code you can't read".
            //
            // NOT A BLANKET PASS. If a future episode asks the viewer to read a
            // specific line here, this exemption is wrong for that episode: pass
            // a larger fontSize at the call site and let the few lines that
            // matter clear the floor, rather than deleting this comment.
            fontSize: 30,
            lineHeight: "46px",
          }}
        >
          {rendered.map((r, i) => (
            <Line
              key={i}
              index={i}
              started={r.started}
              text={r.text}
              frame={frame}
              startFrame={startFrame}
              charsPerFrame={charsPerFrame}
              lines={lines}
              showCursor={i === cursorLine && (r.typing || doneTyping) && blink}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      width: 15,
      height: 15,
      borderRadius: "50%",
      background: color,
      display: "inline-block",
    }}
  />
);

// A single code line. Fades + rises in over REVEAL_FRAMES once its first
// character is due, so lines don't hard-cut. Renders tokens with light syntax
// coloring pulled from theme tokens.
const Line: React.FC<{
  index: number;
  started: boolean;
  text: string;
  frame: number;
  startFrame: number;
  charsPerFrame: number;
  lines: string[];
  showCursor: boolean;
}> = ({
  index,
  started,
  text,
  frame,
  startFrame,
  charsPerFrame,
  lines,
  showCursor,
}) => {
  // Frame at which this line's first character is revealed.
  const priorChars = lines
    .slice(0, index)
    .reduce((n, l) => n + l.length + 1, 0);
  const lineStartFrame = startFrame + priorChars / charsPerFrame;
  const appear = interpolate(
    frame,
    [lineStartFrame - 3, lineStartFrame - 3 + REVEAL_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        opacity: started ? appear : 0,
        transform: `translateY(${(1 - appear) * 6}px)`,
        whiteSpace: "pre",
        minHeight: 46,
      }}
    >
      {tokenize(text).map((t, i) => (
        <span key={i} style={{ color: t.color, fontWeight: t.weight }}>
          {t.value}
        </span>
      ))}
      {showCursor && (
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 30,
            marginLeft: 2,
            transform: "translateY(4px)",
            background: theme.accent,
          }}
        />
      )}
    </div>
  );
};

// Deliberately light "syntax-ish" coloring — not a real parser, just enough
// visual texture to read as code. Keeps everything in theme tokens.
interface Token {
  value: string;
  color: string;
  weight: number;
}

const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "import",
  "from",
  "export",
  "default",
  "async",
  "await",
  "class",
  "new",
  "def",
  "print",
  "true",
  "false",
  "null",
  "None",
  "True",
  "False",
]);

function tokenize(line: string): Token[] {
  if (line.length === 0) return [{ value: "", color: theme.ink, weight: 400 }];

  // Full-line comment (# or //) → dim, no further parsing.
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return [{ value: line, color: theme.dim, weight: 400 }];
  }

  // Shell prompt lines ("$ ...") → dim sigil, accent command.
  if (trimmed.startsWith("$ ")) {
    const lead = line.slice(0, line.indexOf("$"));
    return [
      { value: lead + "$ ", color: theme.dim, weight: 700 },
      { value: trimmed.slice(2), color: theme.up, weight: 400 },
    ];
  }

  const tokens: Token[] = [];
  // Split into strings vs. everything-else, then color words within the rest.
  const parts = line.split(/(".*?"|'.*?'|`.*?`)/g);
  for (const part of parts) {
    if (part === "") continue;
    if (/^["'`].*["'`]$/.test(part)) {
      tokens.push({ value: part, color: theme.warm, weight: 400 });
      continue;
    }
    // Color identifiers word by word, keep punctuation/whitespace as ink.
    const words = part.split(/(\b)/);
    for (const w of words) {
      if (KEYWORDS.has(w)) {
        tokens.push({ value: w, color: theme.accent, weight: 700 });
      } else if (/^\d+(\.\d+)?$/.test(w)) {
        tokens.push({ value: w, color: theme.up, weight: 400 });
      } else {
        tokens.push({ value: w, color: theme.ink, weight: 400 });
      }
    }
  }
  return tokens;
}
