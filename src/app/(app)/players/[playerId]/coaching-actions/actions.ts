'use server'

import { revalidatePath } from "next/cache";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  if (!READINESS_SIGNAL_TYPES.includes(signalType as ReadinessSignalType)) {
    return { success: false, error: `Invalid readiness signal type: ${signalType}` };
  }

  const validValues = READINESS_SIGNAL_VALID_VALUES[signalType as ReadinessSignalType];
  if (!validValues.includes(value as ReadinessSignalValue)) {
    return { success: false, error: `Invalid value "${value}" for ${signalType}. Valid values: ${validValues.join(", ")}` };
  }

  try {
    const player = await db.player.findFirst({
      where: { id: playerId, removedAt: null, ...(ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {}) },
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
        ...(ctx.orgFilter.type === "org" ? { organisationId: ctx.orgFilter.organisationId } : {}),
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

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

    if (ctx.orgFilter.type === "org") {
      const player = await db.player.findFirst({
        where: { id: playerId, ...ctx.orgFilter.filter },
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
  const ctx = await requireActorContext();

  try {
    const signals = await db.playerReadinessSignal.findMany({
      where: { playerId, ...(ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {}) },
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