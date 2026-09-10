#!/bin/zsh
# EVERY STATIC GATE, ONE RUN, ANY EPISODE.
#
# These are the checks that must be green BEFORE burning ~40 minutes of chunked
# render on a cut that was never going to pass. No render, no mp4, no pixels --
# everything here reads source and resolves the schedule.
#
#   EPID=e005 ./scripts/gates.sh
#   EPID=e006 ./scripts/gates.sh
#
# Exit code is the number of FAILED gates, so it doubles as a count.
#
# WHY A RUNNER: ep005 round 7 shipped a render with a live scheduling defect in
# it (ThreeRules staged sub-reveals whose offsets exceeded their step's nominal,
# so they never rendered a single frame) because the checks existed but were run
# ad hoc, one at a time, from memory, and that one got skipped. A gate you have
# to remember to run is a gate that is sometimes not run.
#
# PROMOTED FROM episodes/005-cpu-waits-on-memory/out/draft/gates_r8.sh, which
# was correct but ep005-shaped: it hardcoded the credits path, grepped
# `src/e005/Episode005.tsx` for playhead declarations, matched the literal
# string `[e005 schedule]`, and asserted `>= 15` beats. Every one of those is a
# number ep006 does not share. They now come from the registry
# (src/episodes.ts / scripts/_episode_env.zsh) or from the resolved schedule.
set -u
cd "${0:A:h}/.." || exit 99   # -> repo root
REPO=${PWD}

: ${EPID:=e005}
source scripts/_episode_env.zsh   # -> EP, EPDIR, COMPOSITION, DURATION, FPS

# Registry fields the TS side owns. Read them from the one map rather than
# re-typing them here, so the two halves cannot drift.
eval "$(npx tsx -e "
import { EPISODES } from './src/episodes';
const e = EPISODES['${EPID}'];
if (!e) { console.error('unknown episode ${EPID}'); process.exit(95); }
console.log('PLAN_SRC=' + JSON.stringify(e.planSrc));
console.log('EP_REL='   + JSON.stringify(e.dir));
console.log('N_BEATS='  + e.beats.length);
" 2>/dev/null)" || { print -- "FATAL: could not read registry for $EPID"; exit 95; }

print -- "  registry: plan=$PLAN_SRC beats=$N_BEATS"

typeset -i FAILED=0
typeset -a NAMES
NAMES=()

run() {   # run <name> <cmd...>
  local name=$1; shift
  print -- "\n\033[1m=== $name ===\033[0m"
  if "$@"; then
    print -- "  \033[32mPASS\033[0m  $name"
  else
    print -- "  \033[31mFAIL\033[0m  $name (exit $?)"
    (( FAILED++ ))
    NAMES+=("$name")
  fi
}

# 1. Types. Nothing downstream is meaningful if this fails.
run "tsc"            npx tsc --noEmit

# 2. Lint.
run "eslint"         npx eslint src

# 3. The contrast floor -- ep005's round-8 root cause, now a gate rather than a
#    one-off fix. Idle geometry at 1.05:1 reads as a dead frame to the eye AND
#    to the pacing model. See scripts/check_contrast.ts.
run "contrast floor" npx tsx scripts/check_contrast.ts --episode=$EPID

# 4. Dead sub-reveals. The round-7 defect made mechanical: a staged reveal whose
#    offset exceeds its step's reachable ceiling never renders a single frame,
#    throws nothing, and reads as live code. Three ep005 scenes were then
#    "fixed" by enlarging reveals that had never been drawn.
run "sub-reveals"    npx tsx scripts/check_subreveals.ts --episode=$EPID

# 5. Type size. Annotation type under the readability floor.
run "typesize"       npx tsx scripts/check_typesize.ts --episode=$EPID

# 6. Dimmed ink -- elements retired below luma 110 while nothing else is lit.
run "dimmed ink"     npx tsx scripts/check_dimmed_ink.ts --episode=$EPID

# 7. Word sync. Every SFX cue and its picture land ON or slightly BEFORE the
#    word, measured against .tts_cache, never against a words-per-frame model.
run "word sync"      npx tsx scripts/check_wordsync.ts --episode=$EPID

# 8. Any number quoted on screen matches the committed benchmark source.
run "bench"          npm run check:bench --silent

# 9. Every third-party asset credited BEFORE render (PLAYBOOK #8).
run "credits"        npx tsx scripts/check_credits.ts "$EP_REL"

# NOTE: the anonymity sweep is deliberately NOT here. It takes a rendered mp4
# (`npm run sweep -- <out.mp4>`) because it reads FRAMES -- it is a post-render
# gate and cannot run at this stage. Calling it argument-less here made it print
# a usage line and exit 2, which the runner faithfully reported as a failed
# anonymity check: a gate that fails for a reason unrelated to what it guards is
# worse than no gate, because the noise is what gets ignored.

