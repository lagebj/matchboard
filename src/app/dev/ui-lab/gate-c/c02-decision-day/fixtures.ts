import type { AssistantWorkItem } from "@/lib/assistant/types";
import type { CoachDecision, CoachSituationProjection } from "@/lib/situational/situation-types";
import type { PlanIntegritySignal, RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type { TodaySelectionDecision } from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import { PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID } from "@/lib/situational/providers/plan-integrity-candidate-provider";
import { gateCBaseCommandCentre, gateCNoLiveMatch, gateCOrgUrl, GATE_C_NOW, GATE_C_NOW_ISO } from "../shared/fixtures";

/**
 * C02 — Decision day (register: "One primary/2 secondary", "Priority tied to actual situation,
 * sources disclosed", XR-V01).
 *
 * P2-03 remediation (independent review of PR #826): the primary decision is a genuine identity
 * collision, not just a count cap. `primarySelectionDecision.signalKey` is the exact same real
 * identity (`PRIMARY_KEY`) as `primarySignal.idempotencyKey` in `roundPlanIntegrities` — the real
 * production coupling (a `TodaySelectionDecision` is always built FROM an
 * `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` plan-integrity signal, same key both places).
 * `resolveTodayPrimaryAction()`'s own step 1 (never re-implemented here) resolves this to a
 * `SELECTION_DECISION` primary action; `today-surface.tsx`'s own existing
 * `remainingSelectionDecisions` filter (never a new dedup algorithm) is what must keep this exact
 * decision from also appearing in the secondary Selection decisions list. A second, independent
 * `secondarySelectionDecision` (different signalKey) proves a genuinely different decision still
 * renders — this is not merely "nothing else was passed in."
 */

const PRIMARY_SIGNAL_KEY = "gate-c-w1-signal-primary-missing-opportunity";

export const primarySignal: PlanIntegritySignal = {
  idempotencyKey: PRIMARY_SIGNAL_KEY,
  kind: "DECISION_REQUIRED",
  ruleCode: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
  matchRoundId: "round-c02-1",
  playerId: "player-jonas",
  title: "Jonas has no planned opportunity this round",
  currentState: "Available and active, but not assigned to any match in Round 9.",
  consequence: "Jonas misses a round with no recorded reason.",
  classificationReason: "An available, active player has no planned opportunity this round.",
  primaryActionLabel: "Open Round Board",
  primaryActionTarget: "/rounds/round-c02-1",
};

export const primarySelectionDecision: TodaySelectionDecision = {
  signalKey: PRIMARY_SIGNAL_KEY,
  playerId: "player-jonas",
  displayName: "Jonas",
  availability: "AVAILABLE",
  roundId: "round-c02-1",
  roundLabel: "Round 9",
  problemTitle: "Jonas has no planned opportunity this round",
  problemDetail: "Available and active, but not assigned to any match in Round 9.",
  reasons: [{ text: "No core-team match currently needs additional players this round." }],
  recommendation: null,
  roundBoardHref: gateCOrgUrl("/rounds/round-c02-1"),
  decisionFingerprint: "gate-c-w1-c02-primary-fixture-fingerprint",
};

const secondaryPlanningSignal: PlanIntegritySignal = {
  idempotencyKey: "gate-c-w1-signal-secondary-duplicate-assignment",
  kind: "DECISION_REQUIRED",
  ruleCode: "DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE",
  matchRoundId: "round-c02-2",
  title: "Theodor is planned twice in Round 10",
  currentState: "Theodor appears in both Blå and Vollen's Round 10 squads.",
  consequence: "One assignment must be removed before the round can be finalized.",
  classificationReason: "A duplicate planned assignment needs a decision before the round can be finalized.",
  primaryActionLabel: "Resolve in Round Board",
  primaryActionTarget: "/rounds/round-c02-2",
};

const roundPlanIntegrity = (matchRoundId: string, signals: PlanIntegritySignal[]): RoundPlanIntegrity => ({
  matchRoundId,
  signals,
  planningNotes: [],
  summary: {
    blockerCount: signals.filter((s) => s.kind === "BLOCKED").length,
    decisionRequiredCount: signals.filter((s) => s.kind === "DECISION_REQUIRED").length,
    belowMinimumMatchCount: 0,
    unavailableSelectedPlayerCount: 0,
    missingOpportunityPlayerCount: signals.filter((s) => s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY").length,
    integrityFailureCount: signals.filter((s) => s.ruleCode === "DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE").length,
  },
  coverage: { eligibleAvailablePlayerCount: 11, assignedEligibleAvailablePlayerCount: 10, unassignedEligibleAvailablePlayerIds: ["player-jonas"] },
  computedAt: GATE_C_NOW,
});

export const secondarySelectionDecision: TodaySelectionDecision = {
  signalKey: "gate-c-w1-signal-secondary-missing-opportunity",
  playerId: "player-noah",
  displayName: "Noah",
  availability: "AVAILABLE",
  roundId: "round-c02-3",
  roundLabel: "Round 7",
  problemTitle: "Noah has no planned opportunity this round",
  problemDetail: "Available and active, but not assigned to any match in Round 7.",
  reasons: [{ text: "No core-team match needs additional players this round." }],
  recommendation: null,
  roundBoardHref: gateCOrgUrl("/rounds/round-c02-3"),
  decisionFingerprint: "gate-c-w1-c02-secondary-fixture-fingerprint",
};

const secondaryOtherWorkItem: AssistantWorkItem = {
  id: "gate-c-w1-work-round-11-setup",
  category: "setup_missing",
  priority: 3,
  title: "Round 11 squads not yet opened",
  summary: "Planning for Round 11 has not been started.",
  matchRoundId: "round-c02-4",
  affectedTeamIds: [],
  affectedPlayerIds: [],
  primaryActionLabel: "Open Round 11",
  primaryActionHref: gateCOrgUrl("/rounds/round-c02-4"),
};

const primaryDecision: CoachDecision = {
  id: "gate-c-w1-decision-primary",
  candidateId: `${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|${PRIMARY_SIGNAL_KEY}`,
  situation: "NEXT",
  horizon: "NEXT",
  visibility: "PROMOTE",
  urgency: "NORMAL",
  interaction: "CHOOSE",
  title: primarySignal.title,
  summary: primarySignal.currentState,
  alternatives: [],
  affectedEntities: [],
  reasonCodes: ["MULTIPLE_ALTERNATIVES"],
};

export const nowIso = GATE_C_NOW_ISO;

export const projection: CoachSituationProjection = {
  situation: { nowIso: GATE_C_NOW_ISO, primarySituation: "NEXT", imminentMatchIds: [], temporal: {} },
  decisions: [primaryDecision],
  deferredCount: 0,
  status: "ACTION_REQUIRED",
  policyRuntimeStatus: "HEALTHY",
};

export const commandCentre = gateCBaseCommandCentre({
  items: [secondaryOtherWorkItem],
  roundPlanIntegrities: {
    "round-c02-1": roundPlanIntegrity("round-c02-1", [primarySignal]),
    "round-c02-2": roundPlanIntegrity("round-c02-2", [secondaryPlanningSignal]),
  },
});

export const liveNow = gateCNoLiveMatch();
export const selectionDecisions: TodaySelectionDecision[] = [primarySelectionDecision, secondarySelectionDecision];
