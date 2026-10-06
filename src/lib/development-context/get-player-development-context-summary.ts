import { db } from "@/lib/db";

/**
 * Read-side query for Player Detail's Evidence tab (ADR-0155 step B5). Aggregates a player's
 * current `DerivedMeasurement` rows across every match into the small set of facts the Evidence
 * tab's existing story grammar can render -- never a new aggregation algorithm, just grouping
 * already-computed per-match values. No `server-only` guard, matching every other file in this
 * module (see context-pack.ts's own comment on why).
 */

export type GameStateBreakdownEntry = { gameState: string; seconds: number };
export type TopCoPresencePartner = { teammateId: string; teammateName: string; sharedSeconds: number };

export interface PlayerDevelopmentContextSummary {
  totalRoleSeconds: number;
  matchesWithRoleData: number;
  /** Never redistributes UNKNOWN game-state time into a known state -- it stays its own entry. */
  gameStateBreakdown: GameStateBreakdownEntry[];
  topCoPresencePartner: TopCoPresencePartner | null;
}

async function resolveTeammateName(teammateId: string): Promise<string> {
  const player = await db.player.findUnique({ where: { id: teammateId }, select: { firstName: true, lastName: true } });
  if (player) return [player.firstName, player.lastName].filter(Boolean).join(" ");

  const guest = await db.guestPlayer.findUnique({ where: { id: teammateId }, select: { name: true } });
  return guest?.name ?? "a teammate";
}

/** `null` when the player has no development-context measurements at all yet. */
export async function getPlayerDevelopmentContextSummary(playerId: string): Promise<PlayerDevelopmentContextSummary | null> {
  const [roleRows, gameStateRows, coPresenceRows] = await Promise.all([
    db.derivedMeasurement.findMany({ where: { playerId, metricKey: "role_seconds" }, select: { value: true, scopeKey: true } }),
    db.derivedMeasurement.findMany({ where: { playerId, metricKey: "game_state_role_seconds" }, select: { value: true, dimensions: true } }),
    db.derivedMeasurement.findMany({ where: { playerId, metricKey: "teammate_copresence_seconds" }, select: { value: true, dimensions: true } }),
  ]);

  if (roleRows.length === 0 && gameStateRows.length === 0 && coPresenceRows.length === 0) return null;

  const totalRoleSeconds = roleRows.reduce((sum, row) => sum + row.value, 0);
  const matchesWithRoleData = new Set(roleRows.map((row) => row.scopeKey)).size;

  const gameStateTotals = new Map<string, number>();
  for (const row of gameStateRows) {
    const gameState = (row.dimensions as Record<string, string>).gameState ?? "UNKNOWN";
    gameStateTotals.set(gameState, (gameStateTotals.get(gameState) ?? 0) + row.value);
  }
  const gameStateBreakdown = [...gameStateTotals.entries()].map(([gameState, seconds]) => ({ gameState, seconds }));

  const coPresenceTotals = new Map<string, number>();
  for (const row of coPresenceRows) {
    const teammateId = (row.dimensions as Record<string, string>).teammateId;
    if (!teammateId) continue;
    coPresenceTotals.set(teammateId, (coPresenceTotals.get(teammateId) ?? 0) + row.value);
  }
  const [bestTeammateId, bestSharedSeconds] =
    [...coPresenceTotals.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  const topCoPresencePartner: TopCoPresencePartner | null = bestTeammateId
    ? { teammateId: bestTeammateId, teammateName: await resolveTeammateName(bestTeammateId), sharedSeconds: bestSharedSeconds! }
    : null;

  return { totalRoleSeconds, matchesWithRoleData, gameStateBreakdown, topCoPresencePartner };
}
