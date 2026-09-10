#!/usr/bin/env python3
"""Generate narration + exact timing from an ElevenLabs voice clone.

    # one-time: put the key in a gitignored .env at repo root
    echo 'ELEVENLABS_API_KEY=sk_...' >> .env
    python3 make_tts.py episodes/002-two-job-markets/ <voice_id>          # v2
    python3 make_tts.py --v3 episodes/004-.../ <voice_id>                 # v3

For each beat it converts the script.yaml narration (our house cues ->
ElevenLabs markup), calls a with-timestamps endpoint, and assembles:

  narration.draft.wav  concatenated audio, 48kHz mono, -16 LUFS
  timing.json          exact per-beat/per-mark frames from the API's own
                       character alignment -- no Whisper, no ASR guessing

timing.json is the ground truth the Remotion composition and make_timing
consume to land animations on words. Its SHAPE is a hard contract and is
IDENTICAL across both models:
  { fps, durationMs, audioMs, source, beats:[ {id, startMs, startFrame,
    marks:{ mark_id:{word, ms, frame} }} ] }

Two models, one output contract
--------------------------------
- v2 (default, `eleven_multilingual_v2`): the whole script goes in ONE
  with-timestamps request -> a single continuous acoustic take, no seams.
  House cues that v2 can't perform (tone cues) are STRIPPED; pauses become
  <break> tags. This remains the safe fallback.

- v3 (`--v3`, `eleven_v3`): the channel's shipping path (ep004+). v3 adds
  inline AUDIO TAGS so tone cues become REAL per-phrase emotion instead of
  being thrown away. v3 has NO <break> tags; pauses become ellipses / a
  spoken-out `[pause]` tag. v3's reliable char-alignment path caps around
  ~2000 chars/request, so the script is CHUNKED on beat boundaries and the
  per-chunk alignments are reassembled with cumulative frames -- exactly the
  proven concat + cumulative-startFrame logic make_tts_patch.py already uses.
  The reassembled timing.json is byte-shape-identical to v2's, so animation
  sync survives chunking unchanged.

DRAFT wav filename either way (narration.draft.wav). Model + cue policy is
selected by the --v3 flag; everything downstream is model-agnostic.

Model fidelity: eleven_multilingual_v2 / eleven_v3 are the highest-fidelity
clone families; latency is irrelevant for batch generation, so never use
Flash/Turbo here.
"""

import base64
import hashlib
import json
import re
import ssl
import subprocess
import sys
import tempfile
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

import yaml

# python.org macOS builds don't use the system cert store; use certifi's
# CA bundle so HTTPS to the API verifies.
try:
    import certifi

    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

FPS = 30
MODEL = "eleven_multilingual_v2"
# v3 model id. VERIFIED 2026-09-03 by live probe: the API accepts "eleven_v3"
# on the standard with-timestamps route (see synth_v3).
MODEL_V3 = "eleven_v3"
OUTPUT_FORMAT = "mp3_44100_128"

# v3 chunking. v3's reliable with-timestamps path caps around ~2000 chars per
# request; we split on BEAT boundaries and stay comfortably under that.
# [VERIFY AT TEST] exact char cap for the v3 with-timestamps endpoint.
V3_CHUNK_CHARS = 1800

# v3 stability is conceptually a named MODE, but the API takes it as the SAME
# voice_settings.stability float v2 uses — sending the string "natural" is a
# hard 422 ("unable to parse string as a number"). VERIFIED 2026-09-03 by live
# probe. The three modes are discrete points on that float, not a range:
#   0.0 Creative   more expressive, looser, likelier to drift
#   0.5 Natural    the tuned default — expressive but holds the clone
#   1.0 Robust     steadiest, but SUPPRESSES audio tags, which would silently
#                  discard every [excited]/[deadpan]/[softly] cue in the script
# Do not "split the difference" here; a value between modes is not a documented
# blend, and anything approaching 1.0 costs us the performance cues entirely.
V3_STABILITY = 0.5
# Single-request generation (whole script in one call) removes the between-
# beat seams that sounded like a mic change, and lets us push expressiveness:
# lower stability + higher style = more emotion, safe because there's no
# cross-call consistency to protect. speed<1 slows the fast default read.
# Tuned 2026-08-31 for a slower, warmer storytelling read (voice research):
# speed 0.94->0.90 (most direct "slower" lever, well inside safe 0.7-1.2),
# style 0.38->0.45 (more expressive; single-request context makes it safe).
# Pacing/warmth otherwise lives in the SCRIPT punctuation (ellipses, em-dashes)
# NOT in more break tags — over-breaking is the #1 v2 instability trigger.
VOICE_SETTINGS = {
    "stability": 0.40,
    "similarity_boost": 0.75,
    "style": 0.45,
    "use_speaker_boost": True,
    "speed": 0.90,
}
SEED = 20260828

