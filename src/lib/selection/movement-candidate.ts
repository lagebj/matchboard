import { db } from "@/lib/db";
import type { MovementCandidateRole, MovementCandidateStatus, MovementCandidateRationale } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export type CreateMovementCandidateInput = {
  playerId: string;
  rotationPathId: string;
  role: MovementCandidateRole;
  rationaleCategory: MovementCandidateRationale;
  rationaleNote?: string | null;
  reviewBy?: Date | null;
  organisationId: string;
};

export type UpdateMovementCandidateInput = {
  rationaleCategory?: MovementCandidateRationale;
  rationaleNote?: string | null;
  reviewBy?: Date | null;
  status?: MovementCandidateStatus;
};

export type MovementCandidateSummary = {
  id: string;
  playerId: string;
  playerFirstName: string;
  playerLastName: string | null;
  coreTeamId: string;
  coreTeamName: string;
  rotationPathId: string;
  role: MovementCandidateRole;
  status: MovementCandidateStatus;
  activeFrom: Date;
  reviewBy: Date | null;
  rationaleCategory: MovementCandidateRationale;
  rationaleNote: string | null;
  lastUsed: Date | null;
  movementCountInPeriod: number;
  targetTeamId: string;
  targetTeamName: string;
};

export type MovementCandidateDriftSignal = {
  candidateId: string;
  playerId: string;
  playerFirstName: string;
  playerLastName: string | null;
  category: string;
  message: string;
};

const VALID_RATIONALE_CATEGORIES: MovementCandidateRationale[] = [
  "CHALLENGE_EXPOSURE",
  "CONFIDENCE_AND_INVOLVEMENT",
  "STABILISE_TEAM_FUNCTION",
  "SUPPORT_TEAMMATES",
  "POSITIONAL_LEARNING",
  "RESET_AND_RESPONSIBILITY",
  "COACH_JUDGEMENT",
];

export async function validateCandidateCreation(input: CreateMovementCandidateInput): Promise<{ valid: boolean; error?: string }> {
  if (!VALID_RATIONALE_CATEGORIES.includes(input.rationaleCategory as MovementCandidateRationale)) {
    return { valid: false, error: `Invalid rationale category: ${input.rationaleCategory}.` };
  }

  const player = await db.player.findFirst({
    where: { id: input.playerId },
    select: { id: true, coreTeamId: true, nonRotatable: true, active: true, removedAt: true },
  });

  if (!player || player.removedAt || !player.active) {
    return { valid: false, error: "Player not found or inactive." };
  }

  if (player.nonRotatable) {
    return { valid: false, error: "Player is marked non-rotatable and cannot be a movement candidate." };
  }

  const rotationPath = await db.rotationPath.findFirst({
    where: { id: input.rotationPathId },
    select: { id: true, fromTeamId: true, toTeamId: true, role: true, active: true },
  });

  if (!rotationPath) {
    return { valid: false, error: "Rotation path not found." };
  }

  if (!rotationPath.active) {
    return { valid: false, error: "Cannot create candidate for inactive rotation path." };
  }

  if (player.coreTeamId !== rotationPath.fromTeamId) {
    return { valid: false, error: "Player must belong to the rotation path source team." };
  }

  if (!roleMatchesPathRole(input.role, rotationPath.role)) {
    return { valid: false, error: `Candidate role ${input.role} does not match rotation path role ${rotationPath.role}.` };
  }

  const existing = await db.movementCandidate.findFirst({
    where: {
      playerId: input.playerId,
      rotationPathId: input.rotationPathId,
      role: input.role,
    },
  });

  if (existing) {
    return { valid: false, error: "A movement candidate already exists for this player, path, and role combination." };
  }

  return { valid: true };
}

function roleMatchesPathRole(candidateRole: MovementCandidateRole, pathRole: string): boolean {
  if (candidateRole === pathRole) return true;
  if (candidateRole === "SUPPORT" && pathRole === "BACKFILL") return true;
  if (candidateRole === "DEVELOPMENT" && pathRole === "CONFIDENCE_REBUILD") return true;
  return false;
}

