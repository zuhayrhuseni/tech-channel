# The SFX palette

Every sound in this channel is generated in-repo with ffmpeg. Nothing is
downloaded, sampled or licensed, so there is nothing here Content ID can claim —
which is the whole reason the palette is synthetic rather than sourced. That
constraint is stated per-episode in `credits.md` and it is not negotiable: **a
cue that cannot be regenerated from a command in this file does not belong in
`public/sfx/`.**

Assets live in `public/sfx/`. The mapping from cue name to file and to playback
gain lives in `src/components/SfxLayer.tsx` (`SfxName`, `SFX_SRC`, `SFX_GAIN`).
This file is the provenance record for the assets themselves.

Thirteen cues: the original five that shipped e005, plus eight added for e006
because five cues across a ten-minute episode is why the sound design read as
sparse.

---

## Design rules

These are the rules the palette was built against. Extend it by these, not by
taste — the point of writing them down is that the fourteenth cue should sound
like it belongs next to the first thirteen.

1. **Motivated, never decorative.** Every cue exists because something specific
   happens on screen. If you cannot name the physical event in one clause —
   "a chip docks", "the diagram settles", "the number lands" — do not add the
   cue and do not schedule it. This is PLAYBOOK "nothing decorative" applied to
   audio: a sound nobody is looking at when it fires is an ad.
2. **It must survive being under narration.** Every cue is punctuation for
   speech that is still happening. Nothing may mask a word, and nothing may
   make the listener wait for it to finish. That is what caps durations and
   what sets the gain ladder below.
3. **Short.** Transients under ~60 ms, gestures under ~200 ms, and only the
   three build/verdict cues (`riser`, `chime`, `fall`) run past 300 ms.
   `transition` at 600 ms is the single longest thing in the palette and it
   fires only on section changes.
4. **No melody, ever.** One pitch at a time. No intervals, no two-note
   figures, no arpeggios — a second note is what turns a cue into a jingle and
   a chime into a notification ding. `chime` is deliberately tuned to 905 Hz,
   which is _between_ A5 (880) and A♯5 (932), so it cannot imply a key even
   against itself. Glides (`drop`, `fall`) are continuous, not stepped, for the
   same reason.
5. **Calm and dry.** No reverb tails, no stereo width (everything is mono), no
   cartoon boing, no rising-then-falling "comedy" contours. The channel's
   register is engineer-facing and understated; a cue that draws attention to
   itself has already failed.
6. **One cue per event.** Layering two cues on the same frame reads as a
   mistake, not as richness — and for the two sub-bass cues it is also a
   headroom bug (see `drop` below).
7. **Peak-normalize to −12.0 dBFS, always.** Level lives in `SFX_GAIN`, never
   in the asset. This is the fix for the round-12 bug documented at length in
   `SfxLayer.tsx`, where assets ranging −31.2 to −11.2 dBFS were then attenuated
   another ~10 dB and became functionally inaudible: cue onsets measured
   0.66–0.95× the energy of _random_ frames. With every asset at a common
   −12.0, the gain table is pure balance and the effective peak of any cue is
   `-12.0 + 20*log10(gain)` — a number you can reason about instead of guess.
8. **Format is fixed:** 48 kHz, mono, `pcm_s16le`, `-map_metadata -1`. The
   sample rate matches the narration master and the bed; the metadata strip is
   an anonymity measure (CLAUDE.md hard rule 1), not housekeeping.
9. **Occupy a free spectral slot.** The palette is deliberately spread out so
   two cues in the same beat stay distinguishable. Before adding a cue, measure
   its spectral centroid and check it against the map below — and if it lands
   near an existing cue, make it differ in _envelope_ instead (`pop` at 660 Hz
   and `chime` at 905 Hz share a band but a 60 ms blip and a 400 ms decaying
   note are never confusable).

### Spectral map (measured, Hann-windowed FFT centroid)

```
   84 Hz  drop          198 Hz  latch        1200 Hz  tick        2744 Hz  riser
   90 Hz  thud          345 Hz  fall         1869 Hz  whoosh      2636 Hz  swish
                        660 Hz  pop          2193 Hz  click       4368 Hz  transition
                        909 Hz  chime                             4691 Hz  key
```

### Gain ladder (effective peak = −12.0 dBFS asset × `SFX_GAIN`)