# --- v3 chunk cache --------------------------------------------------------
# Without this, EVERY v3 run re-synthesised every chunk: fixing one word in one
# beat cost a full-episode regeneration. Two pieces make "fix one beat, pay for
# one chunk" work:
#
#  1. A PERSISTED CHUNK PLAN (.tts_cache/plan.json). Greedy re-packing is the
#     real enemy of caching -- if a beat grows, every downstream beat can shift
#     into a different chunk, changing all their texts and busting the whole
#     cache even though only one beat was edited. So the plan (which beat ids
#     share a chunk) is written once and REUSED while it stays valid: same beat
#     set, same order, and every chunk still under the char cap. It re-packs
#     only when it genuinely no longer fits, and says so.
#  2. A PER-CHUNK CONTENT CACHE keyed on everything that can change the audio
#     (model, voice, settings, seed, and the chunk's exact TTS text). A hit
#     replays the stored mp3 + alignment and makes no API call.
#
# The cache lives in the episode folder and is gitignored (.tts_cache/).
CACHE_DIR_NAME = ".tts_cache"


def _cache_key(voice_id, text):
    """Hash everything that affects the audio for one chunk."""
    payload = json.dumps(
        {
            "model": MODEL_V3,
            "voice": voice_id,
            "stability": V3_STABILITY,
            "similarity_boost": VOICE_SETTINGS["similarity_boost"],
            "use_speaker_boost": VOICE_SETTINGS["use_speaker_boost"],
            "seed": SEED,
            "format": OUTPUT_FORMAT,
            "text": text,
        },
        sort_keys=True,
    )
    return hashlib.sha1(payload.encode()).hexdigest()[:16]


def cache_load(cache_dir, key):
    """-> (mp3_bytes, spoken, dur_s) or None."""
    mp3 = cache_dir / f"{key}.mp3"
    meta = cache_dir / f"{key}.json"
    if not (mp3.exists() and meta.exists()):
        return None
    try:
        d = json.loads(meta.read_text())
        # Alignment round-trips as [word, start_s] pairs; restore the tuples the
        # matcher expects.
        return mp3.read_bytes(), [(w, s) for w, s in d["spoken"]], d["dur"]
    except Exception:
        return None  # a corrupt entry just means a cache miss, never a crash


def cache_store(cache_dir, key, mp3, spoken, dur):
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / f"{key}.mp3").write_bytes(mp3)
    (cache_dir / f"{key}.json").write_text(
        json.dumps({"spoken": [[w, s] for w, s in spoken], "dur": dur})
    )


def plan_chunks(voiced, cache_dir):
    """Group beats into chunks, reusing the persisted plan when it still fits.

    Returns (chunks, reused: bool).
    """
    ids = [b["id"] for b in voiced]
    by_id = {b["id"]: b for b in voiced}
    plan_path = cache_dir / "plan.json"

    if plan_path.exists():
        try:
            saved = json.loads(plan_path.read_text())
            # Valid only if it covers exactly the same beats in the same order
            # AND every chunk still fits -- an edit that overflows a chunk has
            # to re-pack, and that necessarily costs more than one chunk.
            if [i for ch in saved for i in ch] == ids and all(
                len(" \n\n ".join(tts_text_v3(by_id[i]["narration"]) for i in ch))
                <= V3_CHUNK_CHARS
                for ch in saved
            ):
                return [[by_id[i] for i in ch] for ch in saved], True
        except Exception:
            pass  # unreadable plan -> re-pack

    chunks, cur, cur_len = [], [], 0
    for b in voiced:
        t = tts_text_v3(b["narration"])
        add = len(t) + (2 if cur else 0)
        if cur and cur_len + add > V3_CHUNK_CHARS:
            chunks.append(cur)
            cur, cur_len = [], 0
            add = len(t)
        cur.append(b)
        cur_len += add
    if cur:
        chunks.append(cur)

    cache_dir.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(json.dumps([[b["id"] for b in ch] for ch in chunks], indent=1))
    return chunks, False

