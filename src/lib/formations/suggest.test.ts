import { describe, it, expect } from "vitest";
import {
  suggestFormationForMatch,
  suggestLineupForFormation,
  preserveAssignmentsOnChange,
} from "./suggest";
import type { FormationSlotData, BroadPosition } from "./types";
import type { GameFormat } from "@/generated/prisma/client";

type SuggestionInput = Parameters<typeof suggestFormationForMatch>[0];

function makeSlot(overrides: Partial<FormationSlotData> & { gridX: number; gridY: number; roleType: string; acceptedPositionIds: BroadPosition[] }): FormationSlotData {
  return {
    label: overrides.label ?? `Slot ${overrides.gridX},${overrides.gridY}`,
    shortLabel: overrides.shortLabel ?? `S${overrides.gridX}${overrides.gridY}`,
    sortOrder: overrides.sortOrder ?? 0,
    ...overrides,
  };
}

function make7v7Formation(id: string, name: string, slots: FormationSlotData[]): SuggestionInput["formations"][number] {
  return {
    id,
    name,
    gameFormat: "SEVEN_A_SIDE" as GameFormat,
    source: "SYSTEM",
    teamId: null,
    slots,
  };
}

describe("suggestFormationForMatch", () => {
  const gkSlot: FormationSlotData = makeSlot({
    id: "gk",
    gridX: 2,
    gridY: 5,
    roleType: "GOALKEEPER",
    acceptedPositionIds: ["goalkeeper"],
  });

  const def1: FormationSlotData = makeSlot({
    id: "def1",
    gridX: 1,
    gridY: 4,
    roleType: "DEFENDER",
    acceptedPositionIds: ["defender"],
  });

  const def2: FormationSlotData = makeSlot({
    id: "def2",
    gridX: 3,
    gridY: 4,
    roleType: "DEFENDER",
    acceptedPositionIds: ["defender"],
  });

  const mid1: FormationSlotData = makeSlot({
    id: "mid1",
    gridX: 1,
    gridY: 2,
    roleType: "MIDFIELDER",
    acceptedPositionIds: ["midfielder"],
  });

  const mid2: FormationSlotData = makeSlot({
    id: "mid2",
    gridX: 3,
    gridY: 2,
    roleType: "MIDFIELDER",
    acceptedPositionIds: ["midfielder"],
  });

  const fwd1: FormationSlotData = makeSlot({
    id: "fwd1",
    gridX: 2,
    gridY: 0,
    roleType: "FORWARD",
    acceptedPositionIds: ["forward"],
  });

  const slots7v7 = [gkSlot, def1, def2, mid1, mid2, fwd1];

  it("returns a formation for matching game format", () => {
    const formation = make7v7Formation("f1", "2-2-1 GK", slots7v7);
    const result = suggestFormationForMatch({
      gameFormat: "SEVEN_A_SIDE",
      playerPool: [],
      teamId: "team1",
      formations: [formation],
    });

    expect(result).not.toBeNull();
    expect(result!.formationId).toBe("f1");
    expect(result!.formationName).toBe("2-2-1 GK");
  });

  it("returns null when no formations match game format", () => {
    const formation = make7v7Formation("f1", "7v7", slots7v7);
    const result = suggestFormationForMatch({
      gameFormat: "FIVE_A_SIDE",
      playerPool: [],
      teamId: "team1",
      formations: [formation],
    });

    expect(result).toBeNull();
  });

  it("penalizes formations without a goalkeeper when players lack GK", () => {
    const formation = make7v7Formation("f1", "2-2-1 GK", slots7v7);
    const result = suggestFormationForMatch({
      gameFormat: "SEVEN_A_SIDE",
      playerPool: [
        { id: "p1", primaryPosition: "CM", secondaryPosition: null, coreTeamId: "team1" },
      ],
      teamId: "team1",
      formations: [formation],
    });

    expect(result).not.toBeNull();
    expect(result!.warnings).toContain("No registered goalkeeper found in planned player pool");
  });

  it("bonuses custom formations for the team", () => {
    const systemFormation = make7v7Formation("f1", "System 2-2-1", slots7v7);
    const customFormation: SuggestionInput["formations"][number] = {
      ...make7v7Formation("f2", "Custom 2-2-1", slots7v7),
      source: "CUSTOM",
      teamId: "team1",
    };

    const result = suggestFormationForMatch({
      gameFormat: "SEVEN_A_SIDE",
      playerPool: [],
      teamId: "team1",
      formations: [systemFormation, customFormation],
    });

    expect(result).not.toBeNull();
    expect(result!.formationId).toBe("f2");
  });

  it("bonuses recently used formation", () => {
    const f1 = make7v7Formation("f1", "Formation A", slots7v7);
    const f2 = make7v7Formation("f2", "Formation B", slots7v7);

    const result = suggestFormationForMatch({
      gameFormat: "SEVEN_A_SIDE",
      playerPool: [],
      teamId: "team1",
      recentFormationId: "f2",
      formations: [f1, f2],
    });

    expect(result).not.toBeNull();
    expect(result!.formationId).toBe("f2");
  });

  it("3v3 does not require goalkeeper", () => {
    const slots3v3: FormationSlotData[] = [
      makeSlot({ id: "d", gridX: 2, gridY: 4, roleType: "DEFENDER", acceptedPositionIds: ["defender"] }),
      makeSlot({ id: "m", gridX: 2, gridY: 2, roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"] }),
      makeSlot({ id: "f", gridX: 2, gridY: 0, roleType: "FORWARD", acceptedPositionIds: ["forward"] }),
    ];

    const formation: SuggestionInput["formations"][number] = {
      id: "3v3-simple",
      name: "Simple 3v3",
      gameFormat: "THREE_A_SIDE" as GameFormat,
      source: "SYSTEM",
      teamId: null,
      slots: slots3v3,
    };

    const result = suggestFormationForMatch({
      gameFormat: "THREE_A_SIDE",
      playerPool: [
        { id: "p1", primaryPosition: "CM", secondaryPosition: null, coreTeamId: "team1" },
      ],
      teamId: "team1",
      formations: [formation],
    });

    expect(result).not.toBeNull();
    expect(result!.warnings).not.toContain("No registered goalkeeper found in planned player pool");
  });
});

describe("suggestLineupForFormation", () => {
  const gkSlot: FormationSlotData = makeSlot({
    id: "gk",
    gridX: 2,
    gridY: 5,
    roleType: "GOALKEEPER",
    acceptedPositionIds: ["goalkeeper"],
  });

  const defSlot: FormationSlotData = makeSlot({
    id: "def1",
    gridX: 1,
    gridY: 4,
    roleType: "DEFENDER",
    acceptedPositionIds: ["defender"],
  });

  const midSlot: FormationSlotData = makeSlot({
    id: "mid1",
    gridX: 2,
    gridY: 2,
    roleType: "MIDFIELDER",
    acceptedPositionIds: ["midfielder"],
  });

  it("assigns goalkeeper-compatible player to GK slot", () => {
    const result = suggestLineupForFormation({
      formationSlots: [gkSlot, defSlot, midSlot],
      playerPool: [
        { id: "p1", firstName: "GK", lastName: "Player", primaryPosition: "GK", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p2", firstName: "Def", lastName: "Player", primaryPosition: "CB", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p3", firstName: "Mid", lastName: "Player", primaryPosition: "CM", secondaryPosition: null, coreTeamId: "t1" },
      ],
    });

    const gkAssignment = result.assignments.find((a) => a.slotId === "gk");
    expect(gkAssignment).toBeDefined();
    expect(gkAssignment!.playerId).toBe("p1");
    expect(gkAssignment!.confidence).toBe("high");
  });

  it("places unassigned players on bench", () => {
    const result = suggestLineupForFormation({
      formationSlots: [gkSlot, defSlot, midSlot],
      playerPool: [
        { id: "p1", firstName: "GK", lastName: "P", primaryPosition: "GK", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p2", firstName: "Def", lastName: "P", primaryPosition: "CB", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p3", firstName: "Mid", lastName: "P", primaryPosition: "CM", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p4", firstName: "Extra", lastName: "P", primaryPosition: "ST", secondaryPosition: null, coreTeamId: "t1" },
      ],
    });

    expect(result.benchPlayerIds).toContain("p4");
  });

  it("respects locked assignments", () => {
    const result = suggestLineupForFormation({
      formationSlots: [gkSlot, defSlot, midSlot],
      playerPool: [
        { id: "p1", firstName: "GK", lastName: "P", primaryPosition: "GK", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p2", firstName: "Def", lastName: "P", primaryPosition: "CB", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p3", firstName: "Mid", lastName: "P", primaryPosition: "CM", secondaryPosition: null, coreTeamId: "t1" },
      ],
      existingAssignments: [
        { slotId: "def1", playerId: "p1", locked: true },
      ],
    });

    const lockedAssignment = result.assignments.find((a) => a.slotId === "def1");
    expect(lockedAssignment).toBeDefined();
    expect(lockedAssignment!.playerId).toBe("p1");
    expect(lockedAssignment!.locked).toBe(true);
  });

  it("does not assign locked player to another slot", () => {
    const result = suggestLineupForFormation({
      formationSlots: [gkSlot, defSlot, midSlot],
      playerPool: [
        { id: "p1", firstName: "GK", lastName: "P", primaryPosition: "GK", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p2", firstName: "Def", lastName: "P", primaryPosition: "CB", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p3", firstName: "Mid", lastName: "P", primaryPosition: "CM", secondaryPosition: null, coreTeamId: "t1" },
      ],
      existingAssignments: [
        { slotId: "def1", playerId: "p1", locked: true },
      ],
    });

    const lockedAssignment = result.assignments.find((a) => a.slotId === "def1");
    expect(lockedAssignment).toBeDefined();
    expect(lockedAssignment!.playerId).toBe("p1");
    expect(lockedAssignment!.locked).toBe(true);

    const gkAssignment = result.assignments.find((a) => a.slotId === "gk" && !a.locked);
    expect(gkAssignment).toBeUndefined();
    expect(result.unfilledSlotIds).toContain("gk");
  });

  it("reports unfilled slots when not enough players", () => {
    const result = suggestLineupForFormation({
      formationSlots: [gkSlot, defSlot, midSlot],
      playerPool: [],
    });

    expect(result.unfilledSlotIds).toHaveLength(3);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("scores primary position higher than secondary", () => {
    const result = suggestLineupForFormation({
      formationSlots: [defSlot],
      playerPool: [
        { id: "p1", firstName: "Primary", lastName: "CB", primaryPosition: "CB", secondaryPosition: null, coreTeamId: "t1" },
        { id: "p2", firstName: "Secondary", lastName: "CM", primaryPosition: "CM", secondaryPosition: "CB", coreTeamId: "t1" },
      ],
    });

    const assignment = result.assignments.find((a) => a.slotId === "def1");
    expect(assignment!.playerId).toBe("p1");
    expect(assignment!.confidence).toBe("high");
  });
});

describe("preserveAssignmentsOnChange", () => {
  const gkSlot: FormationSlotData = makeSlot({
    id: "gk",
    gridX: 2,
    gridY: 5,
    roleType: "GOALKEEPER",
    acceptedPositionIds: ["goalkeeper"],
  });

  const defSlot: FormationSlotData = makeSlot({
    id: "def1",
    gridX: 1,
    gridY: 4,
    roleType: "DEFENDER",
    acceptedPositionIds: ["defender"],
  });

  it("preserves assignment by matching slot ID", () => {
    const result = preserveAssignmentsOnChange(
      [gkSlot, defSlot],
      [{ ...gkSlot, id: "gk" }, defSlot],
      [{ slotId: "gk", playerId: "p1", locked: true }],
    );

    expect(result).toHaveLength(1);
    expect(result[0].preserved).toBe(true);
    expect(result[0].playerId).toBe("p1");
  });

  it("preserves assignment by coordinate and role type", () => {
    const newGkSlot: FormationSlotData = makeSlot({
      id: "new-gk",
      gridX: 2,
      gridY: 5,
      roleType: "GOALKEEPER",
      acceptedPositionIds: ["goalkeeper"],
    });

    const result = preserveAssignmentsOnChange(
      [gkSlot],
      [newGkSlot],
      [{ slotId: "gk", playerId: "p1", locked: true }],
    );

    expect(result[0].preserved).toBe(true);
    expect(result[0].newSlotId).toBe("new-gk");
  });

  it("marks assignment as not preserved when no match found", () => {
    const fwdSlot: FormationSlotData = makeSlot({
      id: "fwd1",
      gridX: 2,
      gridY: 0,
      roleType: "FORWARD",
      acceptedPositionIds: ["forward"],
    });

    const newSlots = [gkSlot, defSlot];

    const result = preserveAssignmentsOnChange(
      [fwdSlot],
      newSlots,
      [{ slotId: "fwd1", playerId: "p1", locked: true }],
    );

    expect(result[0].preserved).toBe(false);
  });

  it("falls back to a same-roleType slot at a different coordinate when no ID/coordinate match exists", () => {
    const oldDef: FormationSlotData = makeSlot({
      id: "old-def",
      gridX: 0,
      gridY: 3,
      roleType: "DEFENDER",
      acceptedPositionIds: ["defender"],
    });
    const newDef: FormationSlotData = makeSlot({
      id: "new-def",
      gridX: 3,
      gridY: 3,
      roleType: "DEFENDER",
      acceptedPositionIds: ["defender"],
    });

    const result = preserveAssignmentsOnChange(
      [oldDef],
      [newDef],
      [{ slotId: "old-def", playerId: "p1", locked: false }],
    );

    expect(result[0].preserved).toBe(true);
    expect(result[0].newSlotId).toBe("new-def");
  });

  it("never maps two different old assignments onto the same new slot via the role-match fallback", () => {
    const oldDef1: FormationSlotData = makeSlot({
      id: "old-def-1", gridX: 0, gridY: 3, roleType: "DEFENDER", acceptedPositionIds: ["defender"],
    });
    const oldDef2: FormationSlotData = makeSlot({
      id: "old-def-2", gridX: 4, gridY: 3, roleType: "DEFENDER", acceptedPositionIds: ["defender"],
    });
    // Only one DEFENDER slot exists in the new formation, at neither old coordinate.
    const newDef: FormationSlotData = makeSlot({
      id: "new-def", gridX: 2, gridY: 3, roleType: "DEFENDER", acceptedPositionIds: ["defender"],
    });

    const result = preserveAssignmentsOnChange(
      [oldDef1, oldDef2],
      [newDef],
      [
        { slotId: "old-def-1", playerId: "p1", locked: false },
        { slotId: "old-def-2", playerId: "p2", locked: false },
      ],
    );

    const preservedResults = result.filter((r) => r.preserved);
    expect(preservedResults).toHaveLength(1);
    expect(new Set(preservedResults.map((r) => r.newSlotId)).size).toBe(preservedResults.length);
    expect(result.find((r) => !r.preserved)?.reason).toBe("No matching slot in new formation");
  });
});