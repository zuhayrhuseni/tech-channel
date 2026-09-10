# Script performance research: writing narration that sounds like a person

Research notes for writing narration blocks in episode scripts, with inline performance
cues. Claims are tagged **[case-study]** (analysis of a specific channel/creator),
**[practitioner]** (published guidance from working professionals), or **[folklore]**
(widely-repeated craft wisdom without a single authoritative source). Each section ends
with operational rules for our scripts.

---

## 1. Voice on the page: how narration scripts differ from essays

### What the pros say

**[practitioner]** NPR's core training doctrine is "write like you talk" — and NPR host
Robert Siegel calls it "one of the most commonly offered pieces of advice… and one of the
most commonly ignored," because school teaches us to write term papers, and that reflex
must be actively unlearned for audio
([NPR Training](https://training.npr.org/2015/02/25/would-you-say-it-that-way-tips-on-writing-for-your-voice/),
[NPR: 7 tips for scripts](https://www.npr.org/2023/02/17/1156597697/how-to-write-script-speech-podcast-voice)).
Broadcast-writing curricula converge on the same mechanics: subject–verb–object
sentences, active voice, present tense where honest, ~15–20 words per sentence, and —
critically — **no dependent clauses**, because "if you listen closely to people chatting,
you will rarely hear a dependent clause"
([Fiveable broadcast-writing notes](https://fiveable.me/introduction-journalism/unit-10/writing-broadcast-radio-television/study-guide/ZvDeONBAXMf2XMDV),
[Human Kinetics](https://us.humankinetics.com/blogs/excerpt/tips-for-writing-for-broadcast)).

**[practitioner]** The five properties of broadcast copy: it is *spoken* (everyday words),
*immediate* (present tense), *person-to-person* (talk to one listener), *heard once*
(no re-reading, so no nested logic), and *sound* (words chosen for how they land in the
ear) ([Human Kinetics](https://us.humankinetics.com/blogs/excerpt/tips-for-writing-for-broadcast)).
"Heard once" is the load-bearing one: an essay can afford a sentence the reader parses
twice; narration cannot.

### Where personality lives, by channel

**[case-study]** **Wendover Productions** is thesis-led: open with a question, close with
the answer — the closing line is "the thesis, not the punchline," borrowed from longform
journalism. Delivery is deadpan; jokes land *because* the narrator shows no awareness of
them ([yespress profile](https://yespress.io/wendover-productions)). **Half as
Interesting** runs the same curiosity engine with "snarkier" energy and more puns — same
writer, different registers, proving register is a *dial you set per script*, not a fixed
personality ([yespress](https://yespress.io/wendover-productions),
[Wikitubia](https://youtube.fandom.com/wiki/Wendover_Productions)).

**[case-study]** **Kurzgesagt** puts personality in direct address ("you") and framing,
not in jokes: scripts go through many rewrite rounds "constantly tweaking the wording to
find the right balance between simplicity and accuracy," with ~100 hours of fact-checking
per video ([10 Studio breakdown](https://10.studio/the-incredible-amount-of-work-behind-kurzgesagts-beautiful-animated-videos/),
[Kurzgesagt on Medium](https://medium.com/@Kurzgesagt/how-research-and-factchecking-work-at-kurzgesagt-f5b239188255)).
Founder Philipp Dettmer deliberately toned language down over the years to avoid scaring
viewers — tone is an editorial decision made in revision, not a first-draft accident
([Forbes interview](https://www.forbes.com/sites/danidiplacido/2024/10/24/kurzgesagt-in-a-nutshell-creator-talks-youtube-tiktok-and-optimistic-nihilism/)).

**[case-study]** **Fireship** compresses to ~200–250 wpm delivery with sarcastic,
self-deprecating asides ("I have the personality of a carrot") and insider jokes that
double as credibility signals — the humor tells the audience "I'm one of you"
([Engineer's Codex](https://read.engineerscodex.com/p/how-fireship-became-youtubes-favorite)).

**[case-study]** **Internet Historian** gets comedy from *contrast*: a calm, sophisticated
narrator describing absurd events, with the narrator persona ("Harold") withholding
personal opinions so the material carries the irony
([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/WebVideo/InternetHistorian)).

### Rules for our scripts

1. Draft in speech, not prose: if a sentence has a subordinate clause, split it. Target
   8–20 words per sentence; let a few run long *deliberately* for rhythm, then snap back
   short.
2. Use contractions everywhere they'd occur in speech. "It is not" reads as narrator-bot.
3. Address one viewer as "you." Never "some of you" or "those watching."
4. Personality lives in three sanctioned places: **verb choice** (servers don't "fail,
   they "faceplant"), **asides** (one clause, clearly severable), and **the opinion
   moment** — one or two per episode where the narrator briefly drops neutrality ("this
   is, frankly, a terrible API"). An essay hedges; a person commits.
5. Our default register sits between Wendover and HAI: deadpan-precise on the technical
   spine, wry in the connective tissue. Decide the register in the episode brief before
   drafting, per the Denby two-channel lesson.

---

## 2. Humor mechanics for educational content

### Joke types that work in VO

**[practitioner]** Stand-up structure transfers directly: setup creates an expectation,
punchline breaks it; the setup should be *as short as possible* while still creating a
clear expectation — "comedy is an art of economy"
([Creative Standup](https://creativestandup.com/how-to-write-stand-up-comedy-jokes/),
[MasterClass](https://www.masterclass.com/articles/how-to-write-stand-up-comedy-in-6-easy-steps)).
The reliable tools for narration:

- **Rule of three**: establish, reinforce, surprise. Two straight items build the
  pattern; the third breaks it ([Buddy On Stage](https://buddyonstage.com/blogs/rule-of-3-in-comedy),
  [Chris Head](https://www.chrishead.com/post/2018/04/27/lesson-17-comic-analogies)).
  Perfect for tech lists: "You get retries, you get backoff, and you get a pager alert
  at 3 a.m."
- **Callbacks**: reference an earlier joke late in the episode; it makes the audience
  feel like insiders ([Highbrow](https://gohighbrow.com/add-a-callback-thats-comedian-talk-for-deja-vu/)).
  Cheap to write, high payoff, and it rewards full watch-through.
- **Act-outs**: shift from narrating to *performing* — voicing the load balancer, the
  junior dev, the incident channel. They force specificity, and "both comedy and truth
  are frequently found in the specific"; deadpan act-outs work fine for non-performers
  (Steven Wright is the proof)
  ([Funny How, "The power of act-outs"](https://funnyhow.substack.com/p/the-power-of-act-outs)).
- **Deadpan understatement / absurd comparison**: the Wendover mode — deliver the absurd
  fact with flat precision and no acknowledgment
  ([yespress](https://yespress.io/wendover-productions)); the Internet Historian mode —
  calm register against chaotic content
  ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/WebVideo/InternetHistorian)).
- **Specificity escalation**: the joke version of "show, don't tell." "A big config
  file" isn't funny; "a 14,000-line YAML file named `final_final_v2.yaml`" is.
  **[folklore]** — but it's the observable engine of both Fireship and HAI jokes.

### Density: calibrate to format

- **[case-study]** Fireship: humor is woven into nearly every beat — insider jokes,
  meme cuts, self-deprecation — at ~200–250 wpm; effectively multiple laughs per minute
  ([Engineer's Codex](https://read.engineerscodex.com/p/how-fireship-became-youtubes-favorite),
  [Grokipedia](https://grokipedia.com/page/fireship)).
- **[case-study]** Wendover: roughly one dry joke per 60–90 seconds, never at the
  expense of the argument; HAI runs several times denser. (Density numbers are my
  observation from the channels; the *register* contrast is documented at
  [yespress](https://yespress.io/wendover-productions).) **[folklore]** on the counts.
- **[practitioner]** Stand-up targets a laugh every 6–10 seconds
  ([Clean Comedians](https://cleancomedians.com/how-to-write-stand-up-comedy/)) — that is
  a *comedy* cadence, not an *education* cadence. Instructional-humor research lands far
  lower: content-relevant humor improved six-week retention while irrelevant humor did
  nothing, roughly four jokes per hour is cited as optimal for lectures, and humor should
  be kept **away from the key instructional points**
  ([The eLearning Coach](https://theelearningcoach.com/elearning_design/isd/humor-and-learning/),
  [Faculty Focus, 40 years of research](https://www.facultyfocus.com/articles/effective-teaching-strategies/humor-in-the-classroom-40-years-of-research/),
  [IDTips](https://idtips.substack.com/p/the-jokes-on-us-when-humour-helps)).

### Why forced jokes read worse than none

**[practitioner]** "Not everyone is naturally humorous, so don't force it — watching
someone struggle to be funny is awkward and defeats the purpose"; excess humor also
damages instructor credibility
([Edutopia](https://www.edutopia.org/blog/laughter-learning-humor-boosts-retention-sarah-henderson),
[NCA](https://www.natcom.org/publications-library/should-teachers-be-funny/)). The
deadpan channels dodge this structurally: a joke delivered flat that doesn't land just
reads as information. A joke delivered with a wink that doesn't land reads as failure.

### Rules for our scripts

1. Budget: for an 8–12 minute technical episode, 4–8 deliberate jokes — one per major
   section, plus one callback in the last third. Never place a joke inside the sentence
   that carries the core claim of a section; put it immediately after, as the exhale.
2. Every joke must be *about the material* (relevant humor is the only kind shown to
   help retention). Cut any joke that would survive being pasted into an unrelated video.
3. Write all jokes deadpan-recoverable: if it doesn't land, the sentence still carries
   information. No "wasn't that crazy?" self-acknowledgment, ever.
4. Preferred forms, in order: specificity escalation, rule of three, understatement,
   act-out (one per episode max — we're not actors), callback.
5. If a section has no natural joke, it gets no joke. Density is a ceiling, not a quota.

---

## 3. Performance cue systems: markup for a non-actor reading their own script

### Standard VO conventions

**[practitioner]** Working narrators mark their own scripts as rehearsal — the marking
pass *is* practice, done aloud
([audio'connell](https://blog.audioconnell.com/7-tips-for-marking-up-your-voiceover-script/),
[C.C. Hogan's audiobook guide](https://cchogan.com/audiobook-tips-a-short-guide/preparing-a-script-for-recording/)).
Documented conventions:

- **Pauses**: `/` = short beat (comma-weight, also a breath opportunity); `//` = long
  pause, "letting something sink in"
  ([C.C. Hogan](https://cchogan.com/audiobook-tips-a-short-guide/preparing-a-script-for-recording/),
  [speak4me narration guide](https://speak4me.io/discover/how-to-narrate-audiobooks)).
  Ellipsis (…) for a trailing hesitation; bracketed `[pause: 2s]` for timed holds
  ([Voice123](https://voice123.com/blog/voice-over-scripts/how-to-properly-prepare-a-voice-over-script/)).
- **Breath**: an upside-down "T" (or any consistent mark) at planned breath points, which
  doubles as a pacing brake ([audio'connell](https://blog.audioconnell.com/7-tips-for-marking-up-your-voiceover-script/)).
- **Emphasis**: underline (or **bold** in digital scripts) the punch word — one per
  sentence, or emphasis means nothing
  ([Voice123](https://voice123.com/blog/voice-over-scripts/script-format/),
  [Pozotron narrator tips](https://blog.pozotron.com/top-10-tips-for-new-audiobook-narrators)).
- **Tone/pace direction**: bracketed descriptors next to the line — `[whisper]`,
  `[faster]`, `[dry]` ([Voice123](https://voice123.com/blog/voice-over-scripts/how-to-properly-prepare-a-voice-over-script/)).
  Directors also use adjective stacks ("gentle, kindly, empathetic read") and the
  classic **[smile]** cue — physically smiling while reading audibly warms the tone
  ([Backstage VO glossary](https://www.backstage.com/magazine/article/must-know-voiceover-terms-7216/),
  [Voices.com on direction](https://www.voices.com/blog/how-to-give-the-best-voice-over-direction/)).
- **Pronunciation traps**: flag them in advance; don't discover them at the mic
  ([speak4me](https://speak4me.io/discover/how-to-narrate-audiobooks)).

**[practitioner]** The meta-rule: use *your own* shorthand consistently — the markup only
has to be legible to the person at the mic
([audio'connell](https://blog.audioconnell.com/7-tips-for-marking-up-your-voiceover-script/)).

### House cue vocabulary for narration blocks

For a non-actor, fewer cues followed reliably beat a rich system followed sporadically.
Proposed inline set for our narration blocks (inline in the text, square brackets for
anything that isn't a pause):

| Cue | Meaning |
|---|---|
| `/` | beat — half-second, breath allowed |
| `//` | full stop-and-land pause; let the previous line sit |
| `…` | trailing, unfinished energy (rare) |
| `**word**` | the single punch word of the sentence |
| `[dry]` | deadpan — do NOT smile into the joke |
| `[smile]` | audible warmth; use on welcomes and payoffs |
| `[up]` / `[down]` | pitch lift (question/tease energy) or drop (verdict energy) |
| `[fast]` … `[reset]` | pick up pace through a list/montage, then return to base |
| `[breath]` | planned breath before a long or important sentence |
| `[say: "…"]` | pronunciation guide for names/acronyms |

Non-actor guardrails, all **[practitioner]**-derived: mark at most one emphasis per
sentence; put `[dry]` on every joke by default (deadpan-recoverable, per §2); use `//`
after each section's key claim — the pause does the work an actor's inflection would;
speak every cue aloud once while placing it, because marking silently is decoration, not
rehearsal ([C.C. Hogan](https://cchogan.com/audiobook-tips-a-short-guide/audiobook-tips-reading/),
[Sounds and Such pacing guide](https://soundsandsuch.com/howtoaudiobook/the-diy-narrators-guide-to-pacing-and-performance)).

---

## 4. Structure for the ear

### Openings

**[case-study]** MrBeast's leaked production memo is the bluntest statement of the
principle: the first minute is the most important minute; no intro, no logo — validate
the title's promise immediately, then re-engage on a schedule (spectacle ~minute 3,
second re-engagement ~minute 6, accepted "lull" in the back half, abrupt ending to avoid
signaling "you can leave now")
([Scrivner's memo summary](https://www.danielscrivner.com/how-to-succeed-in-mrbeast-production-summary/),
[Jarvis memo transcription](https://www.alexanderjarvis.com/memo-how-to-succeed-in-mrbeast-production/)).
We are not MrBeast, but the drop-off math is the same physics; the educational
translation is: open with the question or the stakes, never with throat-clearing.

**[case-study]** The Wendover/longform alternative: open with a question, spend the
video earning the answer, and make the final line the thesis
([yespress](https://yespress.io/wendover-productions)). Summoning Salt does the serialized
version — mastery of "when to share information now, and when to withhold it for later,"
with each record-fall functioning as a mini cliffhanger resolved into the next setup
([The Motte review](https://www.themotte.org/post/3272/a-youtube-channel-review-summoning-salt),
[TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/WebVideo/SummoningSalt)).

### Transitions and re-hooking

**[practitioner]** Podcast-structure guidance: transitions are where listeners bail, so a
transition must be a *micro-hook* — a new open loop — not a summary handshake
([Grayline Media](https://graylinemedia.com/the-secrets-behind-podcast-structure-listener-retention/),
[Audiencelift](https://amazemedialabs.com/blog/how-to-write-podcast-scripts-that-keep-listeners-hooked-with-real-world-examples/)).
Balance open and closed loops: satisfy some curiosity, immediately open more
([Podbean](https://blog.podbean.com/3-tips-to-boost-your-podcast-audience-retention/)).
Spoken transitions that don't sound like transitions are questions and turns, not labels:
"But here's the problem." / "Which raises an obvious question." / "And that worked —
until it didn't." An essay's "Furthermore" and "In addition" are read-only words; nobody
says them. **[folklore]** on the specific phrase list; the loop mechanics are
[practitioner].

### One idea per breath

**[practitioner]** Radio's version: one thought per sentence, because the audience hears
it once and cannot re-read
([Fiveable](https://fiveable.me/introduction-journalism/unit-10/writing-broadcast-radio-television/study-guide/ZvDeONBAXMf2XMDV));
long punctuation-heavy sentences cause literal narrator breathlessness and listener
fatigue ([Audiencelift](https://amazemedialabs.com/blog/how-to-write-podcast-scripts-that-keep-listeners-hooked-with-real-world-examples/)).
The breath is the unit of comprehension: if you can't say the sentence on one breath, the
viewer can't parse it on one pass.

### Rules for our scripts

1. Cold-open on the question, a concrete failure, or a number that seems wrong. The
   episode's premise must be validated inside the first two sentences.
2. Close each section by *closing one loop and opening the next in the same breath*.
   Never write a section that ends at rest before the final one.
3. The last line of the episode states the thesis plainly (Wendover close). No "so
   yeah," no "let me know in the comments" before the thesis lands.
4. One idea per sentence; one breath per sentence. The `[breath]` cue marks the
   exceptions we've chosen on purpose.
5. Re-hook on a cadence: for a 10-minute episode, a deliberate new question or reveal
   roughly every 90–120 seconds. Track them in the script margin so gaps are visible.

---

## 5. Read-aloud QA

**[practitioner]** The universal test is Siegel's: for every sentence ask, "Would you say
it that way?" — and the only way to answer is out loud
([NPR Training](https://training.npr.org/2015/02/25/would-you-say-it-that-way-tips-on-writing-for-your-voice/)).
StudioBinder's timing method doubles as QA: read at conversational pace (~125–150 wpm
for explainer VO) to time the video — anywhere you stumble or speed up unnaturally is a
rewrite site ([StudioBinder](https://www.studiobinder.com/blog/how-to-write-explainer-videos-that-convert-with-free-video-script-template/)).
VO pros read the full script aloud before the session specifically to "discover the
script's natural voice"
([audio'connell](https://blog.audioconnell.com/7-tips-for-marking-up-your-voiceover-script/));
audiobook narrators treat the markup pass as a spoken rehearsal
([C.C. Hogan](https://cchogan.com/audiobook-tips-a-short-guide/preparing-a-script-for-recording/)).

**What gets cut in the read pass** (all [practitioner] unless noted):

- Anything you'd never say in conversation — rewrite in the words that actually came out
  of your mouth when you stumbled ([Vista Social](https://vistasocial.com/insights/how-to-write-a-youtube-script/),
  [NPR](https://www.npr.org/2023/02/17/1156597697/how-to-write-script-speech-podcast-voice)).
- Accidental tongue-twisters and sibilant/plosive pile-ups ("six sysadmins SSH'd") —
  flag or rephrase; pros highlight plosives and hard consonant clusters during markup
  ([Voice123](https://voice123.com/blog/voice-over-scripts/how-to-properly-prepare-a-voice-over-script/)).
- Sentences that outrun one breath (§4).
- Jokes that needed a second read to be funny — heard once means got once, or cut.
- Dependent clauses that snuck back in during revision
  ([Fiveable](https://fiveable.me/introduction-journalism/unit-10/writing-broadcast-radio-television/study-guide/ZvDeONBAXMf2XMDV)).

### QA procedure for our episodes

1. **Timing read**: full script aloud at natural pace, timed. >155 wpm sustained means
   the script is overpacked for our format — cut content, not pauses.
2. **Stumble log**: every trip, restart, or breath-gasp gets a margin mark. Three marks
   on one sentence = mandatory rewrite. Rewrite using whatever you *actually said* when
   paraphrasing it aloud.
3. **Cue placement pass**: add §3 cues while reading aloud a second time — never
   silently.
4. **Cold-listen**: record a scratch take, play it back the next day at 1x while doing
   something else (the Summoning Salt "podcast with visuals" test — narration must
   survive partial attention,
   [The Motte](https://www.themotte.org/post/3272/a-youtube-channel-review-summoning-salt)).
   Anywhere your attention drifted, the script — not the delivery — is the suspect.
5. Standard channel rules still apply during QA: any factual claim that can't be sourced
   publicly gets `[VERIFY: …]`, and captures are checked for identity/employer leaks
   before render.

---

## One-page operational summary

- Write it the way you'd say it; prove it aloud. One idea per sentence, one breath per
  sentence, no dependent clauses, contractions on.
- Personality budget: sharp verbs everywhere; asides sparingly; 1–2 opinion moments per
  episode; register (Wendover-dry ↔ HAI-snark) chosen in the brief.
- Jokes: 4–8 per 10 minutes, all material-relevant, all deadpan-recoverable, never on
  the load-bearing sentence, one callback in the last third. No natural joke → no joke.
- Cues: `/` `//` `…` `**punch word**` `[dry]` `[smile]` `[up]/[down]` `[fast]…[reset]`
  `[breath]` `[say:]`. One emphasis per sentence max. Place cues aloud.
- Structure: validate the premise in two sentences; every section close opens the next
  loop; re-hook every 90–120s; final line = thesis.
- QA: timing read (≤155 wpm), stumble log (3 strikes = rewrite), cue pass aloud,
  next-day cold-listen at partial attention.
