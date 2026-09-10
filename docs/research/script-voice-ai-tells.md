# AI tells in narration scripts — a checkable rule list

Research notes for writing and auditing voiceover scripts that will be read aloud by a real person.
Every claim is labeled **[study]** (peer-reviewed or quantitative), **[practitioner]** (working editors, broadcast trainers, community-curated catalogs), or **[folklore]** (forum belief; may or may not match the data). Where the detector literature disagrees with folk beliefs, that's called out explicitly.

**How to use this file:** when auditing a script, run the T-rules (tells) as pattern checks, then the S-rules (spoken register), R-rules (rhythm), and H-rules (humanizing) as rewrite guidance. A single hit on any rule is not a failure — the science is clear that these are *density and uniformity* signals, not fingerprints. Three or more co-occurring tells in one paragraph is a rewrite trigger.

**The one-sentence version of the science:** LLM text is distinguishable not by any single word or mark but by *uniformity* — tight clustering of sentence length, low vocabulary variance, and the same rhetorical moves recurring at fixed intervals. Humans are messier on every measured axis. [study] ([Muñoz-Ortiz et al., "Contrasting Linguistic Patterns in Human and LLM-Generated News Text"](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422446/); [Nature HSSC stylometric comparison of creative writing](https://www.nature.com/articles/s41599-025-05986-3)). Note also: untrained humans detect AI text at roughly chance; only heavy LLM users reach ~90% accuracy. [study, via [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)] So the audience "just knows" mostly through accumulated density of the tells below, not conscious detection.

---

## Part 1 — The AI-tell catalog (T-rules)

### T1. Negative parallelism: "It's not X, it's Y"
The single most commonly identified AI tell in community catalogs. Variants: "It's not just a tool, it's a movement"; "Not X. Not Y. Just Z."; "no fees, no lock-in, just growth." It sets up a contrast that corrects a misconception nobody had. [practitioner] ([tropes.fyi](https://tropes.fyi/) ranks it #1; [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)).
**Why it reads AI:** it manufactures profundity from structure alone; used at density it becomes a metronome.
**Human fix:** state the actual claim. If the contrast is real, name who holds the wrong view and why. One per script, maximum, and only when a real misconception exists.

### T2. Staccato fragment triads for fake drama
"Same companies. Same dataset. Different answer." / "Traffic dropped 40% overnight. Rankings disappeared. The client called." AI deploys standalone fragments as manufactured emphasis, usually in threes, usually at section ends. [practitioner] ([tropes.fyi](https://tropes.fyi/) "Short Punchy Fragments"; [Hiration AI-slop analysis](https://www.hiration.com/blog/ai-slop-linkedin/)).
**Why it reads AI:** the pattern recurs at fixed intervals — every section gets its thriller beat. Humans use the high-low move (long sentence, then one short punch) *occasionally and asymmetrically*. [practitioner] ([oliviacal.com AI writing tells](https://www.oliviacal.com/post/ai-writing-tells)).
**Spoken caveat:** fragments genuinely work aloud (see S3). The tell is *regularity*: three fragments in a row, more than once per script, always as a landing. Budget: one fragment-cluster per ~500 words, never twice in the same shape.

### T3. Rule-of-three saturation
"Innovative, transformative, and groundbreaking." Tricolons in every paragraph — adjective triples, three parallel clauses, three-item lists — used to make thin analysis look comprehensive. [practitioner] ([Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing); [tropes.fyi](https://tropes.fyi/)).
**Human fix:** lists of two and four exist. Or one item, examined properly. Audit check: count triples; more than ~2 per 1,000 words of narration is a flag.

### T4. Em-dash density — a real but *weak* signal (folklore overcorrects)
Folk belief says em dashes = AI. [folklore] (HN commenter: "the em dash is now a GPT-ism," via [akerink.com](https://akerink.com/blog/defending-the-em-dash-ai-overused/); [Washington Post coverage](https://www.washingtonpost.com/technology/2025/04/09/ai-em-dash-writing-punctuation-chatgpt/)). The measurements disagree: GPT-4.1 ≈ 10.6 em dashes per 1,000 words vs. a human control of ≈ 3.2 — but Twain ran 10.1 and Melville 8.1, and Gemini 2.5 ran only 3.5. "A weak signal, not a fingerprint." [practitioner, with data] ([SlopDetector dash-density measurement](https://slopdetector.org/blog/em-dash-ai-tell-data); [The Ringer](https://www.theringer.com/2025/08/20/pop-culture/em-dash-use-ai-artificial-intelligence-chatgpt-google-gemini)). What *is* diagnostic is em dashes used formulaically — punching up parallelisms where a comma or period would do. [practitioner] ([Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)).
**For VO this is nearly moot:** dashes are inaudible. What survives aloud is the *rhythm* they encode — the constant mid-sentence dramatic aside. Cap parenthetical asides at ~1 per paragraph; don't ban the mark.

### T5. AI vocabulary clusters
"Delve, leverage, robust, crucial, pivotal, landscape, tapestry, testament, underscore, foster, seamless, meticulous, boasts, vibrant, showcase, realm, myriad, plethora." One of these is nothing; four in a paragraph is a flag. Note the list *drifts by model generation* — by mid-2025 the heavy offenders narrowed to "emphasizing, enhance, highlighting, showcasing" — so maintain the kill-list, don't memorize it. [practitioner] ([Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) tracks the drift; [oliviacal blacklist](https://www.oliviacal.com/post/ai-writing-tells)).
**Human fix:** the "pub test" — would you say this word to a colleague over a beer? "Use" not "leverage," "look at" not "delve into." [practitioner] ([oliviacal](https://www.oliviacal.com/post/ai-writing-tells)).

### T6. Copula-dodging
Replacing "is/has" with "serves as, stands as, functions as, represents, boasts, features." "The cache serves as a buffer" → "the cache is a buffer." [practitioner] ([Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing); [tropes.fyi](https://tropes.fyi/) "The Serves-As Dodge"). Related [study] finding: LLMs use auxiliary verbs far more than humans (5.4–6.0% of tokens vs 3.8%) ([Muñoz-Ortiz et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422446/)). Plain "is" is the human move.

### T7. Significance inflation and "-ing" trailers
Every fact gets a dangling participle assigning it meaning: "…, highlighting the importance of observability," "…, marking a pivotal moment," "…, underscoring the need for." Also grandiose stakes: everything is a turning point in an evolving landscape. [practitioner] ([Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) "superficial analysis"; [tropes.fyi](https://tropes.fyi/) "Grandiose Stakes Inflation").
**Human fix:** facts earn significance from what follows them, not from an appended clause. Delete the trailer; if the point mattered, say *why* in its own sentence with a concrete consequence.

### T8. Hedging throat-clearing and signposted closers
Openers: "It is important to note," "In today's fast-paced world," "Generally speaking." Closers: "In conclusion," "Ultimately," "Despite these challenges, the future looks bright," plus a summary of what was just said. AI both announces what it will do and restates what it did — "fractal summaries" at every level. [practitioner] ([tropes.fyi](https://tropes.fyi/); [oliviacal](https://www.oliviacal.com/post/ai-writing-tells); [Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) "outline-like conclusions").
**Human fix:** start inside the conflict; end on the strongest concrete point or a forward question, not a recap. For YouTube specifically a recap outro also kills retention — end abruptly on the payoff.

### T9. False-suspense transitions
"Here's the thing." "But here's the kicker." "And that's where it gets interesting." "What most people miss is…" [practitioner] ([tropes.fyi](https://tropes.fyi/) "Here's the Kicker"; [oliviacal](https://www.oliviacal.com/post/ai-writing-tells)).
**Spoken caveat:** these are legitimate spoken-register devices — narrators do say "here's the thing." The tell is frequency and emptiness: AI uses them as filler *without a payoff attached*. Rule: allowed only when the next sentence actually delivers a surprise, and at most twice per video.

### T10. Empty intensifiers and magic adverbs
"Quietly, deeply, fundamentally, remarkably, notably, truly, incredibly." Also "It's worth noting that," "Interestingly." They add emphasis without information. [practitioner] ([tropes.fyi](https://tropes.fyi/) "'Quietly' and Magic Adverbs"). **Fix:** cut, or replace with the specific fact that justifies the intensity.

### T11. Perfect parallelism and listiness
Every paragraph the same shape: claim → explanation → mini-summary. Bullet lists with bold-lead phrases. Disguised enumeration ("The first… The second… The third…"). Paragraphs as "perfect rectangles" of three 15–20-word sentences. [practitioner] ([Louis Bouchard's editor cleanup system](https://louisbouchard.substack.com/p/how-to-edit-ai-writing-so-it-sounds) — "talk about something, explain it, summarize it… five or six times and it feels formulaic"; [Hiration](https://www.hiration.com/blog/ai-slop-linkedin/)).
**Human fix:** you own the structure, the model fills it — never the reverse. [practitioner] ([Bouchard](https://www.louisbouchard.ai/ai-editing/)). In narration, convert every list to a ranked or narrated sequence with unequal airtime: spend 40 seconds on the item that matters and 4 on the one that doesn't. Equal airtime per item is the tell.

### T12. Everything resolves; nothing dangles
AI paragraphs land neatly; objections are raised only to be dismissed ("Despite its challenges…"); no digression, no self-correction, no loose thread. [practitioner] ([tropes.fyi](https://tropes.fyi/) "Despite Its Challenges"; [Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)). Related [study] finding: human text carries more negative emotion (fear, disgust) and more scattered affect than LLM text, which trends positive-neutral ([Muñoz-Ortiz et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422446/)).
**Human fix:** leave one thread visibly unresolved and say so ("I couldn't find a good benchmark for this — if you know one, comment"). Let one section end on a problem.

### T13. Vague attribution
"Experts argue," "industry reports suggest," "observers have noted." [practitioner] ([Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing); [tropes.fyi](https://tropes.fyi/)). This also violates house rule 4: name the source or mark `[VERIFY]`.

### T14. Synonym cycling
Refusing to repeat a noun: "the database… the datastore… the persistence layer… the system." [practitioner] ([tropes.fyi](https://tropes.fyi/)). Humans repeat the plain word. In narration, repetition is *good* — listeners can't scroll back.

### T15. Uniformity itself (the meta-tell)
The measurable core: LLM sentences cluster in the 10–30-token band while human lengths scatter; human standardized type-token ratio 0.491 vs 0.424–0.466 for tested models; lexical-diversity MTLD humans 96.5 vs as low as 57.4. [study] ([Muñoz-Ortiz et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422446/)). LLM-rewritten text shows significantly reduced variance in aggregate complexity vs originals. [study] ([The Shrinking Landscape of Linguistic Diversity](https://arxiv.org/pdf/2502.11266)). Stylometric classifiers separate human from LLM essays near-perfectly on such features even when humans can't. [study] ([PLOS/PMC Japanese stylometry study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12558491/); [Oxford DSH essay study](https://academic.oup.com/dsh/advance-article/doi/10.1093/llc/fqag064/8714041)). No single tell above matters as much as this: *sameness of shape across the whole script*.

---

## Part 2 — Spoken vs. written register (S-rules)

Broadcast journalism codified this decades before LLMs; the rules double as de-AI-ing rules because AI defaults to *print* register.

### S1. Contractions, always
"Don't," "it's," "we're" — uncontracted forms read as text-being-recited. [practitioner] ([UF/IFAS broadcast writing guide](https://ask.ifas.ufl.edu/publication/WC193); [Univ. of Arkansas broadcast chapter](https://uark.pressbooks.pub/journalismgsp/chapter/broadcast/)). Audit: any "do not / it is / cannot" that isn't deliberate emphasis is a bug.

### S2. One idea per sentence, subject–verb–object, ~15–20 words *average* (with variance — see R-rules)
A listener can't re-read. Short, declarative, active. [practitioner] ([UF/IFAS](https://ask.ifas.ufl.edu/publication/WC193); [journalism.university radio scripting](https://journalism.university/broadcast-and-online-journalism/crafting-perfect-radio-script-presenters/)). Long subordinate-clause chains — an AI default — die on the ear.

### S3. Fragments are legal aloud
"Sentence fragments — as long as they make sense — are acceptable" in radio scripts because speech is full of them. [practitioner] ([Univ. of Arkansas](https://uark.pressbooks.pub/journalismgsp/chapter/broadcast/)). The page-tell (T2) is *patterned triads*; a lone fragment as a genuine reaction ("Which — fine.") is human speech.

### S4. Write it by saying it
The Transom school: "Don't write it. Try saying it out loud. Invent it out of the air," then transcribe; the words must "fit the mouth" of the person reading. [practitioner] ([Transom, "How Not To Write For Radio"](https://transom.org/2016/not-write-radio/); [Nancy Updike's Transom manifesto](https://transom.org/2006/nancy-updike/)). Practical pipeline rule: before recording, read the script aloud once; anything you stumble on or unconsciously rephrase, change the script to what you actually said.

### S5. Mid-sentence pivots and self-corrections are spoken punctuation
"It's about 40 milliseconds — actually, call it 50, the tail matters here." Real speech averages ~6 disfluencies per 100 words (fillers, repeats, false starts). [study] ([Fox Tree 1995 / Bortfeld et al. 2001, disfluency rates in conversation](https://heatherbortfeld.com/wp-content/uploads/2016/09/bortfeld_etal_ls2001.pdf)). Fillers and repairs can *aid* listener comprehension and recall rather than hurt it. [study] ([Fraundorf & Watson, filled pauses and recall](https://pmc.ncbi.nlm.nih.gov/articles/PMC3134332/)). Don't script "um"; do script one or two deliberate pivots/self-corrections per video — they're the strongest cheap humanity signal that survives being read aloud.

### S6. Second person as conversation, not lecture
Talk *to* one viewer ("you've probably hit this in an interview"), not *at* an audience ("developers often encounter"). But avoid the AI second-person clichés: "Picture this," "As a developer, you know…" followed by a generic scenario. [practitioner] ([oliviacal](https://www.oliviacal.com/post/ai-writing-tells) "fake experience tell"). The fix is specificity: a scenario with a day, a time, a version number.

### S7. Signpost verbally, not structurally
On the page AI signposts with headers and "In this section." Aloud, humans signpost with orientation phrases: "OK, so that's the handshake. The part that breaks in production is renewal." Repetition of key terms (anti-T14) is a feature for the ear. [practitioner] ([Fiveable broadcast-writing summary](https://fiveable.me/introduction-journalism/unit-10/writing-broadcast-radio-television/study-guide/ZvDeONBAXMf2XMDV)).

---

## Part 3 — Rhythm science (R-rules)

### R1. Burstiness is the mechanism behind "sounds AI"
Burstiness = variance of perplexity/pattern across a document. AI text "regresses to a mean sentence length"; human text oscillates. [practitioner, vendor] ([GPTZero, perplexity & burstiness explainer](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/)). Honesty note: GPTZero *retired* perplexity/burstiness for deep-learning detection in autumn 2023 — the signals are real but individually beatable. [practitioner] ([GPTZero support](https://support.gptzero.me/articles/9585228410-how-do-i-interpret-burstiness-or-perplexity)). The [study] correlate: human sentence-length distributions are broad and flat; LLMs cluster hard around the mean ([iScience linguistic comparison](https://www.sciencedirect.com/science/article/pii/S2589004226003512); [Muñoz-Ortiz et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422446/)).
**Checkable rule:** in any 10 consecutive script sentences, demand at least one under 6 words and at least one over 25; if 7+ of them fall in the 12–22-word band, rewrite the block.

### R2. The high-low move, used asymmetrically
Follow a long build with one short landing — but not after *every* long sentence, or it becomes T2. [practitioner] ([oliviacal](https://www.oliviacal.com/post/ai-writing-tells); [Hiration](https://www.hiration.com/blog/ai-slop-linkedin/)).

### R3. Vary tempo like a comedian, not a metronome
Comic timing = intonation, rhythm, cadence, tempo, pause. [practitioner] ([Wikipedia, Comic timing](https://en.wikipedia.org/wiki/Comic_timing)). Pros alternate brisk flurries with slow measured segments to manage attention, and pause *before* the payoff — audiences respond most to a beat right before the punchline. [practitioner] ([MasterClass comedic timing guide](https://www.masterclass.com/articles/guide-to-comedic-timing); [Backstage](https://www.backstage.com/magazine/article/comedic-timing-tips-75129/)). Script implication: mark tempo in the script (`[beat]`, `[fast]`, `[slow down]`) so the read varies even where the text can't; put a `[beat]` before the reveal, not after it.

### R4. Paragraph-shape variance
Vary section lengths as well as sentence lengths — AI gives every point equal weight and equal duration (see T11). A human explainer spends 90 seconds on the interesting failure mode and 10 on the boilerplate. Uneven allocation *is* editorial judgment made audible.

---

## Part 4 — Humanizing techniques that survive being read aloud (H-rules)

### H1. Specificity with texture beats abstraction
Not "significantly faster" but "took it from about 900 milliseconds to 40." Not "a major outage" but "the June 2022 Cloudflare outage — 19 data centers." Concrete, slightly-uneven numbers and named public incidents are the cheapest authenticity signal, and (counterintuitively) [study] data shows LLMs sprinkle *more* raw numbers than humans ([Muñoz-Ortiz et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422446/)) — so the human move is fewer numbers, each with a story attached, each verifiable (house rule 4: `[VERIFY]` anything you can't source).

### H2. Earned digressions
One deliberate aside per video that serves the theme ("quick tangent — this is also why your laptop fan spins up on video calls — anyway"). AI never digresses; every sentence is on-task. [practitioner] (jaggedness/anecdote as the human differentiator: [oliviacal](https://www.oliviacal.com/post/ai-writing-tells); over-neat structure as AI default: [Bouchard](https://www.louisbouchard.ai/ai-editing/)). Mark the exit ("anyway") — listeners need the return signposted.

### H3. Scripted self-interruption
See S5. One or two per video: correct a number mid-flight, react to your own sentence ("that's a weird sentence, but it's true"). This survives TTS-era suspicion precisely because models don't do it unprompted. [study] backing for listener tolerance of repairs: [Fraundorf & Watson](https://pmc.ncbi.nlm.nih.gov/articles/PMC3134332/).

### H4. Callbacks
Reference an earlier moment in the same video ("remember the 40 milliseconds from the intro? This is where it goes") or a prior episode. Callbacks require actual memory of the piece as a whole — AI's "self-echo" (verbatim phrase reuse, [tropes.fyi](https://tropes.fyi/)) is the degenerate version; a real callback *transforms* the earlier line.

### H5. Human uncertainty, not hedge-words
AI hedges with register ("it is important to consider that results may vary"). Humans hedge with stance: "I'm maybe 70% sure this is why," "I couldn't verify this — treat it as rumor," "smarter people than me disagree here." Confident specificity about *what you don't know* reads human; diffuse caution reads machine. [practitioner] ([oliviacal](https://www.oliviacal.com/post/ai-writing-tells) on hedging; house rule 4 alignment).

### H6. Opinion with a cost
Take a position that could be wrong and own it ("I think gRPC is the wrong default for small teams — here's where I'd be proven wrong"). Occasional contrarian views are listed by practitioners as the thing raw AI output structurally avoids. [practitioner] ([oliviacal](https://www.oliviacal.com/post/ai-writing-tells)).

### H7. Leave the ugly sentence in
"Texture is the point — a profile that reads slightly uneven and specific beats one that reads flawless and blank." [practitioner] ([Hiration](https://www.hiration.com/blog/ai-slop-linkedin/)). In the read-aloud pass (S4), when the natural spoken phrasing is grammatically worse than the written one, keep the spoken one.

---

## Part 5 — Where the literature and the folklore disagree

1. **Em dashes.** Folklore: instant AI tell. Data: weak signal — model-dependent, and classic human authors exceed GPT-4.1's rate. [folklore vs practitioner-data] ([SlopDetector](https://slopdetector.org/blog/em-dash-ai-tell-data); [The Ringer](https://www.theringer.com/2025/08/20/pop-culture/em-dash-use-ai-artificial-intelligence-chatgpt-google-gemini); [WaPo](https://www.washingtonpost.com/technology/2025/04/09/ai-em-dash-writing-punctuation-chatgpt/)). Irrelevant to VO anyway; audit the *aside rhythm*, not the glyph.
2. **"Delve" and word blacklists.** Real but decaying: the vocabulary shifts each model generation, and humans are now absorbing LLM vocabulary, so blacklists rot in both directions. [practitioner] ([Wikipedia's chronological word lists](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)). Density and co-occurrence matter; single hits don't.
3. **Short sentences.** Broadcast doctrine says keep sentences short; AI-slop doctrine says short-sentence triads are a tell. Both are right: the target is short *average* with high *variance* (R1), not uniform brevity and not patterned staccato.
4. **Passive voice.** Folk belief tags passive as robotic, but at least one stylometric line found *humans* use more passive than AI in some corpora ([TechXplore summary of 2025 stylometry work](https://techxplore.com/news/2025-12-reveals-ai-fully-human.html)). [study vs folklore] Don't "fix" passives as an AI-tell; fix them only where they hide the actor.
5. **Detectors themselves.** Perplexity/burstiness explain the intuition but were abandoned as sole detection signals ([GPTZero](https://support.gptzero.me/articles/9585228410-how-do-i-interpret-burstiness-or-perplexity)); modern detectors have non-trivial error rates and generalize poorly ([survey](https://arxiv.org/pdf/2403.01152); [Wikipedia caveats](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)). Never justify a line with "it passes a detector"; justify it with the rules above.

---

## Quick audit checklist (run on every script before recording)

- [ ] Zero "it's not X, it's Y" (T1) unless a named misconception exists — max 1
- [ ] Fragment clusters: ≤1 per 500 words, never the same shape twice (T2)
- [ ] Triples: ≤2 per 1,000 words (T3)
- [ ] Parenthetical asides: ≤1 per paragraph (T4)
- [ ] Kill-list words: no paragraph with ≥2 hits (T5); "is/has" not "serves as/boasts" (T6)
- [ ] No "-ing" significance trailers; no "In conclusion"/recap outro (T7, T8)
- [ ] "Here's the thing"-class transitions: ≤2, each with a real payoff (T9)
- [ ] Intensifiers deleted or backed by a fact (T10)
- [ ] No two adjacent paragraphs with the same shape; unequal airtime per point (T11, R4)
- [ ] At least one unresolved thread or admitted unknown, phrased as stance not hedge (T12, H5)
- [ ] Every attribution named or `[VERIFY]`-flagged (T13)
- [ ] Plain-word repetition instead of synonym cycling (T14)
- [ ] Sentence-length spread: in any 10 sentences, ≥1 under 6 words and ≥1 over 25; <70% in the 12–22-word band (R1)
- [ ] Contractions throughout; fragments allowed; read-aloud pass done and stumbles rewritten to the spoken version (S1–S4, H7)
- [ ] 1–2 scripted self-corrections/pivots; 1 earned digression with a marked exit; ≥1 callback (S5, H2–H4)
- [ ] Tempo marks (`[beat]`, `[slow down]`) placed, with a beat *before* each reveal (R3)
- [ ] At least one opinion that could be wrong, owned (H6); numbers few, textured, sourced (H1)
