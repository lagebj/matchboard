import type { AssistantWorkItem } from "@/lib/assistant/types";
import type { CoachDecision, CoachSituationProjection } from "@/lib/situational/situation-types";
import type { PlanIntegritySignal, RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type { TodaySelectionDecision } from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import { PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID } from "@/lib/situational/providers/plan-integrity-candidate-provider";
import { gateCBaseCommandCentre, gateCNoLiveMatch, GATE_C_FIXTURE_COMPUTED_AT } from "../shared/fixtures";

/**
 * C02 — Decision day (register: "One primary/2 secondary", "Priority tied to actual situation,
 * sources disclosed", XR-V01). A real top projection decision drives `resolveTodayPrimaryAction()`
 * to the `PLAN_INTEGRITY_SIGNAL` branch; three genuine secondary candidates across all three
 * sources (selection/planning/other) prove the real `MAX_DECISION_DAY_SECONDARY_ITEMS = 2` cap
 * actually drops the third one, rather than hand-picking exactly two to begin with.
 */

const PRIMARY_SIGNAL_KEY = "gate-c-w1-signal-primary-squad-below-min";

export const primarySignal: PlanIntegritySignal = {
  idempotencyKey: PRIMARY_SIGNAL_KEY,
  kind: "BLOCKED",
  ruleCode: "SQUAD_BELOW_MINIMUM",
  matchRoundId: "round-c02-1",
  matchId: "match-c02-1",
  title: "Squad below minimum for Saturday's match",
  currentState: "7 of 11 minimum players planned for Round 9 vs Stoppen Juventus.",
  consequence: "The match may not be playable if the squad is not completed before kickoff.",
  classificationReason: "Round 9's squad is currently below Matchboard's configured minimum for this match.",
  primaryActionLabel: "Open Round Board",
  primaryActionTarget: "/rounds/round-c02-1",
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
    belowMinimumMatchCount: signals.filter((s) => s.ruleCode === "SQUAD_BELOW_MINIMUM").length,
    unavailableSelectedPlayerCount: 0,
    missingOpportunityPlayerCount: 0,
    integrityFailureCount: signals.filter((s) => s.ruleCode === "DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE").length,
  },
  coverage: { eligibleAvailablePlayerCount: 11, assignedEligibleAvailablePlayerCount: 7, unassignedEligibleAvailablePlayerIds: [] },
  computedAt: GATE_C_FIXTURE_COMPUTED_AT,
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
  roundBoardHref: "/rounds/round-c02-3",
  decisionFingerprint: "gate-c-w1-c02-selection-fixture-fingerprint",
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
  primaryActionHref: "/rounds/round-c02-4",
};

const primaryDecision: CoachDecision = {
  id: "gate-c-w1-decision-primary",
  candidateId: `${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|${PRIMARY_SIGNAL_KEY}`,
  situation: "NEXT",
  horizon: "NEXT",
  visibility: "PROMOTE",
  urgency: "IMMEDIATE",
  interaction: "INFORM",
  title: primarySignal.title,
  summary: primarySignal.currentState,
  alternatives: [],
  affectedEntities: [],
  reasonCodes: ["HARD_CONSEQUENCE"],
};

export const projection: CoachSituationProjection = {
  situation: { nowIso: GATE_C_FIXTURE_COMPUTED_AT.toISOString(), primarySituation: "NEXT", imminentMatchIds: [], temporal: {} },
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
export const selectionDecisions: TodaySelectionDecision[] = [secondarySelectionDecision];
