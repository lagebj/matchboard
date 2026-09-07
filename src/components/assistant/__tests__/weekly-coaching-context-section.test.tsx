import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WeeklyCoachingContextSection } from "../weekly-coaching-context-section";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import type {
  WeeklyCoachingContext,
  WeeklyCoachingContextResult,
  WeeklyPlayerDisplay,
} from "@/lib/weekly/weekly-coaching-context-types";

function baseContext(overrides: Partial<WeeklyCoachingContext> = {}): WeeklyCoachingContext {
  return {
    weekKey: "2026-W36",
    weekLabel: "Week 36",
    startsAt: "2026-08-31T00:00:00.000Z",
    endsAt: "2026-09-06T23:59:59.999Z",
    status: "COMPLETE",
    leagueSeasonId: "season-1",
    activity: { leagueMatches: [], eventMatches: [] },
    opportunity: { availableWithoutPlannedLeagueOpportunityPlayerIds: [] },
    noRecordedAppearance: null,
    planActual: { plannedButAbsent: [], unplannedAppearances: [] },
    movement: { supportAppearances: [] },
    reporting: { incompleteLeagueMatchIds: [], incompleteEventMatchIds: [] },
    ...overrides,
  };
}

function makeResult(
  opportunityIds: string[],
  displayById: Record<string, WeeklyPlayerDisplay>,
): WeeklyCoachingContextResult {
  return {
    context: baseContext({
      opportunity: { availableWithoutPlannedLeagueOpportunityPlayerIds: opportunityIds },
    }),
    playerDisplayById: displayById,
    matchDisplayById: {},
  };
}

function displaysFor(count: number): Record<string, WeeklyPlayerDisplay> {
  const map: Record<string, WeeklyPlayerDisplay> = {};
  for (let i = 0; i < count; i++) {
    map[`p${i}`] = { displayName: `Player ${i}`, href: `/players/p${i}` };
  }
  return map;
}

function renderSection(result: WeeklyCoachingContextResult) {
  return render(
    <OrgSlugProvider orgSlug="acme">
      <WeeklyCoachingContextSection result={result} primarySituation="NEXT" />
    </OrgSlugProvider>,
  );
}

describe("WeeklyCoachingContextSection — available-without-opportunity rendering", () => {
  it("renders all three names and no '+N more' when exactly three players qualify", () => {
    const ids = ["p0", "p1", "p2"];
    renderSection(makeResult(ids, displaysFor(3)));

    expect(screen.getByText("3 available players had no planned opportunity")).toBeInTheDocument();
    expect(screen.getByText("Player 0")).toBeInTheDocument();
    expect(screen.getByText("Player 1")).toBeInTheDocument();
    expect(screen.getByText("Player 2")).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
  });

  it("shows three preview names and a correct '+10 more' when thirteen players qualify", () => {
    const ids = Array.from({ length: 13 }, (_, i) => `p${i}`);
    renderSection(makeResult(ids, displaysFor(13)));

    expect(screen.getByText("13 available players had no planned opportunity")).toBeInTheDocument();
    expect(screen.getByText("+10 more")).toBeInTheDocument();
  });

  it("uses singular wording for a single qualifying player", () => {
    renderSection(makeResult(["p0"], displaysFor(1)));
    expect(screen.getByText("1 available player had no planned opportunity")).toBeInTheDocument();
    expect(screen.getByText("Player 0")).toBeInTheDocument();
  });

  it("omits the whole section when nothing qualifies", () => {
    const { container } = renderSection(makeResult([], {}));
    expect(container).toBeEmptyDOMElement();
  });

  it("never renders a bare separator or an inflated count for unresolvable ids", () => {
    // 5 ids, only 3 resolve to a display name (a deleted/inactive historical reference).
    const ids = ["p0", "missing-a", "p1", "missing-b", "p2"];
    const { container } = renderSection(makeResult(ids, displaysFor(3)));

    // Headline reflects the validated (resolvable) collection only.
    expect(screen.getByText("3 available players had no planned opportunity")).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();

    // No separator "·" ever renders without a name on both sides: exactly (resolved - 1) of them.
    const separators = within(container).queryAllByText("·");
    expect(separators).toHaveLength(2);
    // And there is no empty trailing text node masquerading as a name.
    expect(screen.queryByText("missing-a")).not.toBeInTheDocument();
  });

  it("computes '+N more' from resolved players only", () => {
    // 8 ids, 5 resolve -> preview 3 + "+2 more" (not "+5 more").
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    renderSection(makeResult(ids, displaysFor(5)));

    expect(screen.getByText("5 available players had no planned opportunity")).toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });
});
