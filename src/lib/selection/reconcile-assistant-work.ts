import { db } from "@/lib/db";
import type { RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

type AssistantWorkItemInput = {
  idempotencyKey: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  entityType: string;
  entityId: string;
  affectedTeamIds: string[];
  affectedPlayerIds: string[];
  ruleIds: string[];
  recommendedAction: string;
  primaryActionLabel: string;
  primaryActionHref: string;
};

export async function reconcileAssistantWorkItemsForRound(
  integrity: RoundPlanIntegrity,
): Promise<void> {
  const { matchRoundId, signals } = integrity;

  const itemsToCreate: AssistantWorkItemInput[] = [];

  const blockedSignals = signals.filter((s) => s.kind === "BLOCKED");
  const decisionSignals = signals.filter((s) => s.kind === "DECISION_REQUIRED");

  if (blockedSignals.length > 0) {
    const belowMinimumSignals = blockedSignals.filter((s) => s.ruleCode === "SQUAD_BELOW_MINIMUM");

    for (const signal of belowMinimumSignals) {
      itemsToCreate.push({
        idempotencyKey: `match-viability-${matchRoundId}-${signal.matchId ?? ""}-${signal.teamId ?? ""}`,
        type: "MATCH_VIABILITY",
        severity: "BLOCKED",
        title: signal.title,
        summary: `${signal.currentState} ${signal.consequence}`,
        entityType: "MATCH",
        entityId: signal.matchId ?? matchRoundId,
        affectedTeamIds: signal.teamId ? [signal.teamId] : [],
        affectedPlayerIds: [],
        ruleIds: [signal.ruleCode],
        recommendedAction: "Review squad and add players or provide override reason.",
        primaryActionLabel: "Review squad",
        primaryActionHref: `/rounds/${matchRoundId}`,
      });
    }

    const unavailableSignals = blockedSignals.filter((s) => s.ruleCode === "SELECTED_PLAYER_UNAVAILABLE");

    if (unavailableSignals.length > 0) {
      const teamGroups = new Map<string, typeof unavailableSignals>();
      for (const s of unavailableSignals) {
        const key = s.teamId ?? "unknown";
        const group = teamGroups.get(key) ?? [];
        group.push(s);
        teamGroups.set(key, group);
      }

      for (const [teamId, group] of teamGroups) {
        const signal = group[0]!;
        itemsToCreate.push({
          idempotencyKey: `selection-validity-${matchRoundId}-${teamId}`,
          type: "SELECTION_VALIDITY",
          severity: "BLOCKED",
          title: group.length === 1 ? signal.title : `${group.length} selected player(s) are marked unavailable for ${signal.teamId ?? "a team"}`,
          summary: group.map((s) => s.currentState).join(" "),
          entityType: "TEAM",
          entityId: teamId,
          affectedTeamIds: [teamId],
          affectedPlayerIds: group.map((s) => s.playerId).filter(Boolean) as string[],
          ruleIds: group.map((s) => s.ruleCode),
          recommendedAction: "Remove unavailable players or correct availability.",
          primaryActionLabel: "Review selection",
          primaryActionHref: `/rounds/${matchRoundId}`,
        });
      }
    }

    const integrityFailures = blockedSignals.filter((s) => s.ruleCode === "DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE");

    for (const signal of integrityFailures) {
      itemsToCreate.push({
        idempotencyKey: `invalid-assignment-${matchRoundId}-${signal.playerId ?? ""}`,
        type: "INVALID_PLANNED_ASSIGNMENT",
        severity: "BLOCKED",
        title: signal.title,
        summary: `${signal.currentState} ${signal.consequence}`,
        entityType: "PLAYER",
        entityId: signal.playerId ?? matchRoundId,
        affectedTeamIds: [],
        affectedPlayerIds: signal.playerId ? [signal.playerId] : [],
        ruleIds: [signal.ruleCode],
        recommendedAction: "Review assignments and remove duplicate.",
        primaryActionLabel: "Review assignments",
        primaryActionHref: `/rounds/${matchRoundId}`,
      });
    }
  }

  if (decisionSignals.length > 0) {
    itemsToCreate.push({
      idempotencyKey: `participation-coverage-${matchRoundId}`,
      type: "PARTICIPATION_COVERAGE",
      severity: "ACTION_REQUIRED",
      title: `Round · Participation coverage`,
      summary: `${decisionSignals.length} available player(s) have no planned match opportunity.`,
      entityType: "ROUND",
      entityId: matchRoundId,
      affectedTeamIds: [],
      affectedPlayerIds: decisionSignals.map((s) => s.playerId).filter(Boolean) as string[],
      ruleIds: ["AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY"],
      recommendedAction: "Assign players to eligible matches or record why no planned opportunity is provided.",
      primaryActionLabel: "Review coverage",
      primaryActionHref: `/rounds/${matchRoundId}`,
    });
  }

  await db.$transaction(async (tx) => {
    const existingOpen = await tx.assistantIssue.findMany({
      where: {
        status: "OPEN",
        primaryActionHref: { contains: `/rounds/${matchRoundId}` },
      },
    });

    const existingByKey = new Map(
      existingOpen.map((e) => [`new:${e.type}|${e.entityId}|${(e.ruleIds as string[])?.sort().join(",")}`, e]),
    );

    const newKeys = new Set(itemsToCreate.map((i) => `new:${i.type}|${i.entityId}|${i.ruleIds.sort().join(",")}`));

    const toClose = existingOpen.filter((e) => {
      const key = `new:${e.type}|${e.entityId}|${(e.ruleIds as string[])?.sort().join(",")}`;
      return !newKeys.has(key);
    });

    for (const item of toClose) {
      await tx.assistantIssue.update({
        where: { id: item.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });
    }

    for (const item of itemsToCreate) {
      const key = `${item.type}|${item.entityId}|${item.ruleIds.sort().join(",")}`;
      const existing = existingByKey.get(key);

      if (existing) {
        await tx.assistantIssue.update({
          where: { id: existing.id },
          data: {
            severity: item.severity,
            title: item.title,
            summary: item.summary,
            affectedTeamIds: item.affectedTeamIds,
            affectedPlayerIds: item.affectedPlayerIds,
            ruleIds: item.ruleIds,
            recommendedAction: item.recommendedAction,
            primaryActionLabel: item.primaryActionLabel,
            primaryActionHref: item.primaryActionHref,
          },
        });
      } else {
        await tx.assistantIssue.create({
          data: {
            type: item.type,
            severity: item.severity,
            status: "OPEN",
            title: item.title,
            summary: item.summary,
            entityType: item.entityType,
            entityId: item.entityId,
            affectedTeamIds: item.affectedTeamIds,
            affectedPlayerIds: item.affectedPlayerIds,
            ruleIds: item.ruleIds,
            recommendedAction: item.recommendedAction,
            primaryActionLabel: item.primaryActionLabel,
            primaryActionHref: item.primaryActionHref,
          },
        });
      }
    }
  });
}