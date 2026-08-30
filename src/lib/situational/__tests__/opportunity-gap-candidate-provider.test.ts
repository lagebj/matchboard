import { describe, it, expect } from "vitest";
import type { OpportunityGapRow } from "@/lib/insights/insights-types";
import {
  opportunityGapRowsToCandidates,
  OPPORTUNITY_GAP_CANDIDATE_PROVIDER_ID,
} from "../providers/opportunity-gap-candidate-provider";
import { projectCandidates } from "../get-coach-situation-projection";
import type { SituationContext } from "../situation-types";

function makeRow(overrides: Partial<OpportunityGapRow> & Pick<OpportunityGapRow, "playerId" | "gap">): OpportunityGapRow {
  return {
    playerName: "Player",
    coreTeamId: "team-1",
    coreTeamName: "Blue",
    plannedOpportunities: 10,
    realisedOpportunities: 10 - overrides.gap,
    unavailableRounds: 0,
    cancelledMatches: 0,
    helperElsewhereCount: 0,
    noShowCount: 0,
    unknownAttendanceCount: 0,
    ...overrides,
  };
}

describe("opportunityGapRowsToCandidates", () => {
  it("excludes rows with no meaningful gap", () => {
    const rows = [makeRow({ playerId: "p1", gap: 0 }), makeRow({ playerId: "p2", gap: -1 })];
    expect(opportunityGapRowsToCandidates(rows)).toHaveLength(0);
  });

  it("marks every candidate as a long-term signal with a DEVELOPMENT_SIGNAL consequence", () => {
    const [candidate] = opportunityGapRowsToCandidates([makeRow({ playerId: "p1", gap: 3 })]);
    expect(candidate.isLongTermSignal).toBe(true);
    expect(candidate.consequences).toEqual(["DEVELOPMENT_SIGNAL"]);
    expect(candidate.source).toBe(OPPORTUNITY_GAP_CANDIDATE_PROVIDER_ID);
    expect(candidate.affectedPlayerIds).toEqual(["p1"]);
  });

  it("sorts by gap descending and caps at 10 candidates", () => {
    const rows = Array.from({ length: 15 }, (_, i) => makeRow({ playerId: `p${i}`, gap: i + 1 }));
    const candidates = opportunityGapRowsToCandidates(rows);
    expect(candidates).toHaveLength(10);
    expect(candidates[0].summary).toContain("gap: 15");
    expect(candidates[9].summary).toContain("gap: 6");
  });

  it("never assigns a recommendedAction (observational, not a single-click action)", () => {
    const [candidate] = opportunityGapRowsToCandidates([makeRow({ playerId: "p1", gap: 2 })]);
    expect(candidate.recommendedAction).toBeUndefined();
  });

  it("never includes the player's name in title or summary (AGENTS.md: use player IDs, resolve names for display only)", () => {
    const [candidate] = opportunityGapRowsToCandidates([
      makeRow({ playerId: "p1", playerName: "Ada Lovelace", gap: 2 }),
    ]);
    expect(candidate.title).not.toContain("Ada");
    expect(candidate.summary).not.toContain("Ada");
    expect(candidate.entityId).toBe("p1");
    expect(candidate.affectedPlayerIds).toEqual(["p1"]);
  });
});

describe("opportunity gap candidate through the real situation policy (Phase 7 architecture proof)", () => {
  const row = makeRow({ playerId: "p1", playerName: "Ada", gap: 4 });
  const [candidate] = opportunityGapRowsToCandidates([row]);

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

  it("is promoted as primary content during a LONG_TERM review", async () => {
    const projection = await projectCandidates(context({ primarySituation: "LONG_TERM" }), [candidate]);
    expect(projection.decisions).toHaveLength(1);
    expect(projection.decisions[0].visibility).toBe("PROMOTE");
    expect(projection.decisions[0].horizon).toBe("LONG_TERM");
  });
});
