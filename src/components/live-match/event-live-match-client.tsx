"use client";

import { LiveMatchClient } from "@/components/live-match/live-match-client";
import type { LiveMatchActions, SquadPlayer } from "@/components/live-match/live-match-client";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";
import { getEventPeriodConfig } from "@/lib/live-match/period-config";
import {
  startEventLiveSessionAction,
  heartbeatEventAction,
  getRecentEventEventsAction,
  getEventLiveMatchPreMatchPackageAction,
} from "@/app/(app)/events/[eventId]/event-live-actions";
import { endEventLiveSessionAndCreateReportAction } from "@/app/(app)/events/[eventId]/event-live-report-handoff";
import { useLiveRealtime } from "@/components/live-match/use-live-realtime";

interface EventLiveMatchClientProps {
  eventMatchId: string;
  teamName: string;
  opponentName: string;
  eventName: string;
  matchDurationMinutes: number | null;
  numberOfHalves: number;
  breakDurationMinutes?: number | null;
  eventId: string;
}

/**
 * ADR-0138 Bundle 8 — Event now goes through the same Durable Object coordinator League does
 * (closing ARR-0046's "Event has zero coordinator involvement" finding), via the shared
 * `useLiveRealtime(matchId, "EVENT")` hook. `recordEventLiveEventAction`/`recordEventEvent()`
 * (the old direct-HTTP write path with no coordinator-assigned sequence) are removed entirely,
 * not merely superseded — matching League's own Bundle 4 "single mutation path" precedent: the
 * coordinator is now the *only* normal canonical-ordering path for Event too. When the
 * coordinator is unavailable, the command stays in the local outbox and is retried on
 * reconnect, exactly like League — never persisted through an alternate ordering authority.
 */
export function createEventActions(
  eventMatchId: string,
  eventId: string,
  realtime: ReturnType<typeof useLiveRealtime>,
): LiveMatchActions {
  return {
    startSession: async (matchId) => {
      const result = await startEventLiveSessionAction(matchId);
      if (result.success && result.data) {
        realtime.ensureConnected();
        return { success: true, data: { id: result.data.id } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to start session" };
    },
    endSession: async (sessionId) => {
      const result = await endEventLiveSessionAndCreateReportAction(sessionId, eventMatchId);
      realtime.disconnect();
      if (result.success && result.data) {
        return { success: true, data: { reportId: result.data.reportId, reportStatus: result.data.reportStatus } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to end session" };
    },
    heartbeat: async (sessionId) => {
      await heartbeatEventAction(sessionId);
    },
    recordEvent: async (input) => {
      const outcome = await realtime.tryRecordEvent({
        clientEventId: input.clientEventId,
        event: {
          eventType: input.eventType,
          period: input.period,
          matchSeconds: input.matchSeconds,
          playerId: input.playerId,
          secondaryPlayerId: input.secondaryPlayerId,
          payload: input.payload,
          correctionType: input.correctionType,
          correctsEventId: input.correctsEventId,
        },
      });
      if (outcome.result) {
        return { success: true as const, data: { persistenceStatus: outcome.result.persistenceStatus } };
      }
      if (outcome.conflict) {
        return { success: false as const, error: outcome.conflict.message, conflict: outcome.conflict };
      }
      return {
        success: false as const,
        error: "Not connected to live reporting. Saved on this device — will sync automatically once reconnected.",
      };
    },
    onLiveUpdate: realtime.onLiveUpdate,
    onPersistenceChanged: realtime.onPersistenceChanged,
    reconnectRealtime: realtime.reconnectNow,
    getRecentEvents: async (matchId, limit) => {
      const result = await getRecentEventEventsAction(matchId, limit);
      if (result.success && result.data) {
        return { success: true, data: result.data as LiveEventSummary[] };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to get events" };
    },
    getPreMatchPackage: async (matchId) => {
      const result = await getEventLiveMatchPreMatchPackageAction(matchId);
      if (result.success && result.data) {
        return {
          success: true,
          data: {
            squad: result.data.squad as SquadPlayer[],
            activeSession: result.data.activeSession,
          },
        };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to load event match data" };
    },
    reportUrl: (_reportId: string) => `/events/${eventId}`,
  };
}

export function EventLiveMatchClient({ eventMatchId, teamName, opponentName, eventName, matchDurationMinutes, numberOfHalves, breakDurationMinutes, eventId }: EventLiveMatchClientProps) {
  const realtime = useLiveRealtime(eventMatchId, "EVENT");
  const eventActions = createEventActions(eventMatchId, eventId, realtime);

  return (
    <LiveMatchClient
      matchId={eventMatchId}
      teamName={teamName}
      opponentName={opponentName}
      contextLabel={eventName}
      periodConfig={getEventPeriodConfig(matchDurationMinutes, numberOfHalves, breakDurationMinutes ?? null)}
      actions={eventActions}
      markOwnTeam={false}
      subjectType="EVENT"
      eventId={eventId}
    />
  );
}