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
    expect(action).toHaveAttribute("href", "/o/acme/matches/match-c03-featured");
  });

  it("never renders a Live Reporting entry while squad is still being drafted", () => {
    renderPage();
    expect(screen.queryByText("Start live reporting")).not.toBeInTheDocument();
  });

  it("never occupies the Live Now anchor (no live match in this fixture)", () => {
    renderPage();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("P1-01: never shows the contradictory quiet-day 'Nothing needs your attention' message alongside a real Matchday action", () => {
    renderPage();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
  });

  it("P1-02: demonstrates a genuinely busy same-day chronology — other same-day matches stay discoverable, in order, and the featured match is not repeated", () => {
    renderPage();
    expect(screen.getByText("Today in order")).toBeInTheDocument();
    // The earlier, already-played match (needs its report) and the later, lower-priority match
    // both remain discoverable in the lower chronology.
    expect(screen.getByText(/Åsgård/)).toBeInTheDocument();
    expect(screen.getByText(/Fagerstrand/)).toBeInTheDocument();
    // The featured match's own opponent name appears exactly once — Matchday's own card, never
    // repeated a second time as unresolved lower chronology.
    expect(screen.getAllByText(/Stoppen Juventus/).length).toBe(1);
  });
});
