import {
  summarizeMatchAttendance,
  aggregateGoalScorers,
  aggregateAssistProviders,
  buildMatchTimeline,
  buildPlayerInvolvement,
  type MatchAttendanceFact,
  type MatchGoalFact,
  type MatchAssistFact,
  type MatchCanonicalLiveEventFact,
} from "@/lib/matches/match-detail-view-model";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import { B08_MATCH_FORMAT, B08_MATCH_ID, B08_OPPONENT_NAME, B08_KICKOFF_AT, periodRelativeToGlobalMinute, b08Squad } from "./fixture";
import {
  b08Timeline,
  B08_LIVE_GOALS_RECORDED,
  B08_TEAM_NOTE,
  b08Reflection,
  b08FootballObservations,
  b08OpponentObservation,
  b08CombinationEvidence,
  b08ShapeChangeRows,
  b08FirstTimeCanonicalPositions,
} from "./fixture-history";
import { MATCH_B_TEAM_NAME } from "../../shared/match-b-fixture";
import type { B08PersistedReportState, B08HistoryOrigin } from "./b08-journey";

/**
 * B08 W5 second remediation (independent review, 2026-11-08, "lifecycle data consistency") — the
 * ONE shared projection every downstream B08 workspace (LIVE's follower summary, REPORT-DRAFT,
 * REPORT-COMPLETED, AFTER) reads for INTERACTIVE-JOURNEY derived facts. Reference-mode (no
 * journey) never calls any function in this module — it keeps reading `fixture-history.ts`'s own
 * unchanged canonical functions exactly as before this pass.
 *
 * "One authoritative event ledger, multiple read models": every derivation below starts from
 * `computeEffectiveLiveEvents()`'s own output, never a second, independently-filtered pass over
 * the raw journey events.
 */

// ---------------------------------------------------------------------------
// Effective events — the real production reversal-filtering algorithm
// ---------------------------------------------------------------------------

/**
 * Mirrors `get-match-detail-after-data.ts`'s own real, live production logic EXACTLY (confirmed
 * by reading it directly, not inferred): a canonical event is excluded from the effective set if
 * either (a) it IS an `EVENT_REVERSED` marker itself, or (b) its own `id` is referenced by some
 * `EVENT_REVERSED.correctsEventId`. Production computes this with two separate Prisma queries
 * (`liveMatchEvent.findMany` with an `eventType`/`correctionType` filter, then a second query for
 * `EVENT_REVERSED` rows, then an in-memory `.filter()`) — this is the same two-pass algorithm,
 * just over an in-memory array instead of two DB round-trips. `EVENT_REVERSED.correctsEventId`
 * references the target's own `id` field (confirmed against `LiveMatchClient.handleUndo()`:
 * `recordEventLocal("EVENT_REVERSED", { correctsEventId: eventId })` where `eventId` is
 * `event.id`) — NOT its `clientEventId`, which is the separate reference namespace
 * `SCORER_SET`/`ASSIST_SET` corrections use instead (see `deriveGoalsAndAssists()` below). Do not
 * conflate the two.
 */
export function computeEffectiveLiveEvents(rawEvents: readonly LiveEventSummary[]): LiveEventSummary[] {
  const reversedIds = new Set(
    rawEvents.filter((e) => e.eventType === "EVENT_REVERSED" && e.correctsEventId != null).map((e) => e.correctsEventId as string),
  );
  return rawEvents.filter((e) => e.eventType !== "EVENT_REVERSED" && !reversedIds.has(e.id));
}

/** Companion to `computeEffectiveLiveEvents()` for the REPORTER's own live event list
 * (`LiveMatchClient`'s "Recent events" panel), which must keep showing a reversed event (with its
 * own real `isReversed` badge and its "Undo" control correctly hidden — `LIVE_EVENT_TYPES_THAT_
 * ARE_CORRECTABLE` display logic already gates on `!event.isReversed`) rather than silently
 * removing it, unlike the AFTER/Report-facing effective set above. In REAL production this flag
 * is computed server-side; B08's own fixture-local `getRecentEvents()` has no server, so it must
 * compute it itself from the same reversed-id set, or the reporter's own "Undo" button would stay
 * clickable on an already-reversed event (harmless numerically — `handleUndo`'s own
 * `Math.max(0, ...)` floor prevents a negative score — but not a faithful reproduction of the real
 * reporter UI). */
