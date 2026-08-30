import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssistantCommandCentrePage } from "../assistant-command-centre-page";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import type { AssistantCommandCentre, AssistantWorkItem, TodayMatch } from "@/lib/assistant/types";
import type { CoachSituationProjection } from "@/lib/situational/situation-types";
import { ASSISTANT_CANDIDATE_PROVIDER_ID } from "@/lib/situational/providers/assistant-candidate-provider";
import type { RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

function makeItem(overrides: Partial<AssistantWorkItem> & Pick<AssistantWorkItem, "category" | "id">): AssistantWorkItem {
  return {
    priority: 0,
    title: "Title",
    summary: "Summary",
    matchRoundId: "round-1",
    affectedTeamIds: [],
    affectedPlayerIds: [],
    primaryActionLabel: "Do it",
    primaryActionHref: "/fixtures",
    ...overrides,
  };
}

function makeCommandCentre(
  items: AssistantWorkItem[],
  todayMatches: TodayMatch[] = [],
  roundPlanIntegrities: Record<string, RoundPlanIntegrity> = {},
): AssistantCommandCentre {
  return {
    leagueSeasonId: "season-1",
    leagueSeasonName: "Spring 2026",
    items,
    todayMatches,
    roundPlanIntegrities,
    activeLiveSessions: {},
    computedAt: new Date(),
  };
}

function makeRoundIntegrity(
  overrides: Partial<RoundPlanIntegrity["summary"]> & Pick<RoundPlanIntegrity, "matchRoundId">,
): RoundPlanIntegrity {
  return {
    matchRoundId: overrides.matchRoundId,
    signals: [],
    planningNotes: [],
    summary: {
      blockerCount: 0,
      decisionRequiredCount: 0,
      belowMinimumMatchCount: 0,
      unavailableSelectedPlayerCount: 0,
      missingOpportunityPlayerCount: 0,
      integrityFailureCount: 0,
      ...overrides,
    },
    coverage: {
      eligibleAvailablePlayerCount: 0,
      assignedEligibleAvailablePlayerCount: 0,
      unassignedEligibleAvailablePlayerIds: [],
    },
    computedAt: new Date(),
  };
}

function makeTodayMatch(overrides: Partial<TodayMatch> & Pick<TodayMatch, "matchId">): TodayMatch {
  return {
    matchRoundId: "round-1",
    matchRoundName: "Round 1",
    teamName: "Blue",
    opponent: "Red",
    homeAway: "HOME",
    startsAt: null,
    squadStatus: "finalized",
    hasActiveLiveSession: false,
    reportStatus: null,
    lifecycleStatus: "planning_closed",
    ...overrides,
  };
}

function makeMatchdayProjection(overrides: Partial<CoachSituationProjection["situation"]>): CoachSituationProjection {
  return {
    situation: {
      nowIso: new Date().toISOString(),
      primarySituation: "MATCHDAY",
      imminentMatchIds: [],
      temporal: {},
      ...overrides,
    },
    decisions: [],
    deferredCount: 0,
    status: "LIVE",
    policyRuntimeStatus: "HEALTHY",
  };
}

function makeNextProjection(overrides: Partial<CoachSituationProjection["situation"]> = {}): CoachSituationProjection {
  return {
    ...makeMatchdayProjection({ primarySituation: "NEXT", activeMatchId: undefined, ...overrides }),
    status: "ACTION_REQUIRED",
  };
}

function renderPage(commandCentre: AssistantCommandCentre, projection?: CoachSituationProjection) {
  return render(
    <OrgSlugProvider orgSlug="test-org">
      <AssistantCommandCentrePage commandCentre={commandCentre} projection={projection} />
    </OrgSlugProvider>,
  );
}

describe("AssistantCommandCentrePage next-action selection", () => {
  it("without a projection, falls back to the raw (category-priority-sorted) item order", () => {
    const items = [
      // setup_missing (CATEGORY_PRIORITY 0) sorted first by get-assistant-command-centre.ts
      makeItem({ id: "setup-item", category: "setup_missing", title: "Add teams" }),
      makeItem({ id: "report-item", category: "post_match_report", title: "Complete report" }),
    ];
    renderPage(makeCommandCentre(items));

    expect(screen.getByText("Add teams")).toBeTruthy();
  });

  it("with a projection, the situational decision ordering — not category order — picks the hero next action", () => {
    const items = [
      makeItem({ id: "setup-item", category: "setup_missing", title: "Add teams" }),
      makeItem({ id: "report-item", category: "post_match_report", title: "Complete report" }),
    ];
    const commandCentre = makeCommandCentre(items);

    // The situation policy promoted the post-match-report item (e.g. tied to an imminent/live
    // match) ahead of the category-priority-first setup item.
    const projection: CoachSituationProjection = {
      situation: {
        nowIso: new Date().toISOString(),
        primarySituation: "MATCHDAY",
        activeMatchId: "match-1",
        imminentMatchIds: ["match-1"],
        temporal: {},
      },
      decisions: [
        {
          id: "MATCHDAY|" + ASSISTANT_CANDIDATE_PROVIDER_ID + "|report-item",
          candidateId: `${ASSISTANT_CANDIDATE_PROVIDER_ID}|report-item`,
          situation: "MATCHDAY",
          horizon: "NOW",
          visibility: "PROMOTE",
          urgency: "IMMEDIATE",
          interaction: "CONFIRM",
          title: "Complete report",
          alternatives: [],
          affectedEntities: [],
          reasonCodes: ["HARD_CONSEQUENCE"],
        },
      ],
      deferredCount: 0,
      status: "ACTION_REQUIRED",
      policyRuntimeStatus: "HEALTHY",
    };

    renderPage(commandCentre, projection);

    // The hero heading shows the projection-selected item's title.
    expect(screen.getByRole("heading", { name: "Complete report" })).toBeTruthy();
  });

  it("falls back to raw order when the projection's top decision does not match any actionable item", () => {
    const items = [makeItem({ id: "setup-item", category: "setup_missing", title: "Add teams" })];
    const commandCentre = makeCommandCentre(items);
    const projection: CoachSituationProjection = {
      situation: { nowIso: new Date().toISOString(), primarySituation: "NEXT", imminentMatchIds: [], temporal: {} },
      decisions: [
        {
          id: "x",
          candidateId: `${ASSISTANT_CANDIDATE_PROVIDER_ID}|nonexistent-item`,
          situation: "NEXT",
          horizon: "NEXT",
          visibility: "PROMOTE",
          urgency: "NORMAL",
          interaction: "CONFIRM",
          title: "Ghost",
          alternatives: [],
          affectedEntities: [],
          reasonCodes: [],
        },
      ],
      deferredCount: 0,
      status: "ACTION_REQUIRED",
      policyRuntimeStatus: "HEALTHY",
    };

    renderPage(commandCentre, projection);

    expect(screen.getByRole("heading", { name: "Add teams" })).toBeTruthy();
  });

  it("shows the ready empty state when there are no actionable items regardless of projection", () => {
    renderPage(makeCommandCentre([]));
    expect(screen.getByText("Nothing urgent right now.")).toBeTruthy();
  });
});

describe("MatchdayContextBanner (Phase 5)", () => {
  it("does not render when the situation is not MATCHDAY", () => {
    const commandCentre = makeCommandCentre([], [makeTodayMatch({ matchId: "m1", hasActiveLiveSession: true })]);
    const projection = makeMatchdayProjection({ primarySituation: "NEXT", activeMatchId: "m1" });
    renderPage(commandCentre, projection);
    expect(screen.queryByText("Live now")).toBeNull();
  });

  it("does not render when MATCHDAY but no matching TodayMatch is found", () => {
    const commandCentre = makeCommandCentre([], []);
    const projection = makeMatchdayProjection({ activeMatchId: "missing-match" });
    renderPage(commandCentre, projection);
    expect(screen.queryByText("Live now")).toBeNull();
  });

  it("shows a live banner with a Follow live action for an active match", () => {
    const commandCentre = makeCommandCentre(
      [],
      [makeTodayMatch({ matchId: "m1", teamName: "Blue", opponent: "Red FC", hasActiveLiveSession: true })],
    );
    const projection = makeMatchdayProjection({ activeMatchId: "m1", imminentMatchIds: ["m1"] });
    renderPage(commandCentre, projection);

    expect(screen.getByText("Live now")).toBeTruthy();
    // "Blue vs Red FC" and "Follow live" legitimately appear twice each: once in the new banner,
    // once in the pre-existing "Today's matches" section — both rendering the same match.
    expect(screen.getAllByText((_, el) => el?.textContent === "Blue vs Red FC").length).toBeGreaterThanOrEqual(1);
    const links = screen.getAllByRole("link", { name: /Follow live/i });
    expect(links.some((l) => l.getAttribute("href") === "/o/test-org/matches/m1/live")).toBe(true);
  });

  it("shows a kickoff countdown with an Open match action for an imminent, not-yet-live match", () => {
    const startsAt = new Date(Date.now() + 25 * 60_000).toISOString();
    const commandCentre = makeCommandCentre(
      [],
      [makeTodayMatch({ matchId: "m1", startsAt, hasActiveLiveSession: false })],
    );
    const projection = makeMatchdayProjection({ imminentMatchIds: ["m1"] });
    renderPage(commandCentre, projection);

    expect(screen.getByText(/Kicks off in 2[45] min/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Open match/i });
    expect(link.getAttribute("href")).toBe("/o/test-org/matches/m1");
  });

  it("does not render when no projection is supplied at all", () => {
    const commandCentre = makeCommandCentre([], [makeTodayMatch({ matchId: "m1", hasActiveLiveSession: true })]);
    renderPage(commandCentre, undefined);
    expect(screen.queryByText("Live now")).toBeNull();
  });
});

describe("NextRoundReadinessSection (Phase 6)", () => {
  it("does not render when the situation is not NEXT", () => {
    const commandCentre = makeCommandCentre([], [], { "round-1": makeRoundIntegrity({ matchRoundId: "round-1", blockerCount: 1 }) });
    renderPage(commandCentre, makeMatchdayProjection({ primarySituation: "MATCHDAY" }));
    expect(screen.queryByText("Next round")).toBeNull();
  });

  it("does not render when NEXT but no round has a blocked/decision-required signal", () => {
    const commandCentre = makeCommandCentre([], [], { "round-1": makeRoundIntegrity({ matchRoundId: "round-1" }) });
    renderPage(commandCentre, makeNextProjection());
    expect(screen.queryByText("Next round")).toBeNull();
  });

  it("shows a round needing attention with counts and a deep link to the Round Board", () => {
    const commandCentre = makeCommandCentre(
      [],
      [makeTodayMatch({ matchId: "m1", matchRoundId: "round-1", matchRoundName: "Round 7" })],
      { "round-1": makeRoundIntegrity({ matchRoundId: "round-1", blockerCount: 2, decisionRequiredCount: 1 }) },
    );
    renderPage(commandCentre, makeNextProjection());

    expect(screen.getByText("Next round")).toBeTruthy();
    // "Round 7" legitimately appears twice: once in this new section, once in the pre-existing
    // "Today's matches" section (both reference the same match's round name).
    expect(screen.getAllByText("Round 7").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2 blocked · 1 decision required")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Open Round Board/i });
    expect(link.getAttribute("href")).toBe("/o/test-org/rounds/round-1");
  });

  it("falls back to a generic label when no matching TodayMatch provides the round name", () => {
    const commandCentre = makeCommandCentre([], [], {
      "round-1": makeRoundIntegrity({ matchRoundId: "round-1", blockerCount: 1 }),
    });
    renderPage(commandCentre, makeNextProjection());
    expect(screen.getByText("Round readiness")).toBeTruthy();
  });

  it("lists multiple rounds needing attention independently", () => {
    const commandCentre = makeCommandCentre([], [], {
      "round-1": makeRoundIntegrity({ matchRoundId: "round-1", blockerCount: 1 }),
      "round-2": makeRoundIntegrity({ matchRoundId: "round-2", decisionRequiredCount: 2 }),
    });
    renderPage(commandCentre, makeNextProjection());
    expect(screen.getAllByRole("link", { name: /Open Round Board/i })).toHaveLength(2);
  });
});
