/**
 * ADR-0160 §4's materiality thresholds, centralized so this directional candidate's components
 * and tests share one source rather than duplicating the policy's numbers per call site —
 * mirroring the ADR's own instruction that these thresholds be "centralized, versioned, and
 * independently testable." This module has no production equivalent yet (see
 * `material-approval-review.tsx`'s header comment); it exists only to keep this UI Lab
 * candidate's own numbers internally consistent and directly unit-testable.
 */
export const MATERIALITY_POLICY_VERSION = "ADR-0160-v1" as const;

export const AUTOMATIC_SINGLE_STEP_CAP = 1;
export const AUTOMATIC_CUMULATIVE_CAP = 1;
export const APPROVAL_CUMULATIVE_TRIGGER = 2;
export const MIN_MATCHES_FOR_AUTOMATIC = 3;
export const MIN_CONFIDENCE_FOR_AUTOMATIC = 0.7;

export function cumulativeDelta(baselineValue: number, candidateValue: number): number {
  return candidateValue - baselineValue;
}

/**
 * True once the absolute cumulative movement from baseline reaches the ADR-0160 §4 approval
 * trigger (2 points) — this is evaluated against the baseline, not against the immediately prior
 * value, so several individually-eligible one-point steps cannot evade review by never crossing
 * the threshold "one step at a time."
 */
export function requiresCoachApproval(baselineValue: number, candidateValue: number): boolean {
  return Math.abs(cumulativeDelta(baselineValue, candidateValue)) >= APPROVAL_CUMULATIVE_TRIGGER;
}

/**
 * True when a single proposed step stays within every ADR-0160 §4 automatic condition this pure
 * check can express: the step itself is no more than one point, AND the resulting cumulative
 * distance from baseline is no more than one point. Match-count and confidence eligibility are
 * evaluated by the caller (they are not distance calculations).
 */
export function isAutomaticallyEligibleByDistance(
  baselineValue: number,
  currentAppliedValue: number,
  proposedValue: number,
): boolean {
  const stepSize = Math.abs(proposedValue - currentAppliedValue);
  const cumulativeIfApplied = Math.abs(cumulativeDelta(baselineValue, proposedValue));
  return stepSize <= AUTOMATIC_SINGLE_STEP_CAP && cumulativeIfApplied <= AUTOMATIC_CUMULATIVE_CAP;
}

/**
 * ADR-0160 §5: after a manual edit rebases one attribute, automatic evaluation for THAT
 * attribute resumes only once enough independent post-edit evidence has accumulated (no
 * time-based expiry), and never while the coach has an explicit lock in place.
 */
export function canResumeAutomationAfterManualEdit(
  matchesSinceEdit: number,
  confidenceSinceEdit: number | null,
  locked: boolean,
): boolean {
  if (locked) return false;
  if (confidenceSinceEdit === null) return false;
  return matchesSinceEdit >= MIN_MATCHES_FOR_AUTOMATIC && confidenceSinceEdit >= MIN_CONFIDENCE_FOR_AUTOMATIC;
}
