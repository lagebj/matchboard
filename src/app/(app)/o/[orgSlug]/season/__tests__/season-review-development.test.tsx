import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeasonReviewDevelopment } from "../season-review-development";
import type { SeasonReviewDevelopmentData } from "@/lib/season/get-season-review-data";

/**
 * ADR-0157 slice C7 required tests: "development trends use ADR-0155 persisted derivation" (the
 * trend numbers rendered here come straight from `SeasonReviewDevelopmentData.trendRollup`, never
 * recomputed in this component) and "AI unavailable leaves deterministic season stories intact"
 * -- with `unresolvedNextFocus`/`developmentCycleReviews` empty (the AI-unavailable shape), the
 * deterministic trend and active-focus sections must still render.
 */

function baseData(overrides: Partial<SeasonReviewDevelopmentData> = {}): SeasonReviewDevelopmentData {
  return {
    trendRollup: { established: [{ metricKey: "role_seconds", direction: "UP", playerCount: 4 }], playersWithEstablishedTrend: 4, playersWithEmergingSignal: 2, totalPlayersConsidered: 20 },
    activeDevelopmentFocusCount: 5,
    developmentFocusByCategory: [{ category: "BALL_CONTROL", label: "Ball control", count: 3 }],
    unresolvedNextFocus: [],
    developmentCycleReviews: [],
    ...overrides,
  };
}

describe("SeasonReviewDevelopment", () => {
  it("renders deterministic trend and active-focus evidence with AI content fully absent (AI unavailable)", () => {
    render(<SeasonReviewDevelopment data={baseData()} />);

    expect(screen.getByText("4")).toBeInTheDocument(); // playersWithEstablishedTrend
    expect(screen.getByText("Players with an established trend")).toBeInTheDocument();
    expect(screen.getByText("Ball control")).toBeInTheDocument();
    expect(screen.queryByText(/Assistant Coach hypothesis/)).not.toBeInTheDocument();
  });

  it("visually labels AI-sourced content as a hypothesis, distinct from deterministic evidence", () => {
    render(
      <SeasonReviewDevelopment
        data={baseData({
          unresolvedNextFocus: [{ title: "Keep working on transitions", body: "Recurring theme from recent reviews." }],
          developmentCycleReviews: [{ teamId: "t1", teamName: "A1 Blues", windowLabel: "Learning cycle · 1 Mar – 1 Apr 2026", summary: "Summary text" }],
        })}
      />,
    );

    const hypothesisLabels = screen.getAllByText("Assistant Coach hypothesis");
    expect(hypothesisLabels.length).toBe(2);
    expect(screen.getByText("Keep working on transitions")).toBeInTheDocument();
  });

  it("renders an empty state rather than a blank section when there is no evidence at all", () => {
    render(
      <SeasonReviewDevelopment
        data={{ trendRollup: { established: [], playersWithEstablishedTrend: 0, playersWithEmergingSignal: 0, totalPlayersConsidered: 20 }, activeDevelopmentFocusCount: 0, developmentFocusByCategory: [], unresolvedNextFocus: [], developmentCycleReviews: [] }}
      />,
    );
    expect(screen.getByText(/No development evidence yet/)).toBeInTheDocument();
  });
});
