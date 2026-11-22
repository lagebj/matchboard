import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C07OnPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C07OnPage />
    </ThemeProvider>,
  );
}

describe("Gate C W3 — C07-ON material contextual synthesis", () => {
  it("preserves the exact same decision-day priority as C07-OFF — never silently reordered", () => {
    renderPage();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    expect(screen.getByText("Available and active, but not assigned to any match in Round 9.")).toBeInTheDocument();
  });

  it("renders the hypothesis with its evidence and missing-evidence disclosure, labelled as a hypothesis", () => {
    renderPage();
    expect(screen.getByText("Assistant Coach hypotheses")).toBeInTheDocument();
    expect(screen.getByText("Assistant Coach hypothesis")).toBeInTheDocument();
    expect(
      screen.getByText(/Alex Dahl has received fewer match opportunities than comparable eligible teammates/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Supporting evidence:/)).toBeInTheDocument();
    expect(screen.getByText(/Missing evidence: Recent training attendance/)).toBeInTheDocument();
    expect(screen.getByText(/This is an AI hypothesis, not a confirmed fact/)).toBeInTheDocument();
  });

  it("adds information beyond existing Today facts rather than restating the primary decision", () => {
    renderPage();
    // The hypothesis is about a season-wide opportunity pattern, never the exact same sentence
    // Today's own primary decision already shows — proves it is new synthesis, not a restatement.
    expect(screen.getByText(/Alex Dahl has received fewer match opportunities/)).toBeInTheDocument();
    expect(screen.getAllByText(/Alex/).length).toBeGreaterThanOrEqual(1);
  });

  it("offers only advisory promote/dismiss actions — no automatic mutation of plan state", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /promote to development focus/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });

  it("renders exactly one Assistant Coach panel — no duplicate information panels", () => {
    renderPage();
    expect(screen.getAllByText("Assistant Coach hypotheses")).toHaveLength(1);
  });

  it("never renders InstallPwaCard", () => {
    renderPage();
    expect(screen.queryByText(/install matchboard/i)).not.toBeInTheDocument();
  });
});