MARK = re.compile(r"<mark\s+id=\"([^\"]*)\"\s*/>")
# Tone cues have no v2 equivalent -> stripped (steer tone via stability
# instead). Pause cues -> break tags. **punch** -> plain word (v2 emphasis
# is punctuation-driven). [say: "x"] -> the phonetic spelling.
TONE_CUES = re.compile(r"\[(?:dry|up|down|smile)\]")
# The respelling REPLACES the word it follows, so the model says it once:
# `Stroustrup [say: "STROW-strup"],` -> `STROW-strup,`. Substituting the cue
# alone left the original word in place and the clone read both ("Stroustrup
# STROW-strup") — caught grading ep005, and it affected ep004 too.
# Trailing punctuation on the replaced word is preserved so sentence
# boundaries survive (`Shai-Hulud. [say: "shy-huh-lood"]` -> `shy-huh-lood.`).
SAY_CUE = re.compile(r"(\S+?)([^\w\s]*)\s*\[say:\s*\"([^\"]*)\"\]")
# Fallback for a cue with no word in front of it (start of a beat): it just
# collapses to its respelling.
SAY_BARE = re.compile(r"\[say:\s*\"([^\"]*)\"\]")


def say_sub(text):
    """Apply [say: "..."] pronunciation flags, consuming the flagged word."""
    text = SAY_CUE.sub(lambda m: m.group(3) + m.group(2), text)
    return SAY_BARE.sub(lambda m: m.group(1), text)

# --- v3 cue -> audio-tag map (from the elevenlabs-narration skill) ----------
# In v3, tone cues become REAL inline audio tags instead of being stripped.
# Mild, YouTuber-tuned tags (never cartoonish). One tag per cue.
#
# TWO TIERS, on purpose:
#
#   1. HOUSE CUES (below). Portable — they mean something on both v2 and v3, so
#      a script written in them survives a model switch. Keep scripts mostly in
#      these.
#   2. NATIVE v3 TAGS written directly in the script, e.g. [sad], [whispers],
#      [laughs], [sighs], [slowly], [thoughtful]. These reach the API verbatim
#      and give a much wider emotional range than four cues can.
#
# Tier 2 works because of a property that is easy to break, so it is spelled
# out here: tts_text_v3() only SUBSTITUTES the tokens it knows and passes every
# other bracketed token through untouched, while script_words_v3() drops
# anything matching V3_TAG_TOKEN from the word list used to place <mark>
# frames. Those two behaviours together are what let a writer drop an arbitrary
# v3 tag mid-sentence without shifting a single animation cue. If you ever make
# tts_text_v3 strip unknown brackets, or make script_words_v3 keep them, tier 2
# silently dies — either the tag gets read aloud as a word, or every mark after
# it slips by one.
#
# Range is the point, density is the danger: vary the tag ACROSS beats so no
# two neighbours sit in the same register, but keep it near one tag per
# thought. A tag on every sentence flattens all of them (ep003 read
# "grandma-slow" that way). See GOALS.md.
V3_TONE_MAP = {
    "[up]": "[excited]",
    "[down]": "[softly]",
    "[dry]": "[deadpan]",
    "[smile]": "[warmly]",
}
V3_TONE_CUES = re.compile(r"\[(?:dry|up|down|smile)\]")
# The bracketed tokens v3 emits that are AUDIO TAGS / performance directives,
# NOT spoken words. These must be EXCLUDED from the word list used to place
# <mark> frames (same treatment cues get in v2), so marks land on real spoken
# words only. Matches "[excited]", "[softly]", "[pause]", etc. -- any single
# bracketed lowercase token with no embedded mark syntax.
V3_TAG_TOKEN = re.compile(r"\[[a-z][a-z ]*\]")

# Initialisms v2 would otherwise read arbitrarily -> spaced letters force
# letter-by-letter. Words-that-are-acronyms (NASA, ChatGPT) are omitted on
# purpose. Add channel-wide terms here, never per-script.
ACRONYMS = {
    "BLS": "B L S", "API": "A P I", "QA": "Q A", "CS": "C S",
    "TCP": "T C P", "TLS": "T L S", "SQL": "S Q L", "CPU": "C P U",
    "GPU": "G P U", "URL": "U R L", "HTTP": "H T T P", "NY": "N Y",
}


