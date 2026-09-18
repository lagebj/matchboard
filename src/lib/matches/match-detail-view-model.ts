import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import type { MatchDetailSurfaceState } from "@/lib/matches/match-detail-tabs";

/**
 * Match Details + Post-Match Report lifecycle-aware pure view-model builders
 * (`.matchboard-work/matchboard_match_details_exact_goldens_2026-09-18/`, corrected exact-golden
 * edition). Pure, DB-free, unit-tested — the JSX renders a prepared read model, it does not
 * decide lifecycle, truth-linkage, or aggregation itself.
 */

// ---------------------------------------------------------------------------
// Surface-state derivation
// ---------------------------------------------------------------------------

/**
 * `02_PRODUCT_MODEL_AND_LIFECYCLE.md`: Match Details has exactly two visual compositions.
 * `live` deliberately stays on the BEFORE composition (same IA, only the primary action swaps to
 * "Open live reporting") — "Do not create a third desktop composition that is not present in the
 * supplied golden." `cancelled` also stays BEFORE — a cancelled match "does not render as
 * played" and keeps the planned squad for reference, read-only.
 */
export function deriveMatchDetailSurfaceState(lifecycleStatus: MatchLifecycleStatus): MatchDetailSurfaceState {
  switch (lifecycleStatus) {
    case "played":
    case "report_incomplete":
    case "done":
      return "AFTER";
    case "planning_open":
    case "planning_closed":
    case "live":
    case "cancelled":
    default:
      return "BEFORE";
  }
}

// ---------------------------------------------------------------------------
// Match preparation (before-match readiness)
// ---------------------------------------------------------------------------

export type MatchPreparationItemKey = "squad" | "lineup" | "rotation" | "ready";

export interface MatchPreparationDisplayItem {
  key: MatchPreparationItemKey;
  label: string;
  detail: string;
  complete: boolean;
  /** Rotation planning is explicitly optional — it never blocks "ready for match". */
  optional?: boolean;
}

export interface MatchPreparationInput {
  squadSelectedCount: number;
  squadTarget: number;
  hasLineup: boolean;
  hasPlannedRotation: boolean;
}

/**
 * `03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md` "Match preparation block": built on top of the
 * already-computed `buildMatchPlanningHubViewModel()` facts (squad/lineup/rotation), reformatted
 * to the golden's richer wording. `ready` is a transparent AND of two already-known booleans
 * (squad selected AND lineup set) — not a new hidden readiness score; rotation stays optional and
 * never gates it.
 */
