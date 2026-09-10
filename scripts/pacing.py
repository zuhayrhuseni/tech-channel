#!/usr/bin/env python3
"""Dead-stretch detection using the EYE-CALIBRATED rule, plus a luma audit.

PROMOTED VERBATIM from episodes/005-cpu-waits-on-memory/out/draft/pacing_r8.py,
which stays in place as the ep005 audit trail. The detector below is
CALIBRATED: every threshold, gate and formula is the one the ep005 rounds were
graded against, and none was changed in the move. Do not retune a constant
without a measured reason and a note in the section that owns it -- the whole
point of the r7/r8/r9/r11/r13 commentary below is that picking a threshold
picks the conclusion.

Don't invoke this by hand. Use `scripts/measure_pacing.sh MP4 EPISODE_DIR`,
which derives the frame count and fps from that episode's timing.json instead
of letting anyone type them. The pipe it builds is:

    ffmpeg -v error -i FINAL -vf "scale=240:135,format=gray" \
      -f rawvideo -pix_fmt gray - \
      | python3 scripts/pacing.py EPISODE/timing.json 18557 30

MUST be a standalone file, never a heredoc: the frame stream owns stdin, so a
`python3 - <<'PY'` heredoc makes the interpreter read raw video bytes as its own
source (fails with "invalid non-printable character U+0013").

WHY r8 REPLACES THE r7 THRESHOLD SWEEP
--------------------------------------
r7 measured the same cut at three area gates and got three different verdicts:

    >= 0.3% of frame :  25 holds > 3s = 16.0% of runtime  (max  6.03s)
    >= 1.0% of frame :  66 holds > 3s = 69.7% of runtime  (max 21.23s)
    >= 2.0% of frame :  57 holds > 3s = 87.6% of runtime

Picking an endpoint chooses the conclusion rather than measuring it. The r7
video-grader resolved this by hand-checking 12 of the flagged holds at full
resolution, and the answer was that BOTH endpoints are wrong, in opposite
directions:

  - the 0.3% gate OVER-credits: it counts a colour desaturation of one table
    cell as a content event
  - the 1.0% gate UNDER-credits badly: it calls CONTINUOUS motion static. Three
    of its top-15 "holds" were beats where something animated every single
    frame -- ticking counters, growing curves. The 21.23s whiteboard_world
    "hold" contained 8 staged reveals and 2 live count-ups.

THE DISCRIMINATOR IS MEDIAN INTER-FRAME INK, NOT EVENT AREA. Measured inside
every genuinely dead hold the median is exactly 0.000%; inside every
live-but-quiet one it is 0.15-0.32%.

    A 3s window is DEAD iff it contains NO >= 0.3%-ink BURST START
    AND its MEDIAN per-frame ink is < 0.05%.

That rule matched the grader's eyes on all 12 spot-checks and yields 36
stretches > 3s = 22.1% of runtime on the r7 cut. Note both halves matter: the
burst-start half catches "nothing new arrived", the median half rescues beats
that are quietly but genuinely moving.

Bursts are MERGED: a run of consecutive over-threshold frames is ONE event, not
one per frame. Counting per-frame inflates a 9-frame entrance into 9 events.

NOT content events at any threshold, each of which has produced a false "this
beat is fine": a count-up digit, a filling progress bar, a character-by-character
typewriter, a camera push / Ken-Burns, b-roll crushed behind a deep scrim, and
the ambient drift layer (measured at 0.07-0.23 luma levels/px -- below
perception; 62% of frames are bit-identical to their predecessor).

THE LUMA AUDIT (section 4) exists because the r7 grade found the ROOT CAUSE of
all of this was CONTRAST, not area: 87.8% of pixels below luma 40, median frame
luma 17, idle geometry at ~1.05:1 against pure black. The detector gates on
|dY| >= 25, so on a luma-17 background an element at luma 40 gives dY=23 -- just
under. Whether a reveal "counts" was being decided by two luma levels. Track
these numbers every round; if they do not move, no amount of enlarging will fix
the pacing table.

r9 -- THE PERCEPTUAL WINDOW, AND THE TWO ROUNDS THIS COST
---------------------------------------------------------
Everything above compares frame i against frame i-1 ONLY. That single choice
made this detector blind to SMOOTH TRANSITIONS, and it sent two consecutive
rounds down blind alleys ("raise contrast", then "enlarge reveals") that each
moved the table by ~nothing.

The arithmetic: a change is only counted where a pixel moves >= 25 luma levels
BETWEEN CONSECUTIVE FRAMES. LatencyLadder's row-bed arming is engineered as a
71-luma step across 11% of frame -- enormous -- but it eases in over `emph` =
18 frames, so it lands ~4 luma per frame and scores EXACTLY 0.000%. Measured on
full_r7.mp4 at f4112-4118, the k=1 gate reads 0.03-0.13% while the same
transition reads 11-20% of frame across a 6-frame window. The gate was
reporting "dead" over a fifth of the screen repainting.

No total contrast and no element size can fix that -- only making the ramp
near-instantaneous can, which would mean grading toward hard cuts and 1-3 frame
pops, i.e. optimising the video INTO the slop it is supposed to avoid. That is
the metric choosing the conclusion again, exactly what the r8 header above
warns about.

So the gate gains a SECOND way to start a burst: a transition that repaints
>= PERCEPT_FRAC of frame across a PERCEPT_K-frame window (~200ms, roughly the
eye's integration time) is an event at the frame it completes on, whatever it
scored frame-to-frame.

PERCEPT_FRAC is calibrated ABOVE the ambient drift layer, which is the one
thing that must never register (see the r4 note below -- drift at a loose gate
masks every static hold). Measured inside six known-dead windows on full_r7,
the k=6 maximum from drift alone tops out at 0.799% of frame; 2.0% leaves 2.5x
headroom. The medians in those same windows stay at 0.000-0.082%, confirming
drift does not accumulate into a false event even over 6 frames.

WHY A BURST START AND NOT A WHOLE-WINDOW RESCUE -- the first r9 attempt got
this wrong and it is worth keeping the wreckage. That version asked "does this
dead stretch CONTAIN a >= 2% k=6 transition?" and dropped the whole stretch if
so. On full_r7 it dropped f3960-4147 -- 6.27s -- on the strength of the L2
arming at f4113. But f3980..f4032 in that same window is 52 consecutive frames
of EXACTLY 0.000% at BOTH k=1 and k=6: four "?" rows and a title, frozen for
1.7s. One real transition at the end of a window says nothing about the middle
of it. Feeding the perceptual gate into `burst_starts` instead makes the
smooth transition mark its own instant and lets the ordinary gap arithmetic
find the freeze on either side of it -- the detector gets more sensitive
without also getting more forgiving.
"""
import sys, json
import numpy as np

