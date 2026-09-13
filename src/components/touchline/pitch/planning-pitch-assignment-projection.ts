import type { PlanningPitchAssignment } from "./touchline-planning-pitch";

/**
 * Shared player-assignment → `PlanningPitchAssignment` mapping (Atlas Follow-up Phase F7,
 * `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`). Every planning-pitch caller that places players
 * into `FormationSlot`-shaped slots — the match Lineup/Tactics tab (`Team.kitColor`-aware) and
 * the Event match lineup panel (no kit colour concept; always passes `null` for the neutral
 * shirt) — shares this one mapping rather than re-deriving it (AGENTS.md's "One business
 * operation, one owning implementation"). Pure — no domain/mutation logic, no DB access — so it
 * is directly unit-testable without mocking either caller's data-fetching machinery.
 */
export type PlanningPitchAssignmentInput = {
  slotId: string;
  playerId: string | null;
  locked: boolean;
};

export type PlanningPitchPlayerInput = {
  id: string;
  firstName: string;
  lastName: string | null;
};

export function buildPlanningPitchAssignments(
  assignments: PlanningPitchAssignmentInput[],
  players: PlanningPitchPlayerInput[],
  teamKitColor: string | null,
  selectedPlayerId: string | null,
): PlanningPitchAssignment[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  return assignments
    .filter((a): a is PlanningPitchAssignmentInput & { playerId: string } => a.playerId !== null)
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
