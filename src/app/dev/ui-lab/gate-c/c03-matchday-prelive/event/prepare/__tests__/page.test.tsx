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
    expect(action).toHaveAttribute("href", "/o/acme/events/event-c03-1");
  });

  it("shows no venue label for an Event match (no home/away concept)", () => {
    renderPage();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(screen.queryByText("Away")).not.toBeInTheDocument();
  });

  it("P1-01: never shows the contradictory quiet-day 'Nothing needs your attention' message alongside a real Matchday action", () => {
    renderPage();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
  });

  it("P1-02/#6: League and Event contexts remain distinct — the lower chronology shows the same-day League matches but never the Event match (production has no Event row for this timeline)", () => {
    renderPage();
    expect(screen.getByText("Today in order")).toBeInTheDocument();
    expect(screen.getByText(/Åsgård/)).toBeInTheDocument();
    expect(screen.getByText(/Fagerstrand/)).toBeInTheDocument();
    // "Nordby IL" (the Event opponent) appears only once — Matchday's own card — never a second
    // time in the League-only lower chronology.
    expect(screen.getAllByText(/Nordby IL/).length).toBe(1);
  });
});