TIMING, N, FPS = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
W, H = 240, 135
FRAME = W * H
LUMA_TH = 25          # a pixel must move >= 25 luma levels to count as changed
BURST_FRAC = 0.003    # 0.3% of frame -- what counts as a burst START
MEDIAN_DEAD = 0.0005  # 0.05% -- below this median, the window is not moving
HOLD_S = 3.0
MINF = int(HOLD_S * FPS)

# The perceptual window (r9). See the docstring section. PERCEPT_K is ~200ms at
# 30fps -- about the eye's integration time, and long enough to contain a house
# entrance (ENTRANCE_MAX_FRAMES = 9) most of the way. PERCEPT_FRAC sits 2.5x
# above the measured drift ceiling so the drift layer can never rescue a window.
PERCEPT_K = 6
PERCEPT_FRAC = 0.02

# Luma audit thresholds (the D1 root-cause tracker).
DARK_TH, BRIGHT_TH = 40, 150

# r11 -- THE TWO METRICS THIS FILE COULD NOT EXPRESS, AND WHY THEY ARE HERE.
#
# The r10 grade PASSed this detector's headline number (0 dead stretches, 0.0%
# of runtime) and still returned REVISE at 6.71, on two measurements it made
# that this file structurally cannot make:
#
#   1. GAP WITHOUT THE CARVE-OUT. `dead_stretches()` pardons any window whose
#      MEDIAN inter-frame ink clears 0.05%. That carve-out was added in r8 for a
#      real reason (it rescues beats that are quietly but genuinely moving) and
#      it is also a LOOPHOLE: a bed-tint ramp, a crawling progress bar or a
#      count-up digit keeps median ink alive frame after frame while the screen
#      reads FROZEN. Same cut, carve-out removed: 15 gaps > 3s = 8.7% of
#      runtime, max 5.47s. Both numbers are true; they answer different
#      questions, so print BOTH and never let the generous one stand alone.
#
#   2. EMPTY, WHICH IS NOT FROZEN. Every metric above is a DIFFERENCE metric --
#      it asks what changed. A frame holding one 8px caption on black changes
#      nothing and also SHOWS nothing, and the second failure is the one the eye
#      calls slop. Measured as: fraction of frame at luma >= EMPTY_LUMA. Under
#      EMPTY_FRAC for >= EMPTY_S seconds is an empty run. r10: 13 runs = 9.8% of
#      runtime, worst 8.20s.
#
# Thresholds are the grader's, kept verbatim so the two instruments are
# comparable. It sampled at 320x180 and this file at 240x135; on flat regions
# the two agree to well inside a tenth of a percent, and the pooling difference
# only matters for thin strokes, which are below both gates either way.
EMPTY_LUMA = 110      # what counts as "something is actually lit here"
EMPTY_FRAC = 0.01     # under 1% of frame lit == the screen is empty
EMPTY_S = 2.0

