import { describe, it, expect } from "vitest";
import {
  mapPlannedRoleToStatus,
  mapPlannedRoleToActualStatus,
} from "../opportunity-matrix-helpers";

describe("opportunity-matrix helpers", () => {
  describe("mapPlannedRoleToStatus", () => {
    it("maps CORE to planned_core", () => {
      expect(mapPlannedRoleToStatus("CORE")).toBe("planned_core");
    });

    it("maps SUPPORT to planned_support", () => {
      expect(mapPlannedRoleToStatus("SUPPORT")).toBe("planned_support");
    });

    it("maps BACKFILL to planned_support", () => {
      expect(mapPlannedRoleToStatus("BACKFILL")).toBe("planned_support");
    });

    it("maps DEVELOPMENT to planned_development", () => {
      expect(mapPlannedRoleToStatus("DEVELOPMENT")).toBe("planned_development");
    });

    it("maps CONFIDENCE_REBUILD to planned_development", () => {
      expect(mapPlannedRoleToStatus("CONFIDENCE_REBUILD")).toBe(
        "planned_development",
      );
    });

    it("maps CORE_MATCH_DROP to planned_squad_repair", () => {
      expect(mapPlannedRoleToStatus("CORE_MATCH_DROP")).toBe(
        "planned_squad_repair",
      );
    });

    it("maps REDUCED_MATCH_LOAD_DROP to planned_squad_repair", () => {
      expect(mapPlannedRoleToStatus("REDUCED_MATCH_LOAD_DROP")).toBe(
        "planned_squad_repair",
      );
    });

    it("maps MANUAL_OVERRIDE to planned_squad_repair", () => {
      expect(mapPlannedRoleToStatus("MANUAL_OVERRIDE")).toBe(
        "planned_squad_repair",
      );
    });

    it("maps unknown role to planned_core as default", () => {
      expect(mapPlannedRoleToStatus("UNKNOWN_ROLE")).toBe("planned_core");
    });
  });

  describe("mapPlannedRoleToActualStatus", () => {
    it("maps CORE to actual_core", () => {
      expect(mapPlannedRoleToActualStatus("CORE")).toBe("actual_core");
    });

    it("maps SUPPORT to actual_support", () => {
      expect(mapPlannedRoleToActualStatus("SUPPORT")).toBe("actual_support");
    });

    it("maps BACKFILL to actual_support", () => {
      expect(mapPlannedRoleToActualStatus("BACKFILL")).toBe("actual_support");
    });

    it("maps DEVELOPMENT to actual_development", () => {
      expect(mapPlannedRoleToActualStatus("DEVELOPMENT")).toBe(
        "actual_development",
      );
    });

    it("maps CORE_MATCH_DROP to actual_core", () => {
      expect(mapPlannedRoleToActualStatus("CORE_MATCH_DROP")).toBe(
        "actual_core",
      );
    });

    it("maps unknown role to actual_core as default", () => {
      expect(mapPlannedRoleToActualStatus("UNKNOWN_ROLE")).toBe("actual_core");
    });
  });
});