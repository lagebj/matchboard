export type AutomaticMoveRole = "CORE" | "SUPPORT" | "DEVELOPMENT";

/**
 * Given a player's core team, a target team, and the set of active rotation-path roles
 * connecting them (already resolved — see load-rotation-paths.ts), determines what role a
 * manual drag/drop move to that team should default to: CORE if the player already belongs
 * there; otherwise SUPPORT when a SUPPORT path exists (preferred over DEVELOPMENT when both
 * are available), DEVELOPMENT when only a DEVELOPMENT path exists, or CORE (requiring a manual
 * override reason, enforced server-side by manual-draft-edit.ts) when no path exists.
 *
 * This is a pre-fill convenience only — src/lib/selection/manual-draft-edit.ts independently
 * re-validates the submitted role against canMoveForRole() and requires an override reason when
 * it doesn't hold, so an incorrect or stale pre-fill here cannot bypass rotation-path rules. The
 * function exists so that preference logic (SUPPORT over DEVELOPMENT) has exactly one
 * implementation — round-board.tsx previously duplicated it inline (ARR-0004 Claim 3).
 */
export function determineAutomaticRoleFromPaths(
  playerCoreTeamId: string | null | undefined,
  targetTeamId: string,
  pathRoles: string[],
): AutomaticMoveRole {
  if (playerCoreTeamId === targetTeamId) return "CORE";

  const hasSupport = pathRoles.includes("SUPPORT");
  const hasDevelopment = pathRoles.includes("DEVELOPMENT");

  if (hasSupport && !hasDevelopment) return "SUPPORT";
  if (hasDevelopment && !hasSupport) return "DEVELOPMENT";
  if (hasSupport) return "SUPPORT";
  return "CORE";
}
