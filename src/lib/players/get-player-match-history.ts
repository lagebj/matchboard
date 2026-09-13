import "server-only";

import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPlayerActualPositionHistory } from "@/lib/player-development/position-usage-history";

/**
 * Player Detail's Matches tab (Atlas Follow-up Phase F8, `04_PLAYER_DETAIL_CONTRACT.md §5`) —
 * "What football has this player actually experienced?" Built directly on the existing, already-
 * canonical `getPlayerActualPositionHistory()` (League+Event parity via `ActualPositionInterval`,
 * ADR-0096/ADR-0104/ADR-0113) rather than a second actual-history query, enriched with each
 * match's opponent name (a cheap, direct field on both `Match` and `EventMatch`), the player's
 * per-match goals/assists (canonical `Goal`/`Assist` events for League — per AGENTS.md's
 * "Canonical data truth" — and `EventGoalEvent`/`EventAssistEvent` for Event), and the planned
 * selection role for League matches (`Selection.role`, DRAFT or FINALIZED — the plan context the
 * actual appearance was recorded under).
 *
 * Deliberately deferred, disclosed scope (per `00_AUTHORITY_AND_EXECUTION_CONTRACT.md §4`, "omit
 * unsupported content cleanly, never fabricate it"): `competitionLabel` — no single canonical
 * "competition name" field exists for a League match today (opponent + date already identify it
 * uniquely for this list). Event matches carry their Event's name via the caller's own
 * league-season/event context, not duplicated here.
 */
export type PlayerMatchHistoryEntry = {
  matchKey: string;
  source: "LEAGUE_MATCH" | "EVENT_MATCH";
  playedAt: Date;
  opponentOrEventName: string;
  minutes: number;
  /** Ordered by minutes played at that position, descending — not a chronological in-match sequence. */
  actualPositions: string[];
  goals: number;
  assists: number;
  /** The planned role this match was recorded under — `null` for Event matches and unplanned (helper/emergency) appearances. */
  plannedRole: "CORE" | "SUPPORT" | "DEVELOPMENT" | null;
  /** The player's earliest recorded interval in this match began at match minute 0 — the honest "started" fact. */
  startedAtKickoff: boolean;
  /** For Event matches: the parent Event's id (the Event detail page is the canonical destination). `null` for League. */
  eventId: string | null;
};

