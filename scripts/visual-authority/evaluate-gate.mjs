// Visual Authority Gate (ADR-0159, scenario-scoped follow-up) — pure aggregation core. No
// network/filesystem access: run-gate.mjs gathers everything (changed-file classification, every
// PR comment, each distinct commenter's current permission and Visual Authority allowlist
// membership, the candidate scenario registry, and per-scenario fingerprints) and calls
// resolve-approval.mjs's resolveApproval() to get a per-scenario decision map, then this module's
// evaluateGateFromScenarios() once to aggregate that map into the single Checks-API conclusion
// this gate reports per PR. Kept pure/sync specifically so it's exhaustively unit-testable without
// mocking the network on every branch.
//
// There is no separate "approval record" storage — the PR's own comment thread is the ledger.
// Re-deriving the decision from that thread on every evaluation (rather than caching a prior
// verdict) is what makes invalidation (permission revoked, new reject posted, approval edited
// away) work for free: there is no stale cache to forget to invalidate.
//
// AWAITING_APPROVAL reports GitHub Checks conclusion "failure", not "neutral": GitHub's own
// required-status-checks merge gate treats a "neutral" conclusion as passing (see
// required-checks.mjs's evaluateRequiredChecks, which accepts "success"/"skipped"/"neutral").
// Once Stage B adds this check to ruleset 21317362's required checks, a "neutral" conclusion here
// would let an unreviewed PR merge — the exact outcome this gate exists to prevent. "neutral" is
// reserved for states that are correctly non-blocking (NOT_APPLICABLE is reported as "success"
// instead, so "neutral" is unused by this gate entirely now).

/**
 * Aggregates resolve-approval.mjs's per-scenario results into the single Checks-API conclusion
 * this gate reports per PR. PR-level approval permits merge; scenario-level approval (the Map
 * passed in here) records which candidate presentations were actually reviewed — see ADR-0159's
 * 2026-11-09 follow-up. A PR touching several scenarios only reports APPROVED once every
 * applicable scenario does; one rejected or stale scenario blocks the whole PR even if its
 * siblings are fine, matching the "partial approval" requirement this generalization exists for.
 *
 * @param {object} args
 * @param {boolean} args.applicable
 * @param {Map<string, import("./resolve-approval.mjs").EffectiveVisualApproval>} args.scenarioResults
 * @param {string[]} args.errors - malformed-command errors from resolveApproval (e.g. an unknown
 *   scenario ID referenced in a comment) — always fails the whole PR closed, never partially.
 * @returns {{conclusion: "success"|"failure", state: "NOT_APPLICABLE"|"APPROVED"|"AWAITING_APPROVAL"|"INVALID", title: string, summary: string}}
 */
export function evaluateGateFromScenarios({ applicable, scenarioResults, errors }) {
  if (!applicable) {
    return {
      conclusion: "success",
      state: "NOT_APPLICABLE",
      title: "No visual approval needed",
      summary: "No changed file touches a UI Lab candidate, shared Touchline/match-detail component, or capture artifact.",
    };
  }

  if (errors.length > 0) {
    return {
      conclusion: "failure",
      state: "INVALID",
      title: "Malformed visual approval command",
      summary: errors.join(" "),
    };
  }

  const results = [...scenarioResults.values()];

  if (results.length === 0) {
    return {
      conclusion: "failure",
      state: "AWAITING_APPROVAL",
      title: "Awaiting visual approval",
      summary: "This PR touches visual-authority-relevant content, but no scenario registry entry could be resolved for it — failing closed.",
    };
  }

  const rejectedOrStale = results.filter((r) => r.state === "REJECTED" || r.state === "STALE");
  if (rejectedOrStale.length > 0) {
    return {
      conclusion: "failure",
      state: "INVALID",
      title: "Visual approval rejected or stale",
      summary: rejectedOrStale.map((r) => `${r.scenarioId}: ${r.reason}`).join(" "),
    };
  }

  const awaiting = results.filter((r) => r.state === "AWAITING_APPROVAL");
  if (awaiting.length > 0) {
    return {
      conclusion: "failure",
      state: "AWAITING_APPROVAL",
      title: "Awaiting visual approval",
      summary: `Awaiting approval for: ${awaiting.map((r) => r.scenarioId).join(", ")}. Post /visual-approve <sha> (optionally scoped with a scenarios: line) from an actor with write access and Visual Authority.`,
    };
  }

  return {
    conclusion: "success",
    state: "APPROVED",
    title: "Visually approved",
    summary: results.map((r) => `${r.scenarioId}: approved by ${r.approvedBy ?? "a historical record"} (${r.source}).`).join(" "),
  };
}
