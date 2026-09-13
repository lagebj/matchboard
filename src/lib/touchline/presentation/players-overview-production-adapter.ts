import { resolveKitColorSwatch } from "@/lib/teams/kit-color";
import type { PlayerSeasonOverviewRow, PlayerCurrentRoundAttentionRow, PlayerDevelopmentOverviewRow, IntegrityAttentionState } from "@/lib/players/get-players-overview";
import type { PlayersOverviewRow, PlayersOverviewInspectorData } from "./players-overview-view-model";
import type { PlayersCurrentRoundRow } from "./players-current-round-view-model";
import type { PlayersDevelopmentRow } from "./players-development-view-model";

/**
 * Atlas Follow-up Phase F8 (Production Players migration,
 * `03_PLAYER_OVERVIEW_CONTRACT.md`): adapts the existing, canonical `get-players-overview.ts`
 * query results (unchanged) into the Phase F5 UI Lab's view-model row shapes. Pure — no DB
 * access — so this exact mapping is directly unit-testable without mocking data-fetching.
 *
 * Deliberately deferred, disclosed scope (per `00_AUTHORITY_AND_EXECUTION_CONTRACT.md §4`, "omit
 * unsupported content cleanly, never fabricate it"): `PlayersOverviewInspectorData.effectivePositions`
 * is always `[]` here. Wiring the real `computeEffectivePlayerPositionProfile()` (ADR-0139) into
 * a display-ready `TouchlinePositionMapEntry[]` has no existing production entry point yet
 * (Phase F4's `PlayerPositionMapWidget` only ever took static fixtures) — building that DB-bound
 * wrapper once, shared by Player Detail and this inspector, is separately-scoped follow-up work
 * rather than built twice hastily here. An empty position array is a legitimate "no evidence"
 * state (matching `TouchlinePositionMap`'s own "no support = no dot" rule), not a lie.
 */

export type PlayerIdentityInput = {
  id: string;
  firstName: string;
  lastName: string | null;
  shirtNumber: number | null;
  coreTeamKitColor: string | null;
  /**
   * `Player.primaryPosition` — kept live-synced by the position evolution engine
   * (`sync-effective-position.ts` writes this field directly on every automatic promotion, see
   * ADR-0139), so it already is the "current effective primary position" scalar the contract
   * asks for; only the richer multi-position/support-band visualization needs the fuller
   * `computeEffectivePlayerPositionProfile()` computation this adapter defers (see file doc
   * comment above).
   */
  primaryPosition: string | null;
  /** `Player.currentAvailability` — the same field `PlayerCurrentRoundAttentionRow.availability`
   * itself falls back to when no round-scoped `Availability` row exists (see
   * `getPlayersCurrentRoundAttention()`), so Overview mode's own scan-level availability label
   * uses the identical source, not a second one. */
  currentAvailability: string;
};

function resolvedKitColor(kitColor: string | null): string | null {
  return resolveKitColorSwatch(kitColor)?.hex ?? null;
}

const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  INJURED: "Injured",
  SICK: "Sick",
  AWAY: "Away",
  TENTATIVE: "Tentative",
  UNKNOWN: "Unknown",
};

function availabilityLabel(status: string): string {
  return AVAILABILITY_LABELS[status] ?? status;
}

/** Overview mode's "opportunity this week" reuses the same canonical signal Current Round mode
 * and Round Board already read (`computeRoundPlanIntegrity()`'s `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY`,
 * surfaced here via `IntegrityAttentionState`) — never a second "missing opportunity" rule. */
function hasOpportunityThisWeek(state: IntegrityAttentionState | undefined): boolean | null {
  if (state === undefined || state === "NOT_AVAILABLE") return null;
  return state === "COVERED";
}

export function buildPlayersOverviewRows(
  identities: PlayerIdentityInput[],
  seasonRows: PlayerSeasonOverviewRow[],
  currentRoundRows: PlayerCurrentRoundAttentionRow[],
): PlayersOverviewRow[] {
  const identityById = new Map(identities.map((p) => [p.id, p]));
  const integrityByPlayer = new Map(currentRoundRows.map((r) => [r.playerId, r.integrityState]));

  return seasonRows.map((row): PlayersOverviewRow => {
    const identity = identityById.get(row.playerId);
    const integrityState = integrityByPlayer.get(row.playerId);
    return {
      playerId: row.playerId,
      displayName: row.displayName,
      shirtNumber: identity?.shirtNumber ?? null,
      kitColor: resolvedKitColor(identity?.coreTeamKitColor ?? null),
      coreTeamName: row.coreTeam?.name ?? null,
      currentPrimaryPosition: identity?.primaryPosition ?? null,
      availabilityLabel: availabilityLabel(identity?.currentAvailability ?? "UNKNOWN"),
      hasOpportunityThisWeek: hasOpportunityThisWeek(integrityState),
      played: row.actualAppearances,
      goals: row.goals,
      assists: row.assists,
      core: row.coreAppearances,
      support: row.supportAppearances,
      development: row.developmentAppearances,
      matchdayAdditions: row.matchdayAdditions,
      plannedButAbsent: row.plannedButAbsent,
      attention: integrityState !== undefined && integrityState !== "COVERED" && integrityState !== "NOT_AVAILABLE",
    };
  });
}

export function buildPlayersOverviewInspectorData(
  row: PlayersOverviewRow,
  orgSlugHref: (path: string) => string,
): PlayersOverviewInspectorData {
  return {
    playerId: row.playerId,
    displayName: row.displayName,
    shirtNumber: row.shirtNumber,
    kitColor: row.kitColor,
    currentPrimaryPosition: row.currentPrimaryPosition,
    availabilityLabel: row.availabilityLabel,
    opportunityLabel: row.hasOpportunityThisWeek === null ? "Unavailable this round" : row.hasOpportunityThisWeek ? "Has planned opportunity" : "No planned opportunity",
    effectivePositions: [],
    activeDevelopmentFocus: null,
    latestObservationNote: null,
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