def load_key():
    import os

    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"]
    env = Path(".env")
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("ELEVENLABS_API_KEY="):
                return line.split("=", 1)[1].strip().strip("\"'")
    sys.exit("No ELEVENLABS_API_KEY in env or .env")


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def script_words(narration):
    """-> [(word, mark_id_or_None)] in spoken order, cues removed."""
    out = []
    for idx, piece in enumerate(MARK.split(narration)):
        if idx % 2 == 1:  # a mark id -> sentinel; the next real word owns it
            out.append(("", piece))
            continue
        piece = TONE_CUES.sub(" ", piece)
        piece = say_sub(piece)
        piece = re.sub(r"\[beat\]|\[breath\]|\*\*|(?<!\S)/+(?!\S)", " ", piece)
        for w in piece.split():
            if norm(w):
                out.append((w, None))
    # fold sentinels: attach a mark to the next real word
    folded, pending = [], None
    for w, mark in out:
        if w == "" and mark is not None:
            pending = mark
        else:
            folded.append((w, pending))
            pending = None
    return folded


def tts_text(narration):
    """Script narration -> ElevenLabs v2 input string."""
    t = MARK.sub("", narration)
    t = TONE_CUES.sub(" ", t)
    t = say_sub(t)
    t = re.sub(r"\*\*", "", t)
    t = t.replace("[beat]", ' <break time="0.5s" /> ')
    t = t.replace("[breath]", ' <break time="0.3s" /> ')
    t = re.sub(r"(?<!\S)//(?!\S)", ' <break time="0.9s" /> ', t)
    t = re.sub(r"(?<!\S)/(?!\S)", ' <break time="0.35s" /> ', t)
    # en/em dash ranges -> "to" so v2 doesn't mis-read them
    t = re.sub(r"(\d)\s*[–—-]\s*(\d)", r"\1 to \2", t)
    # force initialisms letter-by-letter
    t = re.sub(r"\b[A-Z]{2,}\b", lambda m: ACRONYMS.get(m.group(0), m.group(0)), t)
    return " ".join(t.split())


# --- v3 variants: SUBSTITUTE cues into audio tags instead of stripping ------
# The v3 word list and the v3 input string must agree on exactly which tokens
# are spoken. Audio tags ([excited] etc.) and the spoken-out [pause] are NOT
# spoken -> excluded from the word list (script_words_v3) AND emitted into the
# input string (tts_text_v3). This keeps <mark> frames landing on real words.

def script_words_v3(narration):
    """v3: -> [(word, mark_id_or_None)] in spoken order, cues+audio-tags removed.

    Mirrors script_words() but for the v3 cue policy:
      - tone cues -> audio tags, which are NOT spoken -> dropped from words
      - break cues (/ // [beat] [breath]) -> ellipsis / [pause], not spoken
      - **word** -> UPPERCASE the word (still a spoken word, kept)
      - any residual audio-tag token ([pause] etc.) is filtered out
    So the returned list is real spoken words only, marks attached as usual.
    """
    out = []
    for idx, piece in enumerate(MARK.split(narration)):
        if idx % 2 == 1:  # a mark id -> sentinel; the next real word owns it
            out.append(("", piece))
            continue
        # tone cues become audio tags -> not spoken -> remove entirely
        piece = V3_TONE_CUES.sub(" ", piece)
        piece = say_sub(piece)
        # **word** -> WORD (uppercased, still spoken). Strip the ** markers and
        # uppercase the wrapped span so the word list matches the tts string.
        piece = re.sub(r"\*\*(.+?)\*\*", lambda m: m.group(1).upper(), piece)
        # break cues are pauses, not words -> remove from the spoken list
        piece = re.sub(r"\[beat\]|\[breath\]|(?<!\S)/+(?!\S)", " ", piece)
        for w in piece.split():
            # drop any audio-tag token that slipped through (e.g. author-written
            # inline [excited]) -- tags are never spoken words.
            if V3_TAG_TOKEN.fullmatch(w):
                continue
            if norm(w):
                out.append((w, None))
    # fold sentinels: attach a mark to the next real word
    folded, pending = [], None
    for w, mark in out:
        if w == "" and mark is not None:
            pending = mark
        else:
            folded.append((w, pending))
            pending = None
    return folded


