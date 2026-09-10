#!/bin/zsh
# Stitch parts_$ROUND/*.mp4 into full_$ROUND.mp4 WITHOUT the concat A/V-drift trap.
#
# PROMOTED from episodes/005-cpu-waits-on-memory/out/draft/stitch.sh, which
# stays in place as the ep005 audit trail. The only change is that the episode
# is now a variable (EPID); the audio-path logic below is unchanged.
#
#   ROUND=r7 scripts/stitch_episode.sh              # ep005 grading proxy
#   ROUND=r7 SCALE=1 scripts/stitch_episode.sh      # 1080p master (parts_r7_1080)
#   EPID=e006 ROUND=r1 scripts/stitch_episode.sh    # a different episode
#
# EPID defaults to e005 and MUST match the render (scripts/render_episode.sh) --
# both derive $BUNDLE the same way, because path A below re-renders audio out of
# that same bundle.
#
# THE TRAP (found in r2): `ffmpeg -f concat -c copy` on parts that still carry
# audio advances each segment's start by the segment's AUDIO duration
# (41.728s -- AAC rounds up to a 1024-sample frame boundary) instead of its
# VIDEO duration (41.6667s). That injects ~61ms of silence at every boundary
# and accumulated to ~26 frames (858ms) of drift by the end of the episode.
#
# THE FIX: concat VIDEO-ONLY parts (so segment offsets can only come from video
# duration), and build the audio track separately as one continuous stream.
#   Audio path A (preferred): one single-pass Remotion audio render of the whole
#     composition -> zero seams by construction, exact duration.
#   Audio path B (fallback, the r2 method): decode each part's audio to PCM,
#     truncate to the EXACT sample count its frame count implies, concatenate.
#
# NOTE: this replaces stitch_r2.sh, which had a zsh "bad math expression" bug
# from ffprobe emitting trailing commas into arithmetic.
set -u
: "${ROUND:?ROUND must be set, e.g. ROUND=r7 scripts/stitch_episode.sh}"
SELF=${0:A}
SCRIPTS=${SELF:h}
REPO=${SCRIPTS:h}
# DURATION IS DERIVED, NEVER TYPED. stitch_r3.sh carried `DURATION=18500` as a
# literal; the beat-10 re-voice moved the episode to 18483 and the stale number
# would have been used to validate a render of the correct length -- failing, or
# worse passing, for a reason that has nothing to do with the cut. This is the
# fourth file the shared derivation was written to de-duplicate.
source "$SCRIPTS/_episode_env.zsh"

BUNDLE=${BUNDLE:-/tmp/${EPID}-bundle-${ROUND}}
OUTDIR=$EP/out/draft
# Profile-scoped, matching render_episode.sh: a 1080p master must never be
# stitched out of the scale=0.5 grading parts, and both dirs can exist at once.
if [ "${SCALE:-0.5}" = "1" ] || [ "${SCALE:-0.5}" = "1.0" ]; then
  PARTS=$OUTDIR/parts_${ROUND}_1080
  FINAL=$OUTDIR/full_${ROUND}_1080.mp4
else
  PARTS=$OUTDIR/parts_${ROUND}
  FINAL=$OUTDIR/full_${ROUND}.mp4
fi
VONLY=$PARTS/vonly
SR=48000
echo "  episode=$EPID ($EPDIR) composition=$COMPOSITION"
echo "  round=$ROUND parts=$PARTS final=$FINAL"

mkdir -p "$VONLY"

# num() strips whitespace AND the trailing commas ffprobe emits -- the exact
# thing that broke stitch_r2.sh under zsh arithmetic.
num() { print -r -- "$1" | tr -d ' ,\n\r'; }