export function markReversedEvents(rawEvents: readonly LiveEventSummary[]): LiveEventSummary[] {
  const reversedIds = new Set(
    rawEvents.filter((e) => e.eventType === "EVENT_REVERSED" && e.correctsEventId != null).map((e) => e.correctsEventId as string),
  );
  return rawEvents.map((e) => (reversedIds.has(e.id) ? { ...e, isReversed: true } : e));
}

/** Effective own/opponent goal counts — `GOAL_FOR`/`GOAL_AGAINST` events remaining after reversal
 * filtering. The single function every score display (LIVE follower, LIVE reporter's own
 * `goalsFor`/`goalsAgainst` React state is the real `LiveMatchClient`'s own concern and already
 * correct; this is for B08's OWN derived displays) must call — never a second, inline count. */
export function deriveEffectiveScore(effectiveEvents: readonly LiveEventSummary[]): { ourGoals: number; opponentGoals: number } {
  return {
    ourGoals: effectiveEvents.filter((e) => e.eventType === "GOAL_FOR").length,
    opponentGoals: effectiveEvents.filter((e) => e.eventType === "GOAL_AGAINST").length,
  };
}

function playerNameFor(playerId: string | null): string | null {
  return playerId ? (b08Squad.find((m) => m.playerId === playerId)?.displayName ?? null) : null;
}

function globalMinuteFor(event: LiveEventSummary): number {
  const period = event.period === "SECOND_HALF" ? 2 : 1;
  return Math.round(periodRelativeToGlobalMinute(period, event.matchSeconds, B08_MATCH_FORMAT));
}

/**
 * Effective goals/assists — a `GOAL_FOR` event paired, via `correctsEventId === clientEventId`
 * (the goal's OWN client-generated id, not its `id` — see `MatchCanonicalLiveEventFact`'s own doc
 * comment, confirmed against real production data), with its own `SCORER_SET`/`ASSIST_SET`
 * corrections. Operates on the EFFECTIVE set only — a reversed goal (already filtered out by
 * `computeEffectiveLiveEvents()`) contributes no goal/assist row, and a scorer/assist correction
 * targeting a reversed goal is likewise absent from the effective set (its own target no longer
 * exists), so it naturally cannot resurrect it. If the coach skipped scorer selection, the goal
 * remains valid but unattributed (`playerName: null`) — never silently assigned.
 */
export function deriveGoalsAndAssists(effectiveEvents: readonly LiveEventSummary[]): { goals: MatchGoalFact[]; assists: MatchAssistFact[] } {
  const goals: MatchGoalFact[] = [];
  const assists: MatchAssistFact[] = [];
  for (const goalEvent of effectiveEvents.filter((e) => e.eventType === "GOAL_FOR")) {
    const scorerEvent = effectiveEvents.find((e) => e.eventType === "SCORER_SET" && e.correctsEventId != null && e.correctsEventId === goalEvent.clientEventId);
    const assistEvent = effectiveEvents.find((e) => e.eventType === "ASSIST_SET" && e.correctsEventId != null && e.correctsEventId === goalEvent.clientEventId);
    goals.push({
      id: goalEvent.id,
      participantKey: scorerEvent?.playerId ?? null,
      playerName: playerNameFor(scorerEvent?.playerId ?? null),
      minute: globalMinuteFor(goalEvent),
      type: "NORMAL",
    });
    if (assistEvent?.playerId) {
      assists.push({ id: `${goalEvent.id}-assist`, participantKey: assistEvent.playerId, playerName: playerNameFor(assistEvent.playerId), type: "NORMAL" });
    }
  }
  return { goals, assists };
}

