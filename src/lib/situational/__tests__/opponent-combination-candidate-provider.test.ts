import { describe, it, expect } from "vitest";
import type { SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";
import {
  opponentCombinationEvidenceToCandidates,
  OPPONENT_COMBINATION_CANDIDATE_PROVIDER_ID,
} from "../providers/opponent-combination-candidate-provider";
import { projectCandidates } from "../get-coach-situation-projection";
import type { SituationContext } from "../situation-types";

function makeSummary(
  overrides: Partial<SeasonCombinationSummary> & Pick<SeasonCombinationSummary, "playerIds">,
): SeasonCombinationSummary {
  return {
    positions: [],
    family: "PARTNERSHIP",
    subtype: null,
    totalMinutesTogether: 90,
    matchCount: 3,
    goalsForTotal: 0,
    goalsAgainstTotal: 0,
    directGoalContributionsTotal: 0,
    directAssistContributionsTotal: 0,
    opponentDiversity: 1,
    confidence: "EMERGING",
    approximateTiming: false,
    ...overrides,
  };
}

describe("opponentCombinationEvidenceToCandidates", () => {
  it("excludes INSUFFICIENT-confidence summaries", () => {
    const summaries = [
      makeSummary({ playerIds: ["p1", "p2"], confidence: "INSUFFICIENT" }),
      makeSummary({ playerIds: ["p3", "p4"], confidence: "EMERGING" }),
    ];
    const candidates = opponentCombinationEvidenceToCandidates(summaries, "opp-1");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].affectedPlayerIds).toEqual(["p3", "p4"]);
  });

  it("caps at 8 candidates", () => {
    const summaries = Array.from({ length: 12 }, (_, i) => makeSummary({ playerIds: [`p${i}`, `p${i}b`] }));
    expect(opponentCombinationEvidenceToCandidates(summaries, "opp-1")).toHaveLength(8);
  });

  it("marks every candidate as a long-term signal with a DEVELOPMENT_SIGNAL consequence", () => {
    const [candidate] = opponentCombinationEvidenceToCandidates(
      [makeSummary({ playerIds: ["p1", "p2"] })],
      "opp-1",
    );
    expect(candidate.isLongTermSignal).toBe(true);
    expect(candidate.consequences).toEqual(["DEVELOPMENT_SIGNAL"]);
    expect(candidate.source).toBe(OPPONENT_COMBINATION_CANDIDATE_PROVIDER_ID);
  });

  it("never assigns a recommendedAction (observational, not a single-click action)", () => {
    const [candidate] = opponentCombinationEvidenceToCandidates(
      [makeSummary({ playerIds: ["p1", "p2"] })],
      "opp-1",
    );
    expect(candidate.recommendedAction).toBeUndefined();
  });

  it("never includes a synthesized score or percentage in title or summary", () => {
    const [candidate] = opponentCombinationEvidenceToCandidates(
      [makeSummary({ playerIds: ["p1", "p2"], totalMinutesTogether: 123, matchCount: 4 })],
      "opp-1",
    );
    expect(candidate.title).not.toMatch(/%|score/i);
    expect(candidate.summary).not.toMatch(/%|score/i);
    expect(candidate.summary).toContain("123 min together across 4 matches");
  });

  it("references the opponent team as the primary entity and every player id as affected", () => {
    const [candidate] = opponentCombinationEvidenceToCandidates(
      [makeSummary({ playerIds: ["p2", "p1"] })],
      "opp-1",
    );
    expect(candidate.entityType).toBe("TEAM");
    expect(candidate.entityId).toBe("opp-1");
    expect(candidate.affectedPlayerIds).toEqual(["p1", "p2"]);
  });

  it("produces a stable, deterministic id per opponent/family/player-set", () => {
    const [candidate] = opponentCombinationEvidenceToCandidates(
      [makeSummary({ playerIds: ["p2", "p1"], family: "TRIANGLE" })],
      "opp-1",
    );
    expect(candidate.id).toBe(`${OPPONENT_COMBINATION_CANDIDATE_PROVIDER_ID}|opp-1|TRIANGLE|p1:p2`);
  });
});

describe("opponent combination candidate through the real situation policy (LONG_TERM architecture proof)", () => {
  const [candidate] = opponentCombinationEvidenceToCandidates(
    [makeSummary({ playerIds: ["p1", "p2"], confidence: "ESTABLISHED" })],
    "opp-1",
  );

  function context(overrides: Partial<SituationContext>): SituationContext {
    return {
      nowIso: "2026-01-01T12:00:00.000Z",
      primarySituation: "NEXT",
      imminentMatchIds: [],
      temporal: {},
      ...overrides,
    };
  }

  it("is suppressed during an unrelated live Matchday", async () => {
    const projection = await projectCandidates(
      context({ primarySituation: "MATCHDAY", activeMatchId: "unrelated-match" }),
      [candidate],
    );
    expect(projection.decisions).toHaveLength(0);
  });

  it("is promoted with a LONG_TERM horizon during LONG_TERM review", async () => {
    const projection = await projectCandidates(context({ primarySituation: "LONG_TERM" }), [candidate]);
    expect(projection.decisions).toHaveLength(1);
    expect(projection.decisions[0].horizon).toBe("LONG_TERM");
  });

  it("surfaces every player id via affectedEntities for display-time name resolution", async () => {
    const projection = await projectCandidates(context({ primarySituation: "LONG_TERM" }), [candidate]);
    const playerIds = projection.decisions[0].affectedEntities
      .filter((e) => e.entityType === "PLAYER")
      .map((e) => e.entityId);
    expect(playerIds).toEqual(["p1", "p2"]);
  });
});
