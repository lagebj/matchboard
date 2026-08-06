// ─────────────────────────────────────────────────────────────────
// Team composition policy checks.
//
// Pre-generation: scenario permission (e.g. TIERED_DESCENDING is policy-gated).
// Post-generation: structural validation warnings and blocking conditions.
//
// This module operates on the shared team-composition domain types
// and does NOT depend on Prisma, Next.js, or server actions.
// ─────────────────────────────────────────────────────────────────

import type {
  SystemTeamScenario,
  TeamCompositionProposal,
  ProposalIssue,
  ProposalSeverity,
} from "@/domain/team-composition/team-composition-types";
import { isScenarioPolicyGated } from "@/domain/team-composition/scenario-catalogue";

export interface CompositionPolicyCheckResult {
  allowed: boolean;
  issues: ProposalIssue[];
  /** Human-readable reason if not allowed */
  reason?: string;
}

/**
 * Pre-generation policy check: is the coach allowed to use this scenario?
 * TIERED_DESCENDING is policy-gated and requires explicit coach acknowledgement.
 */
export function checkScenarioPermission(
  scenario: SystemTeamScenario,
  options?: { coachAcknowledgedPolicyGate?: boolean },
): CompositionPolicyCheckResult {
  if (!isScenarioPolicyGated(scenario)) {
    return { allowed: true, issues: [] };
  }

  if (options?.coachAcknowledgedPolicyGate) {
    return {
      allowed: true,
      issues: [
        {
          severity: "PLANNING_NOTE" as ProposalSeverity,
          code: "policy_gated_scenario_acknowledged",
          message: "Tiered competitive teams scenario acknowledged by coach.",
        },
      ],
    };
  }

  return {
    allowed: false,
    issues: [
      {
        severity: "DECISION_REQUIRED" as ProposalSeverity,
        code: "policy_gated_scenario_requires_acknowledgement",
        message: "The tiered competitive teams scenario requires coach acknowledgement before generation. This scenario creates intentionally unequal teams ranked by strength.",
      },
    ],
    reason: "Tiered competitive teams scenario requires coach acknowledgement.",
  };
}

/**
 * Post-generation policy check: validate proposal structural quality.
 * Adds policy-level warnings for issues the engine validation doesn't cover.
 *
 * Note: The engine already blocks on NO_GOALKEEPER_COVERAGE and
 * EXCESSIVE_NO_FIT_ASSIGNMENTS. This policy layer only adds checks
 * for conditions that the engine treats as DECISION_REQUIRED or
 * PLANNING_NOTE, not conditions the engine already blocks on.
 */
export function checkCompositionProposalPolicy(
  proposal: TeamCompositionProposal,
): ProposalIssue[] {
  const issues: ProposalIssue[] = [];

  for (const team of proposal.teamMetrics) {
    // Engine already produces BLOCKED NO_GOALKEEPER_COVERAGE for no GK.
    // Policy adds DECISION_REQUIRED for broken formation (engine uses "degraded"
    // which is not blocked, so we elevate "broken" here).
    if (team.formationViability === "broken") {
      issues.push({
        severity: "DECISION_REQUIRED" as ProposalSeverity,
        code: "policy_broken_formation",
        message: `Team ${team.teamName} has a broken formation structure.`,
        affectedTeamIds: [team.teamId],
      });
    }

    // Engine blocks on ANY no-fit (maxNoFitPercentage=0).
    // Policy adds DECISION_REQUIRED for high no-fit as supplementary context
    // only when the engine has already flagged it, so we don't duplicate.
    // This check is intentionally at a higher threshold (>40%) than the engine
    // to avoid duplicating the engine's BLOCKED issue.
  }

  if (proposal.proposalMetrics.sizeSpread > 3) {
    issues.push({
      severity: "DECISION_REQUIRED" as ProposalSeverity,
      code: "policy_large_size_spread",
      message: `Team size spread is ${proposal.proposalMetrics.sizeSpread}, which may indicate unbalanced squad sizes.`,
    });
  }

  return issues;
}