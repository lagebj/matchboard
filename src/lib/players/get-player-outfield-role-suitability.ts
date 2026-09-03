import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { mapPositionCodeToBroad } from "@/domain/team-composition/position-suitability";
import {
  computeOutfieldRoleSuitabilityProfile,
  computeTacticalFunctionProfile,
  type DeclaredBroadPositions,
} from "@/domain/team-composition/outfield-role-evidence";
import type {
  BroadPosition,
  OutfieldPositionExposureEvidence,
  OutfieldRoleSuitabilityResult,
  OutfieldStructuralRole,
  TacticalFunctionFit,
} from "@/domain/team-composition/team-composition-types";
import { BROAD_POSITION_TO_STRUCTURAL_ROLE } from "@/domain/team-composition/team-composition-types";
import { getPositionExposure } from "@/lib/insights/position-exposure";
import { resolveActiveLeagueSeason } from "@/app/(app)/o/[orgSlug]/rounds/build-round-item";

export interface PlayerOutfieldRoleSuitabilitySummary {
  playerId: string;
  /** Which league season's Position & Formation Exposure evidence backed this summary, or null
   * when the player's group has no league season at all (declared-position fit still applies). */
  leagueSeasonId: string | null;
  leagueSeasonLabel: string | null;
  outfieldRoles: OutfieldRoleSuitabilityResult[];
  tacticalFunctions: TacticalFunctionFit[];
}

/**
 * Evidence-Informed Match Planning, Bundle 5 (ADR-0116). Combines the player's declared
 * primary/secondary/tertiary position (via the shared mapPositionCodeToBroad() owner) with the
 * existing I-004 Position & Formation Exposure evidence (getPositionExposure()) into one
 * coach-facing outfield-role-suitability + tactical-function-fit summary.
 *
 * Read-only and additive: never mutates Player.primaryPosition/secondaryPosition/tertiaryPosition
 * (the existing position-evidence mechanism remains the sole owner of that persistent mutation —
 * AGENTS.md "Long-term position loop" / D-010).
 */
export async function getPlayerOutfieldRoleSuitability(
  playerId: string,
): Promise<PlayerOutfieldRoleSuitabilitySummary | null> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const orgId = ctx.organisationId;

  const player = await db.player.findFirst({
    where: { id: playerId, organisationId: orgId },
    select: {
      id: true,
      primaryPosition: true,
      secondaryPosition: true,
      tertiaryPosition: true,
      coreTeam: { select: { footballGroupId: true } },
      ballControl: true,
      passing: true,
      firstTouch: true,
      oneVOneAttacking: true,
      positioning: true,
      oneVOneDefending: true,
      decisionMaking: true,
      effort: true,
      teamplay: true,
      concentration: true,
      speed: true,
      strength: true,
    },
  });
  if (!player) return null;

  const declaredPositions: DeclaredBroadPositions = {
    primary: mapPositionCodeToBroad(player.primaryPosition ?? "") as BroadPosition,
    secondary: player.secondaryPosition ? (mapPositionCodeToBroad(player.secondaryPosition) as BroadPosition) : undefined,
    tertiary: player.tertiaryPosition ? (mapPositionCodeToBroad(player.tertiaryPosition) as BroadPosition) : undefined,
  };

  const { leagueSeasonId, leagueSeasonLabel, exposure } = await resolveExposureEvidence(
    playerId,
    player.coreTeam?.footballGroupId ?? null,
    orgId,
  );

  const outfieldRoles = computeOutfieldRoleSuitabilityProfile(declaredPositions, exposure);
  const tacticalFunctions = computeTacticalFunctionProfile(
    {
      ballControl: player.ballControl,
      passing: player.passing,
      firstTouch: player.firstTouch,
      oneVOneAttacking: player.oneVOneAttacking,
      positioning: player.positioning,
      oneVOneDefending: player.oneVOneDefending,
      decisionMaking: player.decisionMaking,
      effort: player.effort,
      teamplay: player.teamplay,
      concentration: player.concentration,
      speed: player.speed,
      strength: player.strength,
    },
    outfieldRoles,
  );

  return { playerId, leagueSeasonId, leagueSeasonLabel, outfieldRoles, tacticalFunctions };
}

async function resolveExposureEvidence(
  playerId: string,
  footballGroupId: string | null,
  organisationId: string,
): Promise<{ leagueSeasonId: string | null; leagueSeasonLabel: string | null; exposure: OutfieldPositionExposureEvidence }> {
  const noEvidence: OutfieldPositionExposureEvidence = { matchCountByRole: {} };
  if (!footballGroupId) return { leagueSeasonId: null, leagueSeasonLabel: null, exposure: noEvidence };

  const seasons = await db.leagueSeason.findMany({
    where: { footballGroupId, organisationId },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  const activeSeason = resolveActiveLeagueSeason(seasons, new Date());
  if (!activeSeason) return { leagueSeasonId: null, leagueSeasonLabel: null, exposure: noEvidence };

  const rows = await getPositionExposure({
    leagueSeasonId: activeSeason.id,
    scope: "full_year",
    context: "league",
    includeInactive: true,
  });
  const row = rows.find((r) => r.playerId === playerId);
  const exposure = row ? summarizeExposureByOutfieldRole(row.realisedPositions) : noEvidence;

  return { leagueSeasonId: activeSeason.id, leagueSeasonLabel: activeSeason.name, exposure };
}

/** Exported for reuse by the Bundle 8 integrated starting-lineup generator
 * (integrated-match-plan-actions.ts), which needs the identical realised-position -> outfield-role
 * summarisation for a whole squad at once rather than one player at a time. */
export function summarizeExposureByOutfieldRole(realisedPositions: Record<string, number>): OutfieldPositionExposureEvidence {
  const matchCountByRole: Partial<Record<OutfieldStructuralRole, number>> = {};
  for (const [label, count] of Object.entries(realisedPositions)) {
    const broad = mapPositionCodeToBroad(label) as BroadPosition;
    if (broad === "goalkeeper") continue; // Goalkeeper boundary: GK exposure never feeds outfield role evidence.
    const role = BROAD_POSITION_TO_STRUCTURAL_ROLE[broad] as OutfieldStructuralRole;
    matchCountByRole[role] = (matchCountByRole[role] ?? 0) + count;
  }
  return { matchCountByRole };
}
