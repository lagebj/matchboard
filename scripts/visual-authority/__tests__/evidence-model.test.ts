import { describe, it, expect } from "vitest";
import { classifyEvidence, findDeploymentCommentForRevision, EVIDENCE_TYPES } from "../evidence-model.mjs";

describe("classifyEvidence", () => {
  it("prefers CAPTURE_REVIEW when a capture run was found", () => {
    expect(classifyEvidence({ captureRunFound: true, deploymentCommentFound: true })).toBe(
      EVIDENCE_TYPES.CAPTURE_REVIEW,
    );
  });

  it("falls back to DEPLOYMENT_REVIEW when only a deployment comment exists", () => {
    expect(classifyEvidence({ captureRunFound: false, deploymentCommentFound: true })).toBe(
      EVIDENCE_TYPES.DEPLOYMENT_REVIEW,
    );
  });

  it("reports NO_EVIDENCE_RECORDED when neither exists — never fabricates evidence", () => {
    expect(classifyEvidence({ captureRunFound: false, deploymentCommentFound: false })).toBe(
      EVIDENCE_TYPES.NO_EVIDENCE_RECORDED,
    );
  });
});

describe("findDeploymentCommentForRevision", () => {
  const sha = "abcdef1234567890abcdef1234567890abcdef12";

  it("matches the real visual-review-deploy.yml comment template for the exact SHA", () => {
    const comments = [
      { body: `Deployed PR #42 (\`${sha}\`) to the Test slot: https://test.matchboard.football` },
    ];
    expect(findDeploymentCommentForRevision(comments, sha)).toBe(true);
  });

  it("matches a shorter SHA prefix referenced in an approval against the full logged SHA", () => {
    const comments = [
      { body: `Deployed PR #42 (\`${sha}\`) to the Test slot: https://test.matchboard.football` },
    ];
    expect(findDeploymentCommentForRevision(comments, sha.slice(0, 10))).toBe(true);
  });

  it("does not match a different revision", () => {
    const otherSha = "1111111111111111111111111111111111111111";
    const comments = [
      { body: `Deployed PR #42 (\`${sha}\`) to the Test slot: https://test.matchboard.football` },
    ];
    expect(findDeploymentCommentForRevision(comments, otherSha)).toBe(false);
  });

  it("ignores unrelated comments, including a /visual-review deploy request itself", () => {
    const comments = [
      { body: "/visual-review deploy" },
      { body: "Some other comment mentioning a sha abcdef1234567890abcdef1234567890abcdef12 in prose." },
    ];
    expect(findDeploymentCommentForRevision(comments, sha)).toBe(false);
  });

  it("returns false for an empty comment thread", () => {
    expect(findDeploymentCommentForRevision([], sha)).toBe(false);
  });
});
