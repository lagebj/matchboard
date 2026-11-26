import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, hypothesis, sources, forwardProfileRole } from "../fixtures";
import { resolveEvidenceSource } from "../../../w2-shared/evidence-source-types";

describe("GATE-D-W2-D06-SOURCE-INSPECTION fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("every cited ref resolves to a real source record of the matching kind", () => {
    for (const ref of hypothesis.supportingRefs) {
      expect(() => resolveEvidenceSource(ref, sources)).not.toThrow();
    }
  });

  it("the exact position-interval sources retain the 24-code tactical precision", () => {
    const lw = resolveEvidenceSource({ kind: "ACTUAL_POSITION_INTERVAL", id: "interval-sara-lw-early" }, sources);
    const cf = resolveEvidenceSource({ kind: "ACTUAL_POSITION_INTERVAL", id: "interval-sara-cf-recent" }, sources);
    expect(lw.detail).toMatch(/exact tactical code: LW/);
    expect(cf.detail).toMatch(/exact tactical code: CF/);
  });

  it("the hypothesis uses the real 14-role profile projection for its own narrative language", () => {
    expect(forwardProfileRole).toBe("F");
    expect(hypothesis.statement).toContain(`profile role: ${forwardProfileRole}`);
  });

  it("never promotes the hypothesis's own interpretation as an already-confirmed attribute change", () => {
    expect(hypothesis.statement).toMatch(/not a confirmed attribute or position-suitability conclusion/);
  });
});
