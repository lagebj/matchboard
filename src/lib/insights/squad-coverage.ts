import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { classifyGKCapability, classifyPosition, computeCoverageWarnings } from "./squad-coverage-helpers";
import type {
  InsightFilters,
  CoverageMatrixEntry,
} from "./insights-types";

export async function getSquadCoverage(
  filters: InsightFilters,
): Promise<CoverageMatrixEntry[]> {
  const ctx = await requireActorContext();
  const orgId = ctx.organisationId;

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId, organisationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const roundIds = rounds.map((r) => r.id);

  const matches = await db.match.findMany({
    where: {
      matchRoundId: { in: roundIds },
      organisationId: orgId,
      status: "SCHEDULED",
    },
    select: {
      id: true,
      matchRoundId: true,
      teamId: true,
      team: { select: { id: true, name: true } },
    },
  });

  const matchIds = matches.map((m) => m.id);

  const selections = await db.selection.findMany({
    where: {
      matchId: { in: matchIds },
      organisationId: orgId,
      status: filters.includeRemoved
        ? { in: ["DRAFT", "FINALIZED"] }
        : "FINALIZED",
    },
    select: {
      playerId: true,
      matchId: true,
      role: true,
      player: {
        select: {
          id: true,
          goalkeeperAbility: true,
          primaryPosition: true,
          secondaryPosition: true,
          tertiaryPosition: true,
        },
      },
    },
  });

  const selectionsByMatch = new Map<string, typeof selections>();
  for (const sel of selections) {
    if (!selectionsByMatch.has(sel.matchId)) {
      selectionsByMatch.set(sel.matchId, []);
    }
    selectionsByMatch.get(sel.matchId)!.push(sel);
  }

  const entries: CoverageMatrixEntry[] = [];

  for (const match of matches) {
    const matchSelections = selectionsByMatch.get(match.id) ?? [];

    let primaryGK = 0;
    const secondaryGK = 0;
    let emergencyGK = 0;
    let defenders = 0;
    let midfielders = 0;
    let attackers = 0;
    let unassigned = 0;

    for (const sel of matchSelections) {
      const gkType = classifyGKCapability(sel.player.goalkeeperAbility);
      if (gkType === "primary") primaryGK++;
      else if (gkType === "emergency") emergencyGK++;

      const posType = classifyPosition(sel.player.primaryPosition);
      if (posType === "defender") defenders++;
      else if (posType === "midfielder") midfielders++;
      else if (posType === "attacker") attackers++;
      else unassigned++;
    }

    const tertiaryGK = matchSelections.length - primaryGK - secondaryGK - emergencyGK;
    const totalGK = primaryGK + secondaryGK + emergencyGK + tertiaryGK;
    const warnings = computeCoverageWarnings({
      totalGK,
      primaryGK,
      secondaryGK,
      emergencyGK,
      defenders,
      midfielders,
      attackers,
    });

    const noGK = totalGK === 0;
    const tertiaryOnlyGK = !noGK && primaryGK === 0 && secondaryGK === 0 && emergencyGK === 0;

    entries.push({
      squadId: match.id,
      squadName: `${match.team.name} squad`,
      teamId: match.teamId,
      teamName: match.team.name,
      matchId: match.id,
      matchRoundId: match.matchRoundId,
      goalkeeperCoverage: {
        primary: primaryGK,
        secondary: secondaryGK,
        tertiary: tertiaryGK,
        emergency: emergencyGK,
        total: totalGK,
        none: noGK,
        tertiaryOnly: tertiaryOnlyGK,
      },
      positionCoverage: {
        defenders,
        midfielders,
        attackers,
        unassigned,
      },
      warnings,
    });
  }

  return entries;
}