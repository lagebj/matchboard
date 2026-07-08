import { describe, it, expect, beforeEach } from "vitest";
import {
  validateEngagementOverride,
  ENGAGEMENT_OVERRIDE_REASONS,
  type EngagementOverrideReason,
} from "../round-engagement";

describe("round-engagement", () => {
  describe("validateEngagementOverride", () => {
    it("accepts valid override reason with detail", () => {
      const result = validateEngagementOverride("injured", "Player rolled ankle at training");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts all valid override reasons", () => {
      const reasons = ENGAGEMENT_OVERRIDE_REASONS.map((r) => r.value);
      for (const reason of reasons) {
        const result = validateEngagementOverride(reason, "Valid detail for " + reason);
        expect(result.valid).toBe(true);
      }
    });

    it("rejects invalid override reason", () => {
      const result = validateEngagementOverride("invalid_reason", "Some detail");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid override reason");
    });

    it("rejects empty detail", () => {
      const result = validateEngagementOverride("coach_decision", "");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("rejects detail shorter than 3 characters", () => {
      const result = validateEngagementOverride("coach_decision", "ab");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 3 characters");
    });

    it("rejects detail that is only whitespace", () => {
      const result = validateEngagementOverride("coach_decision", "   ");
      expect(result.valid).toBe(false);
    });

    it("accepts detail with exactly 3 characters", () => {
      const result = validateEngagementOverride("other", "abc");
      expect(result.valid).toBe(true);
    });

    it("accepts capacity_impossible override", () => {
      const result = validateEngagementOverride("capacity_impossible", "Only one match this round, not enough slots for all players");
      expect(result.valid).toBe(true);
    });

    it("accepts parent_logistics override", () => {
      const result = validateEngagementOverride("parent_logistics", "Family event conflict, player cannot attend");
      expect(result.valid).toBe(true);
    });
  });

  describe("ENGAGEMENT_OVERRIDE_REASONS", () => {
    it("contains all required override reason categories", () => {
      const values = ENGAGEMENT_OVERRIDE_REASONS.map((r) => r.value);
      expect(values).toContain("injured");
      expect(values).toContain("late_withdrawal");
      expect(values).toContain("parent_logistics");
      expect(values).toContain("capacity_impossible");
      expect(values).toContain("coach_decision");
      expect(values).toContain("other");
    });

    it("each reason has a non-empty label and description", () => {
      for (const reason of ENGAGEMENT_OVERRIDE_REASONS) {
        expect(reason.label.length).toBeGreaterThan(0);
        expect(reason.description.length).toBeGreaterThan(0);
      }
    });
  });
});