import type { SourceRecord } from "../shared/coverage";
import { canonicalResult, eventLog, homeTeam, awayTeam, identity } from "./fixtures";

/** The displayed final score comes straight from the canonical result record — never derived by
 * counting `eventLog.events`, which is deliberately sparse. */
export function finalScoreLabel(): string {
  return `${canonicalResult.homeScore}–${canonicalResult.awayScore}`;
}

/** Scoped to the final-score claim only (independent review round 1, PR #778, finding R3 — the
 * event inspector must not open with the result record first). */
export function buildResultSourceRecords(): SourceRecord[] {
  return [
    {
      sourceId: canonicalResult.sourceId,
      sourceClass: identity.sourceClass,
      provenance: "Canonical match result record",
      scope: `${homeTeam} vs ${awayTeam}`,
      fieldLabel: "Final score",
      fieldValue: finalScoreLabel(),
      coverage: canonicalResult.coverage,
    },
  ];
}

/** Scoped to the event-log claim only. */
export function buildEventSourceRecords(): SourceRecord[] {
  return eventLog.events.map((e) => ({
    sourceId: e.sourceId,
    sourceClass: identity.sourceClass,
    provenance: "Individually logged match event",
    scope: `${homeTeam} vs ${awayTeam} · ${e.minute}'`,
    fieldLabel: e.type,
    fieldValue: `${e.minute}'`,
    coverage: eventLog.coverage,
  }));
}
