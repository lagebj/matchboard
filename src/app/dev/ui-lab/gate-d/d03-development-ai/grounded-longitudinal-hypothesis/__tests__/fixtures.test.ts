import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, hypothesis, sources, developmentInput } from "../fixtures";
import { resolveEvidenceSource } from "../../../w2-shared/evidence-source-types";

describe("GATE-D-W2-D03-GROUNDED fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("every supporting and contradicting ref resolves to a source record of the matching kind", () => {
    for (const ref of [...hypothesis.supportingRefs, ...hypothesis.contradictingRefs]) {
      expect(() => resolveEvidenceSource(ref, sources)).not.toThrow();
    }
  });

  it("discloses a genuine contradicting observation rather than hiding it", () => {
    expect(hypothesis.contradictingRefs.length).toBeGreaterThan(0);
    const contradicting = resolveEvidenceSource(hypothesis.contradictingRefs[0]!, sources);
    expect(contradicting.detail).toMatch(/giveaway/i);
  });

  it("the hypothesis never claims the development focus itself is complete or resolved", () => {
    expect(hypothesis.statement).not.toMatch(/resolved|complete|fixed|no longer an issue/i);
  });

  it("the derived trend's own source record states its comparison window, not just a bare number", () => {
    const trend = resolveEvidenceSource(hypothesis.supportingRefs[0]!, sources);
    expect(trend.detail).toMatch(/previous 3 matches/);
    expect(trend.detail).toMatch(/latest 3 matches/);
    expect(trend.coverage).toMatch(/eligible matches/);
  });

  it("the existing development focus is a real, already-started thread, independent of the hypothesis", () => {
    expect(developmentInput.activeFocus?.reviewState).toBe("PENDING");
    expect(developmentInput.activeFocus?.observationCount).toBe(developmentInput.observationTimeline.length);
  });
});
