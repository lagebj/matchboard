import { db } from "@/lib/db";
import type { AvailabilityStatus } from "@/generated/prisma/client";

/**
 * Resolves "what was this player's availability for this round" correctly whether the round is
 * still open or already historical (ADR-0121, resolving the historical half of ARR-0041).
 *
 * - `LIVE`  — the round's planning boundary has not closed; the answer is the player's current,
 *   mutable `Player.currentAvailability`. Identical to the pre-ADR-0121 behaviour.
 * - `CAPTURED` — the round is FINALIZED and `finalizeRoundRecord()` froze an `Availability`
 *   snapshot when its boundary closed; the answer is the frozen row. A player with no row in a
 *   captured round was out of the snapshot's scope (their core team was not playing and they
 *   were not selected), so they had no round obligation — reported as `UNKNOWN`.
 * - `NO_HISTORICAL_DATA` — the round is FINALIZED but was closed before ADR-0121 shipped (or was
 *   captured with an empty roster). We genuinely do not know; the answer is `UNKNOWN` and every
 *   caller must treat that as "assert nothing", never as "was available".
 *
 * A FINALIZED round with at least one `Availability` row is unambiguously "captured" because
 * `captureRoundAvailabilitySnapshot()` is the only production writer of that model.
 */
export type RoundAvailabilitySource = "LIVE" | "CAPTURED" | "NO_HISTORICAL_DATA";

export type RoundAvailabilityResolution = {
  status: AvailabilityStatus;
  source: RoundAvailabilitySource;
};

export type RoundAvailabilityResolver = {
  /** The round's captured/live state as a whole. */
  source: RoundAvailabilitySource;
  /** True once a historical snapshot exists for this round (FINALIZED + >=1 captured row). */
  isCaptured: boolean;
  resolve: (playerId: string) => RoundAvailabilityResolution;
};

const UNKNOWN: AvailabilityStatus = "UNKNOWN";

/**
 * @param liveAvailabilityByPlayerId the caller's already-loaded `Player.currentAvailability` map
 *   (avoids a redundant player query for the open-round case, which is the common one).
 */
export async function getRoundAvailabilityResolver(
  matchRoundId: string,
  roundStatus: string,
  liveAvailabilityByPlayerId: Map<string, AvailabilityStatus | string>,
): Promise<RoundAvailabilityResolver> {
  if (roundStatus !== "FINALIZED") {
    return {
      source: "LIVE",
      isCaptured: false,
      resolve: (playerId) => ({
        status: (liveAvailabilityByPlayerId.get(playerId) as AvailabilityStatus) ?? UNKNOWN,
        source: "LIVE",
      }),
    };
  }

  const rows = await db.availability.findMany({
    where: { matchRoundId },
    select: { playerId: true, status: true },
  });

  if (rows.length === 0) {
    return {
      source: "NO_HISTORICAL_DATA",
      isCaptured: false,
      resolve: () => ({ status: UNKNOWN, source: "NO_HISTORICAL_DATA" }),
    };
  }

  const captured = new Map(rows.map((r) => [r.playerId, r.status]));
  return {
    source: "CAPTURED",
    isCaptured: true,
    resolve: (playerId) => {
      const status = captured.get(playerId);
      return status != null
        ? { status, source: "CAPTURED" }
        : { status: UNKNOWN, source: "NO_HISTORICAL_DATA" };
    },
  };
}
