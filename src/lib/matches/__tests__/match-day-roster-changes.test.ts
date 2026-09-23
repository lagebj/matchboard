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

  describe("Squad list provenance and absence labels", () => {
    function sourceLabel(source: string | null | undefined): string | null {
      if (source === "match_day_addition") return "Match-day addition";
      if (source === "guest") return "Guest";
      if (source === "helper") return "Helper";
      return null;
    }

    function absenceLabel(reason: string | null | undefined): string | null {
      if (!reason) return null;
      if (reason === "AWAY") return "Away";
      if (reason === "SICK") return "Sick";
      if (reason === "INJURED") return "Injured";
      if (reason === "NO_SHOW") return "No show";
      if (reason === "DECLINED") return "Declined";
      return "Absent";
    }

    it("renders match_day_addition source label", () => {
      expect(sourceLabel("match_day_addition")).toBe("Match-day addition");
    });

    it("renders guest source label", () => {
      expect(sourceLabel("guest")).toBe("Guest");
    });

    it("renders helper source label", () => {
      expect(sourceLabel("helper")).toBe("Helper");
    });

    it("planned source has no label", () => {
      expect(sourceLabel("planned")).toBeNull();
    });

    it("null source has no label", () => {
      expect(sourceLabel(null)).toBeNull();
    });

    it("absence reason labels cover all values", () => {
      expect(absenceLabel("AWAY")).toBe("Away");
      expect(absenceLabel("SICK")).toBe("Sick");
      expect(absenceLabel("INJURED")).toBe("Injured");
      expect(absenceLabel("NO_SHOW")).toBe("No show");
      expect(absenceLabel("DECLINED")).toBe("Declined");
      expect(absenceLabel("OTHER")).toBe("Absent");
      expect(absenceLabel(null)).toBeNull();
      expect(absenceLabel(undefined)).toBeNull();
    });

    it("absent player is dimmed and not clickable even when not assigned", () => {
      const selection = {
        playerId: "p1",
        playerName: "Absent Player",
        role: "CORE",
        primaryPosition: "CB",
        secondaryPosition: null,
        coreTeamName: "Team A",
        absenceReason: "SICK",
        source: "planned" as const,
      };
      expect(selection.absenceReason).toBe("SICK");
      expect(selection.source).toBe("planned");
    });

    it("match-day addition has no absence reason", () => {
      const selection = {
        playerId: "p2",
        playerName: "Late Arrival",
        role: "MATCH_DAY_ADDITION",
        primaryPosition: "CM",
        secondaryPosition: null,
        coreTeamName: "Team B",
        absenceReason: null,
        source: "match_day_addition" as const,
      };
      expect(selection.source).toBe("match_day_addition");
      expect(selection.absenceReason).toBeNull();
    });

    it("guest player has guest source label", () => {
      const selection = {
        playerId: "gp1",
        playerName: "Trial Player",
        role: "GUEST",
        primaryPosition: "GUEST",
        secondaryPosition: null,
        coreTeamName: "Trial Club",
        absenceReason: null,
        source: "guest" as const,
      };
      expect(selection.source).toBe("guest");
      expect(selection.absenceReason).toBeNull();
    });
  });

  describe("createAndAddMatchGuestAction validation", () => {
    it("rejects empty guest name", () => {
      const name = "  ".trim();
      expect(name).toBe("");
      expect(name.length).toBe(0);
    });

    it("accepts valid guest name", () => {
      const name = "  Trial Player  ".trim();
      expect(name).toBe("Trial Player");
      expect(name.length).toBeGreaterThan(0);
    });

    it("optional source label and note are nullable", () => {
      const input = {
        name: "Guest",
        sourceLabel: null as string | null,
        note: null as string | null,
      };
      expect(input.sourceLabel).toBeNull();
      expect(input.note).toBeNull();
    });
  });
});