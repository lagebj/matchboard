import { describe, it, expect } from "vitest";
import {
  getLeagueSeasonPartForDate,
  getLeagueSeasonYearForDate,
  getLeagueSeasonLabel,
  getLeagueSeasonDateRange,
  getLeagueSeasonIdentifier,
  leagueSeasonIdentifierEquals,
  formatLeagueSeasonLabel,
  formatLeagueSeasonDateRange,
  formatCombinedLeagueSeasonLabel,
  type LeagueSeasonPart,
} from "../league-season";

describe("league-season utility", () => {
  describe("getLeagueSeasonPartForDate", () => {
    it("classifies January 1 as SPRING", () => {
      expect(getLeagueSeasonPartForDate(new Date(2026, 0, 1))).toBe("SPRING");
    });

    it("classifies June 30 as SPRING", () => {
      expect(getLeagueSeasonPartForDate(new Date(2026, 5, 30))).toBe("SPRING");
    });

    it("classifies July 1 as FALL", () => {
      expect(getLeagueSeasonPartForDate(new Date(2026, 6, 1))).toBe("FALL");
    });

    it("classifies December 31 as FALL", () => {
      expect(getLeagueSeasonPartForDate(new Date(2026, 11, 31))).toBe("FALL");
    });

    it("classifies March 15 as SPRING", () => {
      expect(getLeagueSeasonPartForDate(new Date(2026, 2, 15))).toBe("SPRING");
    });

    it("classifies September 20 as FALL", () => {
      expect(getLeagueSeasonPartForDate(new Date(2026, 8, 20))).toBe("FALL");
    });

    it("works across year boundaries", () => {
      expect(getLeagueSeasonPartForDate(new Date(2025, 0, 1))).toBe("SPRING");
      expect(getLeagueSeasonPartForDate(new Date(2025, 11, 31))).toBe("FALL");
      expect(getLeagueSeasonPartForDate(new Date(2027, 6, 1))).toBe("FALL");
    });
  });

  describe("getLeagueSeasonYearForDate", () => {
    it("returns the year from the date", () => {
      expect(getLeagueSeasonYearForDate(new Date(2026, 0, 1))).toBe(2026);
      expect(getLeagueSeasonYearForDate(new Date(2026, 11, 31))).toBe(2026);
    });
  });

  describe("getLeagueSeasonLabel", () => {
    it("returns Spring YYYY for a spring date", () => {
      expect(getLeagueSeasonLabel(new Date(2026, 3, 15))).toBe("Spring 2026");
    });

    it("returns Fall YYYY for a fall date", () => {
      expect(getLeagueSeasonLabel(new Date(2026, 8, 15))).toBe("Fall 2026");
    });
  });

  describe("getLeagueSeasonDateRange", () => {
    it("returns Jan 1 – Jun 30 for SPRING 2026", () => {
      const range = getLeagueSeasonDateRange(2026, "SPRING");
      expect(range.startDate.getFullYear()).toBe(2026);
      expect(range.startDate.getMonth()).toBe(0);
      expect(range.startDate.getDate()).toBe(1);
      expect(range.endDate.getFullYear()).toBe(2026);
      expect(range.endDate.getMonth()).toBe(5);
      expect(range.endDate.getDate()).toBe(30);
    });

    it("returns Jul 1 – Dec 31 for FALL 2026", () => {
      const range = getLeagueSeasonDateRange(2026, "FALL");
      expect(range.startDate.getFullYear()).toBe(2026);
      expect(range.startDate.getMonth()).toBe(6);
      expect(range.startDate.getDate()).toBe(1);
      expect(range.endDate.getFullYear()).toBe(2026);
      expect(range.endDate.getMonth()).toBe(11);
      expect(range.endDate.getDate()).toBe(31);
    });
  });

  describe("getLeagueSeasonIdentifier", () => {
    it("returns correct identifier for a spring date", () => {
      const id = getLeagueSeasonIdentifier(new Date(2026, 2, 15));
      expect(id.year).toBe(2026);
      expect(id.part).toBe("SPRING");
    });

    it("returns correct identifier for a fall date", () => {
      const id = getLeagueSeasonIdentifier(new Date(2026, 9, 15));
      expect(id.year).toBe(2026);
      expect(id.part).toBe("FALL");
    });
  });

  describe("leagueSeasonIdentifierEquals", () => {
    it("returns true for identical identifiers", () => {
      const a = { year: 2026, part: "SPRING" as LeagueSeasonPart };
      const b = { year: 2026, part: "SPRING" as LeagueSeasonPart };
      expect(leagueSeasonIdentifierEquals(a, b)).toBe(true);
    });

    it("returns false for different years", () => {
      const a = { year: 2026, part: "SPRING" as LeagueSeasonPart };
      const b = { year: 2027, part: "SPRING" as LeagueSeasonPart };
      expect(leagueSeasonIdentifierEquals(a, b)).toBe(false);
    });

    it("returns false for different parts", () => {
      const a = { year: 2026, part: "SPRING" as LeagueSeasonPart };
      const b = { year: 2026, part: "FALL" as LeagueSeasonPart };
      expect(leagueSeasonIdentifierEquals(a, b)).toBe(false);
    });
  });

  describe("formatLeagueSeasonLabel", () => {
    it("formats Spring", () => {
      expect(formatLeagueSeasonLabel({ year: 2026, part: "SPRING" })).toBe(
        "Spring 2026",
      );
    });

    it("formats Fall", () => {
      expect(formatLeagueSeasonLabel({ year: 2026, part: "FALL" })).toBe(
        "Fall 2026",
      );
    });
  });

  describe("formatLeagueSeasonDateRange", () => {
    it("formats Spring date range", () => {
      const result = formatLeagueSeasonDateRange({
        year: 2026,
        part: "SPRING",
      });
      expect(result).toContain("2026");
      expect(result).toContain("Jan");
      expect(result).toContain("Jun");
    });

    it("formats Fall date range", () => {
      const result = formatLeagueSeasonDateRange({
        year: 2026,
        part: "FALL",
      });
      expect(result).toContain("2026");
      expect(result).toContain("Jul");
      expect(result).toContain("Dec");
    });
  });

  describe("formatCombinedLeagueSeasonLabel", () => {
    it("formats combined Spring label", () => {
      const result = formatCombinedLeagueSeasonLabel({
        year: 2026,
        part: "SPRING",
      });
      expect(result).toContain("Spring 2026");
      expect(result).toContain("·");
    });

    it("formats combined Fall label", () => {
      const result = formatCombinedLeagueSeasonLabel({
        year: 2026,
        part: "FALL",
      });
      expect(result).toContain("Fall 2026");
      expect(result).toContain("·");
    });
  });
});