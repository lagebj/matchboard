import "server-only";

import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPlayersActualPositionHistory } from "./position-usage-history";
import { getObservationSignalsForPlayers } from "./position-experience-signals";
import { normalizePlayerPositionCode } from "./position-code";
import {
  computeEffectivePlayerPositionProfile,
  type EffectivePlayerPositionProfile,
} from "./effective-position-profile";

/**
 * The one DB-bound "compute display-ready effective position profiles for a batch of players"
 * loader (Matchboard Players Operating Surface bundle, `04_DATA_AND_BATCH_LOADING_CONTRACT.md
 * §4`). One declared-position query, one batched actual-position-history read and one batched
 * observation-signal read for every requested player — never a per-player query loop. Declared
 * primary/secondary/tertiary are normalized (`normalizePlayerPositionCode()`) before the pure
 * `computeEffectivePlayerPositionProfile()` engine runs, so a legacy alias and its exact code
 * never become two separate effective positions for the same player.
 *
 * Purely read-only: it *consumes* the current declared triple and each player's evidence, it
 * never mutates anything. Automatic evolution writes happen only at committed-evidence time in
 * `sync-effective-position.ts`, which shares the same underlying query helpers.
 */
export async function getEffectivePlayerPositionProfilesForPlayers(
  playerIds: string[],
  orgFilter: OrgFilterMode,
  now: Date = new Date(),
): Promise<Map<string, EffectivePlayerPositionProfile>> {
  const result = new Map<string, EffectivePlayerPositionProfile>();
  if (playerIds.length === 0) return result;

  if (orgFilter.type !== "org") {
    for (const playerId of playerIds) {
      result.set(playerId, computeEffectivePlayerPositionProfile({ primary: "", secondary: null, tertiary: null }, [], [], now));
    }
    return result;
  }

  const [players, matchHistoryByPlayer, observationSignalsByPlayer] = await Promise.all([
    db.player.findMany({
      where: { id: { in: playerIds }, organisationId: orgFilter.organisationId },
      select: { id: true, primaryPosition: true, secondaryPosition: true, tertiaryPosition: true },
    }),
    getPlayersActualPositionHistory(playerIds, orgFilter),
    getObservationSignalsForPlayers(playerIds, orgFilter),
  ]);

  const playerById = new Map(players.map((p) => [p.id, p]));

  for (const playerId of playerIds) {
    const player = playerById.get(playerId);
    const declared = {
      primary: normalizePlayerPositionCode(player?.primaryPosition) ?? "",
      secondary: normalizePlayerPositionCode(player?.secondaryPosition),
      tertiary: normalizePlayerPositionCode(player?.tertiaryPosition),
    };
    const matchHistory = matchHistoryByPlayer.get(playerId) ?? [];
    const observationSignals = observationSignalsByPlayer.get(playerId) ?? [];

    result.set(playerId, computeEffectivePlayerPositionProfile(declared, matchHistory, observationSignals, now));
  }

  return result;
}

/**
 * Computes the current effective position profile for one player (Atlas Follow-up,
 * `07_EVOLVING_PLAYER_POSITION_MODEL.md §10` — "The green-dot map consumes the same effective
 * position profile as the rest of the product"). Presentation surfaces call this, never
 * `computeEffectivePlayerPositionProfile()` directly with hand-assembled inputs.
 *
 * Delegates to the batched `getEffectivePlayerPositionProfilesForPlayers()` for `[playerId]` —
 * one implementation shared by Player Detail (single-player) and Players Overview (batched)
 * (Matchboard Players Operating Surface bundle, `04_DATA_AND_BATCH_LOADING_CONTRACT.md §4`).
 */
export async function getEffectivePlayerPositionProfileForPlayer(
  playerId: string,
  orgFilter: OrgFilterMode,
  now: Date = new Date(),
): Promise<EffectivePlayerPositionProfile> {
  const map = await getEffectivePlayerPositionProfilesForPlayers([playerId], orgFilter, now);
  return (
    map.get(playerId) ?? computeEffectivePlayerPositionProfile({ primary: "", secondary: null, tertiary: null }, [], [], now)
  );
}
