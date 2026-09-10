---
name: elevenlabs-narration
description: >
  Apply when generating narration audio from a script via the ElevenLabs
  API (make_tts.py) — the rules that make the clone read a script correctly
  on the FIRST generation, so iteration stays on free text, not paid audio.
  The channel SHIPS on Eleven v3 (make_tts.py --v3; see the "Eleven v3"
  section for the audio-tag catalog + cue→tag map); Multilingual v2 is the
  fallback. Covers number/acronym formatting, pause/break discipline,
  pronunciation, and voice settings. Full evidence:
  docs/research/elevenlabs-narration.md.
---

The goal is a clean one-take generation. Every regenerated beat costs
credits; every formatting rule here is about being right the first time.
`make_tts.py` already applies most of this automatically — this skill is
for when you're hand-checking a script or debugging a bad read.

## Model & settings (Multilingual v2)

- Model `eleven_multilingual_v2` — highest fidelity; latency is irrelevant
  for batch, so never Flash/Turbo.
- Freeze one `voice_settings` for the whole episode: `stability 0.5`,
  `similarity_boost 0.75`, `style 0.0`, `use_speaker_boost true`. Low style
  + mid stability = consistent, non-drifting narration.
- Reuse a fixed `seed` across the episode; only reroll (change seed on) a
  beat that came out bad. Same seed + same text = same read.
- `apply_text_normalization: "on"`. `language_code` is unsupported on v2 —
  don't send it.

## Text formatting (this is where first-gen reads go wrong)

- **Spell numbers, percents, currency, years, ranges out in words.** The
  script-voice/script-craft convention already does this ("twenty-seven and
  a half percent", "twenty twenty-four"). Never leave "27.5%", "$30k",
  "2024–2034" for the model to guess.
- **Ranges: replace the en-dash with the word "to".** "six to seven
  percent", not "six–seven percent".
- **Acronyms are read arbitrarily** — force initialisms with spaced letters:
  `BLS → B L S`, `API → A P I`, `QA → Q A`, `CS → C S`, `NY Fed → N Y Fed`.
  Words-that-are-acronyms read fine as-is (NASA, ChatGPT). make_tts.py holds
  a channel alias map; add new terms there, not per-script.

## Pauses

- `<break time="x.xs" />`, max 3s. **Overusing breaks is the #1 cause of
  first-gen instability** (speed-ups, noise). Prefer punctuation for pacing;
  reserve break tags for deliberate beats. Our cue mapping already limits
  them: `/`→0.35s, `//`→0.9s, `[beat]`→0.5s.

## Pronunciation

- Multilingual v2 does **not** support IPA/phoneme tags — only alias
  dictionaries (`.pls`, max 3 locators) and inline phonetic respelling.
- One-off technical term read wrong: respell it phonetically in the yaml
  with a `[say: "post-gres"]` cue (make_tts substitutes it). Recurring terms
  go in the channel alias dictionary instead.

## Consistency across per-beat calls

- We generate each beat as its own request and stitch them. To stop energy
  drifting between beats, make_tts passes the previous beat's text as
  `previous_text` and the next beat's as `next_text` — this is *context
  only, not voiced*, so the with-timestamps alignment stays 1:1 with the
  beat's own words. Keep that wiring.

## Failure modes → mitigation

| Symptom | Fix |
|---|---|
| Number read wrong | spell it out in the yaml |
| Acronym read as a word (or vice versa) | add to alias map (spaced letters) |
| Speed-up / noise / artifacts | too many break tags — cut them |
| A beat's energy jumps | check previous_text/next_text wiring; reroll seed |
| Recurring word mispronounced | alias dictionary entry |
| One word mispronounced once | `[say: "..."]` inline respelling |

Regenerate only the offending beat (per-beat cache), never the whole script.

## Eleven v3 — expressive tags (ADOPT for published episodes, ep004+)

Decision (2026-09-02): the channel ships the clone by design and the creator
confirmed v3 sounds good, so **publish on `eleven_v3`, not v2.** v3's inline
AUDIO TAGS give real per-phrase emotion (v2 only had one global energy for the
whole read — our tone cues got thrown away). Source:
https://elevenlabs.io/blog/v3-audiotags

**Tag catalog (YouTuber-tuned — passionate, NOT cartoonish):**
- Energy/up (sparingly, on genuine peaks): `[excited] [cheerfully] [happily]
  [playfully] [awe]`
- Deadpan/dry (the channel's default humor): `[deadpan] [flatly] [sarcastic] [dry]`
- Serious/quiet: `[softly] [calm] [whispers] [resigned tone] [tired]`
- Pace: `[rushed] [drawn out] [pause]`
- Reactions (MAX ~1-2 per video): `[sighs] [laughs] [clears throat]`

**Not-over-exaggerated rules (the whole point):**
1. Baseline energy = CAPS (punch words) + `!` + `…`; reserve explicit emotion
   tags for real peaks. Over-tagging = cringe.
2. A few tags per beat, never every sentence. Use MILD tags ([cheerfully] not
   [shouts]; [dry] not [angry]).
3. Stability mode **Natural** (Creative only if you want it looser; Robust
   suppresses tags entirely).
4. The model infers emotion from the WORDS too ("here's the wild part!") — write
   with energy, need fewer tags. The clone must be *able* to do the delivery
   (calm clone won't shout) → an enthusiastic re-clone still helps.

**Map our house cues → v3 tags** (make_tts.py SUBSTITUTES, not strips):
`[up]`→`[excited]` · `[down]`→`[softly]` · `[dry]`→`[deadpan]` · `[smile]`→
`[warmly]` · `**word**`→CAPS (UPPERCASED) · `/`→`…` · `[breath]`→`…` · `//`→
`[pause]` · `[beat]`→`[pause]` (v3 has NO `<break>` tags). The audio tags and
`[pause]` are NOT spoken words and are EXCLUDED from the word list that places
`<mark>` frames — so marks still land on real spoken words only.

**make_tts.py v3 support — IMPLEMENTED (2026-09-02), behind `--v3`:**
`python3 make_tts.py --v3 <episode_dir> <voice_id>`. `MODEL_V3=eleven_v3`;
`tts_text_v3()` + `script_words_v3()` do the substitution above;
stability mode = `Natural`; v2 path (default, no flag) is untouched as the
fallback. TIMING: v3's reliable with-timestamps path is ~2k chars/request, so
`main_v3()` CHUNKS the script on BEAT boundaries (`V3_CHUNK_CHARS=1800`), synths
each chunk, and REASSEMBLES (concat wavs + one loudnorm pass) into one
`narration.draft.wav` + one `timing.json` with cumulative frames — the same
proven logic as make_tts_patch. **Output `timing.json` shape is identical to
v2's, so animation sync is preserved.** No `previous_request_ids` seam control
on v3. `[VERIFY AT TEST]` markers in make_tts.py flag every uncertain v3 API
detail (exact endpoint path, char cap, stability param name/format, response
field names) — run ONE small gen to confirm them before a full episode; the
code is correct-by-construction and does not call the API at author time. See
docs voice-clone-decision + tts-pipeline.