```
  -30.0  key          the quietest thing in the palette, on purpose
  -26.0  click
  -24.0  tick, pop
  -23.5  swish
  -23.0  chime
  -22.5  fall
  -22.0  latch
  -21.0  whoosh
  -20.5  riser
  -20.0  thud, drop
  -18.9  transition   the loudest cue in the video, by design
```

For reference, the e005 bed at `bedVolume` 0.14 measured −27.8 dBFS peak /
−43.2 dBFS mean. Every cue except `key` clears the bed's peak; `key` sits ~2 dB
under it deliberately, so a typewriter run reads as the bed acquiring a grain
rather than as dozens of discrete events.

---

## The original five

These shipped episode 005 and its final master is mixed against these exact
files. **Do not regenerate or overwrite them.**

### Provenance gap — stated plainly

**The synthesis commands for these five were never recorded.** They were
generated 2026-08-31 (and `transition.wav` on 2026-09-02) and no command,
script or note survives anywhere in the repo — `SfxLayer.tsx` documents only the
round-12 _normalization_, and grepping the tree for `anoisesrc` / `aevalsrc` /
`sine=` finds only the ep005 bed. So the table below records the **measured
fingerprint** of each shipped file, which is verifiable, rather than a command
I would have to invent.

I attempted reconstructions and did not ship them. The three tonal cues matched
closely (`tick` centroid 1203 vs 1200, `pop` 663 vs 660, `thud` 93 vs 90), but
the two noise cues did not: my `whoosh` reconstruction measured centroid
2959 Hz against the shipped 1869 Hz, and `transition` 7143 Hz against 4368 Hz.
Publishing those as "the command that generates this file" would be asserting
provenance I do not have. **If any of these five is ever lost, it must be
re-derived and re-approved by ear, not restored from this document.**

This is the gap. Everything added from e006 onward closes it — the eight new
cues below each carry the command that actually produced them.

| Cue          | Job on screen                                 | Duration | Measured peak | Centroid | Fingerprint                                              | `SFX_GAIN` | Effective peak |
| ------------ | --------------------------------------------- | -------- | ------------- | -------- | -------------------------------------------------------- | ---------- | -------------- |
| `tick`       | beat mark — a small, frequent punctuation hit | 40 ms    | −12.0 dB      | 1200 Hz  | pure 1200 Hz tone, envelope peak at 4.4 ms               | 0.25       | −24.0 dBFS     |
| `pop`        | an element arriving                           | 60 ms    | −12.0 dB      | 660 Hz   | pure 660 Hz tone, envelope peak at 6.4 ms                | 0.25       | −24.0 dBFS     |
| `whoosh`     | a camera move                                 | 250 ms   | −12.0 dB      | 1869 Hz  | band noise 0.4–4 kHz, swell peaking at 109 ms            | 0.355      | −21.0 dBFS     |
| `thud`       | a big reveal                                  | 180 ms   | −12.0 dB      | 90 Hz    | pure 90 Hz tone, all energy under 120 Hz                 | 0.4        | −20.0 dBFS     |
| `transition` | a section change                              | 600 ms   | −12.0 dB      | 4368 Hz  | bright rising noise, sweeps ~3.5→5.1 kHz, peak at 269 ms | 0.45       | −18.9 dBFS     |

Normalization command (documented in `SfxLayer.tsx`, and the one used for every
cue in this file):

```bash
peak=$(ffmpeg -i IN.wav -af volumedetect -f null /dev/null 2>&1 \
         | grep max_volume | sed 's/.*max_volume: //; s/ dB//')
ffmpeg -y -i IN.wav -af "volume=$(python3 -c "print(-12.0-($peak))")dB" \
         -ar 48000 -ac 1 -c:a pcm_s16le -map_metadata -1 OUT.wav
```

Pre-round-12 originals are kept at `public/sfx/.orig-preR12/`.

---

## The eight added for e006

Each command below writes an un-normalized file to `/tmp/sfxraw/`; run the
normalization command from the previous section on it to produce the shipped
`public/sfx/*.wav`. The two-step split is deliberate — it keeps the synthesis
readable and keeps the −12.0 dBFS target in exactly one place.

**A trap worth recording:** ffmpeg's `sine` source emits at amplitude **0.125**,
not unity. Mixing `sine` against `anoisesrc` (which honours its `a=` amplitude)
buries the tonal layer ~18 dB below where the filtergraph reads as if it should
be. The first cut of `latch`, `riser` and `chime` all had this bug and it is
invisible after peak-normalization because normalization fixes the _file_ level
while leaving the internal _balance_ wrong. All tonal layers below therefore use
`aevalsrc='sin(2*PI*F*t)'`, which is unity.

