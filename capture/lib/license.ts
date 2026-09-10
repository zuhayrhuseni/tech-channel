import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// Not commercial-clean for a monetized channel (asset-sourcing.md Rule B2):
// share-alike, non-commercial, no-derivatives, GFDL. Default-deny: an
// unrecognized license string should be treated as bad by the caller.
const BAD = /(by-sa|[-\s]nc\b|[-\s]nd\b|non[-\s]?commercial|no[-\s]?deriv|gfdl)/i;

export function rejectIfBadLicense(license: string): void {
  if (!license || BAD.test(license)) {
    throw new Error(
      `LICENSE FAIL: "${license || "unknown"}" is not commercial-clean (BY-SA / NC / ND / GFDL / unknown rejected).`,
    );
  }
}

export async function writeCredit(creditsPath: string, line: string): Promise<void> {
  await mkdir(dirname(creditsPath), { recursive: true });
  await appendFile(creditsPath, line.trim() + "\n");
}
