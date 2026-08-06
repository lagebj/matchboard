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
 * Adds policy-level warnings for issues the engine didn't catch.
 */
export function checkCompositionProposalPolicy(
  proposal: TeamCompositionProposal,
): ProposalIssue[] {
  const issues: ProposalIssue[] = [];

  for (const team of proposal.teamMetrics) {
    if (team.goalkeeperCoverage === "none" && team.squadSize > 0) {
      issues.push({
        severity: "BLOCKED" as ProposalSeverity,
        code: "policy_no_goalkeeper_coverage",
        message: `Team ${team.teamName} has no goalkeeper coverage.`,
        affectedTeamIds: [team.teamId],
      });
    }

    if (team.formationViability === "broken") {
      issues.push({
        severity: "DECISION_REQUIRED" as ProposalSeverity,
        code: "policy_broken_formation",
        message: `Team ${team.teamName} has a broken formation structure.`,
        affectedTeamIds: [team.teamId],
      });
    }

    if (team.noFitCount > 0 && team.squadSize > 0) {
      const pct = Math.round((team.noFitCount / team.squadSize) * 100);
      if (pct > 40) {
        issues.push({
          severity: "DECISION_REQUIRED" as ProposalSeverity,
          code: "policy_high_no_fit_percentage",
          message: `Team ${team.teamName} has ${pct}% of players in positions with no fit (${team.noFitCount} of ${team.squadSize}).`,
          affectedTeamIds: [team.teamId],
        });
      }
    }
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