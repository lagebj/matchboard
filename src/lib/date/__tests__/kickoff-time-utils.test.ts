import { describe, it, expect } from "vitest";
import {
  getKickoffDateInputValue,
  getKickoffTimeInputValue,
  formatKickoffDate,
  formatKickoffTime,
  formatKickoffDateTime,
  getTodayLocalDateInputValue,
} from "../../date-utils";

describe("Kickoff time utilities (wall-clock, no timezone conversion)", () => {
  describe("getKickoffDateInputValue", () => {
    it("extracts YYYY-MM-DD from a local date", () => {
      const date = new Date(2026, 5, 15, 14, 30);
      const result = getKickoffDateInputValue(date);
      expect(result).toBe("2026-06-15");
    });

    it("pads single-digit months and days", () => {
      const date = new Date(2026, 0, 5, 9, 5);
      const result = getKickoffDateInputValue(date);
      expect(result).toBe("2026-01-05");
    });

    it("preserves the local date regardless of timezone offset", () => {
      const date = new Date(2026, 11, 31, 23, 59);
      expect(getKickoffDateInputValue(date)).toBe("2026-12-31");
    });
  });

  describe("getKickoffTimeInputValue", () => {
    it("extracts HH:MM from a local time", () => {
      const date = new Date(2026, 5, 15, 14, 30);
      const result = getKickoffTimeInputValue(date);
      expect(result).toBe("14:30");
    });

    it("pads single-digit hours and minutes", () => {
      const date = new Date(2026, 5, 15, 9, 5);
      const result = getKickoffTimeInputValue(date);
      expect(result).toBe("09:05");
    });

    it("handles midnight correctly", () => {
      const date = new Date(2026, 5, 15, 0, 0);
      expect(getKickoffTimeInputValue(date)).toBe("00:00");
    });
  });

  describe("formatKickoffDate", () => {
    it("formats a date in en-GB style without timezone conversion", () => {
      const date = new Date(2026, 5, 15, 14, 30);
      const result = formatKickoffDate(date);
      expect(result).toContain("15");
      expect(result).toContain("Jun");
      expect(result).toContain("2026");
    });
  });

  describe("formatKickoffTime", () => {
    it("formats time as HH:MM without timezone conversion", () => {
      const date = new Date(2026, 5, 15, 14, 30);
      expect(formatKickoffTime(date)).toBe("14:30");
    });

    it("pads single-digit hours", () => {
      const date = new Date(2026, 5, 15, 9, 5);
      expect(formatKickoffTime(date)).toBe("09:05");
    });
  });

  describe("formatKickoffDateTime", () => {
    it("formats date and time together", () => {
      const date = new Date(2026, 5, 15, 14, 30);
      const result = formatKickoffDateTime(date);
      expect(result).toContain("15");
      expect(result).toContain("Jun");
      expect(result).toContain("14:30");
    });
  });

  describe("getTodayLocalDateInputValue", () => {
    it("returns a string matching YYYY-MM-DD format", () => {
      const result = getTodayLocalDateInputValue();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("round-trip: readKickoffDateTime → formatKickoff*", () => {
    it("round-trips a kickoff date+time through input value extraction and formatting", () => {
      const original = new Date(2026, 8, 2, 10, 15);
      const dateInput = getKickoffDateInputValue(original);
      const timeInput = getKickoffTimeInputValue(original);

      expect(dateInput).toBe("2026-09-02");
      expect(timeInput).toBe("10:15");

      const formatted = formatKickoffDateTime(original);
      expect(formatted).toContain("10:15");
    });

    it("round-trips an evening kickoff correctly", () => {
      const original = new Date(2026, 3, 18, 19, 45);
      const dateInput = getKickoffDateInputValue(original);
      const timeInput = getKickoffTimeInputValue(original);

      expect(dateInput).toBe("2026-04-18");
      expect(timeInput).toBe("19:45");

      expect(formatKickoffTime(original)).toBe("19:45");
    });
  });
});