import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C03EventImminentPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C03EventImminentPage />
    </ThemeProvider>,
  );
}

describe("Gate C W1 — C03 Event · Imminent", () => {
  it("offers Live Reporting through the real Event-scoped live-entry route once everything is ready", () => {
    renderPage();
    expect(screen.getByText("vs Nordby IL")).toBeInTheDocument();
    const action = screen.getByRole("link", { name: "Start live reporting" });
    expect(action).toHaveAttribute("href", "/events/event-c03-1/matches/event-match-c03-1/live");
  });
});
