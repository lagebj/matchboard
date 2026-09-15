import { describe, it, expect } from "vitest";
import {
  planTodaySelectionRecommendations,
  type TodayMissingOpportunityCandidate,
  type TodayCandidateDestinationMatch,
} from "../today-selection-recommendation-plan";

function destination(overrides: Partial<TodayCandidateDestinationMatch> & { matchId: string; teamId: string }): TodayCandidateDestinationMatch {
  return {
    teamName: overrides.teamId,
    teamKitColor: null,
    opponentName: "Opponent",
    targetSquadSize: 10,
    currentSquadCount: 8,
    isCoreTeam: false,
    activePathRoles: [],
    planningOpen: true,
    ...overrides,
  };
}

function candidate(overrides: Partial<TodayMissingOpportunityCandidate> & { signalKey: string; playerId: string }): TodayMissingOpportunityCandidate {
  return {
    displayName: "Player",
    availability: "AVAILABLE",
    isActive: true,
    coreTeamId: "team-bla",
    matchRoundId: "round-1",
    roundLabel: "W42",
    roundBoardHref: "/rounds/round-1",
    hasSameRoundAssignment: false,
    repeatedMissedRoundCount: 0,
    candidateMatches: [],
    projectionOrderIndex: null,
    ...overrides,
  };
}

