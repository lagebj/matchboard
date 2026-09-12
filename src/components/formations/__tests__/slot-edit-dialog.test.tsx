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

/**
 * Touchline Design Atlas (ADR-0136 Phase 7, `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md
 * §A`): the golden's "selected slot details" panel names four facts -- role type (the select
 * itself), exact derived target role, lane, and the automatic-planning eligibility meaning.
 * The previous single-sentence text ("Automatic planning targets CB (Centre).") omitted the
 * eligibility-tier requirement entirely; these tests lock in the split, still ADR-0129 §4
 * derived facts.
 */
describe("SlotEditDialog — derived exact role (ADR-0129 §4)", () => {
  it("shows the exact automatic target role for a lane-resolved slot", () => {
    renderDialog({ roleType: "DEFENDER", gridX: 2 });
    expect(screen.getByText("Exact derived target role: CB")).toBeInTheDocument();
  });

  it("resolves a left-lane defender to LB", () => {
    renderDialog({ roleType: "DEFENDER", gridX: 0 });
    expect(screen.getByText("Exact derived target role: LB")).toBeInTheDocument();
  });

  it("shows the lane alongside the exact target role", () => {
    renderDialog({ roleType: "DEFENDER", gridX: 2 });
    expect(screen.getByText(/^Lane:/)).toBeInTheDocument();
  });

  it("shows the automatic-planning eligibility meaning for a lane-resolved slot", () => {
    renderDialog({ roleType: "DEFENDER", gridX: 2 });
    expect(
      screen.getByText("A player needs Natural, Strong, or Plausible fit for automatic assignment to this role."),
    ).toBeInTheDocument();
  });

  it("shows 'Manual-only for automatic planning' for a FREE slot, with no eligibility-meaning text", () => {
    renderDialog({ roleType: "FREE", gridX: 2 });
    expect(screen.getByText("Manual-only for automatic planning")).toBeInTheDocument();
    expect(screen.queryByText(/Exact derived target role/)).not.toBeInTheDocument();
  });
});
