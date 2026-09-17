import { resolveKitColorSwatch } from "@/lib/teams/kit-color";
import { availabilityLabel } from "@/lib/players/availability-label";
import { normalizePlayerPositionCode } from "@/lib/player-development/position-code";
import type { PlayerRosterState } from "@/lib/players/roster-state";
import { compactPositionLabel, exactPositionLabel } from "./exact-position-labels";
import type { PlayerSeasonOverviewRow, PlayerCurrentRoundAttentionRow, PlayerDevelopmentOverviewRow, IntegrityAttentionState } from "@/lib/players/get-players-overview";
import type { PlayersOverviewRow, PlayersOverviewInspectorData } from "./players-overview-view-model";
import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import type { PlayersCurrentRoundRow } from "./players-current-round-view-model";
import type { PlayersDevelopmentRow } from "./players-development-view-model";

/**
 * Matchboard Players Operating Surface bundle (`06_EXACT_CODE_EXECUTION_PLAN.md` step 11):
 * adapts the canonical `get-players-overview.ts` query results — plus the batched
 * effective-position map entries the page computed via
 * `getEffectivePlayerPositionProfilesForPlayers()` (`04_DATA_AND_BATCH_LOADING_CONTRACT.md §4`)
 * — into the Overview view-model row/inspector shapes. Pure — no DB access — so this exact
 * mapping is directly unit-testable without mocking data-fetching.
 *
 * The prior `effectivePositions: []` deferral is gone: the selected-player inspector now renders
 * the same canonical effective-position map entries Player Detail renders, built by the same
 * shared `buildPositionMapEntries()` (`player-position-map-adapter.ts`). The page passes already-
 * built, JSON-serializable `TouchlinePositionMapEntry[]` per player (no `Date` fields), so the
 * profile computation itself stays server-side while this mapping remains a pure client-safe
 * function.
 */

export type PlayerIdentityInput = {
  id: string;
  firstName: string;
  lastName: string | null;
  shirtNumber: number | null;
  coreTeamKitColor: string | null;
  /**
   * `Player.primaryPosition` — used only as a fallback when no effective-position profile entry
   * exists for this player (e.g. no declared position and no evidence at all). Prefer the
   * effective profile's current primary position everywhere it's available.
   */
  primaryPosition: string | null;
  /** `Player.currentAvailability` — the same field `PlayerCurrentRoundAttentionRow.availability`
   * itself falls back to when no round-scoped `Availability` row exists (see
   * `getPlayersCurrentRoundAttention()`), so Overview mode's own scan-level availability label
   * uses the identical source, not a second one. */
  currentAvailability: string;
  /** Resolved once by the page from `active`/`removedAt` via `resolvePlayerRosterState()` —
      this adapter never re-derives it from raw fields. */
  rosterState: PlayerRosterState;
};

function resolvedKitColor(kitColor: string | null): string | null {
  return resolveKitColorSwatch(kitColor)?.hex ?? null;
}

/** Overview mode's "opportunity this week" reuses the same canonical signal Current Round mode
 * and Round Board already read (`computeRoundPlanIntegrity()`'s `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY`,
 * surfaced here via `IntegrityAttentionState`) — never a second "missing opportunity" rule.
 *
 * Current-round opportunity semantics only ever apply to an ACTIVE roster player (roster-state-
 * and-mobile-convergence pass §7) — an inactive/removed player must never receive a manufactured
 * "no planned opportunity" gap merely because `getPlayersCurrentRoundAttention()` (itself
 * active-only) has no row for them. In practice that query already guarantees `state` is
 * `undefined` for a non-active player, so this check is a second, explicit guarantee rather than
 * the only one. */
function hasOpportunityThisWeek(rosterState: PlayerRosterState, state: IntegrityAttentionState | undefined): boolean | null {
  if (rosterState !== "ACTIVE") return null;
  if (state === undefined || state === "NOT_AVAILABLE") return null;
  return state === "COVERED";
}

/**
 * Mobile compact-row trailing label (roster-state-and-mobile-convergence pass §19) — roster state
 * takes priority over the opportunity signal (and opportunity is never computed for a non-active
 * player in the first place, per `hasOpportunityThisWeek()` above). Replaces the previous opaque
 * "1/1" / "0/1" ratio with semantic, readable text — never colour-only.
 */
export function overviewMobileTrailingLabel(rosterState: PlayerRosterState, opportunityThisWeek: boolean | null): string | null {
  if (rosterState === "INACTIVE") return "Inactive";
  if (rosterState === "REMOVED") return "Removed";
  if (opportunityThisWeek === true) return "Planned";
  if (opportunityThisWeek === false) return "Needs plan";
  return null;
}

/** Tone for the mobile trailing label above — "Needs plan" reads with attention tone, "Planned"
 * stays quiet, and any non-active roster state stays neutral (it's a status, not a warning). */
export function overviewMobileTrailingTone(rosterState: PlayerRosterState, opportunityThisWeek: boolean | null): "quiet" | "attention" | "neutral" {
  if (rosterState !== "ACTIVE") return "neutral";
  if (opportunityThisWeek === false) return "attention";
  return "quiet";
}

/** The effective primary position code for a player: the profile's rank-1 entry when one
 * exists, otherwise the normalized declared `Player.primaryPosition` as an honest fallback. */
function effectivePrimaryCode(
  positionEntries: TouchlinePositionMapEntry[] | undefined,
  declaredPrimaryPosition: string | null | undefined,
): string | null {
  const primaryEntry = positionEntries?.find((e) => e.rank === 1);
  if (primaryEntry) return primaryEntry.positionCode;
  return normalizePlayerPositionCode(declaredPrimaryPosition);
}

