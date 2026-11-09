import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C03EventPreparePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C03EventPreparePage />
    </ThemeProvider>,
  );
}

describe("Gate C W1 — C03 Event · Prepare", () => {
  it("shows the real featured Event match, preserving its Event-scoped link context", () => {
    renderPage();
    expect(screen.getByText("vs Nordby IL")).toBeInTheDocument();
    const action = screen.getByRole("link", { name: "Prepare lineup" });
    expect(action).toHaveAttribute("href", "/events/event-c03-1");
  });

  it("shows no venue label for an Event match (no home/away concept)", () => {
    renderPage();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(screen.queryByText("Away")).not.toBeInTheDocument();
  });
});
