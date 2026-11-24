import { describe, it, expect } from "vitest";
import {
  cumulativeDelta,
  requiresCoachApproval,
  isAutomaticallyEligibleByDistance,
  canResumeAutomationAfterManualEdit,
  APPROVAL_CUMULATIVE_TRIGGER,
} from "../materiality-policy";

describe("ADR-0160 §4 materiality policy (directional candidate's own pure logic)", () => {
  it("a one-point cumulative move from baseline does not require approval", () => {
    expect(requiresCoachApproval(6, 7)).toBe(false);
  });

  it("a two-point cumulative move from baseline requires approval — the exact threshold boundary", () => {
    expect(requiresCoachApproval(6, 8)).toBe(true);
  });

  it("a three-point cumulative move still requires approval (never silently escapes review)", () => {
    expect(requiresCoachApproval(6, 9)).toBe(true);
  });

  it("the trigger is symmetric for a cumulative decrease of the same magnitude", () => {
    expect(requiresCoachApproval(6, 4)).toBe(true);
    expect(requiresCoachApproval(6, 5)).toBe(false);
  });

  it("APPROVAL_CUMULATIVE_TRIGGER is exactly 2, matching ADR-0160 §4", () => {
    expect(APPROVAL_CUMULATIVE_TRIGGER).toBe(2);
  });

  it("cumulativeDelta reports the signed distance from baseline, not an absolute value", () => {
    expect(cumulativeDelta(6, 8)).toBe(2);
    expect(cumulativeDelta(6, 4)).toBe(-2);
  });

  describe("isAutomaticallyEligibleByDistance", () => {
    it("the first eligible one-point step from an untouched baseline is automatic", () => {
      expect(isAutomaticallyEligibleByDistance(6, 6, 7)).toBe(true);
    });

    it("a second one-point step, even though individually within the per-proposal cap, is NOT automatic once cumulative distance from baseline reaches two — this is exactly the defect this remediation corrects", () => {
      expect(isAutomaticallyEligibleByDistance(6, 7, 8)).toBe(false);
    });

    it("a single step larger than one point is never automatic regardless of cumulative distance", () => {
      expect(isAutomaticallyEligibleByDistance(6, 6, 8)).toBe(false);
    });
  });

  describe("canResumeAutomationAfterManualEdit (ADR-0160 §5)", () => {
    it("does not resume with insufficient post-edit matches, even with high confidence", () => {
      expect(canResumeAutomationAfterManualEdit(2, 0.9, false)).toBe(false);
    });

    it("does not resume with insufficient confidence, even with enough matches", () => {
      expect(canResumeAutomationAfterManualEdit(5, 0.6, false)).toBe(false);
    });

    it("resumes once both the match-count and confidence thresholds are met", () => {
      expect(canResumeAutomationAfterManualEdit(3, 0.7, false)).toBe(true);
      expect(canResumeAutomationAfterManualEdit(4, 0.81, false)).toBe(true);
    });

    it("an explicit lock blocks resumption regardless of how much qualifying evidence exists", () => {
      expect(canResumeAutomationAfterManualEdit(10, 0.95, true)).toBe(false);
    });

    it("no evidence at all (null confidence) never resumes, with no time-based fallback", () => {
      expect(canResumeAutomationAfterManualEdit(0, null, false)).toBe(false);
    });
  });
});