def tts_text_v3(narration):
    """Script narration -> ElevenLabs v3 input string (audio tags, no <break>).

    Cue -> tag substitutions (per elevenlabs-narration v3 section):
      [up]->[excited]  [down]->[softly]  [dry]->[deadpan]  [smile]->[warmly]
      **word**->WORD (uppercased)
      / -> '…'   // -> ' [pause] '   [beat] -> ' [pause] '   [breath] -> '…'
    v3 has NO <break> tags; ellipses handle short pauses, [pause] the long ones.
    [VERIFY AT TEST] that v3 treats a bare '[pause]' as a pause directive (per
    the audio-tags docs) rather than reading the literal word "pause".
    """
    t = MARK.sub("", narration)
    t = V3_TONE_CUES.sub(lambda m: V3_TONE_MAP[m.group(0)], t)
    t = say_sub(t)
    # **word** -> WORD (uppercase for emphasis; v3 reads caps as a punch)
    t = re.sub(r"\*\*(.+?)\*\*", lambda m: m.group(1).upper(), t)
    # break cues -> ellipsis (short) / [pause] (long). NO <break> tags on v3.
    t = t.replace("[beat]", " [pause] ")
    t = t.replace("[breath]", " … ")
    t = re.sub(r"(?<!\S)//(?!\S)", " [pause] ", t)
    t = re.sub(r"(?<!\S)/(?!\S)", " … ", t)
    # en/em dash ranges -> "to" (same reason as v2)
    t = re.sub(r"(\d)\s*[–—-]\s*(\d)", r"\1 to \2", t)
    # force initialisms letter-by-letter
    t = re.sub(r"\b[A-Z]{2,}\b", lambda m: ACRONYMS.get(m.group(0), m.group(0)), t)
    return " ".join(t.split())


def synth(voice_id, key, text, prev_text="", next_text=""):
    """Call with-timestamps; return (mp3_bytes, [(word, start_s)], dur_s).
    prev_text/next_text are context only (not voiced) — they keep energy
    consistent across per-beat calls without polluting the alignment."""
    body = {
        "text": text,
        "model_id": MODEL,
        "voice_settings": VOICE_SETTINGS,
        "seed": SEED,
        "apply_text_normalization": "on",
    }
    if prev_text:
        body["previous_text"] = prev_text
    if next_text:
        body["next_text"] = next_text
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
        f"?output_format={OUTPUT_FORMAT}",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, context=SSL_CTX) as r:
        data = json.loads(r.read())

    mp3 = base64.b64decode(data["audio_base64"])
    a = data["alignment"]
    chars, starts = a["characters"], a["character_start_times_seconds"]
    words, cur, cur_start = [], "", None
    for ch, st in zip(chars, starts):
        if ch.isspace():
            if cur:
                words.append((cur, cur_start))
                cur, cur_start = "", None
        else:
            if not cur:
                cur_start = st
            cur += ch
    if cur:
        words.append((cur, cur_start))
    dur = a["character_end_times_seconds"][-1] if a["character_end_times_seconds"] else 0.0
    return mp3, words, dur


def synth_v3(voice_id, key, text):
    """Call the v3 with-timestamps (text-to-dialogue) endpoint for ONE chunk;
    return (mp3_bytes, [(word, start_s)], dur_s).

    Reuses the same alignment-parsing contract as synth() so the reassembly
    logic downstream is model-agnostic. v3 gives per-character alignment; we
    fold characters into words exactly like the v2 path. Audio-tag tokens the
    model does not vocalize simply don't appear as spoken characters (or, if
    they do leak, they're dropped by the fuzzy match against a word list that
    already excludes tags), so word marks still land on real words.

    VERIFIED 2026-09-03 against the live API (probe: one two-sentence cued line,
    voice AL3hg1PD..., 5.92s / 25 aligned tokens):
      - the PLAIN /v1/text-to-speech/{voice}/with-timestamps route accepts
        model_id=eleven_v3 and returns per-character alignment. No separate
        text-to-dialogue route is needed.
      - response shape is IDENTICAL to v2: data["audio_base64"] and
        data["alignment"] with "characters", "character_start_times_seconds",
        "character_end_times_seconds". Nothing to remap.
      - audio tags DO occupy alignment slots as unspoken tokens: the probe
        returned ('[excited]', 0.0) and ('[deadpan]', 4.49) as their own
        entries, plus '…' for an ellipsis. They are absent from
        script_words_v3()'s list, so match() skips past them on its 4-token
        lookahead and <mark> frames still land on real words. This is why that
        lookahead window must stay >1: back-to-back tags between two marked
        words would otherwise desync the beat.
    """
    body = {
        "text": text,
        "model_id": MODEL_V3,
        # Mode-as-float; see V3_STABILITY. Note this deliberately omits v2's
        # "style" and "speed" — v3 performs pacing and tone from the inline
        # audio tags instead, so a speed multiplier here would fight the cues.
        "voice_settings": {
            "stability": V3_STABILITY,
            "similarity_boost": VOICE_SETTINGS["similarity_boost"],
            "use_speaker_boost": VOICE_SETTINGS["use_speaker_boost"],
        },
        "seed": SEED,
        "apply_text_normalization": "on",
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
        f"?output_format={OUTPUT_FORMAT}",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, context=SSL_CTX) as r:
        data = json.loads(r.read())

    mp3 = base64.b64decode(data["audio_base64"])
    a = data["alignment"]
    chars, starts = a["characters"], a["character_start_times_seconds"]
    words, cur, cur_start = [], "", None
    for ch, st in zip(chars, starts):
        if ch.isspace():
            if cur:
                words.append((cur, cur_start))
                cur, cur_start = "", None
        else:
            if not cur:
                cur_start = st
            cur += ch
    if cur:
        words.append((cur, cur_start))
    dur = a["character_end_times_seconds"][-1] if a["character_end_times_seconds"] else 0.0
    return mp3, words, dur


