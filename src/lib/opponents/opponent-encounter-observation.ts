/**
 * The one canonical writer for `OpponentEncounterObservation` (ADR-0152 §3.6: "converge normal
 * writes to one writer so duplication stops"). Both the standalone opponent-observation form
 * (`observation-actions.ts`, which always supplies every field) and the guided debrief's submit
 * mapping (which only ever supplies `factualSummary`) call this — neither upserts the model
 * inline anymore. Every field but the three identity fields is optional so a partial caller like
 * the debrief can never clobber fields it doesn't know about on an existing row — only `create`
 * needs a default for an omitted field, matching the column's own schema default.
 */

import "server-only";

import { db } from "@/lib/db";
import { MatchEnvironmentObservation, OpponentConcernCategory, OpponentObservationFollowUp, type PrismaClient } from "@/generated/prisma/client";
import type { PlayingStyleTag } from "./playing-style-tags";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export type UpsertOpponentEncounterObservationInput = {
  organisationId: string;
  matchId: string;
  opponentTeamId: string;
  overallEnvironment?: MatchEnvironmentObservation;
  opponentPlayersContext?: MatchEnvironmentObservation;
  opponentStaffContext?: MatchEnvironmentObservation;
  spectatorSidelineContext?: MatchEnvironmentObservation;
  concernCategories?: OpponentConcernCategory[];
  playingStyleTags?: PlayingStyleTag[];
  factualSummary?: string | null;
  followUp?: OpponentObservationFollowUp;
  recordedBy?: string | null;
};

export async function upsertOpponentEncounterObservation(input: UpsertOpponentEncounterObservationInput, client?: TransactionClient) {
  const prisma = client ?? db;
  const existing = await prisma.opponentEncounterObservation.findFirst({
    where: { matchId: input.matchId, organisationId: input.organisationId },
    select: { id: true },
  });

  // Only the fields this caller actually supplied — a caller that only knows about
  // `factualSummary` (the debrief) must never overwrite `overallEnvironment`/`concernCategories`/
  // `playingStyleTags`/`followUp` a fuller caller (the standalone form) already set.
  const providedFields = {
    ...(input.overallEnvironment !== undefined && { overallEnvironment: input.overallEnvironment }),
    ...(input.opponentPlayersContext !== undefined && { opponentPlayersContext: input.opponentPlayersContext }),
    ...(input.opponentStaffContext !== undefined && { opponentStaffContext: input.opponentStaffContext }),
    ...(input.spectatorSidelineContext !== undefined && { spectatorSidelineContext: input.spectatorSidelineContext }),
    ...(input.concernCategories !== undefined && { concernCategories: input.concernCategories }),
    ...(input.playingStyleTags !== undefined && { playingStyleTags: input.playingStyleTags }),
    ...(input.factualSummary !== undefined && { factualSummary: input.factualSummary }),
    ...(input.followUp !== undefined && { followUp: input.followUp }),
    ...(input.recordedBy !== undefined && { recordedBy: input.recordedBy }),
  };

  if (existing) {
    return prisma.opponentEncounterObservation.update({ where: { id: existing.id }, data: providedFields });
  }

  return prisma.opponentEncounterObservation.create({
    data: {
      matchId: input.matchId,
      opponentTeamId: input.opponentTeamId,
      organisationId: input.organisationId,
      overallEnvironment: input.overallEnvironment ?? "NOT_ASSESSED",
      opponentPlayersContext: input.opponentPlayersContext ?? "NOT_ASSESSED",
      opponentStaffContext: input.opponentStaffContext ?? "NOT_ASSESSED",
      spectatorSidelineContext: input.spectatorSidelineContext ?? "NOT_ASSESSED",
      concernCategories: input.concernCategories ?? [],
      playingStyleTags: input.playingStyleTags ?? [],
      factualSummary: input.factualSummary ?? null,
      followUp: input.followUp ?? "NONE",
      recordedBy: input.recordedBy ?? null,
    },
  });
}

export async function getOpponentEncounterObservation(matchId: string, organisationId: string) {
  return db.opponentEncounterObservation.findFirst({ where: { matchId, organisationId } });
}
