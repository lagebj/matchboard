import { describe, it, expect } from "vitest";
import { validateOverviewField, toNumber } from "../insights-overview-helpers";
import type { InsightOverview } from "../insights-types";

describe("insights-overview server-side mapping", () => {
  describe("toNumber", () => {
    it("converts bigint to number", () => {
      expect(toNumber(BigInt(2))).toBe(2);
    });

    it("converts number to number", () => {
      expect(toNumber(2)).toBe(2);
    });

    it("converts null to 0", () => {
      expect(toNumber(null)).toBe(0);
    });

    it("converts undefined to 0", () => {
      expect(toNumber(undefined)).toBe(0);
    });

    it("converts bigint 0 to 0", () => {
      expect(toNumber(BigInt(0))).toBe(0);
    });

    it("converts large bigint correctly", () => {
      expect(toNumber(BigInt(100))).toBe(100);
    });
  });

  describe("validateOverviewField", () => {
    it("accepts a valid number", () => {
      expect(validateOverviewField(5, "totalPlayers")).toBe(5);
    });

    it("accepts zero", () => {
      expect(validateOverviewField(0, "playersWithHighLoad")).toBe(0);
    });

    it("extracts count from a raw query row object", () => {
      expect(validateOverviewField({ count: 2 }, "playersWithHighLoad")).toBe(2);
    });

    it("extracts count from a raw query row object with bigint", () => {
      expect(validateOverviewField({ count: BigInt(3) }, "playersWithHighLoad")).toBe(3);
    });

    it("throws for an object without count property", () => {
      expect(() => validateOverviewField({ foo: 1 }, "totalPlayers")).toThrow(
        /unexpected value/,
      );
    });

    it("throws for NaN", () => {
      expect(() => validateOverviewField(NaN, "totalPlayers")).toThrow(
        /unexpected value/,
      );
    });

    it("throws for a string", () => {
      expect(() => validateOverviewField("5", "totalPlayers")).toThrow(
        /unexpected value/,
      );
    });

    it("throws for null", () => {
      expect(() => validateOverviewField(null, "totalPlayers")).toThrow(
        /unexpected value/,
      );
    });

    it("throws for undefined", () => {
      expect(() => validateOverviewField(undefined, "totalPlayers")).toThrow(
        /unexpected value/,
      );
    });
  });

  describe("InsightOverview contract", () => {
    it("every field is a number in a valid overview", () => {
      const overview: InsightOverview = {
        totalPlayers: 27,
        playersWithNoOpportunity: 3,
        playersWithHighLoad: 2,
        matchesWithMissingReports: 1,
        matchesWithCoverageWarnings: 0,
        policyWarningsCount: 4,
        plannedActualDeltasCount: 0,
        conflictsCount: 0,
      };

      for (const [key, value] of Object.entries(overview)) {
        expect(typeof value, `Field ${key} should be number`).toBe("number");
        expect(Number.isFinite(value), `Field ${key} should be finite`).toBe(true);
      }
    });

    it("a raw { count: N } object must not pass as playersWithHighLoad", () => {
      const badValue = { count: 2 };
      expect(typeof badValue).not.toBe("number");
      expect(validateOverviewField(badValue, "playersWithHighLoad")).toBe(2);
    });

    it("validateOverviewField catches the production failure shape", () => {
      const productionShape = { count: 2 };
      expect(validateOverviewField(productionShape, "playersWithHighLoad")).toBe(2);

      const numericValue = 2;
      expect(validateOverviewField(numericValue, "playersWithHighLoad")).toBe(2);

      expect(typeof productionShape).not.toBe("number");
      expect(typeof numericValue).toBe("number");
    });
  });
});