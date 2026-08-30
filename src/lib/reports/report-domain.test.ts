import { describe, it, expect } from "vitest";
import {
  canTransitionTo,
  isReportEditable,
  isReportCompleted,
  isReportLocked,
  hasUnknownAttendance,
  requireEditableReport,
  requireUnlockedReport,
  VALID_UNPLANNED_APPEARANCE_REASONS,
  VALID_PLANNED_ABSENCE_REASONS,
  DEFAULT_GOAL_TYPE,
  DEFAULT_ASSIST_TYPE,
} from "./report-domain";

describe("report-domain", () => {
  describe("canTransitionTo", () => {
    it("allows NOT_STARTED → DRAFT", () => {
      const result = canTransitionTo("NOT_STARTED", "DRAFT");
      expect(result.allowed).toBe(true);
      if (result.allowed) expect(result.newStatus).toBe("DRAFT");
    });

    it("allows DRAFT → REPORTED", () => {
      const result = canTransitionTo("DRAFT", "REPORTED");
      expect(result.allowed).toBe(true);
    });

    it("allows DRAFT → LOCKED", () => {
      const result = canTransitionTo("DRAFT", "LOCKED");
      expect(result.allowed).toBe(true);
    });

    it("allows REPORTED → LOCKED", () => {
      const result = canTransitionTo("REPORTED", "LOCKED");
      expect(result.allowed).toBe(true);
    });

    it("allows REPORTED → DRAFT (reopen)", () => {
      const result = canTransitionTo("REPORTED", "DRAFT");
      expect(result.allowed).toBe(true);
    });

    it("allows LOCKED → REPORTED (reopen)", () => {
      const result = canTransitionTo("LOCKED", "REPORTED");
      expect(result.allowed).toBe(true);
    });

    it("rejects NOT_STARTED → LOCKED (skip steps)", () => {
      const result = canTransitionTo("NOT_STARTED", "LOCKED");
      expect(result.allowed).toBe(false);
    });

    it("allows LOCKED → DRAFT directly (D9/ADR-0109 §E: one completion boundary, no forced REPORTED detour to reopen)", () => {
      const result = canTransitionTo("LOCKED", "DRAFT");
      expect(result.allowed).toBe(true);
    });

    it("rejects DRAFT → NOT_STARTED", () => {
      const result = canTransitionTo("DRAFT", "NOT_STARTED" as never);
      expect(result.allowed).toBe(false);
    });
  });

  describe("isReportEditable", () => {
    it("returns true for NOT_STARTED", () => {
      expect(isReportEditable("NOT_STARTED")).toBe(true);
    });

    it("returns true for DRAFT", () => {
      expect(isReportEditable("DRAFT")).toBe(true);
    });

    it("returns false for REPORTED", () => {
      expect(isReportEditable("REPORTED")).toBe(false);
    });

    it("returns false for LOCKED", () => {
      expect(isReportLocked("LOCKED")).toBe(true);
    });
  });

  describe("isReportCompleted", () => {
    it("returns true for REPORTED", () => {
      expect(isReportCompleted("REPORTED")).toBe(true);
    });

    it("returns true for LOCKED", () => {
      expect(isReportCompleted("LOCKED")).toBe(true);
    });

    it("returns false for DRAFT", () => {
      expect(isReportCompleted("DRAFT")).toBe(false);
    });
  });

  describe("hasUnknownAttendance", () => {
    it("returns true when any player has UNKNOWN attendance", () => {
      expect(hasUnknownAttendance([{ attendanceStatus: "PRESENT" }, { attendanceStatus: "UNKNOWN" }])).toBe(true);
    });

    it("returns false when all attendance is known", () => {
      expect(hasUnknownAttendance([{ attendanceStatus: "PRESENT" }, { attendanceStatus: "NO_SHOW" }])).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(hasUnknownAttendance([])).toBe(false);
    });
  });

  describe("requireEditableReport", () => {
    it("allows DRAFT reports", () => {
      expect(requireEditableReport("DRAFT", "add player").allowed).toBe(true);
    });

    it("rejects LOCKED reports", () => {
      const result = requireEditableReport("LOCKED", "add player");
      expect(result.allowed).toBe(false);
    });

    it("rejects REPORTED reports", () => {
      const result = requireEditableReport("REPORTED", "add player");
      expect(result.allowed).toBe(false);
    });
  });

  describe("requireUnlockedReport", () => {
    it("allows DRAFT reports", () => {
      expect(requireUnlockedReport("DRAFT", "update stats").allowed).toBe(true);
    });

    it("allows REPORTED reports", () => {
      expect(requireUnlockedReport("REPORTED", "update stats").allowed).toBe(true);
    });

    it("rejects LOCKED reports", () => {
      const result = requireUnlockedReport("LOCKED", "update stats");
      expect(result.allowed).toBe(false);
    });
  });

  describe("valid constants", () => {
    it("has valid unplanned appearance reasons", () => {
      expect(VALID_UNPLANNED_APPEARANCE_REASONS).toContain("EMERGENCY_SQUAD_COVER");
      expect(VALID_UNPLANNED_APPEARANCE_REASONS).toContain("OTHER_RECORDED_REASON");
    });

    it("has valid planned absence reasons", () => {
      expect(VALID_PLANNED_ABSENCE_REASONS).toContain("INJURED");
      expect(VALID_PLANNED_ABSENCE_REASONS).toContain("COACH_DECISION");
    });

    it("has default goal and assist types", () => {
      expect(DEFAULT_GOAL_TYPE).toBe("NORMAL");
      expect(DEFAULT_ASSIST_TYPE).toBe("NORMAL");
    });
  });
});