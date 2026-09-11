/**
 * Touchline Design Atlas visualization primitives (`02_REFERENCE_TO_CODE_METHOD.md §5`,
 * `12_CODE_CHANGE_MAP.md §3`). Native SVG/CSS/React only — no chart library. Every primitive
 * takes a required `question` prop, renders a visually-hidden text equivalent, and never relies
 * on colour alone. `PhaseBars`/`OutcomePair`/`RangeBand` are re-exports of primitives the first
 * Touchline pass (or ADR-0125) already built — not duplicated here.
 */
export { Sparkline } from "./sparkline";
export type { SparklineProps } from "./sparkline";

export { MiniBars } from "./mini-bars";
export type { MiniBarsProps, MiniBarsSegment } from "./mini-bars";

export { StackedDistribution } from "./stacked-distribution";
export type { StackedDistributionProps, StackedDistributionSegment } from "./stacked-distribution";

export { RoleDistribution } from "./role-distribution";
export type { RoleDistributionCounts } from "./role-distribution";

export { PhaseBars } from "./phase-bars";
export type { PhaseSegment } from "./phase-bars";

export { PitchExposure } from "./pitch-exposure";
export type { PitchExposureProps, PitchExposureEntry } from "./pitch-exposure";

export { TimelineStrip } from "./timeline-strip";
export type { TimelineStripProps, TimelineStripEntry } from "./timeline-strip";

export { RangeBand } from "./range-band";
export type { RangeBandProps } from "./range-band";

export { DotComparison } from "./dot-comparison";
export type { DotComparisonProps } from "./dot-comparison";

export { OutcomePair } from "./outcome-pair";