export function buildPlayersOverviewRows(
  identities: PlayerIdentityInput[],
  seasonRows: PlayerSeasonOverviewRow[],
  currentRoundRows: PlayerCurrentRoundAttentionRow[],
  effectivePositionsByPlayerId: Record<string, TouchlinePositionMapEntry[]> = {},
): PlayersOverviewRow[] {
  const identityById = new Map(identities.map((p) => [p.id, p]));
  const integrityByPlayer = new Map(currentRoundRows.map((r) => [r.playerId, r.integrityState]));

  return seasonRows.map((row): PlayersOverviewRow => {
    const identity = identityById.get(row.playerId);
    const integrityState = integrityByPlayer.get(row.playerId);
    const positionEntries = effectivePositionsByPlayerId[row.playerId];
    const primaryCode = effectivePrimaryCode(positionEntries, identity?.primaryPosition);
    const rosterState: PlayerRosterState = identity?.rosterState ?? "ACTIVE";
    return {
      playerId: row.playerId,
      displayName: row.displayName,
      shirtNumber: identity?.shirtNumber ?? null,
      kitColor: resolvedKitColor(identity?.coreTeamKitColor ?? null),
      coreTeamName: row.coreTeam?.name ?? null,
      currentPrimaryPositionCode: primaryCode,
      currentPrimaryPosition: primaryCode ? compactPositionLabel(primaryCode) : null,
      availabilityLabel: availabilityLabel(identity?.currentAvailability ?? "UNKNOWN"),
      hasOpportunityThisWeek: hasOpportunityThisWeek(rosterState, integrityState),
      played: row.actualAppearances,
      goals: row.goals,
      assists: row.assists,
      core: row.coreAppearances,
      support: row.supportAppearances,
      development: row.developmentAppearances,
      matchdayAdditions: row.matchdayAdditions,
      plannedButAbsent: row.plannedButAbsent,
      // Same active-only guarantee as `hasOpportunityThisWeek()` above — current-round attention
      // is a signal about active-roster opportunity, so it never fires for an inactive/removed
      // player even if `currentRoundRows` somehow carried a stray row for one (§7).
      attention:
        rosterState === "ACTIVE" &&
        integrityState !== undefined &&
        integrityState !== "COVERED" &&
        integrityState !== "NOT_AVAILABLE",
      rosterState,
    };
  });
}

export function buildPlayersOverviewInspectorData(
  row: PlayersOverviewRow,
  effectivePositions: TouchlinePositionMapEntry[],
  activeDevelopmentFocus: string | null,
  orgSlugHref: (path: string) => string,
): PlayersOverviewInspectorData {
  return {
    playerId: row.playerId,
    displayName: row.displayName,
    shirtNumber: row.shirtNumber,
    kitColor: row.kitColor,
    coreTeamName: row.coreTeamName,
    currentPrimaryPosition: row.currentPrimaryPosition,
    currentPrimaryPositionFull: row.currentPrimaryPositionCode ? exactPositionLabel(row.currentPrimaryPositionCode) : null,
    availabilityLabel: row.availabilityLabel,
    rosterState: row.rosterState,
    // Only an ACTIVE roster player gets a current-round opportunity summary — the inspector
    // omits the row entirely for Inactive/Removed rather than rendering a manufactured
    // "unavailable"/"no planned opportunity" state (roster-state-and-mobile-convergence pass §7).
    opportunityLabel:
      row.rosterState !== "ACTIVE"
        ? null
        : row.hasOpportunityThisWeek === null
          ? "Unavailable this round"
          : row.hasOpportunityThisWeek
            ? "Has planned opportunity"
            : "No planned opportunity",
    effectivePositions,
    played: row.played,
    goals: row.goals,
    assists: row.assists,
    core: row.core,
    support: row.support,
    development: row.development,
    activeDevelopmentFocus,
    playerDetailHref: orgSlugHref(`/players/${row.playerId}`),
  };
}

export function buildPlayersCurrentRoundRows(
  identities: PlayerIdentityInput[],
  rows: PlayerCurrentRoundAttentionRow[],
): PlayersCurrentRoundRow[] {
  const identityById = new Map(identities.map((p) => [p.id, p]));

  return rows.map((row): PlayersCurrentRoundRow => {
    const identity = identityById.get(row.playerId);
    return {
      playerId: row.playerId,
      displayName: row.displayName,
      shirtNumber: identity?.shirtNumber ?? null,
      kitColor: resolvedKitColor(identity?.coreTeamKitColor ?? null),
      coreTeamName: row.coreTeam?.name ?? null,
      availabilityLabel: availabilityLabel(row.availability),
      currentAssignment: row.currentAssignment
        ? { teamName: row.currentAssignment.teamName, opponent: row.currentAssignment.opponent, role: row.currentAssignment.role }
        : null,
      attentionState: row.integrityState,
    };
  });
}

export function buildPlayersDevelopmentRows(
  identities: PlayerIdentityInput[],
  rows: PlayerDevelopmentOverviewRow[],
): PlayersDevelopmentRow[] {
  const identityById = new Map(identities.map((p) => [p.id, p]));

  return rows.map((row): PlayersDevelopmentRow => {
    const identity = identityById.get(row.playerId);
    return {
      playerId: row.playerId,
      displayName: row.displayName,
      shirtNumber: identity?.shirtNumber ?? null,
      kitColor: resolvedKitColor(identity?.coreTeamKitColor ?? null),
      activeDevelopmentFocus: row.activeDevelopmentFocus,
      focusStartedAt: row.focusStartedAt ? row.focusStartedAt.toISOString() : null,
      latestObservationSummary: null,
      effectivePositionSummary: null,
      decisionReviewState: null,
    };
  });
}
