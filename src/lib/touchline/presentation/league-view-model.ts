/**
 * League operating-surface presentation view model (Matchboard League Operating Surface bundle,
 * `03_DATA_CONTRACT_AND_VIEW_MODEL.md` / `02_ROUND_TEMPORAL_AND_OPERATIONAL_MODEL.md`).
 *
 * Pure, DB-free. Consumes the existing `FixturesOverview` shape unchanged
 * (`src/domain/fixtures/service.ts`, `getFixturesOverview()`) and decides:
 *
 * - which round is "current" — a TEMPORAL fact (real kickoff dates in Matchboard's Europe/Oslo
 *   display ISO week), never "first non-finalized" and never derived from `MatchRound.name`;
 * - which round is the default *focused* round when the URL doesn't pin one;
 * - the season rail's week slots;
 * - each match's one primary operational issue, with truthful signal-to-match ownership;
 * - past-round closure (canonical match lifecycle, never `MatchRound.status === "FINALIZED"`
 *   alone);
 * - the recent/earlier history split.
 *
 * This replaces the previous `buildLeagueViewModel()`, which hard-coded `isCurrent: false` on
 * every round and fell back to "first non-finalized round" as its feature-round definition (bundle
 * `00_AUTHORITY_SCOPE_AND_CURRENT_STATE.md` defect A). That fallback is removed entirely.
 */
import type { FixturePeriod, FixtureRound, FixtureMatch, FixturePlanningSignal } from "@/domain/fixtures/types";
import { getDisplayIsoWeekKey, getWeekRange, formatIsoWeekKey, getDisplayDateKey } from "@/lib/date-utils";

/* ------------------------------------------------------------------------------------------ */
/* Rail                                                                                          */
/* ------------------------------------------------------------------------------------------ */

export type LeagueRailSlotState = "EMPTY" | "FINAL" | "NEEDS_CLOSURE" | "CURRENT" | "ATTENTION" | "UPCOMING";

export type LeagueRailSlot = {
  weekKey: string;
  weekLabel: string;
  roundIds: string[];
  primaryRoundId: string | null;
  state: LeagueRailSlotState;
  selected: boolean;
};

/* ------------------------------------------------------------------------------------------ */
/* Round temporal/closure classification                                                        */
/* ------------------------------------------------------------------------------------------ */

export type LeagueRoundTemporalState = "CURRENT" | "PAST" | "FUTURE" | "UNSCHEDULED";

export type LeagueFocusedRoundStatus =
  | "CURRENT_ROUND"
  | "NEEDS_ATTENTION"
  | "READY"
  | "NEEDS_CLOSURE"
  | "UPCOMING"
  | "NOT_GENERATED"
  | "FINAL";

