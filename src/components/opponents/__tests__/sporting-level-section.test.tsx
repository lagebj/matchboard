import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SportingLevelSection } from "../sporting-level-section";

function makeEvidence(overrides: Partial<Parameters<typeof SportingLevelSection>[0]["initialEvidence"][number]> = {}) {
  return {
    id: "ev1",
    matchId: "match1",
    occurredAt: "2026-01-01T00:00:00.000Z",
    gameFormat: "SEVEN_A_SIDE",
    goalsFor: 10,
    goalsAgainst: 4,
    fieldedRatingSnapshot: 6.5,
    estimate: 6.2,
    excludedAt: null,
    exclusionReason: null,
    weightingMethod: "RECENCY_WEIGHTED_AVERAGE",
    formulaVersion: "v1",
    ...overrides,
  };
}

describe("SportingLevelSection — Active Evidence formatting (production consistency pass item #9)", () => {
  it("renders a human game-format label, not the raw enum", () => {
    render(<SportingLevelSection opponentTeamId="opp1" initialAggregate={null} initialEvidence={[makeEvidence()]} />);
    expect(screen.getByText("7v7")).toBeTruthy();
    expect(screen.queryByText("SEVEN_A_SIDE")).toBeNull();
  });

  it("renders the score with a real en-dash, not a literal escape sequence", () => {
    render(<SportingLevelSection opponentTeamId="opp1" initialAggregate={null} initialEvidence={[makeEvidence()]} />);
    expect(screen.getByText("10–4")).toBeTruthy();
    expect(screen.queryByText(/\\u2013/)).toBeNull();
  });

  it("replaces every underscore in the weighting method, not just the first", () => {
    render(
      <SportingLevelSection
        opponentTeamId="opp1"
        initialAggregate={null}
        initialEvidence={[makeEvidence({ weightingMethod: "SOME_LONG_METHOD_NAME" })]}
      />,
    );
    expect(screen.getByText("some long method name")).toBeTruthy();
  });

  it("falls back to a dash when game format is null", () => {
    render(<SportingLevelSection opponentTeamId="opp1" initialAggregate={null} initialEvidence={[makeEvidence({ gameFormat: null })]} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
