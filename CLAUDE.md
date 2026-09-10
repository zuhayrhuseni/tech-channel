# Tech channel — video production

Long-form informative tech videos: engineering concepts, industry analysis, and breaking into big tech. Audience is early-career and aspiring engineers.

Editorial direction lives in `docs/channel-brief.md`. Read it before writing, reviewing, or annotating any script.

## Layout

```
episodes/NNN-slug/
  script.md      hand-authored: narration + inline visual cues
  voice.wav      hand-authored: raw recording
  audio.wav      generated: normalized 16kHz mono
  words.json     generated: word-level timestamps
  props.json     generated: resolved cue timeline
  out.mp4        generated: final render

src/components/  Remotion component library
src/Root.tsx     composition registry
```

Only `script.md` and `voice.wav` are written by hand. Everything else is generated — never hand-edit a generated file, fix the source and re-run. If a render looks wrong, the bug is in the script, the components, or the pipeline, never in `props.json`.

## Hard rules

These apply to every script, on-screen element, and asset. Treat a violation as a blocking error, not a style note — rules 1 through 3 protect the creator's anonymity and employment.

1. **Never state or display the creator's real name.** The channel is pseudonymous. This includes file paths visible in terminal recordings and screenshots: `/Users/firstnamelastname/` leaks identity as surely as a title card. Use a neutral path in every capture.

2. **Never reference the creator's employer**, its internal systems, tooling, architecture, incidents, or codebases. Every example must come from public documentation or public companies. If a point can only be made with insider knowledge, cut the point — there is always a public equivalent.

3. **Never show real credentials, tokens, API keys, internal hostnames, or customer data** in any screenshot or terminal capture. Use obviously fake values.

4. **Flag rather than invent.** If a script makes a factual claim that can't be verified against a public source, mark it `[VERIFY: claim]` rather than asserting it confidently. A wrong confident claim on a tech channel is expensive to walk back.

## Workflow

The full end-to-end production workflow (script → record → edit → animate → publish) is:

@instructions-for-me/how-to-make-a-video.md

Production rules distilled from the research corpus (full docs with evidence
and sources live in `docs/research/`):

@docs/research/PLAYBOOK.md

Battle-tested refinements proven making episode 003 through many
render/grade/rework cycles — these go beyond the corpus and, on conflict,
win (they were proven against a real cut, not derived). Read before scripting,
animating, sound-designing, or rendering any episode:

@docs/research/PRODUCTION-LESSONS.md

PRODUCTION-LESSONS is the *diagnostic* record — what failed on ep003/ep005 and
why. The file below is the *prescriptive* one: the order of operations and the
author-time arithmetic that let ep006 hit ep005's quality bar in **two renders
instead of fifteen**. Episode 005 took two days because every gate was written
reactively, after the defect it catches had already burned a round; all eleven
now exist and run in ~2 minutes before any render. Read this before animating:

@docs/research/ONE-SHOT-RECIPE.md

- Writing or rewriting narration → use the `script-voice` skill (AI-tell
  audit, rhythm rules, humor budget, performance-cue markup)
- **Before any render (mandatory):** `EPID=eNNN ./scripts/gates.sh` must be
  green. Eleven static gates, no pixels. A render started on a red board
  measures a cut you already know is broken and takes 40 minutes to say so.
- **Before recording (mandatory):** run the `script-grader` agent on
  script.yaml. REVISE verdicts get rewritten before any recording session.
- Placing visual cues in a script → use the `annotate-script` skill
- Rendering an episode → use the `make-video` skill
- **After every render (mandatory):** run the `video-grader` agent on the
  episode folder. It grades against `docs/animation-review-rubric.md` and
  returns PASS or REVISE. A render is not done until it passes; fix the
  named defects and re-run. This precedes (never replaces) the human
  anonymity review.

## Conventions

- 1920x1080, 30fps
- Episode directories are zero-padded and slugged: `episodes/007-tls-handshake/`
- Components are registered in `src/components/index.ts`. Read it before creating a new component — the one you need may exist under a different name.
