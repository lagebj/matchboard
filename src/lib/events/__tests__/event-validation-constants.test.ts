import { describe, it, expect } from "vitest";
import {
  VALID_EVENT_TYPES,
  VALID_GAME_FORMATS,
  VALID_NUMBER_OF_HALVES,
  parseEnum,
  parseNumberOfHalves,
  isValidEventStatus,
  requireValidEventStatus,
} from "../event-validation-constants";

describe("event-validation-constants", () => {
  describe("VALID_EVENT_TYPES", () => {
    it("contains expected event types", () => {
      expect(VALID_EVENT_TYPES).toContain("CUP");
      expect(VALID_EVENT_TYPES).toContain("TOURNAMENT");
      expect(VALID_EVENT_TYPES).toContain("FRIENDLY_DAY");
      expect(VALID_EVENT_TYPES).toContain("OTHER");
    });
  });

  describe("VALID_GAME_FORMATS", () => {
    it("contains expected game formats", () => {
      expect(VALID_GAME_FORMATS).toContain("THREE_A_SIDE");
      expect(VALID_GAME_FORMATS).toContain("FIVE_A_SIDE");
      expect(VALID_GAME_FORMATS).toContain("SEVEN_A_SIDE");
      expect(VALID_GAME_FORMATS).toContain("NINE_A_SIDE");
      expect(VALID_GAME_FORMATS).toContain("ELEVEN_A_SIDE");
    });
  });

  describe("parseEnum", () => {
    it("returns value when valid", () => {
      expect(parseEnum("CUP", VALID_EVENT_TYPES, "OTHER")).toBe("CUP");
    });

    it("returns default when value is null", () => {
      expect(parseEnum(null, VALID_EVENT_TYPES, "OTHER")).toBe("OTHER");
    });

    it("returns default when value is undefined", () => {
      expect(parseEnum(undefined, VALID_EVENT_TYPES, "OTHER")).toBe("OTHER");
    });

    it("returns default when value is invalid", () => {
      expect(parseEnum("INVALID", VALID_EVENT_TYPES, "OTHER")).toBe("OTHER");
    });
  });

  describe("isValidEventStatus", () => {
    it("returns true for valid statuses", () => {
      expect(isValidEventStatus("AVAILABLE")).toBe(true);
      expect(isValidEventStatus("UNAVAILABLE")).toBe(true);
      expect(isValidEventStatus("UNKNOWN")).toBe(true);
    });

    it("returns false for invalid statuses", () => {
      expect(isValidEventStatus("INVALID")).toBe(false);
      expect(isValidEventStatus("")).toBe(false);
    });
  });

  describe("requireValidEventStatus", () => {
    it("returns status for valid input", () => {
      expect(requireValidEventStatus("AVAILABLE")).toBe("AVAILABLE");
    });

    it("throws for invalid input", () => {
      expect(() => requireValidEventStatus("INVALID")).toThrow("Invalid event player status: INVALID");
    });
  });

  describe("VALID_NUMBER_OF_HALVES", () => {
    it("is exactly 1 and 2", () => {
      expect(VALID_NUMBER_OF_HALVES).toEqual([1, 2]);
    });
  });

  describe("parseNumberOfHalves", () => {
    it("accepts 1 and 2 as numbers", () => {
      expect(parseNumberOfHalves(1)).toBe(1);
      expect(parseNumberOfHalves(2)).toBe(2);
    });

    it("accepts 1 and 2 as strings (form data)", () => {
      expect(parseNumberOfHalves("1")).toBe(1);
      expect(parseNumberOfHalves("2")).toBe(2);
    });

    it("falls back to 1 for null/undefined/empty", () => {
      expect(parseNumberOfHalves(null)).toBe(1);
      expect(parseNumberOfHalves(undefined)).toBe(1);
      expect(parseNumberOfHalves("")).toBe(1);
    });

    it("falls back to 1 for out-of-range or garbage values, never persisting them", () => {
      expect(parseNumberOfHalves(0)).toBe(1);
      expect(parseNumberOfHalves(3)).toBe(1);
      expect(parseNumberOfHalves(-1)).toBe(1);
      expect(parseNumberOfHalves("not-a-number")).toBe(1);
    });
  });
});