import { db } from "@/lib/db";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { hasLeagueMatchPassed } from "@/lib/match-date-utils";
import type {
  AssistantCommandCentre,
  AssistantWorkCategory,
  AssistantWorkItem,
} from "./types";
import { CATEGORY_PRIORITY } from "./types";
import { getEventWorkItems } from "./get-event-work-items";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export async function getAssistantCommandCentre(orgFilter?: OrgFilterMode): Promise<AssistantCommandCentre> {
  const orgWhere = orgFilter && orgFilter.type === "org" ? orgFilter.filter : {};

  const leagueSeason = await db.leagueSeason.findFirst({
    where: { ...orgWhere },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, status: true },
  });

  if (!leagueSeason) {
    return emptyResult(null, null, [
      makeItem({
        category: "setup_missing",
        matchRoundId: "none",
        title: "No league season exists",
        summary: "Create a league season to get started.",
        primaryActionLabel: "Create league season",
        primaryActionHref: "/season/new",
        affectedTeamIds: [],
        affectedPlayerIds: [],
      }),
    ]);
  }

  const teamCount = await db.team.count({ where: { ...orgWhere } });
  if (teamCount === 0) {
    return emptyResult(leagueSeason.id, leagueSeason.name, [
      makeItem({
        category: "setup_missing",
        matchRoundId: "none",
        title: "No teams exist",
        summary: "Add at least one team to start planning.",
        primaryActionLabel: "Create team",
        primaryActionHref: "/teams/new",
        affectedTeamIds: [],
        affectedPlayerIds: [],
      }),
    ]);
  }

  const playerCount = await db.player.count({ where: { removedAt: null, ...orgWhere } });
  if (playerCount === 0) {
    return emptyResult(leagueSeason.id, leagueSeason.name, [
      makeItem({
        category: "setup_missing",
        matchRoundId: "none",
        title: "No players exist",
        summary: "Add players to your teams before generating squads.",
        primaryActionLabel: "Create player",
        primaryActionHref: "/players/new",
        affectedTeamIds: [],
        affectedPlayerIds: [],
      }),
    ]);
  }

  const matchCount = await db.match.count({
    where: { matchRound: { leagueSeasonId: leagueSeason.id }, ...orgWhere },
  });
  if (matchCount === 0) {
    return emptyResult(leagueSeason.id, leagueSeason.name, [
      makeItem({
        category: "setup_missing",
        matchRoundId: "none",
        title: "No matches exist",
        summary: "Add matches before generating squads.",
        primaryActionLabel: "Create match",
        primaryActionHref: "/matches/new",
        affectedTeamIds: [],
        affectedPlayerIds: [],
      }),
    ]);
  }

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: leagueSeason.id, ...orgWhere },
    orderBy: { name: "asc" },
    include: {
      matches: {
        select: {
          id: true,
          teamId: true,
          status: true,
          startsAt: true,
        },
      },
      selections: {
        where: { status: "DRAFT" },
        select: { id: true },
        take: 1,
      },
    },
  });

  const finalizedMatchIds = rounds
    .filter((r) => r.status === "FINALIZED")
    .flatMap((r) => r.matches.map((m) => m.id));

  const reportStatuses = finalizedMatchIds.length > 0
    ? new Map(
        (await db.postMatchReport.findMany({
          where: { matchId: { in: finalizedMatchIds } },
          select: { matchId: true, status: true, playerActuals: { select: { attendanceStatus: true } } },
        })).map((r) => [r.matchId, r]),
      )
    : new Map<string, { matchId: string; status: string; playerActuals: { attendanceStatus: string }[] }>();

  const existingReports = new Set(reportStatuses.keys());

  const items: AssistantWorkItem[] = [];

  if (leagueSeason.status === "FINALIZED") {
    const upcomingLeagueSeason = await db.leagueSeason.findFirst({
      where: { ...orgWhere, status: "OPEN", startDate: { gt: leagueSeason.startDate } },
      select: { id: true },
    });
    if (!upcomingLeagueSeason) {
      items.push(
        makeItem({
          category: "setup_missing",
          matchRoundId: "none",
          title: "League season finalised — create next season",
          summary: "The current league season is finalised. Create the next league season to continue planning.",
          primaryActionLabel: "Create league season",
          primaryActionHref: "/season/new",
          affectedTeamIds: [],
          affectedPlayerIds: [],
        }),
      );
    }
  }

  let hasUngenerated = false;

  for (const round of rounds) {
    // The persisted status is only ever DRAFT or FINALIZED (Phase 11 Sec68, ADR-0083) — whether
    // anything has actually been generated is a separate, live signal. A DRAFT round with zero
    // draft selections is NOT_GENERATED; previously this compared round.status directly against
    // "NOT_GENERATED", which the database never actually stores, so this branch never fired and
    // an ungenerated round fell through to the live-integrity branch below and was incorrectly
    // recommended as "Ready to finalize."
    const hasDraftSelections = round.selections.length > 0;

    if (round.status === "DRAFT" && !hasDraftSelections) {
      if (!hasUngenerated) {
        items.push(
          makeItem({
            category: "populate_needed",
            matchRoundId: round.id,
            title: `${round.name} — Generate draft squads`,
            summary: "Rounds exist but no selections have been generated yet.",
            primaryActionLabel: "View Fixtures",
            primaryActionHref: "/fixtures",
            affectedTeamIds: [],
            affectedPlayerIds: [],
          }),
        );
        hasUngenerated = true;
      } else {
        items.push(
          makeItem({
            category: "upcoming_round",
            matchRoundId: round.id,
            title: `${round.name} — Not generated`,
            summary: "Upcoming round. Drafts will be generated with populate all.",
            primaryActionLabel: "View Fixtures",
            primaryActionHref: "/fixtures",
            affectedTeamIds: [],
            affectedPlayerIds: [],
          }),
        );
      }
      continue;
    }

    if (round.status === "DRAFT") {
      const integrity = await computeRoundPlanIntegrity(round.id);
      const blockedSignals = integrity.signals.filter(
        (s) => s.kind === "BLOCKED",
      );
      const decisionSignals = integrity.signals.filter(
        (s) => s.kind === "DECISION_REQUIRED",
      );

      if (blockedSignals.length > 0) {
        const teamIds = [
          ...new Set(blockedSignals.map((s) => s.teamId).filter(Boolean)),
        ] as string[];
        const playerIds = [
          ...new Set(blockedSignals.map((s) => s.playerId).filter(Boolean)),
        ] as string[];

        items.push(
          makeItem({
            category: "blocked_round",
            matchRoundId: round.id,
            blockedCount: blockedSignals.length,
            title: `${round.name} — ${blockedSignals.length} blocked condition${blockedSignals.length !== 1 ? "s" : ""}`,
            summary: blockedSignals
              .map((s) => s.title)
              .join("; "),
            primaryActionLabel: "Review round",
            primaryActionHref: `/rounds/${round.id}`,
            affectedTeamIds: teamIds,
            affectedPlayerIds: playerIds,
          }),
        );
      }

      if (decisionSignals.length > 0) {
        const playerIds = [
          ...new Set(decisionSignals.map((s) => s.playerId).filter(Boolean)),
        ] as string[];

        items.push(
          makeItem({
            category: "decision_required",
            matchRoundId: round.id,
            decisionRequiredCount: decisionSignals.length,
            title: `${round.name} — ${decisionSignals.length} decision${decisionSignals.length !== 1 ? "s" : ""} required`,
            summary: decisionSignals
              .map((s) => s.title)
              .join("; "),
            primaryActionLabel: "Review round",
            primaryActionHref: `/rounds/${round.id}`,
            affectedTeamIds: [],
            affectedPlayerIds: playerIds,
          }),
        );
      }

      if (blockedSignals.length === 0 && decisionSignals.length === 0) {
        items.push(
          makeItem({
            category: "ready_to_finalize",
            matchRoundId: round.id,
            title: `${round.name} — Ready to finalize`,
            summary: "No blocked conditions or decisions required. Draft is ready to lock.",
            primaryActionLabel: "Review round",
            primaryActionHref: `/rounds/${round.id}`,
            affectedTeamIds: [],
            affectedPlayerIds: [],
          }),
        );
      }
      continue;
    }

    if (round.status === "FINALIZED") {
      for (const match of round.matches) {
        if (match.status === "CANCELLED") continue;
        if (!hasLeagueMatchPassed({ startsAt: match.startsAt, status: match.status })) continue;
        if (!existingReports.has(match.id)) {
          items.push(
            makeItem({
              category: "post_match_report",
              matchRoundId: round.id,
              matchId: match.id,
              title: `${round.name} — Post-match report missing`,
              summary: "This finalised match has no post-match report recorded.",
              primaryActionLabel: "Record report",
              primaryActionHref: `/matches/${match.id}`,
              affectedTeamIds: match.teamId ? [match.teamId] : [],
              affectedPlayerIds: [],
            }),
          );
        } else {
          const reportData = reportStatuses.get(match.id);
          if (reportData) {
            if (reportData.status === "DRAFT") {
              const hasUnknown = reportData.playerActuals.some(
                (a) => a.attendanceStatus === "UNKNOWN",
              );
              if (hasUnknown) {
                items.push(
                  makeItem({
                    category: "unknown_attendance",
                    matchRoundId: round.id,
                    matchId: match.id,
                    title: `${round.name} — Confirm attendance`,
                    summary: "Post-match report has unknown attendance that must be confirmed.",
                    primaryActionLabel: "Complete report",
                    primaryActionHref: `/matches/${match.id}`,
                    affectedTeamIds: match.teamId ? [match.teamId] : [],
                    affectedPlayerIds: [],
                  }),
                );
              } else {
                items.push(
                  makeItem({
                    category: "incomplete_report",
                    matchRoundId: round.id,
                    matchId: match.id,
                    title: `${round.name} — Complete post-match report`,
                    summary: "Post-match report is draft and has not been completed.",
                    primaryActionLabel: "Complete report",
                    primaryActionHref: `/matches/${match.id}`,
                    affectedTeamIds: match.teamId ? [match.teamId] : [],
                    affectedPlayerIds: [],
                  }),
                );
              }
            } else if (reportData.status === "REPORTED") {
              items.push(
                makeItem({
                  category: "incomplete_report",
                  matchRoundId: round.id,
                  matchId: match.id,
                  title: `${round.name} — Lock post-match report`,
                  summary: "Post-match report has been submitted but not locked.",
                  primaryActionLabel: "Lock report",
                  primaryActionHref: `/matches/${match.id}`,
                  affectedTeamIds: match.teamId ? [match.teamId] : [],
                  affectedPlayerIds: [],
                }),
              );
            }
          }
        }
      }
      continue;
    }
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayMatches = await db.match.findMany({
    where: {
      startsAt: { gte: todayStart, lte: todayEnd },
      status: "SCHEDULED",
      ...orgWhere,
    },
    select: {
      id: true,
      opponent: true,
      homeAway: true,
      teamId: true,
      matchRoundId: true,
      team: { select: { name: true } },
      matchRound: { select: { id: true, name: true } },
    },
  });

  const todayMatchIds = todayMatches.map((m) => m.id);

  const finalizedSquadCounts = await db.selection.groupBy({
    by: ["matchId"],
    where: {
      matchId: { in: todayMatchIds },
      status: "FINALIZED",
    },
    _count: { id: true },
  });

  const matchesWithSquad = new Set(finalizedSquadCounts.map((s) => s.matchId));

  const activeSessions = await db.liveMatchSession.findMany({
    where: {
      matchId: { in: todayMatchIds },
      status: "ACTIVE",
    },
    select: { matchId: true },
  });

  const matchesWithSession = new Set(activeSessions.map((s) => s.matchId));

  for (const match of todayMatches) {
    if (matchesWithSession.has(match.id)) continue;
    if (!matchesWithSquad.has(match.id)) continue;

    const teamName = match.team.name;
    const homeAway = match.homeAway === "HOME" ? "vs" : "@";
    items.push(
      makeItem({
        category: "live_report_available",
        matchRoundId: match.matchRoundId,
        matchId: match.id,
        title: `Live report: ${teamName} ${homeAway} ${match.opponent}`,
        summary: "Finalized squad exists. Start live reporting for this matchday.",
        primaryActionLabel: "Start live reporting",
        primaryActionHref: `/matches/${match.id}/live`,
        affectedTeamIds: [match.teamId],
        affectedPlayerIds: [],
      }),
    );
  }

  const eventItems = await getEventWorkItems(orgFilter);
  items.push(...eventItems);

  const pendingReviews = await db.reviewRequest.findMany({
    where: {
      ...(orgFilter && orgFilter.type === "org" ? orgFilter.filter : {}),
      status: { in: ["PENDING", "CHANGES_REQUESTED"] },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const review of pendingReviews) {
    if (review.status === "PENDING") {
      items.push(
        makeItem({
          category: "review_assigned",
          matchRoundId: "review",
          title: `Review requested: ${review.targetType === "EVENT_SQUAD" ? "Event squad" : "Match lineup"}`,
          summary: review.requestMessage ?? "A review has been requested.",
          primaryActionLabel: "View review",
          primaryActionHref: "/reviews",
          affectedTeamIds: [],
          affectedPlayerIds: [],
        }),
      );
    } else if (review.status === "CHANGES_REQUESTED") {
      items.push(
        makeItem({
          category: "review_changes_requested",
          matchRoundId: "review",
          title: `Changes requested: ${review.targetType === "EVENT_SQUAD" ? "Event squad" : "Match lineup"}`,
          summary: review.reviewerComment ?? "Changes have been requested on your submission.",
          primaryActionLabel: "View review",
          primaryActionHref: "/reviews",
          affectedTeamIds: [],
          affectedPlayerIds: [],
        }),
      );
    }
  }

  const pendingSuggestions = await db.playerProfileSuggestion.findMany({
    where: {
      status: "PENDING",
      ...(orgFilter && orgFilter.type === "org" ? orgFilter.filter : {}),
    },
    select: { id: true, playerId: true, targetType: true, attributeKey: true },
  });

  if (pendingSuggestions.length > 0) {
    items.push(
      makeItem({
        category: "pending_profile_suggestions",
        matchRoundId: "suggestions",
        title: `${pendingSuggestions.length} pending profile suggestion${pendingSuggestions.length !== 1 ? "s" : ""}`,
        summary: `${pendingSuggestions.length} player attribute suggestion${pendingSuggestions.length !== 1 ? "s" : ""} awaiting coach review.`,
        affectedPlayerIds: [...new Set(pendingSuggestions.map((s) => s.playerId))],
        affectedTeamIds: [],
        primaryActionLabel: "Review suggestions",
        primaryActionHref: "/players",
      }),
    );
  }

  items.sort((a, b) => {
    const priDiff = a.priority - b.priority;
    if (priDiff !== 0) return priDiff;
    return a.matchRoundId.localeCompare(b.matchRoundId);
  });

  return {
    leagueSeasonId: leagueSeason.id,
    leagueSeasonName: leagueSeason.name,
    items,
    computedAt: new Date(),
  };
}

function makeItem(
  overrides: Omit<AssistantWorkItem, "id" | "priority" | "category"> & {
    category: AssistantWorkCategory;
  },
): AssistantWorkItem {
  const { category, ...rest } = overrides;
  const id =
    rest.matchId && category === "post_match_report"
      ? `${category}|${rest.matchRoundId}|${rest.matchId}`
      : rest.eventId
        ? `${category}|${rest.eventId}`
        : `${category}|${rest.matchRoundId}`;
  return {
    id,
    category,
    priority: CATEGORY_PRIORITY[category],
    ...rest,
  };
}

function emptyResult(
  leagueSeasonId: string | null,
  leagueSeasonName: string | null,
  items: AssistantWorkItem[],
): AssistantCommandCentre {
  return {
    leagueSeasonId,
    leagueSeasonName,
    items,
    computedAt: new Date(),
  };
}