**A second trap, and the reason every `anoisesrc` below carries `seed=`:**
`anoisesrc` seeds from the clock when `seed` is omitted, so a command without it
produces a _different file every run_ and "reproducible from source" is a claim
you cannot actually make. This was caught by re-running the commands and
comparing md5s, not by reading them. With the seeds in place the round-trip is
now **bit-exact**: re-running the `click` and `swish` commands verbatim plus the
normalization step reproduced the shipped files byte-for-byte
(`c8d79562edc4a4feaa554c14bac76829` and `ced57bbcea00b4449ca92857359f2b8b`), and
`chime`, which uses only `aevalsrc`, was already deterministic.

Note that the ep005 bed command in
`episodes/005-cpu-waits-on-memory/credits.md` has the same unseeded
`anoisesrc` and is therefore _not_ bit-reproducible either. It is left alone
here because that file is shipped and locked, but a regenerated bed will not
match the one in the master.

---

### `click` — a chip or label docking into a slot

Distinct from `tick`, which it will often sit next to. `tick` is a pure 1200 Hz
tone; `click` is wide-band noise (measured spectral flatness 0.112 vs `tick`'s
0.000) and 10 ms shorter. A tap, not a blip.

- **Duration** 30 ms · **Centroid** 2193 Hz · **Measured peak** −12.0 dB
- **Gain** `0.2` → effective **−26.0 dBFS**, 2 dB under `tick`

```bash
ffmpeg -y -f lavfi -i "anoisesrc=d=0.03:c=white:r=48000:a=0.9:seed=1006" \
  -af "highpass=f=620:poles=2,lowpass=f=2600:poles=2,volume=volume='exp(-t*260)':eval=frame,afade=t=in:st=0:d=0.0015,aresample=48000" \
  -ar 48000 -ac 1 -c:a pcm_s16le -map_metadata -1 /tmp/sfxraw/click.wav
```

### `key` — one character or line of a typewriter / code reveal

The softest cue in the palette and the only one designed to be fired in long
runs. Thin and high so it never competes with speech formants.

- **Duration** 22 ms · **Centroid** 4691 Hz · **Measured peak** −12.0 dB
- **Gain** `0.126` → effective **−30.0 dBFS**

```bash
ffmpeg -y -f lavfi -i "anoisesrc=d=0.022:c=white:r=48000:a=0.9:seed=2006" \
  -af "bandpass=f=3600:w=3200:width_type=h,volume=volume='exp(-t*420)':eval=frame,afade=t=in:st=0:d=0.001,aresample=48000" \
  -ar 48000 -ac 1 -c:a pcm_s16le -map_metadata -1 /tmp/sfxraw/key.wav
```

### `latch` — a diagram settling into its end state

Two layers: a dry noise tap plus a damped 190 Hz resonance. The tap is the
contact, the resonance is the settle. This is the cue for PLAYBOOK's "hold end
states ≥1s before moving on" — it marks the moment the structure stops moving.

- **Duration** 130 ms · **Centroid** 198 Hz · **Measured peak** −12.0 dB
- **Gain** `0.316` → effective **−22.0 dBFS**, 2 dB under `thud`

```bash
ffmpeg -y \
  -f lavfi -i "anoisesrc=d=0.13:c=white:r=48000:a=0.9:seed=3006" \
  -f lavfi -i "aevalsrc='sin(2*PI*190*t)':d=0.13:s=48000" \
  -filter_complex "[0:a]highpass=f=500:poles=2,lowpass=f=2000:poles=2,volume=volume='0.85*exp(-t*300)':eval=frame,afade=t=in:st=0:d=0.0015[a];[1:a]volume=volume='0.55*exp(-t*26)':eval=frame,afade=t=in:st=0:d=0.003[b];[a][b]amix=inputs=2:normalize=0,lowpass=f=6000,afade=t=out:st=0.120:d=0.010,aresample=48000" \
  -ar 48000 -ac 1 -c:a pcm_s16le -map_metadata -1 /tmp/sfxraw/latch.wav
```

### `swish` — a short directional move (dock / undock)

