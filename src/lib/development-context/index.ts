// ─────────────────────────────────────────────────────────────────
// Development-context-and-evidence domain owner (ADR-0155).
//
// Deterministic primitives for role exposure, spatial event evidence, teammate co-presence,
// game-state splits, trend signals, and measurement provenance/quality — built on top of the
// existing evidence engine (ADR-0113/ADR-0116/ADR-0139) and canonical tactical positions
// (ADR-0129/ADR-0154), never a parallel reconstruction of either.
//
// Derivation services and UI must import from here and must not reimplement a metric's unit,
// dimensions, eligibility gate, or zone/game-state/co-presence math independently.
// ─────────────────────────────────────────────────────────────────

export type {
  EvidenceRef,
  MeasurementCoverage,
  MeasurementQuality,
  GameState,
  TrendDirection,
  MetricScopeType,
  MetricEligibilityGate,
  MetricKey,
  MetricDefinition,
} from "./types";

export { METRIC_REGISTRY, getMetricDefinition } from "./metric-registry";

export { deriveCoverage, meetsEligibilityGate } from "./quality";

export { canonicalJsonStringify, computeInputRevision } from "./version";

export { zoneForCoordinate } from "./spatial-grid";

export { gameStateForInterval } from "./game-state";

export { computeCoPresencePairs, type CoPresencePair } from "./co-presence";
