// Visual Authority Gate (ADR-0159) — visual-content fingerprint. Lets a documentation-only
// follow-up commit keep an existing approval valid: the fingerprint only covers files that
// actually determine what gets rendered/captured, never prose docs (BLOCKERS.md,
// SOURCE_RECONCILIATION.md, etc.), so editing those doesn't change the fingerprint and therefore
// doesn't invalidate a prior approval bound to it.

import { createHash } from "node:crypto";

const MISSING_SENTINEL = "<MISSING>";
const SEPARATOR = "\u0000";

// Each candidate's own `approval` block is excluded from a candidate_manifest.json's
// contribution to the fingerprint. The approval block is a *record* of a decision already made on
// the PR's comment thread (the real ledger, per evaluate-gate.mjs), never written by anything
// other than a human-triggered promotion of an already-APPROVED gate result. Hashing it anyway
// creates a self-invalidation loop: promote-to-golden.mjs writes the approval metadata into the
// manifest as a follow-up commit, which changes the manifest's fingerprint, which makes that very
// commit's head SHA look like a *different* visual-content fingerprint than the one that was just
// approved — INVALID, even though no rendered content changed. Stripping `approval` before
// hashing closes that loop while still hashing every other field (status, fixtureVersion,
// componentOwners, knownGaps, etc.), so an edit to anything else still correctly invalidates.
function stripApprovalMetadata(path, content) {
  if (content === null || !isCandidateManifestPath(path)) return content;
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content; // not valid JSON — hash the raw content rather than crash.
  }
  if (!Array.isArray(parsed.candidates)) return content;
  parsed.candidates = parsed.candidates.map(({ approval, ...rest }) => rest);
  return JSON.stringify(parsed);
}

function isCandidateManifestPath(path) {
  return path.endsWith("/candidate_manifest.json") || path === "candidate_manifest.json";
}

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
    .map((path) => `${path}\n${stripApprovalMetadata(path, readFileAt(path)) ?? MISSING_SENTINEL}`)
    .join(SEPARATOR);
  return createHash("sha256").update(serialized).digest("hex");
}

// A file counts toward the fingerprint only if it can change what's rendered or captured:
// scenario fixtures/pages, the capture script's scenario entries, and candidate_manifest.json's
// own content (minus each candidate's `approval` block — see stripApprovalMetadata above). Prose
// docs under docs/ui-lab/ (BLOCKERS.md, SOURCE_RECONCILIATION.md, VISUAL_VS_CURRENT.md, etc.) and
// capture-attestation.json (a derived artifact, not a source of rendered content) are excluded.
export function isFingerprintRelevant(path) {
  if (path.startsWith("src/app/dev/ui-lab/")) return true;
  if (path.startsWith("src/components/touchline/")) return true;
  if (path.startsWith("src/components/matches/match-detail/")) return true;
  if (path.startsWith("src/components/matches/match-insights/")) return true;
  if (path === "scripts/ui-lab-visual-review.mjs") return true;
  if (path.startsWith("docs/ui-lab/") && path.endsWith("/candidate_manifest.json")) return true;
  return false;
}