Lighter and shorter than `whoosh`, which stays reserved for camera moves. The
direction is real, not implied: a low band (380–1000 Hz) fades out while a high
band (1300–3400 Hz) fades in, so the spectrum genuinely travels upward across
the 140 ms.

- **Duration** 140 ms · **Centroid** 2636 Hz · **Measured peak** −12.0 dB
- **Gain** `0.266` → effective **−23.5 dBFS**, 2.5 dB under `whoosh`

```bash
ffmpeg -y -f lavfi -i "anoisesrc=d=0.14:c=white:r=48000:a=0.9:seed=4006" \
  -filter_complex "[0:a]asplit=2[lo][hi];[lo]highpass=f=380:poles=2,lowpass=f=1000:poles=2,volume=volume='1-t/0.14':eval=frame[l];[hi]highpass=f=1300:poles=2,lowpass=f=3400:poles=2,volume=volume='t/0.14':eval=frame[h];[l][h]amix=inputs=2:normalize=0,volume=volume='sin(PI*t/0.14)':eval=frame,afade=t=in:st=0:d=0.004,afade=t=out:st=0.132:d=0.008,aresample=48000" \
  -ar 48000 -ac 1 -c:a pcm_s16le -map_metadata -1 /tmp/sfxraw/swish.wav
```

### `riser` — a build into a big reveal, inside a section

Noise build plus a 300→1400 Hz linear sweep, both on a power curve so the
energy arrives late. It ends abruptly: **schedule the last frame of the riser on
the frame the reveal lands**, not before it. Half the length of `transition`,
which stays reserved for section changes.

- **Duration** 350 ms · **Centroid** 2744 Hz · **Measured peak** −12.0 dB
- **Gain** `0.376` → effective **−20.5 dBFS**, 1.6 dB under `transition`

```bash
ffmpeg -y \
  -f lavfi -i "anoisesrc=d=0.35:c=white:r=48000:a=0.9:seed=5006" \
  -f lavfi -i "aevalsrc='sin(2*PI*(300*t+1571.43*t*t))':d=0.35:s=48000" \
  -filter_complex "[0:a]highpass=f=1200:poles=2,lowpass=f=9000:poles=2,volume=volume='0.75*pow(t/0.35\,2.2)':eval=frame[n];[1:a]volume=volume='0.30*pow(t/0.35\,1.6)':eval=frame[s];[n][s]amix=inputs=2:normalize=0,afade=t=in:st=0:d=0.010,afade=t=out:st=0.338:d=0.012,aresample=48000" \
  -ar 48000 -ac 1 -c:a pcm_s16le -map_metadata -1 /tmp/sfxraw/riser.wav
```

The sweep is a linear chirp from `f0`=300 Hz to `f1`=1400 Hz over `T`=0.35 s.
Phase is `2*PI*(f0*t + k*t^2/2)` with `k = (f1-f0)/T = 3142.86`, hence the
`1571.43*t*t` term. Rescale both numbers together if you retune it.

### `chime` — a payoff number landing

One note. 905 Hz fundamental plus a single quiet third harmonic, both on
exponential decays, low-passed at 5 kHz to take the glassy top off. 905 Hz is
deliberately off the tempered grid (between A5 and A♯5) so it cannot read as a
musical note, and there is no second note, which is what separates this from a
notification ding.

- **Duration** 400 ms · **Centroid** 909 Hz · **Measured peak** −12.0 dB
- **Gain** `0.282` → effective **−23.0 dBFS**

```bash
ffmpeg -y \
  -f lavfi -i "aevalsrc='sin(2*PI*905*t)':d=0.40:s=48000" \
  -f lavfi -i "aevalsrc='sin(2*PI*2715*t)':d=0.40:s=48000" \
  -filter_complex "[0:a]volume=volume='0.90*exp(-t*9)':eval=frame[f];[1:a]volume=volume='0.11*exp(-t*17)':eval=frame[h];[f][h]amix=inputs=2:normalize=0,lowpass=f=5000,afade=t=in:st=0:d=0.004,afade=t=out:st=0.386:d=0.014,aresample=48000" \
  -ar 48000 -ac 1 -c:a pcm_s16le -map_metadata -1 /tmp/sfxraw/chime.wav
```

**Budget it.** A payoff cue used more than a handful of times per episode stops
being a payoff. If a number is not the point of its beat, it gets a `tick`.

### `drop` — sub weight under a large number or a full-frame change

