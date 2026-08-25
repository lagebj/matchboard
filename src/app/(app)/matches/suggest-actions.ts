"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { suggestFormationForMatch, suggestLineupForFormation, type SuggestFormationInput, type SuggestLineupInput } from "@/lib/formations/suggest";
import { createFormationSnapshot } from "@/lib/formations/snapshot";
import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

type PlayerPoolEntry = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  coreTeamId: string | null;
  coreTeamName?: string;
  isHelper?: boolean;
};

const NEUTRAL_POSITION = "FLEX";

async function getPlayerPoolWithHelpers(matchId: string, _orgFilter: OrgFilterMode): Promise<PlayerPoolEntry[]> {
  const [selections, helpers] = await Promise.all([
    db.selection.findMany({
      where: { matchId, status: { in: ["DRAFT", "FINALIZED"] } },
      select: {
        playerId: true,
        role: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
            secondaryPosition: true,
            coreTeamId: true,
            coreTeam: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.matchHelperAssignment.findMany({
      where: { matchId },
      select: {
        playerId: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
            secondaryPosition: true,
            coreTeamId: true,
            coreTeam: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const pool: PlayerPoolEntry[] = selections.map((s) => ({
    id: s.player.id,
    firstName: s.player.firstName,
    lastName: s.player.lastName,
    primaryPosition: s.player.primaryPosition ?? NEUTRAL_POSITION,
    secondaryPosition: s.player.secondaryPosition,
    coreTeamId: s.player.coreTeamId,
    coreTeamName: s.player.coreTeam?.name ?? undefined,
    isHelper: false,
  }));

  for (const h of helpers) {
    pool.push({
      id: h.player.id,
      firstName: h.player.firstName,
      lastName: h.player.lastName,
      primaryPosition: h.player.primaryPosition ?? NEUTRAL_POSITION,
      secondaryPosition: h.player.secondaryPosition,
      coreTeamId: h.player.coreTeamId,
      coreTeamName: h.player.coreTeam?.name ?? undefined,
      isHelper: true,
    });
  }

  return pool;
}

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!match) throw new Error("Match not found or access denied.");
}

async function requireLineupOrgAccess(lineupId: string, orgFilter: OrgFilterMode): Promise<{ matchId: string }> {
  const lineup = await db.matchLineup.findFirst({
    where: { id: lineupId, ...orgFilter.filter },
    select: { matchId: true },
  });
  if (!lineup) throw new Error("Lineup not found or access denied.");
  return { matchId: lineup.matchId };
}

export async function getSuggestFormationData(matchId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireMatchOrgAccess(matchId, ctx.orgFilter);

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
    select: {
      id: true,
      teamId: true,
      gameFormat: true,
      team: { select: { id: true, name: true } },
    },
  });

  if (!match) throw new Error("Match not found");

  const [formations, recentLineup, playerPool] = await Promise.all([
    db.formation.findMany({
      where: { gameFormat: match.gameFormat as GameFormat, isArchived: false, ...ctx.orgFilter.filter },
      include: { slots: { orderBy: { sortOrder: "asc" } } },
    }),
    db.matchLineup.findFirst({
      where: { teamId: match.teamId, status: "CONFIRMED", ...ctx.orgFilter.filter },
      orderBy: { createdAt: "desc" },
      select: { formationId: true },
    }),
    getPlayerPoolWithHelpers(matchId, ctx.orgFilter),
  ]);

  const formationData: SuggestFormationInput["formations"] = formations.map((f) => ({
    id: f.id,
    name: f.name,
    gameFormat: f.gameFormat as GameFormat,
    source: f.source as "SYSTEM" | "CUSTOM",
    teamId: f.teamId,
    slots: f.slots.map((s) => ({
      id: s.id,
      gridX: s.gridX,
      gridY: s.gridY,
      label: s.label,
      shortLabel: s.shortLabel,
      roleType: s.roleType as FormationSlotRoleType,
      acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
      sortOrder: s.sortOrder,
    })),
  }));

  const suggestion = suggestFormationForMatch({
    gameFormat: match.gameFormat as GameFormat,
    playerPool,
    teamId: match.teamId,
    recentFormationId: recentLineup?.formationId ?? null,
    formations: formationData,
  });

  return {
    match: { id: match.id, teamId: match.teamId, teamName: match.team.name, gameFormat: match.gameFormat },
    playerPool,
    formations: formationData,
    suggestion,
  };
}

export async function getSuggestLineupData(matchId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireMatchOrgAccess(matchId, ctx.orgFilter);

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
    select: {
      id: true,
      teamId: true,
      gameFormat: true,
      team: { select: { id: true, name: true } },
    },
  });

  if (!match) throw new Error("Match not found");

  const [lineup, playerPool] = await Promise.all([
    db.matchLineup.findFirst({
      where: { matchId, teamId: match.teamId, ...ctx.orgFilter.filter },
      include: {
        formation: { include: { slots: { orderBy: { sortOrder: "asc" } } } },
        assignments: true,
      },
    }),
    getPlayerPoolWithHelpers(matchId, ctx.orgFilter),
  ]);

  return { match, lineup, playerPool };
}

export async function suggestLineupForMatch(matchId: string, formationId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireMatchOrgAccess(matchId, ctx.orgFilter);

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
    select: {
      id: true,
      teamId: true,
      gameFormat: true,
    },
  });

  if (!match) throw new Error("Match not found");

  const [formation, existingLineup, playerPool] = await Promise.all([
    db.formation.findFirst({
      where: { id: formationId, ...ctx.orgFilter.filter },
      include: { slots: { orderBy: { sortOrder: "asc" } } },
    }),
    db.matchLineup.findFirst({
      where: { matchId, teamId: match.teamId, ...ctx.orgFilter.filter },
      include: { assignments: true },
    }),
    getPlayerPoolWithHelpers(matchId, ctx.orgFilter),
  ]);

  if (!formation) throw new Error("Formation not found");

  let existingAssignments: SuggestLineupInput["existingAssignments"] = [];

  if (existingLineup) {
    existingAssignments = existingLineup.assignments
      .filter((a) => a.playerId !== null && a.locked)
      .map((a) => ({
        slotId: a.slotId,
        playerId: a.playerId!,
        locked: a.locked,
      }));
  }

  const suggestion = suggestLineupForFormation({
    formationSlots: formation.slots.map((s) => ({
      id: s.id,
      gridX: s.gridX,
      gridY: s.gridY,
      label: s.label,
      shortLabel: s.shortLabel,
      roleType: s.roleType as FormationSlotRoleType,
      acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
      sortOrder: s.sortOrder,
    })),
    playerPool,
    existingAssignments,
  });

  return suggestion;
}

