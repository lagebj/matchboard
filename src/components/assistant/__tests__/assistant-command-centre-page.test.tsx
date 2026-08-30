import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssistantCommandCentrePage } from "../assistant-command-centre-page";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import type { AssistantCommandCentre, AssistantWorkItem } from "@/lib/assistant/types";
import type { CoachSituationProjection } from "@/lib/situational/situation-types";
import { ASSISTANT_CANDIDATE_PROVIDER_ID } from "@/lib/situational/providers/assistant-candidate-provider";

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

function makeCommandCentre(items: AssistantWorkItem[]): AssistantCommandCentre {
  return {
    leagueSeasonId: "season-1",
    leagueSeasonName: "Spring 2026",
    items,
    todayMatches: [],
    roundPlanIntegrities: {},
    computedAt: new Date(),
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
