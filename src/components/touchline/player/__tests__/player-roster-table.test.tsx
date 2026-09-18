import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayerRosterTable } from "../player-roster-table";
import type { PlayersOverviewRow } from "@/lib/touchline/presentation/players-overview-view-model";

/**
 * Matchboard Players Operating Surface bundle: the roster row must never leak a raw legacy
 * position identifier, and row selection must be keyboard-operable, not just clickable
 * (`05_INTERACTION_FILTER_AND_RESPONSIVE_CONTRACT.md §9`).
 */
function makeRow(overrides: Partial<PlayersOverviewRow> = {}): PlayersOverviewRow {
  return {
    playerId: "p1",
    displayName: "Sander Berg",
    shirtNumber: 7,
    kitColor: null,
    coreTeamName: "U14 Lions",
    currentPrimaryPositionCode: "DM",
    currentPrimaryPosition: "DM",
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

describe("PlayerRosterTable", () => {
  it("never renders a raw legacy position identifier", () => {
    render(
      <PlayerRosterTable
        rows={[makeRow({ currentPrimaryPositionCode: "DM", currentPrimaryPosition: "DM" })]}
        selectedPlayerId={null}
        onSelectPlayer={vi.fn()}
      />,
    );
    expect(screen.queryByText("DEFENSIVE_MIDFIELDER")).not.toBeInTheDocument();
    expect(screen.getByText("DM")).toBeInTheDocument();
  });

  it("renders a broad declared position as its human broad label", () => {
    render(
      <PlayerRosterTable
        rows={[makeRow({ currentPrimaryPositionCode: "DEFENDER", currentPrimaryPosition: "Defender" })]}
        selectedPlayerId={null}
        onSelectPlayer={vi.fn()}
      />,
    );
    expect(screen.getByText("Defender")).toBeInTheDocument();
  });

  it("calls onSelectPlayer when a row is clicked", () => {
    const onSelectPlayer = vi.fn();
    render(<PlayerRosterTable rows={[makeRow()]} selectedPlayerId={null} onSelectPlayer={onSelectPlayer} />);
    fireEvent.click(screen.getByText("Sander Berg"));
    expect(onSelectPlayer).toHaveBeenCalledWith("p1");
  });

  it("selects a row via keyboard (Enter), not just a mouse click", () => {
    const onSelectPlayer = vi.fn();
    render(<PlayerRosterTable rows={[makeRow()]} selectedPlayerId={null} onSelectPlayer={onSelectPlayer} />);
    const row = screen.getByRole("button", { name: /Sander Berg/ });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onSelectPlayer).toHaveBeenCalledWith("p1");
  });

  it("selects a row via keyboard (Space)", () => {
    const onSelectPlayer = vi.fn();
    render(<PlayerRosterTable rows={[makeRow()]} selectedPlayerId={null} onSelectPlayer={onSelectPlayer} />);
    const row = screen.getByRole("button", { name: /Sander Berg/ });
    fireEvent.keyDown(row, { key: " " });
    expect(onSelectPlayer).toHaveBeenCalledWith("p1");
  });

  it("marks the selected row with aria-pressed", () => {
    render(<PlayerRosterTable rows={[makeRow()]} selectedPlayerId="p1" onSelectPlayer={vi.fn()} />);
    const row = screen.getByRole("button", { name: /Sander Berg/ });
    expect(row).toHaveAttribute("aria-pressed", "true");
    // `aria-selected` is invalid on `role="button"` (axe `aria-allowed-attr`) — `aria-pressed`
    // alone is the correct toggle-state signal here.
    expect(row).not.toHaveAttribute("aria-selected");
  });

  it("is keyboard-reachable (tabIndex 0), not a bare unfocusable <tr>", () => {
    render(<PlayerRosterTable rows={[makeRow()]} selectedPlayerId={null} onSelectPlayer={vi.fn()} />);
    const row = screen.getByRole("button", { name: /Sander Berg/ });
    expect(row).toHaveAttribute("tabindex", "0");
  });
});
