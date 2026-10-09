import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import SparseScoreEventsPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <SparseScoreEventsPage />
    </ThemeProvider>,
  );
}

describe("A04-S4 sparse-score-events page", () => {
  it("shows the final 6–4 score from the canonical result", () => {
    renderPage();
    expect(screen.getByText("Final score: 6–4")).toBeInTheDocument();
  });

  it("shows exactly one event row, with an explicit PARTIAL caveat", () => {
    renderPage();
    expect(screen.getAllByTestId("s4-event-row")).toHaveLength(1);
    expect(screen.getByText("34'")).toBeInTheDocument();
    const badges = screen.getAllByTestId("coverage-badge");
    expect(badges.some((b) => b.textContent === "Partial")).toBe(true);
  });

  it("never invents the other goals, assists, or a hidden timeline", () => {
    renderPage();
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/assist/i);
    expect(screen.getAllByTestId("s4-event-row")).toHaveLength(1);
  });

  it("keeps the score caption explicit that it is not recomputed from the event log", () => {
    renderPage();
    expect(screen.getByText(/not recomputed from the event log/i)).toBeInTheDocument();
  });
});
