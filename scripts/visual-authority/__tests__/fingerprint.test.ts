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
