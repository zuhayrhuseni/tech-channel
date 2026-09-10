import React from "react";
import { theme } from "../components/theme";
import { MONO } from "../trailer/fonts";

// Minimal channel identity — just a small, dim wordmark bug in the bottom-left.
// No bottom progress line: it's redundant with YouTube's own scrubber sitting
// right below it (creator note). The old inset border / corner ticks / eyebrow
// are gone too — that read as a cheap template.
export const BroadcastFrame: React.FC<{
  sections: Array<{ from: number; label: string }>;
}> = () => {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          bottom: 42,
          left: 56,
          display: "flex",
          alignItems: "center",
          gap: 9,
          opacity: 0.4,
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            background: theme.accent,
            borderRadius: 2,
          }}
        />
        <span
          style={{
            fontFamily: MONO,
            fontWeight: 600,
            fontSize: 16,
            color: theme.dim,
            letterSpacing: "0.2em",
          }}
        >
          AIJUNKIE
        </span>
      </div>
    </div>
  );
};
