# Sourcing guardrails — the enforceable spec

This is the **programmatic gate** for a pseudonymous, monetized, faceless tech
channel. It has two jobs and both are blocking:

1. **Provenance.** Every visual asset and every factual claim carries a
   traceable **URL**. No URL → the asset/claim does not ship.
2. **Anonymity.** Nothing in any frame, filename, metadata stream, or capture
   leaks the creator's real name, home path, employer, or credentials.

It extends `asset-sourcing.md` (licensing tiers, Content-ID, fair use) with the
parts a build agent can *check in code*: a source allowlist, a capture
**domain denylist**, a URL-provenance rule, and a final-render anonymity
checklist. Where `asset-sourcing.md` already rules on something, this file
points at it rather than repeating it.

Label convention as in `asset-sourcing.md`: `[license-text]` `[official]`
`[practitioner]` `[folklore]`. Legal notes are operating rules, not legal advice.

---

## 0. The two invariants (never violated)

- **R0.1 — URL-or-it-doesn't-exist.** Every asset row in `assets.json`/`credits.md`
  MUST have a resolvable `source_url`. Every factual claim rendered on screen or
  spoken MUST be traceable to a public URL in the script's sources, or be tagged
  `[VERIFY: claim]` per CLAUDE.md rule 4. The build fails on a missing URL, not warns.
- **R0.2 — Anonymity beats everything.** If an asset is license-clean but leaks
  identity (a name in article text, a `/Users/<name>/` path in a screenshot, EXIF
  GPS, a C2PA author field), it is **discarded**. Anonymity is a hard gate that
  runs *after* the license gate and can only subtract, never add. This is already
  the order in `lib/anonymity.ts` → keep it.

---

## 1. Commercial-clean source allowlist (extends asset-sourcing.md §1)

The build's `fetch_image.ts` may only pull from sources on this allowlist. Anything
else is Tier C and rejected. This is the machine-checkable form of the tiers.

### 1A — Allowed, commercial-clean, no attribution (Tier A)

`Openverse` (filtered to CC0/PDM/BY only — see R1.2), `Wikimedia Commons`
(per-file, PD or CC BY only — reject BY-SA/GFDL), `Unsplash`, `Pexels`,
`Pixabay`, `NASA` imagery, `BLS`/`.gov` public-domain data. Terms and gotchas
are in `asset-sourcing.md §1` — do not re-derive them here. `[license-text]`

### 1B — Allowed, attribution is a license condition (Tier B)

`Flaticon`, `Icons8`, `Font Awesome Free`, `The Noun Project`, `Wikimedia`
CC BY files. Every one emits a TASL line into `credits.md` → description block
(asset-sourcing.md §B1). **A Tier B asset with no attribution string written =
build failure**, because a failed license condition = no license (§B3).

### 1C — Rejected licenses (hard reject in `lib/license.ts`)

`BY-SA`, any `NC`, any `ND`, `GFDL`, and **unknown/untraceable**. This is
already implemented — R1.3 just says never loosen it. There is always a BY/PD
alternative (asset-sourcing.md §B2). `[license-text]`

**R1.1 — Allowlist is a closed set.** `fetch_image.ts` resolves ONLY from §1A/§1B
domains. A source not on the list is treated as Tier C and the run fails naming
the cue. Adding a source requires a canonical license-page URL recorded in this
file first.

**R1.2 — Openverse/aggregators are not license authorities.** Openverse
re-indexes other sites and its license tag can be stale. For any Openverse hit,
the license used is the one on the **canonical `foreign_landing_url`**, and that
URL (not the Openverse URL) is what goes in `credits.md`. Reject if the canonical
license is BY-SA/NC/ND/unknown even when Openverse labels it CC BY. `[practitioner]`
https://api.openverse.org/v1/ (per-result `license` + `foreign_landing_url`)

**R1.3 — Getty/Adobe/Shutterstock/Alamy are Tier C, full stop.** Their previews
are watermarked and fingerprinted; using them (even de-watermarked) is TOS
violation + Content-ID exposure, and watermark removal is itself a red flag.
Never fetch from stock-agency domains — they are on the capture denylist (§2).
`[practitioner]` https://www.gettyimages.com/api ,
https://community.adobe.com/questions-38/adobe-stock-images-suddenly-disappeared-from-reverse-image-search-results-google-lens-tineye-etc-317336

