import { createHash } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import sharp from "sharp";
import { launchClean } from "./lib/browser";
import { scanForLeaks, type Forbidden } from "./lib/anonymity";
import { writeCredit } from "./lib/license";

export interface ShotResult {
  file: string;
  w: number;
  h: number;
  sourceUrl: string;
}

// Screenshot a URL (or one element via `selector`) with the clean throwaway
// browser. Motion + embedded media are killed so nothing animates or
// fingerprints. The capture is staged, anonymity-scanned, and only then moved
// into public/ — a leak leaves public/ untouched.
export async function captureScreenshot(o: {
  url: string;
  selector?: string;
  epDir: string;
  publicDir: string;
  epSlug: string;
  forbidden: Forbidden;
}): Promise<ShotResult> {
  const hash = createHash("sha1").update(o.url + (o.selector ?? "")).digest("hex").slice(0, 12);
  const rel = join(o.epSlug, "shot", `${hash}.png`);
  const abs = join(o.publicDir, rel);
  const staging = abs + ".staging.png";
  await mkdir(dirname(abs), { recursive: true });

  const b = await launchClean();
  try {
    const page = await b.context.newPage();
    // Ad/tracker-heavy pages (e.g. news sites) never reach "networkidle", so
    // load the DOM, best-effort wait for the load event, then settle for paint.
    await page.goto(o.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.addStyleTag({
      content: `*{animation:none!important;transition:none!important} video,audio{display:none!important}`,
    });
    // Best-effort cookie-banner dismissal so it isn't in the shot.
    for (const sel of ['button:has-text("Accept")', 'button:has-text("I agree")', '[aria-label*="accept" i]']) {
      await page.locator(sel).first().click({ timeout: 1200 }).catch(() => {});
    }
    const pageText = await page.evaluate(() => document.body.innerText).catch(() => "");
    const target = o.selector ? page.locator(o.selector).first() : page;
    await target.screenshot({ path: staging });

    // Gate: DOM text + OCR of the pixels. Throws → discard.
    await scanForLeaks({ forbidden: o.forbidden, pageText, imagePaths: [staging] });

    await sharp(staging).png().toFile(abs); // re-encode (strip metadata)
    const meta = await sharp(abs).metadata();
    const posix = rel.split("\\").join("/");
    const today = new Date().toISOString().slice(0, 10);
    await writeCredit(
      join(o.epDir, "credits.md"),
      `${posix} — screenshot of ${o.url} (retrieved ${today}) — editorial / fair use, narrated + annotated on screen`,
    );
    return { file: posix, w: meta.width ?? 0, h: meta.height ?? 0, sourceUrl: o.url };
  } finally {
    await unlink(staging).catch(() => {});
    await b.dispose();
  }
}
