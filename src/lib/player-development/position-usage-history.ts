import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

/**
 * One match's actual positional usage for one player — "actual completed-match positional
 * usage" (`07_EVOLVING_PLAYER_POSITION_MODEL.md §5`). Minutes-by-position, not just a set of
 * distinct positions, so duration can contribute per the contract's "where the data supports
 * it" guidance. Derived directly from `ActualPositionInterval` (the canonical actual-position
 * record, ADR-0096/ADR-0104/ADR-0113) — never from `PostMatchPlayerActual.actualPositions`
 * (a lossy, minutes-free distinct-positions array) and never from any planned/suitability
 * source (contract §6).
 */
export type PlayerMatchPositionUsage = {
  /** `Match.id` or `EventMatch.id` — unique across both since cuids don't collide. */
  matchKey: string;
  source: "LEAGUE_MATCH" | "EVENT_MATCH";
  playedAt: Date;
  /** Position code -> minutes played at that position in this match. */
  minutesByPosition: Record<string, number>;
  /**
   * The player's earliest recorded interval in this match began at match minute 0 (the honest
   * "started the match" fact). Additive (Atlas Follow-up Phase F8 Player Detail Matches tab) —
   * the position-evolution engine ignores it.
   */
  startedAtKickoff: boolean;
};

/**
 * Fetches one player's actual positional usage across both League and Event matches — one
 * canonical query, League/Event parity for free via `ActualPositionInterval`'s dual nullable
 * `matchId`/`eventMatchId` (ADR-0106's pattern). Ordered most-recent-first, capped at `limit`
 * matches (the contract's `recentMatchWindow`, applied by the caller — this function itself
 * imposes a generous upper query bound only, not the evolution engine's own window).
 *
 * Excludes `BENCH`/`"unknown"` positions (not real on-field positional evidence) and any
 * interval attributed to a `guestPlayerId` instead of `playerId` — a guest player never
 * accumulates persistent evidence for a borrowing group's own players (ADR-0106); this query
 * only ever selects on `playerId`, so a guest-only row (`playerId: null`) can never match.
 */
export async function getPlayerActualPositionHistory(
  playerId: string,
  orgFilter: OrgFilterMode,
  queryLimit = 40,
): Promise<PlayerMatchPositionUsage[]> {
  if (orgFilter.type !== "org") return [];

  const intervals = await db.actualPositionInterval.findMany({
    where: {
      playerId,
      organisationId: orgFilter.organisationId,
      position: { notIn: ["BENCH", "unknown"] },
    },
    select: {
      matchId: true,
      eventMatchId: true,
      position: true,
      startedAtMs: true,
      endedAtMs: true,
    },
  });

  if (intervals.length === 0) return [];

  const leagueMatchIds = [...new Set(intervals.filter((i) => i.matchId).map((i) => i.matchId!))];
  const eventMatchIds = [...new Set(intervals.filter((i) => i.eventMatchId).map((i) => i.eventMatchId!))];

  const [leagueMatches, eventMatches] = await Promise.all([
    leagueMatchIds.length > 0
      ? db.match.findMany({
          where: { id: { in: leagueMatchIds }, organisationId: orgFilter.organisationId },
          select: { id: true, startsAt: true },
        })
      : Promise.resolve([]),
    eventMatchIds.length > 0
      ? db.eventMatch.findMany({
          where: { id: { in: eventMatchIds }, organisationId: orgFilter.organisationId },
          select: { id: true, startsAt: true },
        })
      : Promise.resolve([]),
  ]);

  const leagueDateById = new Map(leagueMatches.map((m) => [m.id, m.startsAt]));
  const eventDateById = new Map(eventMatches.map((m) => [m.id, m.startsAt]));

  const byMatch = new Map<string, PlayerMatchPositionUsage>();

  for (const interval of intervals) {
    const isLeague = Boolean(interval.matchId);
    const key = isLeague ? interval.matchId! : interval.eventMatchId!;
    const playedAt = isLeague ? leagueDateById.get(key) : eventDateById.get(key);
    if (!playedAt) continue; // match not found under this org filter — skip defensively, never throw.

    const durationMs = Math.max(0, (interval.endedAtMs ?? interval.startedAtMs) - interval.startedAtMs);
    const minutes = durationMs / 60000;

    let usage = byMatch.get(key);
    if (!usage) {
      usage = { matchKey: key, source: isLeague ? "LEAGUE_MATCH" : "EVENT_MATCH", playedAt, minutesByPosition: {}, startedAtKickoff: false };
      byMatch.set(key, usage);
    }
    if (interval.startedAtMs === 0) {
      usage.startedAtKickoff = true;
    }
    usage.minutesByPosition[interval.position] = (usage.minutesByPosition[interval.position] ?? 0) + minutes;
  }

  return [...byMatch.values()].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime()).slice(0, queryLimit);
}
