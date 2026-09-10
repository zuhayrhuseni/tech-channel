# Script craft

How to write a script for this channel. The format is narration over animation, which is a specific discipline — most writing advice assumes text on a page and gets this wrong.

## The one principle everything else follows from

**Narration and visuals divide labor. They never duplicate it.**

Narration carries the argument: why this matters, what the tradeoff is, what happens when it breaks. Visuals carry the structure: what connects to what, what the shape is, where the data goes.

The moment narration describes what's on screen, both channels collapse into one and the viewer's attention has nowhere to go. If the script says "here we can see the request flowing from the load balancer to the service," delete it — the diagram already said that. Say instead what the diagram cannot: "this hop is where most of your latency actually lives."

Write the narration and the visual for a moment together. Never write the script and then decide where pictures go.

## Length and budget

Spoken technical narration runs roughly 150 words per minute. An 8–12 minute video is therefore **1,200–1,800 words**. That is much shorter than it feels while writing, and running long is the most common first-draft failure.

A working budget for a 10-minute video:

| Section | Time | Words |
|---|---|---|
| Hook | 0:00–0:15 | ~40 |
| Stakes | 0:15–1:00 | ~110 |
| Body, 3–4 sections | 1:00–8:30 | ~1,100 |
| Payoff | 8:30–9:30 | ~150 |
| Close | 9:30–9:45 | ~40 |

If a section needs more than 150 seconds, it is two sections or it is a different video.

## The hook

The first fifteen seconds decide the video. No greeting, no channel intro, no "in this video we're going to."

Four hooks that work for technical content:

**The wrong belief.** State something the viewer probably thinks, then say it's wrong. "Adding an index makes queries faster. Sometimes it makes them ten times slower, and the reason is more interesting than the fix."

**The specific failure.** Open on a real incident with real consequences. Concrete beats abstract every time.

**The number.** A figure that shouldn't be true. "One line of config cost this company four hours of downtime."

**The question nobody answers.** Something viewers have wondered but never seen explained cleanly.

The test: read the first sentence alone. If it would work as a standalone post that makes someone curious, it works. If it needs the second sentence to make sense, it isn't a hook yet.

## Keeping attention past the hook

**Re-hook every 60–90 seconds.** Attention decays continuously; every section needs its own small reason to keep watching. A new question, a new stake, a surprising consequence.

**Connect sections with "but" or "therefore," never "and then."** If two sections are joined by "and then," the second is a list item and the viewer feels it. If joined by tension ("but this breaks when…") or consequence ("so the obvious fix is…"), it pulls forward.

**Signpost, don't withhold.** Suspense doesn't work in technical content. Telling viewers what's coming increases retention because they know it's worth waiting for.

**Leave gaps.** Roughly a third of runtime should have no visual cue. Direct address, opinions, and transitions land better on voice alone. Constant motion reads as anxious.

## Writing for the ear

The script will be spoken, not read. Different rules apply.

- **One idea per sentence.** Listeners cannot re-read.
- **Short sentences.** Then a longer one occasionally, for rhythm.
- **Contractions always.** "It's," "you'll," "doesn't." Anything else sounds like a press release.
- **Fragments are fine.** They're how people talk.
- **Kill subordinate clauses.** A sentence that opens with a dependent clause makes the listener hold state. Restructure it.
- **Read every paragraph aloud before it's final.** Every stumble is a rewrite, not a delivery problem. This is the single highest-return editing pass.

## Interlocking with animation

**Let visuals land.** When a diagram appears, give it two or three seconds before narration continues. Talking over the reveal means the viewer either reads or listens, not both.

**Budget reading time.** A viewer needs roughly a second per new element on screen. A six-node diagram needs six seconds minimum before it can be discussed, and it should stay up while being discussed.

**One idea per visual.** A diagram that shows the whole system and gets referenced for four minutes is a reference chart, not an animation. Build it up in stages instead, revealing only what's currently being discussed.

**Never say "as you can see."** If it's visible, saying so is redundant. If it isn't, saying so is a lie.

**Cue placement is inside the sentence, not before it.** The cue attaches to the word following it, so put it on the exact word the visual illustrates.

## Common failure modes

**Explaining before establishing stakes.** The viewer needs to want the answer before getting it. Thirty seconds on why this matters buys eight minutes of attention.

**The everything dump.** Writing all known facts about a topic. A video is an argument with a shape, not a summary. Cut anything that doesn't serve the through-line, however interesting.

**Over-cueing.** A visual on every sentence flattens emphasis. When uncertain, leave it out.

**The subscribe outro.** Ending on a pitch trains viewers to leave before the end, which hurts retention on every future video. End on the takeaway.

**Padding to hit a length target.** Retention drops are worse than a short video. If it's genuinely 7 minutes of material, ship 7 minutes and pick a bigger topic next time.

## Reading the retention curve

The curve on every published video is the most honest editorial feedback available. Read it before writing the next script.

| Where it drops | What it means |
|---|---|
| Cliff at 0:10–0:20 | Hook failed. Wrong promise, or too slow to the point. |
| Slide through 0:30–1:00 | Stakes unclear. Viewer doesn't know why to care. |
| Sharp drop mid-video | That section ran long or lost the thread. Find the timestamp and read the script there. |
| Gradual even decline | Normal. Nothing to fix. |
| Small bumps upward | Something worked — a visual landing, a good line. Note it and do it again. |

Fix one thing per video. Changing three things at once means learning nothing from the result.
