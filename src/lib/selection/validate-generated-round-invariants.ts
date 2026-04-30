import type { RotationPathEdge } from "@/lib/selection/rotation-path-policy";
import { canMoveForRole } from "@/lib/selection/rotation-path-policy";
import type { AutomaticSelectionCategory, GeneratedSelection } from "@/lib/selection/types";

export type InvariantViolation = {
  code: string;
  message: string;
  matchId?: string;
  playerCoreTeamId?: string;
  playerId?: string;
  role?: string;
  severity: "HARD_BLOCK" | "REQUIRES_OVERRIDE" | "WARNING";
  targetTeamId?: string;
};

const NON_CORE_ROLES: Set<string> = new Set(["SUPPORT", "DEVELOPMENT", "BACKFILL", "CONFIDENCE_REBUILD"]);

export function validateGeneratedRoundInvariants(
  roundSelections: GeneratedSelection[],
  rotationPaths: RotationPathEdge[],
  teamIdByMatchId: Map<string, string>,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const selection of roundSelections) {
    const targetTeamId = teamIdByMatchId.get(selection.matchId);
    if (!targetTeamId) continue;

    for (const player of selection.selectedPlayers) {
      if (!NON_CORE_ROLES.has(player.selectionCategory)) {
        continue;
      }

      const role = player.selectionCategory as AutomaticSelectionCategory;

      if (player.manualOverride) {
        continue;
      }

      const result = canMoveForRole(
        player.coreTeamId,
        targetTeamId,
        role,
        false,
        rotationPaths,
      );

      if (!result.valid) {
        violations.push({
          code: "invariant_invalid_non_core_selection",
          message: `Player ${player.playerName} (${player.coreTeamName}) selected as ${role} for target team, but ${result.explanation}`,
          matchId: selection.matchId,
          playerId: player.playerId,
          playerCoreTeamId: player.coreTeamId,
          targetTeamId,
          role,
          severity: "HARD_BLOCK",
        });
      }
    }
  }

  return violations;
}