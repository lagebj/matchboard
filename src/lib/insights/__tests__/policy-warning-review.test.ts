import { describe, it, expect } from "vitest";
import {
  classifyWarningSeverity,
  getSeverityLabel,
  getSeverityStyle,
} from "../policy-warning-review-helpers";

describe("policy-warning-review-helpers", () => {
  describe("classifyWarningSeverity", () => {
    it("classifies HARD_BLOCK as blocked", () => {
      expect(classifyWarningSeverity("HARD_BLOCK", "some_rule")).toBe("blocked");
    });

    it("classifies REQUIRES_OVERRIDE as decision_required", () => {
      expect(classifyWarningSeverity("REQUIRES_OVERRIDE", "some_rule")).toBe("decision_required");
    });

    it("classifies WARNING as planning_note", () => {
      expect(classifyWarningSeverity("WARNING", "some_rule")).toBe("planning_note");
    });

    it("classifies SCORING_PREFERENCE as planning_note", () => {
      expect(classifyWarningSeverity("SCORING_PREFERENCE", "some_rule")).toBe("planning_note");
    });

    it("classifies hard block rules as blocked regardless of db severity", () => {
      expect(classifyWarningSeverity("WARNING", "player_in_multiple_matches")).toBe("blocked");
      expect(classifyWarningSeverity("WARNING", "squad_below_minimum")).toBe("blocked");
      expect(classifyWarningSeverity("WARNING", "selected_player_unavailable")).toBe("blocked");
      expect(classifyWarningSeverity("WARNING", "duplicate_planned_assignment_integrity_failure")).toBe("blocked");
    });

    it("classifies requires override rules as decision_required", () => {
      expect(classifyWarningSeverity("WARNING", "support_requirement_shortfall")).toBe("decision_required");
      expect(classifyWarningSeverity("WARNING", "available_player_without_planned_opportunity")).toBe("decision_required");
    });

    it("classifies unknown rules as planning_note when severity is WARNING", () => {
      expect(classifyWarningSeverity("WARNING", "unknown_rule")).toBe("planning_note");
    });
  });

  describe("getSeverityLabel", () => {
    it("returns Blocked for blocked", () => {
      expect(getSeverityLabel("blocked")).toBe("Blocked");
    });

    it("returns Decision required for decision_required", () => {
      expect(getSeverityLabel("decision_required")).toBe("Decision required");
    });

    it("returns Planning note for planning_note", () => {
      expect(getSeverityLabel("planning_note")).toBe("Planning note");
    });
  });

  describe("getSeverityStyle", () => {
    it("returns red style for blocked", () => {
      expect(getSeverityStyle("blocked")).toContain("bg-red");
    });

    it("returns amber style for decision_required", () => {
      expect(getSeverityStyle("decision_required")).toContain("bg-amber");
    });

    it("returns zinc style for planning_note", () => {
      expect(getSeverityStyle("planning_note")).toContain("bg-zinc");
    });
  });
});