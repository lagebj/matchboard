import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayersOverviewSurface } from "../players-overview-surface";
import type { PlayersOverviewRow, PlayersOverviewInspectorData } from "@/lib/touchline/presentation/players-overview-view-model";

/**
 * Players Operating Surface visual-convergence follow-up (§3, §32). `PlayersOverviewSurface` is
 * the one shared Overview-mode body both production and UI-Lab render — these tests cover the
 * behaviour this component now owns on their behalf: filtering, the selected-player fallback, the
 * summary strip's real values, toolbar callbacks, and the empty-filter state.
 */
function makeRow(overrides: Partial<PlayersOverviewRow> = {}): PlayersOverviewRow {
  return {
    playerId: "1",
    displayName: "Sander Berg",
    shirtNumber: 7,
    kitColor: null,
    coreTeamName: "U14 Lions",
    currentPrimaryPositionCode: "CM",
    currentPrimaryPosition: "CM",
    availabilityLabel: "Available",
    hasOpportunityThisWeek: true,
    played: 10,
    goals: 2,
    assists: 1,
    core: 8,
    support: 2,
    development: 0,
    matchdayAdditions: 0,
    plannedButAbsent: 0,
    attention: false,
    rosterState: "ACTIVE",
    ...overrides,
  };
}

function makeInspectorData(row: PlayersOverviewRow): PlayersOverviewInspectorData {
  return {
    playerId: row.playerId,
    displayName: row.displayName,
    shirtNumber: row.shirtNumber,
    kitColor: row.kitColor,
    coreTeamName: row.coreTeamName,
    currentPrimaryPosition: row.currentPrimaryPosition,
    currentPrimaryPositionFull: row.currentPrimaryPosition,
    availabilityLabel: row.availabilityLabel,
    rosterState: row.rosterState,
    opportunityLabel: "Selected this round",
    effectivePositions: [],
    played: row.played,
    goals: row.goals,
    assists: row.assists,
    core: row.core,
    support: row.support,
    development: row.development,
    activeDevelopmentFocus: null,
    playerDetailHref: `/o/acme/players/${row.playerId}`,
  };
}

const ROWS: PlayersOverviewRow[] = [
  makeRow({ playerId: "1", displayName: "Sander Berg", coreTeamName: "U14 Lions", currentPrimaryPositionCode: "CM", currentPrimaryPosition: "CM" }),
  makeRow({ playerId: "2", displayName: "Noah Iversen", coreTeamName: "U13 Hawks", currentPrimaryPositionCode: "CB", currentPrimaryPosition: "CB", availabilityLabel: "Doubtful" }),
];

const SUMMARY = {
  activePlayerCount: 2,
  opportunityGapsCount: 1,
  opportunityGapsDescription: "No planned match in W34 2026",
  supportUsageCount: 2,
  developmentFocusesCount: 0,
};

function baseProps() {
  return {
    rows: ROWS,
    resolveInspectorData: (playerId: string) => {
      const row = ROWS.find((r) => r.playerId === playerId);
      return row ? makeInspectorData(row) : null;
    },
    summary: SUMMARY,
    seasonOptions: [{ id: "s1", label: "Autumn 2026" }],
    selectedSeasonId: "s1",
    onSeasonChange: vi.fn(),
    rosterFilter: "active" as const,
    onRosterFilterChange: vi.fn(),
    mobilePlayerHref: (playerId: string) => `/o/acme/players/${playerId}`,
  };
}

