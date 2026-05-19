import { db } from "@/lib/db";

type CreateTeamReflectionInput = {
  matchId: string;
  effort?: string;
  teamCohesion?: string;
  positionalShape?: string;
  recoveryBehavior?: string;
  note?: string;
  recordedBy?: string;
};

type UpdateTeamReflectionInput = {
  effort?: string;
  teamCohesion?: string;
  positionalShape?: string;
  recoveryBehavior?: string;
  note?: string;
};

export async function createTeamReflection(input: CreateTeamReflectionInput) {
  return db.teamReflection.create({
    data: {
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

export async function updateTeamReflection(id: string, input: UpdateTeamReflectionInput) {
  return db.teamReflection.update({
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

export async function upsertTeamReflection(input: CreateTeamReflectionInput) {
  return db.teamReflection.upsert({
    where: { matchId: input.matchId },
    create: {
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
  return db.teamReflection.findUnique({ where: { matchId } });
}

export async function deleteTeamReflection(id: string) {
  return db.teamReflection.delete({ where: { id } });
}