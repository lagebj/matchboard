import type { PlanningPitchAssignment } from "@/components/touchline";

/**
 * Adapts the existing, canonical `FormationSlot`/`MatchLineupAssignment` data (unchanged, still
 * owned by `lineup-actions.ts`/`suggest-actions.ts`) into `TouchlinePlanningPitch`'s presentation
 * shape (Atlas Follow-up Phase F7 production pitch migration,
 * `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`). Pure — no domain/mutation logic, no DB access — so
 * the exact same mapping used by `MatchTacticsPanel` is directly unit-testable without mocking
 * the component's data-fetching machinery.
 *
 * The `FormationSlot` → `PlanningPitchSlot` half of this mapping lives in the shared
 * `buildPlanningPitchSlotsFromFormationSlots()` (`@/components/touchline`) — the Formations
 * editor needs the identical mapping, so it is not re-derived here (AGENTS.md's "One business
 * operation, one owning implementation"). Only the assignment (player) side is Tactics-specific.
 */

export type TacticsPitchAssignmentInput = {
  slotId: string;
  playerId: string | null;
  locked: boolean;
};

export type TacticsPitchPlayerInput = {
  id: string;
  firstName: string;
  lastName: string | null;
};

export function buildPlanningPitchAssignments(
  assignments: TacticsPitchAssignmentInput[],
  players: TacticsPitchPlayerInput[],
  teamKitColor: string | null,
  selectedPlayerId: string | null,
): PlanningPitchAssignment[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  return assignments
    .filter((a): a is TacticsPitchAssignmentInput & { playerId: string } => a.playerId !== null)
    .map((a) => {
      const player = playerById.get(a.playerId);
      const name = player ? `${player.firstName}${player.lastName ? ` ${player.lastName.charAt(0)}.` : ""}` : "Unknown";
      return {
        slotId: a.slotId,
        playerId: a.playerId,
        name,
        kitColor: teamKitColor,
        locked: a.locked,
        selected: a.playerId === selectedPlayerId,
      };
    });
}