export function buildMatchPreparationDisplayItems(input: MatchPreparationInput): MatchPreparationDisplayItem[] {
  const squadReady = input.squadSelectedCount > 0;
  const lineupReady = input.hasLineup;
  return [
    {
      key: "squad",
      label: "Squad selected",
      detail: `${input.squadSelectedCount}/${input.squadTarget}`,
      complete: squadReady,
    },
    {
      key: "lineup",
      label: "Lineup set",
      detail: lineupReady ? "Set" : "Not set",
      complete: lineupReady,
    },
    {
      key: "rotation",
      label: "Rotation plan",
      detail: input.hasPlannedRotation ? "Planned" : "Optional",
      complete: input.hasPlannedRotation,
      optional: true,
    },
    {
      key: "ready",
      label: "Ready for match",
      detail: squadReady && lineupReady ? "Ready" : "Not yet",
      complete: squadReady && lineupReady,
    },
  ];
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export interface MatchAttendanceFact {
  attendanceStatus: "PRESENT" | "NO_SHOW" | "UNKNOWN" | string;
  playerName: string;
}

export interface MatchAttendanceSummary {
  presentCount: number;
  noShowCount: number;
  totalCount: number;
  noShowNames: string[];
}

export function summarizeMatchAttendance(actuals: MatchAttendanceFact[]): MatchAttendanceSummary {
  const present = actuals.filter((a) => a.attendanceStatus === "PRESENT");
  const noShow = actuals.filter((a) => a.attendanceStatus === "NO_SHOW");
  return {
    presentCount: present.length,
    noShowCount: noShow.length,
    totalCount: actuals.length,
    noShowNames: noShow.map((a) => a.playerName),
  };
}

// ---------------------------------------------------------------------------
// Goal scorer / assist provider aggregation (report goals/assists, never inferred)
// ---------------------------------------------------------------------------

export interface MatchGoalFact {
  id: string;
  participantKey: string | null;
  playerName: string | null;
  minute: number | null;
  type: string;
}

export interface MatchAssistFact {
  id: string;
  participantKey: string | null;
  playerName: string | null;
  type: string;
}

export interface PlayerAggregateCount {
  participantKey: string;
  playerName: string;
  count: number;
}

/** Aggregates report goals by scorer. An unattributed goal (`participantKey === null`) is kept
 * explicit under `unattributedCount` rather than silently dropped (data-mapping rule 6). */
export function aggregateGoalScorers(goals: MatchGoalFact[]): {
  scorers: PlayerAggregateCount[];
  unattributedCount: number;
} {
  return aggregateByParticipant(
    goals.map((g) => ({ participantKey: g.participantKey, playerName: g.playerName })),
  );
}

export function aggregateAssistProviders(assists: MatchAssistFact[]): {
  scorers: PlayerAggregateCount[];
  unattributedCount: number;
} {
  return aggregateByParticipant(
    assists.map((a) => ({ participantKey: a.participantKey, playerName: a.playerName })),
  );
}

function aggregateByParticipant(
  rows: { participantKey: string | null; playerName: string | null }[],
): { scorers: PlayerAggregateCount[]; unattributedCount: number } {
  const byKey = new Map<string, PlayerAggregateCount>();
  let unattributedCount = 0;
  for (const row of rows) {
    if (!row.participantKey) {
      unattributedCount += 1;
      continue;
    }
    const existing = byKey.get(row.participantKey);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(row.participantKey, {
        participantKey: row.participantKey,
        playerName: row.playerName ?? "Unknown",
        count: 1,
      });
    }
  }
  // Highest count first; stable alphabetical tiebreak so re-renders never reorder ties.
  const scorers = [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.playerName.localeCompare(b.playerName),
  );
  return { scorers, unattributedCount };
}

// ---------------------------------------------------------------------------
// Timeline (truth-rule-governed)
// ---------------------------------------------------------------------------

export type MatchTimelineEventKind =
  | "GOAL_FOR"
  | "GOAL_AGAINST"
  | "ROTATION"
  | "PERIOD_BOUNDARY"
  | "FAIR_PLAY_POSITIVE"
  | "FAIR_PLAY_CONCERN"
  | "MATCH_END";

export interface MatchTimelineItem {
  id: string;
  kind: MatchTimelineEventKind;
  /** Pre-resolved by the caller (existing period/timing-resolution logic owns minute math — this
   * module only orders/pairs, it never derives a minute itself). `null` when genuinely unknown. */
  minuteLabel: string | null;
  playerName: string | null;
  /** Only ever set when canonical live-event linkage (`correctsEventId`) proves the association —
   * see `buildMatchTimelineFromLiveEvents()`. Never set by the report-fallback builder. */
  assistPlayerName: string | null;
  /** Rotation: the player coming off. */
  secondaryPlayerName: string | null;
  /** True when built from persisted canonical `LiveMatchEvent` rows rather than the report's own
   * `Goal`/`Assist` fallback rows (data-mapping rule 1: "Persisted canonical live events are
   * primary when available."). */
  sourceIsCanonicalLiveEvent: boolean;
}

/** Minimal canonical live-event shape this module needs — already filtered to non-reversed,
 * relevant `eventType`s, in chronological order, with the minute label pre-resolved. */
