/**
 * Player roster state vs. football availability (Players roster-state-and-mobile-convergence
 * pass). These are deliberately different concepts and are never merged:
 *
 * - Roster state answers "is this a player record the coach still actively manages" —
 *   Active / Inactive / Removed / All.
 * - Football availability (`Player.currentAvailability`, round `Availability`) answers "is an
 *   active player expected to be available for a match" — Available / Tentative / Injured / …
 *
 * An active player who is injured, sick, away, tentative, or otherwise unavailable is still part
 * of the active roster and often the player a coach most needs to see — so Roster and
 * Availability stay two separate filters, and Availability never defaults to only "Available".
 *
 * This module is the one place roster state is resolved from the underlying `Player` fields
 * (`active`, `removedAt`) and the one place the URL/query contract for it lives. Every consumer
 * (roster filter, mobile row presentation, selected-player inspector, accessibility text) reuses
 * these exports rather than re-deriving the state.
 */

export type PlayerRosterState = "ACTIVE" | "INACTIVE" | "REMOVED";

export type PlayerRosterFilter = "active" | "inactive" | "removed" | "all";

export const DEFAULT_ROSTER_FILTER: PlayerRosterFilter = "active";

export const ROSTER_FILTER_OPTIONS: ReadonlyArray<{ value: PlayerRosterFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "removed", label: "Removed" },
  { value: "all", label: "All" },
];

/**
 * Resolves the presentation-level roster state from the two underlying `Player` fields:
 *
 * - REMOVED: `removedAt !== null`
 * - INACTIVE: `removedAt === null && active === false`
 * - ACTIVE: `removedAt === null && active === true`
 */
export function resolvePlayerRosterState(active: boolean, removedAt: Date | null): PlayerRosterState {
  if (removedAt !== null) return "REMOVED";
  if (!active) return "INACTIVE";
  return "ACTIVE";
}

/** Short, human-readable label for a resolved roster state — reused by the mobile compact-row
 * trailing label and the selected-player inspector's roster context text. */
export function rosterStateLabel(state: PlayerRosterState): string {
  switch (state) {
    case "INACTIVE":
      return "Inactive";
    case "REMOVED":
      return "Removed";
    case "ACTIVE":
    default:
      return "Active";
  }
}

function isValidRosterFilter(value: string | undefined): value is PlayerRosterFilter {
  return value === "active" || value === "inactive" || value === "removed" || value === "all";
}

/**
 * Resolves the roster filter from the Players route's search params. `roster` is the current,
 * URL-backed control and always wins when present. A bare legacy `showRemoved=1` with no `roster`
 * present is still honoured as "removed" for backward compatibility with links generated before
 * this pass — but no navigation this route generates ever writes `showRemoved` again, and an
 * absent `roster` with no legacy param resolves to the default, "active".
 */
export function resolveRosterFilterFromParams(params: { roster?: string; showRemoved?: string }): PlayerRosterFilter {
  if (isValidRosterFilter(params.roster)) return params.roster;
  if (params.roster === undefined && params.showRemoved === "1") return "removed";
  return DEFAULT_ROSTER_FILTER;
}

/** URL query value for a roster filter — omitted entirely for the default "active" state, so
 * `/players` (no `roster` param) means `roster=active`. */
export function rosterFilterQueryValue(filter: PlayerRosterFilter): string | undefined {
  return filter === DEFAULT_ROSTER_FILTER ? undefined : filter;
}

/**
 * The `Player.findMany` `where` fragment for a roster filter — the one place "Active / Inactive /
 * Removed / All" translates into `active`/`removedAt` conditions. Callers still merge tenant
 * (`organisationId`) scoping on top of this; it never encodes tenancy itself.
 */
export function playerRosterWhere(filter: PlayerRosterFilter): { active?: boolean; removedAt?: null | { not: null } } {
  switch (filter) {
    case "inactive":
      return { removedAt: null, active: false };
    case "removed":
      return { removedAt: { not: null } };
    case "all":
      return {};
    case "active":
    default:
      return { removedAt: null, active: true };
  }
}
