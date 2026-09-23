import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PlannedRotationPanel } from "../planned-rotation-panel";
import { lookupProjectedPosition } from "../planned-rotation-panel";
import type { PlannedScenarioEvaluation } from "@/lib/planned-rotation/scenario-evaluation";
import type { PlannedRotationWithChanges } from "@/lib/planned-rotation/planned-rotation";

/**
 * Production incident: a planned position-only swap between two players recorded each player's
 * *declared* `Player.primaryPosition` instead of their actual current position -- because (a)
 * the "Position out" field was hidden entirely whenever "Position swap" was checked, so the
 * auto-filled (wrong) value could never be corrected, and (b) that auto-fill itself came from
 * `primaryPosition`, not from the plan's own projected state. Both are fixed here.
 */

const { checkPlannedRotationCoverageActionMock, validatePlannedChangesActionMock } = vi.hoisted(() => ({
  checkPlannedRotationCoverageActionMock: vi.fn(),
  validatePlannedChangesActionMock: vi.fn().mockResolvedValue({ success: true, issues: [] }),
}));

vi.mock("@/app/(app)/matches/planned-rotation-actions", () => ({
  createPlannedRotationAction: vi.fn(),
  updatePlannedRotationAction: vi.fn().mockResolvedValue({ success: true, rotation: null }),
  deletePlannedRotationAction: vi.fn(),
  validatePlannedChangesAction: (...args: unknown[]) => validatePlannedChangesActionMock(...args),
  checkPlannedRotationCoverageAction: (...args: unknown[]) => checkPlannedRotationCoverageActionMock(...args),
  generateRotationPlanAction: vi.fn(),
}));

const SQUAD_PLAYERS = [
  // Declared ST, but the projected/actual scenario below has him at DEFENDER -- the exact
  // mismatch that produced the incident.
  { id: "anton", firstName: "Anton", lastName: "BB", primaryPosition: "ST" },
  { id: "ibro", firstName: "Ibro", lastName: "O", primaryPosition: "CB" },
];

const ROTATION: PlannedRotationWithChanges = {
  id: "rotation-1",
  matchId: "match-1",
  teamId: "team-1",
  status: "DRAFT",
  notes: null,
  changes: [],
};

const SCENARIO: PlannedScenarioEvaluation = {
  intervals: [
    { startSeconds: 0, endSeconds: 3000, players: [{ playerId: "anton", position: "DEFENDER" }] },
  ],
  transitions: [],
  opponentContext: [],
  startingLineupSignals: [],
};

describe("PlannedRotationPanel — position-swap field (production incident regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkPlannedRotationCoverageActionMock.mockResolvedValue({
      success: true,
      hasLineup: true,
      issues: [],
      partnershipEvidence: [],
      scenario: SCENARIO,
    });
  });

  it("shows and auto-fills the out-player's current position from the plan projection, not their declared position, once Position swap is checked", async () => {
    render(<PlannedRotationPanel matchId="match-1" teamId="team-1" rotation={ROTATION} squadPlayers={SQUAD_PLAYERS} />);
    // Wait for the mocked coverage-check promise to actually resolve (and its state updates to
    // land), not just for the mock to have been called — the `useEffect` fires the call
    // synchronously on mount, well before its result is available.
    await waitFor(() => expect(checkPlannedRotationCoverageActionMock).toHaveResolvedTimes(1));

    fireEvent.click(screen.getByText("Add change"));
    fireEvent.click(screen.getByLabelText("Position swap"));

    // Before the fix, this field was hidden entirely once "Position swap" was checked.
    const outPositionLabel = screen.getByText("Current position (out player)");
    expect(outPositionLabel).toBeInTheDocument();

    const outPlayerSelect = screen.getByText("Player out").closest("div")!.querySelector("select") as HTMLSelectElement;
    fireEvent.change(outPlayerSelect, { target: { value: "anton" } });

    // Auto-filled from the plan's projected scenario ("DEFENDER" -- what Anton is actually
    // playing) -- never from his declared `primaryPosition` ("ST"), which was the bug.
    const outPositionSelect = outPositionLabel.closest("div")!.querySelector("select") as HTMLSelectElement;
    expect(outPositionSelect.value).toBe("DEFENDER");
  });
});

describe("lookupProjectedPosition", () => {
  it("returns null with no scenario", () => {
    expect(lookupProjectedPosition(null, "anton", null)).toBeNull();
  });

  it("reads the latest interval's position for a player when no time is given", () => {
    expect(lookupProjectedPosition(SCENARIO, "anton", null)).toBe("DEFENDER");
  });

  it("returns null for a player not on the pitch in the matching interval", () => {
    expect(lookupProjectedPosition(SCENARIO, "ibro", null)).toBeNull();
  });

  it("picks the interval containing the given time, not always the last one", () => {
    const twoIntervals: PlannedScenarioEvaluation = {
      ...SCENARIO,
      intervals: [
        { startSeconds: 0, endSeconds: 600, players: [{ playerId: "anton", position: "DEFENDER" }] },
        { startSeconds: 600, endSeconds: 3000, players: [{ playerId: "anton", position: "ST" }] },
      ],
    };
    expect(lookupProjectedPosition(twoIntervals, "anton", 300)).toBe("DEFENDER");
    expect(lookupProjectedPosition(twoIntervals, "anton", 900)).toBe("ST");
  });
});
