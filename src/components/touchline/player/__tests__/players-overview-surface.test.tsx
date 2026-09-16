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
    removedPlayerCount: 3,
    includeRemoved: false,
    onToggleRemoved: vi.fn(),
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

  it("shows the real removed-player count in the toggle pill", () => {
    render(<PlayersOverviewSurface {...baseProps()} />);
    expect(screen.getByRole("button", { name: "Show removed (3)" })).toBeInTheDocument();
  });

  it("calls onToggleRemoved when the pill is activated", () => {
    const onToggleRemoved = vi.fn();
    render(<PlayersOverviewSurface {...baseProps()} onToggleRemoved={onToggleRemoved} />);
    fireEvent.click(screen.getByRole("button", { name: "Show removed (3)" }));
    expect(onToggleRemoved).toHaveBeenCalledTimes(1);
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

  it("does not render the removed-player pill when the count is zero", () => {
    render(<PlayersOverviewSurface {...baseProps()} removedPlayerCount={0} />);
    expect(screen.queryByText(/Show removed/)).not.toBeInTheDocument();
  });
});
