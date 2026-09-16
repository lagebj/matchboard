import "server-only";

import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { evaluatePositionEvidence } from "./position-experience";
import { normalizePlayerPositionCode } from "./position-code";
import type { PositionObservationSignal } from "./effective-position-profile";

type ObservationRow = {
  id: string;
  playerId: string;
  direction: string;
  observedAt: Date;
  matchId: string | null;
};

/**
 * Builds the "explicit position observations" evidence input for a batch of players in one
 * round-trip (Matchboard Players Operating Surface bundle, `04_DATA_AND_BATCH_LOADING_CONTRACT.md
 * §3`) — one POSITION-kind `PlayerDevelopmentObservation` query for every requested player,
 * grouped by player + normalized position code, then reduced through the existing
 * `evaluatePositionEvidence()` evaluator (`position-experience.ts`) exactly as the single-player
 * reader already did. Position codes are normalized before grouping so a legacy alias and its
 * exact code accumulate evidence for the same position rather than two separate ones.
 *
 * POSITION observation input has no dedicated current UI, so in practice this returns an empty
 * map for most players today — a disclosed, honest limitation of ADR-0139, not a bug in this
 * reader (see ARR-0049).
 */
export async function getObservationSignalsForPlayers(
  playerIds: string[],
  orgFilter: OrgFilterMode,
): Promise<Map<string, PositionObservationSignal[]>> {
  const result = new Map<string, PositionObservationSignal[]>();
  if (orgFilter.type !== "org" || playerIds.length === 0) return result;

  const observations = await db.playerDevelopmentObservation.findMany({
    where: {
      playerId: { in: playerIds },
      kind: "POSITION",
      ...orgFilter.filterNullable,
    },
    orderBy: { observedAt: "desc" },
    select: {
      id: true,
      playerId: true,
      positionId: true,
      direction: true,
      observedAt: true,
      matchId: true,
    },
  });

  // playerId -> normalized positionId -> observation rows.
  const byPlayerAndPosition = new Map<string, Map<string, ObservationRow[]>>();

  for (const obs of observations) {
    if (!obs.playerId || !obs.positionId) continue;
    const normalizedPosition = normalizePlayerPositionCode(obs.positionId);
    if (!normalizedPosition) continue;

    let byPosition = byPlayerAndPosition.get(obs.playerId);
    if (!byPosition) {
      byPosition = new Map();
      byPlayerAndPosition.set(obs.playerId, byPosition);
    }
    const rows = byPosition.get(normalizedPosition) ?? [];
    rows.push({ id: obs.id, playerId: obs.playerId, direction: obs.direction, observedAt: obs.observedAt, matchId: obs.matchId });
    byPosition.set(normalizedPosition, rows);
  }

  for (const playerId of playerIds) {
    const byPosition = byPlayerAndPosition.get(playerId);
    const signals: PositionObservationSignal[] = [];
    if (byPosition) {
      for (const [positionCode, rows] of byPosition) {
        const evaluated = evaluatePositionEvidence(rows, null);
        if (!evaluated) continue;
        signals.push({ positionCode, confidence: evaluated.confidence, direction: evaluated.direction });
      }
    }
    result.set(playerId, signals);
  }

  return result;
}

/**
 * Builds the "explicit position observations" evidence input for one player. Delegates to the
 * batched `getObservationSignalsForPlayers()` for `[playerId]` — one grouping implementation
 * shared by `sync-effective-position.ts` (the mutation-time engine) and
 * `get-effective-position-profile.ts` (the read-time display loader), per the "one business
 * operation, one owning implementation" invariant.
 */
export async function getObservationSignals(
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<PositionObservationSignal[]> {
  const map = await getObservationSignalsForPlayers([playerId], orgFilter);
  return map.get(playerId) ?? [];
}
