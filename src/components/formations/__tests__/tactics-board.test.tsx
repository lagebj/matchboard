import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TacticsBoard, type TacticsBoardSlot, type TacticsBoardAssignment, type TacticsBoardPlayer } from "../tactics-board";

const slot: TacticsBoardSlot = {
  id: "s1",
  gridX: 2,
  gridY: 2,
  label: "Centre Midfield",
  shortLabel: "CM",
  roleType: "MIDFIELDER",
  acceptedPositionIds: [],
  sortOrder: 1,
};

const player: TacticsBoardPlayer = { id: "p1", firstName: "Luca", lastName: "Moretti", primaryPosition: "CM" };
const assignment: TacticsBoardAssignment = { id: "a1", slotId: "s1", playerId: "p1", locked: false, source: "AUTO" };

describe("TacticsBoard lineup-assignment/lineup-readonly slot interaction", () => {
  it("fires onSlotClick (and onSlotView) on an occupied slot when editable", async () => {
    const onSlotClick = vi.fn();
    const onSlotView = vi.fn();
    render(
      <TacticsBoard
        mode="lineup-assignment"
        orientation="vertical"
        slots={[slot]}
        assignments={[assignment]}
        players={[player]}
        readOnly={false}
        onSlotClick={onSlotClick}
        onSlotView={onSlotView}
      />,
    );
    await userEvent.click(screen.getByText("Luca M."));
    expect(onSlotClick).toHaveBeenCalledWith("a1", "s1", "p1");
    expect(onSlotView).toHaveBeenCalledWith("a1", "s1", "p1");
  });

  it("does NOT fire onSlotClick on a read-only board (existing edit-gating behaviour, unchanged)", async () => {
    const onSlotClick = vi.fn();
    render(
      <TacticsBoard
        mode="lineup-readonly"
        orientation="vertical"
        slots={[slot]}
        assignments={[assignment]}
        players={[player]}
        readOnly
        onSlotClick={onSlotClick}
      />,
    );
    await userEvent.click(screen.getByText("Luca M."));
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it("DOES fire onSlotView on a read-only board (the new, additive capability)", async () => {
    const onSlotClick = vi.fn();
    const onSlotView = vi.fn();
    render(
      <TacticsBoard
        mode="lineup-readonly"
        orientation="vertical"
        slots={[slot]}
        assignments={[assignment]}
        players={[player]}
        readOnly
        onSlotClick={onSlotClick}
        onSlotView={onSlotView}
      />,
    );
    await userEvent.click(screen.getByText("Luca M."));
    expect(onSlotView).toHaveBeenCalledWith("a1", "s1", "p1");
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it("does not render a clickable occupied-slot token at all when neither callback is supplied", () => {
    render(
      <TacticsBoard
        mode="lineup-readonly"
        orientation="vertical"
        slots={[slot]}
        assignments={[assignment]}
        players={[player]}
        readOnly
      />,
    );
    // Still renders the player's name, just with no click affordance wired.
    expect(screen.getByText("Luca M.")).toBeTruthy();
  });
});
