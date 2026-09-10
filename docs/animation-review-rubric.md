# Animation review rubric

Evidence-based criteria for grading a rendered episode. Used by the
`video-grader` agent — every render must pass this review before human
anonymity review. Sources cited inline; thresholds marked *(folklore)* are
practitioner consensus without measured evidence, applied less strictly.

## Dimensions (0–10 each)

### 1. Sync accuracy — weight 2x
A cue must land **on its word or slightly before, never noticeably after**.
Viewers tolerate video-early ~2–3x better than video-late (ITU-R BT.1359:
detection +45/−125 ms; EBU R37 stricter at +40/−60 ms).
- 9–10: every mark's visual starts within −0/+120 ms of word onset
- 5–6: occasional lag ≤ 185 ms
- 0–2: cues visibly late, or drift that worsens over the video (check the
  last third, not just the first)

### 2. Motion craft
NN/g: <100 ms reads instantaneous, 100–500 ms useful band, >1 s reads as
delay. Material 3: reveals 200–400 ms, emphasized moves ≤600 ms. Linear
easing on position/scale reads mechanical — entrances ease-out, exits
ease-in, state changes ease-in-out.

Also grade **variety** (PLAYBOOK "Variety rules"): count entrance patterns
used; flag any single pattern used >3 elements consecutively, any element
never referenced by narration within ~1s of appearing ("pop-up ad" tell),
and consecutive scenes that are both cards-on-background when a transform
or camera move could connect them.
- 9–10: eased 200–600 ms builds, one primary moving focus at a time, ≥4
  entrance patterns rotated, related elements transform rather than swap
- 5–6: some linear/overlong moves, or one pattern dominating long runs
- 0–2: instant pops, simultaneous competing motion, wall-to-wall card pops

### 3. Readability
BBC subtitle research: ~0.33 s per word minimum dwell, floor ~1 s; diagrams
≥2 s. Text ≥~40 px cap height at 1080p (mobile is the binding constraint).
Keep everything ≥5% from frame edges.

> **SCALE THE MEASUREMENT BEFORE YOU COMPARE IT.** The 40 px floor is defined
> at 1080p, and draft renders are made with `--scale=0.5`, so `full_rNN.mp4`
> is **960x540**. A cap height measured off a draft frame is HALF its true
> value and must be doubled before it is compared to the floor. `ffprobe` the
> file and state its resolution in the report; if it is 960x540, every px
> figure you quote is in 960x540 units until you double it.
>
> This is not hypothetical. The r13 grade reported annotation type at
> "~20 px cap" against the 40 px floor and scored Readability 5/10. The
> element measured **40.7 px at 1080p** — it passed, with margin. Three
> separate fix rounds chased a defect that was an artifact of the grading
> proxy's resolution. Genuine violations existed alongside it (a screenshot
> title at 10.9 px, type crossing the floor mid-retire), which is exactly why
> the artifact survived so long: the finding was half true, so it never
> looked wrong enough to re-derive.
- 9–10: all dwell/size/margin minimums met
- 5–6: isolated misses
- 0–2: unreadable or edge-clipped elements

### 4. Pacing & density
Guo/Kim/Rubin (6.9M MOOC sessions): engagement collapses on slow stretches.
Enforce the `motion-density` skill's **3-second rule**: within any ~3s
window something must enter/move/change/highlight/exit — ambient background
and camera push do NOT count as content motion. A lone number or phrase held
static reads as a "visual podcast," the failure mode this channel rejects.
Count distinct content reveals per beat: a 15s beat needs ~5–7, not one.
- 9–10: content motion every ≤3 s; every data point has its own reveal;
  data beats layer 3–5 popup annotations; elements enter AND exit
- 5–6: static stretches 3–8 s; charts dumped whole or lone hero numbers held
- 0–2: static >8 s; "visual podcast" — one element parked per beat

### 5. Technical delivery — pass/fail gate
YouTube normalizes to ≈ −14 LUFS and only turns volume *down*; quiet masters
stay quiet. Official upload spec: H.264, MP4, ≥8 Mbps at 1080p30, AAC 48 kHz.
- Pass: 1920x1080 @ 30 fps, integrated loudness −14 ±2 LUFS, true peak
  ≤ −1 dBTP, no clipping/clicks at edit points, video ≥8 Mbps or visually
  clean at lower bitrate for flat graphics
- Fail: any of the above out of range → blocks release regardless of score

### 6. Hook strength
YouTube Creator Playbook: first 15 s decisive. Practitioner benchmark:
promise stated by ~7 s, payoff teased by 15 s *(folklore numbers)*.
- 9–10: something on screen or a stated promise within 7 s
- 5–6: promise by 30 s
- 0–2: cold start, long empty open

## Verdict

- **PASS**: technical gate passes AND weighted mean ≥ 7 AND no dimension < 5
- **REVISE**: names the specific frames/beats to fix
- Sync and readability are objective — measure, don't eyeball. Hook and
  pacing drive retention. Report every number you measured, not just scores.

## Anonymity spot-check (blocking, from CLAUDE.md hard rules)

Scan extracted frames for any rendered text: file paths, usernames, employer
references, real credentials. Any hit is an automatic REVISE regardless of
scores.
