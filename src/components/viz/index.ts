/**
 * Matchboard evidence-visualization grammar (ADR-0124 §16).
 *
 * A small, fixed set of native SVG/CSS/React primitives. Each answers one concrete question,
 * renders a visually-hidden text equivalent, never relies on colour alone, and carries no
 * ranking, composite score, good/bad encoding, or causal wording. Do not add a chart library
 * or a seventh primitive without amending the ADR.
 */
export { TrendSpark, type TrendSparkProps } from "./trend-spark";
export { DistributionBar, type DistributionBarProps, type DistributionSegment } from "./distribution-bar";
export { PeriodBars, type PeriodBarsProps, type PeriodBar } from "./period-bars";
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
