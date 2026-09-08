import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerEvidenceStoriesPanel } from "../player-evidence-stories-panel";
import type { PlayerRecentOpportunity } from "@/lib/players/get-player-recent-opportunity";

const opportunity: PlayerRecentOpportunity = {
  perRound: [
    { roundLabel: "W12", hadOpportunity: true },
    { roundLabel: "W13", hadOpportunity: false },
    { roundLabel: "W14", hadOpportunity: true },
    { roundLabel: "W15", hadOpportunity: true },
    { roundLabel: "W16", hadOpportunity: true },
    { roundLabel: "W17", hadOpportunity: true },
  ],
  recentCount: 4,
  recentTotal: 5,
  previousCount: 3,
  previousTotal: 5,
};

describe("PlayerEvidenceStoriesPanel", () => {
  it("leads with a recent-opportunity story stated as a fact, over eligible rounds only", () => {
    render(
      <PlayerEvidenceStoriesPanel
        playerName="Henrik"
        recentOpportunity={opportunity}
        realisedPositionCounts={{ Midfield: 5, Defence: 2 }}
        exposureSampleSize={7}
        leagueSeasonLabel="Autumn 2026"
      />,
    );
    expect(screen.getByText("Recent match opportunity")).toBeTruthy();
    expect(screen.getByText("4 of 5")).toBeTruthy();
    expect(screen.getByText(/Eligible rounds only · Autumn 2026/)).toBeTruthy();
    // Neutral / correlational interpretation vocabulary only.
    expect(
      screen.queryByText(/behind|ahead|good|bad|poor|underperform/i),
    ).toBeNull();
  });

  it("shows the position-exposure story with canonical labels and a realised-appearance count", () => {
    render(
      <PlayerEvidenceStoriesPanel
        playerName="Henrik"
        recentOpportunity={opportunity}
        realisedPositionCounts={{ Midfield: 5, Defence: 2 }}
        exposureSampleSize={7}
        leagueSeasonLabel="Autumn 2026"
      />,
    );
    expect(screen.getByText("Position exposure")).toBeTruthy();
    expect(screen.getByText(/7 realised appearances/)).toBeTruthy();
  });

  it("renders an explicit insufficient-evidence state for thin exposure", () => {
    render(
      <PlayerEvidenceStoriesPanel
        playerName="Noah"
        recentOpportunity={null}
        realisedPositionCounts={{ Midfield: 1 }}
        exposureSampleSize={1}
        leagueSeasonLabel={null}
      />,
    );
    expect(screen.getByText(/Observed in 1 match/)).toBeTruthy();
  });

  it("renders nothing when there is no opportunity data and no meaningful exposure", () => {
    const { container } = render(
      <PlayerEvidenceStoriesPanel
        playerName="Noah"
        recentOpportunity={null}
        realisedPositionCounts={{}}
        exposureSampleSize={0}
        leagueSeasonLabel={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
