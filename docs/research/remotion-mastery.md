# Remotion 4.x Mastery — Reference for Writing Broadcast-Quality Video Code

Compiled 2026-08-24 from remotion.dev docs, the remotion-dev GitHub org (github-unwrapped source), and community material. Project context: this repo pins `remotion@4.0.507`, React 19, 1920x1080 @ 30fps. Where v5 changes a default, it is flagged.

---

## 1. Mental model

A video is a pure function of the frame number. Every visual state must derive from `useCurrentFrame()` — never from wall-clock time, effects, or CSS animation clocks. The first frame is `0`, the last is `durationInFrames - 1`. `useVideoConfig()` supplies `{fps, durationInFrames, width, height}`; never hardcode fps into math.
Docs: https://www.remotion.dev/docs/the-fundamentals

During rendering, Remotion opens many headless browser tabs in parallel, each screenshotting arbitrary frames out of order. This single fact explains most pitfalls (§10): anything not derived deterministically from the frame number breaks.

---

## 2. Architecture for multi-scene videos

### Composition registry
Register each renderable unit in `src/Root.tsx` with `<Composition id component durationInFrames fps width height defaultProps schema calculateMetadata />`. Use `<Folder>` to group compositions in Studio and `<Still>` for thumbnails/OG images. Pattern proven in GitHub Unwrapped's `remotion/Root.tsx`: register the full video *and* every scene as its own composition so scenes can be iterated on in isolation.
Docs: https://www.remotion.dev/docs/composition · repo: https://github.com/remotion-dev/github-unwrapped

### Scene modules own their duration
The strongest organizational pattern in github-unwrapped (`remotion/Main.tsx`): each scene directory exports its component **plus** duration constants or a duration function:

```tsx
// Scene module exports
export const CONTRIBUTIONS_SCENE_DURATION = 120;
export const getIssuesDuration = ({issuesClosed, issuesOpened}) => ...;
```

The top-level `Main` component lays scenes out with `<Series>`, using negative `offset` values equal to each scene's exit-transition length so scenes overlap during their transitions:

```tsx
<Series>
  <Series.Sequence durationInFrames={OPENING_SCENE_LENGTH}>
    <OpeningScene ... />
  </Series.Sequence>
  <Series.Sequence
    durationInFrames={getIssuesDuration({issuesClosed, issuesOpened})}
    offset={-TOP_LANGUAGES_EXIT_DURATION}   // negative = overlap previous scene
  >
    <Issues ... />
  </Series.Sequence>
</Series>
```

Total duration is then computed in one place as (sum of scene durations − sum of overlaps) and returned from `calculateMetadata`, so the timeline never drifts from the layout:

```tsx
export const mainCalculateMetadata: CalculateMetadataFunction<Schema> =
  ({props}) => ({durationInFrames: calculateDuration(props), props});
```

