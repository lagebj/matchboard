import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import type { CompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";

// Same precedent as production's own `after-match-overview.test.tsx` and B07-A's page test: the
// real panel imports a "use server" actions module whose real auth/db dependency chain doesn't
// resolve in the jsdom component-test environment. `fixtures.test.ts` already proves
// `clarification`/`suggestions` are empty — the real component's own gate for ever rendering a
// mutation-wired control.
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
        </div>
      ))}
    </div>
  ),
}));

import B07TrivialFactPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B07TrivialFactPage />
    </ThemeProvider>,
  );
}

describe("B07-B trivial-fact page", () => {
  it("shows the hat-trick factually in the Match story and Key figures", () => {
    renderPage();
    expect(screen.getAllByText("4-1").length).toBeGreaterThan(0);
    expect(screen.getByText("6 recorded events")).toBeInTheDocument();
    expect(screen.getByText("Noah — goals")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("the Assistant Coach section shows only the insufficient-evidence summary, no insight list", () => {
    renderPage();
    expect(screen.getByText("No historical pattern identified from the available evidence.")).toBeInTheDocument();
    expect(screen.queryByText("Supported")).not.toBeInTheDocument();
    expect(screen.queryByText("Next focus")).not.toBeInTheDocument();
  });

  it("does not repeat the hat-trick as a longitudinal finding inside the Assistant Coach section", () => {
    renderPage();
    expect(screen.getByTestId("completed-match-advisor-panel").textContent).not.toMatch(/hat-?trick/i);
  });

  it("the hat-trick is reported factually, outside the Assistant Coach section", () => {
    renderPage();
    expect(document.body.textContent).toMatch(/hat-?trick/i);
  });

  // The real guarantee (no mutation-wired control is ever reachable) is proven directly against
  // the fixture data in `fixtures.test.ts`, the real component's own render gate — see B07-A's
  // page test for the full rationale.

  it("never shows a fabricated Player of the Match or player ranking", () => {
    renderPage();
    expect(document.body.textContent).not.toMatch(/player of the match/i);
  });

  it("every interactive element has an accessible name", () => {
    renderPage();
    const buttons = screen.queryAllByRole("button");
    for (const button of buttons) {
      expect(button.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});
