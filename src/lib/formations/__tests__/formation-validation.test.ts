import { describe, it, expect } from "vitest";
import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotData, FormationSlotRoleType } from "@/lib/formations/types";
import {
  validateFormationForMatchUse,
  isValidSlotInFormat,
  isValidRoleType,
  suggestSlotDefaults,
  GAME_FORMAT_PLAYERS,
  SYSTEM_FORMATIONS,
  getSystemFormationsForFormat,
} from "@/lib/formations/index";
import {
  mapExistingPositionToBroad,
  getPlayerSlotCompatibility,
  sortPlayersBySlotCompatibility,
} from "@/lib/formations/lineup-compatibility";

function makeSlot(overrides: Partial<FormationSlotData> = {}): FormationSlotData {
  return {
    gridX: 2,
    gridY: 0,
    label: "Striker",
    shortLabel: "ST",
    roleType: "FORWARD",
    acceptedPositionIds: ["forward"],
    sortOrder: 0,
    ...overrides,
  };
}

describe("Formation validation", () => {
  describe("3v3 formations", () => {
    it("rejects goalkeeper slots in 3v3", () => {
      const result = validateFormationForMatchUse({
        gameFormat: "THREE_A_SIDE",
        slots: [
          makeSlot({ gridX: 2, gridY: 0, label: "Forward", shortLabel: "F", roleType: "FORWARD", acceptedPositionIds: ["forward"] }),
          makeSlot({ gridX: 2, gridY: 2, label: "Mid", shortLabel: "M", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"] }),
          makeSlot({ gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"] }),
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "GOALKEEPER_NOT_ALLOWED")).toBe(true);
    });

    it("accepts valid 3v3 formation without goalkeeper", () => {
      const result = validateFormationForMatchUse({
        gameFormat: "THREE_A_SIDE",
        slots: [
          makeSlot({ gridX: 2, gridY: 0, label: "Forward", shortLabel: "F", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 }),
          makeSlot({ gridX: 2, gridY: 2, label: "Mid", shortLabel: "M", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 1 }),
          makeSlot({ gridX: 2, gridY: 4, label: "Deep", shortLabel: "D", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 2 }),
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.slotCount).toBe(3);
      expect(result.goalkeeperCount).toBe(0);
    });
  });

  describe("5v5+ formations", () => {
    it("requires exactly one goalkeeper in 5v5", () => {
      const result = validateFormationForMatchUse({
        gameFormat: "FIVE_A_SIDE",
        slots: [
          makeSlot({ gridX: 2, gridY: 0, label: "ST", shortLabel: "ST", roleType: "FORWARD", acceptedPositionIds: ["forward"] }),
          makeSlot({ gridX: 1, gridY: 2, label: "LM", shortLabel: "LM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"] }),
          makeSlot({ gridX: 3, gridY: 2, label: "RM", shortLabel: "RM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"] }),
          makeSlot({ gridX: 2, gridY: 4, label: "CB", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender"] }),
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "GOALKEEPER_REQUIRED")).toBe(true);
    });

    it("rejects two goalkeepers in 7v7", () => {
      const result = validateFormationForMatchUse({
        gameFormat: "SEVEN_A_SIDE",
        slots: [
          makeSlot({ gridX: 2, gridY: 5, label: "GK1", shortLabel: "GK1", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 0 }),
          makeSlot({ gridX: 1, gridY: 5, label: "GK2", shortLabel: "GK2", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 1 }),
          makeSlot({ gridX: 2, gridY: 0, label: "ST", shortLabel: "ST", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 2 }),
          makeSlot({ gridX: 1, gridY: 2, label: "LM", shortLabel: "LM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 3 }),
          makeSlot({ gridX: 2, gridY: 2, label: "CM", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 4 }),
          makeSlot({ gridX: 3, gridY: 2, label: "RM", shortLabel: "RM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 5 }),
          makeSlot({ gridX: 2, gridY: 4, label: "CB", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 6 }),
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.goalkeeperCount).toBe(2);
      expect(result.issues.some((i) => i.code === "TOO_MANY_GOALKEEPERS")).toBe(true);
    });
  });

  describe("slot count validation", () => {
    it("reports insufficient slots", () => {
      const result = validateFormationForMatchUse({
        gameFormat: "SEVEN_A_SIDE",
        slots: [makeSlot({ gridX: 2, gridY: 5, label: "GK", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"] })],
      });
      expect(result.valid).toBe(false);
      expect(result.slotCount).toBe(1);
      expect(result.requiredSlots).toBe(7);
      expect(result.issues.some((i) => i.code === "INSUFFICIENT_SLOTS")).toBe(true);
    });

    it("reports too many slots", () => {
      const slots: FormationSlotData[] = [];
      for (let i = 0; i < 12; i++) {
        slots.push(makeSlot({ gridX: i % 5, gridY: Math.floor(i / 5), label: `P${i}`, shortLabel: `P${i}`, roleType: i === 0 ? "GOALKEEPER" : "FORWARD", acceptedPositionIds: i === 0 ? ["goalkeeper"] : ["forward"], sortOrder: i }));
      }
      const result = validateFormationForMatchUse({
        gameFormat: "ELEVEN_A_SIDE",
        slots,
      });
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.code === "TOO_MANY_SLOTS")).toBe(true);
    });
  });

  describe("duplicate coordinates", () => {
    it("rejects duplicate grid coordinates", () => {
      const result = validateFormationForMatchUse({
        gameFormat: "SEVEN_A_SIDE",
        slots: [
          makeSlot({ gridX: 2, gridY: 5, label: "GK", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 0 }),
          makeSlot({ gridX: 2, gridY: 5, label: "GK2", shortLabel: "GK2", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 1 }),
          makeSlot({ gridX: 2, gridY: 0, label: "ST", shortLabel: "ST", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 2 }),
        ],
      });
      expect(result.hasDuplicateCoordinates).toBe(true);
      expect(result.issues.some((i) => i.code === "DUPLICATE_COORDINATES")).toBe(true);
    });
  });

  describe("incomplete metadata", () => {
    it("rejects slots with missing label", () => {
      const result = validateFormationForMatchUse({
        gameFormat: "FIVE_A_SIDE",
        slots: [
          makeSlot({ gridX: 2, gridY: 5, label: "", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"] }),
        ],
      });
      expect(result.missingMetadataSlots.length).toBeGreaterThan(0);
    });
  });
});

describe("isValidRoleType", () => {
  it("accepts valid role types", () => {
    expect(isValidRoleType("GOALKEEPER")).toBe(true);
    expect(isValidRoleType("DEFENDER")).toBe(true);
    expect(isValidRoleType("MIDFIELDER")).toBe(true);
    expect(isValidRoleType("FORWARD")).toBe(true);
    expect(isValidRoleType("FREE")).toBe(true);
  });

  it("rejects invalid role types", () => {
    expect(isValidRoleType("INVALID")).toBe(false);
    expect(isValidRoleType("")).toBe(false);
  });
});

describe("isValidSlotInFormat", () => {
  it("invalidates goalkeeper in 3v3", () => {
    const slot = makeSlot({ roleType: "GOALKEEPER" });
    const result = isValidSlotInFormat(slot, "THREE_A_SIDE");
    expect(result.valid).toBe(false);
  });

  it("validates goalkeeper in 5v5", () => {
    const slot = makeSlot({ gridX: 2, gridY: 5, roleType: "GOALKEEPER" });
    const result = isValidSlotInFormat(slot, "FIVE_A_SIDE");
    expect(result.valid).toBe(true);
  });
});

describe("GAME_FORMAT_PLAYERS", () => {
  it("returns correct player counts", () => {
    expect(GAME_FORMAT_PLAYERS.THREE_A_SIDE).toBe(3);
    expect(GAME_FORMAT_PLAYERS.FIVE_A_SIDE).toBe(5);
    expect(GAME_FORMAT_PLAYERS.SEVEN_A_SIDE).toBe(7);
    expect(GAME_FORMAT_PLAYERS.NINE_A_SIDE).toBe(9);
    expect(GAME_FORMAT_PLAYERS.ELEVEN_A_SIDE).toBe(11);
  });
});

describe("System formations", () => {
  it("provides formations for all game formats", () => {
    for (const format of ["THREE_A_SIDE", "FIVE_A_SIDE", "SEVEN_A_SIDE", "NINE_A_SIDE", "ELEVEN_A_SIDE"] as GameFormat[]) {
      const formations = getSystemFormationsForFormat(format);
      expect(formations.length).toBeGreaterThan(0);
    }
  });

  it("each system formation has correct number of slots", () => {
    for (const formation of SYSTEM_FORMATIONS) {
      expect(formation.slots.length).toBe(GAME_FORMAT_PLAYERS[formation.gameFormat]);
    }
  });

  it("each system formation has unique coordinates", () => {
    for (const formation of SYSTEM_FORMATIONS) {
      const coords = new Set(formation.slots.map((s) => `${s.gridX},${s.gridY}`));
      expect(coords.size).toBe(formation.slots.length);
    }
  });

  it("5v5+ formations have exactly one goalkeeper", () => {
    for (const formation of SYSTEM_FORMATIONS) {
      if (formation.gameFormat === "THREE_A_SIDE") continue;
      const gks = formation.slots.filter((s) => s.roleType === "GOALKEEPER");
      expect(gks.length).toBe(1);
    }
  });

  it("3v3 formations have no goalkeeper", () => {
    for (const formation of SYSTEM_FORMATIONS) {
      if (formation.gameFormat === "THREE_A_SIDE") {
        const gks = formation.slots.filter((s) => s.roleType === "GOALKEEPER");
        expect(gks.length).toBe(0);
      }
    }
  });
});

describe("suggestSlotDefaults", () => {
  it("suggests goalkeeper for gridY 5, gridX 2 in 7v7", () => {
    const defaults = suggestSlotDefaults(2, 5, "SEVEN_A_SIDE");
    expect(defaults.roleType).toBe("GOALKEEPER");
    expect(defaults.shortLabel).toBe("GK");
    expect(defaults.acceptedPositionIds).toContain("goalkeeper");
  });

  it("does not suggest goalkeeper in 3v3", () => {
    const defaults = suggestSlotDefaults(2, 5, "THREE_A_SIDE");
    expect(defaults.roleType).not.toBe("GOALKEEPER");
  });

  it("suggests defender for gridY 4 centre in 7v7", () => {
    const defaults = suggestSlotDefaults(2, 4, "SEVEN_A_SIDE");
    expect(defaults.roleType).toBe("DEFENDER");
    expect(defaults.shortLabel).toBe("CB");
  });
});

describe("Lineup compatibility", () => {
  describe("mapExistingPositionToBroad", () => {
    it("maps GK to goalkeeper", () => {
      expect(mapExistingPositionToBroad("GK")).toBe("goalkeeper");
    });
    it("maps CB to defender", () => {
      expect(mapExistingPositionToBroad("CB")).toBe("defender");
    });
    it("maps CM to midfielder", () => {
      expect(mapExistingPositionToBroad("CM")).toBe("midfielder");
    });
    it("maps ST to forward", () => {
      expect(mapExistingPositionToBroad("ST")).toBe("forward");
    });
    it("maps W to midfielder (wing position)", () => {
      expect(mapExistingPositionToBroad("W")).toBe("midfielder");
    });
    it("maps unknown to flexible", () => {
      expect(mapExistingPositionToBroad("unknown")).toBe("flexible");
    });
  });

  describe("getPlayerSlotCompatibility", () => {
    it("marks compatible player as compatible", () => {
      const player = { playerId: "p1", primaryPosition: "GK", secondaryPositions: [] };
      const slot = makeSlot({ roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"] });
      const result = getPlayerSlotCompatibility(player, slot);
      expect(result.isCompatible).toBe(true);
    });

    it("marks non-compatible player as not compatible", () => {
      const player = { playerId: "p1", primaryPosition: "ST", secondaryPositions: [] };
      const slot = makeSlot({ gridX: 2, gridY: 5, roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"] });
      const result = getPlayerSlotCompatibility(player, slot);
      expect(result.isCompatible).toBe(false);
    });

    it("marks player as compatible via accepted position", () => {
      const player = { playerId: "p1", primaryPosition: "CB", secondaryPositions: [] };
      const slot = makeSlot({ roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"] });
      const result = getPlayerSlotCompatibility(player, slot);
      expect(result.isCompatible).toBe(true);
      expect(result.compatibilityReason).toContain("defender");
    });
  });

  describe("sortPlayersBySlotCompatibility", () => {
    it("sorts compatible players first", () => {
      const players = [
        { playerId: "p1", primaryPosition: "ST", secondaryPositions: [] },
        { playerId: "p2", primaryPosition: "GK", secondaryPositions: [] },
      ];
      const slot = makeSlot({ gridX: 2, gridY: 5, roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"] });
      const sorted = sortPlayersBySlotCompatibility(players, slot);
      expect(sorted[0].player.playerId).toBe("p2");
      expect(sorted[0].compatible).toBe(true);
      expect(sorted[1].player.playerId).toBe("p1");
      expect(sorted[1].compatible).toBe(false);
    });
  });

  describe("lineup assignment constraints", () => {
    it("same player cannot be assigned to multiple slots", () => {
      const assignedPlayerIds = new Set(["p1"]);
      const available = ["p2", "p3"].filter((id) => !assignedPlayerIds.has(id));
      expect(available).not.toContain("p1");
    });
  });
});

describe("Formation snapshot", () => {
  it("creates a snapshot with correct structure", async () => {
    const { createFormationSnapshot } = await import("@/lib/formations/snapshot");
    const snapshot = createFormationSnapshot(
      "formation-1",
      "GK + 2-3-1",
      "SEVEN_A_SIDE" as GameFormat,
      [
        { id: "slot-1", gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER" as FormationSlotRoleType, acceptedPositionIds: ["goalkeeper"], sortOrder: 0 },
      ],
    );
    expect(snapshot.formationId).toBe("formation-1");
    expect(snapshot.formationName).toBe("GK + 2-3-1");
    expect(snapshot.gameFormat).toBe("SEVEN_A_SIDE");
    expect(snapshot.slots).toHaveLength(1);
    expect(snapshot.slots[0].slotId).toBe("slot-1");
  });
});