export interface MatchCanonicalLiveEventFact {
  id: string;
  eventType: string;
  playerName: string | null;
  /** The *client-generated* id this event was recorded under — `correctsEventId` on a
   * `SCORER_SET`/`ASSIST_SET` annotation event references the target goal's `clientEventId`, not
   * its database `id` (confirmed against real production data: `LiveMatchEvent.id` and
   * `.clientEventId` are unrelated string formats). Required for correct scorer/assist pairing —
   * see `buildMatchTimelineFromLiveEvents()`. */
  clientEventId: string | null;
  correctsEventId: string | null;
  minuteLabel: string | null;
  /** Used only to pair ROTATION_OUT with its ROTATION_IN within the same existing tolerance
   * window already used at report-seeding time (`report-mutations.ts`, 30s) — not a new
   * heuristic. Numeric period index, matching `LiveMatchEvent.period` (`Int?`) directly — not
   * the `MatchPeriod` string enum used elsewhere in the codebase. */
  period: number | null;
  matchSeconds: number | null;
}

const ROTATION_PAIR_WINDOW_MS = 30_000;

/**
 * Real per-event chronological position within the match, robust to a missing coordinator
 * `sequence` (ARR-0045: a row written via the still-partially-active legacy direct-HTTP path has
 * no coordinator-assigned sequence and sorts unpredictably — confirmed against real production
 * data: an entire match's `ROTATION_OUT`/`ROTATION_IN` pairs, all missing `sequence`, were pushed
 * to the very end of the list by a plain `ORDER BY sequence ASC` — Postgres/Prisma default NULLS
 * LAST — reading as "grouped by type" instead of interleaved by time). Orders by the event's own
 * period + within-period elapsed time, which every rendered event kind carries, rather than
 * trusting `sequence` as the primary key. `PERIOD_START` sorts first and `PERIOD_END` sorts last
 * within its period (neither carries `matchSeconds`); `MATCH_END` sorts after everything.
 */
function timelineSortKey(e: MatchCanonicalLiveEventFact): readonly [number, number] {
  const period = e.period ?? Number.MAX_SAFE_INTEGER;
  if (e.eventType === "MATCH_END") return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  if (e.eventType === "PERIOD_START") return [period, -1];
  if (e.eventType === "PERIOD_END") return [period, Number.MAX_SAFE_INTEGER];
  return [period, e.matchSeconds ?? 0];
}

/**
 * Builds the timeline from persisted canonical `LiveMatchEvent` rows (data-mapping rule 1).
 * Scorer/assist attribution is paired to its goal **only** via `correctsEventId` — the stored
 * annotation-event linkage `SCORER_SET`/`ASSIST_SET` events carry back to their target
 * `GOAL_FOR`/`GOAL_AGAINST` event's `clientEventId` (confirmed in `live-match-domain.ts`'s
 * `validateLiveEventInput`, 2026-09-17 incident, and directly against real production data — NOT
 * the goal event's database `id`, a real bug this fixes: every goal previously rendered
 * "Unattributed" because the lookup compared `correctsEventId` against the wrong id field).
 * Never by array index, order, or timestamp proximity (data-mapping rule 5).
 *
 * `events` need not already be in chronological order — this function establishes that order
 * itself via `timelineSortKey()`, stably, so the caller's own (fallback) ordering only breaks
 * ties.
 */
