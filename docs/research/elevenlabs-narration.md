# ElevenLabs Multilingual v2 — Operational Narration Rules

**Purpose.** Rules an AI agent follows when converting `script.yaml` into ElevenLabs `eleven_multilingual_v2` input for the **text-to-speech with-timestamps** API. Goal: clean, consistent, correct 6–10 min narration on the **first** generation, minimizing regeneration. Every claim is tagged `[official-docs]`, `[practitioner]`, or `[folklore]` with a source URL.

**Model facts to internalize first:**
- `model_id` default is `eleven_multilingual_v2`. Voice-settings defaults: `stability=0.5`, `similarity_boost=0.75`, `style=0`, `use_speaker_boost=true`, `speed=1.0`. `[official-docs]` https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- `language_code` is **NOT supported for multilingual_v2** — do not send it; rely on written-out text for language cues. `[official-docs]` (same convert ref)
- Multilingual v2 supports SSML `<break>` tags but **NOT dictionary phoneme tags** — only **alias** substitutions. `[official-docs]` https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
- A `seed` param exists (0–4,294,967,295), best-effort deterministic. `[official-docs]` (convert ref)

---

## 1. Text normalization (numbers, symbols, acronyms)

**Golden rule: spell it out.** Official guidance is explicit: "Write numbers, acronyms, dates and symbols fully, in words, in the way that you would like the AI to deliver them." For `$100`, write `a hundred dollars` or `one hundred dollars`. `[official-docs]` https://elevenlabs.io/docs/help-center/product/speech-synthesis/text-to-speech/why-are-numbers-dates-symbols-and-acronyms-not-properly-pronounced-or-spoken-in-the-correct-language

The model's built-in normalizer *usually* handles digits (`123 → one hundred twenty-three`, `100% → one hundred percent`, `$45.67 → forty-five dollars and sixty-seven cents`), but it "can present a challenge... as there are often multiple ways that they could be delivered correctly," and multilingual v2 in particular may misread numbers/symbols/acronyms. `[official-docs]` (best-practices + issues docs). So **the agent pre-normalizes in the script text rather than trusting auto-normalization.** Per-type rules the agent applies:

| Written in script.yaml source | Emit to ElevenLabs as |
|---|---|
| `27.5%` | `twenty-seven point five percent` |
| `six to seven percent` | leave as-is (already words) |
| `$30k` | `thirty thousand dollars` |
| `$1,234.56` | `one thousand two hundred thirty-four dollars and fifty-six cents` `[official-docs]` (best-practices) |
| `2024` (a year) | `twenty twenty-four` |
| `2024–2034` (range) | `twenty twenty-four to twenty thirty-four` |
| `2024-01-01` (date) | `January first, twenty twenty-four` |
| `100km` | `one hundred kilometers` |
| `3.5` | `three point five` |

Ranges and en-dashes are a known misread source — **always replace `–`/`-` between numbers with the word `to`.** `[practitioner]` https://blog.humanizeaudio.com/elevenlabs-narration-quality-review/

**Acronyms / initialisms.** Whether ElevenLabs reads letters vs. a word is arbitrary and voice-dependent. `[official-docs]` (issues doc). Force it explicitly:
- **Read letter-by-letter (initialism):** separate letters with spaces or hyphens — `BLS → B L S`, `QA → Q A`, `API → A P I`, `CS → C S`, `NY Fed → N Y Fed`. `[official-docs]` best-practices; `[practitioner]` https://vidailab.com/guides/elevenlabs-pronunciation-guide/
- **Read as a word:** leave joined and lowercase-ish if you want a word reading (e.g., `NASA` said "nassa" usually reads fine joined). If unreliable, respell phonetically (`naza`). `[practitioner]` (vidailab)
- **`AI`** frequently reads as "eye"/"a" ambiguously — force with `A.I.` or `A I`. `[folklore]` https://medium.com/@v-jur-kh/on-text-markup-for-the-elevenlabs-v3-text-to-speech-2b0a330110e1
- For recurring channel acronyms, prefer a **pronunciation dictionary alias** (Section 3) so the rule is centralized, not repeated inline. `[official-docs]` (best-practices)

**API safety net:** set `apply_text_normalization="on"` (modes: `on` / `off` / `auto`, default `auto`). Because we pre-spell everything, `on` is low-risk and defends against stray digits; it adds latency but that is irrelevant for batch narration. `[official-docs]` (best-practices; convert ref)

---

## 2. Pauses & pacing

**Syntax (v2 supports this):** `<break time="1.5s" />` — self-closing SSML tag, duration in seconds. **Max 3 seconds.** `[official-docs]` https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices

**Hard warning — the single biggest first-gen instability source:** "Using too many break tags in a single generation can cause instability. The AI might speed up, or introduce additional noises or audio artifacts." `[official-docs]` (best-practices; how-can-I-add-pauses)

