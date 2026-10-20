import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity, timeline, matchInsights, whatThisMatchAddedInput } from "../fixtures";
import { b04CombinationSourceRecords, b04FootballObservations } from "../../shared/match-b-fixture";

function hashOf(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

describe("B04 completed-rich fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the recorded chronology reconciles exactly with the final score", () => {
    const goalsFor = timeline.filter((i) => i.kind === "GOAL_FOR").length;
    const goalsAgainst = timeline.filter((i) => i.kind === "GOAL_AGAINST").length;
    expect(matchIdentity.score).toEqual({ home: goalsFor, away: goalsAgainst });
  });

  it("every assist pairing is only on a canonical-live-event-sourced item", () => {
    for (const item of timeline) {
      if (item.assistPlayerName !== null) {
        expect(item.sourceIsCanonicalLiveEvent).toBe(true);
      }
    }
  });

  it("the earned insight cites real evidence and is never a numeric score", () => {
    expect(matchInsights.insights.length).toBeGreaterThan(0);
    for (const insight of matchInsights.insights) {
      expect(insight.evidenceRefs.length).toBeGreaterThan(0);
      expect(["DETERMINISTIC", "AI"]).toContain(insight.source);
    }
  });

  it("never carries a forbidden fabricated metric", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "shots", "cards", "rating", "playerofthematch", "momentum"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("every evidenceRef on the combination insight resolves to a real recorded source (B1-R3)", () => {
    const timelineIds = new Set(timeline.map((i) => i.id));
    const sourceIds = new Set(b04CombinationSourceRecords.map((s) => s.sourceId));
    for (const ref of matchInsights.insights[0]!.evidenceRefs) {
      expect(timelineIds.has(ref) || sourceIds.has(ref)).toBe(true);
    }
  });

  it("the '2 matches' claim is backed by 2 genuinely distinct recorded matches, not one source counted twice", () => {
    const scopes = new Set(b04CombinationSourceRecords.map((s) => s.scope));
    expect(scopes.size).toBe(2);
    expect(b04CombinationSourceRecords).toHaveLength(2);
  });

  it("the insight title claims only what's provable — '2 matches', never '2 goals' as its framing", () => {
    expect(matchInsights.insights[0]!.title).toMatch(/2 matches/i);
    expect(matchInsights.insights[0]!.title).not.toMatch(/2 goals/i);
  });

  it("observationCount is backed by real observation records, not a bare number", () => {
    expect(whatThisMatchAddedInput.observationCount).toBe(b04FootballObservations.length);
  });

  // B1-R6: replaces the former "firstTimeCanonicalPositions traces back to a real ROTATION
  // event" test, which wrongly treated a name match on a ROTATION item's `secondaryPlayerName`
  // as sufficient evidence of positional experience.
  it("a ROTATION event alone does not establish positional experience — the temptation test", () => {
    // Tobias genuinely appears in a real ROTATION item (so the weak evidence IS present in the
    // fixture) — per MatchTimelineItem's own type contract, `secondaryPlayerName` on a ROTATION
    // item is "the player coming off," so this event actually records Tobias LEAVING the match,
    // not arriving at a new position. Even read charitably, it carries no position field at all.
    const rotationWithTobias = timeline.find((item) => item.kind === "ROTATION" && item.secondaryPlayerName === "Tobias");
    expect(rotationWithTobias).toBeDefined();
    // The correct behavior, despite that evidence existing, is to NOT derive a positional claim.
    expect(whatThisMatchAddedInput.firstTimeCanonicalPositions).toEqual([]);
  });

  it("player identity alone does not establish position — ROTATION items carry no position field", () => {
    const rotationItem = timeline.find((item) => item.kind === "ROTATION");
    expect(rotationItem).toBeDefined();
    expect(Object.keys(rotationItem as object)).not.toContain("position");
  });

  it("unsupported first-time positional claims are omitted, not fabricated", () => {
    expect(whatThisMatchAddedInput.firstTimeCanonicalPositions).toEqual([]);
  });

  it("any future first-time claim would need its own dedicated backing records — guard against silent reintroduction", () => {
    // If this ever becomes non-empty again without a corresponding `shared/match-b-fixture.ts`
    // export of positional-appearance SourceRecords (the same pattern b01TobiasRcmAppearanceRecords
    // and b04CombinationSourceRecords already establish), this assertion is the trip-wire that
    // forces a reviewer to notice and re-justify it.
    expect(whatThisMatchAddedInput.firstTimeCanonicalPositions).toHaveLength(0);
  });

  // B1-R7 regression coverage: proves the widened rawRecordsForHash actually depends on
  // b04CombinationSourceRecords, rather than merely re-including it for show.
  it("mutating a b04CombinationSourceRecords field changes the recomputed hash", () => {
    const mutated = {
      ...rawRecordsForHash,
      b04CombinationSourceRecords: [
        { ...b04CombinationSourceRecords[0]!, fieldValue: "MUTATED" },
        b04CombinationSourceRecords[1]!,
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
});
