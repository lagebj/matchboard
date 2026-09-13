import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TouchlinePlanningPitch } from "../touchline-planning-pitch";
import { gridToNormalizedPoint } from "../projection";
import type { PlanningPitchSlot } from "../touchline-planning-pitch";

/**
 * Atlas Follow-up Phase F7 (production pitch migration,
 * `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`): coverage for `editableGrid`, the Formations
 * editor's "click an empty grid cell to add a slot here" capability. Additive and optional —
 * every other caller (Lineup, Tactics, event planning) never passes it, so these tests also
 * prove its absence changes nothing about the existing slot-rendering behaviour.
 */
describe("TouchlinePlanningPitch — editableGrid", () => {
  it("renders no addable grid cells when editableGrid is not provided", () => {
    render(<TouchlinePlanningPitch slots={[]} assignments={[]} />);
    expect(screen.queryByRole("button", { name: /add a slot here/i })).not.toBeInTheDocument();
  });

  it("renders an addable cell for every grid position not covered by an existing slot", () => {
    const slots: PlanningPitchSlot[] = [
      { id: "gk", point: gridToNormalizedPoint(2, 5), roleLabel: "GK", isGoalkeeper: true },
    ];
    render(
      <TouchlinePlanningPitch
        slots={slots}
        assignments={[]}
        editableGrid={{ width: 5, height: 6, canAddMore: true, onAddSlot: vi.fn() }}
      />,
    );
    // 5 x 6 grid minus the one already-occupied cell = 29 addable targets.
    expect(screen.getAllByRole("button", { name: /add a slot here/i })).toHaveLength(29);
  });

  it("does not render an addable cell at a position an existing slot already occupies", () => {
    const slots: PlanningPitchSlot[] = [
      { id: "gk", point: gridToNormalizedPoint(2, 5), roleLabel: "GK", isGoalkeeper: true },
    ];
    render(
      <TouchlinePlanningPitch
        slots={slots}
        assignments={[]}
        editableGrid={{ width: 5, height: 6, canAddMore: true, onAddSlot: vi.fn() }}
      />,
    );
    // The occupied cell renders as the slot's own empty-slot control ("GK"), not a duplicate "+" target.
    expect(screen.getByLabelText(/empty slot: gk/i)).toBeInTheDocument();
  });

  it("calls onAddSlot with the clicked cell's grid coordinates", async () => {
    const onAddSlot = vi.fn();
    const user = userEvent.setup();
    render(
      <TouchlinePlanningPitch
        slots={[]}
        assignments={[]}
        editableGrid={{ width: 1, height: 1, canAddMore: true, onAddSlot }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /add a slot here/i }));
    expect(onAddSlot).toHaveBeenCalledWith(0, 0);
  });

  it("renders addable cells as non-interactive when canAddMore is false", () => {
    render(
      <TouchlinePlanningPitch
        slots={[]}
        assignments={[]}
        editableGrid={{ width: 1, height: 1, canAddMore: false, onAddSlot: vi.fn() }}
      />,
    );
    expect(screen.queryByRole("button", { name: /add a slot here/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/empty grid position/i)).toBeInTheDocument();
  });

  it("renders addable cells as non-interactive when the pitch itself is readOnly", () => {
    const onAddSlot = vi.fn();
    render(
      <TouchlinePlanningPitch
        slots={[]}
        assignments={[]}
        readOnly
        editableGrid={{ width: 1, height: 1, canAddMore: true, onAddSlot }}
      />,
    );
    expect(screen.queryByRole("button", { name: /add a slot here/i })).not.toBeInTheDocument();
  });
});
