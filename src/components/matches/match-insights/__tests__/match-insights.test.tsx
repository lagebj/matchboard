import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchInsights } from "../match-insights";
import type { MatchInsightsViewModel } from "@/lib/matches/match-insights/get-match-insights";
import type { MatchInsightCandidate } from "@/lib/matches/match-insights/types";

function candidate(overrides: Partial<MatchInsightCandidate> & Pick<MatchInsightCandidate, "id" | "relevance">): MatchInsightCandidate {
  return {
    category: "OBSERVATION_FOCUS",
    title: "Title",
    observation: "Observation text.",
    subjectRefs: [],
    factRefs: [],
    evidenceRefs: ["fact:test:x"],
    source: "DETERMINISTIC",
    ...overrides,
  };
}

describe("MatchInsights", () => {
  it("shows a loading state while the view model has not resolved yet", () => {
    render(<MatchInsights viewModel={null} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows the quiet state when there are no qualifying insights, without inventing generic advice", () => {
    const viewModel: MatchInsightsViewModel = { status: "CURRENT", insights: [], totalCount: 0 };
    render(<MatchInsights viewModel={viewModel} />);
    expect(screen.getByText("No major exceptions in the current plan.")).toBeInTheDocument();
  });

  it("shows all qualifying insights up to 5 with no filler, and no Show all control", () => {
    const insights = [candidate({ id: "a", relevance: "HIGH" }), candidate({ id: "b", relevance: "HIGH" }), candidate({ id: "c", relevance: "MEDIUM" })];
    const viewModel: MatchInsightsViewModel = { status: "CURRENT", insights, totalCount: 3 };
    render(<MatchInsights viewModel={viewModel} />);
    expect(screen.getAllByText("Title")).toHaveLength(3);
    expect(screen.queryByText(/Show all/)).not.toBeInTheDocument();
  });

  it("shows only the top 5 by default and reveals the rest via Show all", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const insights = Array.from({ length: 9 }, (_, i) => candidate({ id: `i${i}`, relevance: "MEDIUM", title: `Insight ${i}` }));
    const viewModel: MatchInsightsViewModel = { status: "CURRENT", insights, totalCount: 9 };
    render(<MatchInsights viewModel={viewModel} />);

    expect(screen.getAllByText(/^Insight \d$/)).toHaveLength(5);
    const showAllButton = screen.getByText("Show all (9)");
    await userEvent.click(showAllButton);
    expect(screen.getAllByText(/^Insight \d$/)).toHaveLength(9);
    expect(screen.getByText("Show fewer")).toBeInTheDocument();
  });

  it("shows a restrained status line, never a large infrastructure error banner, when AI is unavailable", () => {
    const viewModel: MatchInsightsViewModel = {
      status: "AI_UNAVAILABLE",
      insights: [candidate({ id: "a", relevance: "HIGH" })],
      totalCount: 1,
    };
    render(<MatchInsights viewModel={viewModel} />);
    expect(screen.getByText("AI interpretation is temporarily unavailable. Factual insights are still current.")).toBeInTheDocument();
    // Deterministic insights remain visible alongside the status line.
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("shows an updating status line while a new review is pending, without withholding deterministic insights", () => {
    const viewModel: MatchInsightsViewModel = {
      status: "UPDATING",
      insights: [candidate({ id: "a", relevance: "MEDIUM" })],
      totalCount: 1,
    };
    render(<MatchInsights viewModel={viewModel} />);
    expect(screen.getByText("Updating insights…")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
  });
});
