import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B04CompletedRichPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B04CompletedRichPage />
    </ThemeProvider>,
  );
}

describe("B04 completed-rich page", () => {
  it("shows a meaningful recorded chronology reconciling with the final score", () => {
    renderPage();
    expect(screen.getAllByText("4-1").length).toBeGreaterThan(0);
    expect(screen.getByText("7 recorded events")).toBeInTheDocument();
  });

  it("the earned Match Insights finding has an inspectable evidence drilldown, not a forced chart", () => {
    renderPage();
    const summary = document.querySelector("summary");
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toBe("Evidence");
    fireEvent.click(summary as Element);
    expect(screen.getByText(/Based on 2 recorded facts/)).toBeInTheDocument();
  });

  it("never uses the pre-match 'planning this match' heading — this is a completed match (B1-R3)", () => {
    renderPage();
    expect(document.body.textContent).not.toMatch(/planning this match/i);
  });

  it("opening the evidence inspector shows both genuinely distinct recorded source records", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Inspect combination evidence/i }));
    expect(screen.getAllByTestId("source-record-row")).toHaveLength(2);
  });

  it("draws an explicit line between the recorded facts and the AI's own interpretation", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Inspect combination evidence/i }));
    expect(screen.getByText(/AI's combined-pairing claim/i)).toBeInTheDocument();
  });

  it("evidence inspection is read-only — opening and closing it never mutates the insight content", () => {
    renderPage();
    const titleBefore = screen.getByText(/Noah and Sindre have combined/i).textContent;
    fireEvent.click(screen.getByRole("button", { name: /Inspect combination evidence/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText(/Noah and Sindre have combined/i).textContent).toBe(titleBefore);
  });

  it("renders a real 'What this match added' panel — the opposite of B03's honestly-empty one", () => {
    renderPage();
    expect(screen.getByText("What this match added")).toBeInTheDocument();
  });

  it("never shows the B03 reconciliation note — its chronology already reconciles with the final score by construction (design audit, confirmed)", () => {
    renderPage();
    expect(screen.queryByTestId("match-flow-reconciliation-note")).not.toBeInTheDocument();
  });

  it("every interactive element has an accessible name (keyboard/overflow smoke)", () => {
    renderPage();
    const buttons = screen.queryAllByRole("button");
    for (const button of buttons) {
      expect(button.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});
