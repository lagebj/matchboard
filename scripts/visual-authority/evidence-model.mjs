// ADR-0161 — visual-authority evidence classification. Pure, no network/filesystem access, used
// by archive-evidence.mjs's orchestration. Derives which evidence path applies from facts the
// archive job already has (a successful capture run, a real deployment comment on the PR's own
// thread) rather than asking a reviewer to pick a mode — and never fabricates evidence that
// doesn't exist. Approval validity (ADR-0159) never depends on any of these outcomes; this module
// only classifies what gets archived, never whether the PR is approved.

export const EVIDENCE_TYPES = Object.freeze({
  CAPTURE_REVIEW: "CAPTURE_REVIEW",
  DEPLOYMENT_REVIEW: "DEPLOYMENT_REVIEW",
  NO_EVIDENCE_RECORDED: "NO_EVIDENCE_RECORDED",
});

/**
 * @param {{ captureRunFound: boolean, deploymentCommentFound: boolean }} facts
 * @returns {"CAPTURE_REVIEW" | "DEPLOYMENT_REVIEW" | "NO_EVIDENCE_RECORDED"}
 */
export function classifyEvidence({ captureRunFound, deploymentCommentFound }) {
  if (captureRunFound) return EVIDENCE_TYPES.CAPTURE_REVIEW;
  if (deploymentCommentFound) return EVIDENCE_TYPES.DEPLOYMENT_REVIEW;
  return EVIDENCE_TYPES.NO_EVIDENCE_RECORDED;
}

// visual-review-deploy.yml's own literal comment template (see that workflow's "Record the
// deployment URL on the lease and reply" step) — matched here rather than duplicated/paraphrased,
// so a wording drift in one place is a visible test failure in the other, not a silent gap.
const DEPLOY_COMMENT_PATTERN = /^Deployed PR #(\d+) \(`([0-9a-f]{7,40})`\) to the Test slot:/m;

/**
 * @param {{ body: string }[]} comments - this PR's full comment thread (same source
 *   archive-evidence.mjs and run-gate.mjs already read elsewhere — no new storage).
 * @param {string} approvedRevision - the exact approved SHA to match against.
 * @returns {boolean}
 */
export function findDeploymentCommentForRevision(comments, approvedRevision) {
  const target = approvedRevision.toLowerCase();
  return comments.some((comment) => {
    const match = DEPLOY_COMMENT_PATTERN.exec(comment.body ?? "");
    if (!match) return false;
    const [, , deployedSha] = match;
    // The deploy comment logs the full HEAD_SHA; an approval may reference a shorter prefix of
    // the same commit (both are already validated as the same revision upstream in
    // resolve-approval.mjs/revision.mjs) — compare by prefix in whichever direction is shorter.
    const shorter = deployedSha.length <= target.length ? deployedSha : target;
    const longer = deployedSha.length <= target.length ? target : deployedSha;
    return longer.startsWith(shorter);
  });
}
