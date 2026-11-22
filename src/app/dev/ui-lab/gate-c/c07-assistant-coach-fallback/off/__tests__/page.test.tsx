import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C07OffPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C07OffPage />
    </ThemeProvider>,
  );
}

describe("Gate C W3 — C07-OFF capability unavailable", () => {
  it("preserves the real decision-day priority and layout", () => {
    renderPage();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    expect(screen.getByText("Available and active, but not assigned to any match in Round 9.")).toBeInTheDocument();
  });

  it("shows no Assistant Coach panel, empty card, loading placeholder, or capability error", () => {
    renderPage();
    expect(screen.queryByText(/assistant coach/i)).not.toBeInTheDocument();
    expect(screen.queryByText("AI Advisor")).not.toBeInTheDocument();
    expect(screen.queryByText(/unavailable right now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reviewing this match/i)).not.toBeInTheDocument();
  });

  it("never renders InstallPwaCard", () => {
    renderPage();
    expect(screen.queryByText(/install matchboard/i)).not.toBeInTheDocument();
  });
});
