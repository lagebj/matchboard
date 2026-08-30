import type { AssistantCommandCentre } from "@/lib/assistant/types";
import type { CoachDecisionCandidate, DecisionCandidateProvider } from "../situation-types";

/**
 * Detects a stalled live-reporting session: an ACTIVE `LiveMatchSession` whose client hasn't sent
 * a heartbeat recently enough to still be trusted as "someone is actively reporting". The live
 * client heartbeats every 30 seconds while its tab is open (`live-match-client.tsx`); a gap of
 * `STALE_HEARTBEAT_MINUTES` or more means the browser tab was closed, lost connectivity, or the
 * coach otherwise walked away from live reporting without ending the session — a real, previously
 * unsurfaced coach-facing signal (no `AssistantWorkItem` category and no UI covered this before).
 *
 * Takes already-computed `AssistantCommandCentre.activeLiveSessions`/`todayMatches` rather than
 * querying `LiveMatchSession` itself — the caller already paid for that query once.
 */
export const LIVE_SESSION_CANDIDATE_PROVIDER_ID = "live-session-heartbeat";

/** ~20x the client's own 30s heartbeat interval — long enough to rule out ordinary network
 * jitter or a brief backgrounded tab, short enough to still be an actionable Matchday signal. */
export const STALE_HEARTBEAT_MINUTES = 10;

/** Inverse of the id format below — lets a caller map a `CoachDecision.candidateId` back to the
 * originating matchId without duplicating the id format elsewhere. */
export function matchIdFromCandidateId(candidateId: string): string | null {
  const prefix = `${LIVE_SESSION_CANDIDATE_PROVIDER_ID}|`;
  return candidateId.startsWith(prefix) ? candidateId.slice(prefix.length) : null;
}

function minutesSince(iso: string, nowMs: number): number {
  return (nowMs - new Date(iso).getTime()) / 60_000;
}

export function staleLiveSessionsToCandidates(
  activeLiveSessions: AssistantCommandCentre["activeLiveSessions"],
  todayMatches: AssistantCommandCentre["todayMatches"],
  nowIso: string,
): CoachDecisionCandidate[] {
  const nowMs = new Date(nowIso).getTime();
  const matchesById = new Map(todayMatches.map((m) => [m.matchId, m]));
  const candidates: CoachDecisionCandidate[] = [];

  for (const [matchId, session] of Object.entries(activeLiveSessions)) {
    const lastSignalAt = session.lastHeartbeatAt ?? session.startedAt;
    if (minutesSince(lastSignalAt, nowMs) < STALE_HEARTBEAT_MINUTES) continue;

    const match = matchesById.get(matchId);
    const title = match
      ? `Live session stalled: ${match.teamName} ${match.homeAway === "HOME" ? "vs" : "@"} ${match.opponent}`
      : "Live session stalled";

    candidates.push({
      id: `${LIVE_SESSION_CANDIDATE_PROVIDER_ID}|${matchId}`,
      source: LIVE_SESSION_CANDIDATE_PROVIDER_ID,
      entityType: "MATCH",
      entityId: matchId,
      title,
      summary: "A live reporting session is marked active but hasn't checked in recently. Confirm reporting is still happening, or end the session.",
      facts: [
        { code: "MINUTES_SINCE_LAST_HEARTBEAT", numericValue: Math.round(minutesSince(lastSignalAt, nowMs)) },
      ],
      consequences: ["REPORTING_DEBT"],
      affectedMatchIds: [matchId],
      affectedTeamIds: [],
      affectedPlayerIds: [],
      recommendedAction: { label: "Open live match", href: `/matches/${matchId}/live` },
      alternativeActions: [],
      defaultDeepLink: `/matches/${matchId}/live`,
      sourceConfidence: "HIGH",
      isLongTermSignal: false,
      affectsNextRoundDecision: false,
      requiresReview: false,
    });
  }

  return candidates;
}

export function createLiveSessionCandidateProvider(
  activeLiveSessions: AssistantCommandCentre["activeLiveSessions"],
  todayMatches: AssistantCommandCentre["todayMatches"],
  nowIso: string,
): DecisionCandidateProvider {
  return {
    id: LIVE_SESSION_CANDIDATE_PROVIDER_ID,
    getCandidates: () => staleLiveSessionsToCandidates(activeLiveSessions, todayMatches, nowIso),
  };
}
