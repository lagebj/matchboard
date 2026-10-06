import { db } from "@/lib/db";
import { canonicalFullLabel } from "@/domain/positions/canonical-labels";
import { TREND_ENABLED_METRIC_KEYS } from "./metric-registry";
import { dimensionGroupKey } from "./trend-derivation";
import { resolveTeammateName } from "./get-player-development-context-summary";
import type { EvidenceRef, MetricKey, TrendDirection } from "./types";

/**
 * Player Detail's Evidence tab trend stories (ADR-0155 step B6's own disclosed gap, closed by
 * ADR-0157 slice C5: "B6 creates `DerivedTrend` but the baseline UI does not surface it"). Reads
 * only persisted `DerivedTrend` rows for direction/materiality -- this module never recomputes a
 * trend, it only formats one that `recompute-player-trends.ts` already wrote.
 *
 * The one thing this module DOES compute itself is "has this metric+dimension group reached the
 * 6-eligible-match threshold yet" (`dimensionGroupKey`-grouped `DerivedMeasurement.eligible` row
 * counts) -- not to re-derive the trend, but to render the honest "not enough evidence" state
 * for a group that has *some* eligible data but not yet a trend row, per the binding rule
 * "absence of six eligible matches is 'not enough evidence', not zero/stable" (contract pasted
 * into this slice's own task spec). A group that has zero eligible rows (e.g. `zone_event_share`,
 * permanently inert per ADR-0155 §3) never appears at all -- showing "0 of 6" forever for a
 * metric with no real data source yet would be noise, not evidence.
 *
 * No `server-only` guard, matching every other file in this module (see context-pack.ts's own
 * comment on why).
 */

const TREND_SAMPLE_SIZE = 6;

/** Headline priority when more than one trend qualifies as "the" current story (ADR-0157 C5's
 * `selectPlayerCurrentStory` priority 1) -- role/game-state exposure is the player's own on-pitch
 * story; co-presence stays last since ADR-0155 §9 keeps it explicitly exposure-only, never a
 * headline about the player's own development on its own terms. */
const METRIC_HEADLINE_PRIORITY: Record<MetricKey, number> = {
  role_seconds: 0,
  game_state_role_seconds: 1,
  event_rate: 2,
  zone_event_share: 3,
  zone_event_count: 3,
  event_count: 4,
  teammate_copresence_seconds: 5,
};

const GAME_STATE_LABELS: Record<string, string> = {
  LEADING: "leading",
  DRAWING: "drawing",
  TRAILING: "trailing",
  UNKNOWN: "an unknown game state",
};

// No existing label authority covers this exact 5-value event set (metric-derivation.ts's
// `ELIGIBLE_EVENT_TYPES`) -- `match-timeline-list.tsx`'s own switch is team-perspective-aware
// (home/away goal wording) and not reusable here. Kept local and small rather than widened into a
// shared dictionary nothing else needs yet.
const EVENT_TYPE_LABELS: Record<string, string> = {
  GOAL_FOR: "Goals",
  GOAL_AGAINST: "Goals against",
  FAIR_PLAY_POSITIVE: "Fair play (positive)",
  FAIR_PLAY_CONCERN: "Fair play (concern)",
  MOMENT_MARKED: "Marked moments",
};

function gameStateLabel(value: string): string {
  return GAME_STATE_LABELS[value] ?? value.toLowerCase();
}

function eventTypeLabel(value: string): string {
  return EVENT_TYPE_LABELS[value] ?? value;
}

export type PlayerTrendRateContext = {
  previousNumerator: number;
  previousDenominator: number;
  latestNumerator: number;
  latestDenominator: number;
  denominatorUnit: string;
};

export type PlayerTrendStory =
  | {
      kind: "TREND";
      metricKey: MetricKey;
      metricPriority: number;
      dimensions: Record<string, string>;
      dimensionLabel: string;
      direction: TrendDirection;
      /** |delta| / materialityThreshold -- used only to rank which trend is "most material" when
       * more than one qualifies; never displayed as a number (contract's own "never expose the
       * raw internal score" rule, mirrored from ADR-0139). */
      materialityRatio: number;
      sampleWindow: { previousMatches: number; latestMatches: number };
      rateContext: PlayerTrendRateContext | null;
      headline: string;
      sourceRefs: EvidenceRef[];
    }
  | {
      kind: "NOT_ENOUGH_EVIDENCE";
      metricKey: MetricKey;
      dimensions: Record<string, string>;
      dimensionLabel: string;
      eligibleSampleCount: number;
      neededSampleCount: typeof TREND_SAMPLE_SIZE;
      headline: string;
    };

