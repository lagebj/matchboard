import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { caseBExactIntervals, identity, rawRecordsForHash, declaredPrimary } from "../fixtures";
import { computeCaseBEvidence } from "../view-model";

describe("A04-S6 declared-only-versus-evidenced fixture", () => {
  it("Case B reuses the same LCM 20m + RCM 10m shape as A04-S5, projecting to CM 30m / 1 match", () => {
    expect(caseBExactIntervals).toHaveLength(2);
    const evidence = computeCaseBEvidence();
    expect(evidence.profile).toBe(declaredPrimary);
    expect(evidence.totalMinutes).toBe(30);
    expect(evidence.appearanceCount).toBe(1);
  });

  it("fixtureSha256 matches an independent recomputation", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
