import { describe, it, expect } from "vitest";
import { deriveCombinationsFromSegments } from "@/lib/evidence/combination-topology";
import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { b05CombinationEvidence } from "../report-data";
import { B05_MATCH_ID } from "../../../shared/match-b-fixture";

/**
 * B5/R6 ("apply the same provenance standards to the B05 combination row where needed") —
 * verified against the real, unmodified `deriveCombinationsFromSegments()`. Noah plays RCM and
 * Sindre plays LCM — both `MIDFIELDER` -> the SAME line (`"MID"`), so `HORIZONTAL` is the
 * correct real derivation here (unlike B06 Event · After's CF+LCM pair, which is `VERTICAL` —
 * see `b06-league-event-parity/event/after/__tests__/combination-evidence.test.ts`).
 */
describe("B05 combination evidence provenance (B5/R6)", () => {
  const ref: FootballMatchRef = { kind: "LEAGUE_MATCH", matchId: B05_MATCH_ID, leagueSeasonId: "season-gate-b" };

  const segments = [
    {
      startMs: 0,
      endMs: 80 * 60_000,
      playersOnPitch: new Map([
        ["player-gb5-noah", { position: "RCM", line: "MID", lane: "RIGHT" }],
        ["player-gb5-sindre", { position: "LCM", line: "MID", lane: "LEFT" }],
      ]),
    },
  ];

  // Matches `b05CanonicalLiveEvents` exactly: Noah scores 12', Sindre scores 34' (assisted by
  // Vetle — outside this pair), goals against at 20' and 50', Kasper scores 61' (outside pair).
  const goalEvents: GoalAttributionEvent[] = [
    { matchMs: 12 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-noah", assistPlayerId: null, approximateTiming: false },
    { matchMs: 20 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
    { matchMs: 34 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-sindre", assistPlayerId: "player-gb5-vetle", approximateTiming: false },
    { matchMs: 50 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
    { matchMs: 61 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-kasper", assistPlayerId: null, approximateTiming: false },
  ];

  it("the real derivation returns HORIZONTAL for a same-line (RCM+LCM) pair, and every other field matches the fixture exactly", () => {
    const rows = deriveCombinationsFromSegments(segments, ref, "org-gate-b", "season-gate-b", goalEvents);
    const derived = rows.find(
      (r) => r.family === "PARTNERSHIP" && r.playerIds.includes("player-gb5-noah") && r.playerIds.includes("player-gb5-sindre"),
    );
    expect(derived).toBeDefined();
    expect(derived!.subtype).toBe("HORIZONTAL");
    expect(derived!.minutesTogether).toBe(80);
    expect(derived!.goalsForWhilePresent).toBe(3);
    expect(derived!.goalsAgainstWhilePresent).toBe(2);
    expect(derived!.directGoalContributions).toBe(2);
    expect(derived!.directAssistContributions).toBe(0);
    expect(derived!.opponentDiversity).toBe(1);

    const fixtureRow = b05CombinationEvidence.find((r) => r.id === "comb-gb5-1");
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
});
