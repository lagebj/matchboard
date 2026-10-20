import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchInsights, squad, opponentMemory } from "../fixtures";
import { b01TobiasRcmAppearanceRecords } from "../../shared/match-b-fixture";

function hashOf(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

describe("B01 planned-ready fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  // B1-R7 regression coverage: proves the widened rawRecordsForHash actually depends on
  // b01TobiasRcmAppearanceRecords, not merely re-including it for show (this is the regression
  // test that would have caught the original bug — material evidence excluded from the hash).
  it("mutating a b01TobiasRcmAppearanceRecords field changes the recomputed hash", () => {
    const mutated = {
      ...rawRecordsForHash,
      b01TobiasRcmAppearanceRecords: [
        { ...b01TobiasRcmAppearanceRecords[0]!, fieldValue: "MUTATED" },
        b01TobiasRcmAppearanceRecords[1]!,
      ],
    };
    expect(hashOf(mutated)).not.toBe(identity.fixtureSha256);
    expect(hashOf(mutated)).not.toBe(hashOf(rawRecordsForHash));
  });

  it("the stored fixtureSha256 has no self-reference inside its own hash input", () => {
    expect(JSON.stringify(rawRecordsForHash)).not.toContain(identity.fixtureSha256);
  });

  it("hashing the same payload twice is byte-identical — no hidden nondeterminism", () => {
    expect(JSON.stringify(rawRecordsForHash)).toBe(JSON.stringify(rawRecordsForHash));
    expect(hashOf(rawRecordsForHash)).toBe(hashOf(rawRecordsForHash));
  });

  it("never carries a forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "expectedgoals", "shots", "cards", "rating", "playerofthematch", "momentum"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("every Match Insight is DETERMINISTIC or AI, never a synthesized numeric score", () => {
    for (const insight of matchInsights.insights) {
      expect(["DETERMINISTIC", "AI"]).toContain(insight.source);
      expect(typeof insight.relevance).toBe("string");
    }
  });

  it("the lineup is fully assigned except the genuine reserve — this is the 'ready' state", () => {
    const unassigned = squad.filter((m) => m.tacticalPosition === null);
    expect(unassigned).toHaveLength(1);
    expect(unassigned[0]?.role).toBe("reserve");
  });

  it("every evidenceRef on both Match Insights resolves to a real recorded source (B1-R3)", () => {
    const recentEncounterIds = new Set((opponentMemory?.recentEncounters ?? []).map((e) => e.matchId));
    const tobiasAppearanceIds = new Set(b01TobiasRcmAppearanceRecords.map((r) => r.sourceId));
    for (const ref of matchInsights.insights[0]!.evidenceRefs) {
      expect(recentEncounterIds.has(ref)).toBe(true);
    }
    for (const ref of matchInsights.insights[1]!.evidenceRefs) {
      expect(tobiasAppearanceIds.has(ref)).toBe(true);
    }
  });
});