**Operational limits the agent enforces:**
- **Cap `<break>` at ~1 per ~2–3 sentences**, and prefer punctuation for anything under ~0.5s. `[folklore]` (derived from the overuse warning above)
- Only use `<break>` for **deliberate dramatic beats** (e.g., before a reveal). For ordinary breath/rhythm, use punctuation.
- **Alternatives and their pacing effect** (all "less consistent than break tags" but tag-free, so safer at volume): `[official-docs]` (add-pauses / best-practices)
  - **Comma** — short beat.
  - **Ellipsis `…`** — hesitant, trailing pause; also nudges softer delivery.
  - **Em-dash `—`** — a clean short-to-medium pause; `-- --` yields a longer one.
  - **Line break / new paragraph** — a longer beat; but see the paragraph-boundary phoneme bug in Section 6.

**Rule of thumb:** rhythm should come from sentence construction and punctuation authored in `script.yaml`; reserve `<break>` for a handful of intentional silences per beat.

---

## 3. Pronunciation control

**Multilingual v2 does NOT support phoneme tags.** Dictionary phoneme (IPA/CMU-Arpabet) tags work **only** on `eleven_flash_v2` and `eleven_v3`; "Other models skip dictionary phoneme tags and use the default pronunciation. For other models, use **alias** tags instead." IPA/CMU in non-English languages requires v3. `[official-docs]` https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries

**Therefore, for our v2 pipeline, pronunciation control = aliases + inline respelling.** IPA/`<phoneme>` tags are unavailable to us; do not emit them.

**Pronunciation dictionary (alias) — the durable fix for recurring terms.**
- Format: W3C PLS `.pls` XML (or `.txt`). Case-sensitive matching. `[official-docs]` (best-practices; pronunciation-dictionaries)
- Alias lexeme shape (grapheme → replacement spelling that reads correctly):
  ```xml
  <lexicon alphabet="ipa" xml:lang="en-US">
    <lexeme>
      <grapheme>Kubernetes</grapheme>
      <alias>koo ber net eez</alias>
    </lexeme>
  </lexicon>
  ```
- Apply via `pronunciation_dictionary_locators` (dictionary_id + version_id), **max 3 per request.** `[official-docs]` (pronunciation-dictionaries; convert ref)
- Maintain **one channel-wide alias dictionary** for jargon (Kubernetes, nginx, PostgreSQL, OAuth, JWT, kubectl, etc.) so pronunciation is consistent across every episode.

**Inline respelling — the one-off fallback.** For a term not worth adding to the dictionary, respell it phonetically directly in the narration text (e.g., `nginx → engine x`, `SQL → sequel` or `S Q L`, `cache → cash`). Official guidance for correctness in another language is likewise "write numbers/words out phonetically." `[official-docs]` (issues doc) `[practitioner]` (vidailab). Capitalization, hyphens, apostrophes, and single quotes around letters are all documented respelling levers. `[practitioner]` (vidailab)

---

## 4. Voice settings for consistency across per-beat calls

We generate **each beat as its own API call and concatenate.** The risk is energy/timbre drift between calls. Settings that keep it steady:

- **`stability`**: raise it. Low stability = broader emotional range but "may occasionally sound unstable"; high = "more consistent but potentially monotonous." `[official-docs]` https://elevenlabs.io/docs/api-reference/voices/settings/update. For informative narration use **`stability` 0.5–0.6** as the default; go 0.6+ if you see drift/artifacts, accepting slightly flatter delivery. Audiobook practitioners run ~0.35–0.5 for *cloned* voices to keep life in them. `[practitioner]` https://blog.humanizeaudio.com/elevenlabs-narration-quality-review/
- **`similarity_boost`**: **0.75** (default) up to ~0.8 for cloned voices — this is what pins timbre to the reference and is the main lever against cross-call drift. `[practitioner]` (humanizeaudio) `[official-docs]` (settings/update)
- **`style`**: keep **low, 0–0.2.** Style exaggeration interacts non-linearly with stability and destabilizes consistency; high style + high stability "sounds stiff," and style raises hallucination risk. Set **0** for maximum consistency, ≤0.2 if the delivery is too flat. `[practitioner]` https://www.nassamn.dev/blog/elevenlabs-voice-settings-deep-dive
- **`use_speaker_boost`**: `true`. `[official-docs]` (convert ref)
- **`speed`**: leave **1.0** (range 0.7–1.2; "extreme values may affect quality"). `[official-docs]` (best-practices)

**The critical consistency rule: identical settings on every call.** Voice drift is a known outcome of "regenerat[ing] large segments with different settings." `[practitioner]` https://blog.humanizeaudio.com/elevenlabs-narration-quality-review/ So the agent **freezes one `voice_settings` object for the whole episode** and reuses it for every beat.

**Seeding.** A `seed` (0–4,294,967,295) makes repeated requests "best effort... sample deterministically." `[official-docs]` (convert ref). Use it two ways: (a) **fix one episode-wide seed** across all beats to reduce inter-call variance; (b) when a single beat comes out wrong, **change only that beat's seed** to reroll deterministically without disturbing neighbors. Note "best effort," not guaranteed. `[official-docs]` (convert ref)

**Tradeoff summary:** expressive (low stability / higher style) ↔ consistent (higher stability / style≈0). For a multi-call informative channel, bias toward consistent.

---

## 5. Chunking

