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

// Independently tested (completed-match-advisor.test.ts / ai-insight-actions.test.ts) and mocked
// here so this file doesn't drag the "use server" actions module's real auth/db dependencies
// into a component test.
vi.mock("@/components/ai/completed-match-advisor-panel", () => ({
  CompletedMatchAdvisorPanel: () => <div data-testid="completed-match-advisor-panel" />,
}));
vi.mock("@/components/ai/advisor-panel", () => ({
  AdvisorPanelStale: () => <div data-testid="advisor-panel-stale" />,
  AdvisorPanelReviewing: () => <div data-testid="advisor-panel-reviewing" />,
  AdvisorPanelUnavailable: () => <div data-testid="advisor-panel-unavailable" />,
}));

// Self-fetches via a "use server" action (getRotationVsActualAction) — mocked for the same
// reason as MatchTacticsPanel/CompletedMatchAdvisorPanel above, isolating composition from
// real auth/db dependencies in a component test.
vi.mock("@/components/matches/match-detail/plan-vs-reality-panel", () => ({
  PlanVsRealityPanel: (props: { matchId: string; teamId: string }) => (
    <div data-testid="plan-vs-reality-panel">
      Plan vs reality for {props.matchId}/{props.teamId}
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
    shapeChangeRows: [],
    firstTimeCanonicalPositions: [],
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
    advisorViewModel: null,
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

  it("leaves the full factual story intact when AI is unavailable (ADR-0157 C6 required test)", () => {
    render(<AfterMatchOverview {...baseProps({ advisorViewModel: { status: "unavailable" } })} />);
    // Deterministic sections render regardless of AI state.
    expect(screen.getByTestId("match-tactics-panel")).toBeInTheDocument();
    expect(screen.getByTestId("plan-vs-reality-panel")).toBeInTheDocument();
    expect(screen.getByText("Match flow")).toBeInTheDocument();
    expect(screen.getByText("Match story")).toBeInTheDocument();
    expect(screen.getByTestId("advisor-panel-unavailable")).toBeInTheDocument();
  });

  it("never fabricates a 'Partially met' or similar synthesized score in the coaching intent section", () => {
    render(<AfterMatchOverview {...baseProps({ coachingIntentCategory: "TEAM_FIRST", coachingIntentNote: "Keep it simple." })} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/partially met/i);
    expect(screen.getByText("Keep it simple.")).toBeInTheDocument();
    expect(screen.getByText("Team first")).toBeInTheDocument();
  });

  it("renders shape-change rows as concrete position changes, never a formation label", () => {
    render(
      <AfterMatchOverview
        {...baseProps({
          data: makeAfterData({
            shapeChangeRows: [
              { id: "shape-1", minuteLabel: "20'", changes: [{ playerId: "p1", playerName: "Anna A", fromPosition: "CM", toPosition: "FW" }] },
            ],
          }),
        })}
      />,
    );
    expect(screen.getByText(/Anna A: CM → FW/)).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\d-\d-\d/); // no invented formation signature like "4-3-3"
  });

  it("omits the 'What this match added' panel entirely when nothing material happened", () => {
    render(<AfterMatchOverview {...baseProps()} />);
    expect(screen.queryByText("What this match added")).not.toBeInTheDocument();
  });

  it("shows a 'What this match added' row only for a real computed change", () => {
    render(
      <AfterMatchOverview
        {...baseProps({
          data: makeAfterData({ firstTimeCanonicalPositions: [{ playerId: "p1", playerName: "Anna A", position: "CB" }] }),
        })}
      />,
    );
    expect(screen.getByText("What this match added")).toBeInTheDocument();
    expect(screen.getByText(/Anna A recorded their first minutes at CB this season\./)).toBeInTheDocument();
  });
});
