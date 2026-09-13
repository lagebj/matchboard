import "server-only";

import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPlayerActualPositionHistory } from "./position-usage-history";
import { getObservationSignals } from "./position-experience-signals";
import {
  computeEffectivePlayerPositionProfile,
  type EffectivePlayerPositionProfile,
} from "./effective-position-profile";

/**
 * The one DB-bound "compute a display-ready effective position profile for one player" wrapper
 * (Atlas Follow-up, `07_EVOLVING_PLAYER_POSITION_MODEL.md §10` — "The green-dot map consumes the
 * same effective position profile as the rest of the product"). Presentation surfaces call
 * this, never `computeEffectivePlayerPositionProfile()` directly with hand-assembled inputs.
 *
 * Purely read-only: it *consumes* the current declared triple and the player's evidence, it
 * never mutates anything. Automatic evolution writes happen only at committed-evidence time in
 * `sync-effective-position.ts`, which shares the same underlying query helpers.
 */
export async function getEffectivePlayerPositionProfileForPlayer(
  playerId: string,
  orgFilter: OrgFilterMode,
  now: Date = new Date(),
): Promise<EffectivePlayerPositionProfile> {
  if (orgFilter.type !== "org") {
    return computeEffectivePlayerPositionProfile({ primary: "", secondary: null, tertiary: null }, [], [], now);
  }

  const player = await db.player.findFirst({
    where: { id: playerId, organisationId: orgFilter.organisationId },
    select: { primaryPosition: true, secondaryPosition: true, tertiaryPosition: true },
  });

  const [matchHistory, observationSignals] = await Promise.all([
    getPlayerActualPositionHistory(playerId, orgFilter),
    getObservationSignals(playerId, orgFilter),
  ]);

  return computeEffectivePlayerPositionProfile(
    {
      primary: player?.primaryPosition ?? "",
      secondary: player?.secondaryPosition ?? null,
      tertiary: player?.tertiaryPosition ?? null,
    },
    matchHistory,
    observationSignals,
    now,
  );
}