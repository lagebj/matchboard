import type { SourceRecord } from "../shared/coverage";
import { eligibleMatches, roleLabel, groupScopeLabel, identity } from "./fixtures";

export function computeExposureCoverage(): { observed: number; denominator: number } {
  const denominator = eligibleMatches.length;
  const observed = eligibleMatches.filter((m) => m.coverage === "COMPLETE").length;
  return { observed, denominator };
}

/** The discrete recorded observations only — never a smoothed/interpolated series across the
 * four missing matches. */
export function observedExposures(): { matchLabel: string; minutes: number }[] {
  const observed: { matchLabel: string; minutes: number }[] = [];
  for (const m of eligibleMatches) {
    if (m.coverage === "COMPLETE" && m.minutes !== undefined) {
      observed.push({ matchLabel: m.matchLabel, minutes: m.minutes });
    }
  }
  return observed;
}

export function buildSourceRecords(): SourceRecord[] {
  return eligibleMatches.map((m) => ({
    sourceId: m.sourceId,
    sourceClass: identity.sourceClass,
    provenance: `${roleLabel}-role duration record`,
    scope: `${m.matchLabel} · ${m.dateUtc.slice(0, 10)} · ${groupScopeLabel}`,
    fieldLabel: `${roleLabel} exposure`,
    fieldValue: m.coverage === "COMPLETE" ? `${m.minutes} minutes` : "No recorded role-duration interval for this match",
    coverage: m.coverage,
  }));
}
