import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Same pre-existing test-infra gap documented in today-surface.composition.test.tsx —
// DueDecisionReviewSection transitively imports a "use server" actions module that does not
// resolve under vitest's jsdom component config. `reviews` is empty in the quiet fixture.
vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { buildTodayFixture } = await import("../today-operational-fixtures");
const { TodaySurface } = await import("@/components/touchline/today/today-surface");
const { OrgSlugProvider } = await import("@/components/shell/org-slug-context");

/**
 * ADR-0157 C9 — Today golden states. The atlas Today fixture renders the real production
 * `TodaySurface` against deterministic data; the `quiet` state is the ADR-0157 §6 quiet-day
 * golden (`04_TODAY_SURFACE.md` composition state A).
 */
function renderToday(state: "primary" | "planning" | "ready" | "quiet") {
  const fixture = buildTodayFixture(state);
  return render(
    <OrgSlugProvider orgSlug="uilab-demo-org">
      <TodaySurface
        commandCentre={fixture.commandCentre}
        projection={fixture.projection}
        recentMatches={fixture.recentMatches}
        squadStatus={fixture.squadStatus}
        liveNow={fixture.liveNow}
        selectionDecisions={fixture.selectionDecisions}
        applyRecommendation={fixture.applyRecommendation}
        sinceLastVisitScope={fixture.sinceLastVisitScope}
        sinceLastVisitFacts={fixture.sinceLastVisitFacts}
        carryForwardItems={fixture.carryForwardItems}
        matchdayContext={fixture.matchdayContext}
        upcomingMatches={fixture.upcomingMatches}
      />
    </OrgSlugProvider>,
  );
}

describe("Today fixture states (ADR-0157 C9 golden: quiet day / decision day)", () => {
  it("every fixture state provides the bounded upcoming-week chronology input", () => {
    for (const state of ["primary", "planning", "ready", "quiet"] as const) {
      const fixture = buildTodayFixture(state);
      expect(fixture.upcomingMatches.length).toBeGreaterThan(0);
      expect(fixture.upcomingMatches.length).toBeLessThanOrEqual(4);
    }
  });

  it("quiet state carries no work items, no decisions, and no due reviews", () => {
    const fixture = buildTodayFixture("quiet");
    expect(fixture.commandCentre.items).toHaveLength(0);
    expect(fixture.commandCentre.dueDecisionReviews).toHaveLength(0);
    expect(fixture.selectionDecisions).toHaveLength(0);
    expect(fixture.matchdayContext).toBeUndefined();
  });

  it("quiet state renders the calm hero and This week chronology, with no action sections", () => {
    renderToday("quiet");

    expect(screen.getByText("Nothing needs your attention.")).toBeInTheDocument();
    // The bounded chronology lists the fixture's upcoming matches as dated links
    // (homeTeam vs awayTeam, orientation handled by buildMatchPresentation).
    expect(screen.getByRole("link", { name: /Tofte IF vs Hvit/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Rød vs Konnerud Blå/i })).toBeInTheDocument();
    // No empty decision-day sections leak into the quiet composition.
    expect(screen.queryByText("Next action")).not.toBeInTheDocument();
    expect(screen.queryByText("Selection decisions")).not.toBeInTheDocument();
    expect(screen.queryByText("Planning attention")).not.toBeInTheDocument();
    expect(screen.queryByText("Other attention")).not.toBeInTheDocument();
  });

  it("decision-day state (primary) renders the dominant decision surface", () => {
    renderToday("primary");
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    expect(screen.getByText("Next action")).toBeInTheDocument();
  });
});