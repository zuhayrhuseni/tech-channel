#!/bin/zsh
# THE PACING MEASUREMENT. Run this on every render, before any grade.
#
#   scripts/measure_pacing.sh MP4 [EPISODE_DIR]
#
#   scripts/measure_pacing.sh episodes/005-cpu-waits-on-memory/out/final.mp4
#   scripts/measure_pacing.sh out/draft/full_r14.mp4 episodes/005-cpu-waits-on-memory
#
# EPISODE_DIR defaults to the mp4's episode: this walks up from the file until
# it finds a directory holding a timing.json, so the common case takes one
# argument and still cannot be pointed at the wrong episode's beat table.
#
# DURATION AND FPS ARE DERIVED, NEVER ARGUMENTS. This was promoted out of
# verify_beats_r8.sh (section G), where the pipe was spelled out inline against
# a $DURATION sourced from _derive_duration.zsh. Making them parameters would
# reintroduce exactly the hand-typed frame count that four separate r5 scripts
# carried stale -- and here it is worse than in the render, because pacing.py
# does not fail on a wrong N, it prints a WARNING line and then reports the
# whole table anyway. A wrong number produces a plausible, wrong grade.
#
# WHAT THE PIPE IS DOING (from the verify_beats_r8.sh header, kept because
# every line of it was learned the hard way):
#
#   A content event = >= 0.3% of the frame changing by >= 25 luma levels,
#   measured on a 240x135 downsample. Stream gray8 rawvideo and diff
#   consecutive frames in numpy: 32400 B per frame, read one frame at a time,
#   so the ~600 MB stream is never materialised.
#
#   WHY NOT signalstats' YDIF: YDIF is the MEAN absolute luma delta over the
#   whole frame. It cannot distinguish "3% of pixels moved a lot" (a real
#   reveal) from "100% of pixels moved a little" (the always-on ambient drift
#   layer). At a loose gate the drift layer alone measures up to 5.20% of frame
#   -- 17x the 0.3% threshold -- so EVERY static hold reads as busy. That is
#   how an earlier grade reported 1 static hold where the correct gate found
#   39, totalling 28.7% of the runtime: a badly-paced cut looked perfect.
#
#   None of these are content events, and each has produced a false "this beat
#   is fine": a count-up digit ticking, a progress bar filling, a
#   character-by-character typewriter, a camera push / Ken-Burns, and b-roll
#   crushed behind a deep scrim.
#
# pacing.py MUST stay a standalone file, never a heredoc: the frame stream owns
# stdin, so `python3 - <<PY` makes python read raw VIDEO BYTES as its own source
# (SyntaxError: invalid non-printable character U+0013).
set -u
SELF=${0:A}
SCRIPTS=${SELF:h}
REPO=${SCRIPTS:h}

MP4=${1:-}
[ -n "$MP4" ] || { echo "usage: scripts/measure_pacing.sh MP4 [EPISODE_DIR]"; exit 64; }
[ -f "$MP4" ] || { echo "FATAL: $MP4 does not exist"; exit 65; }
MP4=${MP4:A}

# --- resolve the episode dir ------------------------------------------------
EP=${2:-}
if [ -n "$EP" ]; then
  EP=${EP:A}
else
  # Walk up from the mp4 to the nearest ancestor holding a timing.json. An mp4
  # at episodes/NNN-slug/out/draft/full_r14.mp4 resolves to episodes/NNN-slug.
  d=${MP4:h}
  while [ "$d" != "/" ] && [ ! -f "$d/timing.json" ]; do d=${d:h}; done
  EP=$d
fi
[ -f "$EP/timing.json" ] || {
  echo "FATAL: no timing.json under '$EP' -- pass EPISODE_DIR explicitly"; exit 66; }

# EP is pre-set, so this skips the EPID registry and only derives DURATION/FPS.
source "$SCRIPTS/_episode_env.zsh"

echo "  mp4     : $MP4"
echo "  episode : $EP"

# A frame-count mismatch is the single most common way this measurement lies
# (pacing.py warns but still prints a full table). Surface it up front rather
# than leaving it four lines into the report.
HAVE=$(ffprobe -v error -count_frames -select_streams v:0 \
        -show_entries stream=nb_read_frames -of csv=p=0 "$MP4" | tr -d ' ,\n\r')
[ -z "$HAVE" ] && HAVE=0
if [ "$HAVE" != "$DURATION" ]; then
  echo "  *** WARNING: mp4 has $HAVE frames, timing.json implies $DURATION."
  echo "  *** The per-beat table is aligned to timing.json, so it will be OFF."
fi

echo
echo "=== content-event gate + static-hold table ==="
# -nostdin: without it ffmpeg swallows the caller's remaining input.
ffmpeg -nostdin -v error -i "$MP4" \
  -vf "scale=240:135,format=gray" -f rawvideo -pix_fmt gray - 2>/dev/null \
| python3 "$SCRIPTS/pacing.py" "$EP/timing.json" "$DURATION" "$FPS"
