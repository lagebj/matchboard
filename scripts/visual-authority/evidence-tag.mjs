// Visual Authority Gate (ADR-0159 follow-up) — deterministic, collision-safe GitHub Release tag
// naming for archived visual evidence. Pure, so archive-evidence.mjs's idempotency guarantee
// (re-running archival for an already-archived scenario/revision pair is a no-op, never a
// duplicate release) is independently unit-testable without touching the GitHub API.

/**
 * @param {string} scenarioId
 * @param {string} approvedRevision - the full (or already-abbreviated) approved commit SHA.
 * @returns {string}
 */
export function releaseTagFor(scenarioId, approvedRevision) {
  return `visual-evidence/${scenarioId}/${approvedRevision.slice(0, 12)}`;
}
