import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, afterData, initialReport, timingReview } from "../fixtures";
import { identity as draftIdentity } from "../../draft/fixtures";
import { B05_LIVE_GOALS_RECORDED, B05_COMPLETED_AT, b05CombinationEvidence } from "../../shared/report-data";
import { B05_KICKOFF_AT } from "../../../shared/match-b-fixture";

describe("B05 completed fixture (fixtureVersion 2 — B2-R2/R3/R4/R7 remediation)", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("is genuinely locked — completedBy/completedAt set, status LOCKED", () => {
    expect(initialReport.status).toBe("LOCKED");
    expect(afterData.reportStatus).toBe("LOCKED");
    expect(initialReport.completedBy).toBe("Marte Johansen");
    expect(initialReport.completedAt).not.toBeNull();
  });

  it("the previously-missing goal row is now present — the real gap is resolved, not silently dropped", () => {
    expect(afterData.goalAttributionGap).toEqual({ liveGoalsRecorded: 3, attributedGoals: 3, hasGap: false });
    expect(initialReport.goals).toHaveLength(3);
    expect(initialReport.goals.every((g) => g.playerId)).toBe(true);
  });

  it("liveGoalsRecorded is the same real canonical-event count as the draft — a historical fact, not re-derived per lifecycle state", () => {
    expect(afterData.goalAttributionGap?.liveGoalsRecorded).toBe(B05_LIVE_GOALS_RECORDED);
  });

  it("the timing review item is resolved, not still pending", () => {
    expect(afterData.timingNeedsReviewCount).toBe(0);
    expect(timingReview.every((t) => !t.needsReview)).toBe(true);
  });

  // B2-R4: production `deriveCombinationsFromSegments()` always sets `opponentDiversity: 1` for
  // a single match, and `deriveConfidence(minutes, 1, 1)` can never reach ESTABLISHED
  // (requires matchCount >= 3). Loaded only once LOCKED (B2-R4's second finding).
  it("combination evidence follows the real per-match derivation rules, and only appears once locked", () => {
    expect(afterData.combinationEvidence).toEqual(b05CombinationEvidence);
    for (const row of afterData.combinationEvidence) {
      expect(row.opponentDiversity).toBe(1);
      expect(row.confidence).not.toBe("ESTABLISHED");
      expect(row.matchId).not.toBeNull();
      expect(row.eventMatchId).toBeNull();
    }
  });

  // B2-R7: the AFTER reference time must be after completion, never kickoff itself.
  it("the completed snapshot's own reference time is after completion, not at or before kickoff", () => {
    const referenceAt = new Date(identity.fixedDateTimeUtc).getTime();
    expect(referenceAt).toBeGreaterThan(new Date(B05_COMPLETED_AT).getTime());
    expect(referenceAt).toBeGreaterThan(new Date(B05_KICKOFF_AT).getTime());
    expect(new Date(initialReport.completedAt!).getTime()).toBeGreaterThan(new Date(B05_KICKOFF_AT).getTime());
  });

  it("shares the same real match identity and squad as the draft fixture — one report's own lifecycle, not two different matches", () => {
    expect(afterData.reportId).toBe("report-gate-b-05");
    expect(initialReport.matchId).toBe("match-gate-b-05");
    expect(initialReport.teamName).toBe("Slemmestad Rød");
    expect(initialReport.opponent).toBe("Kongsberg IL");
    expect(identity.fixtureId).not.toBe(draftIdentity.fixtureId);
    expect(identity.scenarioId).not.toBe(draftIdentity.scenarioId);
  });

  it("has no invented measures (possession, xG, shots, cards, rating, Player of the Match)", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "expected goal", " xg", "shots", "cards", "rating", "player of the match"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