async function dimensionLabelFor(metricKey: MetricKey, dimensions: Record<string, string>): Promise<string> {
  switch (metricKey) {
    case "role_seconds":
      return `${canonicalFullLabel(dimensions.position ?? "")} exposure`;
    case "game_state_role_seconds":
      return `${canonicalFullLabel(dimensions.position ?? "")} exposure while ${gameStateLabel(dimensions.gameState ?? "UNKNOWN")}`;
    case "event_rate":
      return `${eventTypeLabel(dimensions.eventType ?? "")} rate`;
    case "teammate_copresence_seconds": {
      const teammateId = dimensions.teammateId ?? "";
      const teammateName = teammateId ? await resolveTeammateName(teammateId) : "a teammate";
      return `Shared pitch time with ${teammateName}`;
    }
    default:
      return `${metricKey} (${Object.values(dimensions).join(", ")})`;
  }
}

function headlineForTrend(dimensionLabel: string, direction: TrendDirection, rateContext: PlayerTrendRateContext | null): string {
  const verb = direction === "UP" ? "increased" : direction === "DOWN" ? "decreased" : "remained stable";
  const base = `${dimensionLabel} has ${verb} across the latest eligible window (previous 3 matches vs. latest 3 matches).`;
  if (!rateContext) return base;
  const previousMinutes = Math.round(rateContext.previousDenominator / 60);
  const latestMinutes = Math.round(rateContext.latestDenominator / 60);
  return `${base} Latest window: ${rateContext.latestNumerator} across ${latestMinutes} recorded minutes. Previous window: ${rateContext.previousNumerator} across ${previousMinutes} recorded minutes.`;
}

function headlineForNotEnoughEvidence(dimensionLabel: string, eligibleSampleCount: number): string {
  return `Not enough eligible matches yet to show a ${dimensionLabel.toLowerCase()} trend (${eligibleSampleCount} of ${TREND_SAMPLE_SIZE} eligible matches recorded).`;
}

type EligibleMeasurementRow = { metricKey: string; dimensions: unknown; scopeKey: string };

/** Sums numerator/denominator for `metricKey`'s rows matching `dimensions` whose `scopeKey` is in
 * `scopeKeys` -- the only way to recover a rate trend's exposure context, since `DerivedTrend`
 * itself only persists the already-aggregated ratio (`previousValue`/`latestValue`), not the raw
 * numerator/denominator pairs that produced it. */
async function sumRateWindow(
  playerId: string,
  metricKey: string,
  dimensions: Record<string, string>,
  scopeKeys: readonly string[],
): Promise<{ numerator: number; denominator: number; denominatorUnit: string } | null> {
  const rows = await db.derivedMeasurement.findMany({
    where: { playerId, metricKey, scopeKey: { in: [...scopeKeys] } },
    select: { dimensions: true, numerator: true, denominator: true, denominatorUnit: true },
  });
  const matching = rows.filter((row) => {
    const rowDims = row.dimensions as Record<string, string>;
    return Object.keys(dimensions).every((key) => rowDims[key] === dimensions[key]);
  });
  if (matching.length === 0) return null;
  return {
    numerator: matching.reduce((sum, row) => sum + (row.numerator ?? 0), 0),
    denominator: matching.reduce((sum, row) => sum + (row.denominator ?? 0), 0),
    denominatorUnit: matching[0]!.denominatorUnit ?? "seconds",
  };
}

/** Every current trend story (ADR-0155 B6 trends, persisted-only) plus honest "not enough
 * evidence" entries for metric+dimension groups still accumulating toward the 6-eligible-match
 * threshold. Ordered by `metricPriority` -- callers that just need "the one most material trend"
 * (e.g. `selectPlayerCurrentStory`) can take the first `TREND` entry with a non-STABLE direction. */
