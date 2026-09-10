import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rename, rm, readdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { launchClean } from "./lib/browser";
import { scanForLeaks, type Forbidden } from "./lib/anonymity";
import { writeCredit } from "./lib/license";

const run = promisify(execFile);

export interface ScrollVideoResult {
  file: string; // staticFile-relative, posix, e.g. "ep-003/rec/abcd.webm"
  w: number;
  h: number;
  durationInFrames: number;
  sourceUrl: string;
}

// Hosts we must never capture: DRM/paywalled/login/streaming. Recording their
// pages is both a licensing problem (embedded content is not fair-use safe) and
// an anonymity problem (a login wall can surface the creator's own account).
// Matched against the URL hostname (and its parent domains).
const DENY_HOSTS = [
  // streaming / DRM video + music
  "youtube.com", "youtu.be", "netflix.com", "hulu.com", "disneyplus.com",
  "hbomax.com", "max.com", "primevideo.com", "spotify.com", "twitch.tv",
  "vimeo.com", "soundcloud.com", "music.apple.com", "tv.apple.com",
  // hard paywalls
  "nytimes.com", "wsj.com", "ft.com", "bloomberg.com", "economist.com",
  "newyorker.com", "wired.com", "theatlantic.com", "medium.com",
  // login-walled / personal-account surfaces (leak risk)
  "facebook.com", "instagram.com", "linkedin.com", "gmail.com", "mail.google.com",
  "accounts.google.com", "login.microsoftonline.com", "okta.com",
];

function assertHostAllowed(rawUrl: string): void {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    throw new Error(`DENYLIST: "${rawUrl}" is not a valid URL`);
  }
  for (const bad of DENY_HOSTS) {
    if (host === bad || host.endsWith("." + bad)) {
      throw new Error(
        `DENYLIST: refusing to screen-record "${host}" — DRM/paywalled/login/streaming host (not fair-use-safe, leak risk).`,
      );
    }
  }
}

// ffprobe → { width, height, duration(s) } of a video file.
async function probeVideo(path: string): Promise<{ w: number; h: number; durationS: number }> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-show_entries", "format=duration",
    "-of", "json",
    path,
  ]);
  const j = JSON.parse(stdout);
  const s = j.streams?.[0] ?? {};
  const durationS = parseFloat(j.format?.duration ?? "0");
  return { w: s.width ?? 0, h: s.height ?? 0, durationS: isFinite(durationS) ? durationS : 0 };
}

// Sample the recorded webm at 1fps into a temp dir → list of PNG frame paths.
async function sampleFrames(videoPath: string): Promise<{ dir: string; frames: string[] }> {
  const dir = await mkdtemp(join(tmpdir(), "recframes-"));
  await run("ffmpeg", [
    "-v", "error",
    "-i", videoPath,
    "-vf", "fps=1",
    join(dir, "f-%04d.png"),
  ]);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".png")).sort();
  return { dir, frames: names.map((n) => join(dir, n)) };
}

