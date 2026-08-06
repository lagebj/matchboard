"use server";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";

export async function getGroupCompositionData(footballGroupId: string) {
  const ctx = await requireActorContext();
  const orgWhere = ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {};

  const group = await db.footballGroup.findUniqueOrThrow({
    where: { id: footballGroupId, ...orgWhere },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const teams = await db.team.findMany({
    where: { footballGroupId, archivedAt: null, ...orgWhere },
    select: { id: true, name: true },
  });

  const playerCount = await db.footballGroupPlayer.count({
    where: {
      footballGroupId,
      status: "ACTIVE",
      membershipType: "PRIMARY",
      player: { active: true, removedAt: null },
    },
  });

  const leagueSeasons = await db.leagueSeason.findMany({
    where: { footballGroupId, ...orgWhere },
    select: { id: true, name: true, status: true },
    orderBy: { startDate: "desc" },
  });

  return {
    group,
    teams,
    playerCount,
    leagueSeasons,
  };
}