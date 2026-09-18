import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostMatchSummaryTab } from "../post-match-summary-tab";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";

function makeAfterData(overrides: Partial<MatchDetailAfterData> = {}): MatchDetailAfterData {
  return {
    reportId: "r1",
    reportStatus: "DRAFT",
    homeGoals: 2,
    awayGoals: 10,
    teamNote: null,
    completedBy: null,
    completedAt: null,
    attendance: [],
    attendanceSummary: { presentCount: 11, noShowCount: 1, totalCount: 12, noShowNames: ["Safwan D"] },
    goalScorers: { scorers: [{ participantKey: "p1", playerName: "Sebastian R", count: 2 }], unattributedCount: 0 },
    assistProviders: { scorers: [{ participantKey: "p2", playerName: "Nikita F", count: 2 }], unattributedCount: 0 },
    timeline: [],
    playerMinutes: new Map(),
    playerInvolvement: [
      { participantKey: "p1", playerName: "Sebastian R", goals: 2, assists: 0, observationCount: 0, minutes: 64 },
      { participantKey: "p3", playerName: "Ibro O", goals: 0, assists: 0, observationCount: 0, minutes: 0 },
    ],
    reflection: null,
    footballObservations: [],
    opponentObservation: null,
    combinationEvidence: [],
    goalAttributionGap: null,
    timingNeedsReviewCount: 0,
    outOfRangeEventCount: 0,
    ...overrides,
  };
}

describe("PostMatchSummaryTab", () => {
  it("never calculates a score, best player, or Player of the Match", () => {
    render(<PostMatchSummaryTab data={makeAfterData()} ownTeamName="Hvit" opponentName="Graabein City" isDraft />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/player of the match/i);
    expect(text).not.toMatch(/\bMVP\b/);
    expect(text).not.toMatch(/\brating\b/i);
    expect(text).not.toMatch(/best player/i);
  });

  it("only highlights players who actually appear in captured goal/assist facts", () => {
    render(<PostMatchSummaryTab data={makeAfterData()} ownTeamName="Hvit" opponentName="Graabein City" isDraft />);
    expect(screen.getByText("Sebastian R")).toBeInTheDocument();
    expect(screen.queryByText("Ibro O")).not.toBeInTheDocument();
  });

  it("shows named no-shows from real attendance data", () => {
    render(<PostMatchSummaryTab data={makeAfterData()} ownTeamName="Hvit" opponentName="Graabein City" isDraft />);
    expect(screen.getByText(/Safwan D/)).toBeInTheDocument();
  });
});
