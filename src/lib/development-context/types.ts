/**
 * Shared primitive types for the development-context-and-evidence layer (ADR-0155). This module
 * declares shapes only — no derivation logic — so `metric-registry.ts`, `quality.ts`,
 * `version.ts`, `spatial-grid.ts`, `game-state.ts`, and `co-presence.ts` can depend on them
 * without a circular import.
 */

/**
 * Points at a canonical source record a derived measurement was computed from. References, never
 * copies, the source — the full record stays queryable from its own owning table.
 */
export interface EvidenceRef {
  kind:
    | "MATCH_EVENT"
    | "ACTUAL_POSITION_INTERVAL"
    | "QUALITATIVE_OBSERVATION"
    | "HUMAN_ASSESSMENT"
    | "MATCH_CONTEXT"
    | "DERIVED_MEASUREMENT"
    | "DERIVED_TREND";
  id: string;
  occurredAt?: string;
  label?: string;
}

/** How complete the inputs behind a measurement are. Distinct from AI uncertainty. */
export type MeasurementCoverage = "COMPLETE" | "PARTIAL" | "UNKNOWN";

/**
 * Data-quality envelope for a derived measurement. `eligible` reflects the metric's own
 * eligibility gate (see `MetricEligibilityGate`), not merely whether `coverage` is complete — a
 * measurement can have complete coverage of too little exposure to be eligible, or partial
 * coverage that is still eligible.
 */
export interface MeasurementQuality {
  coverage: MeasurementCoverage;
  missingInputs: string[];
  warnings: string[];
  exposureSeconds?: number;
  eligible: boolean;
}

/** Team-perspective match state. `UNKNOWN` when chronology is incomplete or contradictory. */
export type GameState = "LEADING" | "DRAWING" | "TRAILING" | "UNKNOWN";

/** Trend direction from a recent-window comparison (see the metric registry's materiality threshold). */
export type TrendDirection = "UP" | "DOWN" | "STABLE";

/** A derived measurement is scoped to one match or to a rolling window across matches. */
export type MetricScopeType = "MATCH" | "WINDOW";

/**
 * Minimum exposure a metric needs before its value is treated as eligible rather than
 * insufficient-data. Absent means no minimum.
 */
export interface MetricEligibilityGate {
  minExposureSeconds?: number;
}

export type MetricKey =
  | "role_seconds"
  | "event_count"
  | "event_rate"
  | "zone_event_count"
  | "zone_event_share"
  | "teammate_copresence_seconds"
  | "game_state_role_seconds";

/**
 * Static metadata for one metric. Never contains derivation logic — `src/lib/development-
 * context/` services compute values using this metadata, UI never re-derives a formula
 * independently (ADR-0155 §1, mirroring ADR-0129/ADR-0154's domain-owner pattern).
 */
export interface MetricDefinition {
  key: MetricKey;
  /** Algorithm version. Increment only when semantic output changes for the same inputs. */
  version: number;
  unit: string;
  requiredInputs: readonly string[];
  eligibilityGate: MetricEligibilityGate;
  dimensions: readonly string[];
  trendEnabled: boolean;
  /** Required when `trendEnabled` is true; the delta magnitude that counts as UP/DOWN rather than STABLE. */
  materialityThreshold?: number;
  displayLabel: string;
  description: string;
}
