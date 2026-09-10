#!/bin/zsh
# Full-episode chunked render -> $EP/out/draft/parts_$ROUND/*.mp4
#
# PROMOTED from episodes/005-cpu-waits-on-memory/out/draft/render_full.sh, which
# stays in place as the ep005 audit trail. The only change is that the episode
# is now a variable (EPID) alongside the round; every chunk/retry/assert
# behaviour below is unchanged.
#
# ONE SCRIPT FOR EVERY ROUND, AND NOW FOR EVERY EPISODE. r2 through r6 each got
# their own copy, and the copies drifted: the frame-count assertion that r3
# added had to be re-added by hand each time, and the profile-scoped parts dir
# that stops a scale=0.5 part being mistaken for a 1080p one only exists from r6
# on. A round is a variable, not a reason to fork a proven script -- and so is
# an episode. That is the same argument the profile block below already makes
# for grading-proxy vs final master.
#
#   ROUND=r7 scripts/render_episode.sh                    # ep005 grading proxy
#   ROUND=r7 SCALE=1 CRF=17 CHUNK=600 scripts/render_episode.sh   # 1080p master
#   EPID=e006 ROUND=r1 scripts/render_episode.sh          # a different episode
#
# EPID defaults to e005 and resolves through scripts/_episode_env.zsh (the
# shell-side twin of src/episodes.ts), so every existing ep005 invocation works
# unchanged and lands on the same /tmp/e005-bundle-$ROUND path as before.
#
# Per docs/research/PRODUCTION-LESSONS.md § RENDERING:
#   small chunks, concurrency 1, FRESH process per chunk,
#   zombie kill + zero-proc verify before EVERY attempt, retry 3x.
#
# ---------------------------------------------------------------------------
# WHY THE CHUNK/RESUME/DETACH SHAPE (from r5's OOM post-mortem)
#
# The first r5 launch DIED at chunk 1 and left 8 orphaned chrome-for-testing
# procs reparented to PPID 1. The retry loop below was not at fault -- the
# PARENT SHELL was OOM-killed, so the loop died with it. At launch the box had
# ~541 MB unused with 5 GB in the compressor. Three changes follow from that:
#
#   1. CHUNK 1250 -> 925. Peak RSS scales with how long one browser lives, so
#      shorter-lived processes lower the peak. 20 chunks instead of 15.
#   2. RESUME. A chunk whose file already exists AND already has exactly the
#      right frame count is skipped. A second OOM now costs one chunk, not the
#      whole run.
#   3. Run this DETACHED (nohup; macOS has no setsid). If the launching shell is
#      killed, the render must not go with it. That is what happened the first
#      time.
#
# The bundle is REBUILT every run, deliberately. Anything rendered from an older
# bundle is stale by both length and content, and r3 nearly graded the wrong
# code exactly that way. Parts are cleared unless KEEP_PARTS=1.
# ---------------------------------------------------------------------------
set -u
: "${ROUND:?ROUND must be set, e.g. ROUND=r7 scripts/render_episode.sh}"
SELF=${0:A}
SCRIPTS=${SELF:h}
REPO=${SCRIPTS:h}
source "$SCRIPTS/_episode_env.zsh"

# Bundle path is scoped BY EPISODE as well as by round: two episodes rendering
# from one /tmp bundle would be the stale-bundle bug (r3) with a second episode
# supplying the staleness. EPID=e005 keeps the historical /tmp/e005-bundle-$ROUND.
BUNDLE=${BUNDLE:-/tmp/${EPID}-bundle-${ROUND}}
OUTDIR=$EP/out/draft
LOG=$OUTDIR/full_${ROUND}_render.log
KEEP_PARTS=${KEEP_PARTS:-0}
echo "  episode: $EPID ($EPDIR)  composition: $COMPOSITION"
echo "  bundle : $BUNDLE"