from collections import deque

prev = None
hist = deque(maxlen=PERCEPT_K + 1)  # ring buffer for the perceptual window
frac_k = []      # frac_k[i] = fraction changed vs PERCEPT_K frames earlier
frac = []        # frac[i] = fraction of pixels changed between frame i and i+1
mean_luma = []   # per-frame mean luma
dark_frac = []   # per-frame fraction of pixels below DARK_TH
bright_frac = [] # per-frame fraction of pixels above BRIGHT_TH
lit_frac = []    # per-frame fraction of pixels at/above EMPTY_LUMA (section 6)
buf = sys.stdin.buffer
while True:
    b = buf.read(FRAME)
    if len(b) < FRAME:
        break
    cur = np.frombuffer(b, dtype=np.uint8)
    mean_luma.append(float(cur.mean()))
    dark_frac.append(float(np.count_nonzero(cur < DARK_TH)) / FRAME)
    bright_frac.append(float(np.count_nonzero(cur > BRIGHT_TH)) / FRAME)
    lit_frac.append(float(np.count_nonzero(cur >= EMPTY_LUMA)) / FRAME)
    c16 = cur.astype(np.int16)
    if prev is not None:
        frac.append(float(np.count_nonzero(np.abs(c16 - prev) >= LUMA_TH)) / FRAME)
        # Same index as `frac` (the transition ARRIVING at this frame), but
        # measured against the frame PERCEPT_K back, so a smooth ramp is scored
        # by what it accomplished rather than by its per-frame slice. Zero until
        # the history fills, which only ever makes the rescue more conservative.
        if len(hist) > PERCEPT_K:
            frac_k.append(
                float(np.count_nonzero(np.abs(c16 - hist[0]) >= LUMA_TH)) / FRAME
            )
        else:
            frac_k.append(0.0)
    hist.append(c16)
    prev = c16

n = len(frac) + 1
secs = n / FPS
print(f"frames decoded: {n} (expected {N})")
if n != N:
    print(f"  *** WARNING: decoded {n}, expected {N} -- results are NOT valid ***")

# ---- 1. merged bursts ------------------------------------------------------
# Two ways in, OR'd: the frame-to-frame gate (a pop) and the perceptual window
# (a smooth ramp that gets there in ~200ms). The second exists because the
# first scores an 18-frame ease of 11% of the screen at 0.000%; see the r9
# docstring section.
over_1 = [f >= BURST_FRAC for f in frac]
over_k = [f >= PERCEPT_FRAC for f in frac_k]
over = [a or b for a, b in zip(over_1, over_k)]
burst_starts = [i for i, e in enumerate(over) if e and (i == 0 or not over[i - 1])]
burst_ends = [i for i, e in enumerate(over)
              if e and (i == len(over) - 1 or not over[i + 1])]
k_only = [i for i in burst_starts if not over_1[i]]
print()
print(f"gate: |dY| >= {LUMA_TH} luma @ {W}x{H}; burst start >= {BURST_FRAC*100:.1f}% of frame "
      f"in 1f OR >= {PERCEPT_FRAC*100:.1f}% in {PERCEPT_K}f")
print(f"  merged bursts: {len(burst_starts)} = {len(burst_starts)/secs*10:.2f} per 10s")
print(f"  (raw over-threshold frames: {sum(over)} -- NOT the event count)")
print(f"  of those, {len(k_only)} were found ONLY by the {PERCEPT_K}f perceptual window "
      f"-- smooth transitions the 1f gate scores at ~0")
