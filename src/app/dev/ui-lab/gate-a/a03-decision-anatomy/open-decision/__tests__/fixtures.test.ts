import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, situationText, reasonText, PENDING_STARTER_NAME, UNFILLED_SLOT_LABEL } from "../fixtures";

describe("A03-S1 open-decision fixture", () => {
  it("names the pending starter and the unfilled slot in both situation and reason text", () => {
    expect(situationText).toContain(PENDING_STARTER_NAME);
    expect(situationText).toContain(UNFILLED_SLOT_LABEL);
    expect(reasonText).toContain(PENDING_STARTER_NAME);
    expect(reasonText).toContain(UNFILLED_SLOT_LABEL);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("identity is fixed to the planning-open simulation clock", () => {
    expect(identity.scenarioId).toBe("A03-S1");
    expect(identity.fixedDateTimeUtc).toBe("2026-10-10T12:00:00.000Z");
  });
});
