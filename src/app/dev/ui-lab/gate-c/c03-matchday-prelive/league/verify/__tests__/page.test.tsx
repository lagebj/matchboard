import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C03LeagueVerifyPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C03LeagueVerifyPage />
    </ThemeProvider>,
  );
}

describe("Gate C W1 — C03 League · Verify", () => {
  it("shows the real featured League match and its genuine VERIFY-phase action", () => {
    renderPage();
    expect(screen.getByText("vs Stoppen Juventus")).toBeInTheDocument();
    const action = screen.getByRole("link", { name: "Review squad" });
    expect(action).toHaveAttribute("href", "/o/acme/matches/match-c03-featured");
    expect(screen.getByText("Jonas is doubtful")).toBeInTheDocument();
  });

  it("never renders a Live Reporting entry while a selected player is still doubtful", () => {
    renderPage();
    expect(screen.queryByText("Start live reporting")).not.toBeInTheDocument();
  });
});