export async function getPlayerTrendStories(playerId: string): Promise<PlayerTrendStory[]> {
  const [trendRows, eligibleMeasurements] = await Promise.all([
    db.derivedTrend.findMany({
      where: { playerId, metricKey: { in: [...TREND_ENABLED_METRIC_KEYS] } },
      select: {
        metricKey: true,
        dimensions: true,
        direction: true,
        previousValue: true,
        latestValue: true,
        delta: true,
        materialityThreshold: true,
        previousWindowMatchIds: true,
        latestWindowMatchIds: true,
        sourceRefs: true,
      },
    }),
    db.derivedMeasurement.findMany({
      where: { playerId, eligible: true, metricKey: { in: [...TREND_ENABLED_METRIC_KEYS] } },
      select: { metricKey: true, dimensions: true, scopeKey: true },
    }) as Promise<EligibleMeasurementRow[]>,
  ]);

  const eligibleCountByGroup = new Map<string, number>();
  const groupShape = new Map<string, { metricKey: MetricKey; dimensions: Record<string, string> }>();
  for (const row of eligibleMeasurements) {
    const dimensions = row.dimensions as Record<string, string>;
    const key = dimensionGroupKey(row.metricKey, dimensions);
    eligibleCountByGroup.set(key, (eligibleCountByGroup.get(key) ?? 0) + 1);
    groupShape.set(key, { metricKey: row.metricKey as MetricKey, dimensions });
  }

  const resolvedGroupKeys = new Set<string>();
  const stories: PlayerTrendStory[] = [];

  for (const trend of trendRows) {
    const metricKey = trend.metricKey as MetricKey;
    const dimensions = trend.dimensions as Record<string, string>;
    const groupKey = dimensionGroupKey(metricKey, dimensions);
    resolvedGroupKeys.add(groupKey);

    const dimensionLabel = await dimensionLabelFor(metricKey, dimensions);
    const rateContext =
      metricKey === "event_rate"
        ? await buildRateContext(playerId, metricKey, dimensions, trend.previousWindowMatchIds as string[], trend.latestWindowMatchIds as string[])
        : null;

    stories.push({
      kind: "TREND",
      metricKey,
      metricPriority: METRIC_HEADLINE_PRIORITY[metricKey] ?? 99,
      dimensions,
      dimensionLabel,
      direction: trend.direction as TrendDirection,
      materialityRatio: trend.materialityThreshold > 0 ? Math.abs(trend.delta) / trend.materialityThreshold : 0,
      sampleWindow: {
        previousMatches: (trend.previousWindowMatchIds as string[]).length,
        latestMatches: (trend.latestWindowMatchIds as string[]).length,
      },
      rateContext,
      headline: headlineForTrend(dimensionLabel, trend.direction as TrendDirection, rateContext),
      sourceRefs: trend.sourceRefs as unknown as EvidenceRef[],
    });
  }

  for (const [groupKey, count] of eligibleCountByGroup.entries()) {
    if (resolvedGroupKeys.has(groupKey)) continue;
    if (count < 1 || count >= TREND_SAMPLE_SIZE) continue; // 0 never shown; 6+ with no trend row means recompute hasn't run yet -- never fabricated here.
    const shape = groupShape.get(groupKey);
    if (!shape) continue;
    const dimensionLabel = await dimensionLabelFor(shape.metricKey, shape.dimensions);
    stories.push({
      kind: "NOT_ENOUGH_EVIDENCE",
      metricKey: shape.metricKey,
      dimensions: shape.dimensions,
      dimensionLabel,
      eligibleSampleCount: count,
      neededSampleCount: TREND_SAMPLE_SIZE,
      headline: headlineForNotEnoughEvidence(dimensionLabel, count),
    });
  }

  return stories.sort((a, b) => {
    const pa = METRIC_HEADLINE_PRIORITY[a.metricKey] ?? 99;
    const pb = METRIC_HEADLINE_PRIORITY[b.metricKey] ?? 99;
    return pa - pb;
  });
}

async function buildRateContext(
  playerId: string,
  metricKey: MetricKey,
  dimensions: Record<string, string>,
  previousWindowScopeKeys: readonly string[],
  latestWindowScopeKeys: readonly string[],
): Promise<PlayerTrendRateContext | null> {
  const [previous, latest] = await Promise.all([
    sumRateWindow(playerId, metricKey, dimensions, previousWindowScopeKeys),
    sumRateWindow(playerId, metricKey, dimensions, latestWindowScopeKeys),
  ]);
  if (!previous || !latest) return null;
  return {
    previousNumerator: previous.numerator,
    previousDenominator: previous.denominator,
    latestNumerator: latest.numerator,
    latestDenominator: latest.denominator,
    denominatorUnit: latest.denominatorUnit,
  };
}