print("  (PRODUCTION-LESSONS wants something new every 2-3s => >= 3.3-5.0 per 10s)")

print()
print(f"median inter-frame ink: {np.median(frac)*100:.4f}%  "
      f"p90={np.percentile(frac,90)*100:.4f}%  p99={np.percentile(frac,99)*100:.4f}%")
frozen = sum(1 for f in frac if f == 0.0)
print(f"  frames bit-identical to predecessor: {frozen}/{len(frac)} "
      f"({frozen/len(frac)*100:.1f}%)  -- ambient drift is NOT motion")


# ---- 2. dead stretches, calibrated rule ------------------------------------
def dead_stretches():
    """Windows between burst RUNS that are long AND not moving.

    The perceptual window is not applied here -- it is applied upstream, where
    it contributes burst starts of its own, so a smooth transition splits the
    gap it lands in instead of excusing the whole gap. The r9 docstring section
    explains why the first version of this got that backwards and pardoned a
    1.7s freeze.

    BETWEEN RUNS, not between starts -- the second r9 correction. A burst is a
    RUN of over-threshold frames and only its first frame is in `burst_starts`,
    so measuring gaps start-to-start counted the INSIDE of every long burst as
    dead time. That was invisible while bursts were 1-3 frames of k=1 pops, and
    became load-bearing the moment the 6-frame window started holding frames
    over threshold for the length of a transition: the table reported a 5.03s
    freeze at f3960-4110 whose own peak-6f column read 11.51%, i.e. it was
    calling a window dead and printing the proof it wasn't in the next column.

    `alive` is the fraction of the window with ANY detectable motion at the 6f
    scale. It splits the fix in two: a window that is mostly alive contains one
    move that crawls (shorten the ramp toward ENTRANCE_MAX_FRAMES); a window
    that is mostly not contains nothing (stage a new sub-reveal).
    """
    out = []
    gaps = list(zip([-1] + burst_ends, burst_starts + [len(frac)]))
    for e, s in gaps:
        a, z = e + 1, s - 1           # inclusive window with no content event
        ln = z - a + 1
        if ln <= MINF:
            continue
        med = float(np.median(frac[a:z + 1]))
        if med >= MEDIAN_DEAD:
            continue
        seg = frac_k[a:z + 1]
        pk = float(np.max(seg)) if seg else 0.0
        alive = (sum(1 for f in seg if f >= BURST_FRAC) / len(seg)) if seg else 0.0
        out.append((a, z, ln, med, pk, alive))
    return out


dead = dead_stretches()
held = sum(d[2] for d in dead)
beats = json.load(open(TIMING))['beats']


def beat_of(f):
    nm = "?"
    for b in beats:
        if b['startFrame'] <= f:
            nm = b['id']
        else:
            break
    return nm


print()
print(f"=== DEAD STRETCHES > {HOLD_S}s (calibrated: no burst start AND median "
      f"ink < {MEDIAN_DEAD*100:.2f}%) ===")
print(f"    count={len(dead)}, {held} frames = {held/n*100:.1f}% of runtime")
print(f"    r7 baseline for comparison: 36 stretches, 22.1% of runtime, max 6.13s")
print(f"{'#':>3} {'frames':>14} {'t_start':>9} {'secs':>7} {'med ink':>9} "
      f"{'peak 6f':>8} {'alive':>6}  {'kind':<9} {'beat':<24}")
for k, (a, z, ln, med, pk, alive) in enumerate(sorted(dead, key=lambda x: -x[2]), 1):
    # TOO SLOW: something is moving through most of the window, just never
    # enough in any 6 frames to register. Shorten that ramp toward
    # ENTRANCE_MAX_FRAMES (9); do NOT pile another reveal on top of it.
    # TOO EMPTY: the window is genuinely still. Stage a new sub-reveal.
    kind = "too slow" if alive >= 0.5 else "too empty"
    print(f"{k:>3} {f'{a}-{z}':>14} {a/FPS:>8.2f}s {ln/FPS:>6.2f}s "
          f"{med*100:>8.3f}% {pk*100:>7.2f}% {alive*100:>5.0f}%  "
          f"{kind:<9} {beat_of(a):<24}")
