import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C08PlanningOpenPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C08PlanningOpenPage />
    </ThemeProvider>,
  );
}

describe("Gate C W3 — C08-A planning open", () => {
  it("offers the real one-click Add action — a genuine recommendation, never a generic review link", () => {
    renderPage();
    expect(screen.getByText("RECOMMENDED BECAUSE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Mia Berg to Blå vs Stoppen Juventus/i })).toBeInTheDocument();
  });
});
