import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { SlotEditDialog } from "../pitch-formation";

const baseSlot: {
  id: string;
  gridX: number;
  gridY: number;
  label: string;
  shortLabel: string;
  roleType: FormationSlotRoleType;
  acceptedPositionIds: BroadPosition[];
  sortOrder: number;
} = {
  id: "slot-1",
  gridX: 2, // CENTRE lane
  gridY: 1,
  label: "Centre Back",
  shortLabel: "CB",
  roleType: "DEFENDER",
  acceptedPositionIds: ["defender"],
  sortOrder: 0,
};

function renderDialog(slot: Partial<typeof baseSlot>) {
  return render(
    <SlotEditDialog
      isOpen
      onClose={vi.fn()}
      slot={{ ...baseSlot, ...slot }}
      gameFormat="SEVEN_A_SIDE"
      onSave={vi.fn()}
      onRemove={vi.fn()}
    />,
  );
}

describe("SlotEditDialog — derived exact role (ADR-0129 §4)", () => {
  it("shows the exact automatic target role for a lane-resolved slot", () => {
    renderDialog({ roleType: "DEFENDER", gridX: 2 });
    expect(screen.getByText(/Automatic planning targets CB/)).toBeInTheDocument();
  });

  it("resolves a left-lane defender to LB", () => {
    renderDialog({ roleType: "DEFENDER", gridX: 0 });
    expect(screen.getByText(/Automatic planning targets LB/)).toBeInTheDocument();
  });

  it("shows 'Manual-only for automatic planning' for a FREE slot", () => {
    renderDialog({ roleType: "FREE", gridX: 2 });
    expect(screen.getByText("Manual-only for automatic planning")).toBeInTheDocument();
  });
});
