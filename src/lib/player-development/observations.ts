import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { DevelopmentObservationSource } from "@/generated/prisma/client";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { RATING_ATTRIBUTE_KEYS, type DevelopmentAttributeKey } from "./constants";

export type DevelopmentObservationInput = {
  playerId: string;
  sourceType?: "LEAGUE_MATCH" | "EVENT_MATCH";
  matchId: string;
  kind: "ATTRIBUTE" | "POSITION";
  attributeKey?: string;
  positionId?: string;
  direction: "POSITIVE" | "NEGATIVE";
  observableNote?: string;
};

const DISALLOWED_PATTERNS = [
  /\b(lazy|selfish|bad attitude|weak player|not good enough|useless|problem player)\b/i,
  /\b(racist|sexist|homophobic|abusive)\b/i,
];

function validateObservableNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const trimmed = note.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) {
    throw new Error("Observable note must be 500 characters or fewer");
  }
  for (const pattern of DISALLOWED_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error("Observable note contains disallowed language. Use observable behavior descriptions instead.");
    }
  }
  return trimmed;
}

function validateAttributeKey(key: string | null | undefined, kind: string): string | null {
  if (kind !== "ATTRIBUTE") return null;
  if (!key) throw new Error("Attribute key is required for ATTRIBUTE observations");
  if (!RATING_ATTRIBUTE_KEYS.includes(key as DevelopmentAttributeKey)) {
    throw new Error(`Invalid attribute key: ${key}`);
  }
  return key;
}

function validatePositionId(positionId: string | null | undefined, kind: string): string | null {
  if (kind !== "POSITION") return null;
  if (!positionId) throw new Error("Position ID is required for POSITION observations");
  return positionId;
}

export async function createDevelopmentObservation(
  input: DevelopmentObservationInput,
): Promise<{ id: string }> {
  const ctx = await requireActorContext();

  if (ctx.orgFilter.type !== "org") {
    throw new Error("Organisation access required");
  }

  const kind = input.kind;
  const attributeKey = validateAttributeKey(input.attributeKey, input.kind);
  const positionId = validatePositionId(input.positionId, input.kind);
  const observableNote = validateObservableNote(input.observableNote);
  const sourceType = input.sourceType ?? DevelopmentObservationSource.LEAGUE_MATCH;

  const player = await db.player.findFirst({
    where: {
      id: input.playerId,
      ...ctx.orgFilter.filter,
    },
  });

  if (!player) {
    throw new Error("Player not found or access denied");
  }

  const match = await db.match.findFirst({
    where: {
      id: input.matchId,
      ...ctx.orgFilter.filter,
    },
    select: { id: true },
  });

  if (!match) {
    throw new Error("Match not found or access denied");
  }

  const actualParticipant = await db.postMatchPlayerActual.findFirst({
    where: {
      matchId: input.matchId,
      playerId: input.playerId,
      attendanceStatus: "PRESENT",
    },
  });

  if (!actualParticipant) {
    throw new Error("Player must be an actual participant in the match to record a development observation");
  }

  const observation = await db.playerDevelopmentObservation.create({
    data: {
      organisationId: ctx.organisationId,
      playerId: input.playerId,
      sourceType,
      matchId: input.matchId,
  kind: input.kind,
  attributeKey,
      positionId,
      direction: input.direction,
      observableNote,
      observedAt: new Date(),
      recordedBy: ctx.userId,
    },
  });

  return { id: observation.id };
}

export async function deleteDevelopmentObservation(
  observationId: string,
): Promise<{ success: boolean }> {
  const ctx = await requireActorContext();

  if (ctx.orgFilter.type !== "org") {
    throw new Error("Organisation access required");
  }

  const observation = await db.playerDevelopmentObservation.findUnique({
    where: { id: observationId },
  });

  if (!observation || observation.organisationId !== ctx.organisationId) {
    throw new Error("Observation not found or access denied");
  }

  await db.playerDevelopmentObservation.delete({ where: { id: observationId } });
  return { success: true };
}

export async function getDevelopmentObservationsForPlayer(
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<Prisma.PlayerDevelopmentObservationGetPayload<{}>[]> {
  if (orgFilter.type !== "org") return [];

  return db.playerDevelopmentObservation.findMany({
    where: {
      playerId,
      ...orgFilter.filter,
    },
    orderBy: { observedAt: "desc" },
  });
}

export async function getDevelopmentObservationsForMatch(
  matchId: string,
  orgFilter: OrgFilterMode,
): Promise<Prisma.PlayerDevelopmentObservationGetPayload<{}>[]> {
  if (orgFilter.type !== "org") return [];

  return db.playerDevelopmentObservation.findMany({
    where: {
      matchId,
      ...orgFilter.filter,
    },
    orderBy: { observedAt: "desc" },
  });
}