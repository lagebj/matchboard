import { db } from "@/lib/db";
import { dimensionGroupKey } from "@/lib/development-context/trend-derivation";
import { TREND_ENABLED_METRIC_KEYS } from "@/lib/development-context/metric-registry";
import type { MetricKey, TrendDirection } from "@/lib/development-context/types";

/**
 * Season/team-scoped ADR-0155 trend rollup (ADR-0157 slice C7, Development tab's "established/
 * emerging ADR-0155 trends" aggregate). `get-player-trend-stories.ts` only reads one player at a
 * time; calling it once per squad player here would be exactly the "per-player query loop"
 * ADR-0157 names Season Review as a named regression risk for, so this module queries every
 * player's persisted rows in two batched `findMany` calls instead and groups the results in
 * memory.
 *
 * Never recomputes a trend -- it only reads and counts rows `recompute-player-trends.ts` already
 * wrote (`DerivedTrend`) or rows the metric pipeline already wrote (`DerivedMeasurement.eligible`).
 * "Established" = a persisted `DerivedTrend` with a material (non-STABLE) direction. "Emerging" =
 * a metric+dimension group that has some eligible evidence (1-5 matches) but has not yet reached
 * the 6-match threshold `computeTrendDraft()` requires to persist a trend row -- the same "not
 * enough evidence yet, never zero/stable" honesty rule `get-player-trend-stories.ts` already
 * applies per player, aggregated here across the whole scope instead of one player.
 */

export type SeasonTrendDirectionCount = {
  metricKey: MetricKey;
  direction: TrendDirection;
  playerCount: number;
};

export type SeasonTrendRollup = {
  /** One row per metric+direction with at least one established (non-STABLE) trend. */
  established: SeasonTrendDirectionCount[];
  /** Distinct players with at least one established (non-STABLE) trend. */
  playersWithEstablishedTrend: number;
  /** Distinct players with at least one metric+dimension group accumulating eligible evidence
   * (1-5 of 6 matches) that has not yet produced a persisted trend row. */
  playersWithEmergingSignal: number;
  totalPlayersConsidered: number;
};

type TrendRow = {
  playerId: string;
  metricKey: string;
  dimensions: unknown;
  direction: string;
};

type EligibleMeasurementRow = {
  playerId: string;
  metricKey: string;
  dimensions: unknown;
};

/** Pure grouping step, split out from the DB fetch above it so it is unit-testable without a
 * database connection. */
export function summarizeSeasonTrendRollup(
  trendRows: readonly TrendRow[],
  eligibleMeasurementRows: readonly EligibleMeasurementRow[],
  totalPlayersConsidered: number,
): SeasonTrendRollup {
  const establishedKey = (metricKey: string, direction: string) => `${metricKey}\u0000${direction}`;
  const establishedCounts = new Map<string, { metricKey: MetricKey; direction: TrendDirection; playerIds: Set<string> }>();
  const playersWithEstablishedTrend = new Set<string>();
  const resolvedGroupKeysByPlayer = new Map<string, Set<string>>();

  for (const row of trendRows) {
    const groupKey = dimensionGroupKey(row.metricKey, row.dimensions as Record<string, string>);
    const resolved = resolvedGroupKeysByPlayer.get(row.playerId) ?? new Set<string>();
    resolved.add(groupKey);
    resolvedGroupKeysByPlayer.set(row.playerId, resolved);

    if (row.direction === "STABLE") continue;
    playersWithEstablishedTrend.add(row.playerId);
    const key = establishedKey(row.metricKey, row.direction);
    const entry = establishedCounts.get(key) ?? {
      metricKey: row.metricKey as MetricKey,
      direction: row.direction as TrendDirection,
      playerIds: new Set<string>(),
    };
    entry.playerIds.add(row.playerId);
    establishedCounts.set(key, entry);
  }

  const emergingGroupsByPlayer = new Map<string, Set<string>>();
  for (const row of eligibleMeasurementRows) {
    const groupKey = dimensionGroupKey(row.metricKey, row.dimensions as Record<string, string>);
    const resolved = resolvedGroupKeysByPlayer.get(row.playerId);
    if (resolved?.has(groupKey)) continue; // already has a persisted trend row for this group
    const groups = emergingGroupsByPlayer.get(row.playerId) ?? new Set<string>();
    groups.add(groupKey);
    emergingGroupsByPlayer.set(row.playerId, groups);
  }

  const established = [...establishedCounts.values()]
    .map((entry) => ({ metricKey: entry.metricKey, direction: entry.direction, playerCount: entry.playerIds.size }))
    .sort((a, b) => a.metricKey.localeCompare(b.metricKey) || a.direction.localeCompare(b.direction));

  return {
    established,
    playersWithEstablishedTrend: playersWithEstablishedTrend.size,
    playersWithEmergingSignal: emergingGroupsByPlayer.size,
    totalPlayersConsidered,
  };
}

/**
 * Batched DB fetch + grouping for every player in `playerIds` (callers scope this to the core
 * players belonging to teams relevant to the selected league season). Two `findMany` calls total,
 * regardless of squad size.
 */
export async function getSeasonTrendRollup(organisationId: string, playerIds: readonly string[]): Promise<SeasonTrendRollup> {
  if (playerIds.length === 0) {
    return { established: [], playersWithEstablishedTrend: 0, playersWithEmergingSignal: 0, totalPlayersConsidered: 0 };
  }

  const [trendRows, eligibleMeasurementRows] = await Promise.all([
    db.derivedTrend.findMany({
      where: { organisationId, playerId: { in: [...playerIds] }, metricKey: { in: [...TREND_ENABLED_METRIC_KEYS] } },
      select: { playerId: true, metricKey: true, dimensions: true, direction: true },
    }),
    db.derivedMeasurement.findMany({
      where: { organisationId, playerId: { in: [...playerIds] }, eligible: true, metricKey: { in: [...TREND_ENABLED_METRIC_KEYS] } },
      select: { playerId: true, metricKey: true, dimensions: true },
    }),
  ]);

  return summarizeSeasonTrendRollup(trendRows, eligibleMeasurementRows, playerIds.length);
}
