import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C03LeaguePreparePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C03LeaguePreparePage />
    </ThemeProvider>,
  );
}

describe("Gate C W1 — C03 League · Prepare", () => {
  it("shows the real featured League match and its genuine PREPARE-phase action", () => {
    renderPage();
    expect(screen.getByText("vs Stoppen Juventus")).toBeInTheDocument();
    const action = screen.getByRole("link", { name: "Prepare lineup" });
    expect(action).toHaveAttribute("href", "/matches/match-c03-1");
  });

  it("never renders a Live Reporting entry while squad is still being drafted", () => {
    renderPage();
    expect(screen.queryByText("Start live reporting")).not.toBeInTheDocument();
  });

  it("never occupies the Live Now anchor (no live match in this fixture)", () => {
    renderPage();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });
});
