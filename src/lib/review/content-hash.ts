import { db } from "@/lib/db";
import crypto from "crypto";

export type ReviewTargetType = "EVENT_SQUAD" | "MATCH_LINEUP";

export async function computeTargetContentHash(
  targetType: ReviewTargetType,
  targetId: string,
  organisationId: string,
): Promise<string> {
  if (targetType === "EVENT_SQUAD") {
    return computeEventSquadContentHash(targetId, organisationId);
  }
  if (targetType === "MATCH_LINEUP") {
    return computeMatchLineupContentHash(targetId, organisationId);
  }
  throw new Error(`Unknown review target type: ${targetType}`);
}

async function computeEventSquadContentHash(
  squadId: string,
  organisationId: string,
): Promise<string> {
  const squad = await db.eventSquad.findFirst({
    where: { id: squadId, event: { organisationId } },
    include: {
      players: {
        orderBy: [{ playerId: "asc" }],
        select: {
          playerId: true,
          roleType: true,
          position: true,
          source: true,
          locked: true,
        },
      },
    },
  });

  if (!squad) {
    throw new Error("Event squad not found or access denied.");
  }

  const content = JSON.stringify({
    id: squad.id,
    name: squad.name,
    intent: squad.intent,
    status: squad.status,
    playerIds: squad.players.map((p) => `${p.playerId}:${p.roleType}:${p.position}:${p.source}:${p.locked}`),
  });

  return hashContent(content);
}

async function computeMatchLineupContentHash(
  lineupId: string,
  organisationId: string,
): Promise<string> {
  const lineup = await db.matchLineup.findFirst({
    where: {
      match: { ...({ organisationId } as Record<string, unknown>) },
      id: lineupId,
    },
    include: {
      assignments: {
        orderBy: [{ slotIndex: "asc" }, { playerId: "asc" }],
        select: {
          playerId: true,
          slotIndex: true,
          roleType: true,
          source: true,
        },
      },
    },
  });

  if (!lineup) {
    throw new Error("Match lineup not found or access denied.");
  }

  const content = JSON.stringify({
    id: lineup.id,
    status: lineup.status,
    formationId: lineup.formationId,
    assignments: lineup.assignments.map((a) => `${a.playerId}:${a.slotIndex}:${a.roleType}:${a.source}`),
  });

  return hashContent(content);
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function hasTargetChanged(
  originalRevision: string,
  currentHash: string,
): boolean {
  return originalRevision !== currentHash;
}