- **Per-request cap:** Multilingual v2 accepts **up to 10,000 characters per API request** (~10 min audio). `[practitioner]` https://clarratools.com/elevenlabs-character-limit/ (web UI limits are lower: 2,500 free / 5,000 paid — not our path). A 6–10 min script fits in one request, but we deliberately chunk **per beat** for regeneration granularity and timestamp alignment.
- **Chunk on paragraph/sentence boundaries**, never mid-sentence, to protect prosody. `[practitioner]` (humanizeaudio). Beats already break on natural boundaries — keep it that way.
- **Preserve flow across boundaries with request-stitching params:**
  - **`previous_text` / `next_text`** — pass the adjacent beat's text so the model conditions prosody on surrounding context. `[official-docs]` https://elevenlabs.io/docs/api-reference/text-to-speech/convert
  - **`previous_request_ids` / `next_request_ids`** — pass IDs of already-generated neighbors (**max 3 each**; IDs must be **<2 hours old**) to "maintain voice prosody over multiple chunks." Not available on v3; **works on multilingual v2.** `[official-docs]` https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching
  - **Practical order:** generate beats sequentially; feed each new call the prior beat's `previous_request_id` plus the next beat's raw `next_text`. This is the strongest defense against audible seams at concatenation.
- **With-timestamps interaction:** the with-timestamps endpoint returns character/word alignment for exactly the text you sent. `previous_text`/`next_text` are **context only and are NOT voiced**, so they do **not** appear in that beat's returned timestamps — alignment stays clean and 1:1 with the beat's own words. Overlapping sentences into `previous_text` (as some audiobook workflows do) is therefore safe for timing here. `[official-docs]` (convert ref; request-stitching)

---

## 6. Failure modes to design against

| Failure | Documented cause | Mitigation the agent applies |
|---|---|---|
| **Number / percent / currency / year / range misread** | Ambiguous digit delivery, worse in multilingual v2 | Pre-spell everything as words (Section 1); `apply_text_normalization="on"`. `[official-docs]` (issues; best-practices) |
| **Acronym read as word (or vice versa)** | Arbitrary, voice-dependent | Force with spaced/hyphenated letters or alias dictionary (Sections 1, 3). `[official-docs]` (issues) |
| **Instability: speed-up, noise, artifacts** | **Too many `<break>` tags in one generation** | Cap breaks; use punctuation instead (Section 2). `[official-docs]` (best-practices) |
| **Repeated phoneme at a boundary** | "When switching paragraphs, the model gets the first phoneme of the next paragraph at the end of the paragraph before it." | Chunk per beat so each paragraph is its own request; use request-stitching for flow instead of relying on in-text paragraph breaks. `[official-docs]` https://help.elevenlabs.io/hc/en-us/articles/16102244695185 |
| **Ordinals swapped in lists** ("1." read as "first") | Model "switches numbers for ordinals in lists." | Spell the intended form explicitly (`one`, `two`, or `first`, `second`). `[official-docs]` (issues) |
| **Word mispronounced (esp. exists in another language)** | Multilingual v2 "may rarely mispronounce... words that also appear in other languages." | Alias dictionary or inline phonetic respelling (Section 3). `[official-docs]` (issues) |
| **Hallucinated / repeated / dropped words** | Correlated with long text, high `style`, low `stability` | Keep beats short, `style` low, `stability` ≥0.5; reroll a bad beat with a new `seed`. `[practitioner]` (nassamn; humanizeaudio) |
| **Energy/timbre drift across concatenated calls** | Different settings / no conditioning between calls | Frozen `voice_settings`, fixed episode seed, request stitching (Sections 4–5). `[practitioner]` (humanizeaudio) |
| **Wrong emphasis** | Model can't infer intent from bare text | Author emphasis via sentence structure/punctuation in `script.yaml`; avoid over-tagging. `[official-docs]` (best-practices) |

**Post-generation:** even with all rules applied, master to consistent LUFS across beats before concatenation — settings pin timbre, not absolute loudness. `[practitioner]` (humanizeaudio)

---

### Sources
- https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices `[official-docs]`
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert `[official-docs]`
- https://elevenlabs.io/docs/api-reference/voices/settings/update `[official-docs]`
- https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries `[official-docs]`
- https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching `[official-docs]`
- https://elevenlabs.io/docs/help-center/product/speech-synthesis/text-to-speech/why-are-numbers-dates-symbols-and-acronyms-not-properly-pronounced-or-spoken-in-the-correct-language `[official-docs]`
- https://help.elevenlabs.io/hc/en-us/articles/16102244695185 `[official-docs]`
- https://blog.humanizeaudio.com/elevenlabs-narration-quality-review/ `[practitioner]`
- https://www.nassamn.dev/blog/elevenlabs-voice-settings-deep-dive `[practitioner]`
- https://vidailab.com/guides/elevenlabs-pronunciation-guide/ `[practitioner]`
- https://clarratools.com/elevenlabs-character-limit/ `[practitioner]`
- https://medium.com/@v-jur-kh/on-text-markup-for-the-elevenlabs-v3-text-to-speech-2b0a330110e1 `[folklore]`
