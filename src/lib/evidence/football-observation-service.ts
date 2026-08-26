import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import type { FootballObservationCode, ObservationPolarity } from "./observation-vocabulary";
import { isValidObservationCode, ALL_OBSERVATION_CODES } from "./observation-vocabulary";

export type FootballObservationInput = {
  playerId: string;
  matchId: string;
  observationCode: FootballObservationCode;
  polarity: ObservationPolarity;
  note?: string;
};

export type BatchObservationResult = {
  created: number;
  errors: Array<{ playerId: string; observationCode: string; error: string }>;
};

const DISALLOWED_NOTE_PATTERNS = [
  /\b(lazy|selfish|bad attitude|weak player|not good enough|useless|problem player)\b/i,
  /\b(racist|sexist|homophobic|abusive)\b/i,
];

function validateNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const trimmed = note.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) {
    throw new Error("Note must be 500 characters or fewer");
  }
  for (const pattern of DISALLOWED_NOTE_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error("Note contains disallowed language. Use observable behavior descriptions instead.");
    }
  }
  return trimmed;
}

export async function createFootballObservations(
  inputs: FootballObservationInput[],
): Promise<BatchObservationResult> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const created: string[] = [];
  const errors: BatchObservationResult["errors"] = [];

  for (const input of inputs) {
    try {
      if (!isValidObservationCode(input.observationCode)) {
        throw new Error(`Invalid observation code: ${input.observationCode}`);
      }

      if (input.polarity !== "POSITIVE" && input.polarity !== "NEGATIVE") {
        throw new Error(`Invalid polarity: ${input.polarity}`);
      }

      const note = validateNote(input.note ?? null);

      const player = await db.player.findFirst({
        where: {
          id: input.playerId,
          organisationId: ctx.organisationId,
          active: true,
          removedAt: null,
        },
        select: { id: true },
      });

      if (!player) {
        throw new Error("Player not found, not active, or access denied");
      }

      const match = await db.match.findFirst({
        where: {
          id: input.matchId,
          organisationId: ctx.organisationId,
        },
        select: { id: true },
      });

      if (!match) {
        throw new Error("Match not found or access denied");
      }

      const observation = await db.playerDevelopmentObservation.create({
        data: {
          organisationId: ctx.organisationId,
          playerId: input.playerId,
          sourceType: "LEAGUE_MATCH",
          matchId: input.matchId,
          kind: "ATTRIBUTE",
          attributeKey: input.observationCode,
          direction: input.polarity,
          observableNote: note,
          observedAt: new Date(),
          recordedBy: ctx.userId,
        },
      });

      created.push(observation.id);
    } catch (err) {
      errors.push({
        playerId: input.playerId,
        observationCode: input.observationCode,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { created: created.length, errors };
}

export async function getFootballObservationsForPlayer(
  playerId: string,
): Promise<Array<{
  id: string;
  observationCode: string;
  polarity: string;
  matchId: string;
  note: string | null;
  observedAt: Date;
}>> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const observations = await db.playerDevelopmentObservation.findMany({
    where: {
      playerId,
      organisationId: ctx.organisationId,
      kind: "ATTRIBUTE",
      attributeKey: { in: [...ALL_OBSERVATION_CODES] },
    },
    orderBy: { observedAt: "desc" },
    select: {
      id: true,
      attributeKey: true,
      direction: true,
      matchId: true,
      observableNote: true,
      observedAt: true,
    },
  });

  return observations.map((o) => ({
    id: o.id,
    observationCode: o.attributeKey ?? "",
    polarity: o.direction,
    matchId: o.matchId,
    note: o.observableNote,
    observedAt: o.observedAt,
  }));
}

export async function getFootballObservationsForMatch(
  matchId: string,
): Promise<Array<{
  id: string;
  playerId: string;
  observationCode: string;
  polarity: string;
  note: string | null;
  observedAt: Date;
}>> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const observations = await db.playerDevelopmentObservation.findMany({
    where: {
      matchId,
      organisationId: ctx.organisationId,
      kind: "ATTRIBUTE",
      attributeKey: { in: [...ALL_OBSERVATION_CODES] },
    },
    orderBy: { observedAt: "desc" },
    select: {
      id: true,
      playerId: true,
      attributeKey: true,
      direction: true,
      observableNote: true,
      observedAt: true,
    },
  });

  return observations.map((o) => ({
    id: o.id,
    playerId: o.playerId,
    observationCode: o.attributeKey ?? "",
    polarity: o.direction,
    note: o.observableNote,
    observedAt: o.observedAt,
  }));
}