A 120→38 Hz descending glide. `thud`'s job, one octave lower and moving —
`thud` is a hit, `drop` is weight arriving.

- **Duration** 260 ms · **Centroid** 84 Hz · **Measured peak** −12.0 dB
- **Gain** `0.398` → effective **−20.0 dBFS**, level with `thud`

```bash
ffmpeg -y -f lavfi -i "aevalsrc='sin(2*PI*(120*t-157.69*t*t))':d=0.26:s=48000" \
  -af "volume=volume='0.95*exp(-t*6)':eval=frame,lowpass=f=200:poles=2,afade=t=in:st=0:d=0.004,afade=t=out:st=0.238:d=0.022,aresample=48000" \
  -ar 48000 -ac 1 -c:a pcm_s16le -map_metadata -1 /tmp/sfxraw/drop.wav
```

**Never schedule `drop` and `thud` within ~10 frames of each other.** They are
the only two cues with meaningful sub-bass energy, and two of them at −20.0 dBFS
sum to roughly −14 dBFS — which eats the headroom the "thud landing on the
−4.1 dBTP narration peak still clears −1 dBTP" argument in `SfxLayer.tsx`
depends on. Pick one.

### `fall` — the slow path, or the thing that fails

A dull 480→175 Hz descending glide, low-passed at 1200 Hz so it reads as a
spin-down rather than a comedy slide-whistle. The counterpart to `chime`: the
two verdict cues, one good and one bad.

- **Duration** 450 ms · **Centroid** 345 Hz · **Measured peak** −12.0 dB
- **Gain** `0.299` → effective **−22.5 dBFS**

```bash
ffmpeg -y -f lavfi -i "aevalsrc='sin(2*PI*(480*t-338.89*t*t))':d=0.45:s=48000" \
  -af "volume=volume='0.90*exp(-t*3.2)':eval=frame,lowpass=f=1200:poles=2,afade=t=in:st=0:d=0.006,afade=t=out:st=0.418:d=0.032,aresample=48000" \
  -ar 48000 -ac 1 -c:a pcm_s16le -map_metadata -1 /tmp/sfxraw/fall.wav
```

Kept quiet on purpose. A failure beat that shouts is editorializing, and this
channel explains rather than reacts.

---

## Adding the fourteenth cue

1. Name the on-screen event it exists for, in one clause. If you can't, stop.
2. Check the spectral map for a free slot; if there isn't one, differentiate by
   envelope instead and say so in this file.
3. Synthesize with `anoisesrc` / `aevalsrc` only. Use `aevalsrc` for tones —
   `sine` is not unity-amplitude. Every `anoisesrc` **must** carry an explicit
   `seed=`, or the command in this file does not reproduce the asset.
4. Peak-normalize to −12.0 dBFS with the command above, then **verify**:
   `ffmpeg -i FILE -af volumedetect -f null /dev/null` must print
   `max_volume: -12.0 dB`. Not "should" — run it.
5. Confirm format: `ffprobe` must report `pcm_s16le`, 48000, 1 channel.
6. Add it to `SfxName`, `SFX_SRC` and `SFX_GAIN` in `SfxLayer.tsx`, place it in
   the gain ladder relative to its neighbours, and write the comment explaining
   _why that level_ — not what the number is.
7. Add its row and its exact command to this file. An asset without a command
   here is a licensing liability, because nobody can prove where it came from.
8. `npx tsc --noEmit` must pass with zero errors.

## Verification log

All thirteen files re-measured with
`ffmpeg -i public/sfx/NAME.wav -af volumedetect -f null /dev/null` after the
e006 additions. Every one reports `max_volume: -12.0 dB`, `pcm_s16le`, 48000 Hz,
1 channel, 16-bit. The five e005 assets and both beds (`bed.wav`,
`bed-005-continuous.wav`) were confirmed unmodified by md5 and mtime.

Reproducibility spot-checked by re-running the documented `click`, `swish` and
`chime` commands verbatim and comparing md5 against the shipped files: all three
bit-exact. `npx tsc --noEmit` passes with zero errors.

Not verified: **none of this has been listened to.** Every claim above is a
measurement — duration, peak, centroid, spectral flatness, checksum. Whether
`chime` actually reads as tasteful rather than as a notification, and whether
`fall` reads as a spin-down rather than a slide-whistle, are judgements only the
human first-pass listen can make. Treat the numbers as a floor, not a verdict —
same relationship the video-grader has to the human watch.