echo "=== 1. validate parts ==="
TOTAL=0
NPARTS=0
for f in "$PARTS"/part_*.mp4; do
  n=$(num "$(ffprobe -v error -count_frames -select_streams v:0 \
        -show_entries stream=nb_read_frames -of csv=p=0 "$f")")
  base=$(basename "$f")
  # expected count is encoded in the filename: part_NN_A-B.mp4
  range=${base##*_}; range=${range%.mp4}
  a=${range%%-*}; b=${range##*-}
  want=$(( b - a + 1 ))
  if [ "$n" != "$want" ]; then
    echo "  FATAL $base frames=$n want=$want"; exit 2
  fi
  echo "  $base frames=$n OK"
  TOTAL=$(( TOTAL + n )); NPARTS=$(( NPARTS + 1 ))
done
echo "  parts=$NPARTS sum=$TOTAL expected=$DURATION"
[ "$TOTAL" = "$DURATION" ] || { echo "FATAL: frame sum mismatch"; exit 3; }

echo "=== 2. strip audio from every part ==="
: > "$PARTS/vonly_list.txt"
for f in "$PARTS"/part_*.mp4; do
  v="$VONLY/$(basename "$f")"
  ffmpeg -v error -y -i "$f" -an -c:v copy "$v" || exit 4
  print -r -- "file '$v'" >> "$PARTS/vonly_list.txt"
done
echo "  stripped $(ls "$VONLY" | wc -l | tr -d ' ') parts"

echo "=== 3. concat video-only ==="
rm -f "$PARTS/video_only.mp4"
ffmpeg -v error -y -f concat -safe 0 -i "$PARTS/vonly_list.txt" \
  -c copy "$PARTS/video_only.mp4" || exit 5
VF=$(num "$(ffprobe -v error -count_frames -select_streams v:0 \
      -show_entries stream=nb_read_frames -of csv=p=0 "$PARTS/video_only.mp4")")
echo "  video_only frames=$VF (expected $DURATION)"
[ "$VF" = "$DURATION" ] || { echo "FATAL: video_only frame count wrong"; exit 6; }

echo "=== 4. audio ==="
WANT_SAMPLES=$(( DURATION * SR / FPS ))     # 18557/30*48000 = 29,691,200
echo "  target samples=$WANT_SAMPLES ($(( WANT_SAMPLES / SR )).$(( (WANT_SAMPLES % SR) * 1000 / SR ))s)"
AUD="$PARTS/audio_full.wav"

USED=""
if [ -f "$AUD" ]; then
  GOT=$(num "$(ffprobe -v error -select_streams a:0 -show_entries stream=duration_ts \
        -of csv=p=0 "$AUD")")
  [ "$GOT" = "$WANT_SAMPLES" ] && USED="A(cached single-pass render)"
fi

if [ -z "$USED" ]; then
  echo "  path A: single-pass Remotion audio render (no seams by construction)"
  pkill -9 -f chrome-headless-shell 2>/dev/null
  pkill -9 -f 'Chrome for Testing' 2>/dev/null
  pkill -9 -f remotion 2>/dev/null
  sleep 2
  cd "$REPO" || exit 91
  rm -f "$AUD"
  npx remotion render "$BUNDLE" "$COMPOSITION" "$AUD" \
    --codec=wav --concurrency=1 --chrome-mode=chrome-for-testing \
    --log=error
  RC=$?
  GOT=0
  [ -f "$AUD" ] && GOT=$(num "$(ffprobe -v error -select_streams a:0 \
        -show_entries stream=duration_ts -of csv=p=0 "$AUD")")
  echo "  path A rc=$RC samples=$GOT want=$WANT_SAMPLES"
  if [ $RC -eq 0 ] && [ "$GOT" = "$WANT_SAMPLES" ]; then
    USED="A(single-pass render)"
  elif [ $RC -eq 0 ] && [ "$GOT" -gt 0 ] 2>/dev/null; then
    # Right content, off by a few samples (Remotion rounds up to a whole
    # audio frame). Pad THEN cut to the exact sample count.
    # NOTE: do NOT use bare `apad` + `-frames:a` here -- apad pads forever and
    # `-frames:a` does not bound a PCM stream, which inflated this file to
    # 2466s on the first run. `atrim=end_sample=` is the exact, bounded fix.
    ffmpeg -v error -y -i "$AUD" \
      -af "apad=whole_len=$WANT_SAMPLES,atrim=end_sample=$WANT_SAMPLES" \
      -c:a pcm_s16le -ar $SR -ac 2 "$PARTS/audio_fixed.wav" \
      && mv "$PARTS/audio_fixed.wav" "$AUD"
    GOT=$(num "$(ffprobe -v error -select_streams a:0 -show_entries stream=duration_ts \
          -of csv=p=0 "$AUD")")
    echo "  path A after length-fix samples=$GOT"
    USED="A(single-pass render, length-corrected)"
  fi
fi

if [ -z "$USED" ]; then
  echo "  path A FAILED -> path B: per-part PCM truncated to exact sample counts"
  RAW="$PARTS/audio_exact.raw"
  rm -f "$RAW"
  for f in "$PARTS"/part_*.mp4; do
    base=$(basename "$f"); range=${base##*_}; range=${range%.mp4}
    a=${range%%-*}; b=${range##*-}
    nfr=$(( b - a + 1 ))
    ns=$(( nfr * SR / FPS ))          # exact samples this part is worth
    # decode -> force exact sample count (pad short, cut long) -> append
    ffmpeg -v error -i "$f" -vn -f s16le -acodec pcm_s16le -ar $SR -ac 2 \
      -af "apad" -frames:a 0 -t $(print -r -- "scale=9; $nfr/$FPS" | bc) - >> "$RAW" || exit 7
  done
  # hard-truncate the raw file to the exact byte count (4 bytes/sample: s16 x2ch)
  WANT_BYTES=$(( WANT_SAMPLES * 4 ))
  HAVE_BYTES=$(stat -f%z "$RAW")
  echo "  raw bytes have=$HAVE_BYTES want=$WANT_BYTES"
  if [ "$HAVE_BYTES" -gt "$WANT_BYTES" ]; then
    dd if="$RAW" of="$RAW.cut" bs=1 count=0 2>/dev/null
    dd if="$RAW" of="$RAW.cut" bs=4 count=$WANT_SAMPLES 2>/dev/null
    mv "$RAW.cut" "$RAW"
  fi
  ffmpeg -v error -y -f s16le -ar $SR -ac 2 -i "$RAW" -c:a pcm_s16le "$AUD" || exit 8
  USED="B(per-part PCM)"
fi
echo "  audio path used: $USED"

echo "=== 5. mux ==="
rm -f "$FINAL"
ffmpeg -v error -y -i "$PARTS/video_only.mp4" -i "$AUD" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar $SR -ac 2 \
  -movflags +faststart -shortest "$FINAL" || exit 9
echo "  wrote $FINAL"

echo "=== 6. verify ==="
ffprobe -v error -count_frames -select_streams v:0 \
  -show_entries stream=nb_read_frames,width,height,r_frame_rate,duration \
  -of default=nw=1 "$FINAL"
ffprobe -v error -select_streams a:0 \
  -show_entries stream=codec_name,channels,sample_rate,duration,duration_ts \
  -of default=nw=1 "$FINAL"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$FINAL"
