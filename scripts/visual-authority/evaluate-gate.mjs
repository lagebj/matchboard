// Visual Authority Gate (ADR-0159) — pure decision core. No network/filesystem access: the
// workflow gathers everything (changed-file classification, every PR comment, each distinct
// commenter's current permission, the current and any referenced-SHA fingerprints) and calls
// this function once with the gathered facts. Kept pure/sync specifically so it's exhaustively
// unit-testable without mocking the network on every branch.
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

import { parseCommand } from "./parse-comment.mjs";

/**
 * @param {object} args
 * @param {boolean} args.applicable
 * @param {string} args.headSha
 * @param {Array<{body: string, user: string, createdAt: string, id: number}>} args.comments
 *   Must already reflect each comment's CURRENT body (the workflow's responsibility to fetch
 *   fresh, not a stale cache) and be in chronological order.
 * @param {(login: string) => boolean} args.isActorPrivileged
 * @param {string} args.currentFingerprint
 * @param {(sha: string) => string | null} args.fingerprintAtSha
 * @returns {{conclusion: "success"|"failure", state: "NOT_APPLICABLE"|"APPROVED"|"AWAITING_APPROVAL"|"INVALID", title: string, summary: string}}
 */
export function evaluateGate({ applicable, headSha, comments, isActorPrivileged, currentFingerprint, fingerprintAtSha }) {
  if (!applicable) {
    return {
      conclusion: "success",
      state: "NOT_APPLICABLE",
      title: "No visual approval needed",
      summary: "No changed file touches a UI Lab candidate, shared Touchline/match-detail component, or capture artifact.",
    };
  }

  const privilegedCommands = [];
  for (const comment of comments) {
    if (!isActorPrivileged(comment.user)) continue;
    const parsed = parseCommand(comment.body);
    if (parsed.kind === "approve" || parsed.kind === "reject") {
      privilegedCommands.push({ ...parsed, user: comment.user, createdAt: comment.createdAt });
    }
  }

  if (privilegedCommands.length === 0) {
    return {
      conclusion: "failure",
      state: "AWAITING_APPROVAL",
      title: "Awaiting visual approval",
      summary: "This PR touches UI Lab/visual-authority-relevant content. Post `/visual-approve <sha>` (from an actor with write access) once the rendered output has been reviewed.",
    };
  }

  const last = privilegedCommands[privilegedCommands.length - 1];

  if (last.kind === "reject") {
    return {
      conclusion: "failure",
      state: "INVALID",
      title: "Visual approval rejected",
      summary: last.reason
        ? `Rejected by @${last.user}: ${last.reason}`
        : `Rejected by @${last.user} (no reason given).`,
    };
  }

  // last.kind === "approve"
  if (last.sha === headSha) {
    return {
      conclusion: "success",
      state: "APPROVED",
      title: "Visually approved",
      summary: `Approved by @${last.user} for the exact current head commit (${headSha}).`,
    };
  }

  const approvedFingerprint = fingerprintAtSha(last.sha);
  if (approvedFingerprint !== null && approvedFingerprint === currentFingerprint) {
    return {
      conclusion: "success",
      state: "APPROVED",
      title: "Visually approved (unchanged visual content)",
      summary: `Approved by @${last.user} for ${last.sha}; the current head (${headSha}) has a different SHA but an identical visual-content fingerprint (e.g. a documentation-only follow-up commit), so the approval still applies.`,
    };
  }

  return {
    conclusion: "failure",
    state: "INVALID",
    title: "Approval is stale",
    summary: `@${last.user} approved ${last.sha}, but the current head is ${headSha} with a different visual-content fingerprint. A fresh \`/visual-approve ${headSha}\` is required.`,
  };
}