export async function getPlayerMatchHistory(
  playerId: string,
  orgFilter: OrgFilterMode,
  limit = 20,
): Promise<PlayerMatchHistoryEntry[]> {
  const usage = await getPlayerActualPositionHistory(playerId, orgFilter, limit);
  if (usage.length === 0 || orgFilter.type !== "org") return [];

  const leagueKeys = usage.filter((u) => u.source === "LEAGUE_MATCH").map((u) => u.matchKey);
  const eventKeys = usage.filter((u) => u.source === "EVENT_MATCH").map((u) => u.matchKey);

  const [leagueMatches, eventMatches, leagueGoals, leagueAssists, leagueSelections, eventGoals, eventAssists] =
    await Promise.all([
      leagueKeys.length > 0
        ? db.match.findMany({
            where: { id: { in: leagueKeys }, organisationId: orgFilter.organisationId },
            select: { id: true, opponent: true },
          })
        : Promise.resolve([]),
      eventKeys.length > 0
        ? db.eventMatch.findMany({
            where: { id: { in: eventKeys }, organisationId: orgFilter.organisationId },
            select: { id: true, opponentName: true, eventId: true },
          })
        : Promise.resolve([]),
      leagueKeys.length > 0
        ? db.goal.findMany({
            where: { playerId, report: { matchId: { in: leagueKeys }, status: { in: ["REPORTED", "LOCKED"] } } },
            select: { id: true, report: { select: { matchId: true } } },
          })
        : Promise.resolve([]),
      leagueKeys.length > 0
        ? db.assist.findMany({
            where: { playerId, report: { matchId: { in: leagueKeys }, status: { in: ["REPORTED", "LOCKED"] } } },
            select: { id: true, report: { select: { matchId: true } } },
          })
        : Promise.resolve([]),
      leagueKeys.length > 0
        ? db.selection.findMany({
            where: { playerId, matchId: { in: leagueKeys }, organisationId: orgFilter.organisationId },
            select: { matchId: true, role: true },
          })
        : Promise.resolve([]),
      eventKeys.length > 0
        ? db.eventGoalEvent.findMany({
            where: { playerId, report: { eventMatchId: { in: eventKeys }, status: { in: ["REPORTED", "LOCKED"] } } },
            select: { id: true, report: { select: { eventMatchId: true } } },
          })
        : Promise.resolve([]),
      eventKeys.length > 0
        ? db.eventAssistEvent.findMany({
            where: { playerId, report: { eventMatchId: { in: eventKeys }, status: { in: ["REPORTED", "LOCKED"] } } },
            select: { id: true, report: { select: { eventMatchId: true } } },
          })
        : Promise.resolve([]),
    ]);

  const leagueOpponentById = new Map(leagueMatches.map((m) => [m.id, m.opponent]));
  const eventOpponentById = new Map(eventMatches.map((m) => [m.id, m.opponentName]));
  const eventEventIdById = new Map(eventMatches.map((m) => [m.id, m.eventId]));

  const leagueGoalCount = new Map<string, number>();
  for (const g of leagueGoals) {
    const matchId = g.report.matchId;
    leagueGoalCount.set(matchId, (leagueGoalCount.get(matchId) ?? 0) + 1);
  }
  const leagueAssistCount = new Map<string, number>();
  for (const a of leagueAssists) {
    const matchId = a.report.matchId;
    leagueAssistCount.set(matchId, (leagueAssistCount.get(matchId) ?? 0) + 1);
  }
  const eventGoalCount = new Map<string, number>();
  for (const g of eventGoals) {
    const matchId = g.report.eventMatchId;
    eventGoalCount.set(matchId, (eventGoalCount.get(matchId) ?? 0) + 1);
  }
  const eventAssistCount = new Map<string, number>();
  for (const a of eventAssists) {
    const matchId = a.report.eventMatchId;
    eventAssistCount.set(matchId, (eventAssistCount.get(matchId) ?? 0) + 1);
  }
  const leagueRoleById = new Map<string, PlayerMatchHistoryEntry["plannedRole"]>();
  for (const s of leagueSelections) {
    if (s.role === "CORE" || s.role === "SUPPORT" || s.role === "DEVELOPMENT") {
      // Prefer the first canonical role if multiple rows ever exist (e.g. legacy BACKFILL +
      // CORE pairs); CORE wins as the strongest planned context.
      const existing = leagueRoleById.get(s.matchId);
      if (existing !== "CORE") leagueRoleById.set(s.matchId, s.role);
    }
  }

  return usage.map((u): PlayerMatchHistoryEntry => {
    const opponent = u.source === "LEAGUE_MATCH" ? leagueOpponentById.get(u.matchKey) : eventOpponentById.get(u.matchKey);
    const totalMinutes = Object.values(u.minutesByPosition).reduce((sum, m) => sum + m, 0);
    const actualPositions = Object.entries(u.minutesByPosition)
      .sort(([, a], [, b]) => b - a)
      .map(([position]) => position);

    return {
      matchKey: u.matchKey,
      source: u.source,
      playedAt: u.playedAt,
      opponentOrEventName: opponent ?? "Unknown opponent",
      minutes: Math.round(totalMinutes),
      actualPositions,
      goals: u.source === "LEAGUE_MATCH" ? (leagueGoalCount.get(u.matchKey) ?? 0) : (eventGoalCount.get(u.matchKey) ?? 0),
      assists:
        u.source === "LEAGUE_MATCH" ? (leagueAssistCount.get(u.matchKey) ?? 0) : (eventAssistCount.get(u.matchKey) ?? 0),
      plannedRole: u.source === "LEAGUE_MATCH" ? (leagueRoleById.get(u.matchKey) ?? null) : null,
      startedAtKickoff: u.startedAtKickoff,
      eventId: u.source === "LEAGUE_MATCH" ? null : (eventEventIdById.get(u.matchKey) ?? null),
    };
  });
}