export function buildMatchTimelineFromLiveEvents(rawEvents: MatchCanonicalLiveEventFact[]): MatchTimelineItem[] {
  const events = [...rawEvents].sort((a, b) => {
    const [ap, at] = timelineSortKey(a);
    const [bp, bt] = timelineSortKey(b);
    return ap - bp || at - bt;
  });

  const scorerByGoalId = new Map<string, string | null>();
  const assistByGoalId = new Map<string, string | null>();
  for (const e of events) {
    if (!e.correctsEventId) continue;
    if (e.eventType === "SCORER_SET") scorerByGoalId.set(e.correctsEventId, e.playerName);
    if (e.eventType === "ASSIST_SET") assistByGoalId.set(e.correctsEventId, e.playerName);
  }

  const rotationIn = events.filter((e) => e.eventType === "ROTATION_IN");
  const consumedInIds = new Set<string>();
  function findRotationPartner(outEvent: MatchCanonicalLiveEventFact): MatchCanonicalLiveEventFact | null {
    return (
      rotationIn.find(
        (inEvent) =>
          !consumedInIds.has(inEvent.id) &&
          inEvent.period === outEvent.period &&
          inEvent.matchSeconds !== null &&
          outEvent.matchSeconds !== null &&
          Math.abs(inEvent.matchSeconds - outEvent.matchSeconds) < ROTATION_PAIR_WINDOW_MS,
      ) ?? null
    );
  }

  const items: MatchTimelineItem[] = [];
  for (const e of events) {
    if (e.eventType === "GOAL_FOR" || e.eventType === "GOAL_AGAINST") {
      items.push({
        id: e.id,
        kind: e.eventType,
        minuteLabel: e.minuteLabel,
        playerName: e.clientEventId ? (scorerByGoalId.get(e.clientEventId) ?? null) : null,
        assistPlayerName: e.clientEventId ? (assistByGoalId.get(e.clientEventId) ?? null) : null,
        secondaryPlayerName: null,
        sourceIsCanonicalLiveEvent: true,
      });
    } else if (e.eventType === "ROTATION_OUT") {
      const partner = findRotationPartner(e);
      if (partner) consumedInIds.add(partner.id);
      items.push({
        id: e.id,
        kind: "ROTATION",
        minuteLabel: e.minuteLabel,
        playerName: partner?.playerName ?? null,
        assistPlayerName: null,
        secondaryPlayerName: e.playerName,
        sourceIsCanonicalLiveEvent: true,
      });
    } else if (e.eventType === "PERIOD_START" || e.eventType === "PERIOD_END") {
      items.push({
        id: e.id,
        kind: "PERIOD_BOUNDARY",
        minuteLabel: e.minuteLabel,
        playerName: null,
        assistPlayerName: null,
        secondaryPlayerName: null,
        sourceIsCanonicalLiveEvent: true,
      });
    } else if (e.eventType === "FAIR_PLAY_POSITIVE" || e.eventType === "FAIR_PLAY_CONCERN") {
      items.push({
        id: e.id,
        kind: e.eventType,
        minuteLabel: e.minuteLabel,
        playerName: e.playerName,
        assistPlayerName: null,
        secondaryPlayerName: null,
        sourceIsCanonicalLiveEvent: true,
      });
    } else if (e.eventType === "MATCH_END") {
      items.push({
        id: e.id,
        kind: "MATCH_END",
        minuteLabel: e.minuteLabel,
        playerName: null,
        assistPlayerName: null,
        secondaryPlayerName: null,
        sourceIsCanonicalLiveEvent: true,
      });
    }
    // ROTATION_IN, SCORER_SET, ASSIST_SET never become their own row — they annotate the rows
    // above. Unrecognised/unsupported event types are intentionally omitted, not guessed at.
  }
  return items;
}

/**
 * Fallback timeline built from the report's own `Goal` rows only, used when no canonical live
 * events exist (a manually-created report, data-mapping rule 1's "when live events are absent").
 * Never pairs an assist here — no canonical linkage exists between a `Goal` row and an `Assist`
 * row (data-mapping rule 5); assists are surfaced separately via `aggregateAssistProviders()`.
 */
export function buildMatchTimelineFromReportGoals(goals: MatchGoalFact[]): MatchTimelineItem[] {
  return [...goals]
    .sort((a, b) => {
      if (a.minute == null && b.minute == null) return 0;
      if (a.minute == null) return 1;
      if (b.minute == null) return -1;
      return a.minute - b.minute;
    })
    .map((g) => ({
      id: g.id,
      kind: g.type === "OWN_GOAL" ? "GOAL_AGAINST" : "GOAL_FOR",
      minuteLabel: g.minute != null ? `${g.minute}'` : null,
      playerName: g.playerName,
      assistPlayerName: null,
      secondaryPlayerName: null,
      sourceIsCanonicalLiveEvent: false,
    }));
}

