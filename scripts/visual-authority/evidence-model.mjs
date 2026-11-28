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

// The real, verified login visual-review-deploy.yml's own `gh pr comment` (run with the default
// GITHUB_TOKEN) posts as — confirmed against real "Deployed PR #..." comments on this repository
// (e.g. PR #805: {"login":"github-actions[bot]","type":"Bot"}). Checking this is required, not
// optional: without it, any commenter on the PR — no permission check at all, unlike
// check-actor-permission.mjs's real-time collaborator check used for the actual approval decision
// — could post the literal deploy-comment text themselves and have this archive a permanent
// GitHub Release whose notes falsely claim a real deployment review happened.
const TRUSTED_DEPLOY_COMMENT_LOGIN = "github-actions[bot]";

/**
 * @param {{ body: string, user?: { login?: string, type?: string } }[]} comments - this PR's full
 *   comment thread (same source archive-evidence.mjs and run-gate.mjs already read elsewhere — no
 *   new storage).
 * @param {string} approvedRevision - the exact approved SHA to match against.
 * @returns {boolean}
 */
export function findDeploymentCommentForRevision(comments, approvedRevision) {
  const target = approvedRevision.toLowerCase();
  return comments.some((comment) => {
    if (comment.user?.login !== TRUSTED_DEPLOY_COMMENT_LOGIN || comment.user?.type !== "Bot") {
      return false; // only visual-review-deploy.yml's own bot-posted comment is trusted — body text alone is never sufficient, no matter who posted it.
    }
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