function toCanonicalLiveEventFacts(effectiveEvents: readonly LiveEventSummary[]): MatchCanonicalLiveEventFact[] {
  return effectiveEvents.map((e) => {
    const isGoal = e.eventType === "GOAL_FOR" || e.eventType === "GOAL_AGAINST";
    return {
      id: e.id,
      eventType: e.eventType,
      playerName: playerNameFor(e.playerId),
      clientEventId: e.clientEventId,
      correctsEventId: e.correctsEventId,
      minuteLabel: isGoal ? `${globalMinuteFor(e)}'` : null,
      period: e.period === "SECOND_HALF" ? 2 : 1,
      matchSeconds: e.matchSeconds,
    };
  });
}

/** The real `buildMatchTimeline()` — never a second, hand-rolled chronology builder — fed the
 * effective (reversal-filtered) event set re-expressed in its own real input shape. */
export function deriveEffectiveTimeline(effectiveEvents: readonly LiveEventSummary[]) {
  return buildMatchTimeline({ canonicalLiveEvents: toCanonicalLiveEventFacts(effectiveEvents), reportGoals: [] });
}

// ---------------------------------------------------------------------------
// Effective history resolution — the ONE place every page decides which match history (reference
// or a real LIVE journey) a persisted report is actually grounded in (third remediation,
// "final data-integrity remediation", defect #1: a reference-mode report edit must never lose
// the canonical 10'/22'/48' chronology by deriving from an empty event array).
// ---------------------------------------------------------------------------

export interface B08EffectiveHistory {
  timeline: MatchDetailAfterData["timeline"];
  liveGoalsRecorded: number;
  /** The reversal-filtered event set itself — `[]` for a `"REFERENCE"` origin (or no journey at
   * all), since a reference-origin report never seeds goals/assists from raw events (it already
   * has its own real report rows — `b08Goals()`/`b08Assists()`). Only meaningful to callers
   * seeding a FRESH draft from a finished LIVE journey that has no report yet. */
  effectiveEvents: readonly LiveEventSummary[];
  /** The real B08 team note for a `"REFERENCE"` origin (the coach's own actual note about THIS
   * match); `""` for `"LIVE_JOURNEY"` — authored narrative about a different, interactive result
   * must never be attached to it (same provenance rule as reflection/observations below). */
  teamNote: string;
  /** Fourth remediation (2026-11-08, "final source-of-truth remediation", defect #1): the real
   * canonical narrative/evidence for a `"REFERENCE"` origin — these facts genuinely describe THIS
   * match regardless of which report fields the coach has since edited (score, attendance, timing)
   * — vs. empty/null for `"LIVE_JOURNEY"`, which has no such narrative to inherit. Previously,
   * `deriveB08AfterDataFromReport()` returned these fields empty/null UNCONDITIONALLY for every
   * persisted report, including a REFERENCE-origin one — so AFTER could report "reflection not
   * recorded" for the same match whose REPORT-DRAFT Reflection tab correctly showed the real,
   * already-submitted debrief. `combinationEvidence` here is the full REFERENCE-origin evidence
   * regardless of report status — `deriveB08AfterDataFromReport()` itself applies the real
   * LOCKED-only availability gate (matching `b08AfterData()`'s own existing "draft never sees it"
   * precedent), not this resolver. */
  reflection: MatchDetailAfterData["reflection"];
  footballObservations: MatchDetailAfterData["footballObservations"];
  opponentObservation: MatchDetailAfterData["opponentObservation"];
  combinationEvidence: MatchDetailAfterData["combinationEvidence"];
  shapeChangeRows: MatchDetailAfterData["shapeChangeRows"];
  firstTimeCanonicalPositions: MatchDetailAfterData["firstTimeCanonicalPositions"];
}

