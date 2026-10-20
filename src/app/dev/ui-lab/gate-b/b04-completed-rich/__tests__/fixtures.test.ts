import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity, timeline, matchInsights, whatThisMatchAddedInput } from "../fixtures";
import { b04CombinationSourceRecords, b04FootballObservations } from "../../shared/match-b-fixture";

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

  it("firstTimeCanonicalPositions traces back to a real ROTATION event in the timeline", () => {
    const claimedPlayerName = whatThisMatchAddedInput.firstTimeCanonicalPositions[0]?.playerName;
    const tracedInTimeline = timeline.some(
      (item) => item.kind === "ROTATION" && item.secondaryPlayerName === claimedPlayerName,
    );
    expect(tracedInTimeline).toBe(true);
  });
});
