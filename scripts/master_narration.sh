#!/usr/bin/env bash
#
# master_narration.sh — TWO-PASS loudnorm master for an episode's narration.
#
#   usage: scripts/master_narration.sh <in.wav> <out.wav>
#
# WHY TWO PASSES. PRODUCTION-LESSONS: "master ~-14 to -16 LUFS integrated, true
# peak <= -1 dBTP. Measure AFTER processing — single-pass loudnorm undershoots
# (ep003 came out -17.3 and had to be re-normalized)." A single-pass loudnorm
# is a streaming estimator: it has not heard the whole file when it starts
# applying gain, so it lands short. Pass 1 measures the file end to end and
# hands the real numbers to pass 2, which then applies a known correction.
#
# The output is a GENERATED file. Never hand-edit it (no Audacity gain nudges,
# no re-export) — if the loudness is wrong, change the target here and re-run
# against the TTS source.
#
# Timing safety: loudnorm is a gain/limiting stage, not a time-stretch, so the
# sample count is preserved and the episode's timing.json word marks stay valid.
# The script asserts that rather than trusting it.

set -euo pipefail

IN="${1:?usage: master_narration.sh <in.wav> <out.wav>}"
OUT="${2:?usage: master_narration.sh <in.wav> <out.wav>}"

# -15 LUFS sits dead centre of the -14..-16 band, so a +/-1 LU measurement
# wobble on a re-cut VO still lands inside it. -1.5 dBTP leaves half a dB of
# headroom under the -1 dBTP ceiling for the AAC encoder in the final render.
TARGET_I="-15"
TARGET_TP="-1.5"
TARGET_LRA="11"

echo "== pass 1/2: measuring $IN"
MEASURED=$(ffmpeg -hide_banner -nostats -i "$IN" \
  -af "loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:print_format=json" \
  -f null - 2>&1 | sed -n '/^{/,/^}/p')

get() { printf '%s' "$MEASURED" | grep "\"$1\"" | sed 's/.*: *"\(.*\)".*/\1/'; }
M_I=$(get input_i); M_TP=$(get input_tp); M_LRA=$(get input_lra); M_TH=$(get input_thresh)
echo "   input: I=${M_I} LUFS  TP=${M_TP} dBTP  LRA=${M_LRA} LU"

echo "== pass 2/2: applying correction -> $OUT"
# -map_metadata -1 is an ANONYMITY step, not a tidiness one: QuickTime/ffmpeg
# metadata can carry the machine's user name (CLAUDE.md hard rule 1).
ffmpeg -hide_banner -loglevel error -y -i "$IN" \
  -af "loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:measured_I=${M_I}:measured_TP=${M_TP}:measured_LRA=${M_LRA}:measured_thresh=${M_TH}:linear=true:print_format=summary,aresample=48000" \
  -map_metadata -1 -ar 48000 -ac 1 -c:a pcm_s16le "$OUT"

echo "== verifying"
samples() { ffprobe -v error -select_streams a:0 -count_frames \
  -show_entries stream=duration_ts -of csv=p=0 "$1" | tr -d ',\n'; }
IN_N=$(samples "$IN"); OUT_N=$(samples "$OUT")
if [ "$IN_N" != "$OUT_N" ]; then
  echo "FAIL: sample count changed ($IN_N -> $OUT_N); timing.json marks would drift." >&2
  exit 1
fi
echo "   sample count preserved: $OUT_N"

# The only number that counts: EBU R128 measured on the PROCESSED file.
ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=peak=true -f null - 2>&1 \
  | sed -n '/Integrated loudness/,$p' | grep -E "I: |LRA: |Peak:"
