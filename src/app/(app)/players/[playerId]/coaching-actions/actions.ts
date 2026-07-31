'use server'

import { revalidatePath } from "next/cache";
import { requireCoachAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveOrgFilterForUser, type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  type ReadinessSignalType,
  type ReadinessSignalValue,
  READINESS_SIGNAL_TYPES,
  READINESS_SIGNAL_VALID_VALUES,
} from "@/lib/coaching/types";

export async function setReadinessSignalAction(
  playerId: string,
  signalType: string,
  value: string,
  note: string | null,
): Promise<{ success: boolean; error?: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  if (!READINESS_SIGNAL_TYPES.includes(signalType as ReadinessSignalType)) {
    return { success: false, error: `Invalid readiness signal type: ${signalType}` };
  }

  const validValues = READINESS_SIGNAL_VALID_VALUES[signalType as ReadinessSignalType];
  if (!validValues.includes(value as ReadinessSignalValue)) {
    return { success: false, error: `Invalid value "${value}" for ${signalType}. Valid values: ${validValues.join(", ")}` };
  }

  try {
    const player = await db.player.findFirst({
      where: { id: playerId, removedAt: null, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
      select: { id: true },
    });
    if (!player) return { success: false, error: "Player not found or access denied." };

    await db.playerReadinessSignal.upsert({
      where: {
        playerId_signalType: {
          playerId,
          signalType: signalType as ReadinessSignalType,
        },
      },
      create: {
        playerId,
        signalType: signalType as ReadinessSignalType,
        value: value as ReadinessSignalValue,
        note: note ?? null,
        ...(orgFilter.type === "org" ? { organisationId: orgFilter.organisationId } : {}),
      },
      update: {
        value: value as ReadinessSignalValue,
        note: note ?? null,
      },
    });

    revalidatePath(`/players/${playerId}`);
    revalidatePath(`/players`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to set readiness signal." };
  }
}

export async function deleteReadinessSignalAction(
  playerId: string,
  signalType: string,
): Promise<{ success: boolean; error?: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  try {
    const signal = await db.playerReadinessSignal.findUnique({
      where: {
        playerId_signalType: {
          playerId,
          signalType: signalType as ReadinessSignalType,
        },
      },
    });

    if (!signal) return { success: false, error: "Signal not found." };

    if (orgFilter.type === "org") {
      const player = await db.player.findFirst({
        where: { id: playerId, ...orgFilter.filter },
        select: { id: true },
      });
      if (!player) return { success: false, error: "Signal not found or access denied." };
    }

    await db.playerReadinessSignal.delete({
      where: { id: signal.id },
    });

    revalidatePath(`/players/${playerId}`);
    revalidatePath(`/players`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete readiness signal." };
  }
}

export async function getReadinessSignalsAction(
  playerId: string,
): Promise<{ success: boolean; signals?: Array<{ id: string; signalType: string; value: string; note: string | null }>; error?: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  try {
    const signals = await db.playerReadinessSignal.findMany({
      where: { playerId, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
      orderBy: { signalType: "asc" },
    });

    return {
      success: true,
      signals: signals.map((s) => ({
        id: s.id,
        signalType: s.signalType,
        value: s.value,
        note: s.note,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get readiness signals." };
  }
}