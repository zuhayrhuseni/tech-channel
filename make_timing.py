#!/usr/bin/env python3
"""
Generate timing.json from whisper-cli word-level output + script.yaml.

    python3 make_timing.py episodes/000-trailer/

Expects narration.wav.json (whisper-cli -ml 1 -oj) and script.yaml in the
folder. Writes timing.json:

    captions  — @remotion/captions Caption[] (text, startMs, endMs, ...)
    beats     — [{id, startMs, startFrame, marks: {markId: {ms, frame, word}}}]

Every <mark id="x"/> must resolve to a spoken word. If one can't be matched
the script exits nonzero and names it — fix the source, don't approximate.
"""

import json
import re
import sys
import wave
from difflib import SequenceMatcher
from pathlib import Path

import yaml

FPS = 30
MARK = re.compile(r"<mark\s+id=\"([^\"]*)\"\s*/>")
# Performance cues ([beat], [dry], [say: "..."], / pauses, **punch** bold)
# are teleprompter-only — never spoken, so never aligned.
CUE = re.compile(r"\[[^\]]*\]|/+|\*\*")


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def load_words(whisper_json):
    """Whisper tokens -> [(word, startMs, endMs)], merging clitics ('ll, 's)
    into the previous word and dropping punctuation-only tokens."""
    words = []
    for tok in whisper_json["transcription"]:
        text = tok["text"].strip()
        if not text:
            continue
        start, end = tok["offsets"]["from"], tok["offsets"]["to"]
        if (text.startswith("'") or not norm(text)) and words:
            pw, ps, _ = words[-1]
            words[-1] = (pw + text, ps, end)
        else:
            words.append((text, start, end))
    return [w for w in words if norm(w[0])]


def script_tokens(beats):
    """-> [(beatId, word, markId-or-None)] in narration order. A mark
    attaches to the word that follows it. MARK.split alternates text,
    markId, text, markId, ..."""
    out = []
    for beat in beats:
        parts = MARK.split(beat.get("narration", ""))
        pending = None
        for idx, piece in enumerate(parts):
            if idx % 2 == 1:  # this piece is a mark id
                pending = piece
                continue
            for w in CUE.sub(" ", piece).split():
                if norm(w):
                    out.append((beat["id"], w, pending))
                    pending = None
    return out


def align(script, spoken):
    """Greedy in-order alignment. Returns spoken index for each script index
    (or None). Tolerates transcription errors via fuzzy match and bounded
    skips on either side."""
    result = [None] * len(script)
    j = 0
    for i, (_, w, _) in enumerate(script):
        target = norm(w)
        for lookahead in range(j, min(j + 4, len(spoken))):
            cand = norm(spoken[lookahead][0])
            if cand == target or SequenceMatcher(None, cand, target).ratio() > 0.7:
                result[i] = lookahead
                j = lookahead + 1
                break
        # unmatched: leave None, don't advance j

    # Gap-fill: ASR sometimes mangles a word ("precise" -> "possessed") but
    # the slot is still unambiguous when both neighbours matched and the
    # number of unmatched spoken tokens between the anchors is identical.
    # Positional, deterministic — not a fuzzy guess.
    for i, m in enumerate(result):
        if m is not None or i == 0 or i + 1 >= len(script):
            continue
        left, right = result[i - 1], result[i + 1]
        if left is not None and right is not None and right - left == 2:
            result[i] = left + 1
    return result


def main():
    folder = Path(sys.argv[1])
    doc = yaml.safe_load((folder / "script.yaml").read_text())
    whisper = json.loads((folder / "narration.wav.json").read_text())

    spoken = load_words(whisper)
    script = script_tokens(doc["beats"])
    matched = align(script, spoken)

    unmatched = [(b, w) for (b, w, _), m in zip(script, matched) if m is None]

    captions = [
        {"text": w, "startMs": s, "endMs": e, "timestampMs": (s + e) // 2, "confidence": None}
        for w, s, e in spoken
    ]

    beats, errors = [], []
    for beat in doc["beats"]:
        toks = [(k, m) for k, m in zip(script, matched) if k[0] == beat["id"]]
        first = next((m for _, m in toks if m is not None), None)
        if first is None:
            errors.append(f"beat '{beat['id']}': no words matched")
            continue
        entry = {
            "id": beat["id"],
            "startMs": spoken[first][1],
            "startFrame": round(spoken[first][1] * FPS / 1000),
            "marks": {},
        }
        for (bid, w, mark), m in toks:
            if mark is None:
                continue
            if m is None:
                errors.append(f"mark '{mark}' (word '{w}') in beat '{bid}': not found in recording")
                continue
            entry["marks"][mark] = {
                "word": spoken[m][0],
                "ms": spoken[m][1],
                "frame": round(spoken[m][1] * FPS / 1000),
            }
        beats.append(entry)

    if errors:
        sys.exit("UNRESOLVED:\n  " + "\n  ".join(errors))

    with wave.open(str(folder / "narration.wav")) as wav:
        audio_ms = round(wav.getnframes() / wav.getframerate() * 1000)

    total = len(script)
    out = {
        "fps": FPS,
        "durationMs": spoken[-1][2],  # last spoken word — visuals end here
        "audioMs": audio_ms,  # full wav length — the composition ends here
        "captions": captions,
        "beats": beats,
    }
    (folder / "timing.json").write_text(json.dumps(out, indent=1) + "\n")

    print(f"wrote {folder / 'timing.json'}")
    print(f"matched {total - len(unmatched)}/{total} script words against {len(spoken)} spoken")
    for b in beats:
        marks = ", ".join(f"{k}@{v['frame']}f" for k, v in b["marks"].items()) or "-"
        print(f"  {b['id']:<10} start {b['startFrame']:>4}f  marks: {marks}")
    if unmatched:
        print(f"unmatched (non-mark) words: {[w for _, w in unmatched]}")


if __name__ == "__main__":
    main()
