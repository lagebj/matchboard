import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, hypothesis, sources, cbProfileRole } from "../fixtures";
import { resolveEvidenceSource } from "../../../w2-shared/evidence-source-types";

describe("GATE-D-W2-D06-COHERENT fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("cites three distinct evidence kinds, not one measurement repeated three times", () => {
    const kinds = new Set(hypothesis.supportingRefs.map((r) => r.kind));
    expect(kinds).toEqual(new Set(["DERIVED_TREND", "QUALITATIVE_OBSERVATION", "ACTUAL_POSITION_INTERVAL"]));
  });

  it("every cited ref resolves to a real source record of the matching kind", () => {
    for (const ref of hypothesis.supportingRefs) {
      expect(() => resolveEvidenceSource(ref, sources)).not.toThrow();
    }
  });

  it("the exact position-interval sources retain the 24-code tactical precision, never the 14-role profile label", () => {
    const rb = resolveEvidenceSource({ kind: "ACTUAL_POSITION_INTERVAL", id: "interval-noah-rb-early" }, sources);
    const cb = resolveEvidenceSource({ kind: "ACTUAL_POSITION_INTERVAL", id: "interval-noah-cb-recent" }, sources);
    expect(rb.detail).toMatch(/exact tactical code: RB/);
    expect(cb.detail).toMatch(/exact tactical code: LCB/);
  });

  it("the hypothesis's own profile-level language uses the real 14-role projection, reused not reinvented", () => {
    expect(cbProfileRole).toBe("CB");
    expect(hypothesis.statement).toContain(`profile role: ${cbProfileRole}`);
  });

  it("never claims a demonstrated improvement in ability from an exposure shift", () => {
    expect(hypothesis.statement).toMatch(/not a demonstrated improvement in centre-back ability/);
  });

  it("has no contradicting evidence in this coherent case — genuine agreement, not a forced one", () => {
    expect(hypothesis.contradictingRefs).toHaveLength(0);
  });
});