if not dead:
    print("  none -- no dead stretch exceeds 3s. THIS IS THE TARGET.")

# ---- 2b. the same gaps WITHOUT the median carve-out (r11) -------------------
# Identical window construction to dead_stretches(), minus the `med >=
# MEDIAN_DEAD: continue` pardon. This is the strict reading: "no content event
# arrived for over 3 seconds", full stop, regardless of whether something was
# crawling underneath. Section 2 is the eye-calibrated number; THIS is the
# unforgiving one, and a round is not finished until both are small.
#
# It ALSO drops the 6-frame perceptual window and gates on the 1-frame reading
# alone. That second change is what makes this section worth printing: with the
# window OR'd in and only the carve-out removed, the metric read count=0 on the
# r10 cut -- vacuously equal to section 2, because the window is what was
# rescuing those windows, not the median. The grader's 15 gaps are 15 places
# where the ONLY thing that arrived in three seconds was a smooth ramp. Section
# 2 is right that a ramp is motion; this section is right that a beat made
# entirely of ramps has no beats in it.
s1_starts = [i for i, e in enumerate(over_1) if e and (i == 0 or not over_1[i - 1])]
s1_ends = [i for i, e in enumerate(over_1)
           if e and (i == len(over_1) - 1 or not over_1[i + 1])]
strict = []
for e, s in zip([-1] + s1_ends, s1_starts + [len(frac)]):
    a, z = e + 1, s - 1
    ln = z - a + 1
    if ln <= MINF:
        continue
    med = float(np.median(frac[a:z + 1]))
    strict.append((a, z, ln, med, med < MEDIAN_DEAD))
sheld = sum(x[2] for x in strict)
print()
print(f"=== STRICT GAPS > {HOLD_S}s (1f gate only, no carve-out -- grader's metric) ===")
print(f"    count={len(strict)}, {sheld} frames = {sheld/n*100:.1f}% of runtime")
print(f"    r10 baseline: 15 gaps, 1616 frames = 8.7% of runtime, max 5.47s")
print(f"{'#':>3} {'frames':>14} {'t_start':>9} {'secs':>7} {'med ink':>9} "
      f"{'carved':>7}  {'beat':<24}")
for k, (a, z, ln, med, carved) in enumerate(
        sorted(strict, key=lambda x: -x[2])[:20], 1):
    print(f"{k:>3} {f'{a}-{z}':>14} {a/FPS:>8.2f}s {ln/FPS:>6.2f}s "
          f"{med*100:>8.3f}% {'-' if carved else 'no':>7}  {beat_of(a):<24}")
if not strict:
    print("  none -- no gap between content events exceeds 3s at all.")

# ---- 2d. MAJOR events (r13) -- THE GATE THIS FILE WAS TOO GENEROUS TO HAVE --
#
# WHY THIS SECTION EXISTS, AND WHY IT IS THE ONE TO AUTHOR AGAINST NOW.
#
# On the r13 cut every number above came out at target: 0 dead stretches, 0
# empty runs, 11.32 bursts/10s against a 3.3-5.0 floor, 15/15 beats passing.
# The grade still came back REVISE, on a measurement this file could not make:
# at a MAJOR-event gate the same cut has 18 gaps > 5s = 22.7% of runtime, the
# worst 14.33s. Both readings are true. They differ because BURST_FRAC (0.3%)
# was calibrated to answer "is this frame DEAD?", and we have been reading it
# as though it answered "did something HAPPEN?" -- so a caption typing on, a
# count-up digit, or a 2%-of-frame chip all score as a content event while the
# beat they sit in reads frozen to a person.
#
# This is the same failure the header describes one level up: the r8 carve-out
# was a real fix that became a loophole. 0.3% is a real floor that became a
# ceiling nobody had to clear. The house rule is "something NEW every 2-3s",
# and a 0.3% repaint is not something new -- it is something twitching.
#
# The thresholds are the r13 grader's, kept verbatim so the two instruments
# stay comparable (as with EMPTY_LUMA above):
#   MAJOR_1F   1% of frame in a single frame   -- a real arrival, not a chip
#   MAJOR_K    5% of frame within PERCEPT_K    -- a real repaint/transition
# and the gap bar is 5s rather than 3s, because a major event is a coarser
# thing than a content event and holding one idea for 3s is legitimate.
#
# DO NOT "fix" a major gap by inflating a caption to 1% of frame. That is the
# same mistake that produced this section. Fix it with a discrete ARRIVAL: a
# card landing, a lane recolouring in one wipe, a group of elements docking. If
# a beat cannot carry one every 5s, the beat is too long for its content.
MAJOR_1F = 0.01
MAJOR_K = 0.05
MAJOR_S = 5.0
MAJOR_MINF = int(MAJOR_S * FPS)
maj = [(a >= MAJOR_1F) or (b >= MAJOR_K) for a, b in zip(frac, frac_k)]
m_starts = [i for i, e in enumerate(maj) if e and (i == 0 or not maj[i - 1])]
m_ends = [i for i, e in enumerate(maj)
          if e and (i == len(maj) - 1 or not maj[i + 1])]
