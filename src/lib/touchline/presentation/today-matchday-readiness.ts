/**
 * Today Matchday readiness model and primary-action resolver (Today Matchday Follow-up bundle,
 * ADR-0143). Pure, DB-free: every fact here is supplied by the caller, which has already
 * batch-loaded it (D3.4-3.11) — this module only shapes those facts into a `TodayMatchdayAction`
 * following the fixed priority order, and formats the compact readiness copy Matchday renders.
 *
 * No manually-ticked checklist, no invented tactics readiness, no organisation-wide Squad Today
 * substitution — see `01_FIXED_DECISIONS.md` D6-D8.
 */

import type { PlanIntegritySignal } from "@/lib/selection/compute-plan-integrity";

export type TodayMatchdaySelectionState = "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED" | null;

export type SelectedPlayerAvailabilityState = "AVAILABLE" | "DOUBTFUL" | "UNAVAILABLE" | "UNKNOWN";

export type TodayMatchdayAffectedPlayer = {
  playerId: string;
  displayName: string;
  state: SelectedPlayerAvailabilityState;
};

export type TodayMatchdayReadiness = {
  selection: {
    state: TodayMatchdaySelectionState;
    selectedCount: number | null;
    targetCount: number | null;
  };
  selectedAvailability: {
    selectedCount: number;
    availableCount: number;
    doubtfulCount: number;
    unavailableCount: number;
    unknownCount: number;
    affectedPlayers: TodayMatchdayAffectedPlayer[];
  } | null;
  lineup: { state: "READY" | "MISSING" | "NOT_APPLICABLE" | "UNKNOWN" };
  tactics: { state: "READY" | "MISSING" | "UNKNOWN" };
  plannedRotations: { count: number } | null;
  /** Match-scoped plan-integrity blockers/decisions, already filtered by the caller to this one
   * featured match (D3.10 "do not recompute a League round solely for Matchday"). Carried as
   * full signals (not just ids) so Matchday can render the same title/current-state/action a
   * Planning Attention row would, without a second lookup — the `*SignalIds` convenience arrays
   * below exist only for Today-level identity deduplication (D12). */
  blockingSignals: PlanIntegritySignal[];
  decisionSignals: PlanIntegritySignal[];
};

export function blockingSignalIds(readiness: TodayMatchdayReadiness): string[] {
  return readiness.blockingSignals.map((s) => s.idempotencyKey);
}

export function decisionSignalIds(readiness: TodayMatchdayReadiness): string[] {
  return readiness.decisionSignals.map((s) => s.idempotencyKey);
}

/** Maps a raw `Player.currentAvailability` value into the 3-state model Matchday's selected-
 * player summary reasons about. Anything not explicitly AVAILABLE/TENTATIVE/known-unavailable
 * becomes UNKNOWN rather than a fabricated guess. */
export function mapPlayerAvailabilityToMatchdayState(availability: string): SelectedPlayerAvailabilityState {
  switch (availability) {
    case "AVAILABLE":
      return "AVAILABLE";
    case "TENTATIVE":
      return "DOUBTFUL";
    case "UNAVAILABLE":
    case "INJURED":
    case "SICK":
    case "AWAY":
      return "UNAVAILABLE";
    default:
      return "UNKNOWN";
  }
}

export function buildSelectedAvailability(
  players: Array<{ playerId: string; displayName: string; availability: string }>,
): TodayMatchdayReadiness["selectedAvailability"] {
  if (players.length === 0) return null;

  const mapped = players.map((p) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    state: mapPlayerAvailabilityToMatchdayState(p.availability),
  }));

  const byState = (state: SelectedPlayerAvailabilityState) => mapped.filter((p) => p.state === state);
  const unavailable = byState("UNAVAILABLE");
  const doubtful = byState("DOUBTFUL");
  const unknown = byState("UNKNOWN");
  const available = byState("AVAILABLE");

  // Priority order for which affected players surface first (D3.6): unavailable, then doubtful,
  // then unknown-if-meaningful.
  const affectedPlayers = [...unavailable, ...doubtful, ...unknown];

  return {
    selectedCount: mapped.length,
    availableCount: available.length,
    doubtfulCount: doubtful.length,
    unavailableCount: unavailable.length,
    unknownCount: unknown.length,
    affectedPlayers,
  };
}

