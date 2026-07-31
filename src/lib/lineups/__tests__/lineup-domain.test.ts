import { describe, it, expect } from "vitest";
import {
  canModifyLineup,
  requireModifiableLineup,
  requireAllSlotsAssigned,
} from "../lineup-domain";

describe("lineup-domain", () => {
  describe("canModifyLineup", () => {
    it("returns true for DRAFT lineup", () => {
      expect(canModifyLineup("DRAFT")).toBe(true);
    });

    it("returns true for ARCHIVED lineup", () => {
      expect(canModifyLineup("ARCHIVED")).toBe(true);
    });

    it("returns false for CONFIRMED lineup", () => {
      expect(canModifyLineup("CONFIRMED")).toBe(false);
    });
  });

  describe("requireModifiableLineup", () => {
    it("passes for DRAFT status", () => {
      expect(() => requireModifiableLineup("DRAFT")).not.toThrow();
    });

    it("throws for CONFIRMED status", () => {
      expect(() => requireModifiableLineup("CONFIRMED")).toThrow("Cannot modify a confirmed lineup");
    });
  });

  describe("requireAllSlotsAssigned", () => {
    it("passes when all slots have players", () => {
      expect(() => requireAllSlotsAssigned([
        { playerId: "p1" },
        { playerId: "p2" },
      ])).not.toThrow();
    });

    it("throws when some slots are empty", () => {
      expect(() => requireAllSlotsAssigned([
        { playerId: "p1" },
        { playerId: null },
      ])).toThrow("Cannot confirm: 1 slot(s) have no player assigned");
    });

    it("throws with correct count of empty slots", () => {
      expect(() => requireAllSlotsAssigned([
        { playerId: null },
        { playerId: null },
        { playerId: null },
      ])).toThrow("Cannot confirm: 3 slot(s) have no player assigned");
    });
  });
});