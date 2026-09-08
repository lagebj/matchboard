/**
 * Matchboard evidence-visualization grammar (ADR-0124 §7, ADR-0125).
 *
 * A small, fixed set of native SVG/CSS/React primitives — **seven** as of ADR-0125
 * (`PairedOutcomeBar` added). Each answers one concrete question, renders a visually-hidden
 * text equivalent, never relies on colour alone, and carries no ranking, composite score,
 * good/bad encoding, or causal wording. Do not add a chart library or an eighth primitive
 * without amending ADR-0125.
 */
export { TrendSpark, type TrendSparkProps } from "./trend-spark";
export { DistributionBar, type DistributionBarProps, type DistributionSegment } from "./distribution-bar";
export { PeriodBars, type PeriodBarsProps, type PeriodBar } from "./period-bars";
export { PairedOutcomeBar, type PairedOutcomeBarProps, type PairedOutcomeRow } from "./paired-outcome-bar";
export { RangeBand, type RangeBandProps } from "./range-band";
export { DeltaMetric, type DeltaMetricProps } from "./delta-metric";
export { MetricStory, type MetricStoryProps } from "./metric-story";
export {
  VIZ_CATEGORY_COLORS,
  vizColorAt,
  directionWord,
  directionGlyph,
  rangePosition,
  formatPct,
} from "./viz-shared";
