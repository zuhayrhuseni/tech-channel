import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { scanForLeaks, type Forbidden } from "./lib/anonymity";
import { writeCredit } from "./lib/license";
import type { ShotResult } from "./capture_screenshot";

const exec = promisify(execFile);

// Headless Chromium has no PDF viewer plugin, so page.goto() on a .pdf URL
// aborts with "Download is starting" — captureScreenshot simply cannot do PDFs.
// Three of this channel's best primary sources are PDFs (the Google ISCA paper,
// Drepper, Stroustrup), so "receipt = the paper's cover page" needs its own
// path: fetch the bytes, rasterise page 1, then run the SAME anonymity gate and
// the SAME credit write as a normal screenshot.
//
// Rasteriser is macOS Quick Look (`qlmanage`), which is always present on
// darwin and needs no extra install — consistent with a pipeline that already
// assumes ffmpeg/whisper via brew. If this ever needs to run on Linux, swap in
// `pdftoppm -png -f 1 -l 1` here; nothing else changes.
export function isPdfUrl(url: string): boolean {
  return /\.pdf($|[?#])/i.test(url);
}

export async function capturePdfFirstPage(o: {
  url: string;
  epDir: string;
  publicDir: string;
  epSlug: string;
  forbidden: Forbidden;
  /** Rasterised long-edge in px. 2000 keeps title-page text crisp under zoom. */
  size?: number;
}): Promise<ShotResult> {
  const hash = createHash("sha1").update(o.url).digest("hex").slice(0, 12);
  const rel = join(o.epSlug, "shot", `${hash}.png`);
  const abs = join(o.publicDir, rel);
  await mkdir(dirname(abs), { recursive: true });

  const work = await mkdtemp(join(tmpdir(), "pdfshot-"));
  const pdfPath = join(work, "doc.pdf");
  try {
    // Plain fetch, not the browser: we want the bytes, and no page context means
    // no cookies, no referrer, nothing to fingerprint.
    const res = await fetch(o.url, {
      redirect: "follow",
      headers: { accept: "application/pdf,*/*" },
    });
    if (!res.ok) throw new Error(`fetch ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new Error("response is not a PDF (no %PDF- header)");
    }
    await writeFile(pdfPath, buf);

    // -t thumbnail, -s long edge, -o output dir. Writes "<name>.pdf.png".
    await exec("qlmanage", ["-t", "-s", String(o.size ?? 2000), "-o", work, pdfPath], {
      timeout: 60000,
    });
    const png = (await readdir(work)).find((f) => f.endsWith(".png"));
    if (!png) throw new Error("qlmanage produced no PNG (corrupt or encrypted PDF?)");
    const staging = join(work, png);

    // Gate on the rendered pixels. There's no DOM text for a PDF, so OCR is the
    // whole check here — same call, same failure behaviour: throw = discard,
    // and nothing has been written to public/ yet.
    await scanForLeaks({ forbidden: o.forbidden, pageText: "", imagePaths: [staging] });

    await sharp(staging).png().toFile(abs); // re-encode (strip metadata)
    const meta = await sharp(abs).metadata();
    const posix = rel.split("\\").join("/");
    const today = new Date().toISOString().slice(0, 10);
    await writeCredit(
      join(o.epDir, "credits.md"),
      `${posix} — first page of ${o.url} (retrieved ${today}) — editorial / fair use, narrated + annotated on screen`,
    );
    return { file: posix, w: meta.width ?? 0, h: meta.height ?? 0, sourceUrl: o.url };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
