import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PlannedRotationPanel } from "../planned-rotation-panel";
import { lookupProjectedPosition, lookupOnFieldPlayerIds, formatPlayerOptionLabel } from "../planned-rotation-panel";
import type { PlannedScenarioEvaluation } from "@/lib/planned-rotation/scenario-evaluation";
import type { PlannedRotationWithChanges } from "@/lib/planned-rotation/planned-rotation";

/**
 * Production incident: a planned position-only swap between two players recorded each player's
 * *declared* `Player.primaryPosition` instead of their actual current position -- because (a)
 * the "Position out" field was hidden entirely whenever "Position swap" was checked, so the
 * auto-filled (wrong) value could never be corrected, and (b) that auto-fill itself came from
 * `primaryPosition`, not from the plan's own projected state.
 *
 * Issue #674 (2026-09-24): the "Position out"/"Position in" fields were then removed from the
 * form entirely, for both a position swap and a plain rotation -- the coach only ever picks
 * players, never a position code; the system derives the position from the plan projection
 * itself. The auto-fill computation this test originally proved (projected, not declared,
 * position) still has to happen -- just internally now, submitted with the saved change rather
 * than shown in a field the coach could read or override. This also proves "Player out"/"Player
 * in" are scoped to who is genuinely on the field/bench at the change's planned minute, and that
 * a swap only ever offers on-field players for both sides.
 */

const { checkPlannedRotationCoverageActionMock, validatePlannedChangesActionMock, updatePlannedRotationActionMock } = vi.hoisted(() => ({
  checkPlannedRotationCoverageActionMock: vi.fn(),
  validatePlannedChangesActionMock: vi.fn().mockResolvedValue({ success: true, issues: [] }),
  updatePlannedRotationActionMock: vi.fn().mockResolvedValue({ success: true, rotation: null }),
}));

vi.mock("@/app/(app)/matches/planned-rotation-actions", () => ({
  createPlannedRotationAction: vi.fn(),
  updatePlannedRotationAction: (...args: unknown[]) => updatePlannedRotationActionMock(...args),
  deletePlannedRotationAction: vi.fn(),
  validatePlannedChangesAction: (...args: unknown[]) => validatePlannedChangesActionMock(...args),
  checkPlannedRotationCoverageAction: (...args: unknown[]) => checkPlannedRotationCoverageActionMock(...args),
  generateRotationPlanAction: vi.fn(),
}));

const SQUAD_PLAYERS = [
  // Declared ST, but the projected/actual scenario below has him at DEFENDER -- the exact
  // mismatch that produced the incident.
  { id: "anton", firstName: "Anton", lastName: "BB", primaryPosition: "ST" },
  // Declared CB, but projected at MIDFIELDER -- same mismatch, other side of the swap.
  { id: "ibro", firstName: "Ibro", lastName: "O", primaryPosition: "CB" },
  // Never on the pitch in the scenario below -- stays on the bench throughout.
  { id: "sindre", firstName: "Sindre", lastName: "K", primaryPosition: "GK" },
];

const ROTATION: PlannedRotationWithChanges = {
  id: "rotation-1",
  matchId: "match-1",
  teamId: "team-1",
  status: "DRAFT",
  notes: null,
  changes: [],
};

// Both anton and ibro are on the pitch throughout -- a valid pair for a position swap. sindre is
// never in `players`, i.e. on the bench.
const SCENARIO: PlannedScenarioEvaluation = {
  intervals: [
    {
      startSeconds: 0,
      endSeconds: 3000,
      players: [
        { playerId: "anton", position: "DEFENDER" },
        { playerId: "ibro", position: "MIDFIELDER" },
      ],
    },
  ],
  transitions: [],
  opponentContext: [],
  startingLineupSignals: [],
};

