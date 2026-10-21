import { describe, it, expect } from "vitest";
import { computeFingerprint, isFingerprintRelevant } from "../fingerprint.mjs";

describe("isFingerprintRelevant", () => {
  it("includes a UI Lab page/fixture", () => {
    expect(isFingerprintRelevant("src/app/dev/ui-lab/gate-b/b01-planned-ready/page.tsx")).toBe(true);
  });

  it("includes candidate_manifest.json", () => {
    expect(isFingerprintRelevant("docs/ui-lab/gate-b-w1-candidates/candidate_manifest.json")).toBe(true);
  });

  it("excludes prose docs", () => {
    expect(isFingerprintRelevant("docs/ui-lab/gate-b-w1-candidates/BLOCKERS.md")).toBe(false);
  });

  it("excludes capture-attestation.json (derived artifact, not a source of rendered content)", () => {
    expect(isFingerprintRelevant("docs/ui-lab/gate-b-w1-candidates/capture-attestation.json")).toBe(false);
  });
});

describe("computeFingerprint", () => {
  const files = {
    "a.ts": "content-a",
    "b.ts": "content-b",
  };
  const reader = (p: string) => (p in files ? files[p as keyof typeof files] : null);

  it("is stable across content-preserving path reorderings", () => {
    const fp1 = computeFingerprint(["a.ts", "b.ts"], reader);
    const fp2 = computeFingerprint(["b.ts", "a.ts"], reader);
    expect(fp1).toBe(fp2);
  });

  it("changes when content changes", () => {
    const fp1 = computeFingerprint(["a.ts"], reader);
    const fp2 = computeFingerprint(["a.ts"], (p) => (p === "a.ts" ? "different-content" : null));
    expect(fp1).not.toBe(fp2);
  });

  it("changes when a file is missing vs present (deletion is a visual-content change)", () => {
    const fp1 = computeFingerprint(["a.ts"], reader);
    const fp2 = computeFingerprint(["a.ts"], () => null);
    expect(fp1).not.toBe(fp2);
  });

  it("is a deterministic hex sha256 (64 chars)", () => {
    const fp = computeFingerprint(["a.ts", "b.ts"], reader);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("computeFingerprint — candidate_manifest.json approval-metadata exclusion", () => {
  const manifestPath = "docs/ui-lab/gate-b-w1-candidates/candidate_manifest.json";

  function manifest(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      candidates: [{ scenarioId: "B01", status: "CANDIDATE", knownGaps: [], ...overrides }],
    });
  }

  it("does not change when an `approval` block is added to a candidate that had none", () => {
    const before = manifest();
    const after = manifest({
      approval: { state: "APPROVED", approvedBy: "lagebj", revisionSha: "abc123" },
    });
    const reader = (content: string) => (path: string) => (path === manifestPath ? content : null);
    const fpBefore = computeFingerprint([manifestPath], reader(before));
    const fpAfter = computeFingerprint([manifestPath], reader(after));
    expect(fpBefore).toBe(fpAfter);
  });

  it("does not change when an existing `approval` block's own fields are edited", () => {
    const withApproval = manifest({ approval: { state: "APPROVED", approvedBy: "lagebj" } });
    const withDifferentApproval = manifest({ approval: { state: "APPROVED", approvedBy: "someone-else", revisionSha: "def456" } });
    const reader = (content: string) => (path: string) => (path === manifestPath ? content : null);
    const fp1 = computeFingerprint([manifestPath], reader(withApproval));
    const fp2 = computeFingerprint([manifestPath], reader(withDifferentApproval));
    expect(fp1).toBe(fp2);
  });

  it("still changes when a non-approval field changes — approval exclusion is narrowly scoped", () => {
    const v1 = manifest({ fixtureVersion: 1 });
    const v2 = manifest({ fixtureVersion: 2 });
    const reader = (content: string) => (path: string) => (path === manifestPath ? content : null);
    const fp1 = computeFingerprint([manifestPath], reader(v1));
    const fp2 = computeFingerprint([manifestPath], reader(v2));
    expect(fp1).not.toBe(fp2);
  });

  it("still changes for an ordinary source file (approval stripping is scoped to candidate_manifest.json paths)", () => {
    const fp1 = computeFingerprint(["a.ts"], () => "content-a");
    const fp2 = computeFingerprint(["a.ts"], () => JSON.stringify({ candidates: [{ approval: "whatever" }] }));
    expect(fp1).not.toBe(fp2);
  });

  it("falls back to hashing raw content if the manifest is not valid JSON, rather than crashing", () => {
    expect(() => computeFingerprint([manifestPath], () => "{not valid json")).not.toThrow();
  });
});