### calculateMetadata
Runs **once** per render (not per tab), may be async, receives `{props, defaultProps, abortSignal, compositionId, isRendering}`, and can return `durationInFrames`, `fps`, `width`, `height`, transformed `props`, and per-composition render defaults (`defaultCodec`, `defaultOutName`, `defaultVideoImageFormat`, etc.). This is the right place for data fetching, true randomness, and duration-from-data (e.g. set duration from an audio file's length). Values it returns override composition props but are overridden by explicit render options.
Docs: https://www.remotion.dev/docs/calculate-metadata

### Data-driven props & schemas
- `defaultProps` = fallback for preview; **input props** (`--props='{"x":1}'` or `inputProps` in SSR APIs) override them at render time. Everything must be JSON-serializable. https://www.remotion.dev/docs/passing-props
- Attach a Zod schema via the `schema` prop; Studio renders editable controls from it. `@remotion/zod-types` adds `zColor()`, `zTextarea()`, `zMatrix()`. Derive the component type with `z.infer<typeof schema>` so props, schema, and component never diverge. https://www.remotion.dev/docs/schemas

### Sequence / Series semantics
- `<Sequence from={30} durationInFrames={30}>` — children's `useCurrentFrame()` is shifted so frame 30 of the composition is frame 0 inside; children unmount outside the window. Nesting cascades offsets (60 inside 30 → starts at 90). `layout="absolute-fill"` (default) vs `"none"`. https://www.remotion.dev/docs/sequence
- `<Series>` plays `<Series.Sequence>` children back-to-back; `offset` shifts (negative overlaps), only the last child may be `Infinity`. Since 4.0.443 `Series` defaults to `layout="none"`. https://www.remotion.dev/docs/series
- `premountFor={frames}` (4.0.140+) mounts a sequence invisibly (opacity 0, frame frozen at 0) ahead of time so media/fonts load before it appears — use on any sequence containing `<Video>`/`<Img>` with remote sources. In v5 all sequences premount 1s by default; in 4.x you must opt in. https://www.remotion.dev/docs/player/premounting
- `<Loop durationInFrames={50} times={2}>` for repetition; `useLoop()` gives `{iteration, durationInFrames}` inside. https://www.remotion.dev/docs/loop
- `<Freeze frame={n}>` holds children at one frame.

---

## 3. Animation toolkit

### spring()
`spring({frame, fps, config, from, to, durationInFrames, delay, reverse})` → number (default 0→1, may overshoot).
Config defaults: `mass: 1`, `damping: 10`, `stiffness: 100`, `overshootClamping: false`.
Docs: https://www.remotion.dev/docs/spring

Practical presets:
- **Default** `{damping: 10}` — very bouncy; rarely what you want for UI-style motion.
- **Smooth, no bounce**: `{damping: 200}` — the config used pervasively in Remotion's own templates and github-unwrapped; settles cleanly.
- **Snappy with slight overshoot**: `{damping: 15, stiffness: 150}` or `{damping: 12, mass: 0.5}`.
- **Heavy/slow**: increase `mass` (e.g. `mass: 3`); lower mass = faster.
- Pin exact length with `durationInFrames: 40` (stretches the curve) rather than fiddling with physics; order of operations is stretch → reverse → delay. `measureSpring({fps, config})` returns natural duration. Interactive tuner: https://www.remotion.dev/timing-editor

Springs compose: `const scale = spring(...); const x = interpolate(scale, [0, 1], [200, 0])` — drive any property from the 0–1 spring. For an enter+exit, add two springs: `enter - exit` where `exit = spring({frame: frame - exitStart, ...})`.

### interpolate()
`interpolate(input, inputRange, outputRange, options)`. Ranges must be equal-length, monotonically increasing input. Multi-segment keyframing: `interpolate(frame, [0, 20, 60, 100], [0, 1, 1, 0])` is the canonical fade-in/hold/fade-out. **Always pass `extrapolateLeft/Right: 'clamp'` unless extrapolation is intentional** — the default `'extend'` continues the line beyond the range and is a top source of "why is my element off-screen at frame 0". Easing can be one function or an array of `inputRange.length - 1` functions (per segment).
Docs: https://www.remotion.dev/docs/interpolate

Related: `interpolateColors(frame, [0, 30], ['#f00', '#00f'])` for colors.

### Easing catalog
`Easing.linear`, `.ease`, `.quad`, `.cubic`, `.poly(n)`, `.sin`, `.circle`, `.exp`, `.elastic(bounciness)`, `.back(s)`, `.bounce`, `.bezier(x1,y1,x2,y2)`, `.step0/.step1`, wrapped by modifiers `Easing.in()`, `Easing.out()`, `Easing.inOut()`. Standard polish move: `easing: Easing.out(Easing.cubic)` for decelerating entrances; `Easing.inOut(Easing.ease)` for camera-style pans.
Docs: https://www.remotion.dev/docs/easing

### Speed remapping
From github-unwrapped (`remap-speed.tsx`) — remap time by integrating a per-frame speed function, then feed the remapped frame into child animations:

```tsx
const remapSpeed = (frame: number, speed: (fr: number) => number) => {
  let framesPassed = 0;
  for (let i = 0; i <= frame; i++) framesPassed += speed(i);
  return framesPassed;
};
```

Also documented as the accelerated-video pattern in Remotion's snippets.

---

## 4. Audio

`<Audio>` (in 4.x from `remotion`; docs now call the underlying tag `<Html5Audio>`) props: `src` (use `staticFile()`), `volume` (0–1 static **or** `(f) => number` per frame — `f` is relative to when the audio starts), `trimBefore`/`trimAfter` in frames (replaces deprecated `startFrom`/`endAt`), `playbackRate` (0.0625–16), `loop`, `muted` (frame-switchable), `toneFrequency` (0.01–2, render-only pitch), `name` (timeline label), `useWebAudioApi` (volumes > 1, iOS control; needs CORS), `pauseWhenBuffering`, `loopVolumeCurveBehavior: 'repeat' | 'extend'`.
Docs: https://www.remotion.dev/docs/audio

Patterns:
- **Fade music in/out**: `volume={(f) => interpolate(f, [0, 30], [0, 1], {extrapolateLeft: 'clamp'})}`.
- **Delay audio**: wrap in `<Sequence from={n}>`. Combine with `trimBefore` to start mid-file — github-unwrapped plays a landing sound at video end: `<Sequence from={durationInFrames - 230}><Audio startFrom={170} src={staticFile('landing.mp3')} /></Sequence>`.
- **Duck music under narration**: volume callback that dips over the narration window (multi-segment interpolate).
- **Sync visuals to a voice track**: with word-level timestamps (this repo's `words.json`), convert seconds → frames (`Math.round(sec * fps)`) and place `<Sequence from>` cues; this is exactly the model Remotion's captions guides use (`@remotion/captions` types).

### Audio visualization
`@remotion/media-utils`:
- `useAudioData(src)` — loads whole file into memory (fine for short clips); `useWindowedAudioData` streams a window around the current frame (requires `.wav`, right choice for long narration).
- `visualizeAudio({audioData, frame, fps, numberOfSamples})` → array of amplitudes (one per frequency band; 16 samples = 16 bars). Map to bar heights for spectrum bars.
- `visualizeAudioWaveform()` + `createSmoothSvgPath()` for waveform lines.
Docs: https://www.remotion.dev/docs/audio-visualization

---

## 5. Polish packages

### @remotion/paths — https://www.remotion.dev/docs/paths
Dependency-free SVG path math: `parsePath`, `serializeInstructions`, `getLength`, `getPointAtLength`, `getTangentAtLength`, `evolvePath`, `interpolatePath`, `reversePath`, `normalizePath`, `translatePath`, `scalePath`, `warpPath`, `getBoundingBox`, `extendViewBox`, `resetPath`, `cutPath`, `getSubpaths`.

**Line-draw (the #1 polish technique)** — https://www.remotion.dev/docs/paths/evolve-path:

```tsx
const progress = spring({frame, fps, config: {damping: 200}});
const {strokeDasharray, strokeDashoffset} = evolvePath(progress, d);
return <path d={d} fill="none" stroke="#fff" strokeWidth={6}
  strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />;
```

Progress 0 = invisible, 1 = fully drawn; >1 or <0 reverses. Use `reversePath(d)` to draw from the other end. Add `strokeLinecap="round"` for a polished pen look.

**Motion along a path with orientation** — https://www.remotion.dev/docs/paths/get-point-at-length and /get-tangent-at-length:

```tsx
const length = getLength(d);
const p = getPointAtLength(d, length * progress);
const t = getTangentAtLength(d, length * progress);
const angle = (Math.atan2(t.y, t.x) * 180) / Math.PI;
// style: transform: `translate(${p.x}px, ${p.y}px) rotate(${angle}deg)`
```

**Morphing**: `interpolatePath(progress, pathA, pathB)` (paths should be structurally compatible; normalize first for robustness). `warpPath` bends paths with a function — good for wavy/organic strokes.

### @remotion/shapes — https://www.remotion.dev/docs/shapes
`<Rect>`, `<Circle>`, `<Ellipse>`, `<Triangle>`, `<Star>`, `<Pie>`, `<Polygon>`, `<Heart>` plus `makeRect()` etc. that return `{path, width, height}` — feed those paths into `evolvePath`/`interpolatePath`. Key props: `edgeRoundness`, `cornerRadius`. `<Pie progress={0.5}>` is a ready-made radial progress/clock-wipe primitive.

### @remotion/noise — https://www.remotion.dev/docs/noise/noise-2d
`noise2D(seed, x, y)`, `noise3D`, `noise4D` → value in [-1, 1], deterministic per seed (simplex noise). Organic drift pattern: `const dx = noise2D('drift-x', frame * 0.01, 0) * 20;` — small time multiplier (0.005–0.02) = slow wander; use different seeds per axis/element. Ideal for floating particles, camera sway, imperfect hand-drawn feel.

### @remotion/motion-blur — https://www.remotion.dev/docs/motion-blur
- `<Trail layers={n} lagInFrames={f} trailOpacity={o}>` — duplicates children with time offsets (echo/trail). Children must be absolutely positioned (`AbsoluteFill`).
- `<CameraMotionBlur shutterAngle={180} samples={10}>` — film-style blur by averaging sub-frame renders. Defaults: shutterAngle 180 (film standard at 24fps), samples 10; keep samples 5–10 — it multiplies render cost and is "destructive to colors". Wrap the whole moving scene, not individual elements.

### @remotion/transitions — https://www.remotion.dev/docs/transitioning
`<TransitionSeries>` with `<TransitionSeries.Sequence durationInFrames>` and `<TransitionSeries.Transition presentation timing>`.

- **Duration math**: transitions overlap scenes, so total = sequences − transitions (40 + 60 with a 30-frame transition = 70). Account for this in `calculateMetadata`.
- **Rules**: a transition may not be longer than either adjacent sequence; no two adjacent transitions.
- **Timings**: `linearTiming({durationInFrames, easing?})`, `springTiming({config: {damping: 200}, durationInFrames: 30, durationRestThreshold: 0.001})` — set `durationRestThreshold: 0.001` to avoid a visible cutoff; `timing.getDurationInFrames({fps})` gives the exact overlap for duration math. https://www.remotion.dev/docs/transitions/timings/springtiming
- **Presentations**: `fade()`, `slide()`, `wipe()`, `flip()`, `clockWipe({width, height})`, `iris()`, `cube()` (paid ProRes-style addon in docs), `none()`.
- **Custom presentations** — https://www.remotion.dev/docs/transitions/presentations/custom: a presentation is `(props) => ({component, props})` where the component receives `{children, presentationDirection: 'entering' | 'exiting', presentationProgress: 0..1, passedProps}`. Typical shape: apply a clip-path/transform to the entering slide as a function of `presentationProgress`, render exiting slide untouched. This is how you build branded wipes (e.g. logo-shaped masks) — the docs demo a star-mask via SVG `clipPath`.

### @remotion/layout-utils — https://www.remotion.dev/docs/layout-utils/measure-text
- `measureText({text, fontFamily, fontSize, fontWeight, letterSpacing, validateFontIsLoaded: true})` → `{width, height}`. Pass the **exact same** font styles as the rendered element. `validateFontIsLoaded` re-measures with the fallback font and throws if identical — catches font races.
- `fitText({text, withinWidth, fontFamily, ...})` → `{fontSize}` — shrink-to-fit headlines. `fillTextBox()` exists for word-wrapping into a box (multi-line fitting).
- Only measure **after** fonts are loaded (await `waitUntilDone()` / `loadFont()` promise first).

### Fonts — https://www.remotion.dev/docs/fonts
- `@remotion/google-fonts`: `import {loadFont} from '@remotion/google-fonts/Inter'; const {fontFamily, waitUntilDone} = loadFont('normal', {weights: ['400', '700'], subsets: ['latin']});` — type-safe, automatically blocks the render until ready. Load only the weights/subsets you use. https://www.remotion.dev/docs/google-fonts/load-font
- Local fonts: `@remotion/fonts` `loadFont({family, url: staticFile('font.woff2')})` (4.0.164+).
- Manual: `new FontFace(...)` + `document.fonts.add` + `delayRender`/`continueRender`.
- **Race prevention**: load all fonts in one shared module imported by Root, not per-component.

---

## 6. Images and media

- **`<Img src={staticFile('logo.png')} />`** — always over `<img>`: it delays the render until the image is decoded, preventing captured-while-loading frames. Remote URLs are fine as `src`. Assets live in `public/`; `staticFile()` resolves them. No `fs` access; 2GB asset limit; dynamic `require('img' + frame)` doesn't work — interpolate `staticFile()` strings instead (`staticFile(\`frame${frame}.png\`)`). https://www.remotion.dev/docs/assets
- **`<OffthreadVideo>`** — the 4.x workhorse for embedded video during server renders: extracts exact frames via FFmpeg outside the browser (frame-accurate, no flicker). Props: `src`, `trimBefore/trimAfter`, `playbackRate`, `volume`, `muted`, `transparent` (PNG extraction, slower), `toneMapped`. No `loop` prop (wrap in `<Loop>`), no reverse playback, renders as `<img>` at render-time vs `<video>` in preview. https://www.remotion.dev/docs/offthreadvideo — Note: latest docs recommend the newer `<Video>` from `@remotion/media` (auto-fallback, WebCodecs-based) for new projects; `OffthreadVideo` remains the battle-tested choice on 4.0.507.
- **Preloading** (Player/preview smoothness, not renders): `prefetch(url, {method: 'blob-url'})` from `remotion` fetches into memory and returns `{waitUntilDone, free}`; media components automatically use the blob. `method: 'base64'` works around Safari audio issues. Lighter alternative: `@remotion/preload`'s `preloadVideo`/`preloadAudio`. For render-time readiness, prefer `premountFor`. https://www.remotion.dev/docs/prefetch
- **delayRender contract** — https://www.remotion.dev/docs/delay-render: `const [handle] = useState(() => delayRender('label'))`, do async work in `useEffect`, then `continueRender(handle)`; `cancelRender(err)` on failure. Default timeout 30s (`delayRenderTimeoutInMilliseconds` to change). Prefer `calculateMetadata` for once-per-render fetches — component-level fetches run in **every** concurrent tab.

---

## 7. SVG animation specifics

- Line draws: `evolvePath` (§5) — cleaner than hand-rolling `stroke-dasharray: getLength(d)` / animating `stroke-dashoffset`, though that's exactly what it computes.
- `transform-box: 'fill-box'` + `transform-origin: 'center'` (or `transformOrigin` per element) fixes the classic "SVG child rotates around canvas origin" bug.
- Animate `viewBox` by interpolating its four numbers for camera moves inside an SVG scene.
- Staggered element entrances: map over elements, `spring({frame: frame - i * 3, ...})` per index.
- Everything in @remotion/shapes returns path strings — combine with paths functions for draw-on shapes.
- github-unwrapped is the reference codebase: `PullRequests/WholePaths.tsx` (multi-path line network draws), `make-random-path.ts` (seeded random path generation with `random()`), `StarSprite` (SVG sprite-sheet frame flipping via frame-indexed rendering).

---

## 8. 3D — @remotion/three

`npm i three @react-three/fiber @remotion/three`. `<ThreeCanvas width height>` bridges react-three-fiber and Remotion: use `useCurrentFrame()` directly inside instead of r3f's `useFrame()`; the canvas re-renders deterministically per frame. `useVideoTexture` / `useOffthreadVideoTexture` map Remotion video frames onto materials. **Critical**: renders need `--gl=angle` (CLI) or `chromiumOptions: {gl: 'angle'}` in SSR APIs, or Three renders black/blank server-side. https://www.remotion.dev/docs/three

---

## 9. Render quality and performance

Defaults (https://www.remotion.dev/docs/config, https://www.remotion.dev/docs/encoding):

| Setting | Default | Notes |
|---|---|---|
| codec | h264 | best speed/compatibility; YouTube re-encodes anyway |
| CRF | h264: 18 (range 1–51) | lower = better quality; 18 is visually near-lossless |
| Other CRF defaults | h265: 23, vp8: 9, vp9: 28, av1: 30 | |
| `--jpeg-quality` | 80 | screenshot quality per frame; raise to 90–95 for gradient-heavy frames |
| image format | jpeg | png only needed for transparency (much slower) |
| concurrency | ~half of CPU cores | tune with `npx remotion benchmark`; one unit = one browser tab |
| scale | 1 | `--scale=2` for supersampled stills |
| delayRender timeout | 30000ms | |

**YouTube-target recipe** (1080p30): default h264 + `--crf=16`–18, `--jpeg-quality=90`, audio AAC (default) at 320k (`--audio-bitrate=320k`) — quality ceiling above YouTube's own transcode, reasonable file size. For a mastering-grade intermediate, render ProRes (`--codec=prores`, fast encode, huge files). GIFs: `--codec=gif`.

**Bottlenecks** (https://www.remotion.dev/docs/performance):
- GPU-dependent CSS (`filter: blur()`, `box-shadow` at scale, WebGL) is slow in headless Chrome and terrible on GPU-less cloud machines — pre-render such layers to images where possible; or `--gl=angle` locally.
- Expensive JS per frame: memoize with `useMemo` (e.g. github-unwrapped memoizes soundtrack selection, position computations).
- Data fetching per tab — hoist to `calculateMetadata`.
- `--log=verbose` reports slowest frames; `console.time` inside components works.
- VP8/VP9/AV1 encode slowly; h264/ProRes are fast.

**Scale-out patterns** (github-unwrapped README): cache rendered videos keyed on input data; lock per-user renders (DB lock) to avoid duplicate work; distribute across Lambda regions/accounts for concurrency limits.

---

## 10. Pitfalls catalogue (each = flicker or preview/render mismatch)

Root cause of nearly all: parallel tabs render frames out of order and don't share state. https://www.remotion.dev/docs/flickering

1. **`Math.random()`** — different per tab → flicker. Use `random(seed)` from `remotion` (deterministic, same seed = same value everywhere): `random(\`x-${i}\`)`. `random(null)` opts out intentionally. True randomness is safe only in `calculateMetadata` (runs once). https://www.remotion.dev/docs/using-randomness
2. **`Date.now()` / `new Date()` / `performance.now()`** — wall-clock time varies per tab and frame-capture instant. Derive all time from `useCurrentFrame() / fps`; pass real dates in via input props.
3. **CSS transitions/animations, `requestAnimationFrame`, setTimeout-driven state** — run on the browser clock, not the frame clock; tabs screenshot mid-animation at unpredictable points. Rewrite as interpolate/spring of `frame`. Also avoid animation libraries that self-drive (Framer Motion autonomous animations, GSAP timelines) unless frame-synced.
4. **Un-Remotion media tags** — raw `<img>`, `<video>`, `<audio>`, CSS `background-image`/`mask-image` don't block rendering while loading → half-loaded frames. Use `<Img>`, `<OffthreadVideo>`/`<Video>`, `<Audio>`, `<Gif>` (from `@remotion/gif`), or `delayRender` around manual loading.
5. **Font races** — text measured or rendered before the webfont arrives (fallback font flashes, `measureText` returns wrong widths). Load fonts in a shared module via `@remotion/google-fonts`/`@remotion/fonts`; keep `validateFontIsLoaded: true`.
6. **Missing `extrapolate*: 'clamp'`** — animations "start" before frame 0 or overshoot after their range.
7. **Effects/state accumulating across frames** (`useEffect` incrementing state, physics engines stepping per render) — frames render out of order; state must be recomputed from scratch per frame (integrate deterministically like `remapSpeed`, §3).
8. **`<Html5Video>`/legacy `<Video>` stutter in renders** — browser seeking isn't frame-accurate; use `<OffthreadVideo>` (or `@remotion/media` `<Video>`).
9. **"It works with `--concurrency=1`"** — coincidence (render speed ≈ playback speed), not correctness; will differ across machines. Fix the determinism instead.
10. **defaultProps too big** — huge JSON payloads slow Studio and break CLI arg limits; move bulk data behind `calculateMetadata` fetch or `staticFile` JSON.
11. **Three.js black frames on servers** — forgot `--gl=angle` (§8).
12. **Content jumps at sequence boundaries** — remember children of `<Sequence>` see a *shifted* frame; animate from local frame 0, and unmount/mount is exact (`durationInFrames` exclusive of the next frame).

---

## 11. Quick idioms

```tsx
// Scene entrance: slide + fade with smooth spring
const enter = spring({frame, fps, config: {damping: 200}});
const style = {opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`};

// Staggered list
items.map((item, i) => {
  const s = spring({frame: frame - i * 4, fps, config: {damping: 200}});
  ...
});

// Exit before scene end
const exit = spring({frame: frame - (durationInFrames - 20), fps, config: {damping: 200}});
const opacity = enter - exit;

// Counter that ticks like a stat card
const value = Math.round(interpolate(frame, [0, 45], [0, target], {
  easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp',
}));
```

Sources: remotion.dev/docs (fundamentals, api, techniques), github.com/remotion-dev/github-unwrapped (+ 2021/2022 editions), remotion.dev/docs/flickering, remotion.dev/timing-editor, Jonny Burger's React Summit talk repo (github.com/JonnyBurger/react-summit-talk — the talk itself is a Remotion video), Syntax #550 & PodRocket interviews.
