"use client";

import { LiveMatchClient } from "@/components/live-match/live-match-client";
import type { LiveMatchActions, SquadPlayer } from "@/components/live-match/live-match-client";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";
import { getEventPeriodConfig } from "@/lib/live-match/period-config";
import {
  startEventLiveSessionAction,
  endEventLiveSessionAction,
  heartbeatEventAction,
  recordEventLiveEventAction,
  getRecentEventEventsAction,
  getEventLiveMatchPreMatchPackageAction,
} from "@/app/(app)/events/[eventId]/event-live-actions";

interface EventLiveMatchClientProps {
  eventMatchId: string;
  teamName: string;
  opponentName: string;
  eventName: string;
  matchDurationMinutes: number | null;
  coachId: string;
}

function createEventActions(): LiveMatchActions {
  return {
    startSession: async (matchId) => {
      const result = await startEventLiveSessionAction(matchId);
      if (result.success && result.data) {
        return { success: true, data: { id: result.data.id } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to start session" };
    },
    endSession: async (sessionId) => {
      const result = await endEventLiveSessionAction(sessionId);
      if (result.success) {
        return { success: true };
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
      return result;
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
  };
}

const eventActions = createEventActions();

export function EventLiveMatchClient({ eventMatchId, teamName, opponentName, eventName, matchDurationMinutes, coachId }: EventLiveMatchClientProps) {
  const periodConfig = getEventPeriodConfig(matchDurationMinutes);

  return (
    <LiveMatchClient
      matchId={eventMatchId}
      teamName={teamName}
      opponentName={opponentName}
      contextLabel={eventName}
      periodConfig={periodConfig}
      actions={eventActions}
      coachId={coachId}
    />
  );
}