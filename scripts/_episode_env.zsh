##############################################################################
# EPISODE ENV — the shell-side twin of src/episodes.ts.
#
# Resolves $EPID (e.g. e005) to the episode's directory and Remotion
# composition id, then DERIVES DURATION / FPS / AUDIO_MS from that episode's
# timing.json.
#
# WHY DERIVED, NEVER TYPED (this is the whole reason the file exists — it is
# promoted from episodes/005-.../out/draft/_derive_duration.zsh):
#
#   This is the SAME rule as E005_DURATION in src/e005/Episode005.tsx:
#       Math.ceil((timing.audioMs / 1000) * timing.fps)
#
#   Round 6 is exactly why. The beat-10 re-voice (the 2022->2021 factual
#   correction) moved the episode from 18500 to 18483 frames. The r5 script set
#   carried a hand-typed `DURATION=18500` in FOUR separate files. Any one left
#   stale would have rendered 17 frames past the end of the audio, or asserted
#   the bundle against a length that no longer exists -- and the mismatch would
#   not have surfaced until the stitch step, after a ~40-minute render had
#   already completed against the wrong number.
#
# USAGE
#   EPID=e005 source scripts/_episode_env.zsh       # registry lookup
#   EP=/abs/path/to/episode source scripts/_episode_env.zsh   # bypass lookup
#
# A pre-set $EP wins and skips the registry, so a tool that is handed an
# episode directory directly (measure_pacing.sh) does not need a registry entry
# to exist yet. That matters for ep006 on day one, before it has a composition.
##############################################################################
# Repo root, derived from this script's own location so a clone works anywhere.
# This was a hardcoded absolute home path, which made every promoted script
# unrunnable outside one machine -- the opposite of the point of promoting them.
# ${0:A:h} is the directory holding this file (scripts/), so its parent is root.
: ${REPO:=${0:A:h:h}}

# --- registry: EPID -> EPDIR, COMPOSITION -----------------------------------
# ONE MAP, ONE ENTRY PER EPISODE. Keep in step with EPISODES in
# src/episodes.ts; these are the two halves of the same table.
if [ -z "${EP:-}" ]; then
  : ${EPID:=e005}
  case "$EPID" in
    e005)
      : ${EPDIR:=005-cpu-waits-on-memory}
      : ${COMPOSITION:=Episode005}
      ;;
    *)
      echo "FATAL: unknown EPID '$EPID' -- add it to the case in scripts/_episode_env.zsh"
      exit 95
      ;;
  esac
  EP=$REPO/episodes/$EPDIR
fi

_TIMING=$EP/timing.json
[ -f "$_TIMING" ] || { echo "FATAL: $_TIMING not found"; exit 94; }

eval "$(python3 -c "
import json, math, sys
t = json.load(open('$_TIMING'))
print('DURATION=%d' % math.ceil(t['audioMs'] / 1000 * t['fps']))
print('FPS=%d' % t['fps'])
print('AUDIO_MS=%d' % t['audioMs'])
")" || { echo "FATAL: could not derive DURATION from timing.json"; exit 94; }

[ "${DURATION:-0}" -gt 0 ] || { echo "FATAL: derived DURATION is empty/zero"; exit 94; }
echo "  derived from timing.json: DURATION=$DURATION FPS=$FPS (audioMs=$AUDIO_MS)"
