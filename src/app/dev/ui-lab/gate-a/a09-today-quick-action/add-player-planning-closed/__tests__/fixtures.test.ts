import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash } from "../fixtures";
import { planningClosedOutcome } from "../view-model";

describe("A09-S4 add-player-planning-closed fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the predeclared outcome is PLANNING_CLOSED", () => {
    expect(planningClosedOutcome.kind).toBe("PLANNING_CLOSED");
  });
});