/**
 * Resolves the real chronology/goal-count a persisted (or about-to-be-seeded) report should be
 * built against, given the journey's own recorded `historyOrigin`:
 *
 * - `"LIVE_JOURNEY"` with a real finished event ledger: the reversal-aware effective history
 *   actually recorded during that session (`computeEffectiveLiveEvents()`).
 * - `"REFERENCE"`, or no journey at all (a direct visit): the unchanged canonical reference
 *   history (`fixture-history.ts`'s own `b08Timeline`/`B08_LIVE_GOALS_RECORDED`) — NEVER an empty
 *   derivation. This is the fix for the defect where editing the reference report directly
 *   discarded its own event history.
 */
export function resolveB08EffectiveHistory(
  historyOrigin: B08HistoryOrigin | null,
  journeyEvents: readonly LiveEventSummary[] | null,
): B08EffectiveHistory {
  if (historyOrigin === "LIVE_JOURNEY" && journeyEvents) {
    const effectiveEvents = computeEffectiveLiveEvents(journeyEvents);
    return {
      timeline: deriveEffectiveTimeline(effectiveEvents),
      liveGoalsRecorded: effectiveEvents.filter((e) => e.eventType === "GOAL_FOR").length,
      effectiveEvents,
      teamNote: "",
      reflection: null,
      footballObservations: [],
      opponentObservation: null,
      combinationEvidence: [],
      shapeChangeRows: [],
      firstTimeCanonicalPositions: [],
    };
  }
  return {
    timeline: b08Timeline,
    liveGoalsRecorded: B08_LIVE_GOALS_RECORDED,
    effectiveEvents: [],
    teamNote: B08_TEAM_NOTE,
    reflection: b08Reflection,
    footballObservations: b08FootballObservations,
    opponentObservation: b08OpponentObservation,
    combinationEvidence: b08CombinationEvidence,
    shapeChangeRows: b08ShapeChangeRows,
    firstTimeCanonicalPositions: b08FirstTimeCanonicalPositions,
  };
}

// ---------------------------------------------------------------------------
// AFTER-data projection — only ever called when a persisted report exists (interactive mode)
// ---------------------------------------------------------------------------

const B08_MINUTES_BY_PARTICIPANT = new Map<string, number>(
  b08Squad.filter((m) => m.role === "starter").map((m) => [m.playerId, B08_MATCH_FORMAT.regulationDurationMinutes]),
);

/**
 * Builds `MatchDetailAfterData` from the persisted, reconciled report state — the SAME shape
 * AFTER/REPORT-DRAFT/REPORT-COMPLETED all already consume in reference mode, so no page needs a
 * second rendering path, only a different data source.
 *
 * Narrative/evidence fields (`reflection`, `footballObservations`, `opponentObservation`,
 * `combinationEvidence`, `shapeChangeRows`, `firstTimeCanonicalPositions`) come from `history`
 * (`resolveB08EffectiveHistory()`'s own output) — empty/null for a `"LIVE_JOURNEY"` origin (per the
 * review's own explicit guidance, "mark reference-only observations as unavailable in the
 * interactive journey... do not fabricate observations to make the page appear complete"), but the
 * REAL canonical values for a `"REFERENCE"` origin: this report is still grounded in the same real
 * match, so its real reflection/observations/evidence remain true regardless of which report
 * fields (score, attendance, timing) the coach has since edited. `combinationEvidence` is further
 * gated here on `report.status === "LOCKED"` — matching `b08AfterData()`'s own existing, real
 * "a draft report never sees combination evidence" rule (`getMatchDetailAfterData()` only loads it
 * for a LOCKED report) — never exposed in DRAFT merely because the canonical fixture has it.
 *
 * `history` is also how this function gets the real chronology/goal-count/team-note — third
 * remediation ("final data-integrity remediation"): previously took a raw `effectiveEvents` array
 * that a REFERENCE-origin caller had no correct way to populate (it has no LIVE event ledger at
 * all), so every reference-mode edit silently derived an EMPTY timeline. Routing through the
 * resolved history here means a reference-origin report keeps its own real 10'/22'/48' chronology,
 * and a LIVE_JOURNEY-origin report keeps exactly what was actually recorded — never a third guess.
 */