# --- grading proxy vs final master -----------------------------------------
# The SAME script produces both, because the two must not diverge. A separate
# "final" script is how you end up grading one code path and shipping another.
#
#   grading proxy (default):  SCALE=0.5 CRF=20  -> fast, for the video-grader
#   1080p final master:       SCALE=1   CRF=17 CHUNK=600
#
# CHUNK shrinks for the final because peak renderer RSS scales with both frame
# area and how long one browser process lives. At scale 1 each frame is 4x the
# pixels, so the 925-frame chunk that survives at 0.5 is the wrong size at 1.0 —
# this box OOM-kills Chrome mid-chunk (PRODUCTION-LESSONS § RENDERING). Free
# 4-6 GB before running the final.
SCALE=${SCALE:-0.5}
CRF=${CRF:-20}
CHUNK=${CHUNK:-925}
echo "  render profile: scale=$SCALE crf=$CRF chunk=$CHUNK"

# Parts are scoped BY PROFILE, and this is not cosmetic. The RESUME check below
# validates a part by FRAME COUNT ALONE -- so a parts dir left over from a
# scale=0.5 grading run would report every 960x540 chunk as "already complete"
# for a scale=1 final, and the final master would silently ship at half
# resolution with a 1080p container. Different profile -> different directory,
# so that cannot happen.
if [ "$SCALE" = "1" ] || [ "$SCALE" = "1.0" ]; then
  PARTS=$OUTDIR/parts_${ROUND}_1080
else
  PARTS=$OUTDIR/parts_${ROUND}
fi
echo "  parts dir: $PARTS"

mkdir -p "$PARTS"
: > "$LOG"
cd "$REPO" || exit 91

echo "=== 0. clear stale parts ===" | tee -a "$LOG"
if [ "$KEEP_PARTS" = "1" ]; then
  echo "  KEEP_PARTS=1 -- resuming against existing parts" | tee -a "$LOG"
else
  rm -f "$PARTS"/part_*.mp4
  echo "  cleared (rendered from a pre-edit bundle, so stale)" | tee -a "$LOG"
fi

echo "=== 1. rebuild bundle ===" | tee -a "$LOG"
rm -rf "$BUNDLE"
npx remotion bundle src/index.ts --out-dir="$BUNDLE" >>"$LOG" 2>&1 || {
  echo "FATAL: bundle build failed" | tee -a "$LOG"; exit 93; }
echo "  built $BUNDLE" | tee -a "$LOG"

echo "=== 2. bundle sanity ===" | tee -a "$LOG"
# The bundle must self-report exactly DURATION frames, else we would render the
# wrong code / wrong length. This is the r3 stale-bundle guard.
COMPLINE=$(npx remotion compositions "$BUNDLE" 2>/dev/null | grep -E "^${COMPOSITION}[[:space:]]")
echo "  $COMPLINE" | tee -a "$LOG"
BFRAMES=$(print -r -- "$COMPLINE" | awk '{print $4}')
if [ "$BFRAMES" != "$DURATION" ]; then
  echo "FATAL: bundle reports $BFRAMES frames, expected $DURATION" | tee -a "$LOG"
  exit 92
fi
echo "  bundle self-reports $BFRAMES frames -- matches expected $DURATION" | tee -a "$LOG"

T_ALL0=$(date +%s)
FAILED=()
RETRIED=()
SKIPPED=0

preflight() {
  pkill -9 -f chrome-headless-shell 2>/dev/null
  pkill -9 -f 'Chrome for Testing' 2>/dev/null
  pkill -9 -f chrome-for-testing 2>/dev/null
  pkill -9 -f remotion 2>/dev/null
  sleep 2
  local n
  n=$(pgrep -f 'chrome-headless-shell|Chrome for Testing|chrome-for-testing|remotion' | wc -l | tr -d ' ')
  if [ "$n" != "0" ]; then
    echo "  preflight FAILED: $n renderer procs alive" | tee -a "$LOG"
    return 1
  fi
  echo "  preflight: 0 renderer procs" >> "$LOG"
  return 0
}