/** Formats the squad-planned line, e.g. `9 of 10 planned` or `9 players planned` when no target
 * size is known (D3.5 "do not invent target size"). */
export function formatSquadPlannedLine(selection: TodayMatchdayReadiness["selection"]): string {
  const selected = selection.selectedCount ?? 0;
  if (selection.targetCount != null) return `${selected} of ${selection.targetCount} planned`;
  return `${selected} players planned`;
}

/** Formats the selected-availability line, e.g. `10/10 selected players available` when
 * everyone is available, or `9 available · 1 doubtful` otherwise (D3.6). */
export function formatSelectedAvailabilityLine(av: NonNullable<TodayMatchdayReadiness["selectedAvailability"]>): string {
  if (av.doubtfulCount === 0 && av.unavailableCount === 0 && av.unknownCount === 0) {
    return `${av.availableCount}/${av.selectedCount} selected players available`;
  }
  const parts: string[] = [`${av.availableCount} available`];
  if (av.doubtfulCount > 0) parts.push(`${av.doubtfulCount} doubtful`);
  if (av.unavailableCount > 0) parts.push(`${av.unavailableCount} unavailable`);
  if (av.unknownCount > 0) parts.push(`${av.unknownCount} unknown`);
  return parts.join(" · ");
}

function formatAffectedPlayersClause(players: TodayMatchdayAffectedPlayer[], verbPlural: string): {
  subject: string;
  verb: string;
} {
  if (players.length === 1) return { subject: players[0].displayName, verb: "is" };
  if (players.length === 2) {
    return { subject: `${players[0].displayName} and ${players[1].displayName}`, verb: verbPlural };
  }
  return {
    subject: `${players[0].displayName}, ${players[1].displayName} +${players.length - 2}`,
    verb: verbPlural,
  };
}

/** e.g. `Emil is unavailable`, `Noah and Theodor are unavailable`, `Noah, Theodor +2 unavailable`. */
export function formatUnavailablePlayersTitle(players: TodayMatchdayAffectedPlayer[]): string {
  if (players.length <= 2) {
    const { subject, verb } = formatAffectedPlayersClause(players, "are");
    return `${subject} ${verb} unavailable`;
  }
  const { subject } = formatAffectedPlayersClause(players, "are");
  return `${subject} unavailable`;
}

/** e.g. `Noah is doubtful`, `Noah and Theodor are doubtful`, `Noah, Theodor +2 doubtful`. */
export function formatDoubtfulPlayersTitle(players: TodayMatchdayAffectedPlayer[]): string {
  if (players.length <= 2) {
    const { subject, verb } = formatAffectedPlayersClause(players, "are");
    return `${subject} ${verb} doubtful`;
  }
  const { subject } = formatAffectedPlayersClause(players, "are");
  return `${subject} doubtful`;
}

export type TodayMatchdayActionKind =
  | "HARD_BLOCKER"
  | "UNAVAILABLE_PLAYER"
  | "DOUBTFUL_PLAYER"
  | "MISSING_LINEUP"
  | "MISSING_TACTICS"
  | "PLANNING_SIGNAL"
  | "START_LIVE"
  | "REVIEW_MATCH";

export type TodayMatchdayAction = {
  kind: TodayMatchdayActionKind;
  title: string;
  detail: string | null;
  actionLabel: string;
  actionHref: string;
  /** The existing signal identity this action represents, so composition can exclude it from
   * Selection decisions / Planning attention / Other attention (D12). Null when the action is a
   * fact Matchday derives locally (availability/lineup/tactics) with no separate pre-existing
   * representation elsewhere on Today. */
  consumedSignalId: string | null;
};

