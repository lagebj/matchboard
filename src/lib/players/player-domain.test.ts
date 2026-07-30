import { describe, it, expect } from "vitest";
import { isValidAvailabilityStatus } from "./player-domain";

describe("player-domain", () => {
  describe("isValidAvailabilityStatus", () => {
    it("accepts valid availability statuses", () => {
      expect(isValidAvailabilityStatus("AVAILABLE")).toBe(true);
      expect(isValidAvailabilityStatus("INJURED")).toBe(true);
      expect(isValidAvailabilityStatus("SICK")).toBe(true);
      expect(isValidAvailabilityStatus("AWAY")).toBe(true);
      expect(isValidAvailabilityStatus("TENTATIVE")).toBe(true);
      expect(isValidAvailabilityStatus("UNKNOWN")).toBe(true);
    });

    it("rejects invalid availability statuses", () => {
      expect(isValidAvailabilityStatus("invalid")).toBe(false);
      expect(isValidAvailabilityStatus("")).toBe(false);
      expect(isValidAvailabilityStatus("available")).toBe(false);
    });
  });
});