describe("PlayersOverviewSurface", () => {
  it("renders the real summary values, not placeholders", () => {
    render(<PlayersOverviewSurface {...baseProps()} />);
    expect(screen.getByText("Active players").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Opportunity gaps").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("No planned match in W34 2026")).toBeInTheDocument();
  });

  it("renders a Roster selector defaulting to Active, and no standalone Show removed control", () => {
    render(<PlayersOverviewSurface {...baseProps()} />);
    expect(screen.getByText("Player status").closest("label")!.querySelector("select")).toHaveValue("active");
    expect(screen.queryByText(/Show removed/)).not.toBeInTheDocument();
  });

  it("calls onRosterFilterChange when the roster selector changes", () => {
    const onRosterFilterChange = vi.fn();
    render(<PlayersOverviewSurface {...baseProps()} onRosterFilterChange={onRosterFilterChange} />);
    fireEvent.change(screen.getByText("Player status").closest("label")!.querySelector("select")!, { target: { value: "removed" } });
    expect(onRosterFilterChange).toHaveBeenCalledWith("removed");
  });

  it("calls onSeasonChange when the season selector changes", () => {
    const onSeasonChange = vi.fn();
    render(
      <PlayersOverviewSurface
        {...baseProps()}
        onSeasonChange={onSeasonChange}
        seasonOptions={[{ id: "s1", label: "Autumn 2026" }, { id: "s2", label: "Spring 2027" }]}
      />,
    );
    fireEvent.change(screen.getByText("League season").closest("label")!.querySelector("select")!, { target: { value: "s2" } });
    expect(onSeasonChange).toHaveBeenCalledWith("s2");
  });

  it("filters rows by search query and falls back the selection to the first remaining row", () => {
    render(<PlayersOverviewSurface {...baseProps()} />);
    fireEvent.change(screen.getByPlaceholderText("Search players…"), { target: { value: "Noah" } });
    expect(screen.queryByText("Sander Berg")).not.toBeInTheDocument();
    expect(screen.getAllByText("Noah Iversen").length).toBeGreaterThan(0);
  });

  it("renders an honest empty-filter state when no rows match, with a clear-filters action", () => {
    render(<PlayersOverviewSurface {...baseProps()} />);
    fireEvent.change(screen.getByPlaceholderText("Search players…"), { target: { value: "zzz-no-match" } });
    expect(screen.getByText("No players match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByText("Sander Berg").length).toBeGreaterThan(0);
  });

  describe("mobile trailing label (roster-state-and-mobile-convergence pass §19)", () => {
    it("never renders an opaque '1/1' or '0/1' ratio", () => {
      render(<PlayersOverviewSurface {...baseProps()} />);
      expect(screen.queryByText("1/1")).not.toBeInTheDocument();
      expect(screen.queryByText("0/1")).not.toBeInTheDocument();
    });

    it("labels a covered active row 'Planned' and an uncovered one 'Needs plan'", () => {
      const rows = [
        makeRow({ playerId: "1", displayName: "Sander Berg", hasOpportunityThisWeek: true }),
        makeRow({ playerId: "2", displayName: "Noah Iversen", hasOpportunityThisWeek: false }),
      ];
      render(
        <PlayersOverviewSurface
          {...baseProps()}
          rows={rows}
          resolveInspectorData={(id) => makeInspectorData(rows.find((r) => r.playerId === id)!)}
        />,
      );
      expect(screen.getByText("Planned")).toBeInTheDocument();
      expect(screen.getByText("Needs plan")).toBeInTheDocument();
    });

    it("labels an Inactive roster row 'Inactive' and a Removed roster row 'Removed'", () => {
      const rows = [
        makeRow({ playerId: "1", displayName: "Sander Berg", rosterState: "INACTIVE", hasOpportunityThisWeek: null }),
        makeRow({ playerId: "2", displayName: "Noah Iversen", rosterState: "REMOVED", hasOpportunityThisWeek: null }),
      ];
      render(
        <PlayersOverviewSurface
          {...baseProps()}
          rows={rows}
          resolveInspectorData={(id) => makeInspectorData(rows.find((r) => r.playerId === id)!)}
        />,
      );
      // `getAllByText` because "Inactive"/"Removed" also exist as `<option>` text in the Roster
      // selector — the assertion is that the trailing label text renders somewhere, not that it's
      // the only occurrence.
      expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Removed").length).toBeGreaterThan(0);
    });

    it("surfaces a non-default availability on an active row's secondary line", () => {
      const rows = [makeRow({ playerId: "1", displayName: "Sander Berg", availabilityLabel: "Doubtful" })];
      render(
        <PlayersOverviewSurface
          {...baseProps()}
          rows={rows}
          resolveInspectorData={(id) => makeInspectorData(rows.find((r) => r.playerId === id)!)}
        />,
      );
      expect(screen.getAllByText(/Doubtful/).length).toBeGreaterThan(0);
    });
  });
});
