import "server-only";

import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPositionExperienceForPlayer, evaluatePositionEvidence } from "./position-experience";
import type { PositionObservationSignal } from "./effective-position-profile";

/**
 * Builds the "explicit position observations" evidence input for one player, reusing the
 * existing `evaluatePositionEvidence()` evaluator (`position-experience.ts`) exactly as-is —
 * a retained canonical POSITION-observation evidence reader (see ARR-0049), not part of a dead
 * subsystem. The old suggestion/approval workflow (`PlayerProfileSuggestion` and its
 * accept/adjust/reject UI) was removed by ARR-0049's resolution; this reader was carried
 * forward because ADR-0139 consumes it directly. POSITION observation input has no dedicated
 * current UI, so in practice this returns an empty array for most players today — a disclosed,
 * honest limitation of ADR-0139, not a bug in this reader.
 *
 * Shared by `sync-effective-position.ts` (the mutation-time engine) and
 * `get-effective-position-profile.ts` (the read-time display loader) — one implementation, per
 * the "one business operation, one owning implementation" invariant.
 */
export async function getObservationSignals(
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<PositionObservationSignal[]> {
  if (orgFilter.type !== "org") return [];
  const rows = await getPositionExperienceForPlayer(playerId, orgFilter);
  const signals: PositionObservationSignal[] = [];
  for (const row of rows) {
    const evaluated = evaluatePositionEvidence(row.observations, null);
    if (!evaluated) continue;
    signals.push({ positionCode: row.positionId, confidence: evaluated.confidence, direction: evaluated.direction });
  }
  return signals;
}