**R1.4 — "Royalty-free from a random channel/site" is Tier C.** Music/SFX only
from the YouTube Audio Library (standard tracks) or a documented subscription
license archived in the episode dir (asset-sourcing.md §5, §M1/M2). YouTube
itself disclaims third-party "royalty-free" libraries. `[official]`
https://support.google.com/youtube/answer/3376882

**R1.5 — Charts are rebuilt, never screenshotted.** No chart image from any
source enters the pipeline; charts are Remotion components from raw public data
with a source cite (asset-sourcing.md §3, Rule C1–C4). Screenshotting
Statista/FRED-third-party/a blog's chart is a hard reject.

---

## 2. Capture domain denylist (enforced in `capture/`)

`browser_capture` and future `screen_recording` cues run a throwaway clean
browser. Before navigation, the target host is checked against the denylist
below. **A denylisted host aborts the capture and fails the run** — this is the
single most important new gate, because it is the vector that leaks identity
*and* invites strikes.

**R2.1 — Never capture DRM / streaming video.** DMCA §1201 makes circumventing a
technological protection measure unlawful with **no infringement nexus required**
— recording content you pay for still violates it, and these hosts also black-out
the frame. Never capture:
`netflix.com`, `youtube.com/watch` (video player), `hulu.com`, `disneyplus.com`,
`max.com`/`hbomax.com`, `primevideo.com`, `amazon.com/*/video`, `peacocktv.com`,
`paramountplus.com`, `appletv.com`/`tv.apple.com`, `spotify.com` (player),
`music.apple.com`, `twitch.tv`, `crunchyroll.com`, `mubi.com`. `[official]`
https://copyrightalliance.org/education/copyright-law-explained/the-digital-millennium-copyright-act-dmca/section-1201-technology-protection/
, https://www.copyright.gov/policy/1201/

**R2.2 — Never capture paywalled / metered publisher content.** A screenshot of
a paywalled article is both a copyright reproduction and a TOS breach even when
you link the source; linking is fine, reproducing the body is not. Denylist the
article body of:
`nytimes.com`, `wsj.com`, `ft.com`, `bloomberg.com`, `economist.com`,
`theinformation.com`, `washingtonpost.com`, `wired.com` (metered),
`newyorker.com`, `businessinsider.com` (metered), `medium.com` (member-only),
`statista.com`. Use the primary public source, a press release, or an official
docs page instead. `[practitioner]`
https://biid.org.uk/resources/are-you-risking-fine-sharing-your-online-and-printed-press-coverage

**R2.3 — Never capture login-walled / private surfaces.** Any page requiring
auth is off-limits: it risks capturing *your* logged-in session — real name,
avatar, email, org, notification text. The clean browser has no login, so a
page that renders a login form or an account chrome is aborted. Denylist chrome
of: `mail.google.com`, `*.slack.com`, `discord.com/app`, `*.atlassian.net`
(Jira/Confluence), `notion.so` (private), `linkedin.com/feed`,
`facebook.com`, `instagram.com` (logged-in), `github.com/*/settings`, any
`*.okta.com`/SSO page, any internal/corporate hostname. **Public repos, public
docs, public Wikipedia, public marketing pages are fine.** `[folklore]` (session
capture is the classic faceless-channel dox vector)

**R2.4 — Denylist match is host + path aware and default-deny on doubt.** Match
on registrable domain AND known player/paywall paths (e.g. allow
`youtube.com/@handle` channel page, deny `youtube.com/watch`). If the classifier
is unsure whether a host is DRM/paywall/login, it **fails closed** and names the
cue for a human. A missed capture is cheap; a leak or strike is not.

**R2.5 — Software UI and terminal captures still obey CLAUDE.md.** Screencasts of
apps/websites are fine editorially (asset-sourcing.md §6), but every capture uses
a **neutral home path** and **fake credentials**, system audio muted (no
Content-ID from embedded media). This is enforced at capture time, not left to
review.

---

## 3. URL provenance — every asset and every claim

