import { computeInputRevision } from "./version";
import type { MetricDefinition, MetricKey, TrendDirection } from "./types";

/**
 * Pure trend computation (ADR-0155 step B6, source bundle §04's "Trend rule"). A transparent,
 * deterministic recent-window comparison -- six eligible matches, split 3 previous / 3 latest.
 * Ineligible matches are skipped entirely by the caller before this function ever sees them;
 * this function never zero-fills a gap.
 */

export interface TrendWindowMeasurement {
  scopeKey: string;
  value: number;
  numerator?: number;
  denominator?: number;
}

export interface TrendDraft {
  metricKey: MetricKey;
  metricVersion: number;
  dimensions: Record<string, string>;
  previousWindowScopeKeys: [string, string, string];
  latestWindowScopeKeys: [string, string, string];
  previousValue: number;
  latestValue: number;
  delta: number;
  direction: TrendDirection;
  materialityThreshold: number;
  inputRevision: string;
}

/**
 * Exposure-normalized metrics (every window entry carries a denominator) aggregate by summed
 * numerator / summed denominator -- never an equal average of per-match rates with different
 * exposures. Plain metrics (role_seconds, teammate_copresence_seconds, game_state_role_seconds)
 * aggregate by sum.
 */
function aggregateWindow(window: readonly TrendWindowMeasurement[]): number {
  const isRate = window.every((entry) => entry.denominator != null);
  if (isRate) {
    const sumNumerator = window.reduce((sum, entry) => sum + (entry.numerator ?? 0), 0);
    const sumDenominator = window.reduce((sum, entry) => sum + (entry.denominator ?? 0), 0);
    return sumDenominator > 0 ? sumNumerator / sumDenominator : 0;
  }
  return window.reduce((sum, entry) => sum + entry.value, 0);
}

function directionFor(delta: number, materialityThreshold: number): TrendDirection {
  if (delta >= materialityThreshold) return "UP";
  if (delta <= -materialityThreshold) return "DOWN";
  return "STABLE";
}

/**
 * `chronologicalEligibleMeasurements` must already be filtered to this metric+dimension's
 * eligible matches only, ordered oldest -> newest. Returns `null` when the metric isn't
 * trend-enabled or fewer than 6 eligible matches exist -- never a trend built from fewer.
 */
export function computeTrendDraft(
  metricDefinition: MetricDefinition,
  dimensions: Record<string, string>,
  chronologicalEligibleMeasurements: readonly TrendWindowMeasurement[],
): TrendDraft | null {
  if (!metricDefinition.trendEnabled || metricDefinition.materialityThreshold == null) return null;
  if (chronologicalEligibleMeasurements.length < 6) return null;

  const last6 = chronologicalEligibleMeasurements.slice(-6);
  const previousWindow = last6.slice(0, 3) as [TrendWindowMeasurement, TrendWindowMeasurement, TrendWindowMeasurement];
  const latestWindow = last6.slice(3, 6) as [TrendWindowMeasurement, TrendWindowMeasurement, TrendWindowMeasurement];

  const previousValue = aggregateWindow(previousWindow);
  const latestValue = aggregateWindow(latestWindow);
  const delta = latestValue - previousValue;

  return {
    metricKey: metricDefinition.key,
    metricVersion: metricDefinition.version,
    dimensions,
    previousWindowScopeKeys: previousWindow.map((w) => w.scopeKey) as [string, string, string],
    latestWindowScopeKeys: latestWindow.map((w) => w.scopeKey) as [string, string, string],
    previousValue,
    latestValue,
    delta,
    direction: directionFor(delta, metricDefinition.materialityThreshold),
    materialityThreshold: metricDefinition.materialityThreshold,
    inputRevision: computeInputRevision({
      metricKey: metricDefinition.key,
      metricVersion: metricDefinition.version,
      dimensions,
      previousWindowScopeKeys: previousWindow.map((w) => w.scopeKey),
      latestWindowScopeKeys: latestWindow.map((w) => w.scopeKey),
    }),
  };
}