major = []
for e, s in zip([-1] + m_ends, m_starts + [len(frac)]):
    a, z = e + 1, s - 1
    ln = z - a + 1
    if ln > MAJOR_MINF:
        major.append((a, z, ln))
mheld = sum(x[2] for x in major)
print()
print(f"=== MAJOR-EVENT GAPS > {MAJOR_S}s (>= {MAJOR_1F*100:.0f}% in 1f OR "
      f">= {MAJOR_K*100:.0f}% in {PERCEPT_K}f) ===")
print(f"    major events: {len(m_starts)} = {len(m_starts)/secs*10:.2f} per 10s")
print(f"    count={len(major)}, {mheld} frames = {mheld/n*100:.1f}% of runtime")
print(f"    r13 baseline (the round this gate was added): 18 gaps, 22.7% of "
      f"runtime, worst 14.33s")
print(f"{'#':>3} {'frames':>14} {'t_start':>9} {'secs':>7}  {'beat':<24}")
for k, (a, z, ln) in enumerate(sorted(major, key=lambda x: -x[2])[:25], 1):
    print(f"{k:>3} {f'{a}-{z}':>14} {a/FPS:>8.2f}s {ln/FPS:>6.2f}s  {beat_of(a):<24}")
if not major:
    print("  none -- a major event lands at least every 5s. THIS IS THE TARGET.")

# ---- 2c. EMPTY runs -- not frozen, empty (r11) ------------------------------
# See the header note on EMPTY_LUMA. A difference metric cannot see this: a
# screen holding one dim caption is not changing AND not showing anything, and
# only the second half is what the eye calls dead.
EMPTY_MINF = int(EMPTY_S * FPS)
empty = []
run_start = None
for i, lf in enumerate(lit_frac):
    if lf < EMPTY_FRAC:
        if run_start is None:
            run_start = i
    elif run_start is not None:
        if i - run_start >= EMPTY_MINF:
            empty.append((run_start, i - 1, i - run_start))
        run_start = None
if run_start is not None and len(lit_frac) - run_start >= EMPTY_MINF:
    empty.append((run_start, len(lit_frac) - 1, len(lit_frac) - run_start))
eheld = sum(x[2] for x in empty)
print()
print(f"=== EMPTY RUNS >= {EMPTY_S}s (< {EMPTY_FRAC*100:.0f}% of frame at luma "
      f">= {EMPTY_LUMA}) ===")
print(f"    count={len(empty)}, {eheld} frames = {eheld/n*100:.1f}% of runtime")
print(f"    r10 baseline: 13 runs, 1827 frames = 9.8% of runtime, worst 8.20s")
print(f"{'#':>3} {'frames':>14} {'t_start':>9} {'secs':>7} {'mean lit':>9}  {'beat':<24}")
for k, (a, z, ln) in enumerate(sorted(empty, key=lambda x: -x[2])[:20], 1):
    print(f"{k:>3} {f'{a}-{z}':>14} {a/FPS:>8.2f}s {ln/FPS:>6.2f}s "
          f"{np.mean(lit_frac[a:z+1])*100:>8.2f}%  {beat_of(a):<24}")
if not empty:
    print("  none -- the frame always carries lit content. THIS IS THE TARGET.")
print(f"  median per-frame lit area: {np.median(lit_frac)*100:.2f}% "
      f"(p10={np.percentile(lit_frac,10)*100:.2f}%)")

