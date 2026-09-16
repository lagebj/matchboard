import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import type { EffectivePlayerPositionProfile } from "@/lib/player-development/effective-position-profile";
import { exactPositionLabel } from "./exact-position-labels";

/**
 * The one shared effective-profile -> canonical position-map entry builder (Matchboard Players
 * Operating Surface bundle, `04_DATA_AND_BATCH_LOADING_CONTRACT.md §5`). Both the Player Detail
 * production adapter and the Players Overview production adapter import this single
 * implementation — neither owns a second copy.
 *
 * A position with no legitimate support never appears
 * (`computeEffectivePlayerPositionProfile()` already filters `rawScore > 0`); unknown grid codes
 * are filtered by `TouchlinePositionMap`/`positionCodeToPoint()` downstream — never a placeholder
 * dot.
 */
export function buildPositionMapEntries(profile: EffectivePlayerPositionProfile): TouchlinePositionMapEntry[] {
  return profile.positions.map((p) => ({
    positionCode: p.positionId,
    positionLabel: exactPositionLabel(p.positionId),
    rank: p.rank,
    supportBand: p.supportBand,
    confidence: p.confidence,
  }));
}
