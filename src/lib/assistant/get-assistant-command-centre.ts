import { db } from "@/lib/db";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type {
  AssistantCommandCentre,
  AssistantWorkCategory,
  AssistantWorkItem,
} from "./types";
import { CATEGORY_PRIORITY } from "./types";

export async function getAssistantCommandCentre(): Promise<AssistantCommandCentre> {
  const planningPeriod = await db.planningPeriod.findFirst({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true },
  });

  if (!planningPeriod) {
    return emptyResult(null, null, [
      makeItem({
        category: "setup_missing",
        matchRoundId: "none",
        title: "No planning period exists",
        summary: "Create a planning period to get started.",
        primaryActionLabel: "View Fixtures",
        primaryActionHref: "/fixtures",
        affectedTeamIds: [],
        affectedPlayerIds: [],
      }),
    ]);
  }

  const teamCount = await db.team.count();
  if (teamCount === 0) {
    return emptyResult(planningPeriod.id, planningPeriod.name, [
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

  const playerCount = await db.player.count({ where: { removedAt: null } });
  if (playerCount === 0) {
    return emptyResult(planningPeriod.id, planningPeriod.name, [
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
    where: { matchRound: { planningPeriodId: planningPeriod.id } },
  });
  if (matchCount === 0) {
    return emptyResult(planningPeriod.id, planningPeriod.name, [
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
    where: { planningPeriodId: planningPeriod.id },
    orderBy: { name: "asc" },
    include: {
      matches: {
        select: {
          id: true,
          teamId: true,
          status: true,
        },
      },
    },
  });

  const finalizedMatchIds = rounds
    .filter((r) => r.status === "FINALIZED")
    .flatMap((r) => r.matches.map((m) => m.id));

  const existingReports = finalizedMatchIds.length > 0
    ? new Set(
        (await db.postMatchReport.findMany({
          where: { matchId: { in: finalizedMatchIds } },
          select: { matchId: true },
        })).map((r) => r.matchId),
      )
    : new Set<string>();

  const items: AssistantWorkItem[] = [];
  let hasUngenerated = false;

  for (const round of rounds) {
    if (round.status === "NOT_GENERATED") {
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

    if (round.status === "DRAFT" || round.status === "BLOCKED") {
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

    if (round.status === "READY") {
      items.push(
        makeItem({
          category: "ready_to_finalize",
          matchRoundId: round.id,
          title: `${round.name} — Ready to finalize`,
          summary: "No blocked conditions. Draft is ready to lock.",
          primaryActionLabel: "Review round",
          primaryActionHref: `/rounds/${round.id}`,
          affectedTeamIds: [],
          affectedPlayerIds: [],
        }),
      );
      continue;
    }

    if (round.status === "FINALIZED") {
      for (const match of round.matches) {
        if (match.status === "CANCELLED") continue;
        if (!existingReports.has(match.id)) {
          items.push(
            makeItem({
              category: "post_match_report",
              matchRoundId: round.id,
              matchId: match.id,
              title: `${round.name} — Post-match report missing`,
              summary: "This finalized match has no post-match report recorded.",
              primaryActionLabel: "Record report",
              primaryActionHref: `/matches/${match.id}`,
              affectedTeamIds: match.teamId ? [match.teamId] : [],
              affectedPlayerIds: [],
            }),
          );
        }
      }
      continue;
    }
  }

  items.sort((a, b) => {
    const priDiff = a.priority - b.priority;
    if (priDiff !== 0) return priDiff;
    return a.matchRoundId.localeCompare(b.matchRoundId);
  });

  return {
    planningPeriodId: planningPeriod.id,
    planningPeriodName: planningPeriod.name,
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
      : `${category}|${rest.matchRoundId}`;
  return {
    id,
    category,
    priority: CATEGORY_PRIORITY[category],
    ...rest,
  };
}

function emptyResult(
  planningPeriodId: string | null,
  planningPeriodName: string | null,
  items: AssistantWorkItem[],
): AssistantCommandCentre {
  return {
    planningPeriodId,
    planningPeriodName,
    items,
    computedAt: new Date(),
  };
}