export async function applySuggestedLineup(
  matchId: string,
  formationId: string,
  assignments: { slotId: string; playerId: string; source: "SUGGESTED" | "MANUAL" }[],
  benchPlayerIds: string[],
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireMatchOrgAccess(matchId, ctx.orgFilter);
  await requireMatchGroupAccess(ctx, matchId);

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
  });
  if (!match) throw new Error("Match not found");

  const formation = await db.formation.findFirst({
    where: { id: formationId, ...ctx.orgFilter.filter },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  if (!formation) throw new Error("Formation not found");

  const existing = await db.matchLineup.findFirst({
    where: { matchId, teamId: match.teamId, ...ctx.orgFilter.filter },
  });

  if (existing) {
    if (existing.status === "CONFIRMED") {
      throw new Error("Cannot modify a confirmed lineup");
    }

    const snapshot = createFormationSnapshot(
      formation.id,
      formation.name,
      formation.gameFormat as GameFormat,
      formation.slots.map((s) => ({
        id: s.id,
        gridX: s.gridX,
        gridY: s.gridY,
        label: s.label,
        shortLabel: s.shortLabel,
        roleType: s.roleType as FormationSlotRoleType,
        acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
        sortOrder: s.sortOrder,
      })),
    );

    await db.matchLineup.update({
      where: { id: existing.id },
      data: {
        formationId,
        formationSnapshot: snapshot,
        benchPlayerIds,
        status: "DRAFT",
        assignments: {
          deleteMany: {},
          create: formation.slots.map((slot) => {
            const assignment = assignments.find((a) => a.slotId === slot.id);
            return {
              slotId: slot.id,
              playerId: assignment?.playerId ?? null,
              locked: false,
              source: (assignment?.source ?? "MANUAL") as "SUGGESTED" | "MANUAL",
            };
          }),
        },
      },
    });

    revalidatePath(`/matches/${matchId}`);
    return { success: true };
  }

  const snapshot = createFormationSnapshot(
    formation.id,
    formation.name,
    formation.gameFormat as GameFormat,
    formation.slots.map((s) => ({
      id: s.id,
      gridX: s.gridX,
      gridY: s.gridY,
      label: s.label,
      shortLabel: s.shortLabel,
      roleType: s.roleType as FormationSlotRoleType,
      acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
      sortOrder: s.sortOrder,
    })),
  );

  await db.matchLineup.create({
    data: {
      matchId,
      teamId: match.teamId,
      formationId,
      formationSnapshot: snapshot,
      benchPlayerIds,
      status: "DRAFT",
      organisationId: ctx.organisationId,
      assignments: {
        create: formation.slots.map((slot) => {
          const assignment = assignments.find((a) => a.slotId === slot.id);
          return {
            slotId: slot.id,
            playerId: assignment?.playerId ?? null,
            locked: false,
            source: (assignment?.source ?? "MANUAL") as "SUGGESTED" | "MANUAL",
            organisationId: ctx.organisationId,
          };
        }),
      },
    },
  });

  revalidatePath(`/matches/${matchId}`);
  return { success: true };
}

export async function clearSuggestedAssignments(lineupId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const { matchId } = await requireLineupOrgAccess(lineupId, ctx.orgFilter);
  await requireMatchGroupAccess(ctx, matchId);

  const lineup = await db.matchLineup.findFirst({
    where: { id: lineupId, ...ctx.orgFilter.filter },
    include: { assignments: true },
  });

  if (!lineup) throw new Error("Lineup not found");
  if (lineup.status === "CONFIRMED") {
    throw new Error("Cannot modify a confirmed lineup");
  }

  await db.matchLineupAssignment.updateMany({
    where: {
      matchLineupId: lineupId,
      locked: false,
      source: "SUGGESTED",
    },
    data: { playerId: null },
  });

  revalidatePath(`/matches/${lineup.matchId}`);
  return { success: true };
}

export async function fillEmptySlots(lineupId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const { matchId } = await requireLineupOrgAccess(lineupId, ctx.orgFilter);
  await requireMatchGroupAccess(ctx, matchId);

  const lineup = await db.matchLineup.findFirst({
    where: { id: lineupId, ...ctx.orgFilter.filter },
    include: {
      formation: { include: { slots: { orderBy: { sortOrder: "asc" } } } },
      assignments: true,
    },
  });

  if (!lineup) throw new Error("Lineup not found");
  if (!lineup.formation) throw new Error("Formation not found on lineup");
  if (lineup.status === "CONFIRMED") {
    throw new Error("Cannot modify a confirmed lineup");
  }

  const match = await db.match.findFirst({
    where: { id: lineup.matchId, ...ctx.orgFilter.filter },
    select: {
      gameFormat: true,
    },
  });

  if (!match) throw new Error("Match not found");

  const fullPool = await getPlayerPoolWithHelpers(lineup.matchId, ctx.orgFilter);

  const emptySlots = lineup.assignments.filter((a) => a.playerId === null);
  if (emptySlots.length === 0) return { filled: 0 };

  const assignedPlayerIds = new Set(
    lineup.assignments.filter((a) => a.playerId !== null).map((a) => a.playerId!),
  );

  const availablePlayers = fullPool.filter((p) => !assignedPlayerIds.has(p.id));

  const suggestion = suggestLineupForFormation({
    formationSlots: lineup.formation.slots.map((s) => ({
      id: s.id,
      gridX: s.gridX,
      gridY: s.gridY,
      label: s.label,
      shortLabel: s.shortLabel,
      roleType: s.roleType as FormationSlotRoleType,
      acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
      sortOrder: s.sortOrder,
    })),
    playerPool: availablePlayers.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName ?? "",
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      coreTeamId: p.coreTeamId,
    })),
    existingAssignments: lineup.assignments
      .filter((a) => a.playerId !== null && a.locked)
      .map((a) => ({ slotId: a.slotId, playerId: a.playerId!, locked: a.locked })),
  });

  let filled = 0;
  for (const assignment of suggestion.assignments) {
    const existingAssignment = lineup.assignments.find((a) => a.slotId === assignment.slotId);
    if (existingAssignment && !existingAssignment.playerId) {
      await db.matchLineupAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          playerId: assignment.playerId,
          source: "SUGGESTED",
        },
      });
      filled++;
    }
  }

  if (suggestion.benchPlayerIds.length > 0) {
    await db.matchLineup.update({
      where: { id: lineupId },
      data: { benchPlayerIds: suggestion.benchPlayerIds },
    });
  }

  revalidatePath(`/matches/${lineup.matchId}`);
  return { filled };
}