export function deriveB08AfterDataFromReport(report: B08PersistedReportState, history: B08EffectiveHistory): MatchDetailAfterData {
  const attendanceFacts: MatchAttendanceFact[] = report.players.map((p) => ({ attendanceStatus: p.attendanceStatus, playerName: p.playerName }));
  const presentParticipants = report.players
    .filter((p) => p.attendanceStatus === "PRESENT")
    .map((p) => ({ participantKey: p.playerId, playerName: p.playerName }));
  const timingNeedsReviewCount = report.timingReview.filter((t) => t.needsReview).length;
  const liveGoalsRecorded = history.liveGoalsRecorded;
  // `B08PersistedReportState.goals/assists` mirrors `SafeReportLocalState`'s own shape
  // (`playerId`/`playerName`) — re-expressed here in the real `MatchGoalFact`/`MatchAssistFact`
  // shape (`participantKey`/`type`) the real aggregate functions below consume, matching
  // `SafePostMatchReportShell`'s own identical `liveGoalScorers`/`liveAssistProviders` mapping.
  const goalFacts: MatchGoalFact[] = report.goals.map((g) => ({ id: g.id, participantKey: g.playerId, playerName: g.playerName, minute: g.minute, type: "NORMAL" }));
  const assistFacts: MatchAssistFact[] = report.assists.map((a) => ({ id: a.id, participantKey: a.playerId, playerName: a.playerName, type: "NORMAL" }));

  return {
    reportId: null,
    reportStatus: report.status,
    homeGoals: report.ourScore,
    awayGoals: report.opponentScore,
    teamNote: history.teamNote,
    completedBy: report.completedBy,
    completedAt: report.completedAt,
    attendance: attendanceFacts,
    attendanceSummary: summarizeMatchAttendance(attendanceFacts),
    goalScorers: aggregateGoalScorers(goalFacts),
    assistProviders: aggregateAssistProviders(assistFacts),
    timeline: history.timeline,
    playerMinutes: B08_MINUTES_BY_PARTICIPANT,
    playerInvolvement: buildPlayerInvolvement({
      presentParticipants,
      goals: goalFacts,
      assists: assistFacts,
      observationCountByParticipant: new Map(),
      minutesByParticipant: B08_MINUTES_BY_PARTICIPANT,
    }),
    reflection: history.reflection,
    footballObservations: history.footballObservations,
    opponentObservation: history.opponentObservation,
    combinationEvidence: report.status === "LOCKED" ? history.combinationEvidence : [],
    goalAttributionGap: {
      liveGoalsRecorded,
      attributedGoals: report.goals.length,
      hasGap: report.goals.length < liveGoalsRecorded,
    },
    timingNeedsReviewCount,
    outOfRangeEventCount: report.outOfRangeEventCount,
    shapeChangeRows: history.shapeChangeRows,
    firstTimeCanonicalPositions: history.firstTimeCanonicalPositions,
  };
}

/** The same real `buildMatchPresentation()` every other B08 identity snapshot uses — never a
 * hand-rolled header — fed the reconciled report's own score instead of the canonical fixture's. */
export function deriveB08IdentityFromReport(report: B08PersistedReportState, lifecycleStatus: "report_incomplete" | "done"): MatchPresentation {
  const ownGoals = report.ourScore;
  const opponentGoals = report.opponentScore;
  const outcome = ownGoals > opponentGoals ? "WON" : ownGoals < opponentGoals ? "LOST" : "DRAWN";
  return buildMatchPresentation({
    id: B08_MATCH_ID,
    href: null,
    teamName: MATCH_B_TEAM_NAME,
    opponentName: B08_OPPONENT_NAME,
    isHome: true,
    kickoffAt: B08_KICKOFF_AT,
    lifecycleStatus,
    ownGoals,
    opponentGoals,
    outcome,
  });
}