export function leagueFocusedRoundStatusLabel(status: LeagueFocusedRoundStatus): string {
  switch (status) {
    case "CURRENT_ROUND":
      return "Current round";
    case "NEEDS_ATTENTION":
      return "Needs attention";
    case "READY":
      return "Ready";
    case "NEEDS_CLOSURE":
      return "Needs closure";
    case "UPCOMING":
      return "Upcoming";
    case "NOT_GENERATED":
      return "Not generated";
    case "FINAL":
      return "Final";
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Focused match issue                                                                           */
/* ------------------------------------------------------------------------------------------ */

export type LeagueFocusedMatchIssueKind =
  | "CANCELLED"
  | "BLOCKED"
  | "DECISION_REQUIRED"
  | "REPORT_MISSING"
  | "REPORT_INCOMPLETE"
  | "DONE"
  | "TACTICS_MISSING"
  | "LIVE"
  | "READY";

export type LeagueFocusedMatchIssue = {
  kind: LeagueFocusedMatchIssueKind;
  label: string;
  actionLabel?: string;
  actionTarget?: string;
  /** Additional equivalent-severity signals folded into this row ("+N more"). */
  extraCount?: number;
};

export type LeagueFocusedMatch = {
  id: string;
  teamId: string;
  teamName: string;
  teamKitColor: string | null;
  opponent?: string;
  startsAt?: string;
  venue?: string;
  selectedPlayerCount?: number;
  issue: LeagueFocusedMatchIssue;
  href: string;
  matchStatus: "SCHEDULED" | "CANCELLED";
  cancelledReason?: string | null;
};

export type LeagueFocusedRound = {
  id: string;
  title: string;
  status: LeagueFocusedRoundStatus;
  statusLabel: string;
  matchCount: number;
  attentionCount: number;
  reportsIncompleteCount: number;
  summaryLabel: string;
  roundBoardHref: string;
  matches: LeagueFocusedMatch[];
  /** True when this round has not been generated yet and is the round the "Generate all draft
   * squads" action should target when placed contextually (07§Step 9). */
  needsGeneration: boolean;
};

export type LeagueHistoryRound = {
  id: string;
  title: string;
  status: "FINAL" | "NEEDS_CLOSURE";
  statusLabel: string;
  matches: FixtureMatch[];
};

export type LeagueOperatingViewModelInput = {
  periods: FixturePeriod[];
  selectedPeriodId: string | null;
  selectedRoundId: string | null;
  now: Date;
};

export type LeagueOperatingViewModel = {
  activePeriod: FixturePeriod | null;
  railSlots: LeagueRailSlot[];
  focusedRound: LeagueFocusedRound | null;
  recentRounds: LeagueHistoryRound[];
  earlierRounds: LeagueHistoryRound[];
  earlierRoundCount: number;
};

/* ------------------------------------------------------------------------------------------ */
/* Internal per-round computed record                                                           */
/* ------------------------------------------------------------------------------------------ */

type RoundAttentionLevel = "BLOCKED" | "DECISION_REQUIRED" | "PLANNING_NEEDED" | "READY";

type RoundComputed = {
  round: FixtureRound;
  temporal: LeagueRoundTemporalState;
  closure: "FINAL" | "NEEDS_CLOSURE" | null;
  attention: RoundAttentionLevel;
  weekKeys: string[];
  earliestKickoff: Date | null;
  latestKickoff: Date | null;
};

function activeMatches(round: FixtureRound): FixtureMatch[] {
  return round.matches.filter((m) => m.matchStatus !== "CANCELLED");
}

function kickoffDates(round: FixtureRound): Date[] {
  return activeMatches(round)
    .map((m) => (m.startsAt ? new Date(m.startsAt) : null))
    .filter((d): d is Date => d != null);
}

function classifyTemporal(round: FixtureRound, nowWeekKey: string): LeagueRoundTemporalState {
  const kickoffs = kickoffDates(round);
  if (kickoffs.length === 0) return "UNSCHEDULED";
  const weekKeys = kickoffs.map((d) => getDisplayIsoWeekKey(d));
  if (weekKeys.includes(nowWeekKey)) return "CURRENT";
  const earliest = weekKeys.reduce((a, b) => (a < b ? a : b));
  const latest = weekKeys.reduce((a, b) => (a > b ? a : b));
  if (latest < nowWeekKey) return "PAST";
  if (earliest > nowWeekKey) return "FUTURE";
  // Spans the current week boundary without literally including it (e.g. an
  // irregularly-scheduled round) -- treat as CURRENT per "if a round spans multiple weeks and
  // includes the current week, it is CURRENT" (the nearest reasonable extension when the round's
  // window straddles now without an exact match).
  return "CURRENT";
}

function closureStateOf(round: FixtureRound): "FINAL" | "NEEDS_CLOSURE" {
  const matches = activeMatches(round);
  if (matches.length === 0) return "FINAL";
  const needsClosure = matches.some(
    (m) => m.lifecycleStatus === "played" || m.lifecycleStatus === "report_incomplete",
  );
  if (needsClosure) return "NEEDS_CLOSURE";
  const allClosed = matches.every((m) => m.lifecycleStatus === "done");
  return allClosed ? "FINAL" : "NEEDS_CLOSURE";
}

function attentionLevelOf(round: FixtureRound): RoundAttentionLevel {
  const signals = [
    ...round.roundLevelPlanningSignals,
    ...round.matches.flatMap((m) => m.planningSignals),
  ];
  if (signals.some((s) => s.kind === "BLOCKED")) return "BLOCKED";
  if (signals.some((s) => s.kind === "DECISION_REQUIRED")) return "DECISION_REQUIRED";
  if (round.selectionState === "NOT_GENERATED") return "PLANNING_NEEDED";
  return "READY";
}

function computeRound(round: FixtureRound, nowWeekKey: string): RoundComputed {
  const temporal = classifyTemporal(round, nowWeekKey);
  const kickoffs = kickoffDates(round);
  return {
    round,
    temporal,
    closure: temporal === "PAST" ? closureStateOf(round) : null,
    attention: attentionLevelOf(round),
    weekKeys: kickoffs.map((d) => getDisplayIsoWeekKey(d)),
    earliestKickoff: kickoffs.length > 0 ? new Date(Math.min(...kickoffs.map((d) => d.getTime()))) : null,
    latestKickoff: kickoffs.length > 0 ? new Date(Math.max(...kickoffs.map((d) => d.getTime()))) : null,
  };
}

function hasActionableWork(c: RoundComputed): boolean {
  if (c.temporal === "PAST") return c.closure === "NEEDS_CLOSURE";
  return c.attention === "BLOCKED" || c.attention === "DECISION_REQUIRED";
}

/* ------------------------------------------------------------------------------------------ */
/* Focused-round status + summary                                                               */
/* ------------------------------------------------------------------------------------------ */

function focusedStatusOf(c: RoundComputed): LeagueFocusedRoundStatus {
  if (c.temporal === "PAST") {
    return c.closure === "NEEDS_CLOSURE" ? "NEEDS_CLOSURE" : "FINAL";
  }
  if (c.temporal === "CURRENT") return "CURRENT_ROUND";
  // FUTURE or UNSCHEDULED.
  if (c.round.selectionState === "NOT_GENERATED") return "NOT_GENERATED";
  if (c.attention === "BLOCKED" || c.attention === "DECISION_REQUIRED") return "NEEDS_ATTENTION";
  if (c.round.hasDraftSelections || c.round.selectionState === "READY" || c.round.selectionState === "FINALIZED") {
    return "READY";
  }
  return "UPCOMING";
}

/* ------------------------------------------------------------------------------------------ */
/* Focused match issue resolution                                                               */
/* ------------------------------------------------------------------------------------------ */

function signalIssue(
  kind: "BLOCKED" | "DECISION_REQUIRED",
  matched: FixturePlanningSignal[],
): LeagueFocusedMatchIssue {
  const primary = matched[0];
  const extra = matched.length - 1;
  return {
    kind,
    label: primary.currentState || primary.title,
    actionLabel: primary.primaryActionLabel,
    actionTarget: primary.primaryActionTarget,
    extraCount: extra > 0 ? extra : undefined,
  };
}

/**
 * Resolve the single primary operational issue for a focused-round match row (03§"Concrete
 * issue display" priority order): BLOCKED > DECISION_REQUIRED > past report missing/incomplete >
 * pre-match tactics/lineup missing > live > ready/upcoming.
 */
export function resolveMatchIssue(match: FixtureMatch): LeagueFocusedMatchIssue {
  if (match.matchStatus === "CANCELLED") {
    return { kind: "CANCELLED", label: "Cancelled" };
  }

  const blocked = match.planningSignals.filter((s) => s.kind === "BLOCKED");
  if (blocked.length > 0) return signalIssue("BLOCKED", blocked);

  const decisions = match.planningSignals.filter((s) => s.kind === "DECISION_REQUIRED");
  if (decisions.length > 0) return signalIssue("DECISION_REQUIRED", decisions);

  if (match.lifecycleStatus === "played") {
    return {
      kind: "REPORT_MISSING",
      label: "Report missing",
      actionLabel: "Complete report",
      actionTarget: `/matches/${match.id}?tab=report`,
    };
  }
  if (match.lifecycleStatus === "report_incomplete") {
    return {
      kind: "REPORT_INCOMPLETE",
      label: "Report incomplete",
      actionLabel: "Complete report",
      actionTarget: `/matches/${match.id}?tab=report`,
    };
  }
  if (match.lifecycleStatus === "done") {
    return { kind: "DONE", label: "Report complete" };
  }
  if (match.lineupState === "MISSING") {
    return {
      kind: "TACTICS_MISSING",
      label: "Tactics not prepared",
      actionLabel: "Set up tactics",
      actionTarget: `/matches/${match.id}?tab=tactics`,
    };
  }
  if (match.lifecycleStatus === "live") {
    return {
      kind: "LIVE",
      label: "Live",
      actionLabel: "Follow live",
      actionTarget: `/matches/${match.id}?tab=live`,
    };
  }
  return { kind: "READY", label: "Ready" };
}

function isAttentionIssue(kind: LeagueFocusedMatchIssueKind): boolean {
  return kind === "BLOCKED" || kind === "DECISION_REQUIRED" || kind === "TACTICS_MISSING";
}

function isReportIncompleteIssue(kind: LeagueFocusedMatchIssueKind): boolean {
  return kind === "REPORT_MISSING" || kind === "REPORT_INCOMPLETE";
}

function buildFocusedRound(c: RoundComputed): LeagueFocusedRound {
  const round = c.round;
  const status = focusedStatusOf(c);
  const matches: LeagueFocusedMatch[] = round.matches.map((m) => ({
    id: m.id,
    teamId: m.teamId,
    teamName: m.teamName,
    teamKitColor: m.teamKitColor,
    opponent: m.opponent,
    startsAt: m.startsAt,
    venue: m.venue,
    selectedPlayerCount: m.selectedPlayerCount,
    issue: resolveMatchIssue(m),
    href: `/matches/${m.id}`,
    matchStatus: m.matchStatus,
    cancelledReason: m.cancelledReason,
  }));

  const attentionCount =
    matches.filter((m) => isAttentionIssue(m.issue.kind)).length + round.roundLevelPlanningSignals.length;
  const reportsIncompleteCount = matches.filter((m) => isReportIncompleteIssue(m.issue.kind)).length;
  const matchCount = round.matches.length;

  const parts: string[] = [];
  if (matchCount === 0) {
    parts.push("No matches");
  } else {
    parts.push(`${matchCount} match${matchCount === 1 ? "" : "es"}`);
    if (reportsIncompleteCount > 0) {
      parts.push(`${reportsIncompleteCount} report${reportsIncompleteCount === 1 ? "" : "s"} incomplete`);
    } else if (attentionCount > 0) {
      parts.push(`${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention`);
    } else if (status === "NOT_GENERATED") {
      parts.push("Not generated");
    } else if (status === "CURRENT_ROUND" || status === "READY" || status === "UPCOMING") {
      parts.push("All set");
    }
  }

  return {
    id: round.id,
    title: round.title,
    status,
    statusLabel: leagueFocusedRoundStatusLabel(status),
    matchCount,
    attentionCount,
    reportsIncompleteCount,
    summaryLabel: parts.join(" · "),
    roundBoardHref: `/rounds/${round.id}`,
    matches,
    needsGeneration: round.selectionState === "NOT_GENERATED",
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Rail construction                                                                             */
/* ------------------------------------------------------------------------------------------ */

function displayDateAsUtcMidnight(value: Date): Date {
  const [year, month, day] = getDisplayDateKey(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function enumerateDisplayWeekKeys(startDate: Date, endDate: Date): string[] {
  const startWeekStart = getWeekRange(displayDateAsUtcMidnight(startDate)).startsAt;
  const endWeekStart = getWeekRange(displayDateAsUtcMidnight(endDate)).startsAt;
  const weeks: string[] = [];
  const cur = new Date(startWeekStart);
  while (cur.getTime() <= endWeekStart.getTime()) {
    weeks.push(formatIsoWeekKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return weeks;
}

function railSlotStateOf(c: RoundComputed): LeagueRailSlotState {
  if (c.temporal === "PAST") return c.closure === "NEEDS_CLOSURE" ? "NEEDS_CLOSURE" : "FINAL";
  if (c.temporal === "CURRENT") return "CURRENT";
  // FUTURE or UNSCHEDULED.
  if (c.attention === "BLOCKED" || c.attention === "DECISION_REQUIRED") return "ATTENTION";
  return "UPCOMING";
}

function buildRailSlots(
  period: FixturePeriod,
  computedRounds: RoundComputed[],
  focusedRoundId: string | null,
): LeagueRailSlot[] {
  const weekKeys = enumerateDisplayWeekKeys(new Date(period.startDate), new Date(period.endDate));
  const roundsByWeek = new Map<string, RoundComputed[]>();
  for (const c of computedRounds) {
    for (const wk of c.weekKeys) {
      const list = roundsByWeek.get(wk) ?? [];
      list.push(c);
      roundsByWeek.set(wk, list);
    }
  }

  return weekKeys.map((weekKey) => {
    const weekRounds = roundsByWeek.get(weekKey) ?? [];
    if (weekRounds.length === 0) {
      return {
        weekKey,
        weekLabel: weekKey.split("-W")[1] ? `W${weekKey.split("-W")[1]}` : weekKey,
        roundIds: [],
        primaryRoundId: null,
        state: "EMPTY",
        selected: false,
      };
    }

    // Deterministic primary-round tie-break (02§"Calendar rail"): 1) round with
    // attention/closure work, 2) otherwise earliest non-cancelled kickoff, 3) otherwise lexical
    // round id.
    const sorted = [...weekRounds].sort((a, b) => {
      const aWork = hasActionableWork(a) ? 0 : 1;
      const bWork = hasActionableWork(b) ? 0 : 1;
      if (aWork !== bWork) return aWork - bWork;
      const aKick = a.earliestKickoff?.getTime() ?? Number.POSITIVE_INFINITY;
      const bKick = b.earliestKickoff?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aKick !== bKick) return aKick - bKick;
      return a.round.id.localeCompare(b.round.id);
    });
    const primary = sorted[0];

    return {
      weekKey,
      weekLabel: `W${weekKey.split("-W")[1]}`,
      roundIds: weekRounds.map((c) => c.round.id),
      primaryRoundId: primary.round.id,
      state: railSlotStateOf(primary),
      selected: weekRounds.some((c) => c.round.id === focusedRoundId),
    };
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Default focused-round resolution                                                             */
/* ------------------------------------------------------------------------------------------ */

function resolveDefaultFocus(computedRounds: RoundComputed[]): RoundComputed | null {
  const scheduled = computedRounds.filter((c) => c.round.hasMatches);

  const current = scheduled.filter((c) => c.temporal === "CURRENT");
  if (current.length > 0) {
    const sorted = [...current].sort((a, b) => {
      const aWork = hasActionableWork(a) ? 0 : 1;
      const bWork = hasActionableWork(b) ? 0 : 1;
      if (aWork !== bWork) return aWork - bWork;
      const aKick = a.earliestKickoff?.getTime() ?? Number.POSITIVE_INFINITY;
      const bKick = b.earliestKickoff?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aKick !== bKick) return aKick - bKick;
      return a.round.id.localeCompare(b.round.id);
    });
    return sorted[0];
  }

  const future = scheduled.filter((c) => c.temporal === "FUTURE");
  if (future.length > 0) {
    const sorted = [...future].sort((a, b) => {
      const aKick = a.earliestKickoff?.getTime() ?? Number.POSITIVE_INFINITY;
      const bKick = b.earliestKickoff?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aKick !== bKick) return aKick - bKick;
      return a.round.id.localeCompare(b.round.id);
    });
    return sorted[0];
  }

  const pastNeedsClosure = scheduled.filter((c) => c.temporal === "PAST" && c.closure === "NEEDS_CLOSURE");
  if (pastNeedsClosure.length > 0) {
    const sorted = [...pastNeedsClosure].sort((a, b) => {
      const aKick = a.latestKickoff?.getTime() ?? 0;
      const bKick = b.latestKickoff?.getTime() ?? 0;
      return bKick - aKick;
    });
    return sorted[0];
  }

  const past = scheduled.filter((c) => c.temporal === "PAST");
  if (past.length > 0) {
    const sorted = [...past].sort((a, b) => {
      const aKick = a.latestKickoff?.getTime() ?? 0;
      const bKick = b.latestKickoff?.getTime() ?? 0;
      return bKick - aKick;
    });
    return sorted[0];
  }

  const unscheduled = computedRounds.filter((c) => c.round.hasMatches === false || c.temporal === "UNSCHEDULED");
  if (unscheduled.length > 0) {
    const sorted = [...unscheduled].sort((a, b) => a.round.id.localeCompare(b.round.id));
    return sorted[0];
  }

  return null;
}

/* ------------------------------------------------------------------------------------------ */
/* History (recent/earlier)                                                                     */
/* ------------------------------------------------------------------------------------------ */

const MAX_RECENT_ROUNDS = 2;

function buildHistoryRound(c: RoundComputed): LeagueHistoryRound {
  const status = c.closure === "NEEDS_CLOSURE" ? "NEEDS_CLOSURE" : "FINAL";
  return {
    id: c.round.id,
    title: c.round.title,
    status,
    statusLabel: status === "NEEDS_CLOSURE" ? "Needs closure" : "Final",
    matches: c.round.matches,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Entry point                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export function buildLeagueOperatingViewModel(input: LeagueOperatingViewModelInput): LeagueOperatingViewModel {
  const activePeriod =
    input.periods.find((p) => p.id === input.selectedPeriodId) ??
    input.periods.find((p) => p.isCurrent) ??
    input.periods[0] ??
    null;

  if (!activePeriod) {
    return {
      activePeriod: null,
      railSlots: [],
      focusedRound: null,
      recentRounds: [],
      earlierRounds: [],
      earlierRoundCount: 0,
    };
  }

  const nowWeekKey = getDisplayIsoWeekKey(input.now);
  const computedRounds = activePeriod.rounds.map((r) => computeRound(r, nowWeekKey));

  const requestedRound =
    input.selectedRoundId != null
      ? computedRounds.find((c) => c.round.id === input.selectedRoundId)
      : undefined;
  const focusedComputed = requestedRound ?? resolveDefaultFocus(computedRounds);

  const railSlots = buildRailSlots(activePeriod, computedRounds, focusedComputed?.round.id ?? null);

  const focusedRound = focusedComputed ? buildFocusedRound(focusedComputed) : null;

  const pastRounds = computedRounds
    .filter((c) => c.temporal === "PAST" && c.round.id !== focusedComputed?.round.id)
    .sort((a, b) => {
      const aKick = a.latestKickoff?.getTime() ?? 0;
      const bKick = b.latestKickoff?.getTime() ?? 0;
      return bKick - aKick;
    });

  const recentRounds = pastRounds.slice(0, MAX_RECENT_ROUNDS).map(buildHistoryRound);
  const earlierRounds = pastRounds.slice(MAX_RECENT_ROUNDS).map(buildHistoryRound);

  return {
    activePeriod,
    railSlots,
    focusedRound,
    recentRounds,
    earlierRounds,
    earlierRoundCount: earlierRounds.length,
  };
}
