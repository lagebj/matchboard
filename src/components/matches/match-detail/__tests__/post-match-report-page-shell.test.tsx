import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostMatchReportPageShell } from "../post-match-report-page-shell";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";

/**
 * Regression coverage for a real bug caught by `e2e/post-match-evidence-parity.spec.ts` against
 * the live Test-slot deployment: the DRAFT default tab (`players`, ADR-0003) was being
 * *recomputed live* from `surfaceState`, which itself changes (DRAFT -> COMPLETED) as a direct
 * side effect of completing the report from the Players tab — silently navigating the coach away
 * from Players (and its "Locked" status pill) right after they used it. The fix pins the resolved
 * default into the URL on first mount so it survives the DRAFT -> COMPLETED transition.
 */

const replaceMock = vi.hoisted(() => vi.fn());
const searchParamsState = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => searchParamsState.value,
}));

// Every child section is an already-working, unchanged component this shell only relocates —
// mocked here to isolate the shell's own tab-resolution/pinning behaviour under test.
vi.mock("@/components/assistant/post-match-page", () => ({
  PostMatchPage: ({ initialReport }: { initialReport: { status: string } | null }) => (
    <div data-testid="players-tab">Players tab — status: {initialReport?.status ?? "NONE"}</div>
  ),
}));
vi.mock("@/components/live-match/post-match-unresolved-banner", () => ({
  PostMatchUnresolvedBanner: () => null,
}));
vi.mock("@/components/matches/goal-attribution-gap-banner", () => ({
  GoalAttributionGapBanner: () => null,
}));
vi.mock("@/components/matches/team-reflection-section", () => ({ TeamReflectionSection: () => null }));
vi.mock("@/components/player-development/football-observation-section", () => ({
  FootballObservationSection: () => null,
}));
vi.mock("@/components/opponents/observation-section", () => ({ ObservationSection: () => null }));
vi.mock("@/components/matches/legacy-match-feedback-section", () => ({
  LegacyMatchFeedbackSection: () => null,
}));
vi.mock("@/components/matches/match-combination-evidence-panel", () => ({
  MatchCombinationEvidencePanel: () => null,
}));

function makeAfterData(overrides: Partial<MatchDetailAfterData> = {}): MatchDetailAfterData {
  return {
    reportId: "r1",
    reportStatus: "DRAFT",
    homeGoals: 1,
    awayGoals: 0,
    teamNote: null,
    completedBy: null,
    completedAt: null,
    attendance: [],
    attendanceSummary: { presentCount: 0, noShowCount: 0, totalCount: 0, noShowNames: [] },
    goalScorers: { scorers: [], unattributedCount: 0 },
    assistProviders: { scorers: [], unattributedCount: 0 },
    timeline: [],
    playerMinutes: new Map(),
    playerInvolvement: [],
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
  lifecycleStatus: "report_incomplete",
  ownGoals: 1,
  opponentGoals: 0,
  outcome: "WON",
});

function baseProps(surfaceState: "DRAFT" | "COMPLETED", reportStatus: "DRAFT" | "LOCKED") {
  return {
    matchId: "m1",
    breadcrumbHref: "/o/test/matches/m1",
    title: "Hvit vs Graabein City",
    surfaceState,
    completedByLabel: null,
    presentation,
    ownKitColor: null,
    afterData: makeAfterData({ reportStatus }),
    reviewHref: "/o/test/matches/m1/review",
    matchDetailHref: "/o/test/matches/m1",
    ownTeamName: "Hvit",
    opponentName: "Graabein City",
    postMatchPageProps: {
      matchId: "m1",
      initialReport: { status: reportStatus } as never,
      allPlayers: [],
    },
    observationSectionProps: { matchId: "m1", existingObservation: null, isLocked: reportStatus === "LOCKED", matchFit: "UNKNOWN" } as never,
    teamReflectionProps: { matchId: "m1", reflection: null } as never,
    footballObservationProps: { matchId: "m1", players: [], existingObservations: [], isLocked: reportStatus === "LOCKED" } as never,
    legacyFeedbackProps: { feedback: [], players: [] } as never,
    combinationEvidenceProps: { evidence: [], players: [] } as never,
  };
}

describe("PostMatchReportPageShell — default-tab pinning (regression)", () => {
  it("defaults DRAFT to the Players tab and pins it into the URL on mount", () => {
    searchParamsState.value = new URLSearchParams();
    replaceMock.mockClear();
    render(<PostMatchReportPageShell {...baseProps("DRAFT", "DRAFT")} />);

    expect(screen.getByTestId("players-tab")).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("?tab=players", { scroll: false });
  });

  it("stays on the Players tab through the DRAFT -> COMPLETED transition once ?tab= is explicit", () => {
    // Simulates the fixed behaviour: the URL already carries the pinned tab (as the mount effect
    // above would have set it) by the time the report flips to LOCKED and the page re-renders
    // with fresh server data.
    searchParamsState.value = new URLSearchParams("tab=players");
    replaceMock.mockClear();
    render(<PostMatchReportPageShell {...baseProps("COMPLETED", "LOCKED")} />);

    expect(screen.getByTestId("players-tab")).toBeInTheDocument();
    expect(screen.getByText(/status: LOCKED/)).toBeInTheDocument();
    // Already pinned — the mount effect must not fire again.
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("does not repin an explicitly-selected non-default tab", () => {
    searchParamsState.value = new URLSearchParams("tab=summary");
    replaceMock.mockClear();
    render(<PostMatchReportPageShell {...baseProps("DRAFT", "DRAFT")} />);

    expect(screen.queryByTestId("players-tab")).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
