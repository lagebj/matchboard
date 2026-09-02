import type { PostMatchAttendanceStatus } from "@/generated/prisma/client";

/**
 * Derives initial post-match attendance status from pre-match availability
 * and match-specific absence data.
 *
 * Rules:
 * | Pre-match availability   | Absence recorded | Derived attendance |
 * |--------------------------|------------------|--------------------|
 * | AVAILABLE / TENTATIVE    | —                | PRESENT            |
 * | NO_SHOW (absence reason) | yes              | NO_SHOW            |
 * | UNAVAILABLE / INJURED /  | —                | NO_SHOW            |
 * | SICK / AWAY              |                  |                    |
 * | Unknown / unset          | —                | UNKNOWN            |
 *
 * This is the single source of truth for the initial-attendance derivation
 * used when seeding a report from a finalized squad and when clearing a
 * match absence (restoring attendance based on current availability).
 */
export function deriveInitialAttendance(
  playerId: string,
  availabilityByPlayerId: Map<string, string>,
  absenceByPlayerId: Map<string, string>,
): PostMatchAttendanceStatus {
  const absenceReason = absenceByPlayerId.get(playerId);
  if (absenceReason) return "NO_SHOW";

  const availability = availabilityByPlayerId.get(playerId);
  if (availability === "AVAILABLE" || availability === "TENTATIVE") return "PRESENT";
  if (availability === "UNAVAILABLE" || availability === "INJURED" || availability === "SICK" || availability === "AWAY") return "NO_SHOW";

  return "UNKNOWN";
}