# exact frame count of an mp4, or 0
nframes() {
  local f=$1 n
  [ -f "$f" ] || { echo 0; return; }
  n=$(ffprobe -v error -count_frames -select_streams v:0 \
        -show_entries stream=nb_read_frames -of csv=p=0 "$f" | tr -d ' ,\n')
  [ -z "$n" ] && n=0
  echo "$n"
}

A=0
IDX=0
while [ $A -lt $DURATION ]; do
  B=$(( A + CHUNK - 1 ))
  [ $B -ge $DURATION ] && B=$(( DURATION - 1 ))
  OUT="$PARTS/part_$(printf '%02d' $IDX)_${A}-${B}.mp4"
  WANT=$(( B - A + 1 ))

  # RESUME: a complete chunk is never re-rendered.
  HAVE=$(nframes "$OUT")
  if [ "$HAVE" = "$WANT" ]; then
    echo "chunk $IDX ($A-$B) SKIP -- already complete frames=$HAVE" | tee -a "$LOG"
    SKIPPED=$(( SKIPPED + 1 ))
    A=$(( B + 1 )); IDX=$(( IDX + 1 ))
    continue
  fi

  OK=0
  for ATTEMPT in 1 2 3; do
    preflight || { sleep 5; continue; }
    echo "=== chunk $IDX frames $A-$B (want $WANT) attempt $ATTEMPT ===" | tee -a "$LOG"
    T0=$(date +%s)
    rm -f "$OUT"
    # fresh `npx remotion render` process per attempt -> resets browser memory
    npx remotion render "$BUNDLE" "$COMPOSITION" "$OUT" \
      --frames="$A-$B" \
      --crf=$CRF --scale=$SCALE --concurrency=1 \
      --chrome-mode=chrome-for-testing \
      --log=error >>"$LOG" 2>&1
    RC=$?
    T1=$(date +%s)

    # a chunk is only OK if it exists AND has EXACTLY the frames we asked for.
    # rc=0 alone is NOT sufficient (r3 added this assertion; keep it).
    GOT=$(nframes "$OUT")

    if [ $RC -eq 0 ] && [ "$GOT" = "$WANT" ]; then
      echo "chunk $IDX ($A-$B) OK attempt=$ATTEMPT frames=$GOT elapsed=$((T1-T0))s" | tee -a "$LOG"
      [ $ATTEMPT -gt 1 ] && RETRIED+=("$IDX:$A-$B:succeeded_on_attempt_$ATTEMPT")
      OK=1
      break
    fi
    echo "chunk $IDX ($A-$B) FAILED rc=$RC frames=$GOT/$WANT attempt=$ATTEMPT elapsed=$((T1-T0))s" | tee -a "$LOG"
    RETRIED+=("$IDX:$A-$B:attempt_${ATTEMPT}_failed_rc${RC}_frames${GOT}of${WANT}")
    rm -f "$OUT"
    sleep 5
  done

  [ $OK -eq 0 ] && FAILED+=("$IDX:$A-$B")
  A=$(( B + 1 )); IDX=$(( IDX + 1 ))
done

T_ALL1=$(date +%s)
echo "=== ALL CHUNKS DONE in $((T_ALL1-T_ALL0))s (skipped $SKIPPED already-complete) ===" | tee -a "$LOG"
if [ ${#RETRIED[@]} -gt 0 ]; then
  echo "RETRY EVENTS: ${RETRIED[*]}" | tee -a "$LOG"
else
  echo "RETRY EVENTS: none (every chunk succeeded first attempt)" | tee -a "$LOG"
fi
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "FAILED CHUNKS: ${FAILED[*]}" | tee -a "$LOG"
  exit 1
fi
echo "no failed chunks" | tee -a "$LOG"
