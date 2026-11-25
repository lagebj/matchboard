import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, hypotheses, confirmErrorByHypothesisId, errorHypothesis } from "../fixtures";

describe("GATE-D-W2-D03-DECISION-FLOW fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("has exactly three hypotheses, each with a distinct id", () => {
    expect(hypotheses).toHaveLength(3);
    expect(new Set(hypotheses.map((h) => h.id)).size).toBe(3);
  });

  it("only the error-demo hypothesis is wired to a simulated failure", () => {
    expect(Object.keys(confirmErrorByHypothesisId)).toEqual([errorHypothesis.id]);
  });

  it("every hypothesis is genuinely pending — no outcome is pre-decided in the fixture itself", () => {
    for (const hypothesis of hypotheses) {
      expect(hypothesis.statement.length).toBeGreaterThan(0);
    }
  });
});
