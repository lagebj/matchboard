/**
 * Today Matchday data loader (Today Matchday Follow-up bundle, ADR-0143). Combines the
 * already-computed League `TodayMatch[]` with a new, display-date-key-filtered Event-matches-
 * for-today query, adapts both into the shared `TodayFootballMatch` shape, deterministically
 * selects the one featured match (if any), and — only for that single featured match — batch-
 * loads the readiness facts Matchday needs (selected-player availability, lineup existence,
 * match-scoped plan-integrity signals). No other same-day match's readiness is ever loaded,
 * per D3.10's "single-match batched load, not N+1 across all matches."
 */

import { db } from "@/lib/db";
import { getDisplayDateKey } from "@/lib/date-utils";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type { TodayMatch } from "@/lib/assistant/types";
import {
  eventMatchToTodayFootballMatch,
  leagueMatchToTodayFootballMatch,
  selectFeaturedTodayFootballMatch,
  type TodayFootballMatch,
} from "@/lib/touchline/presentation/today-football-match";
import {
  buildSelectedAvailability,
  type TodayMatchdayReadiness,
} from "@/lib/touchline/presentation/today-matchday-readiness";

export type TodayMatchdayContext = {
  featured: TodayFootballMatch;
  readiness: TodayMatchdayReadiness;
} | null;

