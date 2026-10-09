import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { caseBExactIntervals, identity, rawRecordsForHash, declaredPrimary } from "../fixtures";
import {
  computeCaseBEvidence,
  buildCaseADeclarationSourceRecords,
  buildCaseAExposureSourceRecords,
  buildCaseBDeclarationSourceRecords,
  buildCaseBEvidenceSourceRecords,
} from "../view-model";

describe("A04-S6 declared-only-versus-evidenced fixture", () => {
  it("Case B reuses the same LCM 20m + RCM 10m shape as A04-S5, projecting to CM 30m / 1 match", () => {
    expect(caseBExactIntervals).toHaveLength(2);
    const evidence = computeCaseBEvidence();
    expect(evidence.profile).toBe(declaredPrimary);
    expect(evidence.totalMinutes).toBe(30);
    expect(evidence.appearanceCount).toBe(1);
  });

  describe("independent review round 1 (PR #778, finding R2): declaration vs actual-exposure coverage are distinct", () => {
    it("Case A's declaration is COMPLETE, scoped separately from the exposure-absence claim", () => {
      const declarationSources = buildCaseADeclarationSourceRecords();
      expect(declarationSources).toHaveLength(1);
      expect(declarationSources[0].coverage).toBe("COMPLETE");
      expect(declarationSources[0].fieldValue).toBe(declaredPrimary);
    });

    it("Case A's actual-exposure absence has its own NOT_RECORDED source proving the absence was checked", () => {
      const exposureSources = buildCaseAExposureSourceRecords();
      expect(exposureSources).toHaveLength(1);
      expect(exposureSources[0].coverage).toBe("NOT_RECORDED");
      expect(exposureSources[0].fieldValue).toMatch(/checked/i);
    });

    it("Case B's declaration and evidence are scoped to separate source lists", () => {
      const declarationSources = buildCaseBDeclarationSourceRecords();
      const evidenceSources = buildCaseBEvidenceSourceRecords();
      expect(declarationSources).toHaveLength(1);
      expect(declarationSources[0].coverage).toBe("COMPLETE");
      expect(evidenceSources).toHaveLength(2);
      expect(evidenceSources.every((s) => s.coverage === "COMPLETE")).toBe(true);
      expect(evidenceSources.some((s) => s.fieldLabel === "Declared primary profile")).toBe(false);
    });
  });

  it("fixtureSha256 matches an independent recomputation", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
