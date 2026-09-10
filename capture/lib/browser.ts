import { chromium, type BrowserContext } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CleanBrowser {
  context: BrowserContext;
  dispose: () => Promise<void>;
}

// A throwaway Chromium: fresh temp profile, no extensions, no login, muted,
// neutral locale/timezone. This is the anonymity core — it has never seen the
// creator's real Chrome profile, so it can't autofill or leak a real name/path.
// The temp profile dir is deleted on dispose().
export async function launchClean(
  opts: { recordVideoDir?: string } = {},
): Promise<CleanBrowser> {
  const userDataDir = await mkdtemp(join(tmpdir(), "cap-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // 2x source = crisp text when Remotion zooms in
    locale: "en-US",
    timezoneId: "UTC", // don't leak the local timezone
    acceptDownloads: false,
    recordVideo: opts.recordVideoDir
      ? { dir: opts.recordVideoDir, size: { width: 1920, height: 1080 } }
      : undefined,
    args: [
      "--mute-audio", // no third-party audio ever enters a capture (Content-ID)
      "--disable-extensions",
      "--no-default-browser-check",
      "--disable-features=Translate,MediaRouter",
    ],
  });
  await context.clearCookies();
  await context.clearPermissions();
  return {
    context,
    async dispose() {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}
