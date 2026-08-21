"use server";

import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logEventFinalize, logEventUnfinalize } from "@/lib/security/audit-log";
import {
  validateEventForFinalization,
  validateEventForUnfinalization,
  type EventFinalizationValidationResult,
} from "@/lib/events/event-finalization-validation";

export type FinalizeEventResult = {
  success: boolean;
  error?: string;
  issues?: EventFinalizationValidationResult["issues"];
  finalizedAt?: Date;
};

export type UnfinalizeEventResult = {
  success: boolean;
  error?: string;
};

async function requireEventOrgAccess(eventId: string, orgFilter: { type: string; filter?: Record<string, unknown> }): Promise<void> {
  if (orgFilter.type === "org") {
    const event = await db.event.findFirst({
      where: { id: eventId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!event) throw new Error("Event not found or access denied.");
  } else {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new Error("Event not found.");
  }
}

export async function finalizeEventAction(eventId: string): Promise<FinalizeEventResult> {
  try {
    const ctx = await requirePageActorContext();
    requireMutationRole(ctx);

    await requireEventOrgAccess(eventId, ctx.orgFilter);

    const validation = await validateEventForFinalization(eventId, ctx.orgFilter);

    if (!validation.valid) {
      logEventFinalize(ctx.email || "unknown", eventId, "failure", "Blocking validation issues");
      return {
        success: false,
        error: "Cannot finalize event: blocking issues found.",
        issues: validation.issues,
      };
    }

    const event = await db.event.findFirst({
      where: { id: eventId, ...ctx.orgFilter.filter },
      select: { id: true, status: true },
    });

    if (!event) {
      return { success: false, error: "Event not found." };
    }

    if (event.status === "FINALIZED") {
      return { success: false, error: "Event is already finalized." };
    }

    const now = new Date();

    await db.event.update({
      where: { id: eventId },
      data: {
        status: "FINALIZED",
        finalizedAt: now,
        finalizedBy: ctx.userId,
      },
    });

    logEventFinalize(ctx.email || "unknown", eventId, "success");

    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/o/${ctx.organisationSlug}/events/${eventId}`);

    return {
      success: true,
      finalizedAt: now,
      issues: validation.issues,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

export async function unfinalizeEventAction(eventId: string): Promise<UnfinalizeEventResult> {
  try {
    const ctx = await requirePageActorContext();
    requireMutationRole(ctx);

    await requireEventOrgAccess(eventId, ctx.orgFilter);

    const validation = await validateEventForUnfinalization(eventId, ctx.orgFilter);

    if (!validation.valid) {
      logEventUnfinalize(ctx.email || "unknown", eventId, "failure", validation.issues.map((i) => i.message).join("; "));
      return {
        success: false,
        error: validation.issues.map((i) => i.message).join("; "),
      };
    }

    const event = await db.event.findFirst({
      where: { id: eventId, ...ctx.orgFilter.filter },
      select: { id: true, status: true },
    });

    if (!event) {
      return { success: false, error: "Event not found." };
    }

    if (event.status !== "FINALIZED") {
      return { success: false, error: "Event is not finalized." };
    }

    await db.event.update({
      where: { id: eventId },
      data: {
        status: "DRAFT",
        finalizedAt: null,
        finalizedBy: null,
      },
    });

    logEventUnfinalize(ctx.email || "unknown", eventId, "success");

    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/o/${ctx.organisationSlug}/events/${eventId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

export async function getEventFinalizationStatusAction(eventId: string): Promise<{
  status: string;
  finalizedAt: Date | null;
  finalizedBy: string | null;
}> {
  const ctx = await requirePageActorContext();

  const event = await db.event.findFirst({
    where: { id: eventId, ...ctx.orgFilter.filter },
    select: { id: true, status: true, finalizedAt: true, finalizedBy: true },
  });

  if (!event) {
    return { status: "DRAFT", finalizedAt: null, finalizedBy: null };
  }

  return {
    status: event.status,
    finalizedAt: event.finalizedAt,
    finalizedBy: event.finalizedBy,
  };
}