/**
 * Resolves the single Matchday primary action from readiness + phase, following the exact
 * priority order in D3.11. Never lets "Start live reporting" outrank a known unavailable
 * selected player or missing required lineup (D3.11 closing rule).
 */
export function resolveTodayMatchdayAction(input: {
  phase: "PREPARE" | "VERIFY" | "IMMINENT" | "LIVE" | "POST_MATCH";
  readiness: TodayMatchdayReadiness;
  canEnterLiveReporting: boolean;
  startLiveHref: string;
  reviewHref: string;
  availabilityReviewHref: string;
  lineupReviewHref: string;
}): TodayMatchdayAction {
  const { readiness } = input;

  // 1. Hard match-scoped blocker.
  const blocker = readiness.blockingSignals[0];
  if (blocker) {
    return {
      kind: "HARD_BLOCKER",
      title: blocker.title,
      detail: blocker.currentState,
      actionLabel: blocker.primaryActionLabel,
      actionHref: blocker.primaryActionTarget,
      consumedSignalId: blocker.idempotencyKey,
    };
  }

  // 2. Selected player unavailable.
  const unavailable = readiness.selectedAvailability?.affectedPlayers.filter((p) => p.state === "UNAVAILABLE") ?? [];
  if (unavailable.length > 0) {
    return {
      kind: "UNAVAILABLE_PLAYER",
      title: formatUnavailablePlayersTitle(unavailable),
      detail: null,
      actionLabel: "Review squad",
      actionHref: input.availabilityReviewHref,
      consumedSignalId: null,
    };
  }

  // 3. Selected player doubtful/tentative requiring review.
  const doubtful = readiness.selectedAvailability?.affectedPlayers.filter((p) => p.state === "DOUBTFUL") ?? [];
  if (doubtful.length > 0) {
    return {
      kind: "DOUBTFUL_PLAYER",
      title: formatDoubtfulPlayersTitle(doubtful),
      detail: "Review before kickoff.",
      actionLabel: "Review squad",
      actionHref: input.availabilityReviewHref,
      consumedSignalId: null,
    };
  }

  // 4. Missing lineup.
  if (readiness.lineup.state === "MISSING") {
    return {
      kind: "MISSING_LINEUP",
      title: "Starting line-up not prepared",
      detail: null,
      actionLabel: "Prepare lineup",
      actionHref: input.lineupReviewHref,
      consumedSignalId: null,
    };
  }

  // 5. Missing tactics, only when canonically knowable (D7 — never invented).
  if (readiness.tactics.state === "MISSING") {
    return {
      kind: "MISSING_TACTICS",
      title: "Tactics not prepared",
      detail: null,
      actionLabel: "Set up tactics",
      actionHref: input.lineupReviewHref,
      consumedSignalId: null,
    };
  }

  // 6. Other concrete match-scoped planning decision.
  const decision = readiness.decisionSignals[0];
  if (decision) {
    return {
      kind: "PLANNING_SIGNAL",
      title: decision.title,
      detail: decision.currentState,
      actionLabel: decision.primaryActionLabel,
      actionHref: decision.primaryActionTarget,
      consumedSignalId: decision.idempotencyKey,
    };
  }

  // 7. Inside the imminent window: enter the existing canonical Start live reporting flow.
  if (input.phase === "IMMINENT" && input.canEnterLiveReporting) {
    return {
      kind: "START_LIVE",
      title: "Start live reporting",
      detail: null,
      actionLabel: "Start live reporting",
      actionHref: input.startLiveHref,
      consumedSignalId: null,
    };
  }

  // 8. Review/open match — nothing else outranks it.
  return {
    kind: "REVIEW_MATCH",
    title: "Match details",
    detail: null,
    actionLabel: "Open match",
    actionHref: input.reviewHref,
    consumedSignalId: null,
  };
}