**R3.1 — `assets.json` schema requires `source_url`.** The acquire step must
write, per asset: `source_url`, `license`, `author`, `title`, `retrieved_at`.
Any null/empty `source_url` → build fails naming the beat. `credits.md` is
generated from these rows; the two must stay 1:1.

**R3.2 — Screenshots record the captured URL, not a stock URL.** A
`browser_capture` asset's `source_url` is the exact page navigated to. It is
carried into `credits.md` as the receipt ("captured from <url>, <date>, clean
browser profile").

**R3.3 — Every on-screen factual claim maps to a source URL.** The script's
`sources:` block lists a URL per claim id; visuals asserting a number/quote
reference that id. A claim with no URL and no `[VERIFY:]` tag is a blocking
error (CLAUDE.md rule 4). Charts cite the raw dataset URL (BLS/10-K/etc.).

**R3.4 — Prefer primary over secondary.** When a claim traces to a news article,
chase it to the primary source (filing, official blog, standards doc, `.gov`
dataset) and cite that. Secondary-only claims stay `[VERIFY:]` until a primary
URL is found. Reduces both paywall-capture pressure (§2.2) and factual risk.

**R3.5 — Archive the receipt before render.** For any non-Tier-A asset and any
claim likely to be disputed, snapshot the source (URL + retrieval date, and a
saved copy for licensed music) into the episode dir *before* rendering. Evidence
must exist before the claim does (asset-sourcing.md §M2).

---

## 4. Final-render anonymity checklist (build-enforceable)

Runs on the finished `out/final.mp4` and every asset in `public/ep-<slug>/`. Each
item is pass/fail; any fail blocks publish. This is defense-in-depth *before* the
human review in how-to step 7, never a replacement.

- **R4.1 — No real name, anywhere.** OCR every sampled frame + grep every asset's
  page text/alt/filename against `forbidden.json` names. Any hit → fail. (Already
  in `lib/anonymity.ts`; extend it to sample rendered frames, not just captures.)
- **R4.2 — No home path.** Regex `\/(Users|home)\/[^\/\s]+\/` across OCR'd frames,
  filenames, and any visible terminal/editor chrome. Neutral path only.
- **R4.3 — No employer / internal identifiers.** `forbidden.json` includes the
  employer name, internal hostnames, and internal tool names (CLAUDE.md rules 2–3).
  OCR + text grep. Any hit → fail.
- **R4.4 — No real credentials.** Regex for token/key shapes
  (`sk-`, `AKIA`, `ghp_`, `AIza`, bearer/JWT patterns, `-----BEGIN * PRIVATE KEY`)
  in OCR'd frames. Any real-looking secret → fail; only obviously-fake values pass.
- **R4.5 — Strip file metadata on the final render.** Re-mux dropping metadata
  (`-map_metadata -1`) and confirm the output container has no `title`/`author`/
  `encoder`-name/`comment` tag carrying the creator's identity. Same as the audio
  step in how-to step 5, applied to video.
- **R4.6 — Strip EXIF/GPS on every image asset.** Every fetched/captured image is
  re-encoded through `sharp` (EXIF/GPS dropped) — verify no residual GPS/author
  block remains. EXIF is a top identity-leak vector for anonymous creators.
  `[practitioner]` https://mobilesms.io/blog/start-anonymous-youtube-channel-guide/
- **R4.7 — Flag AI-provenance markers on any AI-generated asset.** ElevenLabs
  audio carries SynthID + C2PA; AI images may carry C2PA Content Credentials
  (author/tool fields) and a SynthID pixel watermark. C2PA metadata is
  strippable, **SynthID is not** (it lives in pixels/audio and survives
  re-encode). Rule: published episodes use the **human recording**, not the
  clone (existing hybrid verdict); any AI *image* has its C2PA block inspected
  for an author/name field and stripped, and is used only where the SynthID
  watermark's presence is acceptable (non-photoreal, per asset-sourcing.md §AI1).
  `[official]`
  https://help.openai.com/en/articles/8912793-provenance-signals-content-credentials-synthid-in-openai-generated-content
- **R4.8 — Final human eyes/ears pass still required.** Full-screen, read every
  on-screen string, listen for any spoken name/employer. The gates above are
  belt-and-suspenders; the human review is the last line (how-to step 7).

---

## 5. Enforcement summary (what the build actually checks)

A build agent enforces this file as a sequence of hard gates. Order matters:

1. **Cue resolve** — source host ∈ §1 allowlist? else fail (R1.1).
2. **Denylist** — capture host ∉ §2 denylist (DRM/paywall/login), default-deny
   on doubt? else fail (R2.1–R2.4).
3. **License gate** — not BY-SA/NC/ND/GFDL/unknown; Openverse resolved to
   canonical URL; Tier B has attribution? else fail (R1.2–R1.3, §1C).
4. **Anonymity gate (capture-time)** — no name/home-path/employer in page text +
   OCR; EXIF stripped? else discard + fail (R0.2, R4.1–R4.3, R4.6).
5. **Provenance write** — every asset row has non-empty `source_url`; `credits.md`
   1:1 with `assets.json`; every on-screen claim has a URL or `[VERIFY:]`? else
   fail (R0.1, R3.1–R3.3).
6. **Final-render gate** — OCR + metadata scan of `out/final.mp4` and all assets
   for name/path/employer/credentials; metadata stripped; AI-provenance handled?
   else fail (R4.1–R4.7).
7. **Human review** — anonymity + accuracy eyes/ears (R4.8). Only then publish.

Any gate failing exits non-zero and names the offending cue/beat/frame. A render
is never produced on a missing URL or a leaked asset.

---

## Sources

- YouTube Audio Library / royalty-free warning / Content-ID: https://support.google.com/youtube/answer/3376882
- YouTube "fair use" myths (credit/disclaimer ≠ license): https://support.google.com/youtube/answer/9783148
- DMCA §1201 anti-circumvention (Copyright Alliance): https://copyrightalliance.org/education/copyright-law-explained/the-digital-millennium-copyright-act-dmca/section-1201-technology-protection/
- U.S. Copyright Office §1201 study: https://www.copyright.gov/policy/1201/
- New Media Rights — DMCA circumvention of DRM: https://newmediarights.org/guide/legal/copyright/dmca/How_the_DMCA_restricts_circumventing_technological_protection_measures_like_DRM_and_encryption
- Section 1201 legislative primer (IIPSJ): https://iipsj.org/wp-content/uploads/2023/09/Section-1201-Legislative-Primer.pdf
- DRM black-screen on screen recording (why streaming can't be captured): https://www.screenify.studio/blog/2026-04-23-record-drm-protected-content
- Paywalled press coverage = copyright/TOS breach even when linked (BIID): https://biid.org.uk/resources/are-you-risking-fine-sharing-your-online-and-printed-press-coverage
- Getty Images API (fingerprinting / reverse search): https://www.gettyimages.com/api
- Adobe Stock reverse-image-search visibility thread: https://community.adobe.com/questions-38/adobe-stock-images-suddenly-disappeared-from-reverse-image-search-results-google-lens-tineye-etc-317336
- Content ID (how matching works): https://en.wikipedia.org/wiki/Content_ID
- C2PA + SynthID provenance signals (OpenAI help): https://help.openai.com/en/articles/8912793-provenance-signals-content-credentials-synthid-in-openai-generated-content
- OpenAI content-provenance overview: https://openai.com/index/advancing-content-provenance/
- C2PA standard, metadata + limits (removable vs pixel watermark): https://truescreen.io/articles/c2pa-standard-history-limitations/
- Anonymous YouTube channel guide (EXIF/metadata leak, filenames): https://mobilesms.io/blog/start-anonymous-youtube-channel-guide/
- Faceless channel EXIF/metadata leak rates + practices (AIR Media-Tech): https://air.io/en/youtube-hacks/42-faceless-youtube-channel-ideas-create-and-earn-anonymously
- Openverse API (canonical license + foreign_landing_url per result): https://api.openverse.org/v1/
- Internal cross-refs: docs/research/asset-sourcing.md (tiers/licensing), docs/research/PLAYBOOK.md, CLAUDE.md (hard rules), capture/README.md + capture/lib/{anonymity,license}.ts