export async function createMovementCandidate(input: CreateMovementCandidateInput) {
  const validation = await validateCandidateCreation(input);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
      const candidate = await db.movementCandidate.create({
        data: {
          organisationId: input.organisationId,
          playerId: input.playerId,
        rotationPathId: input.rotationPathId,
        role: input.role,
        status: "ACTIVE",
          rationaleCategory: input.rationaleCategory,
          rationaleNote: input.rationaleNote ?? null,
          reviewBy: input.reviewBy ?? null,
        },
    });

    return { success: true, candidate };
  } catch (e) {
    return { success: false, error: `Failed to create movement candidate: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function updateMovementCandidate(candidateId: string, input: UpdateMovementCandidateInput) {
  const candidate = await db.movementCandidate.findFirst({
    where: { id: candidateId },
  });

  if (!candidate) {
    return { success: false, error: "Movement candidate not found." };
  }

  if (input.status === "ACTIVE" && candidate.status === "PAUSED") {
    const rotationPath = await db.rotationPath.findFirst({
      where: { id: candidate.rotationPathId },
      select: { active: true },
    });
    if (rotationPath && !rotationPath.active) {
      return { success: false, error: "Cannot reactivate candidate for inactive rotation path." };
    }
  }

  try {
    const updated = await db.movementCandidate.update({
      where: { id: candidateId },
      data: {
        ...(input.status && { status: input.status }),
        ...(input.rationaleCategory && { rationaleCategory: input.rationaleCategory }),
        ...(input.rationaleNote !== undefined && { rationaleNote: input.rationaleNote }),
        ...(input.reviewBy !== undefined && { reviewBy: input.reviewBy }),
      },
    });

    return { success: true, candidate: updated };
  } catch (e) {
    return { success: false, error: `Failed to update movement candidate: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function deleteMovementCandidate(candidateId: string) {
  const candidate = await db.movementCandidate.findFirst({
    where: { id: candidateId },
  });

  if (!candidate) {
    return { success: false, error: "Movement candidate not found." };
  }

  await db.movementCandidate.delete({
    where: { id: candidateId },
  });

  return { success: true };
}

export async function getIncomingCandidatesForTeam(teamId: string, orgFilter?: OrgFilterMode): Promise<MovementCandidateSummary[]> {
  const orgWhere = orgFilter?.type === "org" ? orgFilter.filter : {};
  const paths = await db.rotationPath.findMany({
    where: { toTeamId: teamId, active: true, ...orgWhere },
    select: { id: true },
  });

  if (paths.length === 0) return [];

  const pathIds = paths.map((p) => p.id);

  const candidates = await db.movementCandidate.findMany({
    where: {
      rotationPathId: { in: pathIds },
      ...orgWhere,
    },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          coreTeamId: true,
          coreTeam: { select: { id: true, name: true } },
        },
      },
      rotationPath: {
        select: {
          id: true,
          fromTeamId: true,
          toTeamId: true,
          toTeam: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return candidates.map(formatCandidateSummary);
}

export async function getOutgoingCandidatesForTeam(teamId: string, orgFilter?: OrgFilterMode): Promise<MovementCandidateSummary[]> {
  const orgWhere = orgFilter?.type === "org" ? orgFilter.filter : {};
  const paths = await db.rotationPath.findMany({
    where: { fromTeamId: teamId, active: true, ...orgWhere },
    select: { id: true },
  });

  if (paths.length === 0) return [];

  const pathIds = paths.map((p) => p.id);

  const candidates = await db.movementCandidate.findMany({
    where: {
      rotationPathId: { in: pathIds },
      ...orgWhere,
    },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          coreTeamId: true,
          coreTeam: { select: { id: true, name: true } },
        },
      },
      rotationPath: {
        select: {
          id: true,
          fromTeamId: true,
          toTeamId: true,
          toTeam: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return candidates.map(formatCandidateSummary);
}

function formatCandidateSummary(
  c: Awaited<ReturnType<typeof db.movementCandidate.findMany>>[number] & {
    player: { id: string; firstName: string; lastName: string | null; coreTeamId: string | null; coreTeam: { id: string; name: string } | null };
    rotationPath: { id: string; fromTeamId: string; toTeamId: string; toTeam: { id: string; name: string } };
  },
): MovementCandidateSummary {
  return {
    id: c.id,
    playerId: c.player.id,
    playerFirstName: c.player.firstName,
    playerLastName: c.player.lastName,
    coreTeamId: c.player.coreTeamId ?? "",
    coreTeamName: c.player.coreTeam?.name ?? "Unassigned",
    rotationPathId: c.rotationPathId,
    role: c.role as MovementCandidateRole,
    status: c.status as MovementCandidateStatus,
    activeFrom: c.activeFrom,
    reviewBy: c.reviewBy,
    rationaleCategory: c.rationaleCategory as MovementCandidateRationale,
    rationaleNote: c.rationaleNote,
    lastUsed: null,
    movementCountInPeriod: 0,
    targetTeamId: c.rotationPath.toTeamId,
    targetTeamName: c.rotationPath.toTeam.name,
  };
}

export async function getActiveMovementCandidatesForPath(
  rotationPathId: string,
  role: MovementCandidateRole,
): Promise<Array<{ playerId: string; id: string }>> {
  return db.movementCandidate.findMany({
    where: {
      rotationPathId,
      role,
      status: "ACTIVE",
    },
    select: { playerId: true, id: true },
  });
}

export async function isPlayerActiveCandidate(
  playerId: string,
  rotationPathId: string,
  role: MovementCandidateRole,
): Promise<boolean> {
  const count = await db.movementCandidate.count({
    where: {
      playerId,
      rotationPathId,
      role,
      status: "ACTIVE",
    },
  });
  return count > 0;
}

export async function enrichCandidatesWithMovementHistory(
  candidates: MovementCandidateSummary[],
  leagueSeasonId: string,
): Promise<MovementCandidateSummary[]> {
  if (candidates.length === 0) return candidates;

  const playerIds = [...new Set(candidates.map((c) => c.playerId))];

  const movements = await db.movementLedger.findMany({
    where: {
      playerId: { in: playerIds },
      matchRound: { leagueSeasonId },
    },
    select: {
      playerId: true,
      toTeamId: true,
      isDraft: false,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const movementByPlayer = new Map<string, { lastUsed: Date; count: number }>();
  for (const m of movements) {
    const existing = movementByPlayer.get(m.playerId);
    if (existing) {
      existing.count += 1;
      if (m.createdAt > existing.lastUsed) {
        existing.lastUsed = m.createdAt;
      }
    } else {
      movementByPlayer.set(m.playerId, { lastUsed: m.createdAt, count: 1 });
    }
  }

  return candidates.map((c) => {
    const history = movementByPlayer.get(c.playerId);
    if (!history) return c;
    return {
      ...c,
      lastUsed: history.lastUsed,
      movementCountInPeriod: history.count,
    };
  });
}