describe("planTodaySelectionRecommendations", () => {
  it("recommends the single valid under-target destination directly", () => {
    const [decision] = planTodaySelectionRecommendations([
      candidate({
        signalKey: "sig-noah",
        playerId: "p-noah",
        displayName: "Noah Berg",
        coreTeamId: "team-bla",
        candidateMatches: [
          destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 9, targetSquadSize: 10 }),
        ],
      }),
    ]);

    expect(decision.recommendation).not.toBeNull();
    expect(decision.recommendation?.targetMatchId).toBe("m-bla");
    expect(decision.recommendation?.role).toBe("CORE");
    expect(decision.recommendation?.directlyActionable).toBe(true);
    expect(decision.recommendation?.dependsOnPrior).toBe(false);
  });

  it("marks a TENTATIVE player as review-only", () => {
    const [decision] = planTodaySelectionRecommendations([
      candidate({
        signalKey: "sig-t",
        playerId: "p-t",
        availability: "TENTATIVE",
        candidateMatches: [
          destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 9, targetSquadSize: 10 }),
        ],
      }),
    ]);

    expect(decision.recommendation).not.toBeNull();
    expect(decision.recommendation?.directlyActionable).toBe(false);
    expect(decision.recommendation?.unavailableReason).toMatch(/tentative/i);
  });

  it("produces no stale direct recommendation for an already-assigned player", () => {
    const [decision] = planTodaySelectionRecommendations([
      candidate({
        signalKey: "sig-a",
        playerId: "p-a",
        hasSameRoundAssignment: true,
        candidateMatches: [
          destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 9, targetSquadSize: 10 }),
        ],
      }),
    ]);

    expect(decision.recommendation?.directlyActionable).toBe(false);
    expect(decision.recommendation?.unavailableReason).toMatch(/already has a planned opportunity/i);
  });

  it("routes a non-core destination with no active rotation path to review-only", () => {
    const [decision] = planTodaySelectionRecommendations([
      candidate({
        signalKey: "sig-b",
        playerId: "p-b",
        coreTeamId: "team-bla",
        candidateMatches: [
          destination({ matchId: "m-rod", teamId: "team-rod", isCoreTeam: false, activePathRoles: [], currentSquadCount: 8, targetSquadSize: 10 }),
        ],
      }),
    ]);

    expect(decision.recommendation?.directlyActionable).toBe(false);
    expect(decision.recommendation?.unavailableReason).toMatch(/rotation path/i);
  });

  it("does not offer a direct destination already at target size", () => {
    const [decision] = planTodaySelectionRecommendations([
      candidate({
        signalKey: "sig-c",
        playerId: "p-c",
        coreTeamId: "team-bla",
        candidateMatches: [
          destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 10, targetSquadSize: 10 }),
        ],
      }),
    ]);

    expect(decision.recommendation?.directlyActionable).toBe(false);
    expect(decision.recommendation?.unavailableReason).toMatch(/already at its target/i);
  });

  it("coordinates two players toward one shared destination and one alternate destination", () => {
    // Mirrors the worked example in `03_DATA_AND_RECOMMENDATION_CONTRACT.md`: Blå and Rød both
    // actually need one player each (8/10), so Emil's *actual* unprojected recommendation ties
    // toward Blå (first candidate wins ties) — but once Noah's Blå-only recommendation reserves
    // Blå's remaining slot, Emil's *projected* recommendation moves to Rød, which now needs more
    // than Blå does.
    const bla = destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 8, targetSquadSize: 10 });
    const rod = destination({ matchId: "m-rod", teamId: "team-rod", isCoreTeam: false, activePathRoles: ["SUPPORT"], currentSquadCount: 8, targetSquadSize: 10 });

    const decisions = planTodaySelectionRecommendations([
      candidate({
        signalKey: "sig-noah",
        playerId: "p-noah",
        displayName: "Noah Berg",
        coreTeamId: "team-bla",
        projectionOrderIndex: 0,
        candidateMatches: [bla],
      }),
      candidate({
        signalKey: "sig-emil",
        playerId: "p-emil",
        displayName: "Emil Larsen",
        coreTeamId: "team-bla",
        projectionOrderIndex: 1,
        candidateMatches: [bla, rod],
      }),
    ]);

    expect(decisions[0].recommendation?.targetMatchId).toBe("m-bla");
    expect(decisions[0].recommendation?.directlyActionable).toBe(true);

    // Second player's projected target moves to Rød because Blå's capacity is reserved by the
    // first, but the *actual* unprojected state still points to Blå — so it depends on the prior
    // decision being applied first.
    expect(decisions[1].recommendation?.targetMatchId).toBe("m-rod");
    expect(decisions[1].recommendation?.dependsOnPrior).toBe(true);
    expect(decisions[1].recommendation?.directlyActionable).toBe(false);
  });

  it("does not overfill projected capacity for a third player once a destination is reserved twice", () => {
    const bla = destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 9, targetSquadSize: 10 });

    const decisions = planTodaySelectionRecommendations([
      candidate({ signalKey: "sig-1", playerId: "p-1", coreTeamId: "team-bla", projectionOrderIndex: 0, candidateMatches: [bla] }),
      candidate({ signalKey: "sig-2", playerId: "p-2", coreTeamId: "team-bla", projectionOrderIndex: 1, candidateMatches: [bla] }),
      candidate({ signalKey: "sig-3", playerId: "p-3", coreTeamId: "team-bla", projectionOrderIndex: 2, candidateMatches: [bla] }),
    ]);

    expect(decisions[0].recommendation?.directlyActionable).toBe(true);
    expect(decisions[1].recommendation?.directlyActionable).toBe(false);
    expect(decisions[2].recommendation?.directlyActionable).toBe(false);
    expect(decisions[2].recommendation?.unavailableReason).toBeTruthy();
  });

  it("never claims a core team 'has room' when it is actually already at or above target size (ADR-0142)", () => {
    const [atTarget] = planTodaySelectionRecommendations([
      candidate({
        signalKey: "sig-at",
        playerId: "p-at",
        coreTeamId: "team-bla",
        candidateMatches: [
          destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 10, targetSquadSize: 10 }),
        ],
      }),
    ]);
    expect(atTarget.reasons.some((r) => /has room/i.test(r.text))).toBe(false);
    expect(atTarget.reasons.some((r) => /target squad size/i.test(r.text))).toBe(true);

    const [aboveTarget] = planTodaySelectionRecommendations([
      candidate({
        signalKey: "sig-above",
        playerId: "p-above",
        coreTeamId: "team-bla",
        candidateMatches: [
          destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 11, targetSquadSize: 10 }),
        ],
      }),
    ]);
    expect(aboveTarget.reasons.some((r) => /has room/i.test(r.text))).toBe(false);
    expect(aboveTarget.reasons.some((r) => /already above its target squad size/i.test(r.text))).toBe(true);
  });

  it("surfaces repeated missed opportunity as a material reason", () => {
    const [decision] = planTodaySelectionRecommendations([
      candidate({
        signalKey: "sig-r",
        playerId: "p-r",
        coreTeamId: "team-bla",
        repeatedMissedRoundCount: 1,
        candidateMatches: [
          destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 9, targetSquadSize: 10 }),
        ],
      }),
    ]);

    expect(decision.reasons.some((r) => /also missed a planned opportunity/i.test(r.text))).toBe(true);
  });

  it("returns no recommendation-specific work when there are no candidates", () => {
    expect(planTodaySelectionRecommendations([])).toEqual([]);
  });

  it("produces a decisionFingerprint that changes when material decision state changes (ADR-0142)", () => {
    const base = candidate({
      signalKey: "sig-fp",
      playerId: "p-fp",
      coreTeamId: "team-bla",
      candidateMatches: [
        destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 9, targetSquadSize: 10 }),
      ],
    });
    const first = planTodaySelectionRecommendations([base])[0].decisionFingerprint;
    const second = planTodaySelectionRecommendations([base])[0].decisionFingerprint;
    expect(first).toBe(second);

    const resolved = candidate({
      signalKey: "sig-fp",
      playerId: "p-fp",
      coreTeamId: "team-bla",
      candidateMatches: [
        destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 10, targetSquadSize: 10 }),
      ],
    });
    const third = planTodaySelectionRecommendations([resolved])[0].decisionFingerprint;
    expect(third).not.toBe(first);
  });

  it("produces a stable fingerprint for stable input and a different one when target count changes", () => {
    const base = candidate({
      signalKey: "sig-f",
      playerId: "p-f",
      coreTeamId: "team-bla",
      candidateMatches: [
        destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 9, targetSquadSize: 10 }),
      ],
    });

    const first = planTodaySelectionRecommendations([base])[0].recommendation?.fingerprint;
    const second = planTodaySelectionRecommendations([base])[0].recommendation?.fingerprint;
    expect(first).toBe(second);

    const changedTarget = candidate({
      signalKey: "sig-f",
      playerId: "p-f",
      coreTeamId: "team-bla",
      candidateMatches: [
        destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: true, currentSquadCount: 9, targetSquadSize: 11 }),
      ],
    });
    const third = planTodaySelectionRecommendations([changedTarget])[0].recommendation?.fingerprint;
    expect(third).not.toBe(first);

    const changedPath = candidate({
      signalKey: "sig-f",
      playerId: "p-f",
      coreTeamId: "team-bla",
      candidateMatches: [
        destination({ matchId: "m-bla", teamId: "team-bla", isCoreTeam: false, activePathRoles: ["SUPPORT"], currentSquadCount: 9, targetSquadSize: 10 }),
      ],
    });
    const fourth = planTodaySelectionRecommendations([changedPath])[0].recommendation?.fingerprint;
    expect(fourth).not.toBe(first);
  });
});
