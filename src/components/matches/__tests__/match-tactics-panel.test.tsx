import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MatchTacticsPanel } from "../match-tactics-panel";

// Regression coverage: AbsenceControl (production consistency pass item #3, wired into the
// Round Board via `AbsenceControl` since #362) was never re-mounted onto the Squad list after
// PR #617 replaced the old monolithic match-detail.tsx with the lifecycle-aware surfaces —
// leaving no way to mark an already-planned player absent from Match Details. This covers the
// fix: the Squad row for a real Player (planned/helper/match-day-addition, not a Guest) exposes
// the same mark/clear-absence control, and picking a reason calls the existing server action and
// refreshes so `selections` (a server-provided prop) picks up the new state.

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const { markMatchAbsenceActionMock, clearMatchAbsenceActionMock } = vi.hoisted(() => ({
  markMatchAbsenceActionMock: vi.fn(async () => ({ success: true })),
  clearMatchAbsenceActionMock: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/app/(app)/matches/absence-actions", () => ({
  markMatchAbsenceAction: markMatchAbsenceActionMock,
  clearMatchAbsenceAction: clearMatchAbsenceActionMock,
}));

const lineup = {
  id: "lineup-1",
  status: "DRAFT",
  formationId: "formation-1",
  formationSnapshot: null,
  benchPlayerIds: [],
  notes: null,
  formation: {
    id: "formation-1",
    name: "4-3-3",
    gameFormat: "SEVEN_A_SIDE",
    slots: [
      { id: "slot-1", gridX: 2, gridY: 1, label: "Striker", shortLabel: "ST", roleType: "FORWARD", acceptedPositionIds: ["ST"], sortOrder: 1 },
    ],
  },
  assignments: [
    { id: "assignment-1", slotId: "slot-1", playerId: null, locked: false, source: "MANUAL" },
  ],
};

const getMatchLineupMock = vi.fn(async (_matchId: string, _teamId: string) => lineup);
vi.mock("@/app/(app)/matches/lineup-actions", () => ({
  getMatchLineup: (matchId: string, teamId: string) => getMatchLineupMock(matchId, teamId),
  createMatchLineup: vi.fn(),
  assignPlayerToSlot: vi.fn(),
  removePlayerFromSlot: vi.fn(),
  toggleSlotLock: vi.fn(),
  changeMatchLineupFormation: vi.fn(),
}));

vi.mock("@/app/(app)/matches/suggest-actions", () => ({
  getSuggestFormationData: vi.fn(async () => ({ formations: [], suggestion: null })),
  suggestLineupForMatch: vi.fn(),
  applySuggestedLineup: vi.fn(),
  clearSuggestedAssignments: vi.fn(),
  fillEmptySlots: vi.fn(),
}));

vi.mock("@/domain/team-configuration/actions", () => ({
  fetchTeamConfiguration: vi.fn(async () => null),
}));

vi.mock("@/app/(app)/matches/match-insights-actions", () => ({
  getMatchInsightsAction: vi.fn(async () => ({ success: false })),
}));

vi.mock("@/app/(app)/matches/integrated-match-plan-actions", () => ({
  generateIntegratedMatchPlanAction: vi.fn(),
}));

vi.mock("@/app/(app)/o/[orgSlug]/teams/[teamId]/best-lineup-actions/actions", () => ({
  copyBestLineupToMatchAction: vi.fn(),
}));

// AddPlayerDialog (statically imported by MatchTacticsPanel, though only mounted once "Add
// player" is clicked) imports these "use server" modules at module scope, which otherwise pull
// in next-auth/next/server transitively and break under jsdom — same reasoning as
// `before-match-overview.test.tsx`'s mocks for its own always-imported dependencies.
vi.mock("@/app/(app)/matches/match-helper-actions", () => ({
  addLeagueMatchHelperAction: vi.fn(),
  getLeagueMatchHelperCandidatesAction: vi.fn(),
}));
vi.mock("@/app/(app)/matches/league-match-guest-actions", () => ({
  addLeagueMatchGuestAction: vi.fn(),
  getLeagueMatchGuestCandidatesAction: vi.fn(),
  createAndAddMatchGuestAction: vi.fn(),
}));

function baseSelections() {
  return [
    { playerId: "p1", playerName: "Emil Berg", role: "CORE", primaryPosition: "CM", secondaryPosition: null, coreTeamName: "Hvit", absenceReason: null as string | null, source: "planned" as const },
    { playerId: "g1", playerName: "Guest Player", role: "GUEST", primaryPosition: "GUEST", secondaryPosition: null, coreTeamName: "Guest", absenceReason: null as string | null, source: "guest" as const },
  ];
}

describe("MatchTacticsPanel — Squad row absence control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMatchLineupMock.mockImplementation(async () => lineup);
  });

  it("lets a coach mark a planned player absent for this match from the Squad list", async () => {
    render(
      <MatchTacticsPanel
        matchId="m1"
        teamId="t1"
        teamName="Hvit"
        gameFormat="SEVEN_A_SIDE"
        planningEditable={true}
        selections={baseSelections()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Emil Berg")).toBeInTheDocument());

    // Two players -> two comboboxes rendered by react-select-less native <select>s: one absence
    // control per real Player row. The Guest row gets no absence control (not a valid
    // MatchReportAbsence target — ADR-0151 §9).
    const absenceSelects = screen.getAllByTitle(/Mark absent for this match/i);
    expect(absenceSelects).toHaveLength(1);

    fireEvent.change(absenceSelects[0], { target: { value: "SICK" } });

    await waitFor(() => expect(markMatchAbsenceActionMock).toHaveBeenCalledWith("m1", "p1", "SICK"));
    // The panel refetches the lineup and refreshes the server-provided `selections` prop so the
    // new absence state is reflected, since MatchTacticsPanel doesn't own that data itself.
    await waitFor(() => expect(getMatchLineupMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
  });

  it("shows a read-only absence label instead of a select once planning has closed", async () => {
    render(
      <MatchTacticsPanel
        matchId="m1"
        teamId="t1"
        teamName="Hvit"
        gameFormat="SEVEN_A_SIDE"
        planningEditable={false}
        selections={[
          { playerId: "p1", playerName: "Emil Berg", role: "CORE", primaryPosition: "CM", secondaryPosition: null, coreTeamName: "Hvit", absenceReason: "SICK", source: "planned" },
        ]}
      />,
    );

    await waitFor(() => expect(screen.getByText("Emil Berg")).toBeInTheDocument());
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Sick")).toBeInTheDocument();
  });
});
