/**
 * History presentation view model (Touchline Design Atlas,
 * `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §C`, `03_DATA_PROVENANCE_AND_VIEW_MODELS.md §4`).
 *
 * History MUST NOT be reinterpreted as a generic match archive (see
 * `docs/domain/touchline-atlas-provenance.md §3`). This module derives participation/load/role/
 * movement visualizations from `getSeasonPlayerRoundMatrix()` + `getMovementPathSummary()` +
 * `getPlayerMovementTimeline()` (`src/lib/selection/get-season-overview.ts`) — it does not invent
 * a W/D/L match-result feed (no aggregator for that exists; see the provenance doc).
 *
 * Sources:
 * - players (PlayerRowSummary[]) -> EXISTING_QUERYABLE (getSeasonPlayerRoundMatrix().players)
 * - movementPaths                -> EXISTING_QUERYABLE (getMovementPathSummary())
 * - recentMovements               -> EXISTING_QUERYABLE (getPlayerMovementTimeline(), pre-flattened by the route across recent players)
 * Derived:
 * - summary strip totals          -> DERIVED_PRESENTATION (sums/counts over players)
 * - appearanceDistribution        -> DERIVED_PRESENTATION (bucketed histogram of totalSelections)
 * - roleDistribution               -> DERIVED_PRESENTATION (aggregate core/support/development/backfill totals)
 * - movementTrend                  -> DERIVED_PRESENTATION (movement count bucketed by round, from recentMovements)
 */

export interface HistoryPlayerRowInput {
  playerId: string;
  playerName: string;
  coreTeamName: string;
  roundsPlayed: number;
  totalSelections: number;
  coreMatches: number;
  supportMatches: number;
  developmentMatches: number;
  backfillMatches: number;
  doubleLoadRounds: number;
  droppedRounds: number;
  unavailableRounds: number;
}

export interface HistoryMovementPathInput {
  fromTeamName: string;
  toTeamName: string;
  role: string;
  count: number;
  uniquePlayers: number;
  lastUsed: string | null;
}

export interface HistoryMovementEntryInput {
  playerId: string;
  playerName: string;
  matchRoundName: string;
  matchDate: string | null;
  fromTeamName?: string;
  teamName: string;
  role: string;
  explanation?: string;
}

export interface HistoryViewModelInput {
  players: HistoryPlayerRowInput[];
  movementPaths: HistoryMovementPathInput[];
  recentMovements: HistoryMovementEntryInput[]; // pre-sorted, most recent first
  finalizedRoundCount: number;
  draftRoundCount: number;
}

export interface HistorySummary {
  totalFinalizedAppearances: number;
  totalSupportAppearances: number;
  totalDevelopmentAppearances: number;
  totalBackfillAppearances: number;
  playersWithMovement: number;
  finalizedRoundCount: number;
  draftRoundCount: number;
}

export interface HistoryDistributionBucket {
  label: string;
  count: number;
}

export interface HistoryRoleUsageRow {
  label: string;
  value: number;
}

export interface HistoryViewModel {
  summary: HistorySummary;
  appearanceDistribution: HistoryDistributionBucket[];
  roleUsage: HistoryRoleUsageRow[];
  loadRange: { min: number; median: number; max: number } | null;
  movementPaths: HistoryMovementPathInput[];
  recentMovements: HistoryMovementEntryInput[];
}

/** Fixed appearance-count buckets — deterministic, never player-ranked. */
const APPEARANCE_BUCKETS: { label: string; test: (n: number) => boolean }[] = [
  { label: "0", test: (n) => n === 0 },
  { label: "1–3", test: (n) => n >= 1 && n <= 3 },
  { label: "4–6", test: (n) => n >= 4 && n <= 6 },
  { label: "7–10", test: (n) => n >= 7 && n <= 10 },
  { label: "11+", test: (n) => n >= 11 },
];

export function buildHistoryViewModel(input: HistoryViewModelInput): HistoryViewModel {
  const { players } = input;

  const summary: HistorySummary = {
    totalFinalizedAppearances: sum(players, (p) => p.totalSelections),
    totalSupportAppearances: sum(players, (p) => p.supportMatches),
    totalDevelopmentAppearances: sum(players, (p) => p.developmentMatches),
    totalBackfillAppearances: sum(players, (p) => p.backfillMatches),
    playersWithMovement: players.filter((p) => p.supportMatches + p.developmentMatches + p.backfillMatches > 0)
      .length,
    finalizedRoundCount: input.finalizedRoundCount,
    draftRoundCount: input.draftRoundCount,
  };

  const appearanceDistribution: HistoryDistributionBucket[] = APPEARANCE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: players.filter((p) => bucket.test(p.totalSelections)).length,
  }));

  const roleUsage: HistoryRoleUsageRow[] = [
    { label: "Core", value: sum(players, (p) => p.coreMatches) },
    { label: "Support", value: summary.totalSupportAppearances },
    { label: "Development", value: summary.totalDevelopmentAppearances },
    { label: "Squad repair", value: summary.totalBackfillAppearances },
  ];

  const loadRange = computeLoadRange(players.map((p) => p.totalSelections));

  return {
    summary,
    appearanceDistribution,
    roleUsage,
    loadRange,
    movementPaths: input.movementPaths,
    recentMovements: input.recentMovements,
  };
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

export function computeLoadRange(values: number[]): { min: number; median: number; max: number } | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { min: sorted[0], median, max: sorted[sorted.length - 1] };
}
