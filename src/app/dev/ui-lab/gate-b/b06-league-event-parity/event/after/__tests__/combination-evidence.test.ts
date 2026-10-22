import { describe, it, expect } from "vitest";
import { deriveCombinationsFromSegments } from "@/lib/evidence/combination-topology";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { combinationEvidence, B06_EVENT_MATCH_ID } from "../fixtures";
import { b06EventAfterPositionalSegment, b06EventAfterGoalAttributionEvents, toMatchSegments } from "../combination-source-data";
import { b06EventParticipants } from "../../../../shared/match-b-fixture";

/**
 * R8-3 remediation — imports the EXACT canonical source records `combinationEvidence`
 * (fixtures.ts) is itself computed from (`combination-source-data.ts`), rather than defining a
 * second, disconnected synthetic model inside this test file. B5/R6 — the real
 * `deriveCombinationsFromSegments()` classifies a CF (line ATT) + LCM (line MID) pair as
 * VERTICAL, never HORIZONTAL (same line only — see
 * `combination-topology.test.ts`'s own "derives horizontal partnership between two
 * centre-backs"/"derives vertical partnership between defender and midfielder" cases).
 */
describe("B06 Event · After — combination evidence provenance (B5/R6, R8-3)", () => {
  const ref: FootballMatchRef = {
    kind: "EVENT_MATCH",
    eventMatchId: B06_EVENT_MATCH_ID,
    eventId: "event-gate-b-06",
    evidenceLeagueSeasonId: "season-gate-b-06",
  };

  function derivedPartnership() {
    const rows = deriveCombinationsFromSegments(
      toMatchSegments(b06EventAfterPositionalSegment),
      ref,
      "org-gate-b",
      "season-gate-b-06",
      b06EventAfterGoalAttributionEvents,
    );
    return rows.find((r) => r.family === "PARTNERSHIP" && r.playerIds.includes("participant-gb6e-noah") && r.playerIds.includes("participant-gb6e-sindre"));
  }

  it("the fixture's exported row IS the real derivation's own output (same source records, not a hand-copied value)", () => {
    const derived = derivedPartnership();
    expect(derived).toBeDefined();

    const fixtureRow = combinationEvidence.find((r) => r.playerIds.includes("participant-gb6e-noah") && r.playerIds.includes("participant-gb6e-sindre"));
    expect(fixtureRow).toBeDefined();
    const { createdAt: _derivedCreatedAt, ...derivedWithoutCreatedAt } = derived!;
    const { createdAt: _fixtureCreatedAt, ...fixtureWithoutCreatedAt } = fixtureRow!;
    expect(fixtureWithoutCreatedAt).toEqual(derivedWithoutCreatedAt);
  });

  it("classifies Noah (CF) + Sindre (LCM) as VERTICAL — different lines, matching the production rule", () => {
    expect(derivedPartnership()!.subtype).toBe("VERTICAL");
  });

  it("shared minutes equal the interval-derived duration", () => {
    expect(derivedPartnership()!.minutesTogether).toBe(80);
  });

  it("goals for/against match the recorded report events (3 FOR, 1 AGAINST) within the segment", () => {
    const derived = derivedPartnership()!;
    expect(derived.goalsForWhilePresent).toBe(3);
    expect(derived.goalsAgainstWhilePresent).toBe(1);
  });

  it("direct contributions match recorded identities — Noah and Sindre each scored once; Kasper's assist is not fabricated as theirs", () => {
    const derived = derivedPartnership()!;
    expect(derived.directGoalContributions).toBe(2);
    expect(derived.directAssistContributions).toBe(0);
  });

  it("opponentDiversity is always 1 for per-match evidence", () => {
    expect(derivedPartnership()!.opponentDiversity).toBe(1);
  });

  it("never derives ESTABLISHED confidence from a single match (deriveConfidence requires matchCount >= 3)", () => {
    const rows = deriveCombinationsFromSegments(
      toMatchSegments(b06EventAfterPositionalSegment),
      ref,
      "org-gate-b",
      "season-gate-b-06",
      b06EventAfterGoalAttributionEvents,
    );
    expect(rows.every((r) => r.confidence !== "ESTABLISHED")).toBe(true);
  });

  it("William (the Guest Player) is never assigned a pitch position, and so never acquires partnership/combination evidence", () => {
    const william = b06EventParticipants.find((p) => p.participantType === "GUEST_PLAYER");
    expect(william).toBeDefined();
    expect(william!.tacticalPosition).toBeNull();
    const positionedIds = b06EventAfterPositionalSegment.participants.map((p) => p.participantId);
    expect(positionedIds).not.toContain(william!.participantId);
    for (const row of combinationEvidence) {
      expect(row.playerIds).not.toContain(william!.participantId);
    }
  });
});
