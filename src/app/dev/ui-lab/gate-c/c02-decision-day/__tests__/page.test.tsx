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

const { default: C02DecisionDayPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C02DecisionDayPage />
    </ThemeProvider>,
  );
}

describe("Gate C W1 — C02 Decision day", () => {
  it("renders the primary decision and its Why? disclosure, not the quiet hero", () => {
    renderPage();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    expect(screen.getByText("Squad below minimum for Saturday's match")).toBeInTheDocument();
    expect(screen.getByText("Why?")).toBeInTheDocument();
    expect(screen.getByText("Round 9's squad is currently below Matchboard's configured minimum for this match.")).toBeInTheDocument();
  });

  it("shows the two genuine secondary items the real cap allows (selection + planning)", () => {
    renderPage();
    expect(screen.getByText("Available and active, but not assigned to any match in Round 7.")).toBeInTheDocument();
    expect(screen.getByText("Theodor is planned twice in Round 10")).toBeInTheDocument();
  });

  it("drops the third genuine secondary candidate once the real 2-item cap is reached", () => {
    renderPage();
    expect(screen.queryByText("Round 11 squads not yet opened")).not.toBeInTheDocument();
  });

  it("never renders InstallPwaCard", () => {
    renderPage();
    expect(screen.queryByText(/install matchboard/i)).not.toBeInTheDocument();
  });
});
