import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import sharp from "sharp";
import { scanForLeaks, type Forbidden } from "./lib/anonymity";
import { rejectIfBadLicense, writeCredit } from "./lib/license";

const UA = "tech-channel-capture/1.0 (educational video project)";

// Read a key from the process env or the gitignored repo-root .env (same file
// as ELEVENLABS_API_KEY). Returns null if unset — sources degrade gracefully.
function loadEnvKey(name: string): string | null {
  if (process.env[name]) return process.env[name] as string;
  try {
    for (const line of readFileSync(join(process.cwd(), ".env"), "utf8").split("\n")) {
      if (line.startsWith(name + "=")) return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env */
  }
  return null;
}

// Pexels — best quality, commercial-clean, no attribution required. Primary
// source when PEXELS_KEY is set. (Video b-roll uses the same key; added later.)
async function pexels(query: string, key: string): Promise<Candidate[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: key, "User-Agent": UA } });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data: any = await res.json();
  return (data.photos ?? []).map((p: any) => ({
    src: p.src?.original ?? p.src?.large2x ?? p.src?.large,
    license: "Pexels License",
    title: (p.alt && p.alt.trim()) || "Pexels photo",
    creator: p.photographer ?? "unknown",
    sourceUrl: p.url,
  }));
}

export interface FetchResult {
  file: string; // staticFile-relative, posix, e.g. "ep-003/img/abcd.jpg"
  w: number;
  h: number;
  credit: string;
  license: string;
  sourceUrl: string;
}

interface Candidate {
  src: string;
  license: string;
  title: string;
  creator: string;
  sourceUrl: string;
}

// Openverse aggregates CC/PD across many providers and returns the license per
// result — keyless (rate-limited). We ask only for commercial + modifiable.
async function openverse(query: string): Promise<Candidate[]> {
  const url =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}` +
    `&license_type=commercial,modification&page_size=10&mature=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const data: any = await res.json();
  return (data.results ?? []).map((r: any) => ({
    src: r.url,
    license: `${r.license ?? ""} ${r.license_version ?? ""}`.trim(),
    title: r.title ?? "untitled",
    creator: r.creator ?? "unknown",
    sourceUrl: r.foreign_landing_url ?? r.url,
  }));
}

// Wikimedia Commons fallback — keyless. Parse per-file license from extmetadata.
async function wikimedia(query: string): Promise<Candidate[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent(query)}` +
    `&prop=imageinfo&iiprop=url|extmetadata`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikimedia ${res.status}`);
  const data: any = await res.json();
  const pages = data.query?.pages ?? {};
  const out: Candidate[] = [];
  for (const k of Object.keys(pages)) {
    const info = pages[k].imageinfo?.[0];
    if (!info) continue;
    const em = info.extmetadata ?? {};
    out.push({
      src: info.url,
      license: (em.LicenseShortName?.value ?? em.License?.value ?? "unknown").toString(),
      title: pages[k].title ?? "untitled",
      creator: (em.Artist?.value ?? "unknown").toString().replace(/<[^>]+>/g, "").trim(),
      sourceUrl: info.descriptionurl ?? info.url,
    });
  }
  return out;
}

export async function fetchImage(o: {
  query: string;
  epDir: string;
  publicDir: string;
  epSlug: string;
  forbidden: Forbidden;
}): Promise<FetchResult> {
  let candidates: Candidate[] = [];
  const pexelsKey = loadEnvKey("PEXELS_KEY");
  if (pexelsKey) {
    candidates = await pexels(o.query, pexelsKey).catch(() => []);
  }
  if (!candidates.length) candidates = await openverse(o.query).catch(() => []);
  if (!candidates.length) candidates = await wikimedia(o.query).catch(() => []);
  if (!candidates.length) throw new Error(`no license-clean image found for "${o.query}"`);

  const today = new Date().toISOString().slice(0, 10);
  let lastErr = "no candidate passed the gates";

  for (const c of candidates) {
    const rel = join(o.epSlug, "img", createHash("sha1").update(c.src).digest("hex").slice(0, 12) + ".jpg");
    const abs = join(o.publicDir, rel);
    try {
      rejectIfBadLicense(c.license);
      const res = await fetch(c.src, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        lastErr = `download ${res.status}`;
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(abs), { recursive: true });
      // Re-encode → strips EXIF (GPS/author), normalizes format.
      const img = sharp(buf).rotate();
      const meta = await img.metadata();
      await img.jpeg({ quality: 92 }).toFile(abs);
      // Anonymity: OCR the final image; on a hit, delete it and try the next.
      try {
        await scanForLeaks({ forbidden: o.forbidden, imagePaths: [abs] });
      } catch (e: any) {
        await unlink(abs).catch(() => {});
        throw e;
      }
      const posix = rel.split("\\").join("/");
      const credit = `${posix} — "${c.title}" by ${c.creator} — ${c.sourceUrl} — ${c.license} (retrieved ${today})`;
      await writeCredit(join(o.epDir, "credits.md"), credit);
      return { file: posix, w: meta.width ?? 0, h: meta.height ?? 0, credit, license: c.license, sourceUrl: c.sourceUrl };
    } catch (e: any) {
      lastErr = e.message;
      continue;
    }
  }
  throw new Error(`all candidates failed for "${o.query}" (${lastErr})`);
}
