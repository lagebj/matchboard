import "server-only";
import { db } from "@/lib/db";
import { getMatchTimingReviewItems, getOutOfRangeEventCount } from "@/lib/live-match/timing-review";
import { computeGoalAttributionGap } from "@/lib/reports/report-mutations";
import { getMatchCombinationEvidence } from "@/lib/evidence/combination-aggregation";
import { buildLeagueMatchRef } from "@/lib/evidence/adapters/league-evidence-adapter";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";
import {
  aggregateGoalScorers,
  aggregateAssistProviders,
  buildMatchTimeline,
  summarizeMatchAttendance,
  computePlayerMinutesFromIntervals,
  buildPlayerInvolvement,
  type MatchCanonicalLiveEventFact,
  type PlayerInvolvementRow,
  type MatchGoalFact,
  type MatchAssistFact,
  type MatchAttendanceFact,
} from "@/lib/matches/match-detail-view-model";

/**
 * Bounded, server-only read model for the Match Details AFTER-match surface
 * (`.matchboard-work/matchboard_match_details_exact_goldens_2026-09-18/`).
 *
 * Called only once `deriveMatchDetailSurfaceState()` says AFTER — a planned/upcoming match never
 * pays for this query set (`08_COMPONENT_AND_ROUTE_ARCHITECTURE.md`: "Do not fetch the complete
 * post-match graph for an upcoming match."). The caller (the route) has already established
 * actor/tenant context; this module only accepts the already-authorized filter it needs — it
 * does not perform authorization itself.
 */

const RELEVANT_LIVE_EVENT_TYPES = [
  "GOAL_FOR",
  "GOAL_AGAINST",
  "SCORER_SET",
  "ASSIST_SET",
  "ROTATION_OUT",
  "ROTATION_IN",
  "PERIOD_START",
  "PERIOD_END",
  "MATCH_END",
  "FAIR_PLAY_POSITIVE",
  "FAIR_PLAY_CONCERN",
] as const;

export interface MatchDetailAfterData {
  reportId: string | null;
  reportStatus: "DRAFT" | "REPORTED" | "LOCKED" | null;
  homeGoals: number | null;
  awayGoals: number | null;
  teamNote: string | null;
  completedBy: string | null;
  completedAt: string | null;
  attendance: MatchAttendanceFact[];
  attendanceSummary: ReturnType<typeof summarizeMatchAttendance>;
  goalScorers: ReturnType<typeof aggregateGoalScorers>;
  assistProviders: ReturnType<typeof aggregateAssistProviders>;
  timeline: ReturnType<typeof buildMatchTimeline>;
  playerMinutes: Map<string, number>;
  playerInvolvement: PlayerInvolvementRow[];
  reflection: {
    effort: string | null;
    teamCohesion: string | null;
    positionalShape: string | null;
    recoveryBehavior: string | null;
    note: string | null;
  } | null;
  footballObservations: {
    id: string;
    playerId: string;
    playerName: string;
    observationCode: string;
    polarity: string;
    note: string | null;
  }[];
  opponentObservation: {
    overallEnvironment: string | null;
    playingStyleTags: string[];
    factualSummary: string | null;
  } | null;
  combinationEvidence: CombinationEvidenceRow[];
  goalAttributionGap: Awaited<ReturnType<typeof computeGoalAttributionGap>>;
  timingNeedsReviewCount: number;
  outOfRangeEventCount: number;
}

