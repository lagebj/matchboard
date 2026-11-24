import { collapseTacticalToProfile, type ProfilePosition } from "@/app/dev/ui-lab/gate-a/shared/profile-position-model";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";

/**
 * Real 24-to-14 aggregation for D02's "profile-level dot consolidation without losing exact
 * sided drill-down or double-counting" acceptance question. Reuses the one real mapping
 * authority in this repo (`collapseTacticalToProfile`, Gate A) — no second mapping table.
 *
 * Each exact share is summed into exactly the one profile group `collapseTacticalToProfile`
 * assigns it to; nothing is dropped, nothing is counted twice (asserted in
 * `__tests__/profile-consolidation.test.ts`).
 */
export type ExactPositionShare = { code: CanonicalTacticalPosition; sharePercent: number };
export type ProfilePositionShare = { code: ProfilePosition; sharePercent: number };

export function consolidateExactSharesByProfile(exactShares: readonly ExactPositionShare[]): ProfilePositionShare[] {
  const byProfile = new Map<ProfilePosition, number>();
  for (const { code, sharePercent } of exactShares) {
    const profile = collapseTacticalToProfile(code);
    byProfile.set(profile, (byProfile.get(profile) ?? 0) + sharePercent);
  }
  return Array.from(byProfile.entries()).map(([code, sharePercent]) => ({ code, sharePercent }));
}
