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
  const botComment = (body: string) => ({ body, user: { login: "github-actions[bot]", type: "Bot" } });

  it("matches the real visual-review-deploy.yml comment template for the exact SHA", () => {
    const comments = [
      botComment(`Deployed PR #42 (\`${sha}\`) to the Test slot: https://test.matchboard.football`),
    ];
    expect(findDeploymentCommentForRevision(comments, sha)).toBe(true);
  });

  it("matches a shorter SHA prefix referenced in an approval against the full logged SHA", () => {
    const comments = [
      botComment(`Deployed PR #42 (\`${sha}\`) to the Test slot: https://test.matchboard.football`),
    ];
    expect(findDeploymentCommentForRevision(comments, sha.slice(0, 10))).toBe(true);
  });

  it("does not match a different revision", () => {
    const otherSha = "1111111111111111111111111111111111111111";
    const comments = [
      botComment(`Deployed PR #42 (\`${sha}\`) to the Test slot: https://test.matchboard.football`),
    ];
    expect(findDeploymentCommentForRevision(comments, otherSha)).toBe(false);
  });

  it("ignores unrelated comments, including a /visual-review deploy request itself", () => {
    const comments = [
      botComment("/visual-review deploy"),
      botComment("Some other comment mentioning a sha abcdef1234567890abcdef1234567890abcdef12 in prose."),
    ];
    expect(findDeploymentCommentForRevision(comments, sha)).toBe(false);
  });

  it("returns false for an empty comment thread", () => {
    expect(findDeploymentCommentForRevision([], sha)).toBe(false);
  });

  it("rejects a forged deploy comment from an unprivileged human commenter — body text alone is never sufficient", () => {
    const comments = [
      {
        body: `Deployed PR #42 (\`${sha}\`) to the Test slot: https://test.matchboard.football`,
        user: { login: "some-random-contributor", type: "User" },
      },
    ];
    expect(findDeploymentCommentForRevision(comments, sha)).toBe(false);
  });

  it("rejects a comment from an actor with the right login text but wrong type", () => {
    const comments = [
      {
        body: `Deployed PR #42 (\`${sha}\`) to the Test slot: https://test.matchboard.football`,
        user: { login: "github-actions[bot]", type: "User" },
      },
    ];
    expect(findDeploymentCommentForRevision(comments, sha)).toBe(false);
  });

  it("rejects a comment with no user field at all", () => {
    const comments = [
      { body: `Deployed PR #42 (\`${sha}\`) to the Test slot: https://test.matchboard.football` },
    ];
    expect(findDeploymentCommentForRevision(comments, sha)).toBe(false);
  });
});
