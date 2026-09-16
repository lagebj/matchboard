import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { normalizePlayerPositionCode } from "./position-code";

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
  /** Normalized position code -> minutes played at that position in this match. */
  minutesByPosition: Record<string, number>;
  /**
   * The player's earliest recorded interval in this match began at match minute 0 (the honest
   * "started the match" fact). Additive (Atlas Follow-up Phase F8 Player Detail Matches tab) —
   * the position-evolution engine ignores it.
   */
  startedAtKickoff: boolean;
};

/**
 * Fetches actual positional usage across both League and Event matches for a batch of players in
 * one round-trip (Matchboard Players Operating Surface bundle, `04_DATA_AND_BATCH_LOADING_CONTRACT.md
 * §2`) — one `ActualPositionInterval.findMany` for every requested player, one League match-date
 * query and one Event match-date query for the gathered match IDs, rather than one query set per
 * player. Position codes are normalized (`normalizePlayerPositionCode()`) before minutes are
 * aggregated, so a legacy alias (e.g. `DEFENSIVE_MIDFIELDER`) and its exact code (`DM`) accumulate
 * into the same bucket instead of two separate ones.
 *
 * Excludes `BENCH`/`"unknown"` positions (not real on-field positional evidence) and any
 * interval attributed to a `guestPlayerId` instead of `playerId` — a guest player never
 * accumulates persistent evidence for a borrowing group's own players (ADR-0106); this query
 * only ever selects on `playerId`, so a guest-only row (`playerId: null`) can never match.
 *
 * Ordered most-recent-first per player, capped at `queryLimitPerPlayer` matches (the contract's
 * `recentMatchWindow` upper query bound) applied after grouping.
 */
export async function getPlayersActualPositionHistory(
  playerIds: string[],
  orgFilter: OrgFilterMode,
  queryLimitPerPlayer = 40,
): Promise<Map<string, PlayerMatchPositionUsage[]>> {
  const result = new Map<string, PlayerMatchPositionUsage[]>();
  if (orgFilter.type !== "org" || playerIds.length === 0) return result;

  const intervals = await db.actualPositionInterval.findMany({
    where: {
      playerId: { in: playerIds },
      organisationId: orgFilter.organisationId,
      position: { notIn: ["BENCH", "unknown"] },
    },
    select: {
      playerId: true,
      matchId: true,
      eventMatchId: true,
      position: true,
      startedAtMs: true,
      endedAtMs: true,
    },
  });

  if (intervals.length === 0) return result;

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

  // playerId -> matchKey -> usage.
  const byPlayerAndMatch = new Map<string, Map<string, PlayerMatchPositionUsage>>();

  for (const interval of intervals) {
    if (!interval.playerId) continue; // guest-attributed row — never matched by this query anyway.
    const isLeague = Boolean(interval.matchId);
    const key = isLeague ? interval.matchId! : interval.eventMatchId!;
    const playedAt = isLeague ? leagueDateById.get(key) : eventDateById.get(key);
    if (!playedAt) continue; // match not found under this org filter — skip defensively, never throw.

    const normalizedPosition = normalizePlayerPositionCode(interval.position);
    if (!normalizedPosition) continue;

    const durationMs = Math.max(0, (interval.endedAtMs ?? interval.startedAtMs) - interval.startedAtMs);
    const minutes = durationMs / 60000;

    let byMatch = byPlayerAndMatch.get(interval.playerId);
    if (!byMatch) {
      byMatch = new Map();
      byPlayerAndMatch.set(interval.playerId, byMatch);
    }

    let usage = byMatch.get(key);
    if (!usage) {
      usage = { matchKey: key, source: isLeague ? "LEAGUE_MATCH" : "EVENT_MATCH", playedAt, minutesByPosition: {}, startedAtKickoff: false };
      byMatch.set(key, usage);
    }
    if (interval.startedAtMs === 0) {
      usage.startedAtKickoff = true;
    }
    usage.minutesByPosition[normalizedPosition] = (usage.minutesByPosition[normalizedPosition] ?? 0) + minutes;
  }

  for (const [playerId, byMatch] of byPlayerAndMatch) {
    result.set(
      playerId,
      [...byMatch.values()].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime()).slice(0, queryLimitPerPlayer),
    );
  }

  return result;
}

/**
 * Fetches one player's actual positional usage across both League and Event matches. Delegates
 * to the batched `getPlayersActualPositionHistory()` for `[playerId]` — one grouping
 * implementation shared by both the single-player and batch entry points (Matchboard Players
 * Operating Surface bundle, `04_DATA_AND_BATCH_LOADING_CONTRACT.md §2`).
 */
export async function getPlayerActualPositionHistory(
  playerId: string,
  orgFilter: OrgFilterMode,
  queryLimit = 40,
): Promise<PlayerMatchPositionUsage[]> {
  const map = await getPlayersActualPositionHistory([playerId], orgFilter, queryLimit);
  return map.get(playerId) ?? [];
}
