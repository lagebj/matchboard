import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AfterMatchOverview } from "../after-match-overview";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";

// Already-working, unchanged, independently-covered component this page only newly mounts
// directly on Overview (post-launch correction, 2026-09-18) — mocked to isolate
// AfterMatchOverview's own composition from its internal data-fetching behaviour.
vi.mock("@/components/matches/match-tactics-panel", () => ({
  MatchTacticsPanel: (props: { matchId: string; planningEditable: boolean }) => (
    <div data-testid="match-tactics-panel">
      Pitch for {props.matchId} — editable: {String(props.planningEditable)}
    </div>
  ),
}));

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

function baseProps(overrides: Partial<Parameters<typeof AfterMatchOverview>[0]> = {}) {
  return {
    presentation,
    ownKitColor: null,
    data: makeAfterData(),
    ownTeamName: "Hvit",
    opponentName: "Graabein City",
    matchFit: "UNKNOWN",
    matchId: "m1",
    teamId: "t1",
    gameFormat: "SEVEN_A_SIDE",
    selections: [{ playerId: "p1", playerName: "Sebastian R", role: "CORE", primaryPosition: "ST", secondaryPosition: null, coreTeamName: "Hvit", absenceReason: null }],
    tabHref: (t: string) => `?tab=${t}`,
    postMatchHref: "/o/test/matches/m1/post-match",
    ...overrides,
  };
}

describe("AfterMatchOverview", () => {
  it("renders the real, read-only pitch for the final lineup, not a formation-name summary", () => {
    render(<AfterMatchOverview {...baseProps()} />);
    expect(screen.getByTestId("match-tactics-panel")).toBeInTheDocument();
    expect(screen.getByText(/Pitch for m1 — editable: false/)).toBeInTheDocument();
  });

  it("never renders Player of the Match, MVP, or a rating concept", () => {
    render(<AfterMatchOverview {...baseProps()} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/player of the match/i);
    expect(text).not.toMatch(/\bMVP\b/);
    expect(text).not.toMatch(/\brating\b/i);
  });

  it("renders real attendance, goal scorer and report-status facts", () => {
    render(<AfterMatchOverview {...baseProps()} />);
    expect(screen.getByText("11/12")).toBeInTheDocument();
    expect(screen.getByText("Sebastian R")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(screen.getByText("View full report")).toBeInTheDocument();
  });

  it("shows 'Continue report' rather than 'View full report' while still a draft", () => {
    render(<AfterMatchOverview {...baseProps({ data: makeAfterData({ reportStatus: "DRAFT" }) })} />);
    expect(screen.getByText("Continue report")).toBeInTheDocument();
    expect(screen.queryByText("View full report")).not.toBeInTheDocument();
  });
});
