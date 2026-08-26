'use server'

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { createFootballObservations, getFootballObservationsForMatch } from "@/lib/evidence/football-observation-service";
import type { FootballObservationCode, ObservationPolarity } from "@/lib/evidence/observation-vocabulary";
import { isValidObservationCode } from "@/lib/evidence/observation-vocabulary";

export type SaveFootballObservationsResult = {
  success: boolean;
  error?: string;
  created?: number;
  errors?: Array<{ playerId: string; observationCode: string; error: string }>;
};

export async function saveFootballObservationsAction(
  matchId: string,
  observations: Array<{
    playerId: string;
    observationCode: string;
    polarity: string;
    note?: string;
  }>,
): Promise<SaveFootballObservationsResult> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  if (!matchId) {
    return { success: false, error: "Match ID is required." };
  }

  if (!observations || observations.length === 0) {
    return { success: false, error: "No observations provided." };
  }

  for (const obs of observations) {
    if (!isValidObservationCode(obs.observationCode as FootballObservationCode)) {
      return { success: false, error: `Invalid observation code: ${obs.observationCode}` };
    }
    if (obs.polarity !== "POSITIVE" && obs.polarity !== "NEGATIVE") {
      return { success: false, error: `Invalid polarity: ${obs.polarity}` };
    }
  }

  const inputs = observations.map((obs) => ({
    playerId: obs.playerId,
    matchId,
    observationCode: obs.observationCode as FootballObservationCode,
    polarity: obs.polarity as ObservationPolarity,
    note: obs.note || undefined,
  }));

  try {
    const result = await createFootballObservations(inputs);

    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/post-match`);

    for (const obs of observations) {
      revalidatePath(`/players/${obs.playerId}`);
    }

    if (result.errors.length > 0) {
      return {
        success: false,
        error: result.errors.map((e) => `${e.observationCode}: ${e.error}`).join("; "),
        created: result.created,
        errors: result.errors,
      };
    }

    return { success: true, created: result.created };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save observations.",
    };
  }
}

export type GetFootballObservationsResult = {
  success: boolean;
  observations?: Array<{
    id: string;
    playerId: string;
    observationCode: string;
    polarity: string;
    note: string | null;
    observedAt: string;
  }>;
  error?: string;
};

export async function getFootballObservationsAction(
  matchId: string,
): Promise<GetFootballObservationsResult> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  if (!matchId) {
    return { success: false, error: "Match ID is required." };
  }

  try {
    const observations = await getFootballObservationsForMatch(matchId);

    return {
      success: true,
      observations: observations.map((o) => ({
        id: o.id,
        playerId: o.playerId,
        observationCode: o.observationCode,
        polarity: o.polarity,
        note: o.note,
        observedAt: o.observedAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get observations.",
    };
  }
}