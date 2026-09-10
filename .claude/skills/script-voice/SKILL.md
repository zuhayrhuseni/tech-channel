---
name: script-voice
description: >
  Apply when writing, rewriting, or reviewing narration for script.yaml —
  makes narration sound like a human talking, not AI output. Covers the
  AI-tell audit, rhythm rules, personality placement, humor budget, and the
  performance-cue markup the teleprompter uses. Use for every script before
  it is recorded, and whenever the user says narration "sounds AI".
---

You are shaping narration that one person will read aloud over animation.
Full evidence and sources: `docs/research/script-voice-ai-tells.md` and
`docs/research/script-performance.md`. Mechanics (hooks, budgets, cue
placement): `script-craft.md`. This skill is the taste pass on top of them.

## 1. The AI-tell audit (run on every draft)

Rewrite any paragraph with 3+ co-occurring tells. Never use AI detectors —
audit against this list:

- **Staccato fragment triads** — "Same companies. Same dataset." Keep at
  most one per script, placed for a reveal, never as default cadence.
- **"It's not X, it's Y"** negative parallelism — max one per script.
- **Rule-of-three saturation** — triads are fine; three triads in a row is
  a fingerprint. Break one into two items or four.
- **Signposted recaps** ("So what does this mean?"), **"here's the thing"**,
  "-ing" significance trailers ("...raising questions about") — delete.
- **Uniformity is the master tell.** Per 10 sentences: at least one under
  6 words, at least one over 25, under 70% inside the 12–22-word band.
  Measure it, don't feel it.
- Perfectly resolved paragraphs — leave one thread visibly open; say where
  it gets picked up.

## 2. Sound like a person

- **Telling a friend, not reading a script.** Warm, in-the-moment, reacts to
  what's on screen. A flat, even, monotonous read is a slop tell — vary the
  energy (this is what fixed 002, which "sounded like reading off a script").
- **Always contract, always reduce — global rule, every script.** Never
  `do not / cannot / will not / going to / want to` — always `don't / can't /
  won't / gonna / wanna`. Whenever a phrase *can* shorten, shorten it (`it is →
  it's`, `kind of → kinda`). Long forms read stiff and AI; contractions read
  human. (See `docs/research/PRODUCTION-LESSONS.md`.)
- Write by saying it first; keep the phrasing your mouth chose.
- 1–2 deliberate self-corrections per script ("about forty — actually,
  closer to fifty") — repairs aid comprehension. Never fake "um".
- Hedge with stance, not register: "I'm maybe 70% convinced" — never
  "it is important to consider".
- Specificity with texture: "a 4am page and a $30k AWS bill", not
  "significant costs".
- One earned digression per script, with a marked exit ("anyway —").
- Opinions that could be wrong, stated as yours: 1–2 per episode.
  Personality lives in verb choice, severable asides, and those opinions —
  nowhere else needs it.

## 3. Humor budget

- Default mode: **deadpan**. A flat joke that misses still reads as
  information; a winked joke that misses reads as failure.
- 4–8 jokes per 10 minutes. Never on a key instructional sentence.
- Forms that work in VO: specificity escalation, understatement,
  one act-out max, callbacks — put one callback in the last third.
- A section with no natural joke gets no joke.

## 4. Performance cues (house vocabulary)

Cues go inline in `script.yaml` narration and flow into the teleprompter.
On the v3 pipeline (the channel's shipping path, ep004+) the tone cues are
**real ElevenLabs v3 audio tags** — `make_tts.py --v3` SUBSTITUTES them into
`[excited] / [softly] / [deadpan] / [warmly]` etc., so a `[dry]` you write
actually changes the read. They are no longer decoration or stripped. (On the
v2 fallback the tone cues have no equivalent and are stripped — same markup
either way; only the pipeline differs.) Ten cues, nothing else:

| Cue | Meaning | v3 audio tag |
|---|---|---|
| `/` | short pause (breath-length) | `…` ellipsis |
| `//` | full stop pause, ~1s | `[pause]` |
| `[beat]` | comedic/reveal beat before the next word | `[pause]` |
| `**word**` | the one punch word in the sentence — max one | UPPERCASED word |
| `[dry]` | deadpan delivery until sentence end | `[deadpan]` |
| `[smile]` | audible warmth — use sparingly, ~2 per script | `[warmly]` |
| `[up]` | lift energy — new section, re-hook | `[excited]` |
| `[down]` | drop to quiet-serious | `[softly]` |
| `[breath]` | scripted breath before a long sentence | `…` ellipsis |
| `[say: "post-gres"]` | pronunciation flag | phonetic respelling |

The full v3 tag catalog and the not-over-exaggerated rules (mild tags only,
a few per beat, baseline energy = CAPS + `!` + `…`) live in the
`elevenlabs-narration` skill — consult it when hand-tuning a read. v3 has NO
`<break>` tags; pacing is ellipses and `[pause]`.

Mark the script **while reading aloud** — silent markup is decoration.
Don't over-mark: a cue every sentence flattens all of them. The
**always-contract, always-reduce** rule from §2 still applies to every
script regardless of model.

## 5. Read-aloud QA (before recording)

1. Timing read at ≤155 wpm — over budget means cut, not read faster.
2. Stumble log: three stumbles on a sentence = rewrite it using whatever
   your mouth actually said.
3. Cue pass aloud, then a next-day cold listen at partial attention.

## Output contract

When rewriting a script, return: the rewritten narration blocks (yaml
intact, marks preserved), a tally of tells removed, the sentence-length
distribution before/after, and cue count. When reviewing, return the same
audit without rewriting unless asked.
