import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B03CompletedSparsePage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B03CompletedSparsePage />
    </ThemeProvider>,
  );
}

describe("B03 completed-sparse page", () => {
  it("shows the final result separately from the partial recorded chronology", () => {
    renderPage();
    expect(screen.getByText("6-4")).toBeInTheDocument();
    expect(screen.getByText("1 recorded event")).toBeInTheDocument();
  });

  it("never fabricates a chronology matching the full scoreline", () => {
    renderPage();
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/only 1 individual event was logged/i);
  });

  it("omits the 'What this match added' panel entirely when nothing genuinely qualifies — no empty padded section", () => {
    renderPage();
    expect(screen.queryByText("What this match added")).not.toBeInTheDocument();
  });

  it("discloses that the trustworthy-but-sparse Match Flow chronology (1-0) does not reconcile with the real final score (6-4), in purely coach-facing language (B1-R5)", () => {
    renderPage();
    const note = screen.getByTestId("match-flow-reconciliation-note");
    expect(note.textContent).toMatch(/1-0/);
    expect(note.textContent).toMatch(/6-4/);
  });

  it("never exposes implementation commentary in the reconciliation note", () => {
    renderPage();
    const note = screen.getByTestId("match-flow-reconciliation-note");
    expect(note.textContent).not.toMatch(/MatchFlowPanel/i);
    expect(note.textContent).not.toMatch(/BLOCKERS/i);
    expect(note.textContent).not.toMatch(/production/i);
    expect(note.textContent).not.toContain("`");
  });

  it("never implies the recorded 6-4 result itself is wrong", () => {
    renderPage();
    const note = screen.getByTestId("match-flow-reconciliation-note");
    expect(note.textContent).not.toMatch(/incorrect/i);
    expect(note.textContent).not.toMatch(/\bwrong\b/i);
    expect(note.textContent).not.toMatch(/\berror\b/i);
  });
});
