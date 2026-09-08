import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SeasonOverviewTable } from "../season-overview-table";
import type { PlayerSeasonOverviewRow } from "@/lib/players/get-players-overview";

function row(overrides: Partial<PlayerSeasonOverviewRow> = {}): PlayerSeasonOverviewRow {
  return {
    playerId: "p1",
    displayName: "Alex Kim",
    coreTeam: { id: "t1", name: "Blue" },
    actualAppearances: 7,
    goals: 3,
    assists: 2,
    coreAppearances: 4,
    supportAppearances: 2,
    developmentAppearances: 1,
    matchdayAdditions: 1,
    actualAdditionalAppearances: 0,
    plannedButAbsent: 2,
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

// ResponsiveTable renders both the desktop table and the compact card into the DOM
// (CSS-only switch), so scope card assertions to the compact card-list container.
function compactCard(container: HTMLElement) {
  const list = container.querySelector(".expanded\\:hidden") as HTMLElement;
  return within(list);
}

describe("SeasonOverviewTable — compact card (ADR-0124 §11)", () => {
  it("renders a purpose-built summary: identity, one participation line, role mix — not every column", () => {
    const { container } = render(
      <SeasonOverviewTable rows={[row()]} leagueSeasonLabel="Autumn 2026" teams={[{ id: "t1", name: "Blue" }]} />,
    );
    const card = compactCard(container);
    expect(card.getByRole("link", { name: "Alex Kim" })).toBeTruthy();
    expect(card.getByText("Blue")).toBeTruthy();
    expect(card.getByText(/7 played/)).toBeTruthy();
    expect(card.getByText(/3 G/)).toBeTruthy();
    expect(card.getByText(/2 A/)).toBeTruthy();
    expect(card.getByText("Core 4 · Support 2 · Dev 1")).toBeTruthy();
    expect(card.getByText("+1 matchday · 2 planned absent")).toBeTruthy();
    // Not a column dump: no per-metric uppercase label headers inside the card.
    expect(card.queryByText("Goals")).toBeNull();
    expect(card.queryByText("Development")).toBeNull();
    expect(card.queryByText("Matchday add.")).toBeNull();
  });

  it("omits zero-value role mix and load notes", () => {
    const { container } = render(
      <SeasonOverviewTable
        rows={[row({ goals: 0, assists: 0, supportAppearances: 0, developmentAppearances: 0, matchdayAdditions: 0, plannedButAbsent: 0 })]}
        leagueSeasonLabel="Autumn 2026"
        teams={[{ id: "t1", name: "Blue" }]}
      />,
    );
    const card = compactCard(container);
    expect(card.getByText(/7 played/)).toBeTruthy();
    expect(card.queryByText(/ G$/)).toBeNull();
    expect(card.getByText("Core 4")).toBeTruthy();
    expect(card.queryByText(/Support/)).toBeNull();
    expect(card.queryByText(/matchday/)).toBeNull();
  });
});
