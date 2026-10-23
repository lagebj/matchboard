import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity, timeline, advisorViewModel } from "../fixtures";
// Test-only import — safe here (no cycle risk, see historical-pattern/__tests__/fixtures.test.ts
// for why `match-b-fixture.ts` itself can't import this).
import { B05_MATCH_FORMAT } from "../../../b05-post-match-report/shared/report-data";

function hashOf(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

describe("B07-B trivial-fact fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = hashOf(rawRecordsForHash);
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the hat-trick is recorded in canonical current-match data", () => {
    const noahGoals = timeline.filter((i) => i.kind === "GOAL_FOR" && i.playerName === "Noah");
    expect(noahGoals).toHaveLength(3);
  });

  it("the recorded chronology reconciles exactly with the final score", () => {
    const goalsFor = timeline.filter((i) => i.kind === "GOAL_FOR").length;
    const goalsAgainst = timeline.filter((i) => i.kind === "GOAL_AGAINST").length;
    expect(matchIdentity.score).toEqual({ home: goalsFor, away: goalsAgainst });
  });

  describe("match-format validity (W4-R5)", () => {
    it("every timeline event's global minute is within regulation (60 minutes, B05_MATCH_FORMAT)", () => {
      for (const item of timeline) {
        const minute = Number(item.minuteLabel?.replace(/'/g, ""));
        expect(minute).not.toBeNaN();
        expect(minute).toBeLessThanOrEqual(B05_MATCH_FORMAT.regulationDurationMinutes);
      }
    });

    it("MATCH_END occurs exactly at the format's regulation duration, not an invented 80-minute full-time", () => {
      const end = timeline.find((i) => i.kind === "MATCH_END");
      expect(end?.minuteLabel).toBe(`${B05_MATCH_FORMAT.regulationDurationMinutes}'`);
    });

    it("NEGATIVE regression: the original invalid 69'/80' pattern would fail this bound", () => {
      const invalidMinutes = [69, 80];
      expect(invalidMinutes.every((m) => m <= B05_MATCH_FORMAT.regulationDurationMinutes)).toBe(false);
    });
  });

  // W4-R8 (independent-review remediation): `getCompletedMatchAdvisorViewModel()`
  // (`completed-match-advisor.ts:174`) only ever produces status "fresh"/"stale" when a
  // SUCCEEDED review's `insights.length > 0`; whenever that gate passes, at least one of
  // sectionableInsights/clarificationInsight/suggestionInsights is non-empty by construction. So
  // a "fresh" result with insights:[] AND clarification:null AND suggestions:[] all at once —
  // this fixture's PREVIOUS value — could never be real output. `null` is the one real,
  // reachable "nothing to show" state (same code path AI-disabled/no-connection/report-not-LOCKED
  // all take); see `fixtures.ts`'s own module doc comment for the full trace. This single
  // assertion IS the regression guard: it fails immediately if anyone reintroduces a
  // hand-constructed non-null view model here.
  it("advisorViewModel is the real, production-reachable `null` state, not a hand-constructed empty-but-fresh view model", () => {
    expect(advisorViewModel).toBeNull();
  });

  it("no fabricated prior encounters, development evidence, or historical-trend mention exist — advisorViewModel carries no content at all", () => {
    expect(advisorViewModel).toBeNull();
  });

  it("never carries a forbidden fabricated metric", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "shots", "cards", "rating", "playerofthematch", "momentum"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("the stored fixtureSha256 has no self-reference inside its own hash input", () => {
    expect(JSON.stringify(rawRecordsForHash)).not.toContain(identity.fixtureSha256);
  });

  it("mutating the timeline changes the recomputed hash", () => {
    const mutated = { ...rawRecordsForHash, timeline: [...timeline.slice(0, -1), { ...timeline[timeline.length - 1]!, minuteLabel: "59'" }] };
    expect(hashOf(mutated)).not.toBe(identity.fixtureSha256);
  });
});