describe("PlannedRotationPanel — position-swap change (production incident regression)", () => {
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

  it("never shows a position field to the coach (issue #674)", async () => {
    render(<PlannedRotationPanel matchId="match-1" teamId="team-1" rotation={ROTATION} squadPlayers={SQUAD_PLAYERS} />);
    await waitFor(() => expect(checkPlannedRotationCoverageActionMock).toHaveResolvedTimes(1));

    fireEvent.click(screen.getByText("Add change"));
    fireEvent.click(screen.getByLabelText("Position swap"));

    expect(screen.queryByText(/Current position/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Position out")).not.toBeInTheDocument();
    expect(screen.queryByText("Position in")).not.toBeInTheDocument();
  });

  it("scopes both sides of a position swap to on-field players only", async () => {
    render(<PlannedRotationPanel matchId="match-1" teamId="team-1" rotation={ROTATION} squadPlayers={SQUAD_PLAYERS} />);
    await waitFor(() => expect(checkPlannedRotationCoverageActionMock).toHaveResolvedTimes(1));

    fireEvent.click(screen.getByText("Add change"));
    fireEvent.click(screen.getByLabelText("Position swap"));

    const outPlayerSelect = screen.getByText("Player out").closest("div")!.querySelector("select") as HTMLSelectElement;
    const inPlayerSelect = screen.getByText("Player in").closest("div")!.querySelector("select") as HTMLSelectElement;

    // sindre is on the bench in the scenario, so a swap (both sides must already be on the pitch)
    // never offers him on either side.
    const outOptionIds = Array.from(outPlayerSelect.options).map((o) => o.value);
    const inOptionIds = Array.from(inPlayerSelect.options).map((o) => o.value);
    expect(outOptionIds).toEqual(expect.arrayContaining(["anton", "ibro"]));
    expect(outOptionIds).not.toContain("sindre");
    expect(inOptionIds).toEqual(expect.arrayContaining(["anton", "ibro"]));
    expect(inOptionIds).not.toContain("sindre");
  });

  it("auto-fills each swapped player's position from the plan projection, not their declared position, and submits it without ever displaying it", async () => {
    render(<PlannedRotationPanel matchId="match-1" teamId="team-1" rotation={ROTATION} squadPlayers={SQUAD_PLAYERS} />);
    await waitFor(() => expect(checkPlannedRotationCoverageActionMock).toHaveResolvedTimes(1));

    fireEvent.click(screen.getByText("Add change"));
    fireEvent.click(screen.getByLabelText("Position swap"));

    const outPlayerSelect = screen.getByText("Player out").closest("div")!.querySelector("select") as HTMLSelectElement;
    const inPlayerSelect = screen.getByText("Player in").closest("div")!.querySelector("select") as HTMLSelectElement;
    fireEvent.change(outPlayerSelect, { target: { value: "anton" } });
    fireEvent.change(inPlayerSelect, { target: { value: "ibro" } });

    fireEvent.click(screen.getByText("Add change"));

    await waitFor(() => expect(updatePlannedRotationActionMock).toHaveBeenCalledTimes(1));
    const [, payload] = updatePlannedRotationActionMock.mock.calls[0] as [string, { changes: Array<Record<string, unknown>> }];
    const savedChange = payload.changes[payload.changes.length - 1]!;

    // Auto-filled from the plan's projected scenario ("DEFENDER"/"MIDFIELDER" -- what each is
    // actually playing) -- never from their declared `primaryPosition` ("ST"/"CB"), which was the
    // bug -- even though the coach never saw a field to correct it.
    expect(savedChange).toMatchObject({
      outPlayerId: "anton",
      inPlayerId: "ibro",
      outPosition: "DEFENDER",
      inPosition: "MIDFIELDER",
      positionOnly: true,
    });
  });

  it("scopes a plain rotation's Player out to on-field and Player in to bench players", async () => {
    render(<PlannedRotationPanel matchId="match-1" teamId="team-1" rotation={ROTATION} squadPlayers={SQUAD_PLAYERS} />);
    await waitFor(() => expect(checkPlannedRotationCoverageActionMock).toHaveResolvedTimes(1));

    fireEvent.click(screen.getByText("Add change"));
    // "Position swap" left unchecked -- a plain rotation.

    const outPlayerSelect = screen.getByText("Player out").closest("div")!.querySelector("select") as HTMLSelectElement;
    const inPlayerSelect = screen.getByText("Player in").closest("div")!.querySelector("select") as HTMLSelectElement;

    const outOptionIds = Array.from(outPlayerSelect.options).map((o) => o.value);
    const inOptionIds = Array.from(inPlayerSelect.options).map((o) => o.value);
    expect(outOptionIds).toEqual(expect.arrayContaining(["anton", "ibro"]));
    expect(outOptionIds).not.toContain("sindre");
    expect(inOptionIds).toEqual(["", "sindre"]);
  });

  it("labels each on-field option with the player's current projected position, and bench options with no position at all", async () => {
    render(<PlannedRotationPanel matchId="match-1" teamId="team-1" rotation={ROTATION} squadPlayers={SQUAD_PLAYERS} />);
    await waitFor(() => expect(checkPlannedRotationCoverageActionMock).toHaveResolvedTimes(1));

    fireEvent.click(screen.getByText("Add change"));
    // Plain rotation: "Player out" is on-field (anton/ibro, both projected), "Player in" is bench
    // (sindre, never projected).
    const outPlayerSelect = screen.getByText("Player out").closest("div")!.querySelector("select") as HTMLSelectElement;
    const inPlayerSelect = screen.getByText("Player in").closest("div")!.querySelector("select") as HTMLSelectElement;

    const outLabels = Array.from(outPlayerSelect.options).map((o) => o.text);
    // anton's declared position is ST, but he's projected at DEFENDER -- the option must show
    // the current on-field position, not the declared one.
    expect(outLabels).toContain("Anton BB (DEFENDER)");
    expect(outLabels).not.toContain("Anton BB (ST)");
    expect(outLabels).toContain("Ibro O (MIDFIELDER)");

    const inLabels = Array.from(inPlayerSelect.options).map((o) => o.text);
    // sindre is a bench player -- no parenthetical at all, not even his declared GK.
    expect(inLabels).toContain("Sindre K");
    expect(inLabels).not.toContain("Sindre K (GK)");
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
    expect(lookupProjectedPosition(SCENARIO, "sindre", null)).toBeNull();
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

describe("lookupOnFieldPlayerIds", () => {
  it("returns an empty set with no scenario", () => {
    expect(lookupOnFieldPlayerIds(null, null)).toEqual(new Set());
  });

  it("returns the latest interval's on-pitch players when no time is given", () => {
    expect(lookupOnFieldPlayerIds(SCENARIO, null)).toEqual(new Set(["anton", "ibro"]));
  });

  it("picks the interval containing the given time, not always the last one", () => {
    const twoIntervals: PlannedScenarioEvaluation = {
      ...SCENARIO,
      intervals: [
        { startSeconds: 0, endSeconds: 600, players: [{ playerId: "anton", position: "DEFENDER" }] },
        {
          startSeconds: 600,
          endSeconds: 3000,
          players: [
            { playerId: "anton", position: "ST" },
            { playerId: "ibro", position: "MIDFIELDER" },
          ],
        },
      ],
    };
    expect(lookupOnFieldPlayerIds(twoIntervals, 300)).toEqual(new Set(["anton"]));
    expect(lookupOnFieldPlayerIds(twoIntervals, 900)).toEqual(new Set(["anton", "ibro"]));
  });
});

describe("formatPlayerOptionLabel", () => {
  const anton = { id: "anton", firstName: "Anton", lastName: "BB", primaryPosition: "ST" };
  const sindre = { id: "sindre", firstName: "Sindre", lastName: "K", primaryPosition: "GK" };

  it("shows the player's current on-field position from the plan projection, not their declared position", () => {
    // anton is on the pitch at DEFENDER in SCENARIO, but declares ST.
    expect(formatPlayerOptionLabel(anton, SCENARIO, null)).toBe("Anton BB (DEFENDER)");
  });

  it("shows no parenthetical at all for a player not on the pitch (a sub/bench player)", () => {
    // sindre never appears in SCENARIO's intervals -- on the bench.
    expect(formatPlayerOptionLabel(sindre, SCENARIO, null)).toBe("Sindre K");
  });

  it("shows no parenthetical when there's no plan projection yet at all", () => {
    expect(formatPlayerOptionLabel(anton, null, null)).toBe("Anton BB");
  });
});
