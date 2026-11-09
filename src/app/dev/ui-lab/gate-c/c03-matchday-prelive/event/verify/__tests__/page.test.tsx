import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C03EventVerifyPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C03EventVerifyPage />
    </ThemeProvider>,
  );
}

describe("Gate C W1 — C03 Event · Verify", () => {
  it("shows the real featured Event match and its genuine VERIFY-phase action", () => {
    renderPage();
    expect(screen.getByText("vs Nordby IL")).toBeInTheDocument();
    const action = screen.getByRole("link", { name: "Review squad" });
    expect(action).toHaveAttribute("href", "/events/event-c03-1");
    expect(screen.getByText("Jonas is doubtful")).toBeInTheDocument();
  });
});
