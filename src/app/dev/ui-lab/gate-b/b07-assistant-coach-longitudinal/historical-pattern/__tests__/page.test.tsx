import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import type { CompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";
import B07HistoricalPatternPage from "../page";

// W4-R10 (independent-review remediation): this file tests PAGE COMPOSITION against a faithful
// mock, not the real `CompletedMatchAdvisorPanel`'s own rendering — that distinction matters, so
// stating it explicitly rather than leaving it implicit. The real component's own behavior
// (section ordering, "Show all" gating, evidence-source footer formatting) is covered by that
// component's own test suite; the real component's *visual* rendering is verified against actual
// CI browser screenshots (`docs/ui-lab/gate-b-w4-candidates/capture-attestation.json`), not here.
// What this file DOES legitimately prove: this page wires the real fixture data into whatever
// component is mounted at that import path, correctly. Mocked because the real panel imports a
// "use server" actions module whose real auth/db dependency chain doesn't resolve in the jsdom
// component-test environment — same precedent as production's own `after-match-overview.test.tsx`.
// Deliberately omits Clarify/DevelopmentSuggestionCard — the only two call sites in the real
// component that ever wire a production mutation action — since the fixture-level test
// (`fixtures.test.ts`) already proves `clarification`/`suggestions` are empty, which is the real
// component's own gate for rendering those controls at all. `vi.mock` calls are hoisted above
// imports by vitest, so this runs before `../page` ever imports the real panel.
vi.mock("@/components/ai/completed-match-advisor-panel", () => ({
  CompletedMatchAdvisorPanel: ({ viewModel }: { viewModel: Extract<CompletedMatchAdvisorViewModel, { status: "fresh" | "stale" }> }) => (
    <div data-testid="completed-match-advisor-panel">
      <span>AI Advisor</span>
      {viewModel.summary && <p>{viewModel.summary}</p>}
      {viewModel.insights.map((insight, i) => (
        <div key={i}>
          <p>{insight.sectionLabel}</p>
          <p>{insight.title}</p>
          <p>{insight.body}</p>
          {insight.evidenceSources.length > 0 && <p>{insight.evidenceSources.join(" · ")}</p>}
        </div>
      ))}
    </div>
  ),
}));

function renderPage() {
  return render(
    <ThemeProvider>
      <B07HistoricalPatternPage />
    </ThemeProvider>,
  );
}

describe("B07-A historical-pattern page", () => {
  it("shows the factual chronology and final score", () => {
    renderPage();
    expect(screen.getAllByText("3-2").length).toBeGreaterThan(0);
    expect(screen.getByText("6 recorded events")).toBeInTheDocument();
  });

  it("shows the Assistant Coach summary and the recurring-pattern insight", () => {
    renderPage();
    expect(screen.getByText("AI Advisor")).toBeInTheDocument();
    expect(screen.getByText(/recurring debrief note/i)).toBeInTheDocument();
    expect(screen.getByText("Supported")).toBeInTheDocument();
    expect(screen.getByText("Next focus")).toBeInTheDocument();
  });

  it("shows the evidence-source footer distinguishing Match data from Coach observation", () => {
    renderPage();
    expect(screen.getByText("Match data · Coach observation")).toBeInTheDocument();
  });

  it("opening the evidence inspector shows all six genuinely distinct recorded source records", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Inspect historical evidence/i }));
    expect(screen.getAllByTestId("source-record-row")).toHaveLength(6);
  });

  it("closes the evidence inspector on Escape and restores focus to the trigger", () => {
    renderPage();
    const trigger = screen.getByRole("button", { name: "Inspect historical evidence" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  // The mocked panel above never defines Clarify/DevelopmentSuggestionCard, so a DOM query for
  // their controls here would be vacuously true. The real guarantee — that the real,
  // unmodified `CompletedMatchAdvisorPanel` only ever wires those production mutation actions
  // when `viewModel.clarification`/`viewModel.suggestions` are non-empty — is proven directly
  // against the fixture data in `fixtures.test.ts`'s "carries no clarification or development
  // suggestion" test, which is the real component's own gate for rendering them at all.

  it("never shows a fabricated Player of the Match, player ranking, or numeric confidence score", () => {
    renderPage();
    expect(document.body.textContent).not.toMatch(/player of the match/i);
    expect(document.body.textContent).not.toMatch(/\d+%\s*confidence/i);
  });

  it("every interactive element has an accessible name", () => {
    renderPage();
    const buttons = screen.queryAllByRole("button");
    for (const button of buttons) {
      expect(button.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});
