import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PlannedRotationPanel } from "../planned-rotation-panel";
import type { PlannedRotationWithChanges } from "@/lib/planned-rotation/planned-rotation";

/**
 * Coach feedback: "we do not need second granularity here, minutes is much cleaner and more
 * intuitive... right now I need to manually calculate which second the 17th minute of the match
 * is." The "Approx. time" field took raw seconds; this proves the field now takes whole minutes
 * (as displayed and entered) while `PlannedRotationChangeData.approximateMatchSeconds` — the
 * persisted unit everything else (`scenario` projection, validation, display `formatSeconds`)
 * already depends on — is unchanged, converted only at the form's two boundaries.
 */

const { updatePlannedRotationActionMock, checkPlannedRotationCoverageActionMock } = vi.hoisted(() => ({
  updatePlannedRotationActionMock: vi.fn(),
  checkPlannedRotationCoverageActionMock: vi.fn().mockResolvedValue({
    success: true,
    hasLineup: false,
    issues: [],
    partnershipEvidence: [],
    scenario: null,
  }),
}));

vi.mock("@/app/(app)/matches/planned-rotation-actions", () => ({
  createPlannedRotationAction: vi.fn(),
  updatePlannedRotationAction: (...args: unknown[]) => updatePlannedRotationActionMock(...args),
  deletePlannedRotationAction: vi.fn(),
  validatePlannedChangesAction: vi.fn().mockResolvedValue({ success: true, issues: [] }),
  checkPlannedRotationCoverageAction: (...args: unknown[]) => checkPlannedRotationCoverageActionMock(...args),
  generateRotationPlanAction: vi.fn(),
}));

const SQUAD_PLAYERS = [{ id: "anton", firstName: "Anton", lastName: "BB", primaryPosition: "ST" }];

const ROTATION: PlannedRotationWithChanges = {
  id: "rotation-1",
  matchId: "match-1",
  teamId: "team-1",
  status: "DRAFT",
  notes: null,
  changes: [
    {
      id: "change-1",
      sequence: 1,
      outPlayerId: null,
      inPlayerId: "anton",
      outPosition: null,
      inPosition: "ST",
      positionOnly: false,
      approximateMatchSeconds: 1500, // the 25th minute, persisted in seconds
      status: "PENDING",
      notes: null,
      outPlayerFirstName: null,
      outPlayerLastName: null,
      inPlayerFirstName: "Anton",
      inPlayerLastName: "BB",
    },
  ],
};

describe("PlannedRotationPanel — Approx. time takes minutes, not seconds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePlannedRotationActionMock.mockResolvedValue({ success: true, rotation: ROTATION });
  });

  it("displays a saved change's persisted seconds as whole minutes when editing", async () => {
    render(<PlannedRotationPanel matchId="match-1" teamId="team-1" rotation={ROTATION} squadPlayers={SQUAD_PLAYERS} />);
    await waitFor(() => expect(checkPlannedRotationCoverageActionMock).toHaveResolvedTimes(1));

    fireEvent.click(screen.getByLabelText("Edit change"));

    const minuteInput = screen.getByPlaceholderText("e.g. 25") as HTMLInputElement;
    expect(minuteInput.value).toBe("25"); // 1500s / 60 = 25 min, not "1500"
  });

  it("saves a coach-entered minute as the equivalent seconds", async () => {
    render(<PlannedRotationPanel matchId="match-1" teamId="team-1" rotation={ROTATION} squadPlayers={SQUAD_PLAYERS} />);
    await waitFor(() => expect(checkPlannedRotationCoverageActionMock).toHaveResolvedTimes(1));

    fireEvent.click(screen.getByLabelText("Edit change"));
    const minuteInput = screen.getByPlaceholderText("e.g. 25") as HTMLInputElement;
    fireEvent.change(minuteInput, { target: { value: "17" } });
    fireEvent.click(screen.getByText("Save change"));

    await waitFor(() => expect(updatePlannedRotationActionMock).toHaveBeenCalledTimes(1));
    const [, input] = updatePlannedRotationActionMock.mock.calls[0] as [string, { changes: { approximateMatchSeconds: number | null }[] }];
    expect(input.changes[0]?.approximateMatchSeconds).toBe(1020); // 17 * 60, not 17
  });
});
