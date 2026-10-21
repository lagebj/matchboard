import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, report, combinationEvidence } from "../fixtures";

describe("B06 Event · After fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("is genuinely locked — not a draft masquerading as completed", () => {
    expect(report.status).toBe("LOCKED");
    expect(report.completedBy).not.toBeNull();
    expect(report.completedAt).not.toBeNull();
  });

  it("matches League · After's final score, for a fair presentation-only comparison", () => {
    expect(report.ourScore).toBe(3);
    expect(report.opponentScore).toBe(1);
  });

  it("the combination evidence is Event-attributed (eventMatchId set, matchId null)", () => {
    for (const row of combinationEvidence) {
      expect(row.matchId).toBeNull();
      expect(row.eventMatchId).not.toBeNull();
    }
  });

  it("never carries a forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "expectedgoals", "shots", "cards", "rating", "playerofthematch"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
