import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AfterMatchOverview } from "../after-match-overview";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";

function makeAfterData(overrides: Partial<MatchDetailAfterData> = {}): MatchDetailAfterData {
  return {
    reportId: "r1",
    reportStatus: "LOCKED",
    homeGoals: 2,
    awayGoals: 10,
    teamNote: "Good performance with high energy.",
    completedBy: "Lage",
    completedAt: "2026-09-17T10:00:00.000Z",
    attendance: [],
    attendanceSummary: { presentCount: 11, noShowCount: 1, totalCount: 12, noShowNames: ["Safwan D"] },
    goalScorers: { scorers: [{ participantKey: "p1", playerName: "Sebastian R", count: 2 }], unattributedCount: 0 },
    assistProviders: { scorers: [{ participantKey: "p2", playerName: "Nikita F", count: 2 }], unattributedCount: 0 },
    timeline: [],
    playerMinutes: new Map(),
    playerInvolvement: [
      { participantKey: "p1", playerName: "Sebastian R", goals: 2, assists: 0, observationCount: 0, minutes: 64 },
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

const presentation = buildMatchPresentation({
  id: "m1",
  teamName: "Hvit",
  opponentName: "Graabein City",
  isHome: false,
  kickoffAt: new Date("2026-09-16T18:00:00"),
  lifecycleStatus: "done",
  ownGoals: 10,
  opponentGoals: 2,
  outcome: "WON",
});

describe("AfterMatchOverview", () => {
  it("never renders Player of the Match, MVP, or a rating concept", () => {
    render(
      <AfterMatchOverview
        presentation={presentation}
        ownKitColor={null}
        data={makeAfterData()}
        ownTeamName="Hvit"
        opponentName="Graabein City"
        matchFit="UNKNOWN"
        lineupSummary={null}
        tabHref={(t) => `?tab=${t}`}
        postMatchHref="/o/test/matches/m1/post-match"
      />,
    );
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/player of the match/i);
    expect(text).not.toMatch(/\bMVP\b/);
    expect(text).not.toMatch(/\brating\b/i);
  });

  it("renders real attendance, goal scorer and report-status facts", () => {
    render(
      <AfterMatchOverview
        presentation={presentation}
        ownKitColor={null}
        data={makeAfterData()}
        ownTeamName="Hvit"
        opponentName="Graabein City"
        matchFit="UNKNOWN"
        lineupSummary={null}
        tabHref={(t) => `?tab=${t}`}
        postMatchHref="/o/test/matches/m1/post-match"
      />,
    );
    expect(screen.getByText("11/12")).toBeInTheDocument();
    expect(screen.getByText("Sebastian R")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(screen.getByText("View full report")).toBeInTheDocument();
  });

  it("shows 'Continue report' rather than 'View full report' while still a draft", () => {
    render(
      <AfterMatchOverview
        presentation={presentation}
        ownKitColor={null}
        data={makeAfterData({ reportStatus: "DRAFT" })}
        ownTeamName="Hvit"
        opponentName="Graabein City"
        matchFit="UNKNOWN"
        lineupSummary={null}
        tabHref={(t) => `?tab=${t}`}
        postMatchHref="/o/test/matches/m1/post-match"
      />,
    );
    expect(screen.getByText("Continue report")).toBeInTheDocument();
    expect(screen.queryByText("View full report")).not.toBeInTheDocument();
  });
});
