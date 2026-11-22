import type { AssistantCommandCentre } from "@/lib/assistant/types";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import type { CoachDecision, CoachSituationProjection } from "@/lib/situational/situation-types";
import type { PlanIntegritySignal, RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type {
  TodaySelectionAvailability,
  TodaySelectionDecision,
} from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import { PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID } from "@/lib/situational/providers/plan-integrity-candidate-provider";

/**
 * Gate C W3 shared fixture builders — official register C07/C08
 * (`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`). Dev-only, fixture-backed, `CANDIDATE` only; see
 * `docs/ui-lab/gate-c-w3-candidates/` for the full review record.
 *
 * Deliberately its own directory, not a reuse of W1's `gate-c/shared/` or W2's
 * `gate-c/w2-shared/` — a shared-fixture-file edit silently invalidated prior waves' Visual
 * Authority approvals via ADR-0159's content-hash fingerprinting (issue #827, still open). Each
 * wave gets its own fixture directory precisely to avoid reproducing that trigger.
 *
 * A fixed Tuesday 15:00 Oslo (CET, UTC+1) instant — one day after W1/W2's own reference instant,
 * so this wave's fixtures are never byte-identical to an earlier wave's by coincidence.
 */
export const GATE_C_W3_NOW_ISO = "2026-11-11T14:00:00.000Z";
export const GATE_C_W3_NOW = new Date(GATE_C_W3_NOW_ISO);

export const GATE_C_W3_ORG_SLUG = "acme";

/** Mirrors `useOrgUrl()`'s real `/o/{slug}${path}` convention exactly. */
export function gateCW3OrgUrl(path: string): string {
  return `/o/${GATE_C_W3_ORG_SLUG}${path}`;
}

export function gateCW3BaseCommandCentre(overrides: Partial<AssistantCommandCentre> = {}): AssistantCommandCentre {
  return {
    leagueSeasonId: "season-2026-autumn",
    leagueSeasonName: "Autumn League 2026",
    items: [],
    todayMatches: [],
    dueDecisionReviews: [],
    roundPlanIntegrities: {},
    activeLiveSessions: {},
    computedAt: GATE_C_W3_NOW,
    ...overrides,
  };
}

/** The real loader's always-defined "nothing live" shape (`getTodayLiveMatchSummaries()`) — never
 * `undefined` (see Gate C W1's `today-surface.matchday-livenow-gate.test.tsx` incident). */
export function gateCW3NoLiveMatch(): TodayLiveNowResult {
  return { primary: null, otherLiveCount: 0 };
}

export type GateCW3DecisionDayFacts = {
  commandCentre: AssistantCommandCentre;
  selectionDecisions: TodaySelectionDecision[];
  liveNow: TodayLiveNowResult;
  projection: CoachSituationProjection;
  nowIso: string;
};

const C07_PRIMARY_SIGNAL_KEY = "gate-c-w3-c07-signal-primary-missing-opportunity";

/**
 * One genuine decision-day Today (register C07: "Decision day with capability OFF / ON") —
 * identical across every C07 scenario, so the OFF/ON/EMPTY/ERROR/STALE comparison is apples-to-
 * apples: only `assistantCoachContext` differs between them, exactly like W1's C02 proved the
 * real 2-item cap by varying only the candidate set, never the underlying mechanism.
 */
export function gateCW3DecisionDayFacts(): GateCW3DecisionDayFacts {
  const primarySignal: PlanIntegritySignal = {
    idempotencyKey: C07_PRIMARY_SIGNAL_KEY,
    kind: "DECISION_REQUIRED",
    ruleCode: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
    matchRoundId: "round-c07-1",
    playerId: "player-alex",
    title: "Alex has no planned opportunity this round",
    currentState: "Available and active, but not assigned to any match in Round 9.",
    consequence: "Alex misses a round with no recorded reason.",
    classificationReason: "An available, active player has no planned opportunity this round.",
    primaryActionLabel: "Open Round Board",
    primaryActionTarget: "/rounds/round-c07-1",
  };

  const primarySelectionDecision: TodaySelectionDecision = {
    signalKey: C07_PRIMARY_SIGNAL_KEY,
    playerId: "player-alex",
    displayName: "Alex Dahl",
    availability: "AVAILABLE",
    roundId: "round-c07-1",
    roundLabel: "Round 9",
    problemTitle: "Alex has no planned opportunity this round",
    problemDetail: "Available and active, but not assigned to any match in Round 9.",
    reasons: [{ text: "No core-team match currently needs additional players this round." }],
    recommendation: null,
    roundBoardHref: gateCW3OrgUrl("/rounds/round-c07-1"),
    decisionFingerprint: "gate-c-w3-c07-primary-fixture-fingerprint",
  };

  const roundPlanIntegrity: RoundPlanIntegrity = {
    matchRoundId: "round-c07-1",
    signals: [primarySignal],
    planningNotes: [],
    summary: {
      blockerCount: 0,
      decisionRequiredCount: 1,
      belowMinimumMatchCount: 0,
      unavailableSelectedPlayerCount: 0,
      missingOpportunityPlayerCount: 1,
      integrityFailureCount: 0,
    },
    coverage: { eligibleAvailablePlayerCount: 11, assignedEligibleAvailablePlayerCount: 10, unassignedEligibleAvailablePlayerIds: ["player-alex"] },
    computedAt: GATE_C_W3_NOW,
  };

  const primaryDecision: CoachDecision = {
    id: "gate-c-w3-c07-decision-primary",
    candidateId: `${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|${C07_PRIMARY_SIGNAL_KEY}`,
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

  return {
    commandCentre: gateCW3BaseCommandCentre({
      roundPlanIntegrities: { "round-c07-1": roundPlanIntegrity },
    }),
    selectionDecisions: [primarySelectionDecision],
    liveNow: gateCW3NoLiveMatch(),
    projection: {
      situation: { nowIso: GATE_C_W3_NOW_ISO, primarySituation: "NEXT", imminentMatchIds: [], temporal: {} },
      decisions: [primaryDecision],
      deferredCount: 0,
      status: "ACTION_REQUIRED",
      policyRuntimeStatus: "HEALTHY",
    },
    nowIso: GATE_C_W3_NOW_ISO,
  };
}

export type GateCW3QuickAddFacts = {
  commandCentre: AssistantCommandCentre;
  selectionDecisions: TodaySelectionDecision[];
  liveNow: TodayLiveNowResult;
  projection: CoachSituationProjection;
  nowIso: string;
};

/**
 * Register C08's Today-side "same-day quick add" decision — the real `TodaySelectionDecision`
 * shape `applyTodaySelectionRecommendationAction` consumes, restricted to shapes the real planner
 * (`today-selection-recommendation-plan.ts`) can actually produce, each confirmed against that
 * module's real logic (and, for "open"/"tentative", against the real DB-backed assertions in
 * `today/__tests__/actions.test.ts`) rather than invented:
 *
 * - `"open"`: `AVAILABLE`, `directlyActionable: true` — the real one-click "Add {player} to
 *   {team} vs {opponent}" action renders.
 * - `"tentative"`: `TENTATIVE` — the planner's `eligible` check requires availability to be
 *   exactly `"AVAILABLE"` (never `"TENTATIVE"`), so this always degrades to
 *   `directlyActionable: false` with the exact real `unavailableReason` string copied verbatim
 *   from the planner's own fallback chain, never invented.
 * - `"none"`: no viable open destination at all — `resolveTarget()` returns `null` in that case,
 *   so `TodaySelectionDecision.recommendation` itself is `null` (never a fabricated degraded
 *   object); the row falls back to the plain "Review on the Round Board." default text.
 *
 * Display-only here (`GateCW3TodayMount`'s `applyRecommendation` stub never mutates); the real
 * mutation is exercised by the real-DB integration tests in `today/__tests__/actions.test.ts`.
 */
export function gateCW3QuickAddFacts(recommendation: "open" | "tentative" | "none"): GateCW3QuickAddFacts {
  const availability: TodaySelectionAvailability = recommendation === "tentative" ? "TENTATIVE" : "AVAILABLE";
  const signalKey = `gate-c-w3-c08-signal-${recommendation}`;

  const decision: TodaySelectionDecision = {
    signalKey,
    playerId: "player-mia",
    displayName: "Mia Berg",
    availability,
    roundId: "round-c08-1",
    roundLabel: "Round 9",
    problemTitle: "Mia has no planned opportunity this round",
    problemDetail: "Available and active, but not assigned to any match in Round 9.",
    reasons: [{ text: "Blå's Round 9 squad has an open support slot." }],
    recommendation:
      recommendation === "none"
        ? null
        : {
            targetMatchId: "match-c08-1",
            targetTeamName: "Blå",
            opponentName: "Stoppen Juventus",
            role: "SUPPORT",
            fingerprint: `gate-c-w3-c08-recommendation-fingerprint-${recommendation}`,
            directlyActionable: recommendation === "open",
            dependsOnPrior: false,
            prerequisiteSignalKeys: [],
            unavailableReason: recommendation === "tentative" ? "Player availability is tentative — review before assigning." : null,
          },
    roundBoardHref: gateCW3OrgUrl("/rounds/round-c08-1"),
    decisionFingerprint: `gate-c-w3-c08-decision-fingerprint-${recommendation}`,
  };

  const signal: PlanIntegritySignal = {
    idempotencyKey: signalKey,
    kind: "DECISION_REQUIRED",
    ruleCode: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
    matchRoundId: "round-c08-1",
    playerId: "player-mia",
    title: decision.problemTitle,
    currentState: decision.problemDetail,
    consequence: "Mia misses a round with no recorded reason.",
    classificationReason: "An available, active player has no planned opportunity this round.",
    primaryActionLabel: "Open Round Board",
    primaryActionTarget: "/rounds/round-c08-1",
  };

  const roundPlanIntegrity: RoundPlanIntegrity = {
    matchRoundId: "round-c08-1",
    signals: [signal],
    planningNotes: [],
    summary: {
      blockerCount: 0,
      decisionRequiredCount: 1,
      belowMinimumMatchCount: 0,
      unavailableSelectedPlayerCount: 0,
      missingOpportunityPlayerCount: 1,
      integrityFailureCount: 0,
    },
    coverage: { eligibleAvailablePlayerCount: 11, assignedEligibleAvailablePlayerCount: 10, unassignedEligibleAvailablePlayerIds: ["player-mia"] },
    computedAt: GATE_C_W3_NOW,
  };

  const primaryDecision: CoachDecision = {
    id: `gate-c-w3-c08-decision-${signalKey}`,
    candidateId: `${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|${signalKey}`,
    situation: "NEXT",
    horizon: "NEXT",
    visibility: "PROMOTE",
    urgency: "NORMAL",
    interaction: "CHOOSE",
    title: signal.title,
    summary: signal.currentState,
    alternatives: [],
    affectedEntities: [],
    reasonCodes: ["MULTIPLE_ALTERNATIVES"],
  };

  return {
    commandCentre: gateCW3BaseCommandCentre({
      roundPlanIntegrities: { "round-c08-1": roundPlanIntegrity },
    }),
    selectionDecisions: [decision],
    liveNow: gateCW3NoLiveMatch(),
    projection: {
      situation: { nowIso: GATE_C_W3_NOW_ISO, primarySituation: "NEXT", imminentMatchIds: [], temporal: {} },
      decisions: [primaryDecision],
      deferredCount: 0,
      status: "ACTION_REQUIRED",
      policyRuntimeStatus: "HEALTHY",
    },
    nowIso: GATE_C_W3_NOW_ISO,
  };
}
