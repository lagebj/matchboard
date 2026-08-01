"use client";

import type { LocalEvent } from "./live-local-store";
import {
  saveEventLocally,
  markEventSynced,
  getUnsyncedEvents,
  clearLocalEvents,
  clearLocalSession,
} from "./live-local-store";
import { recordLiveEventAction } from "@/app/(app)/matches/[matchId]/live/live-actions";

let syncInProgress = false;

export async function syncEventToServer(
  matchId: string,
  sessionId: string,
  event: LocalEvent,
): Promise<boolean> {
  try {
    const result = await recordLiveEventAction({
      matchId,
      sessionId,
      eventType: event.eventType,
      period: event.period,
      matchSeconds: event.matchSeconds,
      playerId: event.playerId,
      secondaryPlayerId: event.secondaryPlayerId,
      payload: event.payload,
      clientEventId: event.clientEventId,
      correctionType: event.correctionType,
      correctsEventId: event.correctsEventId,
    });

    if (result.success) {
      await markEventSynced(event.clientEventId);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function syncAllUnsyncedEvents(
  matchId: string,
  sessionId: string,
): Promise<{ synced: number; failed: number }> {
  if (syncInProgress) return { synced: 0, failed: 0 };
  syncInProgress = true;

  let synced = 0;
  let failed = 0;

  try {
    const unsynced = await getUnsyncedEvents(matchId);

    for (const event of unsynced) {
      const success = await syncEventToServer(matchId, sessionId, event);
      if (success) {
        synced++;
      } else {
        failed++;
        break;
      }
    }
  } finally {
    syncInProgress = false;
  }

  return { synced, failed };
}

export async function recordEventLocallyFirst(
  matchId: string,
  sessionId: string,
  event: Omit<LocalEvent, "synced" | "createdAt">,
): Promise<LocalEvent> {
  const localEvent: LocalEvent = {
    ...event,
    synced: false,
    createdAt: Date.now(),
  };

  await saveEventLocally(localEvent);

  syncEventToServer(matchId, sessionId, localEvent).catch(() => {});

  return localEvent;
}

export async function cleanupAfterSessionEnd(matchId: string): Promise<void> {
  await clearLocalEvents(matchId);
  await clearLocalSession(matchId);
}