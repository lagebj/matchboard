import { describe, it, expect } from "vitest";
import { isKnownRevision } from "../revision.mjs";

const HEAD = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const COMMIT = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3";
const MERGE = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
const UNRELATED = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const NEVER_PART_OF_PR = "f00dbabef00dbabef00dbabef00dbabef00dbabe";

describe("isKnownRevision", () => {
  it("accepts the exact current head SHA", () => {
    expect(isKnownRevision({ sha: HEAD, headSha: HEAD, prCommitShas: [], mergeCommitSha: null })).toBe(true);
  });

  it("accepts a SHA from the PR's own commit history", () => {
    expect(isKnownRevision({ sha: COMMIT, headSha: HEAD, prCommitShas: [HEAD, COMMIT], mergeCommitSha: null })).toBe(true);
  });

  it("accepts a synthetic merge commit SHA associated with this PR", () => {
    expect(isKnownRevision({ sha: MERGE, headSha: HEAD, prCommitShas: [HEAD], mergeCommitSha: MERGE })).toBe(true);
  });

  it("accepts a short abbreviation of a known SHA", () => {
    expect(isKnownRevision({ sha: HEAD.slice(0, 10), headSha: HEAD, prCommitShas: [], mergeCommitSha: null })).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isKnownRevision({ sha: HEAD.toUpperCase(), headSha: HEAD, prCommitShas: [], mergeCommitSha: null })).toBe(true);
  });

  it("rejects a SHA unrelated to this PR entirely", () => {
    expect(isKnownRevision({ sha: UNRELATED, headSha: HEAD, prCommitShas: [HEAD, COMMIT], mergeCommitSha: MERGE })).toBe(false);
  });

  it("accepts a GitHub-synthetic refs/pull/<n>/merge preview commit — identified by its own head SHA being one of its parents, not by the (often already-deleted) ref itself", () => {
    // PR #822's real-world case: /visual-approve referenced this exact kind of commit. Its ref
    // (refs/pull/822/merge) no longer resolves once the PR is merged, but the commit object
    // itself (and its parent list) remains fetchable by SHA.
    expect(
      isKnownRevision({ sha: UNRELATED, headSha: HEAD, prCommitShas: [HEAD], mergeCommitSha: null, parentShas: [MERGE, HEAD] }),
    ).toBe(true);
  });

  it("still rejects a SHA whose parents do not include this PR's head SHA", () => {
    expect(
      isKnownRevision({ sha: UNRELATED, headSha: HEAD, prCommitShas: [HEAD], mergeCommitSha: null, parentShas: [MERGE, COMMIT] }),
    ).toBe(false);
  });

  it("still accepts a merge-preview commit after the PR gains a new head — its PR-side parent is an OLDER commit this PR has always owned, not the current head", () => {
    // PR #829, 2026-11-22: /visual-approve referenced a refs/pull/829/merge commit whose PR-side
    // parent was the PR's head AT THAT TIME (COMMIT). A later push moved the head to a NEW commit
    // (HEAD), but COMMIT remains part of this PR's own history (prCommitShas), so the earlier
    // merge-preview reference must stay valid — it must not become permanently unverifiable
    // merely because the PR gained one more commit after the approval.
    expect(
      isKnownRevision({
        sha: UNRELATED,
        headSha: HEAD,
        prCommitShas: [COMMIT, HEAD],
        mergeCommitSha: null,
        parentShas: [MERGE, COMMIT],
      }),
    ).toBe(true);
  });

  it("rejects a merge-preview commit whose PR-side parent is not and has never been part of this PR", () => {
    expect(
      isKnownRevision({
        sha: UNRELATED,
        headSha: HEAD,
        prCommitShas: [HEAD],
        mergeCommitSha: null,
        parentShas: [MERGE, NEVER_PART_OF_PR],
      }),
    ).toBe(false);
  });
});
