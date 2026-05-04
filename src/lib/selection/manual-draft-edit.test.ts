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
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        coreTeamId,
        coreTeamName,
        SelectionRole.CORE,
        false,
        "AVAILABLE",
        [activeSupportPath],
      );

      expect(errors).toHaveLength(0);
    });

    it("returns rotation path error for support without path", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        targetTeamId,
        targetTeamName,
        SelectionRole.SUPPORT,
        false,
        "AVAILABLE",
        [],
      );

      expect(errors).toHaveLength(1);
      const pathError = errors.find((e) => e.field === "rotationPath");
      expect(pathError).toBeDefined();
      expect(pathError!.message).toContain("rotation path");
    });

    it("returns availability error for unavailable player", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        targetTeamId,
        targetTeamName,
        SelectionRole.SUPPORT,
        false,
        "INJURED",
        [activeSupportPath],
      );

      const availabilityError = errors.find((e) => e.field === "availability");
      expect(availabilityError).toBeDefined();
      expect(availabilityError!.message).toContain("INJURED");
    });

    it("returns nonRotatable error for non-core movement", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        targetTeamId,
        targetTeamName,
        SelectionRole.SUPPORT,
        true,
        "AVAILABLE",
        [activeSupportPath],
      );

      const nonRotatableError = errors.find(
        (e) => e.field === "nonRotatable",
      );
      expect(nonRotatableError).toBeDefined();
      expect(nonRotatableError!.message).toContain("Non-rotatable");
    });

    it("marks path errors as requiresOverride", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        targetTeamId,
        targetTeamName,
        SelectionRole.SUPPORT,
        false,
        "AVAILABLE",
        [],
      );

      const pathError = errors.find((e) => e.field === "rotationPath");
      expect(pathError).toBeDefined();
      expect(pathError!.requiresOverride).toBe(true);
    });

    it("marks availability errors as requiresOverride", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        coreTeamId,
        coreTeamName,
        SelectionRole.CORE,
        false,
        "SICK",
        [],
      );

      const availabilityError = errors.find((e) => e.field === "availability");
      expect(availabilityError).toBeDefined();
      expect(availabilityError!.requiresOverride).toBe(true);
    });

    it("marks nonRotatable errors as requiresOverride", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        targetTeamId,
        targetTeamName,
        SelectionRole.DEVELOPMENT,
        true,
        "AVAILABLE",
        [],
      );

      const nonRotatableError = errors.find(
        (e) => e.field === "nonRotatable",
      );
      expect(nonRotatableError).toBeDefined();
      expect(nonRotatableError!.requiresOverride).toBe(true);
    });

    it("returns no errors when valid SUPPORT path exists", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        targetTeamId,
        targetTeamName,
        SelectionRole.SUPPORT,
        false,
        "AVAILABLE",
        [activeSupportPath],
      );

      expect(errors).toHaveLength(0);
    });

    it("returns path error when DEVELOPMENT role is used with SUPPORT-only path", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        targetTeamId,
        targetTeamName,
        SelectionRole.DEVELOPMENT,
        false,
        "AVAILABLE",
        [activeSupportPath],
      );

      const pathError = errors.find((e) => e.field === "rotationPath");
      expect(pathError).toBeDefined();
      expect(pathError!.requiresOverride).toBe(true);
    });

    it("returns no availability error for TENTATIVE player", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        coreTeamId,
        coreTeamName,
        SelectionRole.CORE,
        false,
        "TENTATIVE",
        [],
      );

      const availabilityError = errors.find(
        (e) => e.field === "availability",
      );
      expect(availabilityError).toBeUndefined();
    });

    it("returns no path error when player core team equals target team", () => {
      const errors = validateManualMatchEdit(
        coreTeamId,
        coreTeamName,
        coreTeamId,
        coreTeamName,
        SelectionRole.SUPPORT,
        false,
        "AVAILABLE",
        [],
      );

      const pathError = errors.find((e) => e.field === "rotationPath");
      expect(pathError).toBeUndefined();
    });
  });
});