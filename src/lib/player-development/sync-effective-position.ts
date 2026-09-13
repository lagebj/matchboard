import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { getPlayerActualPositionHistory } from "./position-usage-history";
import { getObservationSignals } from "./position-experience-signals";
import {
  determineAutomaticPositionUpdate,
  type DeclaredPositions,
} from "./effective-position-profile";

export type PositionEvolutionOutcome = {
  playersEvaluated: number;
  playersUpdated: number;
  errors: string[];
};

/**
 * Automatic evolution for one player: computes whether accumulated evidence warrants promoting
 * a new primary position (with full hysteresis — see `determineAutomaticPositionUpdate()`), and
 * if so, writes it through the same validated fields every other position write already uses
 * (`Player.primaryPosition`/`secondaryPosition`/`tertiaryPosition` — no new column, no second
 * source of truth), with a `DecisionRecord` audit entry (contract §12).
 *
 * Timing (contract §11): only called from `runPostMatchLearning()`, i.e. at committed-evidence
 * time (post-match report completion) — never from an unsubmitted live plan.
 */
export async function evolvePlayerPositionProfile(
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<{ updated: boolean; reason: string }> {
  if (orgFilter.type !== "org") return { updated: false, reason: "No organisation context." };

  const player = await db.player.findFirst({
    where: { id: playerId, organisationId: orgFilter.organisationId, removedAt: null },
    select: { id: true, primaryPosition: true, secondaryPosition: true, tertiaryPosition: true },
  });
  if (!player) return { updated: false, reason: "Player not found." };

  const declared: DeclaredPositions = {
    primary: player.primaryPosition,
    secondary: player.secondaryPosition,
    tertiary: player.tertiaryPosition,
  };

  const [matchHistory, observations] = await Promise.all([
    getPlayerActualPositionHistory(playerId, orgFilter),
    getObservationSignals(playerId, orgFilter),
  ]);

  const result = determineAutomaticPositionUpdate(declared, matchHistory, observations);
  if (!result.changed || !result.newDeclared) {
    return { updated: false, reason: result.reason };
  }

  await db.$transaction([
    db.player.update({
      where: { id: playerId },
      data: {
        primaryPosition: result.newDeclared.primary,
        secondaryPosition: result.newDeclared.secondary,
        tertiaryPosition: result.newDeclared.tertiary,
      },
    }),
    db.decisionRecord.create({
      data: {
        organisationId: orgFilter.organisationId,
        decisionType: "POSITION_PROFILE_EVOLUTION",
        entityType: "Player",
        entityId: playerId,
        action: "AUTO_PROMOTE_PRIMARY",
        reason: result.reason,
        createdBy: "position-evolution-engine",
        beforeSnapshot: declared,
        afterSnapshot: result.newDeclared,
      },
    }),
  ]);

  return { updated: true, reason: result.reason };
}

/**
 * DB-bound orchestrator step called from `runPostMatchLearning()` (ADR-0104's shared pipeline) —
 * evaluates every player who actually appeared in this specific match (from
 * `ActualPositionInterval`, never a planned/suitability source) for automatic position evolution.
 * One player's failure never blocks another's, matching every other learning step's isolation.
 */
export async function evolvePositionProfilesForMatch(
  ref: FootballMatchRef,
  orgFilter: OrgFilterMode,
): Promise<PositionEvolutionOutcome> {
  const outcome: PositionEvolutionOutcome = { playersEvaluated: 0, playersUpdated: 0, errors: [] };
  if (orgFilter.type !== "org") return outcome;

  // Explicitly Player-only (`playerId: { not: null }`) — never falls back to `guestPlayerId`.
  // A GuestPlayer never accumulates persistent position evidence in the borrowing group
  // (ADR-0106), and this must be an explicit exclusion here, not an accidental one produced by
  // a lookup miss further down the pipeline.
  const intervals = await db.actualPositionInterval.findMany({
    where: {
      organisationId: orgFilter.organisationId,
      playerId: { not: null },
      ...(ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId }),
    },
    select: { playerId: true },
  });
  const playerIds = [...new Set(intervals.map((i) => i.playerId!))];

  for (const playerId of playerIds) {
    try {
      const result = await evolvePlayerPositionProfile(playerId, orgFilter);
      outcome.playersEvaluated += 1;
      if (result.updated) outcome.playersUpdated += 1;
    } catch (error) {
      outcome.errors.push(error instanceof Error ? error.message : "Unknown error");
    }
  }

  return outcome;
}