export async function getMatchDetailAfterData(params: {
  matchId: string;
  organisationId: string;
  orgFilter: { filter: Record<string, unknown>; filterNullable: Record<string, unknown> };
}): Promise<MatchDetailAfterData> {
  const { matchId, organisationId, orgFilter } = params;

  const report = await db.postMatchReport.findFirst({
    where: { matchId, ...orgFilter.filterNullable },
    include: {
      playerActuals: { select: { id: true, playerId: true, guestPlayerId: true, attendanceStatus: true } },
      goals: { select: { id: true, playerId: true, guestPlayerId: true, minute: true, type: true } },
      assists: { select: { id: true, playerId: true, guestPlayerId: true, type: true } },
    },
  });

  const [teamReflection, opponentObservationRow, footballObservationRows, liveEventRows, intervalRows] =
    await Promise.all([
      db.teamReflection.findFirst({
        where: { matchId, ...orgFilter.filterNullable },
        select: { effort: true, teamCohesion: true, positionalShape: true, recoveryBehavior: true, note: true },
      }),
      db.opponentEncounterObservation.findFirst({
        where: { matchId, ...orgFilter.filterNullable },
        select: { overallEnvironment: true, playingStyleTags: true, factualSummary: true },
      }),
      db.playerDevelopmentObservation.findMany({
        where: { matchId, kind: "ATTRIBUTE", ...orgFilter.filter },
        orderBy: { observedAt: "desc" },
        select: { id: true, playerId: true, attributeKey: true, direction: true, observableNote: true },
      }),
      db.liveMatchEvent.findMany({
        where: {
          matchId,
          organisationId,
          OR: [{ correctionType: null }, { correctionType: "CORRECTION" }],
          eventType: { in: [...RELEVANT_LIVE_EVENT_TYPES] },
        },
        select: {
          id: true,
          eventType: true,
          playerId: true,
          period: true,
          matchSeconds: true,
          correctsEventId: true,
        },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
      }),
      db.actualPositionInterval.findMany({
        where: { matchId, organisationId },
        select: { playerId: true, guestPlayerId: true, startedAtMs: true, endedAtMs: true },
      }),
    ]);

  // ADR-0138 H1 follow-up (mirrored from report-mutations.ts's own seeding logic): a reversed
  // event's `correctsEventId`-target row survives the `correctionType` filter above and must be
  // excluded separately.
  const reversalRows = await db.liveMatchEvent.findMany({
    where: { matchId, organisationId, eventType: "EVENT_REVERSED", correctsEventId: { not: null } },
    select: { correctsEventId: true },
  });
  const reversedEventIds = new Set(reversalRows.map((r) => r.correctsEventId as string));
  const liveEvents = liveEventRows.filter((e) => !reversedEventIds.has(e.id));

  // Batch-resolve every referenced player/guest name in one extra pair of queries — no N+1.
  const playerIds = new Set<string>();
  const guestPlayerIds = new Set<string>();
  for (const p of report?.playerActuals ?? []) {
    if (p.playerId) playerIds.add(p.playerId);
    if (p.guestPlayerId) guestPlayerIds.add(p.guestPlayerId);
  }
  for (const g of report?.goals ?? []) {
    if (g.playerId) playerIds.add(g.playerId);
    if (g.guestPlayerId) guestPlayerIds.add(g.guestPlayerId);
  }
  for (const a of report?.assists ?? []) {
    if (a.playerId) playerIds.add(a.playerId);
    if (a.guestPlayerId) guestPlayerIds.add(a.guestPlayerId);
  }
  for (const e of liveEvents) {
    if (e.playerId) playerIds.add(e.playerId);
  }
  for (const o of footballObservationRows) {
    if (o.playerId) playerIds.add(o.playerId);
  }
  for (const i of intervalRows) {
    if (i.playerId) playerIds.add(i.playerId);
    if (i.guestPlayerId) guestPlayerIds.add(i.guestPlayerId);
  }

  const [players, guestPlayers] = await Promise.all([
    playerIds.size > 0
      ? db.player.findMany({ where: { id: { in: [...playerIds] } }, select: { id: true, firstName: true, lastName: true } })
      : Promise.resolve([]),
    guestPlayerIds.size > 0
      ? db.guestPlayer.findMany({ where: { id: { in: [...guestPlayerIds] } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const nameByPlayerId = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName ?? ""}`.trim()]));
  const nameByGuestId = new Map(guestPlayers.map((g) => [g.id, `${g.name} (guest)`]));

  function participantKeyAndName(playerId: string | null, guestPlayerId: string | null): {
    participantKey: string | null;
    playerName: string | null;
  } {
    if (playerId) return { participantKey: playerId, playerName: nameByPlayerId.get(playerId) ?? null };
    if (guestPlayerId) return { participantKey: `guest:${guestPlayerId}`, playerName: nameByGuestId.get(guestPlayerId) ?? null };
    return { participantKey: null, playerName: null };
  }

  const attendance: MatchAttendanceFact[] = (report?.playerActuals ?? []).map((p) => {
    const { playerName } = participantKeyAndName(p.playerId, p.guestPlayerId);
    return { attendanceStatus: p.attendanceStatus, playerName: playerName ?? "Unknown player" };
  });
  const presentParticipants = (report?.playerActuals ?? [])
    .filter((p) => p.attendanceStatus === "PRESENT")
    .map((p) => participantKeyAndName(p.playerId, p.guestPlayerId))
    .filter((p): p is { participantKey: string; playerName: string } => p.participantKey !== null)
    .map((p) => ({ participantKey: p.participantKey, playerName: p.playerName ?? "Unknown player" }));

  const goalFacts: MatchGoalFact[] = (report?.goals ?? []).map((g) => {
    const { participantKey, playerName } = participantKeyAndName(g.playerId, g.guestPlayerId);
    return { id: g.id, participantKey, playerName, minute: g.minute, type: g.type };
  });
  const assistFacts: MatchAssistFact[] = (report?.assists ?? []).map((a) => {
    const { participantKey, playerName } = participantKeyAndName(a.playerId, a.guestPlayerId);
    return { id: a.id, participantKey, playerName, type: a.type };
  });

  const canonicalLiveEventFacts: MatchCanonicalLiveEventFact[] = liveEvents.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    playerName: e.playerId ? (nameByPlayerId.get(e.playerId) ?? null) : null,
    correctsEventId: e.correctsEventId,
    // Minute math intentionally deferred — see the module doc comment: this route does not yet
    // have a period-duration-aware cumulative-minute resolver wired in, so the raw
    // within-period elapsed time is used directly as an honest, non-invented label. This
    // under-counts events after the first period (no period-duration offset is added) rather
    // than guessing one — a disclosed, conservative simplification, not fabricated data. A
    // future pass can widen this using `getMatchTimingReviewItems()`'s own resolved period
    // durations to add each prior period's real duration as an offset.
    minuteLabel: e.matchSeconds != null ? `${Math.floor(e.matchSeconds / 60_000)}'` : null,
    period: e.period,
    matchSeconds: e.matchSeconds,
  }));

  const footballObservations = footballObservationRows
    .filter((o) => o.attributeKey !== null)
    .map((o) => ({
      id: o.id,
      playerId: o.playerId,
      playerName: nameByPlayerId.get(o.playerId) ?? "Unknown player",
      observationCode: o.attributeKey as string,
      polarity: o.direction,
      note: o.observableNote,
    }));

  const intervalFacts = intervalRows
    .map((i) => {
      const { participantKey } = participantKeyAndName(i.playerId, i.guestPlayerId);
      return participantKey ? { participantKey, startedAtMs: i.startedAtMs, endedAtMs: i.endedAtMs } : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const observationCountByParticipant = new Map<string, number>();
  for (const o of footballObservations) {
    observationCountByParticipant.set(o.playerId, (observationCountByParticipant.get(o.playerId) ?? 0) + 1);
  }
  const playerMinutes = computePlayerMinutesFromIntervals(intervalFacts);
  const playerInvolvement = buildPlayerInvolvement({
    presentParticipants,
    goals: goalFacts,
    assists: assistFacts,
    observationCountByParticipant,
    minutesByParticipant: playerMinutes,
  });

  const leagueMatchRef = report ? await buildLeagueMatchRef(matchId) : null;
  const [goalAttributionGap, timingReviewItems, outOfRangeEventCount, combinationEvidence] = await Promise.all([
    report ? computeGoalAttributionGap(matchId, organisationId) : Promise.resolve(null),
    leagueMatchRef ? getMatchTimingReviewItems(leagueMatchRef) : Promise.resolve([]),
    leagueMatchRef ? getOutOfRangeEventCount(leagueMatchRef) : Promise.resolve(0),
    // Combination evidence is available only for a locked report (data-mapping rule, §"Player
    // combinations"): "Implement only for locked report."
    report?.status === "LOCKED" ? getMatchCombinationEvidence(matchId) : Promise.resolve([]),
  ]);

  return {
    reportId: report?.id ?? null,
    reportStatus: report?.status ?? null,
    homeGoals: report?.homeGoals ?? null,
    awayGoals: report?.awayGoals ?? null,
    teamNote: report?.teamNote ?? null,
    completedBy: report?.completedBy ?? null,
    completedAt: report?.completedAt?.toISOString() ?? null,
    attendance,
    attendanceSummary: summarizeMatchAttendance(attendance),
    goalScorers: aggregateGoalScorers(goalFacts),
    assistProviders: aggregateAssistProviders(assistFacts),
    timeline: buildMatchTimeline({ canonicalLiveEvents: canonicalLiveEventFacts, reportGoals: goalFacts }),
    playerMinutes,
    playerInvolvement,
    reflection: teamReflection ?? null,
    footballObservations,
    opponentObservation: opponentObservationRow ?? null,
    combinationEvidence,
    goalAttributionGap,
    timingNeedsReviewCount: timingReviewItems.filter((t) => t.reviewStatus === "NEEDS_REVIEW").length,
    outOfRangeEventCount,
  };
}
