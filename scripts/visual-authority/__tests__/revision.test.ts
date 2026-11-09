import { describe, it, expect } from "vitest";
import { isKnownRevision } from "../revision.mjs";

const HEAD = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const COMMIT = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3";
const MERGE = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
const UNRELATED = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

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
});
