import { describe, it, expect } from "vitest";
import { SelectionRole } from "@/generated/prisma/client";
import {
  validateManualMatchEdit,
} from "@/lib/selection/manual-draft-edit";

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
});