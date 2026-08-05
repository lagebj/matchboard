"use client";

import { LiveMatchClient } from "@/components/live-match/live-match-client";
import type { LiveMatchActions, SquadPlayer } from "@/components/live-match/live-match-client";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";
import {
  startLiveSessionAction,
  heartbeatAction,
  recordLiveEventAction,
  getRecentEventsAction,
  getLiveMatchPreMatchPackageAction,
} from "@/app/(app)/matches/[matchId]/live/live-actions";
import { endLiveSessionAndCreateReportAction } from "@/app/(app)/matches/[matchId]/live/live-report-handoff";
import { LEAGUE_PERIOD_CONFIG } from "@/lib/live-match/period-config";

interface LiveMatchClientProps {
  matchId: string;
  matchInfo: {
    id: string;
    opponent: string;
    homeAway: string;
    gameFormat: string;
    startsAt: string;
    status: string;
    teamName: string;
    teamId: string;
    roundName: string | null;
  };
  coachId: string;
}

function createLeagueActions(matchId: string): LiveMatchActions {
  return {
    startSession: async (matchId) => {
      const result = await startLiveSessionAction(matchId);
      if (result.success && result.data) {
        return { success: true, data: { id: result.data.id } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to start session" };
    },
    endSession: async (sessionId) => {
      const result = await endLiveSessionAndCreateReportAction(sessionId, matchId);
      if (result.success && result.data) {
        return { success: true, data: { reportId: result.data.reportId, reportStatus: result.data.reportStatus } };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to end session" };
    },
    heartbeat: async (sessionId) => {
      await heartbeatAction(sessionId);
    },
    recordEvent: async (input) => {
      const result = await recordLiveEventAction(input);
      return result;
    },
    getRecentEvents: async (matchId, limit) => {
      const result = await getRecentEventsAction(matchId, limit);
      if (result.success && result.data) {
        return { success: true, data: result.data as LiveEventSummary[] };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to get events" };
    },
    getPreMatchPackage: async (matchId) => {
      const result = await getLiveMatchPreMatchPackageAction(matchId);
      if (result.success && result.data) {
        return {
          success: true,
          data: {
            squad: result.data.squad as SquadPlayer[],
            activeSession: result.data.activeSession,
          },
        };
      }
      return { success: false, error: result.success === false ? result.error : "Failed to load match data" };
    },
    reportUrl: (_reportId: string) => `/matches/${matchId}/post-match`,
  };
}

export function LeagueLiveMatchClient({ matchId, matchInfo, coachId }: LiveMatchClientProps) {
  const leagueActions = createLeagueActions(matchId);

  return (
    <LiveMatchClient
      matchId={matchId}
      teamName={matchInfo.teamName}
      opponentName={matchInfo.opponent}
      contextLabel={matchInfo.roundName}
      periodConfig={LEAGUE_PERIOD_CONFIG}
      actions={leagueActions}
      coachId={coachId}
    />
  );
}