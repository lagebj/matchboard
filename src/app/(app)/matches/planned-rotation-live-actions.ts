"use server";

import { revalidatePath } from "next/cache";
import {
  requirePageActorContext,
  requireMutationRole,
  requireMatchGroupAccess,
  requireMatchGroupMutationRole,
} from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";
import {
  applyPlannedChange,
  skipPlannedChange,
  delayPlannedChange,
  modifyPlannedChange,
  getNextPlannedChange,
  getPlannedChangesForMatch,
} from "@/lib/planned-rotation/planned-rotation-live-bridge";
import { getActiveSession } from "@/lib/live-match/live-match-session";
import { recordEvent, estimateCurrentMatchSeconds } from "@/lib/live-match/live-match-event-store";
import type { PlannedRotationWithChanges } from "@/lib/planned-rotation/planned-rotation";

function revalidateMatchPaths(matchId: string): void {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/o/[orgSlug]/matches/${matchId}`);
}

/**
 * Applying a planned change writes the real actual-timeline event(s) itself via the canonical
 * live-event owner (`recordEvent`), rather than trusting client-fabricated event ids — a prior
 * version had the browser invent placeholder ids (`live-${Date.now()}-out`) with no
 * corresponding LiveMatchEvent ever created, so "Apply" never actually produced actual match
 * truth (see DECISIONS.md "Live execution of plan": "Applying/changing writes normal actual live
 * events"). matchSeconds is estimated server-side (no clock anchor is persisted — see
 * `estimateCurrentMatchSeconds`) since this runs without the client's own live clock state.
 */
export type ApplyPlannedChangeOverrides = {
  /** Swap which named player goes out and which comes in — the bounded "Change" interaction the
   * live prompt currently exposes (see planned-rotation-prompt.tsx). A full arbitrary
   * player/position picker is a reasonable future enhancement; this server action already
   * accepts general overrides so that UI work wouldn't require touching this action again. */
  outPlayerId?: string;
  inPlayerId?: string;
  outPosition?: string | null;
  inPosition?: string | null;
  changedNote?: string;
};

export async function applyPlannedChangeAction(
  rotationId: string,
  changeId: string,
  overrides?: ApplyPlannedChangeOverrides,
): Promise<{ success: true; outEventId: string; inEventId: string | null; changeId: string } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const rotation = await db.plannedRotation.findFirst({
      where: { id: rotationId, organisationId: ctx.organisationId },
      select: {
        matchId: true,
        changes: { where: { id: changeId }, select: { outPlayerId: true, inPlayerId: true, outPosition: true, inPosition: true, positionOnly: true } },
      },
    });
    if (!rotation) return { success: false, error: "Rotation plan not found." };
    const planned = rotation.changes[0];
    if (!planned) return { success: false, error: "Change not found in rotation plan." };

    // Overrides never mutate the original planned record (DECISIONS.md: "Never mutate the
    // original planned timeline to match reality") — they only change what gets executed now.
    const change = {
      outPlayerId: overrides?.outPlayerId ?? planned.outPlayerId,
      inPlayerId: overrides?.inPlayerId ?? planned.inPlayerId,
      outPosition: overrides?.outPosition !== undefined ? overrides.outPosition : planned.outPosition,
      inPosition: overrides?.inPosition !== undefined ? overrides.inPosition : planned.inPosition,
      positionOnly: planned.positionOnly,
    };

    await requireMatchGroupAccess(ctx, rotation.matchId);
    await requireMatchGroupMutationRole(ctx, rotation.matchId);

    const session = await getActiveSession(rotation.matchId);
    if (!session) return { success: false, error: "No active live session for this match." };

    const { matchSeconds, period } = await estimateCurrentMatchSeconds(rotation.matchId, session.id);

    let outEventId: string;
    let inEventId: string | null = null;

    if (change.positionOnly && change.outPlayerId && change.inPlayerId) {
      // A position swap has no meaningful "line up" concept — record each player's own position
      // change via the canonical POSITIONS_CHANGED event type, both at the same estimated time so
      // the swap takes effect atomically (see actual-timeline.ts's position-change handling).
      const outResult = await recordEvent({
        matchId: rotation.matchId,
        sessionId: session.id,
        eventType: "POSITIONS_CHANGED",
        period: period ?? undefined,
        matchSeconds,
        playerId: change.outPlayerId,
        payload: { fromPosition: change.outPosition, toPosition: change.inPosition },
        clientEventId: crypto.randomUUID(),
      });
      const inResult = await recordEvent({
        matchId: rotation.matchId,
        sessionId: session.id,
        eventType: "POSITIONS_CHANGED",
        period: period ?? undefined,
        matchSeconds,
        playerId: change.inPlayerId,
        payload: { fromPosition: change.inPosition, toPosition: change.outPosition },
        clientEventId: crypto.randomUUID(),
      });
      outEventId = outResult.eventId;
      inEventId = inResult.eventId;
    } else {
      if (!change.outPlayerId || !change.inPlayerId) {
        return { success: false, error: "Substitution requires both an outgoing and incoming player." };
      }
      const outResult = await recordEvent({
        matchId: rotation.matchId,
        sessionId: session.id,
        eventType: "ROTATION_OUT",
        period: period ?? undefined,
        matchSeconds,
        playerId: change.outPlayerId,
        clientEventId: crypto.randomUUID(),
      });
      const inResult = await recordEvent({
        matchId: rotation.matchId,
        sessionId: session.id,
        eventType: "ROTATION_IN",
        period: period ?? undefined,
        matchSeconds,
        playerId: change.inPlayerId,
        clientEventId: crypto.randomUUID(),
      });
      outEventId = outResult.eventId;
      inEventId = inResult.eventId;
    }

    const result = await applyPlannedChange(
      rotationId,
      changeId,
      { outEventId, inEventId: inEventId ?? undefined },
      ctx.orgFilter,
      matchSeconds,
    );
    if (!result.success) return result;

    if (overrides?.changedNote) {
      await db.plannedRotationChange.update({
        where: { id: changeId },
        data: { notes: overrides.changedNote },
      });
    }

    revalidateMatchPaths(rotation.matchId);

    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to apply planned change." };
  }
}

export async function skipPlannedChangeAction(
  rotationId: string,
  changeId: string,
): Promise<{ success: true; changeId: string } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const result = await skipPlannedChange(rotationId, changeId, ctx.orgFilter);
    if (!result.success) return result;

    const rotation = await db.plannedRotation.findUnique({ where: { id: rotationId }, select: { matchId: true } });
    if (rotation) revalidateMatchPaths(rotation.matchId);

    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to skip planned change." };
  }
}

export async function delayPlannedChangeAction(
  rotationId: string,
  changeId: string,
): Promise<{ success: true; changeId: string } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const result = await delayPlannedChange(rotationId, changeId, ctx.orgFilter);
    if (!result.success) return result;

    const rotation = await db.plannedRotation.findUnique({ where: { id: rotationId }, select: { matchId: true } });
    if (rotation) revalidateMatchPaths(rotation.matchId);

    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delay planned change." };
  }
}

export async function modifyPlannedChangeAction(
  rotationId: string,
  changeId: string,
  modification: {
    outPlayerId?: string | null;
    inPlayerId?: string | null;
    outPosition?: string | null;
    inPosition?: string | null;
    positionOnly?: boolean;
    approximateMatchSeconds?: number | null;
    notes?: string | null;
    liveEventId?: string;
  },
): Promise<{ success: true; change: PlannedRotationWithChanges["changes"][number] } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const result = await modifyPlannedChange(rotationId, changeId, modification, ctx.orgFilter);
    if (!result.success) return result;

    const rotation = await db.plannedRotation.findUnique({ where: { id: rotationId }, select: { matchId: true } });
    if (rotation) revalidateMatchPaths(rotation.matchId);

    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to modify planned change." };
  }
}

export async function getNextPlannedChangeAction(
  matchId: string,
  teamId: string,
): Promise<{ success: true; change: PlannedRotationWithChanges["changes"][number] | null } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const change = await getNextPlannedChange(matchId, teamId, ctx.orgFilter);
    return { success: true, change };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get next planned change." };
  }
}

export async function getPlannedChangesForMatchAction(
  matchId: string,
  teamId: string,
): Promise<{ success: true; rotation: PlannedRotationWithChanges | null } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const rotation = await getPlannedChangesForMatch(matchId, teamId, ctx.orgFilter);
    return { success: true, rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get planned changes for match." };
  }
}