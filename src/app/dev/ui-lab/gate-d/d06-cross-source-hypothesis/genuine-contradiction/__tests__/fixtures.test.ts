import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, hypothesis, sources } from "../fixtures";
import { resolveEvidenceSource } from "../../../w2-shared/evidence-source-types";

describe("GATE-D-W2-D06-CONTRADICTION fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("has a genuine contradiction — both contradicting refs concern the same substantive claim (centre-back readiness)", () => {
    expect(hypothesis.contradictingRefs).toHaveLength(2);
    const assessment = resolveEvidenceSource({ kind: "HUMAN_ASSESSMENT", id: "assessment-noah-cb-not-ready" }, sources);
    const observation = resolveEvidenceSource({ kind: "QUALITATIVE_OBSERVATION", id: "obs-noah-cb-trusted-now" }, sources);
    expect(assessment.detail).toMatch(/[Nn]ot ready for centre-back/);
    expect(observation.detail).toMatch(/[Tt]rust him there/);
  });

  it("the contradicting sources are not silently discarded or reconciled — the hypothesis names both explicitly", () => {
    expect(hypothesis.statement).toMatch(/20 Sep/);
    expect(hypothesis.statement).toMatch(/11 Oct/);
    expect(hypothesis.statement).toMatch(/does not assume the later note simply supersedes/);
  });

  it("every cited ref resolves to a real source record of the matching kind", () => {
    for (const ref of [...hypothesis.supportingRefs, ...hypothesis.contradictingRefs]) {
      expect(() => resolveEvidenceSource(ref, sources)).not.toThrow();
    }
  });

  it("uncertainty is HIGH — an unresolved contradiction is never presented as a confident finding", () => {
    expect(hypothesis.uncertainty).toBe("HIGH");
  });
});
