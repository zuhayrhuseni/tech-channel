#!/usr/bin/env python3
"""
Generate narration.txt (teleprompter copy) from script.yaml.

    python make_narration.py videos/002-two-job-markets/script.yaml

Writes narration.txt beside the yaml. Never edit narration.txt by hand --
edit the yaml and re-run this. Also prints a word count and estimated
runtime at 150 wpm.
"""

import re
import sys
from pathlib import Path

import yaml

MARK = re.compile(r"<mark\s+id=\"[^\"]*\"\s*/>")
# Performance cues stay in the teleprompter text (they're for the reader)
# but don't count as spoken words.
CUE = re.compile(r"\[[^\]]*\]|(?<!\S)/+(?!\S)|\*\*")

# --- cue lint --------------------------------------------------------------
# Two tiers of bracketed markup are legal, matching make_tts.py:
#
#   TIER 1 -- HOUSE_CUES. Portable; they mean something on both v2 and v3.
#   TIER 2 -- V3_TAGS. Native ElevenLabs v3 audio tags written straight into
#             the script. tts_text_v3() passes them through verbatim and
#             script_words_v3() drops them from the mark word list, so they
#             perform without shifting a single animation cue.
#
# Anything OUTSIDE both tiers, and any single-asterisk emphasis, is silently
# passed THROUGH the TTS text builders and reaches ElevenLabs as literal
# characters -- the model then either reads them aloud or lets them
# destabilise the take. Caught on ep005, where nine `*italic*` spans would
# have shipped as literal asterisks.
BRACKET_CUE = re.compile(r"\[([^\]]*)\]")
HOUSE_CUES = {"dry", "up", "down", "smile", "beat", "breath"}
# Tier 2. Emotional range is the quality bar (GOALS.md) -- these are meant to
# be used. Keep this list in sync with what v3 actually performs; an
# undocumented tag reaching the model is a wasted take, not a free experiment.
V3_TAGS = {
    # tone / emotion
    "excited", "softly", "deadpan", "warmly", "sad", "curious", "surprised",
    "thoughtful", "hesitant", "serious", "cheerful", "tired", "amused",
    "whispers", "shouts",
    # non-verbal performance
    "laughs", "chuckles", "sighs", "exhales", "clears throat",
    # pacing
    "pause", "slowly", "rushed", "drawn out",
}
# A lone '*' that isn't part of a '**punch**' pair.
STRAY_STAR = re.compile(r"(?<!\*)\*(?!\*)")
BREAK_TAG = re.compile(r"<break\b")


def lint_cues(beat_id, raw):
    """-> [warning strings] for markup that would leak into the TTS payload."""
    warns = []

    for body in BRACKET_CUE.findall(raw):
        token = body.strip()
        if token in HOUSE_CUES or token in V3_TAGS:
            continue
        if token.startswith("say:") or token.startswith("VERIFY"):
            continue
        warns.append(
            f"{beat_id}: unknown cue [{token}] -- not a house cue and not a "
            f"known v3 audio tag; it will reach ElevenLabs as literal text"
        )

    stars = len(STRAY_STAR.findall(raw))
    if stars:
        warns.append(
            f"{beat_id}: {stars} single-asterisk emphasis span(s) -- only **punch** "
            f"exists; single '*' reaches ElevenLabs as a literal asterisk"
        )

    if raw.count("**") % 2:
        warns.append(f"{beat_id}: unbalanced '**' -- a punch span isn't closed")

    if BREAK_TAG.search(raw):
        warns.append(f"{beat_id}: <break> tag -- v3 has none; pace with / // [beat]")

    return warns


def clean(text):
    """Strip cue anchors, drop stray '#' notes, collapse whitespace.

    A '#' inside a YAML folded block is literal text, not a comment -- so
    source notes written there would otherwise end up in the teleprompter.
    Sources belong in the beat's `notes:` field; this is the safety net.
    """
    text = MARK.sub("", text)
    text = re.sub(r"#.*", "", text)
    return " ".join(text.split())


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: make_narration.py <path/to/script.yaml>")

    src = Path(sys.argv[1])
    doc = yaml.safe_load(src.read_text())
    beats = doc.get("beats", [])

    lines = [doc.get("title", src.stem), ""]
    if doc.get("type") == "timely":
        lines += ["[TIMELY -- confirm every figure is still current before recording]", ""]
    lines.append("=" * 60)
    lines.append("")

    total_words = 0
    flagged = []
    cue_warnings = []

    for beat in beats:
        raw = beat.get("narration", "")
        body = clean(raw)
        if not body:
            continue
        total_words += len(CUE.sub(" ", body).split())
        cue_warnings += lint_cues(beat["id"], raw)

        # Section headers come from the beat id prefix, so the reader can
        # find their place after a flubbed take.
        lines.append(f"[{beat['id']}]")
        lines.append(body)
        lines.append("")

        if "VERIFY" in (beat.get("notes") or ""):
            flagged.append(beat["id"])

    minutes, seconds = divmod(round(total_words / 150 * 60), 60)
    lines += [
        "=" * 60,
        f"{total_words} words  |  approx {minutes}:{seconds:02d} at 150 wpm",
    ]
    if flagged:
        lines.append(f"UNVERIFIED beats -- check before recording: {', '.join(flagged)}")

    out = src.parent / "narration.txt"
    out.write_text("\n".join(lines) + "\n")

    print(f"wrote {out}")
    print(f"{total_words} words, approx {minutes}:{seconds:02d}")
    if flagged:
        print(f"UNVERIFIED: {', '.join(flagged)}")
    if cue_warnings:
        print(f"\nCUE LINT -- {len(cue_warnings)} issue(s), fix before TTS:")
        for w in cue_warnings:
            print(f"  ! {w}")


if __name__ == "__main__":
    main()
