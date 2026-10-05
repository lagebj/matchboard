import { describe, expect, it } from "vitest";
import { getMetricDefinition, METRIC_REGISTRY } from "../metric-registry";
import type { MetricKey } from "../types";

const ALL_KEYS: MetricKey[] = [
  "role_seconds",
  "event_count",
  "event_rate",
  "zone_event_count",
  "zone_event_share",
  "teammate_copresence_seconds",
  "game_state_role_seconds",
];

describe("METRIC_REGISTRY (ADR-0155 §4, bundle §04 required v1 metrics)", () => {
  it("defines every required v1 metric exactly once, keyed by itself", () => {
    for (const key of ALL_KEYS) {
      expect(METRIC_REGISTRY[key].key).toBe(key);
    }
  });

  it("starts every metric at algorithm version 1", () => {
    for (const key of ALL_KEYS) {
      expect(METRIC_REGISTRY[key].version).toBe(1);
    }
  });

  it("gives every trend-enabled metric a materiality threshold", () => {
    for (const key of ALL_KEYS) {
      const definition = METRIC_REGISTRY[key];
      if (definition.trendEnabled) {
        expect(definition.materialityThreshold).not.toBeUndefined();
      }
    }
  });

  it("declares at least one dimension and one required input for every metric", () => {
    for (const key of ALL_KEYS) {
      const definition = METRIC_REGISTRY[key];
      expect(definition.dimensions.length).toBeGreaterThan(0);
      expect(definition.requiredInputs.length).toBeGreaterThan(0);
    }
  });

  it("keeps raw event_count non-trend-eligible in favour of its exposure-normalized event_rate", () => {
    expect(METRIC_REGISTRY.event_count.trendEnabled).toBe(false);
    expect(METRIC_REGISTRY.event_rate.trendEnabled).toBe(true);
  });

  it("getMetricDefinition returns the same object as a direct registry lookup", () => {
    expect(getMetricDefinition("role_seconds")).toBe(METRIC_REGISTRY.role_seconds);
  });
});
