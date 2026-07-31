import { describe, it, expect } from "vitest";
import {
  isValidMatchStatus,
  canCancelMatch,
  canReopenMatch,
} from "./match-domain";

describe("match-domain", () => {
  describe("isValidMatchStatus", () => {
    it("accepts valid match statuses", () => {
      expect(isValidMatchStatus("SCHEDULED")).toBe(true);
      expect(isValidMatchStatus("CANCELLED")).toBe(true);
    });

    it("rejects invalid match statuses", () => {
      expect(isValidMatchStatus("INVALID")).toBe(false);
      expect(isValidMatchStatus("")).toBe(false);
    });
  });

  describe("canCancelMatch", () => {
    it("allows cancelling a SCHEDULED match", () => {
      expect(canCancelMatch("SCHEDULED")).toBe(true);
    });

    it("prevents cancelling an already CANCELLED match", () => {
      expect(canCancelMatch("CANCELLED")).toBe(false);
    });
  });

  describe("canReopenMatch", () => {
    it("allows reopening a CANCELLED match", () => {
      expect(canReopenMatch("CANCELLED")).toBe(true);
    });

    it("prevents reopening a SCHEDULED match", () => {
      expect(canReopenMatch("SCHEDULED")).toBe(false);
    });
  });
});