export async function getTodayFootballMatches(
  orgFilter: OrgFilterMode | undefined,
  todayLeagueMatches: TodayMatch[],
  roundPlanIntegrities: Record<string, RoundPlanIntegrity>,
  orgUrl: (path: string) => string,
): Promise<TodayMatchdayContext> {
  const orgWhere = orgFilter && orgFilter.type === "org" ? orgFilter.filter : {};
  const now = new Date();
  const todayKey = getDisplayDateKey(now);

  // Same widened UTC buffer as the League "today" query (get-assistant-command-centre.ts) — a
  // fixed-buffer safety net, never the precise display-day boundary. The display-date-key filter
  // below is what actually enforces "same Europe/Oslo calendar day" for featured-match eligibility.
  const bufferHours = 4;
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setHours(windowStart.getHours() - bufferHours);
  const windowEnd = new Date(now);
  windowEnd.setHours(23, 59, 59, 999);
  windowEnd.setHours(windowEnd.getHours() + bufferHours);

  const eventMatches = await db.eventMatch.findMany({
    where: {
      startsAt: { gte: windowStart, lte: windowEnd },
      status: { not: "CANCELLED" },
      ...orgWhere,
    },
    select: {
      id: true,
      eventId: true,
      startsAt: true,
      status: true,
      opponentName: true,
      event: { select: { name: true } },
      eventSquad: { select: { name: true } },
      liveSession: { select: { status: true } },
      postMatchReport: { select: { status: true, ourScore: true, opponentScore: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const eventFootballMatches: TodayFootballMatch[] = eventMatches
    .filter((m) => getDisplayDateKey(m.startsAt) === todayKey)
    .map((m) =>
      eventMatchToTodayFootballMatch(
        {
          eventMatchId: m.id,
          eventId: m.eventId,
          eventName: m.event.name,
          squadName: m.eventSquad.name,
          opponentName: m.opponentName,
          startsAt: m.startsAt.toISOString(),
          status: m.status as "SCHEDULED" | "CANCELLED",
          hasActiveLiveSession: m.liveSession?.status === "ACTIVE",
          hasLineup: false,
          reportStatus: (m.postMatchReport?.status as "DRAFT" | "REPORTED" | "LOCKED" | undefined) ?? null,
          score:
            m.postMatchReport?.ourScore != null && m.postMatchReport?.opponentScore != null
              ? { own: m.postMatchReport.ourScore, opponent: m.postMatchReport.opponentScore }
              : null,
        },
        orgUrl,
        now,
      ),
    );

  const leagueFootballMatches: TodayFootballMatch[] = todayLeagueMatches
    .filter((m) => (m.startsAt ? getDisplayDateKey(new Date(m.startsAt)) === todayKey : false))
    .map((m) => leagueMatchToTodayFootballMatch(m, orgUrl));

  const featured = selectFeaturedTodayFootballMatch([...leagueFootballMatches, ...eventFootballMatches]);
  if (!featured) return null;

  const readiness =
    featured.source === "LEAGUE"
      ? await buildLeagueMatchdayReadiness(featured.id, roundPlanIntegrities)
      : await buildEventMatchdayReadiness(featured.id, featured.containerId);

  return { featured, readiness };
}

// `Player.name` does not exist in the schema (first/last only) — mirrors the existing
// `firstName + (lastName ? " " + lastName : "")` convention used across src/lib/insights/*.
function formatPlayerDisplayName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}

async function buildLeagueMatchdayReadiness(
  matchId: string,
  roundPlanIntegrities: Record<string, RoundPlanIntegrity>,
): Promise<TodayMatchdayReadiness> {
  const [selections, lineup] = await Promise.all([
    db.selection.findMany({
      where: { matchId },
      select: {
        status: true,
        matchRoundId: true,
        match: { select: { team: { select: { targetSquadSize: true } } } },
        player: { select: { id: true, firstName: true, lastName: true, currentAvailability: true } },
      },
    }),
    db.matchLineup.findFirst({ where: { matchId }, select: { id: true } }),
  ]);

  const selectionState = selections.some((s) => s.status === "FINALIZED")
    ? "FINALIZED"
    : selections.some((s) => s.status === "DRAFT")
      ? "DRAFT"
      : selections.length > 0
        ? "READY"
        : "NOT_GENERATED";

  const targetCount = selections[0]?.match.team.targetSquadSize ?? null;

  const matchScopedSignals = Object.values(roundPlanIntegrities).flatMap((integrity) =>
    integrity.signals.filter((s) => s.matchId === matchId),
  );

  return {
    selection: { state: selectionState, selectedCount: selections.length, targetCount },
    selectedAvailability: buildSelectedAvailability(
      selections.map((s) => ({
        playerId: s.player.id,
        displayName: formatPlayerDisplayName(s.player.firstName, s.player.lastName),
        availability: s.player.currentAvailability,
      })),
    ),
    lineup: { state: lineup ? "READY" : "MISSING" },
    // No canonical, distinctly-persisted tactics record exists in the domain model today — never
    // fabricate a "ready"/"missing" state where none can be known (D7).
    tactics: { state: "UNKNOWN" },
    plannedRotations: null,
    blockingSignals: matchScopedSignals.filter((s) => s.kind === "BLOCKED"),
    decisionSignals: matchScopedSignals.filter((s) => s.kind === "DECISION_REQUIRED"),
  };
}

async function buildEventMatchdayReadiness(eventMatchId: string, eventId: string): Promise<TodayMatchdayReadiness> {
  const [matchAvailabilities, lineup, squad] = await Promise.all([
    db.eventMatchAvailability.findMany({
      where: { eventMatchId },
      select: {
        player: { select: { id: true, firstName: true, lastName: true } },
        guestPlayer: { select: { id: true, name: true } },
      },
    }),
    db.eventMatchLineup.findFirst({ where: { eventMatchId }, select: { id: true } }),
    db.eventMatch.findUnique({
      where: { id: eventMatchId },
      select: { eventSquad: { select: { targetSize: true } } },
    }),
  ]);

  const selectedPlayerIds = matchAvailabilities.map((a) => a.player?.id).filter((id): id is string => Boolean(id));

  const eventPlayerStatuses =
    selectedPlayerIds.length > 0
      ? await db.eventPlayerAvailability.findMany({
          where: { eventId, playerId: { in: selectedPlayerIds } },
          select: { playerId: true, status: true },
        })
      : [];
  const statusByPlayerId = new Map(eventPlayerStatuses.map((s) => [s.playerId, s.status]));

  // Events have no doubtful/tentative availability tier (D3.14) — only AVAILABLE maps as
  // available, WITHDRAWN/UNAVAILABLE map as unavailable, everything else (including guest
  // players, who have no EventPlayerAvailability row) is UNKNOWN rather than a fabricated guess.
  const selectedPlayers = matchAvailabilities.map((a) => {
    const status = a.player ? (statusByPlayerId.get(a.player.id) ?? "UNKNOWN") : "UNKNOWN";
    const availability =
      status === "AVAILABLE" ? "AVAILABLE" : status === "UNAVAILABLE" || status === "WITHDRAWN" ? "UNAVAILABLE" : "UNKNOWN";
    return {
      playerId: a.player?.id ?? a.guestPlayer!.id,
      displayName: a.player ? formatPlayerDisplayName(a.player.firstName, a.player.lastName) : a.guestPlayer!.name,
      availability,
    };
  });

  return {
    selection: {
      state: matchAvailabilities.length > 0 ? "READY" : "NOT_GENERATED",
      selectedCount: matchAvailabilities.length,
      targetCount: squad?.eventSquad.targetSize ?? null,
    },
    selectedAvailability: buildSelectedAvailability(selectedPlayers),
    lineup: { state: lineup ? "READY" : "MISSING" },
    tactics: { state: "UNKNOWN" },
    plannedRotations: null,
    // Events have no canonical round-scoped plan-integrity computation (D3.14) — omitted, not
    // fabricated.
    blockingSignals: [],
    decisionSignals: [],
  };
}
