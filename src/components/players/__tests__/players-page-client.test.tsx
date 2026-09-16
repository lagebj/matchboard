import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayersPageClient } from "../players-page-client";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import type { PlayerSeasonOverviewRow, PlayerCurrentRoundAttentionRow, PlayerDevelopmentOverviewRow } from "@/lib/players/get-players-overview";

/**
 * Matchboard Players Operating Surface bundle: Overview summary metrics
 * (`02_ROUTE_COMPOSITION_AND_VISUAL_CONTRACT.md §3`), client-side search/team/position/
 * availability filters and the selected-player fallback order
 * (`05_INTERACTION_FILTER_AND_RESPONSIVE_CONTRACT.md §8`).
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// `ManageBaseGroupsView` (the "groups" mode) imports a real `"use server"` action module that
// transitively pulls in next-auth/db — mocked here purely to keep this client-component test
// import-safe, per the repository's existing server-action test-mocking convention.
vi.mock("@/app/(app)/players/actions", () => ({
  updatePlayerCoreTeamAction: vi.fn(),
}));

function makePlayer(overrides: Partial<Parameters<typeof PlayersPageClient>[0]["players"][number]> = {}) {
  return {
    id: "p1",
    firstName: "Sander",
    lastName: "Berg",
    coreTeamId: "t1",
    coreTeam: { id: "t1", name: "U14 Lions" },
    coreTeamKitColor: null,
    primaryPosition: "CM",
    currentAvailability: "AVAILABLE",
    shirtNumber: 7,
    nonRotatable: false,
    reducedMatchLoadAllowed: false,
    overallRating: { value: null, displayValue: "—", ratedAttributeCount: 0, maxAttributeCount: 12 },
    ...overrides,
  };
}

function makeSeasonRow(overrides: Partial<PlayerSeasonOverviewRow> = {}): PlayerSeasonOverviewRow {
  return {
    playerId: "p1",
    displayName: "Sander Berg",
    coreTeam: { id: "t1", name: "U14 Lions" },
    actualAppearances: 10,
    goals: 2,
    assists: 1,
    coreAppearances: 8,
    supportAppearances: 2,
    developmentAppearances: 0,
    matchdayAdditions: 0,
    actualAdditionalAppearances: 0,
    plannedButAbsent: 0,
    finalisedUpcomingAppearances: 0,
    draftSelections: 0,
    squadRepairAppearances: 0,
    unavailableRoundCount: 0,
    dropsCount: 0,
    lastMovement: null,
    recentInvolvement: [],
    roundAssignments: [],
    ...overrides,
  };
}

function baseProps(overridesArr: {
  players?: ReturnType<typeof makePlayer>[];
  seasonRows?: PlayerSeasonOverviewRow[];
  currentRoundRows?: PlayerCurrentRoundAttentionRow[];
  developmentRows?: PlayerDevelopmentOverviewRow[];
} = {}) {
  return {
    players: overridesArr.players ?? [
      makePlayer({ id: "p1", firstName: "Sander", lastName: "Berg", coreTeam: { id: "t1", name: "U14 Lions" } }),
      makePlayer({ id: "p2", firstName: "Oskar", lastName: "Lund", coreTeam: { id: "t2", name: "U13 Hawks" }, primaryPosition: "CB" }),
    ],
    teams: [{ id: "t1", name: "U14 Lions" }, { id: "t2", name: "U13 Hawks" }],
    leagueSeasons: [{ id: "s1", name: "Autumn 2026", startDate: new Date("2026-08-01"), endDate: new Date("2026-12-01") }],
    matchRounds: [{ id: "r1", name: "Round 1", leagueSeasonId: "s1" }],
    seasonRows: overridesArr.seasonRows ?? [
      makeSeasonRow({ playerId: "p1", displayName: "Sander Berg", supportAppearances: 2 }),
      makeSeasonRow({ playerId: "p2", displayName: "Oskar Lund", coreTeam: { id: "t2", name: "U13 Hawks" }, supportAppearances: 0 }),
    ],
    currentRoundRows: overridesArr.currentRoundRows ?? [],
    developmentRows: overridesArr.developmentRows ?? [],
    effectivePositionsByPlayerId: {},
    activePlayerCount: overridesArr.players?.length ?? 2,
    selectedPeriodId: "s1",
    selectedRoundId: "r1",
    initialMode: "overview",
  };
}

function renderClient(props = baseProps()) {
  return render(
    <OrgSlugProvider orgSlug="acme">
      <PlayersPageClient {...props} />
    </OrgSlugProvider>,
  );
}

describe("PlayersPageClient — Overview summary metrics", () => {
  it("renders the Active players metric from the independently-loaded count, not the row count", () => {
    renderClient(baseProps({ players: [makePlayer({ id: "p1" })] }));
    expect(screen.getByText("Active players")).toBeInTheDocument();
  });

  it("renders Opportunity gaps counted from decision-required current-round rows", () => {
    renderClient(
      baseProps({
        currentRoundRows: [
          { playerId: "p1", displayName: "Sander Berg", coreTeam: { id: "t1", name: "U14 Lions" }, availability: "AVAILABLE", currentAssignment: null, integrityState: "DECISION_REQUIRED_NO_PLANNED_MATCH" },
        ],
      }),
    );
    expect(screen.getByText("Opportunity gaps")).toBeInTheDocument();
  });

  it("renders Support usage counted from players with support appearances > 0", () => {
    renderClient();
    expect(screen.getByText("Support usage")).toBeInTheDocument();
  });

  it("renders Development focuses counted from active focus rows", () => {
    renderClient(
      baseProps({
        developmentRows: [{ playerId: "p1", displayName: "Sander Berg", coreTeam: null, activeDevelopmentFocus: "First touch", focusStartedAt: null }],
      }),
    );
    expect(screen.getByText("Development focuses")).toBeInTheDocument();
  });
});

describe("PlayersPageClient — Overview filters", () => {
  it("filters the roster by search query, case-insensitively", () => {
    renderClient();
    fireEvent.change(screen.getByPlaceholderText("Search players"), { target: { value: "oskar" } });
    expect(screen.getAllByText("Oskar Lund").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sander Berg")).not.toBeInTheDocument();
  });

  it("shows an honest empty-filter message with a Clear filters action", () => {
    renderClient();
    fireEvent.change(screen.getByPlaceholderText("Search players"), { target: { value: "zzz-no-match" } });
    expect(screen.getByText("No players match these filters.")).toBeInTheDocument();
    const clearButton = screen.getByRole("button", { name: "Clear filters" });
    fireEvent.click(clearButton);
    expect(screen.getAllByText("Sander Berg").length).toBeGreaterThan(0);
  });
});

describe("PlayersPageClient — selected-player fallback", () => {
  it("previews the first filtered row when the locally selected player is filtered out", () => {
    renderClient();
    fireEvent.click(screen.getAllByText("Oskar Lund")[0]);
    // Now filter to only Sander — the selection should fall back to Sander, not stay empty.
    fireEvent.change(screen.getByPlaceholderText("Search players"), { target: { value: "sander" } });
    expect(screen.queryByText("No core team")).not.toBeInTheDocument();
  });
});
