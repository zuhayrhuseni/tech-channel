import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { Forbidden } from "./lib/anonymity";
import { writeCredit } from "./lib/license";

const UA = "tech-channel-capture/1.0 (educational video project)";

// Read a key from the process env or the gitignored repo-root .env (same file
// as ELEVENLABS_API_KEY / PEXELS_KEY). Returns null if unset.
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

export interface FetchVideoResult {
  file: string; // staticFile-relative, posix, e.g. "ep-003/broll/abcd.mp4"
  kind: "video";
  w: number;
  h: number;
  credit: string;
  license: string;
  sourceUrl: string;
}

// Pexels VIDEO search. Pexels License → commercial-clean, no attribution
// required; we still log a credit line. We pick the highest-quality
// progressive .mp4 that is <= 1920 wide (prefer FullHD/HD), so it drops in as
// a 1080p full-bleed b-roll layer without a huge download.
async function pexelsVideos(query: string, key: string) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
    query,
  )}&per_page=8&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: key, "User-Agent": UA } });
  if (!res.ok) throw new Error(`Pexels videos ${res.status}`);
  const data: any = await res.json();
  return (data.videos ?? []) as any[];
}

// From a Pexels video object, pick the best .mp4 file link. Prefer the largest
// frame that is still <= 1920 wide; fall back to the smallest if all exceed it.
function pickFile(video: any): { link: string; w: number; h: number } | null {
  const files = (video.video_files ?? []).filter(
    (f: any) => f.link && (f.file_type === "video/mp4" || String(f.link).includes(".mp4")),
  );
  if (!files.length) return null;
  const withDims = files.map((f: any) => ({
    link: f.link as string,
    w: f.width ?? 0,
    h: f.height ?? 0,
  }));
  const underCap = withDims.filter((f) => f.w > 0 && f.w <= 1920);
  const pool = underCap.length ? underCap : withDims;
  pool.sort((a, b) => b.w - a.w);
  return pool[0] ?? null;
}

export async function fetchVideo(o: {
  query: string;
  epDir: string;
  publicDir: string;
  epSlug: string;
  forbidden: Forbidden;
}): Promise<FetchVideoResult> {
  const key = loadEnvKey("PEXELS_KEY");
  if (!key) throw new Error("PEXELS_KEY not set — cannot fetch video b-roll");

  const videos = await pexelsVideos(o.query, key);
  if (!videos.length) throw new Error(`no Pexels video found for "${o.query}"`);

  const today = new Date().toISOString().slice(0, 10);
  let lastErr = "no candidate had a usable mp4";

  for (const v of videos) {
    const picked = pickFile(v);
    if (!picked) continue;
    // Note: video frames are NOT OCR'd (no per-frame anonymity scan). We rely
    // on Pexels being brand/person-neutral by query — keep queries to textures
    // (code on a screen, city at night, abstract light) with no names/logos.
    const rel = join(
      o.epSlug,
      "broll",
      createHash("sha1").update(picked.link).digest("hex").slice(0, 12) + ".mp4",
    );
    const abs = join(o.publicDir, rel);
    try {
      const res = await fetch(picked.link, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        lastErr = `download ${res.status}`;
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, buf);
      const posix = rel.split("\\").join("/");
      const creator = v.user?.name ?? "unknown";
      const sourceUrl = v.url ?? picked.link;
      const license = "Pexels License";
      const credit = `${posix} — video "${o.query}" by ${creator} — ${sourceUrl} — ${license} (no attribution required; retrieved ${today})`;
      await writeCredit(join(o.epDir, "credits.md"), credit);
      return {
        file: posix,
        kind: "video",
        w: picked.w,
        h: picked.h,
        credit,
        license,
        sourceUrl,
      };
    } catch (e: any) {
      lastErr = e.message;
      continue;
    }
  }
  throw new Error(`all video candidates failed for "${o.query}" (${lastErr})`);
}
