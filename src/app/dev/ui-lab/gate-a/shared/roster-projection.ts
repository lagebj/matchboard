/**
 * Minimal authoritative roster projection (independent review finding, PR #779): A09-S1 and
 * A09-S6's `useFixtureOperation` authoritative state was a bare `number`, so a resolved `SUCCESS`
 * only ever incremented a count — it recorded no participant identity. Reopening the editor after
 * a successful addition showed the same candidate as still eligible, so the identical predeclared
 * `SUCCESS` outcome could be submitted and resolved again for the same player, producing an
 * internally inconsistent fixture (one player, two additions).
 *
 * This is deliberately NOT a `hasAddedPlayer` boolean and NOT a disabled-after-one-success editor
 * lock — a boolean cannot answer "which candidate is already included" (irrelevant here, since
 * each W3 scenario page has exactly one candidate, but the projection should still represent the
 * real fact, not a page-specific shortcut), and a permanently-disabled editor would be a UI
 * decision standing in for a domain fact instead of representing one. `addedPlayerIds` is the
 * actual authoritative result of a resolved `SUCCESS`; the displayed count and a candidate's
 * continued eligibility are both *derived* from it, never tracked as separate state that could
 * drift out of sync.
 */
export type RosterProjection = {
  /** The fixed starting count this scenario begins from (e.g. the 8-member planned squad, or the operational roster's base count) — never mutated. */
  readonly baselineCount: number;
  /** Player IDs added via a resolved `SUCCESS` outcome, in order. The only thing a `SUCCESS` ever appends to. */
  readonly addedPlayerIds: readonly string[];
};

export function initialRoster(baselineCount: number): RosterProjection {
  return { baselineCount, addedPlayerIds: [] };
}

/** The one place the displayed count is computed — never duplicated as a separately-tracked field. */
export function rosterDisplayCount(roster: RosterProjection): number {
  return roster.baselineCount + roster.addedPlayerIds.length;
}

export function rosterIncludesPlayer(roster: RosterProjection, playerId: string): boolean {
  return roster.addedPlayerIds.includes(playerId);
}

/**
 * Pure reducer for `useFixtureOperation`'s `applySuccess`. Idempotent by construction — if this
 * were ever called twice for the same player (it should not be reachable through the UI, since a
 * once-added candidate becomes ineligible and the row disables), it still would not double-add,
 * so the authoritative projection can never become internally inconsistent even under a bug
 * elsewhere in the call chain. This is a data-consistency guarantee of the reducer itself, not a
 * new permission or eligibility system.
 */
export function addPlayerToRoster(roster: RosterProjection, playerId: string): RosterProjection {
  if (rosterIncludesPlayer(roster, playerId)) return roster;
  return { ...roster, addedPlayerIds: [...roster.addedPlayerIds, playerId] };
}
