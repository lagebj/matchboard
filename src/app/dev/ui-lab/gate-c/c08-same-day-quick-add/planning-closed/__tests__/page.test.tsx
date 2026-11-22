import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C08PlanningClosedPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C08PlanningClosedPage />
    </ThemeProvider>,
  );
}

describe("Gate C W3 — C08-C planning closed", () => {
  it("reflects the true planning state and offers no misleading one-click action", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /Add Mia Berg/i })).not.toBeInTheDocument();
    expect(screen.getByText("CURRENT SITUATION")).toBeInTheDocument();
    expect(screen.getByText("Review on the Round Board.")).toBeInTheDocument();
  });

  it("keeps the legitimate correction workflow (Round Board) reachable", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /Review in Round Board/i })).toBeInTheDocument();
  });
});
