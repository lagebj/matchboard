// Visual Authority Gate (ADR-0159) — visual-content fingerprint. Lets a documentation-only
// follow-up commit keep an existing approval valid: the fingerprint only covers files that
// actually determine what gets rendered/captured, never prose docs (BLOCKERS.md,
// SOURCE_RECONCILIATION.md, etc.), so editing those doesn't change the fingerprint and therefore
// doesn't invalidate a prior approval bound to it.

import { createHash } from "node:crypto";

const MISSING_SENTINEL = "<MISSING>";
const SEPARATOR = "\u0000";

/**
 * @param {string[]} paths - already filtered to visual-content-relevant paths (see
 *   isFingerprintRelevant below) — callers should not pass every path classify() matched.
 * @param {(path: string) => string | null} readFileAt - injected reader; real callers resolve
 *   content via the GitHub Contents API at a specific ref, tests pass a fixture map lookup.
 * @returns {string} sha256 hex digest
 */
export function computeFingerprint(paths, readFileAt) {
  const sorted = [...paths].sort();
  const serialized = sorted
    .map((path) => `${path}\n${readFileAt(path) ?? MISSING_SENTINEL}`)
    .join(SEPARATOR);
  return createHash("sha256").update(serialized).digest("hex");
}

// A file counts toward the fingerprint only if it can change what's rendered or captured:
// scenario fixtures/pages, the capture script's scenario entries, and candidate_manifest.json's
// own content (its `approval` block is intentionally still part of this — an approval record
// itself changing is a meaningful event, not noise to filter out). Prose docs under docs/ui-lab/
// (BLOCKERS.md, SOURCE_RECONCILIATION.md, VISUAL_VS_CURRENT.md, etc.) and capture-attestation.json
// (a derived artifact, not a source of rendered content) are excluded.
export function isFingerprintRelevant(path) {
  if (path.startsWith("src/app/dev/ui-lab/")) return true;
  if (path.startsWith("src/components/touchline/")) return true;
  if (path.startsWith("src/components/matches/match-detail/")) return true;
  if (path.startsWith("src/components/matches/match-insights/")) return true;
  if (path === "scripts/ui-lab-visual-review.mjs") return true;
  if (path.startsWith("docs/ui-lab/") && path.endsWith("/candidate_manifest.json")) return true;
  return false;
}