# 10. THE SCHEDULE MUST RESOLVE WITH ZERO WARNINGS. dump_schedule prints a
#     warning per starved or stretched step; any warning means at least one
#     scene is being run at a clock rate its storyboard was not authored for,
#     which silently rescales every sub-reveal inside it.
print -- "\n\033[1m=== schedule (zero-warning gate) ===\033[0m"
sched_out=$(npx tsx scripts/dump_schedule.ts --episode=$EPID 2>&1)
sched_rc=$?
warn_n=$(print -r -- "$sched_out" | grep -c "\[$EPID schedule\]")
# A CRASH MUST NOT READ AS ZERO WARNINGS. Grepping the output of a command that
# died prints "0 warnings" and the gate goes green -- the instrument certifying
# a schedule it never resolved. Same silent-pass shape that once let a truncated
# decode report "13/15 beats meeting the pacing floor".
if (( sched_rc != 0 )); then
  print -- "  \033[31mFAIL\033[0m  dump_schedule exited $sched_rc -- schedule NOT MEASURED"
  print -r -- "$sched_out" | tail -15 | sed 's/^/      /'
  (( FAILED++ )); NAMES+=("schedule(crash)")
elif (( warn_n == 0 )); then
  print -- "  \033[32mPASS\033[0m  schedule resolves with 0 warnings"
else
  print -- "  \033[31mFAIL\033[0m  $warn_n schedule warning(s):"
  print -r -- "$sched_out" | grep "\[$EPID schedule\]" | sed 's/^/      /'
  (( FAILED++ )); NAMES+=("schedule")
fi

# 11. EVERY beat plan must declare `playhead: true`. A plan that OMITS it
#     silently falls back to entrance-mode, which collapses that scene's staged
#     sub-reveals into a single 8-frame pop -- the exact defect that produced
#     ep005 beat 9's long fade. It is one grep and it caught this twice, so it
#     is a gate. The expected count is the registry's beat count, not a literal.
print -- "\n\033[1m=== playhead declarations ===\033[0m"
ph=$(grep -c 'playhead: true' "$PLAN_SRC")
if (( ph >= N_BEATS )); then
  print -- "  \033[32mPASS\033[0m  $ph 'playhead: true' declarations (>= $N_BEATS beats)"
else
  print -- "  \033[31mFAIL\033[0m  only $ph 'playhead: true' declarations, expected >= $N_BEATS"
  (( FAILED++ )); NAMES+=("playhead")
fi

# 12. SFX cue coverage. dump_sfx reports silent gaps; a long one is a beat with
#     no sound design at all. ep005 r12 shipped a 34.3s stretch with zero cues
#     and the only way to see it from source was arithmetic that had already
#     gone stale three times in that file's own comments.
print -- "\n\033[1m=== sfx coverage ===\033[0m"
sfx_out=$(npx tsx scripts/dump_sfx.ts --episode=$EPID 450 2>&1)
sfx_rc=$?
if (( sfx_rc != 0 )); then
  print -- "  \033[31mFAIL\033[0m  dump_sfx exited $sfx_rc"
  (( FAILED++ )); NAMES+=("sfx(crash)")
else
  silent_n=$(print -r -- "$sfx_out" | grep -c 'SILENT')
  if (( silent_n == 0 )); then
    print -- "  \033[32mPASS\033[0m  no silent stretch > 15s"
  else
    print -- "  \033[33mWARN\033[0m  $silent_n silent stretch(es) > 15s:"
    print -r -- "$sfx_out" | grep 'SILENT' | sed 's/^/      /'
    print -- "  (warning, not a failure -- a quiet beat can be deliberate)"
  fi
fi

print -- "\n\033[1m========================================\033[0m"
if (( FAILED == 0 )); then
  print -- "\033[32mALL STATIC GATES PASS\033[0m -- eligible to render."
  print -- "This says NOTHING about pacing, and nothing about anonymity in frames."
  print -- ""
  print -- "  ROUND=r1 EPID=$EPID SCALE=0.5 ./scripts/render_episode.sh   # grading cut"
  print -- "  ROUND=r1 EPID=$EPID SCALE=0.5 ./scripts/stitch_episode.sh"
  print -- "  ./scripts/measure_pacing.sh <the stitched mp4>             # pacing"
  print -- "  npm run sweep -- <the stitched mp4>                        # anonymity"
  print -- "  video-grader agent on the episode folder                   # the rubric"
  print -- ""
  print -- "And a grader PASS still only earns the human watch."
else
  print -- "\033[31m$FAILED GATE(S) FAILED:\033[0m ${NAMES[*]}"
  print -- "Do NOT render. A render started now measures a cut you already know is broken."
fi
exit $FAILED
