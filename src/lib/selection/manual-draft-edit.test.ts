import { describe, it, expect } from "vitest";
import { SelectionRole } from "@/generated/prisma/client";
import {
  validateManualMatchEdit,
  validateOverrideReason,
} from "@/lib/selection/manual-draft-edit";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { HARD_RULE_OVERRIDE_CATEGORIES } from "@/lib/selection/types";

describe("manual-draft-edit", () => {
  const coreTeamId = "team-bla";
  const coreTeamName = "Bla";
  const targetTeamId = "team-hvit";
  const targetTeamName = "Hvit";

  const activeSupportPath = {
    fromTeamId: coreTeamId,
    toTeamId: targetTeamId,
    role: "SUPPORT",
    active: true,
  };

  describe("validateManualMatchEdit", () => {
    it("returns no errors for eligible core player", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId: coreTeamId,
        targetTeamName: coreTeamName,
        role: SelectionRole.CORE,
        nonRotatable: false,
        availability: "AVAILABLE",
        rotationPaths: [activeSupportPath],
      });

      expect(errors).toHaveLength(0);
    });

    it("returns rotation path error for support without path", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId,
        targetTeamName,
        role: SelectionRole.SUPPORT,
        nonRotatable: false,
        availability: "AVAILABLE",
        rotationPaths: [],
      });

      expect(errors).toHaveLength(1);
      const pathError = errors.find((e) => e.field === "rotationPath");
      expect(pathError).toBeDefined();
      expect(pathError!.message).toContain("rotation path");
    });

    it("returns availability error for unavailable player", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId,
        targetTeamName,
        role: SelectionRole.SUPPORT,
        nonRotatable: false,
        availability: "INJURED",
        rotationPaths: [activeSupportPath],
      });

      const availabilityError = errors.find((e) => e.field === "availability");
      expect(availabilityError).toBeDefined();
      expect(availabilityError!.message).toContain("INJURED");
    });

    it("returns nonRotatable error for non-core movement", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId,
        targetTeamName,
        role: SelectionRole.SUPPORT,
        nonRotatable: true,
        availability: "AVAILABLE",
        rotationPaths: [activeSupportPath],
      });

      const nonRotatableError = errors.find(
        (e) => e.field === "nonRotatable",
      );
      expect(nonRotatableError).toBeDefined();
      expect(nonRotatableError!.message).toContain("Non-rotatable");
    });

    it("marks path errors as requiresOverride", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId,
        targetTeamName,
        role: SelectionRole.SUPPORT,
        nonRotatable: false,
        availability: "AVAILABLE",
        rotationPaths: [],
      });

      const pathError = errors.find((e) => e.field === "rotationPath");
      expect(pathError).toBeDefined();
      expect(pathError!.requiresOverride).toBe(true);
    });

    it("marks availability errors as requiresOverride", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId: coreTeamId,
        targetTeamName: coreTeamName,
        role: SelectionRole.CORE,
        nonRotatable: false,
        availability: "SICK",
        rotationPaths: [],
      });

      const availabilityError = errors.find((e) => e.field === "availability");
      expect(availabilityError).toBeDefined();
      expect(availabilityError!.requiresOverride).toBe(true);
    });

    it("marks nonRotatable errors as requiresOverride", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId,
        targetTeamName,
        role: SelectionRole.DEVELOPMENT,
        nonRotatable: true,
        availability: "AVAILABLE",
        rotationPaths: [],
      });

      const nonRotatableError = errors.find(
        (e) => e.field === "nonRotatable",
      );
      expect(nonRotatableError).toBeDefined();
      expect(nonRotatableError!.requiresOverride).toBe(true);
    });

    it("returns no errors when valid SUPPORT path exists", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId,
        targetTeamName,
        role: SelectionRole.SUPPORT,
        nonRotatable: false,
        availability: "AVAILABLE",
        rotationPaths: [activeSupportPath],
      });

      expect(errors).toHaveLength(0);
    });

    it("returns path error when DEVELOPMENT role is used with SUPPORT-only path", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId,
        targetTeamName,
        role: SelectionRole.DEVELOPMENT,
        nonRotatable: false,
        availability: "AVAILABLE",
        rotationPaths: [activeSupportPath],
      });

      const pathError = errors.find((e) => e.field === "rotationPath");
      expect(pathError).toBeDefined();
      expect(pathError!.requiresOverride).toBe(true);
    });

    it("returns no availability error for TENTATIVE player", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId: coreTeamId,
        targetTeamName: coreTeamName,
        role: SelectionRole.CORE,
        nonRotatable: false,
        availability: "TENTATIVE",
        rotationPaths: [],
      });

      const availabilityError = errors.find(
        (e) => e.field === "availability",
      );
      expect(availabilityError).toBeUndefined();
    });

    it("returns no path error when player core team equals target team", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId: coreTeamId,
        targetTeamName: coreTeamName,
        role: SelectionRole.SUPPORT,
        nonRotatable: false,
        availability: "AVAILABLE",
        rotationPaths: [],
      });

      const pathError = errors.find((e) => e.field === "rotationPath");
      expect(pathError).toBeUndefined();
    });

    it("returns same-round conflict error when alreadyInRound is true", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId,
        targetTeamName,
        role: SelectionRole.SUPPORT,
        nonRotatable: false,
        availability: "AVAILABLE",
        rotationPaths: [activeSupportPath],
        alreadyInRound: true,
      });

      const conflictError = errors.find((e) => e.field === "sameRoundConflict");
      expect(conflictError).toBeDefined();
      expect(conflictError!.requiresOverride).toBe(true);
      expect(conflictError!.message).toContain("another match");
    });

    it("returns duplicate match error when alreadyInMatch is true", () => {
      const errors = validateManualMatchEdit({
        playerCoreTeamId: coreTeamId,
        playerCoreTeamName: coreTeamName,
        targetTeamId,
        targetTeamName,
        role: SelectionRole.CORE,
        nonRotatable: false,
        availability: "AVAILABLE",
        rotationPaths: [],
        alreadyInMatch: true,
      });

      const duplicateError = errors.find((e) => e.field === "duplicateMatch");
      expect(duplicateError).toBeDefined();
      expect(duplicateError!.requiresOverride).toBe(true);
      expect(duplicateError!.message).toContain("already selected");
    });
  });

  describe("validateOverrideReason", () => {
    it("requires a category when override reason is needed", () => {
      const errors = validateOverrideReason(undefined, undefined, false);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("required");
    });

    it("rejects invalid category", () => {
      const errors = validateOverrideReason("invalid_category" as OverrideReasonCategory, undefined, false);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Invalid");
    });

    it("accepts valid category without detail for non-hard-rule violations", () => {
      const errors = validateOverrideReason("coach_judgement", undefined, false);
      expect(errors).toHaveLength(0);
    });

    it("accepts valid category with detail", () => {
      const errors = validateOverrideReason("coach_judgement", "Player requested position change", false);
      expect(errors).toHaveLength(0);
    });

    it("requires detail for hard rule violations with hard rule categories", () => {
      const errors = validateOverrideReason("squad_too_small", undefined, true);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Detail is required");
    });

    it("accepts hard rule category with detail when hard rules are violated", () => {
      const errors = validateOverrideReason("squad_too_small", "Only 9 players available, minimum is 11", true);
      expect(errors).toHaveLength(0);
    });

    it("accepts hard rule category without detail when no hard rules are violated", () => {
      const errors = validateOverrideReason("squad_too_small", undefined, false);
      expect(errors).toHaveLength(0);
    });

    it("all hard rule override categories require detail when hard rules are violated", () => {
      for (const category of HARD_RULE_OVERRIDE_CATEGORIES) {
        const errors = validateOverrideReason(category, undefined, true);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it("all override reason categories are valid", () => {
      const allCategories: OverrideReasonCategory[] = [
        "squad_too_small",
        "support_missing",
        "development_opportunity",
        "double_load_needed",
        "availability_changed",
        "coach_judgement",
        "match_already_played",
        "data_correction",
        "other",
      ];
      for (const category of allCategories) {
        const errors = validateOverrideReason(category, "test detail", false);
        expect(errors).toHaveLength(0);
      }
    });
  });
});