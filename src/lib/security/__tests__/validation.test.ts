import { describe, it, expect } from "vitest";
import {
  finalizeRoundSchema,
  populateAllSchema,
  generateRoundSchema,
  clearDraftSchema,
  draftSelectionSchema,
  reconcileSchema,
  auditQuerySchema,
  seasonExportSchema,
  selectionRoleSchema,
  overrideReasonCategorySchema,
} from "../validation";

describe("Input validation schemas", () => {
  describe("finalizeRoundSchema", () => {
    it("validates valid input with matchRoundId", () => {
      const result = finalizeRoundSchema.safeParse({ matchRoundId: "clx123abc" });
      expect(result.success).toBe(true);
    });

    it("rejects empty matchRoundId", () => {
      const result = finalizeRoundSchema.safeParse({ matchRoundId: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing matchRoundId", () => {
      const result = finalizeRoundSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("validates override reason category", () => {
      const result = finalizeRoundSchema.safeParse({
        matchRoundId: "clx123",
        overrideReasonCategory: "coach_judgement",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid override reason category", () => {
      const result = finalizeRoundSchema.safeParse({
        matchRoundId: "clx123",
        overrideReasonCategory: "invalid_category",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("populateAllSchema", () => {
    it("validates valid leagueSeasonId", () => {
      const result = populateAllSchema.safeParse({ leagueSeasonId: "clx123" });
      expect(result.success).toBe(true);
    });

    it("rejects missing leagueSeasonId", () => {
      const result = populateAllSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("generateRoundSchema", () => {
    it("validates valid roundId", () => {
      const result = generateRoundSchema.safeParse({ roundId: "clx123" });
      expect(result.success).toBe(true);
    });

    it("rejects missing roundId", () => {
      const result = generateRoundSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("clearDraftSchema", () => {
    it("validates clear all with leagueSeasonId", () => {
      const result = clearDraftSchema.safeParse({
        level: "all",
        leagueSeasonId: "clx123",
      });
      expect(result.success).toBe(true);
    });

    it("validates clear round with matchRoundId", () => {
      const result = clearDraftSchema.safeParse({
        level: "round",
        matchRoundId: "clx456",
      });
      expect(result.success).toBe(true);
    });

    it("validates clear match with matchId", () => {
      const result = clearDraftSchema.safeParse({
        level: "match",
        matchId: "clx789",
      });
      expect(result.success).toBe(true);
    });

    it("rejects clear all without leagueSeasonId", () => {
      const result = clearDraftSchema.safeParse({ level: "all" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid level", () => {
      const result = clearDraftSchema.safeParse({ level: "invalid" });
      expect(result.success).toBe(false);
    });
  });

  describe("draftSelectionSchema", () => {
    it("validates add action", () => {
      const result = draftSelectionSchema.safeParse({
        action: "add",
        matchId: "clx123",
        playerId: "clx456",
        role: "CORE",
      });
      expect(result.success).toBe(true);
    });

    it("validates remove action", () => {
      const result = draftSelectionSchema.safeParse({
        action: "remove",
        matchId: "clx123",
        playerId: "clx456",
      });
      expect(result.success).toBe(true);
    });

    it("validates replace action", () => {
      const result = draftSelectionSchema.safeParse({
        action: "replace",
        matchId: "clx123",
        playerId: "clx456",
        incomingPlayerId: "clx789",
        role: "SUPPORT",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid action", () => {
      const result = draftSelectionSchema.safeParse({
        action: "invalid",
        matchId: "clx123",
        playerId: "clx456",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid role", () => {
      const result = draftSelectionSchema.safeParse({
        action: "add",
        matchId: "clx123",
        playerId: "clx456",
        role: "INVALID_ROLE",
      });
      expect(result.success).toBe(false);
    });

    it("rejects add without required fields", () => {
      const result = draftSelectionSchema.safeParse({
        action: "add",
        matchId: "clx123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("reconcileSchema", () => {
    it("validates valid input", () => {
      const result = reconcileSchema.safeParse({
        domains: ["PLAYER_GOALS_DERIVED_PROJECTION"],
      });
      expect(result.success).toBe(true);
    });

    it("validates dryRun defaults to false", () => {
      const result = reconcileSchema.safeParse({
        domains: ["PLAYER_GOALS_DERIVED_PROJECTION"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(false);
      }
    });

    it("rejects empty domains array", () => {
      const result = reconcileSchema.safeParse({
        domains: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid domain", () => {
      const result = reconcileSchema.safeParse({
        domains: ["INVALID_DOMAIN"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("auditQuerySchema", () => {
    it("validates empty query", () => {
      const result = auditQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("validates query with leagueSeasonId", () => {
      const result = auditQuerySchema.safeParse({
        leagueSeasonId: "clx123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-string leagueSeasonId", () => {
      const result = auditQuerySchema.safeParse({
        leagueSeasonId: 123,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("seasonExportSchema", () => {
    it("validates valid coach export", () => {
      const result = seasonExportSchema.safeParse({
        leagueSeasonId: "clx123",
        format: "csv",
        visibility: "coach",
      });
      expect(result.success).toBe(true);
    });

    it("validates valid parent export", () => {
      const result = seasonExportSchema.safeParse({
        leagueSeasonId: "clx123",
        format: "json",
        visibility: "parent",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid format", () => {
      const result = seasonExportSchema.safeParse({
        leagueSeasonId: "clx123",
        format: "xlsx",
        visibility: "coach",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid visibility", () => {
      const result = seasonExportSchema.safeParse({
        leagueSeasonId: "clx123",
        format: "csv",
        visibility: "public",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("selectionRoleSchema", () => {
    it("accepts valid roles", () => {
      expect(selectionRoleSchema.safeParse("CORE").success).toBe(true);
      expect(selectionRoleSchema.safeParse("SUPPORT").success).toBe(true);
      expect(selectionRoleSchema.safeParse("DEVELOPMENT").success).toBe(true);
      expect(selectionRoleSchema.safeParse("BACKFILL").success).toBe(true);
    });

    it("rejects invalid roles", () => {
      expect(selectionRoleSchema.safeParse("INVALID").success).toBe(false);
    });
  });

  describe("overrideReasonCategorySchema", () => {
    it("accepts all valid categories", () => {
      const categories = [
        "squad_too_small",
        "support_missing",
        "development_opportunity",
        "no_planned_match_opportunity",
        "availability_changed",
        "coach_judgement",
        "match_already_played",
        "data_correction",
        "other",
      ];
      for (const c of categories) {
        expect(overrideReasonCategorySchema.safeParse(c).success).toBe(true);
      }
    });

    it("rejects invalid category", () => {
      expect(overrideReasonCategorySchema.safeParse("just_because").success).toBe(false);
    });
  });
});