// Screen-record a URL with a deterministic eased programmatic scroll, gate the
// page text + sampled frames for anonymity leaks, and only then move the webm
// into public/. A leak (or a denylisted host) leaves public/ untouched.
//
// The scroll runs inside page.evaluate as a rAF tween with easeInOut timing —
// deterministic (fixed target px + duration), so the same page + inputs always
// produce the same motion. Closing the page is what finalizes Playwright's webm.
export async function captureScrollVideo(o: {
  url: string;
  scrollTo?: number; // target scrollY in px (default: full document height)
  durationS?: number; // scroll tween duration in seconds (default 6)
  epDir: string;
  publicDir: string;
  epSlug: string;
  forbidden: Forbidden;
  fps?: number; // render fps for durationInFrames (default 30)
}): Promise<ScrollVideoResult> {
  assertHostAllowed(o.url);

  const fps = o.fps ?? 30;
  const durationS = o.durationS ?? 6;
  const hash = createHash("sha1")
    .update(`${o.url}|${o.scrollTo ?? "full"}|${durationS}`)
    .digest("hex")
    .slice(0, 12);

  const rel = join(o.epSlug, "rec", `${hash}.webm`);
  const abs = join(o.publicDir, rel);
  await mkdir(dirname(abs), { recursive: true });

  // Playwright writes one .webm per page into this throwaway dir on page close.
  const recDir = await mkdtemp(join(tmpdir(), "recvid-"));
  const b = await launchClean({ recordVideoDir: recDir });
  let framesDir: string | null = null;
  try {
    const page = await b.context.newPage();
    await page.goto(o.url, { waitUntil: "networkidle", timeout: 45000 });

    // Kill motion so the ONLY movement in the recording is our scroll; hide any
    // embedded video/audio so no third-party media (Content-ID) is captured.
    await page.addStyleTag({
      content:
        `*{animation:none!important;transition:none!important;scroll-behavior:auto!important}` +
        `video,audio,iframe[src*="youtube"],iframe[src*="vimeo"]{display:none!important}`,
    });
    // Best-effort cookie-banner dismissal so it isn't in the recording.
    for (const sel of ['button:has-text("Accept")', 'button:has-text("I agree")', '[aria-label*="accept" i]']) {
      await page.locator(sel).first().click({ timeout: 1200 }).catch(() => {});
    }

    // Deterministic eased scroll: rAF tween, easeInOutQuad, fixed target + dur.
    // NOTE: the tween is a plain string evaluated in the page. We deliberately
    // avoid a typed/named function body here — tsx/esbuild decorates named
    // nested functions with a `__name` helper that doesn't exist in the browser
    // context ("__name is not defined"). A raw string sidesteps that entirely.
    const SCROLL_TWEEN = `(target, durationMs) => new Promise((resolve) => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const to = target == null ? maxScroll : Math.min(target, maxScroll);
      const from = window.scrollY;
      const dist = to - from;
      const ease = (t) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / durationMs);
        window.scrollTo(0, from + dist * ease(t));
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    })`;
    await page.evaluate(
      ([fn, target, durationMs]: [string, number | null, number]) =>
        (0, eval)(fn)(target, durationMs),
      [SCROLL_TWEEN, o.scrollTo ?? null, durationS * 1000] as [string, number | null, number],
    );

    // Grab the page text for the DOM-side anonymity scan before we tear down.
    const pageText = await page.evaluate(() => document.body.innerText).catch(() => "");

    // Closing the page flushes and finalizes the webm on disk.
    await page.close();

    // Locate the finalized webm (Playwright names it with a random basename).
    const written = (await readdir(recDir)).filter((n) => n.endsWith(".webm"));
    if (!written.length) throw new Error("Playwright wrote no video file");
    const rawWebm = join(recDir, written[0]);

    // Sample frames at 1fps and OCR-scan them + the page text. Throws on a leak.
    const sampled = await sampleFrames(rawWebm);
    framesDir = sampled.dir;
    await scanForLeaks({ forbidden: o.forbidden, pageText, imagePaths: sampled.frames });

    // Passed both gates → probe, then move into public/.
    const meta = await probeVideo(rawWebm);
    await rename(rawWebm, abs).catch(async () => {
      // rename across devices can fail (tmp vs repo) — fall back to copy+unlink.
      await run("ffmpeg", ["-v", "error", "-y", "-i", rawWebm, "-c", "copy", abs]);
      await unlink(rawWebm).catch(() => {});
    });

    const durationInFrames = Math.max(1, Math.round((meta.durationS || durationS) * fps));
    const posix = rel.split("\\").join("/");
    const today = new Date().toISOString().slice(0, 10);
    await writeCredit(
      join(o.epDir, "credits.md"),
      `${posix} — screen recording of ${o.url} (retrieved ${today}) — editorial / fair use, muted, narrated + annotated on screen`,
    );

    return {
      file: posix,
      w: meta.w || 1920,
      h: meta.h || 1080,
      durationInFrames,
      sourceUrl: o.url,
    };
  } finally {
    await b.dispose();
    await rm(recDir, { recursive: true, force: true }).catch(() => {});
    if (framesDir) await rm(framesDir, { recursive: true, force: true }).catch(() => {});
  }
}
