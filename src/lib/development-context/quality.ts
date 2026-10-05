import type { MeasurementCoverage, MetricEligibilityGate } from "./types";

/**
 * Pure data-quality helpers (ADR-0155 §6). `MeasurementCoverage`/`MeasurementQuality` themselves
 * live in `types.ts`; this module holds the two small derivations every B2+ measurement builder
 * needs, so coverage/eligibility logic has one owner instead of being reimplemented per metric.
 */

/**
 * Derives coverage from an explicit total/missing input count. Never guesses: zero total inputs
 * is `UNKNOWN`, not `COMPLETE` (there is nothing to be complete about) and not `PARTIAL`.
 */
export function deriveCoverage(totalInputs: number, missingCount: number): MeasurementCoverage {
  if (totalInputs <= 0) return "UNKNOWN";
  if (missingCount <= 0) return "COMPLETE";
  if (missingCount >= totalInputs) return "UNKNOWN";
  return "PARTIAL";
}

/** Whether a measured exposure clears its metric's own eligibility gate. No gate means always eligible. */
export function meetsEligibilityGate(exposureSeconds: number | undefined, gate: MetricEligibilityGate): boolean {
  if (gate.minExposureSeconds == null) return true;
  return (exposureSeconds ?? 0) >= gate.minExposureSeconds;
}
