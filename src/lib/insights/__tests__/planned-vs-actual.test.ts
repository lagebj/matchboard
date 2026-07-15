import { describe, it, expect } from "vitest";
import {
  classifyDeltaType,
  getDeltaTypeLabel,
  getDeltaTypeStyle,
} from "../planned-vs-actual-helpers";
import type { PlannedActualDeltaType } from "../insights-types";

describe("planned-vs-actual-helpers", () => {
  describe("classifyDeltaType", () => {
    it("classifies UNPLANNED source as unplanned_participant", () => {
      expect(classifyDeltaType("UNPLANNED")).toBe("unplanned_participant");
    });

    it("classifies unknown source as unplanned_participant by default", () => {
      expect(classifyDeltaType("UNKNOWN")).toBe("unplanned_participant");
    });
  });

  describe("getDeltaTypeLabel", () => {
    it("returns label for planned_absent", () => {
      expect(getDeltaTypeLabel("planned_absent")).toBe("Planned but absent");
    });

    it("returns label for unplanned_participant", () => {
      expect(getDeltaTypeLabel("unplanned_participant")).toBe("Unplanned participant");
    });

    it("returns label for planned_helper_unused", () => {
      expect(getDeltaTypeLabel("planned_helper_unused")).toBe("Planned helper not used");
    });

    it("returns label for report_missing", () => {
      expect(getDeltaTypeLabel("report_missing")).toBe("Report missing");
    });
  });

  describe("getDeltaTypeStyle", () => {
    it("returns red style for planned_absent", () => {
      expect(getDeltaTypeStyle("planned_absent")).toContain("bg-red");
    });

    it("returns cyan style for unplanned_participant", () => {
      expect(getDeltaTypeStyle("unplanned_participant")).toContain("bg-cyan");
    });

    it("returns amber style for planned_substitute_started", () => {
      expect(getDeltaTypeStyle("planned_substitute_started")).toContain("bg-amber");
    });

    it("returns yellow style for report_missing", () => {
      expect(getDeltaTypeStyle("report_missing")).toContain("bg-yellow");
    });

    it("returns style for all delta types", () => {
      const types: PlannedActualDeltaType[] = [
        "planned_absent",
        "planned_substitute_started",
        "unplanned_participant",
        "planned_helper_unused",
        "helper_added_after_plan",
        "lineup_changed_after_matchday",
        "report_missing",
        "actual_participation_missing",
      ];
      for (const t of types) {
        const style = getDeltaTypeStyle(t);
        expect(style).toBeTruthy();
        expect(style).toContain("bg-");
      }
    });
  });
});