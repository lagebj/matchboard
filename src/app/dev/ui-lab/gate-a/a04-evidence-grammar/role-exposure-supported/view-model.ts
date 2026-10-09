import type { SourceRecord } from "../shared/coverage";
import { assertUniqueIds } from "../shared/invariants";
import { eligibleMatches, roleLabel, groupScopeLabel, identity, type CompleteMatchRoleExposure } from "./fixtures";

export type WindowComparison = {
  priorMatches: readonly { matchLabel: string; minutes: number }[];
  latestMatches: readonly { matchLabel: string; minutes: number }[];
  priorTotal: number;
  latestTotal: number;
  priorDenominator: number;
  latestDenominator: number;
  direction: "higher" | "lower" | "equal";
};

/**
 * Validates every observation is a genuinely complete, distinct measurement before any comparison
 * is computed — a raw `minutes` field alone does not prove completeness (independent review
 * round 1, PR #778, verification gap).
 */
function assertAllComplete(matches: readonly CompleteMatchRoleExposure[]): void {
  assertUniqueIds(
    matches.map((m) => m.matchId),
    "match",
  );
  for (const m of matches) {
    if (m.coverage !== "COMPLETE") {
      throw new Error(`role-exposure-supported requires every observation to be COMPLETE; "${m.matchId}" is ${m.coverage}.`);
    }
  }
}

/** Partitions the chronologically ordered fixture into prior-3/latest-3 and derives totals from
 * the actual per-match minutes — never a hard-coded 37/67. Asserts the fixture really is sorted
 * chronologically (so a future edit that reorders it fails loudly) and that every observation is
 * genuinely complete and distinct before computing any total. */
export function computeWindowComparison(matches: readonly CompleteMatchRoleExposure[] = eligibleMatches): WindowComparison {
  assertAllComplete(matches);

  const sorted = [...matches].sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].matchId !== matches[i].matchId) {
      throw new Error("role-exposure-supported fixture must already be in chronological order");
    }
  }

  const half = Math.floor(sorted.length / 2);
  const priorMatches = sorted.slice(0, half).map((m) => ({ matchLabel: m.matchLabel, minutes: m.minutes }));
  const latestMatches = sorted.slice(sorted.length - half).map((m) => ({ matchLabel: m.matchLabel, minutes: m.minutes }));
  const priorTotal = priorMatches.reduce((sum, m) => sum + m.minutes, 0);
  const latestTotal = latestMatches.reduce((sum, m) => sum + m.minutes, 0);

  return {
    priorMatches,
    latestMatches,
    priorTotal,
    latestTotal,
    priorDenominator: priorMatches.length,
    latestDenominator: latestMatches.length,
    direction: latestTotal > priorTotal ? "higher" : latestTotal < priorTotal ? "lower" : "equal",
  };
}

export function buildSourceRecords(): SourceRecord[] {
  return eligibleMatches.map((m) => ({
    sourceId: m.sourceId,
    sourceClass: identity.sourceClass,
    provenance: `${roleLabel}-role duration record`,
    scope: `${m.matchLabel} · ${m.dateUtc.slice(0, 10)} · ${groupScopeLabel}`,
    fieldLabel: `${roleLabel} exposure`,
    fieldValue: `${m.minutes} minutes`,
    coverage: m.coverage,
  }));
}
