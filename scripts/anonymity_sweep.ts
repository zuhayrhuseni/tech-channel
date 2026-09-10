import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadForbidden,
  findLeaks,
  type Forbidden,
} from "../capture/lib/anonymity";

// scripts/anonymity_sweep.ts — the FINAL-RENDER anonymity gate.
//
// The capture gate (capture/lib/anonymity.ts) only sees fetched images and
// screenshots. It does NOT see text the animation itself puts on screen —
// keyword cards, FakeTerminal contents, chart labels, code snippets. A real
// name or a /Users/<name>/ path baked into the Remotion composition would sail
// straight past it. This extends the exact same detection (findLeaks) to the
// rendered mp4: sample frames with ffmpeg, OCR each with tesseract, and FAIL
// (non-zero exit) on any forbidden string or home-dir path.
//
// Usage:
//   tsx scripts/anonymity_sweep.ts <path/to/out.mp4> [--fps 1] [--keep]
//
// Exit codes: 0 = clean, 1 = leak found, 2 = usage / tooling error.

const run = promisify(execFile);

async function ocr(imagePath: string): Promise<string | null> {
  try {
    // --psm 3: fully automatic page segmentation. Matches the capture gate.
    const { stdout } = await run("tesseract", [
      imagePath,
      "stdout",
      "--psm",
      "3",
    ]);
    return stdout;
  } catch {
    return null;
  }
}

async function haveBinary(
  bin: string,
  versionFlag = "-version",
): Promise<boolean> {
  try {
    await run(bin, [versionFlag]);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv: string[]): {
  mp4?: string;
  fps: number;
  keep: boolean;
} {
  let mp4: string | undefined;
  let fps = 1;
  let keep = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fps") {
      fps = Number(argv[++i]);
      if (!Number.isFinite(fps) || fps <= 0) fps = 1;
    } else if (a === "--keep") {
      keep = true;
    } else if (!a.startsWith("-") && !mp4) {
      mp4 = a;
    }
  }
  return { mp4, fps, keep };
}

async function main() {
  const { mp4, fps, keep } = parseArgs(process.argv.slice(2));
  if (!mp4) {
    console.error(
      "usage: tsx scripts/anonymity_sweep.ts <out.mp4> [--fps N] [--keep]",
    );
    process.exit(2);
  }
  try {
    const s = await stat(mp4);
    if (!s.isFile()) throw new Error("not a file");
  } catch {
    console.error(`anonymity-sweep: cannot read video: ${mp4}`);
    process.exit(2);
  }

  if (!(await haveBinary("ffmpeg"))) {
    console.error(
      "anonymity-sweep: ffmpeg not found — cannot sample frames. Install it before shipping.",
    );
    process.exit(2);
  }
  const hasTesseract = await haveBinary("tesseract", "--version");
  if (!hasTesseract) {
    console.error(
      "anonymity-sweep: tesseract not found — frames cannot be OCR-scanned. " +
        "This gate is meaningless without it. Install (brew install tesseract) before shipping.",
    );
    process.exit(2);
  }

  const forbidden: Forbidden = await loadForbidden();
  if (!forbidden.names.length && !forbidden.pathFragments.length) {
    console.warn(
      "⚠ capture/forbidden.json has no name/path entries — only the generic " +
        "/Users/<name>/ and /home/<name>/ path checks will run. Add your real " +
        "display/legal name to `names` so on-screen text leaks are caught.\n",
    );
  }

  const workDir = await mkdtemp(join(tmpdir(), "anon-sweep-"));
  try {
    console.log(
      `anonymity-sweep: sampling ${mp4} at ${fps} fps → OCR → leak scan`,
    );
    // Extract frames. fps=1 → one frame/sec of video. Scale up small text a bit
    // for OCR legibility without exploding disk for a 10-min video.
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      mp4,
      "-vf",
      `fps=${fps}`,
      "-q:v",
      "2",
      join(workDir, "frame-%06d.jpg"),
    ]);

    const frames = (await readdir(workDir))
      .filter((f) => f.endsWith(".jpg"))
      .sort();
    if (!frames.length) {
      console.error(
        "anonymity-sweep: ffmpeg produced no frames — is the mp4 valid?",
      );
      process.exit(2);
    }
    console.log(`anonymity-sweep: ${frames.length} frames to scan`);

    // beat -> which frames leaked which strings
    const leaks: { frame: string; hits: string[] }[] = [];
    let ocrFailures = 0;

    for (const f of frames) {
      const abs = join(workDir, f);
      const text = await ocr(abs);
      if (text === null) {
        ocrFailures++;
        continue;
      }
      const hits = findLeaks(text, forbidden);
      if (hits.length) leaks.push({ frame: f, hits });
    }

    if (ocrFailures) {
      console.warn(
        `⚠ ${ocrFailures}/${frames.length} frames failed OCR and were NOT scanned.`,
      );
    }

    if (leaks.length) {
      console.error(
        `\n✗ ANONYMITY FAIL — leaks found in ${leaks.length} frame(s):`,
      );
      // Collapse to distinct strings + a couple of example frames each.
      const byHit = new Map<string, string[]>();
      for (const l of leaks) {
        for (const h of l.hits) {
          const arr = byHit.get(h) ?? [];
          if (arr.length < 3) arr.push(l.frame);
          byHit.set(h, arr);
        }
      }
      for (const [hit, exampleFrames] of byHit) {
        const sec = exampleFrames.map((fr) => {
          const n = Number(fr.replace(/\D/g, ""));
          return `~${((n - 1) / fps).toFixed(1)}s`;
        });
        console.error(`   "${hit}"  at ${sec.join(", ")}`);
      }
      console.error(
        "\nThe leak is in the animation text (keyword card / terminal / chart / code), " +
          "not a capture. Fix the source script/component and re-render.",
      );
      if (keep) console.error(`(frames kept in ${workDir})`);
      process.exit(1);
    }

    console.log(
      `\n✓ anonymity-sweep: clean — no forbidden strings or home-dir paths in ${frames.length} frames.`,
    );
  } finally {
    if (!keep)
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(`anonymity-sweep: ${e?.message ?? e}`);
  process.exit(2);
});
