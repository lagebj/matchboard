import { db } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

type CreateTeamReflectionInput = {
  matchId: string;
  effort?: string | null;
  teamCohesion?: string | null;
  positionalShape?: string | null;
  recoveryBehavior?: string | null;
  note?: string | null;
  recordedBy?: string;
  organisationId: string;
};

type UpdateTeamReflectionInput = {
  effort?: string | null;
  teamCohesion?: string | null;
  positionalShape?: string | null;
  recoveryBehavior?: string | null;
  note?: string | null;
};

export async function createTeamReflection(input: CreateTeamReflectionInput, client?: TransactionClient) {
  const prisma = client ?? db;
  return prisma.teamReflection.create({
    data: {
      organisationId: input.organisationId,
      matchId: input.matchId,
      effort: input.effort,
      teamCohesion: input.teamCohesion,
      positionalShape: input.positionalShape,
      recoveryBehavior: input.recoveryBehavior,
      note: input.note,
      recordedBy: input.recordedBy,
    },
  });
}

export async function updateTeamReflection(id: string, input: UpdateTeamReflectionInput, client?: TransactionClient) {
  const prisma = client ?? db;
  return prisma.teamReflection.update({
    where: { id },
    data: {
      ...(input.effort !== undefined && { effort: input.effort }),
      ...(input.teamCohesion !== undefined && { teamCohesion: input.teamCohesion }),
      ...(input.positionalShape !== undefined && { positionalShape: input.positionalShape }),
      ...(input.recoveryBehavior !== undefined && { recoveryBehavior: input.recoveryBehavior }),
      ...(input.note !== undefined && { note: input.note }),
    },
  });
}

/** The one canonical `TeamReflection` writer (ADR-0152 §3.6 "converge normal writes to one
 * writer") — the standalone Team Reflection form and the guided debrief's submit mapping both
 * call this rather than upserting the model inline. Accepts an optional transaction client so a
 * caller can compose it into a larger transaction (e.g. the debrief's own submit transaction). */
export async function upsertTeamReflection(input: CreateTeamReflectionInput, client?: TransactionClient) {
  const prisma = client ?? db;
  return prisma.teamReflection.upsert({
    where: { matchId: input.matchId },
    create: {
      organisationId: input.organisationId,
      matchId: input.matchId,
      effort: input.effort,
      teamCohesion: input.teamCohesion,
      positionalShape: input.positionalShape,
      recoveryBehavior: input.recoveryBehavior,
      note: input.note,
      recordedBy: input.recordedBy,
    },
    update: {
      ...(input.effort !== undefined && { effort: input.effort }),
      ...(input.teamCohesion !== undefined && { teamCohesion: input.teamCohesion }),
      ...(input.positionalShape !== undefined && { positionalShape: input.positionalShape }),
      ...(input.recoveryBehavior !== undefined && { recoveryBehavior: input.recoveryBehavior }),
      ...(input.note !== undefined && { note: input.note }),
    },
  });
}

export async function getTeamReflection(matchId: string) {
  return db.teamReflection.findFirst({ where: { matchId } });
}

export async function deleteTeamReflection(id: string) {
  return db.teamReflection.delete({ where: { id } });
}
