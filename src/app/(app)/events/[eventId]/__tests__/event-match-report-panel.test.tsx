import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EventMatchReportPanel } from "../event-match-report-panel";

/**
 * ADR-0152 Slice 2c — proves the Event report panel wires the guided debrief correctly (the
 * right `DebriefReportRef`, the right matchup/period/player derivations) and no longer renders
 * the retired plain Team reflection/Opponent observation/Notes textareas. `PostMatchDebrief`'s
 * own behaviour (steps, autosave, submit) is already exhaustively covered in
 * src/components/post-match/debrief/__tests__/post-match-debrief.test.tsx — mocked here.
 */
vi.mock("../../event-football-observation-actions", () => ({
  getEventFootballObservationsAction: vi.fn().mockResolvedValue({ success: true, observations: [] }),
}));
vi.mock("../../actions", () => ({
  getAvailablePlayersForEvent: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../event-post-match-actions", () => ({
  getEventMatchTimingReviewAction: vi.fn().mockResolvedValue({ timingReview: [{ period: "FIRST_HALF", periodLabel: "First half" }], outOfRangeEventCount: 0 }),
  confirmEventPeriodTimingAction: vi.fn(),
  correctEventPeriodTimingAction: vi.fn(),
  updateEventMatchResultAction: vi.fn(),
  addEventGoalAction: vi.fn(),
  removeEventGoalAction: vi.fn(),
  addEventAssistAction: vi.fn(),
  removeEventAssistAction: vi.fn(),
  updateEventPlayerAttendanceAction: vi.fn(),
  addEventMatchPlayerAction: vi.fn(),
  removeEventMatchPlayerAction: vi.fn(),
  getEventMatchCombinationEvidenceAction: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../event-debrief-actions", () => ({
  getEventDebriefAction: vi.fn(),
}));
vi.mock("@/components/matches/post-match-report-shell", () => ({
  PostMatchReportShell: ({ extraSections }: { extraSections: React.ReactNode }) => <div>{extraSections}</div>,
}));
vi.mock("@/components/live-match/post-match-unresolved-banner", () => ({ PostMatchUnresolvedBanner: () => null }));
vi.mock("@/components/player-development/football-observation-section", () => ({ FootballObservationSection: () => null }));
vi.mock("@/components/matches/match-combination-evidence-panel", () => ({ MatchCombinationEvidencePanel: () => null }));

const capturedDebriefProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock("@/components/post-match/debrief/post-match-debrief", () => ({
  PostMatchDebrief: (props: Record<string, unknown>) => {
    capturedDebriefProps.current = props;
    return <div data-testid="debrief-mock" />;
  },
}));

const { getEventDebriefAction } = vi.mocked(await import("../../event-debrief-actions"));

function baseReport() {
  return {
    id: "report-1",
    status: "DRAFT",
    ourScore: 2,
    opponentScore: 1,
    teamReflection: null,
    opponentObservation: null,
    notes: null,
    playerReports: [{ id: "pr1", playerId: "player-1", playerName: "Alex Player", attendanceStatus: "PRESENT", role: null }],
    goalEvents: [],
    assistEvents: [],
  };
}

describe("EventMatchReportPanel — guided debrief wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedDebriefProps.current = null;
  });

  it("fetches and renders the debrief with an EVENT ref, the derived matchup label, and present-only player options", async () => {
    getEventDebriefAction.mockResolvedValue({
      success: true,
      data: { id: "debrief-1", status: "DRAFT", answers: { version: 1, answers: {} }, organisationId: "org-1", postMatchReportId: null, eventPostMatchReportId: "report-1", version: 1, createdBy: null, submittedBy: null, submittedAt: null },
    });

    render(<EventMatchReportPanel eventMatchId="match-1" teamLabel="A1 Blues" opponentLabel="Rivals" report={baseReport()} isLocked={false} onRefresh={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("debrief-mock")).toBeInTheDocument());

    expect(capturedDebriefProps.current).toMatchObject({
      reportRef: { kind: "EVENT", eventMatchId: "match-1" },
      debriefId: "debrief-1",
      status: "DRAFT",
      opponentName: "Rivals",
      matchupLabel: "A1 Blues 2–1 Rivals",
      readOnly: false,
      playerOptions: [{ id: "player-1", name: "Alex Player" }],
    });
    expect((capturedDebriefProps.current!.periodOptions as string[])).toEqual(["First half", "Multiple periods", "Not sure"]);
  });

  it("shows the debrief's own error message instead of the wizard when it fails to load", async () => {
    getEventDebriefAction.mockResolvedValue({ success: false, error: "Post-match report not found." });

    render(<EventMatchReportPanel eventMatchId="match-1" teamLabel="A1 Blues" opponentLabel="Rivals" report={baseReport()} isLocked={false} onRefresh={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Post-match report not found.")).toBeInTheDocument());
    expect(screen.queryByTestId("debrief-mock")).not.toBeInTheDocument();
  });

  it("no longer renders the retired plain Team reflection / Opponent observation / Notes textareas", async () => {
    getEventDebriefAction.mockResolvedValue({
      success: true,
      data: { id: "debrief-1", status: "DRAFT", answers: { version: 1, answers: {} }, organisationId: "org-1", postMatchReportId: null, eventPostMatchReportId: "report-1", version: 1, createdBy: null, submittedBy: null, submittedAt: null },
    });

    render(<EventMatchReportPanel eventMatchId="match-1" teamLabel="A1 Blues" opponentLabel="Rivals" report={baseReport()} isLocked={false} onRefresh={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("debrief-mock")).toBeInTheDocument());
    expect(screen.queryByText("Team reflection")).not.toBeInTheDocument();
    expect(screen.queryByText("Opponent observation")).not.toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });
});
