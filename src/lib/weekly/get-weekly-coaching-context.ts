import "server-only";

import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { formatIsoWeekLabel, getWeekRangeFromIsoWeekKey } from "@/lib/date-utils";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { deriveRoundProgress, type RoundProgressMatchInput } from "@/lib/rounds/round-progress";
import { deriveWeeklyContextStatus } from "./derive-weekly-coaching-context";
import type {
  WeeklyCoachingContext,
  WeeklyCoachingContextResult,
  WeeklyMatchRef,
  WeeklyPlayerDisplay,
} from "./weekly-coaching-context-types";

function toReportStatus(status: string | undefined): "NONE" | "DRAFT" | "REPORTED" | "LOCKED" {
  if (status === "DRAFT" || status === "REPORTED" || status === "LOCKED") return status;
  return "NONE";
}

function playerDisplay(player: { firstName: string; lastName: string | null }): string {
  return `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}`;
}

function emptyContext(weekKey: string, leagueSeasonId: string | null): WeeklyCoachingContext {
  const { startsAt, endsAt } = getWeekRangeFromIsoWeekKey(weekKey);
  return {
    weekKey,
    weekLabel: formatIsoWeekLabel(startsAt),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: "IN_PROGRESS",
    leagueSeasonId,
    activity: { leagueMatches: [], eventMatches: [] },
    opportunity: { availableWithoutPlannedLeagueOpportunityPlayerIds: [] },
    noRecordedAppearance: null,
    planActual: { plannedButAbsent: [], unplannedAppearances: [] },
    movement: { supportAppearances: [] },
    reporting: { incompleteLeagueMatchIds: [], incompleteEventMatchIds: [] },
  };
}

/**
 * Loads the Weekly Coaching Context for one ISO week (ADR-0108, docs/domain/weekly-coaching-context.md).
 * Derived-only, batched (no per-match loop), reuses every canonical fact owner rather than
 * recomputing: computeRoundPlanIntegrity() for opportunity, MovementLedger for movement, the same
 * planned-vs-actual classification meaning as planned-vs-actual-delta.ts (batched differently),
 * and deriveRoundProgress()'s completeness rule for status.
 *
 * League and Event facts are always computed from their own source's rows only -- a
 * participant's Event appearance can never satisfy a League "no recorded appearance"/"planned but
 * absent" fact, and vice versa (AGENTS.md "League and Event: shown together, fairness kept
 * apart").
 */