# ---- 3. per-beat -----------------------------------------------------------
print()
print("=== per-beat (merged bursts + worst dead stretch, calibrated rule) ===")
print(f"{'#':>3} {'id':<24} {'frames':>13} {'secs':>7} {'ev':>4} {'ev/10s':>7} "
      f"{'dead%':>7} {'maxdead':>8} {'strict%':>8} {'empty%':>7} {'lit':>6} "
      f"{'verdict':>8}")
worst = []
for i, bt in enumerate(beats):
    a = bt['startFrame']
    z = beats[i + 1]['startFrame'] if i + 1 < len(beats) else n
    if z - 1 <= a:
        print(f"{i+1:>3} {bt['id']:<24} {'NO FRAMES':>13}   *** NOT MEASURED ***")
        worst.append(bt['id'] + "(unmeasured)")
        continue
    bsecs = (z - a) / FPS
    ev = sum(1 for b in burst_starts if a <= b < z)
    seg = [d for d in dead if d[0] < z and d[1] >= a]
    dfr = sum(min(d[1], z - 1) - max(d[0], a) + 1 for d in seg)
    mx = max((min(d[1], z - 1) - max(d[0], a) + 1 for d in seg), default=0)
    rate = ev / bsecs * 10
    sfr = sum(min(d[1], z - 1) - max(d[0], a) + 1
              for d in strict if d[0] < z and d[1] >= a)
    efr = sum(min(d[1], z - 1) - max(d[0], a) + 1
              for d in empty if d[0] < z and d[1] >= a)
    lit = float(np.median(lit_frac[a:z])) * 100
    # A beat is only OK if it clears BOTH readings plus the empty bar. The
    # strict cap is deliberately looser than the calibrated one (a smooth ramp
    # that the eye reads as motion legitimately shows up here), but a beat
    # spending over a fifth of itself with no content event at all is not fine.
    ok = rate >= 3.3 and mx <= MINF and sfr / (z - a) < 0.20 and efr / (z - a) < 0.10
    if not ok:
        worst.append(bt['id'])
    print(f"{i+1:>3} {bt['id']:<24} {f'{a}-{z-1}':>13} {bsecs:>6.1f}s {ev:>4} "
          f"{rate:>7.2f} {dfr/(z-a)*100:>6.0f}% {mx/FPS:>7.2f}s "
          f"{sfr/(z-a)*100:>7.0f}% {efr/(z-a)*100:>6.0f}% {lit:>5.1f}% "
          f"{'OK' if ok else 'SLOW':>8}")
print()
print(f"beats meeting the pacing floor: {len(beats)-len(worst)}/{len(beats)}")
if worst:
    print(f"SLOW BEATS: {worst}")

# ---- 4. luma audit (the D1 root-cause tracker) -----------------------------
print()
print("=== LUMA AUDIT -- the r7 root cause. Track every round. ===")
allpx_dark = float(np.mean(dark_frac)) * 100
allpx_bright = float(np.mean(bright_frac)) * 100
print(f"  pixels below luma {DARK_TH}: {allpx_dark:.1f}%   "
      f"(r7 baseline 87.8% -- MUST COME DOWN)")
print(f"  pixels above luma {BRIGHT_TH}: {allpx_bright:.1f}%  "
      f"(r7 baseline 3.0% -- should come up)")
print(f"  median per-frame mean luma: {np.median(mean_luma):.1f}  "
      f"(r7 baseline 24.5)")
print(f"  darkest frame mean luma: {min(mean_luma):.1f} @ f{int(np.argmin(mean_luma))}"
      f"   brightest: {max(mean_luma):.1f} @ f{int(np.argmax(mean_luma))}")
if allpx_dark > 80:
    print("  *** the frame is still very dark: check idle structure clears 3:1 ***")
    # The line that used to sit here -- "Enlarging reveals will NOT fix the
    # pacing table. Fix contrast first." -- was WRONG, and it was printed as a
    # verdict on every run, so two rounds acted on it. r8 raised contrast to the
    # 3:1 floor and r7 enlarged ~30 reveals; between them the dead table moved
    # 31 -> 17 stretches but 11 beats stayed SLOW, because the blocker was
    # neither: it was this detector's k=1 window scoring smooth ramps at
    # 0.000%. Darkness is worth tracking on its own merits -- it is not a
    # diagnosis of the pacing table. Read the `kind` column of the dead table
    # before concluding anything about a stretch: "too slow" and "too empty"
    # take opposite fixes.