export function buildMatchTimeline(input: {
  canonicalLiveEvents: MatchCanonicalLiveEventFact[];
  reportGoals: MatchGoalFact[];
}): MatchTimelineItem[] {
  // Never both — data-mapping rule 3: "Never show the same goal twice because it exists in both
  // sources." Live events are primary whenever any exist for this match.
  if (input.canonicalLiveEvents.length > 0) {
    return buildMatchTimelineFromLiveEvents(input.canonicalLiveEvents);
  }
  return buildMatchTimelineFromReportGoals(input.reportGoals);
}

// ---------------------------------------------------------------------------
// Player involvement (Overview "Player involvement" — goals/assists/observations/minutes)
// ---------------------------------------------------------------------------

export interface PlayerInvolvementRow {
  participantKey: string;
  playerName: string;
  goals: number;
  assists: number;
  observationCount: number;
  /** `null` when no trustworthy closed-interval minutes exist for this player — rendered as an
   * explicit dash, never a guessed value. */
  minutes: number | null;
}

/** Present players only — an absent/no-show player has no match involvement to report. Sorted by
 * minutes (when known) then goals+assists, richest involvement first. */
export function buildPlayerInvolvement(input: {
  presentParticipants: { participantKey: string; playerName: string }[];
  goals: MatchGoalFact[];
  assists: MatchAssistFact[];
  observationCountByParticipant: Map<string, number>;
  minutesByParticipant: Map<string, number>;
}): PlayerInvolvementRow[] {
  const goalCounts = new Map<string, number>();
  for (const g of input.goals) {
    if (!g.participantKey) continue;
    goalCounts.set(g.participantKey, (goalCounts.get(g.participantKey) ?? 0) + 1);
  }
  const assistCounts = new Map<string, number>();
  for (const a of input.assists) {
    if (!a.participantKey) continue;
    assistCounts.set(a.participantKey, (assistCounts.get(a.participantKey) ?? 0) + 1);
  }

  return input.presentParticipants
    .map((p) => ({
      participantKey: p.participantKey,
      playerName: p.playerName,
      goals: goalCounts.get(p.participantKey) ?? 0,
      assists: assistCounts.get(p.participantKey) ?? 0,
      observationCount: input.observationCountByParticipant.get(p.participantKey) ?? 0,
      minutes: input.minutesByParticipant.get(p.participantKey) ?? null,
    }))
    .sort((a, b) => {
      const minutesDiff = (b.minutes ?? -1) - (a.minutes ?? -1);
      if (minutesDiff !== 0) return minutesDiff;
      return b.goals + b.assists - (a.goals + a.assists) || a.playerName.localeCompare(b.playerName);
    });
}

// ---------------------------------------------------------------------------
// Player minutes from actual position intervals (real data, read not invented)
// ---------------------------------------------------------------------------

export interface ActualIntervalFact {
  participantKey: string;
  startedAtMs: number;
  /** `null` means the interval was never closed — excluded from the sum rather than guessing an
   * end time (data-mapping rule: label as minutes only when trustworthy). */
  endedAtMs: number | null;
}

/** Sums closed actual-position-interval durations per participant, in whole minutes. A
 * participant with only open (never-closed) intervals is simply absent from the result — never
 * assigned a guessed duration. */
export function computePlayerMinutesFromIntervals(intervals: ActualIntervalFact[]): Map<string, number> {
  const totalMsByParticipant = new Map<string, number>();
  for (const interval of intervals) {
    if (interval.endedAtMs == null) continue;
    const durationMs = Math.max(0, interval.endedAtMs - interval.startedAtMs);
    totalMsByParticipant.set(
      interval.participantKey,
      (totalMsByParticipant.get(interval.participantKey) ?? 0) + durationMs,
    );
  }
  const minutesByParticipant = new Map<string, number>();
  for (const [key, ms] of totalMsByParticipant) {
    minutesByParticipant.set(key, Math.round(ms / 60_000));
  }
  return minutesByParticipant;
}
