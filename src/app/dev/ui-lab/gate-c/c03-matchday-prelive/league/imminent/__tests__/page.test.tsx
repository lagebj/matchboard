import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C03LeagueImminentPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C03LeagueImminentPage />
    </ThemeProvider>,
  );
}

describe("Gate C W1 — C03 League · Imminent", () => {
  it("shows the real featured League match and offers Live Reporting once everything is ready", () => {
    renderPage();
    expect(screen.getByText("vs Stoppen Juventus")).toBeInTheDocument();
    const action = screen.getByRole("link", { name: "Start live reporting" });
    expect(action).toHaveAttribute("href", "/o/acme/matches/match-c03-featured/live");
  });

  it("still shows Matchday, not Live Now, before kickoff actually happens", () => {
    renderPage();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.getByText("Matchday")).toBeInTheDocument();
  });
});
