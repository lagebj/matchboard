import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, squad, preparationInput } from "../fixtures";

describe("B06 League · Before fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the stored fixtureSha256 has no self-reference inside its own hash input", () => {
    expect(JSON.stringify(rawRecordsForHash)).not.toContain(identity.fixtureSha256);
  });

  it("is the League 'ready' state — fully assigned except the one genuine reserve", () => {
    const unassigned = squad.filter((m) => m.tacticalPosition === null);
    expect(unassigned).toHaveLength(1);
    expect(unassigned[0]?.role).toBe("reserve");
    expect(preparationInput.hasLineup).toBe(true);
    expect(preparationInput.squadSelectedCount).toBe(preparationInput.squadTarget);
  });

  it("never carries a forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "expectedgoals", "shots", "cards", "rating", "playerofthematch"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
