/**
 * Guided debrief wizard step order and per-step completeness (ADR-0152 §3, bundle
 * `03_POST_MATCH_DEBRIEF.md` §5-6). Pure and DB-free — the same predicates `v1.ts` already uses
 * to decide "has this been reviewed" also decide "can the coach click Continue", so the wizard
 * can never let a coach past a required step without the exact condition submission itself
 * enforces server-side.
 */

import { findDebriefReviewGaps, type DebriefAnswersSection, type DebriefReviewGap } from "./v1";

export const DEBRIEF_STEPS = [
  "team_execution",
  "worked",
  "needs_attention",
  "match_changes",
  "opponent_memory",
  "player_observations",
  "anything_else",
  "review",
] as const;

export type DebriefStep = (typeof DEBRIEF_STEPS)[number];

export const DEBRIEF_STEP_LABELS: Record<DebriefStep, string> = {
  team_execution: "Team execution",
  worked: "What worked",
  needs_attention: "Needs attention",
  match_changes: "What changed",
  opponent_memory: "Opponent memory",
  player_observations: "Player observations",
  anything_else: "Anything else",
  review: "Review & submit",
};

/** The four steps bundle §6 requires explicit review of before submission — same set
 * `findDebriefReviewGaps` checks. Every other step is optional. */
export const REQUIRED_DEBRIEF_STEPS: readonly DebriefReviewGap[] = ["team_execution", "worked", "needs_attention", "match_changes"];

function stepReviewGap(step: DebriefStep): DebriefReviewGap | null {
  return (REQUIRED_DEBRIEF_STEPS as readonly string[]).includes(step) ? (step as DebriefReviewGap) : null;
}

/** Whether the coach may Continue past this step — optional steps are always passable; a
 * required step needs its no-evidence-counts-as-reviewed condition satisfied. */
export function isStepComplete(step: DebriefStep, answers: DebriefAnswersSection): boolean {
  if (step === "review") return findDebriefReviewGaps(answers).length === 0;
  const gapId = stepReviewGap(step);
  if (!gapId) return true;
  return !findDebriefReviewGaps(answers).includes(gapId);
}

export function countReviewedRequiredSections(answers: DebriefAnswersSection): number {
  return REQUIRED_DEBRIEF_STEPS.length - findDebriefReviewGaps(answers).length;
}

/** Resumability — land a returning coach on the first still-incomplete required step, or on
 * the review step once every required step is already satisfied. */
export function computeInitialStep(answers: DebriefAnswersSection): DebriefStep {
  for (const step of DEBRIEF_STEPS) {
    if (step === "review") break;
    const gapId = stepReviewGap(step);
    if (gapId && !isStepComplete(step, answers)) return step;
  }
  return "review";
}
