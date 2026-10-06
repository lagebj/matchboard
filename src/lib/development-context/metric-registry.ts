import type { MetricDefinition, MetricKey } from "./types";

/**
 * Central metric registry (ADR-0155 §4/§2, source bundle §04's "Required v1 metrics"). One
 * stable definition per metric key — derivation services (`context-pack.ts`, B2) compute values
 * using this metadata; UI never re-implements a metric's unit, dimensions, or eligibility gate
 * independently.
 *
 * Materiality thresholds are initial defaults, not specified by the source bundle ("Thresholds
 * belong in the metric registry" without concrete numbers) — tunable in B6 without touching any
 * consumer, since consumers read `materialityThreshold` from here rather than hard-coding it.
 */
export const METRIC_REGISTRY: Readonly<Record<MetricKey, MetricDefinition>> = {
  role_seconds: {
    key: "role_seconds",
    version: 1,
    unit: "seconds",
    requiredInputs: ["ActualPositionInterval"],
    eligibilityGate: { minExposureSeconds: 60 },
    dimensions: ["position"],
    trendEnabled: true,
    materialityThreshold: 300,
    displayLabel: "Role exposure",
    description: "Time spent in an actual on-pitch role, derived from ActualPositionInterval.",
  },
  event_count: {
    key: "event_count",
    version: 1,
    unit: "count",
    requiredInputs: ["LiveMatchEvent"],
    eligibilityGate: {},
    dimensions: ["eventType", "position", "gameState", "match"],
    // Raw counts are exposure-sensitive (youth match lengths vary) — event_rate is the
    // trend-eligible normalization of this metric, not this one directly.
    trendEnabled: false,
    displayLabel: "Event count",
    description: "Count of canonical match events matching a filter.",
  },
  event_rate: {
    key: "event_rate",
    version: 1,
    unit: "count_per_exposure",
    requiredInputs: ["LiveMatchEvent", "role_seconds"],
    eligibilityGate: { minExposureSeconds: 60 },
    dimensions: ["eventType", "position", "gameState", "match"],
    trendEnabled: true,
    materialityThreshold: 0.5,
    displayLabel: "Event rate",
    description:
      "Event count divided by an explicit exposure denominator. Never a silent per-90 — display scale is a presentation concern on top of the stored numerator/denominator.",
  },
  zone_event_count: {
    key: "zone_event_count",
    version: 1,
    unit: "count",
    requiredInputs: ["LiveMatchEvent"],
    eligibilityGate: {},
    dimensions: ["zoneId", "eventType", "match"],
    trendEnabled: false,
    displayLabel: "Zone event count",
    description: "Count of valid-coordinate eligible events in one D#_L# zone.",
  },
  zone_event_share: {
    key: "zone_event_share",
    version: 1,
    unit: "ratio",
    requiredInputs: ["LiveMatchEvent"],
    eligibilityGate: {},
    dimensions: ["zoneId", "eventType", "match"],
    trendEnabled: true,
    materialityThreshold: 0.05,
    displayLabel: "Zone event share",
    description:
      "Share of valid-coordinate eligible events landing in one zone. Coordinate coverage is a separate quality value, never folded into this ratio.",
  },
  teammate_copresence_seconds: {
    key: "teammate_copresence_seconds",
    version: 1,
    unit: "seconds",
    requiredInputs: ["ActualPositionInterval"],
    eligibilityGate: { minExposureSeconds: 60 },
    dimensions: ["teammateId"],
    trendEnabled: true,
    materialityThreshold: 300,
    displayLabel: "Teammate co-presence",
    description:
      "Shared on-pitch seconds with a specific teammate. Exposure only — never a chemistry, compatibility, or partnership-quality score.",
  },
  game_state_role_seconds: {
    key: "game_state_role_seconds",
    version: 1,
    unit: "seconds",
    requiredInputs: ["ActualPositionInterval", "MatchStateInterval"],
    eligibilityGate: { minExposureSeconds: 60 },
    dimensions: ["position", "gameState"],
    trendEnabled: true,
    materialityThreshold: 300,
    displayLabel: "Role exposure by game state",
    description:
      "Role exposure split by leading/drawing/trailing/unknown game state. Unknown time is never redistributed into a known state.",
  },
} as const;

export function getMetricDefinition(key: MetricKey): MetricDefinition {
  return METRIC_REGISTRY[key];
}

/** Every metric key the trend engine (B6) operates on -- the one derivation of this list, shared
 * by `recompute-player-trends.ts` (writer) and `get-player-trend-stories.ts` (reader) so neither
 * maintains its own copy of "which metrics trend." */
export const TREND_ENABLED_METRIC_KEYS: readonly MetricKey[] = Object.values(METRIC_REGISTRY)
  .filter((definition) => definition.trendEnabled)
  .map((definition) => definition.key);
