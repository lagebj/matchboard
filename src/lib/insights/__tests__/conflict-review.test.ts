import { describe, it, expect } from "vitest";
import {
  classifyConflictSeverity,
  getConflictTypeLabel,
  getConflictTypeStyle,
} from "../conflict-review-helpers";

describe("conflict-review-helpers", () => {
  describe("classifyConflictSeverity", () => {
    it("classifies player_double_planned as blocked", () => {
      expect(classifyConflictSeverity("player_double_planned")).toBe("blocked");
    });

    it("classifies overlapping_selection as blocked", () => {
      expect(classifyConflictSeverity("overlapping_selection")).toBe("blocked");
    });

    it("classifies helper_overlap as decision_required", () => {
      expect(classifyConflictSeverity("helper_overlap")).toBe("decision_required");
    });

    it("classifies event_helper_conflict as decision_required", () => {
      expect(classifyConflictSeverity("event_helper_conflict")).toBe("decision_required");
    });

    it("classifies missing_report as planning_note", () => {
      expect(classifyConflictSeverity("missing_report")).toBe("planning_note");
    });

    it("classifies missing_opponent as planning_note", () => {
      expect(classifyConflictSeverity("missing_opponent")).toBe("planning_note");
    });

    it("classifies future_report_incorrectly_unavailable as planning_note", () => {
      expect(classifyConflictSeverity("future_report_incorrectly_unavailable")).toBe("planning_note");
    });
  });

  describe("getConflictTypeLabel", () => {
    it("returns label for player_double_planned", () => {
      expect(getConflictTypeLabel("player_double_planned")).toBe("Player double-planned");
    });

    it("returns label for overlapping_selection", () => {
      expect(getConflictTypeLabel("overlapping_selection")).toBe("Overlapping selection");
    });

    it("returns label for missing_report", () => {
      expect(getConflictTypeLabel("missing_report")).toBe("Missing report");
    });

    it("returns label for helper_overlap", () => {
      expect(getConflictTypeLabel("helper_overlap")).toBe("Helper overlap");
    });
  });

  describe("getConflictTypeStyle", () => {
    it("returns red style for blocked conflict types", () => {
      expect(getConflictTypeStyle("player_double_planned")).toContain("bg-red");
    });

    it("returns amber style for decision_required conflict types", () => {
      expect(getConflictTypeStyle("helper_overlap")).toContain("bg-amber");
    });

    it("returns zinc style for planning_note conflict types", () => {
      expect(getConflictTypeStyle("missing_report")).toContain("bg-zinc");
    });
  });
});