import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { loadForbidden } from "./lib/anonymity";
import { fetchImage } from "./fetch_image";
import { fetchVideo } from "./fetch_video";
import { captureScreenshot } from "./capture_screenshot";
import { capturePdfFirstPage, isPdfUrl } from "./capture_pdf";
import { captureScrollVideo } from "./capture_scroll_video";

// Step 5.5 "acquire" — runs BEFORE the animate/build step. Reads a script.yaml,
// resolves every visual cue that needs a real asset (kind/type: image | meme |
// browser_capture), fetches/screenshots it through the anonymity + license
// gates, and writes episodes/NNN/assets.json for the Remotion build to consume.
// The human still only ever edits script.yaml. Run from the repo root:
//   npm run acquire episodes/003-vibe-coding-hangover
const FPS = 30;

async function main() {
  const epArg = process.argv[2];
  if (!epArg) {
    console.error("usage: npm run acquire <episodes/NNN-slug>");
    process.exit(1);
  }
  const epDir = resolve(epArg);
  const publicDir = join(process.cwd(), "public");
  const doc: any = parse(await readFile(join(epDir, "script.yaml"), "utf8"));
  const epSlug = "ep-" + String(doc.id ?? epArg.split("/").pop()).replace(/^\d+-/, "");
  const forbidden = await loadForbidden();
  if (!forbidden.names.length && !forbidden.pathFragments.length) {
    console.warn("⚠ capture/forbidden.json has no name/path entries — only the generic /Users/<name>/ check will run.\n");
  }

  const manifest: Record<string, any> = {};
  let ok = 0;
  let failed = 0;

  for (const beat of doc.beats ?? []) {
    const shared = { epDir, publicDir, epSlug, forbidden };

    // B-roll: a full-bleed background texture layer, resolved independently of
    // (and merged alongside) any foreground visual asset on the same beat.
    //   broll: { query: "...", kind: "video" | "image" }
    // kind:"video" fetches a Pexels video (falls back to a still image on
    // failure); kind:"image" fetches a still. Result lands under the beat id as
    // { broll: { file, kind, ... } }.
    if (beat.broll && typeof beat.broll === "object" && beat.broll.query) {
      const bq = beat.broll.query as string;
      const bkind = (beat.broll.kind ?? "video") as "video" | "image";
      try {
        let br: any;
        if (bkind === "video") {
          console.log(`• [${beat.id}] broll video  "${bq}"`);
          try {
            br = await fetchVideo({ query: bq, ...shared });
          } catch (e: any) {
            console.warn(`  ↳ video failed (${e.message}) — falling back to image`);
            const r = await fetchImage({ query: bq, ...shared });
            br = { ...r, kind: "image" as const };
          }
        } else {
          console.log(`• [${beat.id}] broll image  "${bq}"`);
          const r = await fetchImage({ query: bq, ...shared });
          br = { ...r, kind: "image" as const };
        }
        manifest[beat.id] = { ...(manifest[beat.id] ?? {}), broll: br };
        console.log(`  ✓ broll ${br.file} (${br.kind})`);
        ok++;
      } catch (e: any) {
        console.error(`  ✗ [${beat.id}] broll ${e.message}`);
        failed++;
      }
    }

    // Receipts: source screenshots shown as SECONDARY evidence overlays (a small
    // inset that appears for a beat or two while a quote is read), not as the
    // beat's primary visual. A beat gets one `visual:`, so without this a beat
    // whose main picture is a designed animation could never also show the paper
    // it is quoting — PLAYBOOK's "real headline screenshots only as receipts".
    //   receipts:
    //     - source_url: "https://..."
    //       selector: "..."        # optional element crop
    //       land_at: some_mark     # optional sync anchor
    // Lands under the beat id as { receipts: [ {file, ...}, ... ] }.
    if (Array.isArray(beat.receipts)) {
      const got: any[] = [];
      for (const rc of beat.receipts) {
        if (!rc?.source_url) {
          console.warn(`• [${beat.id}] receipt: no \`source_url:\` — skipped`);
          continue;
        }
        try {
          console.log(`• [${beat.id}] receipt    ${rc.source_url}`);
          const r = isPdfUrl(rc.source_url)
            ? await capturePdfFirstPage({ url: rc.source_url, ...shared })
            : await captureScreenshot({ url: rc.source_url, selector: rc.selector, ...shared });
          got.push({ ...r, circle: rc.annotate?.circle ?? null, land_at: rc.land_at ?? null });
          console.log(`  ✓ ${r.file}`);
          ok++;
        } catch (e: any) {
          console.error(`  ✗ [${beat.id}] receipt ${e.message}`);
          failed++;
        }
      }
      if (got.length) manifest[beat.id] = { ...(manifest[beat.id] ?? {}), receipts: got };
    }

    const v = beat.visual;
    if (!v || typeof v !== "object") continue;
    const kind = v.kind ?? v.type; // accept both the new `kind` and legacy `type`
    try {
      if (kind === "image" || kind === "meme") {
        const query = v.query;
        if (!query) {
          console.warn(`• [${beat.id}] ${kind}: no \`query:\` — skipped`);
          continue;
        }
        console.log(`• [${beat.id}] image  "${query}"`);
        const r = await fetchImage({ query, ...shared });
        manifest[beat.id] = { ...(manifest[beat.id] ?? {}), kind: "image", ...r, circle: v.annotate?.circle ?? null, land_at: v.land_at ?? null };
        console.log(`  ✓ ${r.file}`);
        ok++;
      } else if (kind === "browser_capture") {
        const url = v.source_url;
        if (!url) {
          console.warn(`• [${beat.id}] browser_capture: no \`source_url:\` — skipped`);
          continue;
        }
        console.log(`• [${beat.id}] screenshot  ${url}`);
        const r = isPdfUrl(url)
          ? await capturePdfFirstPage({ url, ...shared })
          : await captureScreenshot({ url, selector: v.selector, ...shared });
        manifest[beat.id] = { ...(manifest[beat.id] ?? {}), kind: "browser_capture", ...r, circle: v.annotate?.circle ?? null, land_at: v.land_at ?? null };
        console.log(`  ✓ ${r.file}`);
        ok++;
      } else if (kind === "screen_recording") {
        const url = v.source_url;
        if (!url) {
          console.warn(`• [${beat.id}] screen_recording: no \`source_url:\` — skipped`);
          continue;
        }
        console.log(`• [${beat.id}] recording  ${url}`);
        const r = await captureScrollVideo({
          url,
          scrollTo: v.scroll?.to,
          durationS: v.scroll?.duration_s,
          fps: FPS,
          ...shared,
        });
        manifest[beat.id] = {
          ...(manifest[beat.id] ?? {}),
          kind: "screen_recording",
          ...r,
          zoom: v.zoom ?? null, // { region, scale } — applied at render (Ken-Burns / punch-in)
          circle: v.annotate?.circle ?? null,
          land_at: v.land_at ?? null,
        };
        console.log(`  ✓ ${r.file} (${r.durationInFrames}f)`);
        ok++;
      }
    } catch (e: any) {
      console.error(`  ✗ [${beat.id}] ${e.message}`);
      failed++;
    }
  }

  const outPath = join(epDir, "assets.json");
  await writeFile(
    outPath,
    JSON.stringify({ fps: FPS, generated: new Date().toISOString(), assets: manifest }, null, 2) + "\n",
  );
  console.log(`\nwrote ${outPath} — ${ok} acquired, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main();
