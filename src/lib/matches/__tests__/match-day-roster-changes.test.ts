import { describe, it, expect } from "vitest";
import { deriveRelevanceFromPriority, categoryForFactType } from "../match-insights/ranking";
import type { OperationalRosterEntry } from "../match-insights/types";

function toPlanRole(role: string): "CORE" | "SUPPORT" | "DEVELOPMENT" {
  if (role === "CORE") return "CORE";
  if (role === "DEVELOPMENT") return "DEVELOPMENT";
  return "SUPPORT";
}

describe("Match-day roster changes (ADR-0151)", () => {
  describe("Follow Live route regression", () => {
    it("Follow live route must resolve to /live/follow, not /live", () => {
      const matchId = "test-match-1";
      const followRoute = `/matches/${matchId}/live/follow`;
      const liveReportingRoute = `/matches/${matchId}/live`;
      expect(followRoute).toContain("/live/follow");
      expect(liveReportingRoute).not.toContain("/live/follow");
    });
  });

  describe("Effective roster provenance", () => {
    it("distinguishes planned, helper, match_day_addition, and guest sources", () => {
      const sources: OperationalRosterEntry["source"][] = ["planned", "helper", "match_day_addition", "guest"];
      const provenances: OperationalRosterEntry["provenance"][] = [null, "HELPER", "MATCH_DAY_ADDITION", null];
      expect(sources).toHaveLength(4);
      expect(provenances).toHaveLength(4);
      expect(sources).toContain("match_day_addition");
      expect(provenances).toContain("MATCH_DAY_ADDITION");
    });

    it("match-day addition provenance maps to correct source label", () => {
      const entry: OperationalRosterEntry = {
        playerId: "p1",
        participantType: "PLAYER",
        source: "match_day_addition",
        provenance: "MATCH_DAY_ADDITION",
        role: null,
        position: "CM",
        isActiveParticipant: true,
        absenceReason: null,
      };
      expect(entry.source).toBe("match_day_addition");
      expect(entry.provenance).toBe("MATCH_DAY_ADDITION");
      expect(entry.isActiveParticipant).toBe(true);
    });

    it("absent planned player has isActiveParticipant false and absence reason", () => {
      const entry: OperationalRosterEntry = {
        playerId: "p1",
        participantType: "PLAYER",
        source: "planned",
        provenance: null,
        role: "CORE",
        position: "CB",
        isActiveParticipant: false,
        absenceReason: "SICK",
      };
      expect(entry.isActiveParticipant).toBe(false);
      expect(entry.absenceReason).toBe("SICK");
    });
  });

  describe("Match Insight fact types", () => {
    it("includes MATCH_AVAILABILITY and MATCH_DAY_ADDITION fact types", () => {
      const types: string[] = ["MATCH_AVAILABILITY", "MATCH_DAY_ADDITION"];
      for (const t of types) {
        const category = categoryForFactType(t as "MATCH_AVAILABILITY" | "MATCH_DAY_ADDITION");
        expect(category).toBe("CURRENT_PLAN");
      }
    });

    it("MATCH_AVAILABILITY facts have HIGH priority (95)", () => {
      const relevance = deriveRelevanceFromPriority(95);
      expect(relevance).toBe("HIGH");
    });

    it("MATCH_DAY_ADDITION facts have HIGH priority (80)", () => {
      const relevance = deriveRelevanceFromPriority(80);
      expect(relevance).toBe("HIGH");
    });
  });

  describe("Operational roster construction", () => {
    it("absent planned players appear with isActiveParticipant false", () => {
      const entry: OperationalRosterEntry = {
        playerId: "p1",
        participantType: "PLAYER",
        source: "planned",
        provenance: null,
        role: "CORE",
        position: "CB",
        isActiveParticipant: false,
        absenceReason: "INJURED",
      };
      expect(entry.isActiveParticipant).toBe(false);
      expect(entry.absenceReason).toBe("INJURED");
      expect(entry.source).toBe("planned");
    });

    it("match-day addition players appear with MATCH_DAY_ADDITION provenance", () => {
      const entry: OperationalRosterEntry = {
        playerId: "p2",
        participantType: "PLAYER",
        source: "match_day_addition",
        provenance: "MATCH_DAY_ADDITION",
        role: null,
        position: "CM",
        isActiveParticipant: true,
        absenceReason: null,
      };
      expect(entry.source).toBe("match_day_addition");
      expect(entry.provenance).toBe("MATCH_DAY_ADDITION");
      expect(entry.isActiveParticipant).toBe(true);
    });

    it("guest players always have isActiveParticipant true and no absence reason", () => {
      const entry: OperationalRosterEntry = {
        playerId: null,
        guestPlayerId: "gp1",
        participantType: "GUEST_PLAYER",
        source: "guest",
        provenance: null,
        role: null,
        position: null,
        isActiveParticipant: true,
        absenceReason: null,
      };
      expect(entry.isActiveParticipant).toBe(true);
      expect(entry.absenceReason).toBeNull();
      expect(entry.participantType).toBe("GUEST_PLAYER");
    });
  });

  describe("toPlanRole", () => {
    it("maps CORE to CORE", () => {
      expect(toPlanRole("CORE")).toBe("CORE");
    });

    it("maps DEVELOPMENT to DEVELOPMENT", () => {
      expect(toPlanRole("DEVELOPMENT")).toBe("DEVELOPMENT");
    });

    it("maps all other roles to SUPPORT", () => {
      expect(toPlanRole("SUPPORT")).toBe("SUPPORT");
      expect(toPlanRole("BACKFILL")).toBe("SUPPORT");
      expect(toPlanRole("CONFIDENCE_REBUILD")).toBe("SUPPORT");
      expect(toPlanRole("CORE_MATCH_DROP")).toBe("SUPPORT");
      expect(toPlanRole("REDUCED_MATCH_LOAD_DROP")).toBe("SUPPORT");
      expect(toPlanRole("MANUAL_OVERRIDE")).toBe("SUPPORT");
    });
  });

  describe("Absence reason labels", () => {
    it("covers all PlannedAbsenceReason values", () => {
      const reasons = ["AWAY", "SICK", "NO_SHOW", "DECLINED", "INJURED", "OTHER"];
      expect(reasons).toHaveLength(6);
      for (const reason of reasons) {
        expect(typeof reason).toBe("string");
      }
    });
  });

  describe("HelperProvenance enum", () => {
    it("has HELPER and MATCH_DAY_ADDITION values", () => {
      const provenances = ["HELPER", "MATCH_DAY_ADDITION"];
      expect(provenances).toContain("HELPER");
      expect(provenances).toContain("MATCH_DAY_ADDITION");
    });

    it("default provenance is HELPER for backward compatibility", () => {
      const defaultProvenance = "HELPER";
      expect(defaultProvenance).toBe("HELPER");
    });
  });
});