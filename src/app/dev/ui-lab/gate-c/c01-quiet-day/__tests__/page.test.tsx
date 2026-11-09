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
    expect(upcoming.closest("a")).toHaveAttribute("href", "/matches/match-c01-upcoming-1");
    expect(screen.getByText("Vollen vs Blå")).toBeInTheDocument();
  });

  it("shows the one carry-forward item (main composition and context rail both surface it)", () => {
    renderPage();
    expect(screen.getAllByText(/Report still open/).length).toBeGreaterThan(0);
  });

  it("never renders InstallPwaCard", () => {
    renderPage();
    expect(screen.queryByText(/install matchboard/i)).not.toBeInTheDocument();
  });
});
