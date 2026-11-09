import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

// Same pre-existing test-infra gap documented against the production TodaySurface tests
// (today-surface.composition.test.tsx) — DueDecisionReviewSection transitively imports a
// "use server" actions module that does not resolve under vitest's jsdom component config.
// `dueDecisionReviews` is empty in this scenario's fixture anyway.
vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C01QuietDayPage } = await import("../page");
const { upcomingMatches } = await import("../fixtures");
const { GATE_C_NOW_ISO } = await import("../../shared/fixtures");

function renderPage() {
  return render(
    <ThemeProvider>
      <C01QuietDayPage />
    </ThemeProvider>,
  );
}

describe("Gate C W1 — C01 Quiet day", () => {
  it("renders the calm quiet hero, not a decision composition", () => {
    renderPage();
    expect(screen.getByText("Nothing needs your attention.")).toBeInTheDocument();
    expect(screen.queryByText("Why?")).not.toBeInTheDocument();
    expect(screen.queryByText("Selection decisions")).not.toBeInTheDocument();
  });

  it("shows the bounded 'This week' chronology with real, navigable matches", () => {
    renderPage();
    const upcoming = screen.getByText("Blå vs Nordby IL");
    expect(upcoming.closest("a")).toHaveAttribute("href", "/o/acme/matches/match-c01-upcoming-1");
    expect(screen.getByText("Vollen vs Blå")).toBeInTheDocument();
  });

  it("P1-03: shows the one carry-forward item exactly once — never duplicated into the context rail", () => {
    renderPage();
    expect(screen.getAllByText(/Report still open/).length).toBe(1);
  });

  it("P1-03: shows squad readiness exactly once — never duplicated into the context rail", () => {
    renderPage();
    // SquadReadinessWidget renders each count as its own label; "Available" alone is specific
    // enough to this widget (not shared with any other quiet-day text) to prove it isn't
    // rendered a second time in a separate context-rail column.
    expect(screen.getAllByText("Available").length).toBe(1);
  });

  it("never renders InstallPwaCard", () => {
    renderPage();
    expect(screen.queryByText(/install matchboard/i)).not.toBeInTheDocument();
  });

  it("P2-01: every upcoming-match kickoff date falls within production's real 7-day window", () => {
    const now = new Date(GATE_C_NOW_ISO);
    for (const match of upcomingMatches) {
      const kickoff = new Date(`${match.kickoffDate}T00:00:00.000Z`);
      const daysAhead = (kickoff.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      expect(daysAhead).toBeGreaterThan(0);
      expect(daysAhead).toBeLessThanOrEqual(7);
    }
  });
});
