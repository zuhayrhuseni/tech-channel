import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const run = promisify(execFile);

export interface Forbidden {
  names: string[];
  pathFragments: string[];
}

// forbidden.json lives beside this toolkit and is GITIGNORED — it is the only
// place the creator's real identity strings live. Run acquire from repo root.
export async function loadForbidden(): Promise<Forbidden> {
  const p = join(process.cwd(), "capture", "forbidden.json");
  try {
    const raw = JSON.parse(await readFile(p, "utf8"));
    return { names: raw.names ?? [], pathFragments: raw.pathFragments ?? [] };
  } catch {
    return { names: [], pathFragments: [] };
  }
}

// Shell to the `tesseract` binary. Returns null if it isn't installed/failed —
// callers warn loudly in that case rather than silently skipping the check.
async function ocr(imagePath: string): Promise<string | null> {
  try {
    const { stdout } = await run("tesseract", [imagePath, "stdout", "--psm", "3"]);
    return stdout;
  } catch {
    return null;
  }
}

// Pure matcher: given a blob of text, return the list of forbidden strings /
// home-path shapes found in it (empty = clean). Shared by scanForLeaks (the
// capture gate) and scripts/anonymity_sweep.ts (the final-render gate) so both
// use byte-identical detection logic. No I/O, no OCR — caller supplies text.
export function findLeaks(text: string, forbidden: Forbidden): string[] {
  const original = text ?? "";
  const lower = original.toLowerCase();
  const hits: string[] = [];

  // Literal names/paths from forbidden.json (case-insensitive).
  for (const n of [...forbidden.names, ...forbidden.pathFragments]) {
    if (n && lower.includes(n.toLowerCase())) hits.push(n);
  }
  // Generic home-dir shapes (case-sensitive: the macOS/Linux home form is
  // rare in normal web copy, so this catches a leaked terminal/devtools path
  // without false-firing on every "github.com/users/..." URL).
  if (/\/Users\/[A-Za-z][\w.\-]+\//.test(original)) hits.push("/Users/<name>/");
  if (/\/home\/[a-z][\w.\-]+\//.test(original)) hits.push("/home/<name>/");

  return hits;
}

// Throws if a forbidden name or a home-dir path shows up in the page text or
// (via OCR) in the pixels. A throw means: discard the capture, write nothing.
// This is the hard, automated anonymity stop (CLAUDE.md rules 1-3).
export async function scanForLeaks(opts: {
  forbidden: Forbidden;
  pageText?: string;
  imagePaths?: string[];
}): Promise<void> {
  const hay: string[] = [];
  if (opts.pageText) hay.push(opts.pageText);

  let ocrRan = false;
  for (const img of opts.imagePaths ?? []) {
    const text = await ocr(img);
    if (text !== null) {
      ocrRan = true;
      hay.push(text);
    }
  }
  if ((opts.imagePaths?.length ?? 0) > 0 && !ocrRan) {
    console.warn(
      "  ⚠ tesseract not available — image pixels were NOT OCR-scanned for " +
        "name/path leaks. Install it (brew install tesseract) before shipping " +
        "real screenshots/recordings.",
    );
  }

  const hits = findLeaks(hay.join("\n"), opts.forbidden);

  if (hits.length) {
    throw new Error(
      `ANONYMITY FAIL: found ${JSON.stringify(hits)} in capture — discarded, nothing written.`,
    );
  }
}
