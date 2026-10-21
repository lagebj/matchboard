import { describe, it, expect } from "vitest";
import { deriveCombinationsFromSegments } from "@/lib/evidence/combination-topology";
import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { combinationEvidence, B06_EVENT_MATCH_ID } from "../fixtures";

/**
 * B5/R6 — the fixture's combination row must equal what the real, unmodified
 * `deriveCombinationsFromSegments()` derives for this exact match, not a hand-picked value.
 * Noah plays CF (`FormationSlotRoleType.FORWARD` -> line `"ATT"`) and Sindre plays LCM
 * (`MIDFIELDER` -> line `"MID"`) — DIFFERENT lines, so the real derivation must return
 * `VERTICAL`, never `HORIZONTAL` (same line only, e.g. two centre-backs — see
 * `combination-topology.test.ts`'s own "derives horizontal partnership between two
 * centre-backs"/"derives vertical partnership between defender and midfielder" cases for the
 * precedent this test follows for the rest of the Gate B programme).
 */
describe("B06 Event · After — combination evidence provenance (B5/R6)", () => {
  const ref: FootballMatchRef = {
    kind: "EVENT_MATCH",
    eventMatchId: B06_EVENT_MATCH_ID,
    eventId: "event-gate-b-06",
    evidenceLeagueSeasonId: "season-gate-b-06",
  };

  // Noah (CF) and Sindre (LCM) both on pitch for the full 80-minute match.
  const segments = [
    {
      startMs: 0,
      endMs: 80 * 60_000,
      playersOnPitch: new Map([
        ["participant-gb6e-noah", { position: "CF", line: "ATT", lane: "CENTRE" }],
        ["participant-gb6e-sindre", { position: "LCM", line: "MID", lane: "LEFT" }],
      ]),
    },
  ];

  // Matches the fixture's own `report.goals`/`report.assists` exactly: Noah 12' (scorer),
  // Sindre 34' (scorer, assisted by Kasper — outside this pair), one goal against at 50',
  // Kasper 70' (scorer, outside this pair).
  const goalEvents: GoalAttributionEvent[] = [
    { matchMs: 12 * 60_000, team: "FOR", scorerPlayerId: "participant-gb6e-noah", assistPlayerId: null, approximateTiming: false },
    { matchMs: 34 * 60_000, team: "FOR", scorerPlayerId: "participant-gb6e-sindre", assistPlayerId: "participant-gb6e-kasper", approximateTiming: false },
    { matchMs: 50 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
    { matchMs: 70 * 60_000, team: "FOR", scorerPlayerId: "participant-gb6e-kasper", assistPlayerId: null, approximateTiming: false },
  ];

  it("the real derivation returns VERTICAL for a CF+LCM pair, and every other field matches the fixture exactly", () => {
    const rows = deriveCombinationsFromSegments(segments, ref, "org-gate-b", "season-gate-b-06", goalEvents);
    const derived = rows.find(
      (r) => r.family === "PARTNERSHIP" && r.playerIds.includes("participant-gb6e-noah") && r.playerIds.includes("participant-gb6e-sindre"),
    );
    expect(derived).toBeDefined();
    expect(derived!.subtype).toBe("VERTICAL");
    expect(derived!.minutesTogether).toBe(80);
    expect(derived!.goalsForWhilePresent).toBe(3);
    expect(derived!.goalsAgainstWhilePresent).toBe(1);
    expect(derived!.directGoalContributions).toBe(2);
    expect(derived!.directAssistContributions).toBe(0);
    expect(derived!.opponentDiversity).toBe(1);

    const fixtureRow = combinationEvidence.find((r) => r.id === "comb-gb6e-1");
    expect(fixtureRow).toBeDefined();
    expect(fixtureRow!.subtype).toBe(derived!.subtype);
    expect(fixtureRow!.minutesTogether).toBe(derived!.minutesTogether);
    expect(fixtureRow!.goalsForWhilePresent).toBe(derived!.goalsForWhilePresent);
    expect(fixtureRow!.goalsAgainstWhilePresent).toBe(derived!.goalsAgainstWhilePresent);
    expect(fixtureRow!.directGoalContributions).toBe(derived!.directGoalContributions);
    expect(fixtureRow!.directAssistContributions).toBe(derived!.directAssistContributions);
    expect(fixtureRow!.opponentDiversity).toBe(derived!.opponentDiversity);
    expect(fixtureRow!.confidence).toBe(derived!.confidence);
  });

  it("never derives ESTABLISHED confidence from a single match (deriveConfidence requires matchCount >= 3)", () => {
    const rows = deriveCombinationsFromSegments(segments, ref, "org-gate-b", "season-gate-b-06", goalEvents);
    expect(rows.every((r) => r.confidence !== "ESTABLISHED")).toBe(true);
  });
});