def match(script, spoken):
    """Map each script word to a spoken index (fuzzy, in order)."""
    res, j = [None] * len(script), 0
    for i, (w, _) in enumerate(script):
        target = norm(w)
        for k in range(j, min(j + 4, len(spoken))):
            if norm(spoken[k][0]) == target or SequenceMatcher(None, norm(spoken[k][0]), target).ratio() > 0.7:
                res[i] = k
                j = k + 1
                break
    return res


def ffprobe_ms(wav: Path) -> int:
    """Duration of a wav in whole milliseconds (used by the v3 reassembly)."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(wav)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return round(float(out) * 1000)


def main_v3(folder: Path, voice_id: str):
    """v3 path: chunk on beat boundaries, synth per chunk with the v3
    with-timestamps endpoint, then REASSEMBLE (concat wavs + one loudnorm pass)
    into narration.draft.wav + a timing.json with cumulative frames.

    The reassembly reuses make_tts_patch's proven contract: each beat's
    startFrame is the cumulative frame sum of the clips before it, and each
    beat's marks are computed BEAT-LOCAL then shifted absolute against the
    beat's cumulative start. This is what makes chunking safe for sync -- the
    output timing.json is byte-shape-identical to the v2 single-request path.
    """
    key = load_key()
    doc = yaml.safe_load((folder / "script.yaml").read_text())
    voiced = [b for b in doc["beats"] if b.get("narration", "").strip()]

    # Group beats into chunks <= V3_CHUNK_CHARS, splitting ONLY on beat
    # boundaries (never mid-beat) so each beat's alignment is self-contained.
    # The plan is persisted and reused so a one-beat edit doesn't re-pack (and
    # therefore re-bill) every downstream chunk. See CACHE_DIR_NAME above.
    cache_dir = folder / CACHE_DIR_NAME
    chunks, reused_plan = plan_chunks(voiced, cache_dir)
    if not reused_plan and (cache_dir / "plan.json").exists():
        print("v3: chunk plan RE-PACKED (a beat no longer fits its chunk) — "
              "expect more than one chunk to regenerate")

    # A single beat longer than the cap can't be split on a beat boundary.
    for ch in chunks:
        if len(ch) == 1 and len(tts_text_v3(ch[0]["narration"])) > V3_CHUNK_CHARS:
            sys.exit(
                f"beat {ch[0]['id']} is > {V3_CHUNK_CHARS} chars on its own; "
                "split it into two beats in script.yaml before v3 generation"
            )

    print(f"v3: {len(voiced)} beats in {len(chunks)} chunk(s) "
          f"(<= {V3_CHUNK_CHARS} chars each)")

    tmp = Path(tempfile.mkdtemp())

    # Per-beat clip + beat-local marks, in script order. We synth per CHUNK but
    # store results per BEAT (slicing each chunk's alignment at beat starts) so
    # the reassembly is identical to the patch tool's per-beat model.
    clips = []          # (beat_id, clip_path)
    beat_marks = {}     # beat_id -> {mark: {word, ms(beat-local), frame}}
    clip_ms = {}        # beat_id -> duration in ms

    for ci, chunk in enumerate(chunks):
        # Build the chunk's spoken word list (real words only, tags excluded)
        # and its beat membership, so we can find where each beat starts in the
        # chunk's alignment and recover marks beat-local.
        chunk_words, beat_of = [], []
        for bj, b in enumerate(chunk):
            for w_mark in script_words_v3(b["narration"]):
                chunk_words.append(w_mark)
                beat_of.append(bj)
        chunk_text = " \n\n ".join(tts_text_v3(b["narration"]) for b in chunk)

        ckey = _cache_key(voice_id, chunk_text)
        cached = cache_load(cache_dir, ckey)
        print(f"  chunk {ci + 1}/{len(chunks)}: "
              f"{', '.join(b['id'] for b in chunk)} ({len(chunk_text)} chars)"
              f"{'  [cached — no API call]' if cached else ''}")
        if cached:
            mp3, spoken, dur = cached
        else:
            mp3, spoken, dur = synth_v3(voice_id, key, chunk_text)
            cache_store(cache_dir, ckey, mp3, spoken, dur)
        matched = match([(w, m) for w, m in chunk_words], spoken)

        # Decode this chunk to one wav; we then slice it per beat at each beat's
        # first-word timestamp so per-beat clip_ms sums back to the whole.
        chunk_wav = tmp / f"chunk{ci:03d}.wav"
        raw = tmp / f"chunk{ci:03d}.mp3"
        raw.write_bytes(mp3)
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
             "-i", str(raw), "-ar", "48000", "-ac", "1", str(chunk_wav)],
            check=True,
        )
        chunk_ms = ffprobe_ms(chunk_wav)

        # Each beat's start (ms, chunk-local) = its first matched spoken word.
        beat_start_local = {}
        for bj, b in enumerate(chunk):
            idxs = [i for i, x in enumerate(beat_of) if x == bj]
            first = next((matched[i] for i in idxs if matched[i] is not None), None)
            beat_start_local[bj] = round(spoken[first][1] * 1000) if first is not None else 0
        # First beat of a chunk always starts at 0 so no lead audio is dropped.
        if chunk:
            beat_start_local[0] = 0

        for bj, b in enumerate(chunk):
            bid = b["id"]
            start_local = beat_start_local[bj]
            end_local = beat_start_local[bj + 1] if bj + 1 < len(chunk) else chunk_ms
            if end_local <= start_local:
                sys.exit(f"beat {bid}: non-positive window in chunk {ci} alignment")
            # Slice this beat's audio out of the chunk wav.
            clip = tmp / f"{len(clips):03d}_{bid}.wav"
            cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                   "-i", str(chunk_wav), "-ss", f"{start_local/1000:.3f}"]
            if bj + 1 < len(chunk):
                cmd += ["-to", f"{end_local/1000:.3f}"]
            cmd += ["-ar", "48000", "-ac", "1", str(clip)]
            subprocess.run(cmd, check=True)
            clip_ms[bid] = ffprobe_ms(clip)

            # Marks beat-local: spoken time minus this beat's chunk-local start.
            idxs = [i for i, x in enumerate(beat_of) if x == bj]
            marks = {}
            for i in idxs:
                w, mark = chunk_words[i]
                m = matched[i]
                if mark and m is not None:
                    local_ms = round(spoken[m][1] * 1000) - start_local
                    if local_ms < 0:
                        local_ms = 0
                    marks[mark] = {"word": spoken[m][0], "ms": local_ms,
                                   "frame": round(local_ms * FPS / 1000)}
            beat_marks[bid] = marks
            clips.append((bid, clip))
            print(f"    {bid:<20} {clip_ms[bid]/1000:6.2f}s  "
                  f"marks: {', '.join(marks) or '-'}")

    # Concatenate all beat clips in order, then ONE loudnorm pass (I=-16, same
    # target as the v2 single-request path) -> narration.draft.wav.
    concat_list = tmp / "concat.txt"
    concat_list.write_text("".join(f"file '{c}'\n" for _, c in clips))
    stitched = tmp / "stitched.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-f", "concat", "-safe", "0", "-i", str(concat_list),
         "-ar", "48000", "-ac", "1", str(stitched)],
        check=True,
    )
    out_wav = folder / "narration.draft.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-i", str(stitched), "-ar", "48000", "-ac", "1",
         "-af", "loudnorm=I=-16", str(out_wav)],
        check=True,
    )

    # Cumulative frames -> each beat's absolute startFrame; marks shifted
    # absolute. IDENTICAL shape to the v2 path and make_tts_patch.
    beats_out = []
    cum_ms = 0
    for bid, _ in clips:
        start_ms = cum_ms
        marks_abs = {}
        for mk, mv in beat_marks[bid].items():
            abs_ms = start_ms + mv["ms"]
            marks_abs[mk] = {"word": mv["word"], "ms": abs_ms,
                             "frame": round(abs_ms * FPS / 1000)}
        beats_out.append({"id": bid, "startMs": start_ms,
                          "startFrame": round(start_ms * FPS / 1000),
                          "marks": marks_abs})
        cum_ms += clip_ms[bid]

    total_ms = ffprobe_ms(out_wav)
    (folder / "timing.json").write_text(
        json.dumps(
            {"fps": FPS, "durationMs": total_ms, "audioMs": total_ms,
             "source": "elevenlabs-v3-draft", "beats": beats_out},
            indent=1,
        )
        + "\n"
    )
    print("\nfinal timeline (v3):")
    for bo in beats_out:
        print(f"  {bo['id']:<20} @{bo['startFrame']:>5}f  "
              f"marks: {', '.join(bo['marks']) or '-'}")
    print(f"\nwrote {out_wav} and {folder / 'timing.json'}  "
          f"({total_ms/1000:.1f}s, v3, {len(chunks)} chunk(s) reassembled)")


def main():
    args = sys.argv[1:]
    use_v3 = False
    if "--v3" in args:
        use_v3 = True
        args = [a for a in args if a != "--v3"]
    if len(args) != 2:
        sys.exit("usage: make_tts.py [--v3] <episode_dir> <voice_id>")
    folder, voice_id = Path(args[0]), args[1]

    if use_v3:
        main_v3(folder, voice_id)
        return

    key = load_key()
    doc = yaml.safe_load((folder / "script.yaml").read_text())
    voiced = [b for b in doc["beats"] if b.get("narration", "").strip()]

    # ONE request for the whole script -> a single continuous acoustic
    # environment (no between-beat seams). Beats are separated by blank lines
    # for natural paragraph prosody; marks are recovered from the full
    # alignment. Fits v2's 10k-char limit for a ~10-min script.
    combined_words, beat_of = [], []  # (word, mark) and its beat index
    for bi, b in enumerate(voiced):
        for w_mark in script_words(b["narration"]):
            combined_words.append(w_mark)
            beat_of.append(bi)
    combined_text = " \n\n ".join(tts_text(b["narration"]) for b in voiced)
    if len(combined_text) > 9800:
        sys.exit(f"combined text {len(combined_text)} chars > single-request limit; chunking not yet implemented")

    print(f"generating {len(voiced)} beats in one request ({len(combined_text)} chars)...")
    mp3, spoken, dur = synth(voice_id, key, combined_text)
    matched = match([(w, m) for w, m in combined_words], spoken)

    beats = []
    for bi, b in enumerate(voiced):
        idxs = [i for i, x in enumerate(beat_of) if x == bi]
        first = next((matched[i] for i in idxs if matched[i] is not None), None)
        start_ms = round(spoken[first][1] * 1000) if first is not None else 0
        entry = {"id": b["id"], "startMs": start_ms, "startFrame": round(start_ms * FPS / 1000), "marks": {}}
        for i in idxs:
            w, mark = combined_words[i]
            m = matched[i]
            if mark and m is not None:
                ms = round(spoken[m][1] * 1000)
                entry["marks"][mark] = {"word": spoken[m][0], "ms": ms, "frame": round(ms * FPS / 1000)}
        beats.append(entry)
        print(f"  {b['id']:<20} @{entry['startFrame']:>5}f  marks: {', '.join(entry['marks']) or '-'}")

    tmp = Path(tempfile.mkdtemp())
    raw = tmp / "raw.mp3"
    raw.write_bytes(mp3)
    out_wav = folder / "narration.draft.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(raw),
         "-ar", "48000", "-ac", "1", "-af", "loudnorm=I=-16", str(out_wav)],
        check=True,
    )

    total_ms = round(dur * 1000)
    (folder / "timing.json").write_text(
        json.dumps(
            {"fps": FPS, "durationMs": total_ms, "audioMs": total_ms, "source": "elevenlabs-draft", "beats": beats},
            indent=1,
        )
        + "\n"
    )
    print(f"\nwrote {out_wav} and {folder / 'timing.json'}  ({total_ms/1000:.1f}s, one continuous take)")


if __name__ == "__main__":
    main()