export async function getWeeklyCoachingContext(
  orgFilter: OrgFilterMode,
  params: { leagueSeasonId: string | null; weekKey: string },
): Promise<WeeklyCoachingContextResult> {
  const { leagueSeasonId, weekKey } = params;
  const orgWhere = orgFilter.filter;

  if (!leagueSeasonId) {
    return { context: emptyContext(weekKey, null), playerDisplayById: {}, matchDisplayById: {} };
  }

  const { startsAt, endsAt } = getWeekRangeFromIsoWeekKey(weekKey);
  const weekRange = { gte: startsAt, lte: endsAt };

  const [leagueMatches, eventMatches, round] = await Promise.all([
    db.match.findMany({
      where: { ...orgWhere, matchRound: { leagueSeasonId }, startsAt: weekRange },
      select: {
        id: true,
        teamId: true,
        startsAt: true,
        status: true,
        opponent: true,
        homeAway: true,
        team: { select: { name: true } },
      },
    }),
    db.eventMatch.findMany({
      where: { ...orgWhere, startsAt: weekRange },
      select: { id: true, eventSquadId: true, opponentName: true, startsAt: true, status: true },
    }),
    db.matchRound.findFirst({
      where: { ...orgWhere, leagueSeasonId, matches: { some: { startsAt: weekRange } } },
      select: { id: true },
    }),
  ]);

  if (leagueMatches.length === 0 && eventMatches.length === 0) {
    return { context: emptyContext(weekKey, leagueSeasonId), playerDisplayById: {}, matchDisplayById: {} };
  }

  const leagueMatchIds = leagueMatches.map((m) => m.id);
  const eventMatchIds = eventMatches.map((m) => m.id);

  const [
    leagueReports,
    eventReports,
    finalizedSelections,
    leagueActuals,
    eventActuals,
    supportMovements,
    integrity,
  ] = await Promise.all([
    leagueMatchIds.length > 0
      ? db.postMatchReport.findMany({
          where: { matchId: { in: leagueMatchIds } },
          select: { matchId: true, status: true },
        })
      : Promise.resolve([]),
    eventMatchIds.length > 0
      ? db.eventPostMatchReport.findMany({
          where: { eventMatchId: { in: eventMatchIds } },
          select: { eventMatchId: true, status: true },
        })
      : Promise.resolve([]),
    leagueMatchIds.length > 0
      ? db.selection.findMany({
          where: { matchId: { in: leagueMatchIds }, status: "FINALIZED" },
          select: {
            playerId: true,
            matchId: true,
            player: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
    leagueMatchIds.length > 0
      ? db.postMatchPlayerActual.findMany({
          where: { matchId: { in: leagueMatchIds } },
          select: {
            playerId: true,
            matchId: true,
            attendanceStatus: true,
            player: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
    eventMatchIds.length > 0
      ? db.eventPostMatchPlayer.findMany({
          where: { report: { eventMatchId: { in: eventMatchIds } } },
          select: {
            playerId: true,
            attendanceStatus: true,
            report: { select: { eventMatchId: true } },
            player: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
    leagueMatchIds.length > 0
      ? db.movementLedger.findMany({
          where: { matchId: { in: leagueMatchIds }, role: "SUPPORT" },
          select: {
            playerId: true,
            matchId: true,
            fromTeamId: true,
            toTeamId: true,
            player: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
    round ? computeRoundPlanIntegrity(round.id) : Promise.resolve(null),
  ]);

  const leagueReportByMatchId = new Map(leagueReports.map((r) => [r.matchId, r.status]));
  const eventReportByMatchId = new Map(eventReports.map((r) => [r.eventMatchId, r.status]));

  const playerDisplayById: Record<string, WeeklyPlayerDisplay> = {};
  const rememberPlayer = (playerId: string, player: { firstName: string; lastName: string | null } | null) => {
    if (!player || playerDisplayById[playerId]) return;
    playerDisplayById[playerId] = { displayName: playerDisplay(player), href: `/players/${playerId}` };
  };

  // --- Activity -------------------------------------------------------------------------------
  const leagueMatchRefs: WeeklyMatchRef[] = leagueMatches.map((m) => {
    const reportStatus = toReportStatus(leagueReportByMatchId.get(m.id));
    return {
      matchId: m.id,
      source: "LEAGUE",
      startsAt: m.startsAt.toISOString(),
      isCancelled: m.status === "CANCELLED",
      isReportComplete: reportStatus === "REPORTED" || reportStatus === "LOCKED",
      hasReport: reportStatus !== "NONE",
    };
  });
  const eventMatchRefs: WeeklyMatchRef[] = eventMatches.map((m) => {
    const reportStatus = toReportStatus(eventReportByMatchId.get(m.id));
    return {
      matchId: m.id,
      source: "EVENT",
      startsAt: m.startsAt.toISOString(),
      isCancelled: m.status === "CANCELLED",
      isReportComplete: reportStatus === "REPORTED" || reportStatus === "LOCKED",
      hasReport: reportStatus !== "NONE",
    };
  });

  // --- Status (reuses deriveRoundProgress()'s completeness rule) ------------------------------
  const progressInputs: RoundProgressMatchInput[] = [
    ...leagueMatches.map((m) => ({
      status: m.status,
      startsAt: m.startsAt,
      reportStatus: toReportStatus(leagueReportByMatchId.get(m.id)),
    })),
    ...eventMatches.map((m) => ({
      status: m.status,
      startsAt: m.startsAt,
      reportStatus: toReportStatus(eventReportByMatchId.get(m.id)),
    })),
  ];
  const status = deriveWeeklyContextStatus(deriveRoundProgress(progressInputs).stage);

  // --- Plan vs actual (League only -- "planned" has no Event equivalent) ---------------------
  const leagueActualsByMatch = new Map<string, Set<string>>();
  for (const act of leagueActuals) {
    if (!act.playerId) continue; // ADR-0106: a GuestPlayer actual is never "planned" by definition
    const set = leagueActualsByMatch.get(act.matchId) ?? new Set<string>();
    set.add(act.playerId);
    leagueActualsByMatch.set(act.matchId, set);
  }
  const leaguePresentByMatch = new Map<string, Set<string>>();
  for (const act of leagueActuals) {
    if (!act.playerId || act.attendanceStatus !== "PRESENT") continue;
    const set = leaguePresentByMatch.get(act.matchId) ?? new Set<string>();
    set.add(act.playerId);
    leaguePresentByMatch.set(act.matchId, set);
  }
  const finalizedByMatch = new Map<string, Set<string>>();
  for (const sel of finalizedSelections) {
    const set = finalizedByMatch.get(sel.matchId) ?? new Set<string>();
    set.add(sel.playerId);
    finalizedByMatch.set(sel.matchId, set);
  }

  const plannedButAbsent = finalizedSelections
    .filter((sel) => !(leaguePresentByMatch.get(sel.matchId)?.has(sel.playerId) ?? false))
    .map((sel) => {
      rememberPlayer(sel.playerId, sel.player);
      return { playerId: sel.playerId, matchId: sel.matchId };
    });

  const unplannedAppearances = leagueActuals
    .filter((act) => act.playerId && act.attendanceStatus === "PRESENT")
    .filter((act) => !(finalizedByMatch.get(act.matchId)?.has(act.playerId!) ?? false))
    .map((act) => {
      rememberPlayer(act.playerId!, act.player);
      return { playerId: act.playerId!, matchId: act.matchId, source: "LEAGUE" as const };
    });

  // --- Movement (League only -- MovementLedger has no Event equivalent) ----------------------
  const movementSupportAppearances = supportMovements.map((mv) => {
    rememberPlayer(mv.playerId, mv.player);
    return { playerId: mv.playerId, matchId: mv.matchId, fromTeamId: mv.fromTeamId, toTeamId: mv.toTeamId };
  });

  // --- Opportunity (reuses computeRoundPlanIntegrity()'s signals verbatim) --------------------
  const opportunityPlayerIds = integrity
    ? [
        ...new Set(
          integrity.signals
            .filter((s) => s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" && s.playerId)
            .map((s) => s.playerId!),
        ),
      ]
    : [];

  // --- No recorded appearance (only meaningful once status is COMPLETE) -----------------------
  // League: candidate pool is players who were finalized-planned for a week match; the gap is a
  // player with literally no PostMatchPlayerActual row at all for that match -- distinct from
  // plannedButAbsent, which also includes players with an explicit NO_SHOW/UNKNOWN row.
  let noRecordedAppearanceIds: string[] | null = null;
  if (status === "COMPLETE") {
    const leagueGap = finalizedSelections
      .filter((sel) => !(leagueActualsByMatch.get(sel.matchId)?.has(sel.playerId) ?? false))
      .map((sel) => {
        rememberPlayer(sel.playerId, sel.player);
        return sel.playerId;
      });

    // Event: candidate pool is squad-assigned players (Player only -- GuestPlayers never receive
    // longitudinal statistics, ADR-0106) for a squad that had a match this week; the gap is a
    // player with no EventPostMatchPlayer row at all for that match.
    const eventSquadIds = [...new Set(eventMatches.map((m) => m.eventSquadId))];
    const eventCandidates =
      eventSquadIds.length > 0
        ? await db.eventSquadPlayer.findMany({
            where: { eventSquadId: { in: eventSquadIds }, playerId: { not: null } },
            select: {
              playerId: true,
              eventSquadId: true,
              player: { select: { firstName: true, lastName: true } },
            },
          })
        : [];
    const eventSquadIdByMatchId = new Map(eventMatches.map((m) => [m.id, m.eventSquadId]));
    const eventAnyRecordedByMatch = new Map<string, Set<string>>();
    for (const act of eventActuals) {
      if (!act.playerId) continue;
      const matchId = act.report.eventMatchId;
      const set = eventAnyRecordedByMatch.get(matchId) ?? new Set<string>();
      set.add(act.playerId);
      eventAnyRecordedByMatch.set(matchId, set);
    }
    const eventGap: string[] = [];
    for (const match of eventMatches) {
      const recorded = eventAnyRecordedByMatch.get(match.id) ?? new Set<string>();
      for (const candidate of eventCandidates) {
        if (candidate.eventSquadId !== eventSquadIdByMatchId.get(match.id)) continue;
        if (!candidate.playerId || recorded.has(candidate.playerId)) continue;
        rememberPlayer(candidate.playerId, candidate.player);
        eventGap.push(candidate.playerId);
      }
    }

    noRecordedAppearanceIds = [...new Set([...leagueGap, ...eventGap])];
  }

  // --- Reporting completeness -------------------------------------------------------------------
  const incompleteLeagueMatchIds = leagueMatches
    .filter((m) => m.status !== "CANCELLED")
    .filter((m) => {
      const s = toReportStatus(leagueReportByMatchId.get(m.id));
      return s === "NONE" || s === "DRAFT";
    })
    .map((m) => m.id);
  const incompleteEventMatchIds = eventMatches
    .filter((m) => m.status !== "CANCELLED")
    .filter((m) => {
      const s = toReportStatus(eventReportByMatchId.get(m.id));
      return s === "NONE" || s === "DRAFT";
    })
    .map((m) => m.id);

  const matchDisplayById: WeeklyCoachingContextResult["matchDisplayById"] = {};
  for (const m of leagueMatches) {
    const homeAwayLabel = m.homeAway === "HOME" ? "vs" : "@";
    matchDisplayById[m.id] = { label: `${m.team.name} ${homeAwayLabel} ${m.opponent}`, href: `/matches/${m.id}` };
  }
  for (const m of eventMatches) {
    matchDisplayById[m.id] = { label: `vs ${m.opponentName}`, href: `/matches/${m.id}` };
  }

  const context: WeeklyCoachingContext = {
    weekKey,
    weekLabel: formatIsoWeekLabel(startsAt),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status,
    leagueSeasonId,
    activity: { leagueMatches: leagueMatchRefs, eventMatches: eventMatchRefs },
    opportunity: { availableWithoutPlannedLeagueOpportunityPlayerIds: opportunityPlayerIds },
    noRecordedAppearance: noRecordedAppearanceIds ? { playerIds: noRecordedAppearanceIds } : null,
    planActual: { plannedButAbsent, unplannedAppearances },
    movement: { supportAppearances: movementSupportAppearances },
    reporting: { incompleteLeagueMatchIds, incompleteEventMatchIds },
  };

  return { context, playerDisplayById, matchDisplayById };
}
