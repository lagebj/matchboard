import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import SparseScoreEventsPage from "../page";

const mockViewport = installViewportMock();

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

  describe("independent review round 1 (PR #778, finding R3): scoped inspectors", () => {
    it("Inspect event source opens only the event record, never the result record first", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /inspect event source/i }));
      const rows = screen.getAllByTestId("source-record-row");
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toMatch(/GOAL_FOR/);
    });

    it("Inspect result source opens only the result record", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /inspect result source/i }));
      const rows = screen.getAllByTestId("source-record-row");
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toMatch(/Final score/);
    });
  });

  describe("independent review round 2 (PR #778, finding R4): exactly one active inspector", () => {
    it("switching from result to event (desktop, no Escape) swaps content instead of opening a second dialog", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /inspect result source/i }));
      expect(screen.getAllByTestId("source-record-row")[0].textContent).toMatch(/Final score/);

      // No Escape — the real desktop switch behavior finding R4 requires.
      fireEvent.click(screen.getByRole("button", { name: /inspect event source/i }));

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      const rows = screen.getAllByTestId("source-record-row");
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toMatch(/GOAL_FOR/);
      expect(screen.getByText("A04-S4 event source")).toBeInTheDocument();
    });
  });
});
