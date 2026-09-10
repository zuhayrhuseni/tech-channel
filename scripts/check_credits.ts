import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "yaml";

// scripts/check_credits.ts — licensing / sourcing gate for an episode.
//
// Two jobs, per asset-sourcing.md and CLAUDE.md rule 4:
//
//  1. FAIL (exit 1) if any asset acquired into assets.json is missing a credit
//     line in that episode's credits.md. Every fetched image / screenshot must
//     be attributed (title, author, source, license, retrieval date) before the
//     render is allowed to ship. acquire.ts writes both files; this verifies
//     they agree, so a hand-deleted or stale credits.md is caught.
//
//  2. WARN (does not fail) if a beat that makes a factual claim lacks a source.
//     "Factual claim" is heuristic — a beat whose narration carries numbers /
//     stats / dated events but whose `notes:` has no SOURCE [n] reference and
//     whose script has no matching source entry. A warning, not a hard stop:
//     the human still does the final fact pass, and false positives on prose
//     numbers ("two job markets") shouldn't block a render.
//
// Usage:
//   tsx scripts/check_credits.ts <episodes/NNN-slug>
//
// Exit codes: 0 = credits complete (warnings allowed), 1 = missing credit, 2 = usage error.

interface Beat {
  id?: string;
  narration?: string;
  notes?: string;
  visual?: any;
}

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

// Heuristic: does this narration make a checkable factual claim?
// Percentages, large/comma numbers, spelled-out magnitudes, years, or
// "N thousand/million/billion". Deliberately loose — we only WARN.
const CLAIM_RE =
  /\b\d+(?:[.,]\d+)?\s?(?:%|percent)\b|\b\d{1,3}(?:,\d{3})+\b|\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\s?(?:thousand|million|billion|trillion)\b|\b(?:thousand|million|billion|trillion)\b/i;

function makesFactualClaim(narration: string): boolean {
  return CLAIM_RE.test(narration ?? "");
}

// Does a beat reference a source? Either an explicit SOURCE [n] in notes, or a
// bare [n] citation, or a [VERIFY: ...] flag (the sanctioned "I couldn't verify
// this" marker from CLAUDE.md rule 4 — flagged, so not a warning).
function beatHasSourceOrFlag(beat: Beat): boolean {
  const blob = `${beat.notes ?? ""}`;
  if (/\bSOURCE\s*\[\d+\]/i.test(blob)) return true;
  if (/\[\s*\d+\s*\]/.test(blob)) return true;
  // A [VERIFY: ...] flag anywhere in the beat means the claim is knowingly
  // unverified — that's the correct handling, not a missing source.
  if (/\[VERIFY:/i.test(beat.narration ?? "") || /\[VERIFY:/i.test(blob))
    return true;
  return false;
}

async function main() {
  const epArg = process.argv[2];
  if (!epArg) {
    console.error("usage: tsx scripts/check_credits.ts <episodes/NNN-slug>");
    process.exit(2);
  }
  const epDir = resolve(epArg);

  const scriptRaw = await readIfExists(join(epDir, "script.yaml"));
  if (scriptRaw === null) {
    console.error(`check-credits: no script.yaml in ${epDir}`);
    process.exit(2);
  }
  const doc: any = parse(scriptRaw);
  const beats: Beat[] = doc?.beats ?? [];

  const assetsRaw = await readIfExists(join(epDir, "assets.json"));
  const creditsRaw = await readIfExists(join(epDir, "credits.md"));

  // ---- 1. Credit coverage (HARD) --------------------------------------------
  const assets: Record<string, any> = assetsRaw
    ? (JSON.parse(assetsRaw).assets ?? {})
    : {};
  const assetEntries = Object.entries(assets);
  const credits = creditsRaw ?? "";

  // One beat entry can carry SEVERAL fetched files, not just one: a foreground
  // `visual` (top-level `file`), a background `broll.file`, and any number of
  // source `receipts[].file`. Checking only the top level had two failure modes,
  // both live on ep003: every broll-only beat was reported as "no file in
  // assets.json" (a false FAIL — acquire had worked), and the Pexels b-roll clip
  // itself was never credit-checked at all, so it could have shipped
  // unattributed. Flatten to (label, file) pairs and check each one.
  function assetFiles(beatId: string, a: any): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    if (a?.file) out.push([beatId, a.file]);
    if (a?.broll?.file) out.push([`${beatId} (broll)`, a.broll.file]);
    for (const [i, r] of (a?.receipts ?? []).entries()) {
      if (r?.file) out.push([`${beatId} (receipt ${i + 1})`, r.file]);
    }
    return out;
  }

  const missingCredits: string[] = [];
  for (const [beatId, a] of assetEntries) {
    // acquire.ts writes each credit line containing the asset's posix `file`
    // path, so the file path is the join key between assets.json and credits.md.
    const files = assetFiles(beatId, a);
    if (files.length === 0) {
      // An entry that acquired nothing at all is a broken acquire.
      missingCredits.push(`${beatId} (no file in assets.json)`);
      continue;
    }
    for (const [label, file] of files) {
      if (!credits.includes(file)) missingCredits.push(`${label} → ${file}`);
    }
  }

  if (assetEntries.length && creditsRaw === null) {
    console.error(
      `check-credits: assets.json lists ${assetEntries.length} asset(s) but there is NO credits.md — re-run acquire.`,
    );
    process.exit(1);
  }

  // ---- 2. Source coverage for factual claims (WARN) -------------------------
  const unsourced: string[] = [];
  for (const beat of beats) {
    if (!beat?.narration) continue;
    if (makesFactualClaim(beat.narration) && !beatHasSourceOrFlag(beat)) {
      unsourced.push(beat.id ?? "(unnamed beat)");
    }
  }

  // ---- Report ---------------------------------------------------------------
  console.log(`check-credits: ${epArg}`);
  console.log(`  assets acquired: ${assetEntries.length}`);
  console.log(
    `  credit lines:    ${credits.split("\n").filter((l) => l.trim()).length}`,
  );

  if (unsourced.length) {
    console.warn(
      `\n⚠ ${unsourced.length} beat(s) make a factual claim with no SOURCE [n] / [VERIFY:] marker:`,
    );
    for (const id of unsourced) console.warn(`   • ${id}`);
    console.warn(
      "   (warning only — add a SOURCE [n] to notes, cite [n], or flag [VERIFY: ...]. " +
        "The human fact pass still runs.)",
    );
  }

  if (missingCredits.length) {
    console.error(
      `\n✗ CREDITS FAIL — ${missingCredits.length} acquired asset(s) missing a credits.md line:`,
    );
    for (const m of missingCredits) console.error(`   • ${m}`);
    console.error(
      "\nEvery fetched image / screenshot must be attributed before render. Re-run acquire or restore credits.md.",
    );
    process.exit(1);
  }

  console.log(
    `\n✓ check-credits: every acquired asset is credited${unsourced.length ? " (see source warnings above)" : ""}.`,
  );
}

main().catch((e) => {
  console.error(`check-credits: ${e?.message ?? e}`);
  process.exit(2);
});
