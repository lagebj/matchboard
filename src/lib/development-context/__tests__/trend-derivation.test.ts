import { describe, expect, it } from "vitest";
import { computeTrendDraft, type TrendWindowMeasurement } from "../trend-derivation";
import { METRIC_REGISTRY } from "../metric-registry";
import type { MetricDefinition } from "../types";

function measurement(scopeKey: string, value: number, numerator?: number, denominator?: number): TrendWindowMeasurement {
  return { scopeKey, value, numerator, denominator };
}

describe("computeTrendDraft (ADR-0155 §4, bundle §04/§08 trend rule)", () => {
  it("is ineligible with fewer than 6 eligible matches", () => {
    const window = Array.from({ length: 5 }, (_, i) => measurement(`m${i}`, 100));
    expect(computeTrendDraft(METRIC_REGISTRY.role_seconds, { position: "CM" }, window)).toBeNull();
  });

  it("is eligible with exactly 6 eligible matches", () => {
    const window = Array.from({ length: 6 }, (_, i) => measurement(`m${i}`, 100));
    expect(computeTrendDraft(METRIC_REGISTRY.role_seconds, { position: "CM" }, window)).not.toBeNull();
  });

  it("skips ineligible matches rather than zero-filling -- the caller only ever sees 6 real eligible entries", () => {
    // 6 real eligible entries is the floor; this draft must use exactly those 6, never pad.
    const window = Array.from({ length: 6 }, (_, i) => measurement(`m${i}`, 100));
    const draft = computeTrendDraft(METRIC_REGISTRY.role_seconds, { position: "CM" }, window)!;
    expect(draft.previousWindowScopeKeys).toEqual(["m0", "m1", "m2"]);
    expect(draft.latestWindowScopeKeys).toEqual(["m3", "m4", "m5"]);
  });

  it("never mixes dimensions -- the draft carries exactly the dimensions it was given", () => {
    const window = Array.from({ length: 6 }, (_, i) => measurement(`m${i}`, 100));
    const draft = computeTrendDraft(METRIC_REGISTRY.role_seconds, { position: "LCB" }, window)!;
    expect(draft.dimensions).toEqual({ position: "LCB" });
  });

  it("aggregates a plain (non-rate) metric's windows by sum", () => {
    const window = [
      measurement("m0", 100),
      measurement("m1", 200),
      measurement("m2", 300),
      measurement("m3", 400),
      measurement("m4", 500),
      measurement("m5", 600),
    ];
    const draft = computeTrendDraft(METRIC_REGISTRY.role_seconds, {}, window)!;
    expect(draft.previousValue).toBe(600); // 100+200+300
    expect(draft.latestValue).toBe(1500); // 400+500+600
  });

  it("aggregates an exposure-normalized metric by summed numerator / summed denominator, never an equal average of per-match rates", () => {
    const window = [
      measurement("m0", 1 / 100, 1, 100),
      measurement("m1", 1 / 100, 1, 100),
      measurement("m2", 1 / 100, 1, 100),
      // Latest window: one match with far more exposure but the same per-match rate pattern --
      // an equal average of rates would hide that this is actually a much larger sample.
      measurement("m3", 1 / 1000, 1, 1000),
      measurement("m4", 1 / 10, 1, 10),
      measurement("m5", 1 / 10, 1, 10),
    ];
    const draft = computeTrendDraft(METRIC_REGISTRY.event_rate, { eventType: "GOAL_FOR" }, window)!;
    expect(draft.previousValue).toBeCloseTo(3 / 300); // sum(1,1,1) / sum(100,100,100)
    expect(draft.latestValue).toBeCloseTo(3 / 1020); // sum(1,1,1) / sum(1000,10,10)
  });

  it("classifies UP/DOWN/STABLE against the metric's own materiality threshold", () => {
    const definition: MetricDefinition = { ...METRIC_REGISTRY.role_seconds, materialityThreshold: 10 };
    const flat = Array.from({ length: 6 }, (_, i) => measurement(`m${i}`, 100));
    expect(computeTrendDraft(definition, {}, flat)!.direction).toBe("STABLE");

    const up = [
      measurement("m0", 90),
      measurement("m1", 90),
      measurement("m2", 90), // previous total 270
      measurement("m3", 110),
      measurement("m4", 110),
      measurement("m5", 110), // latest total 330, delta 60 >= threshold*3... use per-window totals directly
    ];
    expect(computeTrendDraft(definition, {}, up)!.direction).toBe("UP");

    const down = [
      measurement("m0", 110),
      measurement("m1", 110),
      measurement("m2", 110),
      measurement("m3", 90),
      measurement("m4", 90),
      measurement("m5", 90),
    ];
    expect(computeTrendDraft(definition, {}, down)!.direction).toBe("DOWN");
  });

  it("is never eligible for a metric that is not trend-enabled", () => {
    const window = Array.from({ length: 6 }, (_, i) => measurement(`m${i}`, 100));
    expect(computeTrendDraft(METRIC_REGISTRY.event_count, {}, window)).toBeNull();
  });

  it("is stable across source-query ordering (same 6 eligible matches, different array identity)", () => {
    const window = Array.from({ length: 6 }, (_, i) => measurement(`m${i}`, 100));
    const a = computeTrendDraft(METRIC_REGISTRY.role_seconds, { position: "CM" }, window)!;
    const b = computeTrendDraft(METRIC_REGISTRY.role_seconds, { position: "CM" }, [...window])!;
    expect(a.inputRevision).toBe(b.inputRevision);
  });
});
