import { describe, it, expect } from "vitest";
import {
  classifyLoadCell,
  computeLoadAttentionFlags,
} from "../load-timeline-helpers";

describe("load-timeline-helpers", () => {
  describe("classifyLoadCell", () => {
    it("returns helper_appearance for unplanned actual participation", () => {
      expect(classifyLoadCell({ hasActual: true, actualSources: ["UNPLANNED"], plannedRole: undefined }))
        .toBe("helper_appearance");
    });

    it("returns helper_appearance for planned non-core role with actual participation", () => {
      expect(classifyLoadCell({ hasActual: true, actualSources: ["PLANNED"], plannedRole: "SUPPORT" }))
        .toBe("helper_appearance");
    });

    it("returns actual_appearance for planned core role with actual participation", () => {
      expect(classifyLoadCell({ hasActual: true, actualSources: ["PLANNED"], plannedRole: "CORE" }))
        .toBe("actual_appearance");
    });

    it("returns actual_appearance when no planned role but has actual participation", () => {
      expect(classifyLoadCell({ hasActual: true, actualSources: ["PLANNED"], plannedRole: undefined }))
        .toBe("actual_appearance");
    });

    it("returns planned_only when planned but no actual participation", () => {
      expect(classifyLoadCell({ hasActual: false, actualSources: [], plannedRole: "CORE" }))
        .toBe("planned_only");
    });

    it("returns unavailable when neither planned nor actual", () => {
      expect(classifyLoadCell({ hasActual: false, actualSources: [], plannedRole: undefined }))
        .toBe("unavailable");
    });

    it("returns helper_appearance for DEVELOPMENT planned role", () => {
      expect(classifyLoadCell({ hasActual: true, actualSources: ["PLANNED"], plannedRole: "DEVELOPMENT" }))
        .toBe("helper_appearance");
    });

    it("returns helper_appearance for BACKFILL planned role", () => {
      expect(classifyLoadCell({ hasActual: true, actualSources: ["PLANNED"], plannedRole: "BACKFILL" }))
        .toBe("helper_appearance");
    });
  });

  describe("computeLoadAttentionFlags", () => {
    it("flags high_recent_load when total actual appearances >= 4", () => {
      const flags = computeLoadAttentionFlags(5, 3, 6);
      expect(flags).toContain("high_recent_load");
    });

    it("does not flag high_recent_load when total actual appearances < 4", () => {
      const flags = computeLoadAttentionFlags(3, 3, 6);
      expect(flags).not.toContain("high_recent_load");
    });

    it("flags low_period_participation when participation <= 1 with more than 2 rounds", () => {
      const flags = computeLoadAttentionFlags(1, 1, 6);
      expect(flags).toContain("low_period_participation");
    });

    it("does not flag low_period_participation when participation > 1", () => {
      const flags = computeLoadAttentionFlags(3, 2, 6);
      expect(flags).not.toContain("low_period_participation");
    });

    it("does not flag low_period_participation when few rounds", () => {
      const flags = computeLoadAttentionFlags(1, 1, 2);
      expect(flags).not.toContain("low_period_participation");
    });

    it("returns empty array for moderate participation", () => {
      const flags = computeLoadAttentionFlags(2, 2, 4);
      expect(flags).toHaveLength(0);
    });
  });
});