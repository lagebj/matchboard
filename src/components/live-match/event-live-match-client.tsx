"use client";

import { LiveMatchClient } from "@/components/live-match/live-match-client";
import type { LiveMatchActions, SquadPlayer } from "@/components/live-match/live-match-client";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";
import { getEventPeriodConfig } from "@/lib/live-match/period-config";
import {
  startEventLiveSessionAction,
  heartbeatEventAction,
  recordEventLiveEventAction,
  getRecentEventEventsAction,
  getEventLiveMatchPreMatchPackageAction,
} from "@/app/(app)/events/[eventId]/event-live-actions";
import { endEventLiveSessionAndCreateReportAction } from "@/app/(app)/events/[eventId]/event-live-report-handoff";

interface EventLiveMatchClientProps {
  eventMatchId: string;
  teamName: string;
  opponentName: string;
  eventName: string;
  matchDurationMinutes: number | null;
  eventId: string;
}

function createEventActions(eventMatchId: string, eventId: string): LiveMatchActions {
  return {
    startSession: async (matchId) => {
      const result = await startEventLiveSessionAction(matchId);
      if (result.success && result.data) {
        return { success: true, data: { id: result.data.id } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to start session" };
    },
    endSession: async (sessionId) => {
      const result = await endEventLiveSessionAndCreateReportAction(sessionId, eventMatchId);
      if (result.success && result.data) {
        return { success: true, data: { reportId: result.data.reportId, reportStatus: result.data.reportStatus } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to end session" };
    },
    heartbeat: async (sessionId) => {
      await heartbeatEventAction(sessionId);
    },
    recordEvent: async (input) => {
      const result = await recordEventLiveEventAction({
        ...input,
        eventMatchId: input.matchId,
      });
      if (result.success && result.data) {
        return { success: true as const, data: { id: result.data.id } };
      }
      return { success: false as const, error: result.success === false ? result.error : "Failed to record event" };
    },
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

export function EventLiveMatchClient({ eventMatchId, teamName, opponentName, eventName, matchDurationMinutes, eventId }: EventLiveMatchClientProps) {
  const eventActions = createEventActions(eventMatchId, eventId);

  return (
    <LiveMatchClient
      matchId={eventMatchId}
      teamName={teamName}
      opponentName={opponentName}
      contextLabel={eventName}
      periodConfig={getEventPeriodConfig(matchDurationMinutes)}
      actions={eventActions}
    />
  );
}