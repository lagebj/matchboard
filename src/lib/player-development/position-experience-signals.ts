import "server-only";

import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPositionExperienceForPlayer, evaluatePositionEvidence } from "./position-experience";
import type { PositionObservationSignal } from "./effective-position-profile";

/**
 * Builds the "explicit position observations" evidence input for one player, reusing the
 * existing `evaluatePositionEvidence()` evaluator (`position-experience.ts`) exactly as-is —
 * a legitimate, still-correct piece of otherwise-dormant legacy machinery (see ARR-0049)
 * salvaged rather than re-implemented (contract §5: "Use existing confidence/polarity semantics
 * if present"). In practice this returns an empty array for most players today, since the
 * `PlayerDevelopmentObservation(kind: "POSITION")` creation UI it depends on is currently
 * unreachable (ARR-0049) — a disclosed, honest limitation, not a bug in this reader.
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