import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, report, combinationEvidence, footballObservations } from "../fixtures";
import { B06_EVENT_KICKOFF_AT, B06_EVENT_NOW, b06EventParticipants } from "../../../../shared/match-b-fixture";

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

  // B3-R7: per-match evidence always has opponentDiversity 1 and can never reach ESTABLISHED
  // (same real derivation rules verified for B2-R4's League fix — deriveConfidence requires
  // matchCount >= 3, hardcoded to 1 on the per-match path).
  it("combination evidence follows the real per-match derivation rules", () => {
    for (const row of combinationEvidence) {
      expect(row.opponentDiversity).toBe(1);
      expect(row.confidence).not.toBe("ESTABLISHED");
    }
  });

  // B3-R3: production requires an active canonical Player for a development-evidence record —
  // never a GuestPlayer (ADR-0106 verifies this boundary structurally). William is the one
  // GUEST_PLAYER participant; he must never be the subject of a football observation.
  it("never assigns a football observation to the Guest Player", () => {
    const guestParticipantIds = new Set(
      b06EventParticipants.filter((p) => p.participantType === "GUEST_PLAYER").map((p) => p.participantId),
    );
    expect(guestParticipantIds.size).toBeGreaterThan(0);
    for (const obs of footballObservations) {
      expect(guestParticipantIds.has(obs.playerId)).toBe(false);
    }
  });

  // B3-R4: the AFTER reference time must be after kickoff and after real completion — never
  // before kickoff (the mistake this fixture previously made, reusing the Before page's "now").
  it("the reference time is after kickoff and after real completion — never before kickoff", () => {
    const referenceAt = new Date(identity.fixedDateTimeUtc).getTime();
    expect(referenceAt).toBeGreaterThan(new Date(B06_EVENT_KICKOFF_AT).getTime());
    expect(referenceAt).not.toBe(new Date(B06_EVENT_NOW).getTime());
    expect(new Date(B06_EVENT_NOW).getTime()).toBeLessThan(new Date(B06_EVENT_KICKOFF_AT).getTime());
  });

  it("never carries a forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "expectedgoals", "shots", "cards", "rating", "playerofthematch"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
