# capture/ — autonomous visual acquisition

The build step fetches its own images and screenshots. **You never gather
assets by hand.** You write a visual cue in `script.yaml`; `acquire` resolves
it through anonymity + license gates and writes `assets.json` for the render.

## Use

```bash
npm run acquire episodes/003-vibe-coding-hangover
```

Run from the repo root. It reads that episode's `script.yaml`, resolves every
capturable visual cue, writes assets into `public/ep-<slug>/`, appends
`credits.md`, and writes `episodes/NNN/assets.json`. Idempotent-ish: re-running
re-fetches (files are content-hashed by source, so identical sources overwrite
in place). A failure exits non-zero and names the cue — the render never runs
on a missing or leaked asset.

## Cue schema (in `script.yaml` under a beat's `visual:`)

```yaml
# fetch a license-clean stock/reaction image by text query
visual:
  kind: image                     # or `meme` — same fetcher
  query: "confused person at laptop"
  annotate: { circle: [960, 400, 120] }   # optional: cx, cy, r in 1920x1080
  land_at: some_mark              # optional: sync to a <mark id="..."/>

# screenshot a real page / headline (Ken-Burns + circle applied at render)
visual:
  kind: browser_capture
  source_url: "https://en.wikipedia.org/wiki/Vibe_coding"
  selector: "article header"      # optional: crop to one element
  annotate: { circle: [1200, 260, 90] }
  land_at: some_mark
```

A beat gets exactly ONE `visual:`. Two sibling keys sit alongside it, so a beat
whose primary picture is a designed animation can still carry a background and
its sources:

```yaml
# background texture layer, resolved independently of the foreground visual
broll: { query: "server room racks", kind: video }   # kind: video | image

# SECONDARY source screenshots — small evidence insets shown while a quote is
# read, never the beat's main picture ("real headline screenshots only as
# receipts"). Any number per beat.
receipts:
  - source_url: "https://www.stroustrup.com/Software-for-infrastructure.pdf"
    selector: "..."             # optional: crop to one element
    annotate: { circle: [800, 300, 90] }   # optional
    land_at: some_mark          # optional: sync to a <mark id="..."/>
```

`broll` lands in `assets.json` as `{ broll: {...} }` and `receipts` as
`{ receipts: [ {...}, ... ] }`, both under the beat id. `check_credits` verifies
every one of those files individually — a beat can carry three assets and all
three must be attributed.

**PDF sources work.** A `source_url` ending in `.pdf` is routed to
`capture_pdf.ts` instead of Playwright — headless Chromium has no PDF viewer, so
`page.goto()` on a PDF aborts with "Download is starting". The PDF path fetches
the bytes, rasterises page 1 via macOS `qlmanage`, and runs the *same* anonymity
gate (OCR on the rendered pixels) and the same `credits.md` write. Receipt
grammar for a paper is therefore "its cover page" — quote the line in-engine
rather than trying to zoom into the PDF. (On Linux, swap `qlmanage` for
`pdftoppm -png -f 1 -l 1`; nothing else changes.)

`kind:` and the legacy `type:` are both accepted. `screen_recording` (Playwright
video of a scrolling article / AWS-style page) is **phase 2** — the browser
launcher already supports `recordVideo`; the scroll-record script + an
`OffthreadVideo` scene component are the remaining pieces.

## What's guaranteed automatically

- **Anonymity gate** (`lib/anonymity.ts`): every capture's page text + pixels
  (OCR via tesseract) are scanned for the strings in `forbidden.json` and any
  `/Users/<name>/` or `/home/<name>/` path. A hit **discards the capture** and
  fails the run — nothing reaches `public/`.
- **License gate** (`lib/license.ts`): BY-SA / NC / ND / GFDL / unknown are
  rejected; only commercial-clean images are kept. Every asset is credited in
  `credits.md` (title, author, source, license, retrieval date).
- **Clean browser** (`lib/browser.ts`): throwaway temp profile, no extensions,
  no login, muted audio (no Content-ID), neutral locale/timezone. Deleted after.
- Images are re-encoded through `sharp` → EXIF (GPS/author) stripped. Screenshots
  are 2x (crisp under zoom).

## Setup notes

- `forbidden.json` is **gitignored** — it's the only place real identity strings
  live. Add your display/legal name to `names` so it's caught in article text.
  The home-path check works out of the box.
- Keyless sources: **Openverse** (primary) + **Wikimedia Commons** (fallback).
  To add Pexels/Unsplash later, drop keys in `.env` and extend `fetch_image.ts`.
- Deps: `playwright` (+ `npx playwright install chromium`), `sharp`, `tsx`,
  `yaml`, `node-tesseract-ocr`, and the `tesseract` binary (`brew install
  tesseract`). The human anonymity review (how-to step 7) still runs after —
  this gate is defense-in-depth, not a replacement.

## Render side

`assets.json` maps `beat.id → { file, w, h, circle, land_at, ... }`. In the
episode composition, feed each into `<AnnotatedImage>` (see
`src/components/AnnotatedImage.tsx`): slow Ken-Burns push-in, always-on drift,
and an optional SVG ring that draws on. Screenshots and fetched images use the
same component.
