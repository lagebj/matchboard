"use server";

import { requireCoachAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveOrgFilterForUser, type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { logEventSquadLock, logEventSquadUnlock } from "@/lib/security/audit-log";
import { supersedePendingReviews } from "@/lib/review/review-service";

async function requireEventOrgAccess(eventId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const event = await db.event.findFirst({
    where: { id: eventId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!event) throw new Error("Event not found or access denied.");
}

export type EventSquadValidationIssue = {
  code: string;
  severity: "blocking" | "warning" | "info";
  message: string;
  squadId?: string;
  playerId?: string;
};

export type EventSquadValidationResult = {
  valid: boolean;
  issues: EventSquadValidationIssue[];
};

export async function validateEventSquadsBeforeCommit(
  eventId: string,
): Promise<EventSquadValidationResult> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  const issues: EventSquadValidationIssue[] = [];

  const event = await db.event.findFirst({
    where: { id: eventId, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    select: { id: true },
  });

  if (!event) {
    issues.push({
      code: "event_not_found",
      severity: "blocking",
      message: "Event not found.",
    });
    return { valid: false, issues };
  }

  const unavailablePlayers = await db.eventPlayerAvailability.findMany({
    where: { eventId, status: "UNAVAILABLE", ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    select: { playerId: true },
  });
  const unavailablePlayerIds = new Set(unavailablePlayers.map((pa) => pa.playerId));

  const squads = await db.eventSquad.findMany({
    where: { eventId, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    include: {
      players: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryPosition: true,
              goalkeeperAbility: true,
            },
          },
        },
      },
    },
  });

  if (squads.length === 0) {
    issues.push({
      code: "no_squads",
      severity: "blocking",
      message: "Event has no squads to commit.",
    });
    return { valid: false, issues };
  }

  const allAssignedPlayerIds = new Set<string>();

  for (const squad of squads) {
    const playerCount = squad.players.length;

    for (const sp of squad.players) {
      if (allAssignedPlayerIds.has(sp.playerId)) {
        issues.push({
          code: "duplicate_player_across_squads",
          severity: "blocking",
          message: `${sp.player.firstName} ${sp.player.lastName ?? ""} is assigned to multiple squads in the same event.`,
          squadId: squad.id,
          playerId: sp.playerId,
        });
      }
      allAssignedPlayerIds.add(sp.playerId);

      if (unavailablePlayerIds.has(sp.playerId)) {
        issues.push({
          code: "unavailable_player_in_squad",
          severity: "blocking",
          message: `${sp.player.firstName} ${sp.player.lastName ?? ""} is marked unavailable but is assigned to squad "${squad.name}".`,
          squadId: squad.id,
          playerId: sp.playerId,
        });
      }
    }

    if (squad.minSize && playerCount < squad.minSize) {
      issues.push({
        code: "squad_below_minimum",
        severity: "blocking",
        message: `Squad "${squad.name}" has ${playerCount} players but minimum is ${squad.minSize}.`,
        squadId: squad.id,
      });
    }

    if (squad.targetSize && playerCount > 0 && playerCount < squad.targetSize) {
      issues.push({
        code: "squad_below_target",
        severity: "info",
        message: `Squad "${squad.name}" has ${playerCount} players; target is ${squad.targetSize}.`,
        squadId: squad.id,
      });
    }

    const gkYes = squad.players.filter(
      (sp) => sp.player.goalkeeperAbility === "YES" || sp.player.primaryPosition === "GK",
    ).length;
    const gkSecondary = squad.players.filter(
      (sp) =>
        sp.player.goalkeeperAbility !== "YES" &&
        sp.player.primaryPosition !== "GK" &&
        sp.player.goalkeeperAbility === "EMERGENCY",
    ).length;
    const anyGK = squad.players.filter(
      (sp) => ["YES", "EMERGENCY"].includes(sp.player.goalkeeperAbility) || sp.player.primaryPosition === "GK",
    ).length;

    if (gkYes === 0) {
      if (anyGK === 0) {
        issues.push({
          code: "no_goalkeeper_coverage",
          severity: "blocking",
          message: `Squad "${squad.name}" has no goalkeeper coverage at all.`,
          squadId: squad.id,
        });
      } else if (gkSecondary > 0) {
        issues.push({
          code: "no_primary_goalkeeper_secondary_only",
          severity: "warning",
          message: `Squad "${squad.name}" has no primary goalkeeper; secondary goalkeeper coverage available.`,
          squadId: squad.id,
        });
      } else {
        issues.push({
          code: "no_primary_goalkeeper_tertiary_only",
          severity: "warning",
          message: `Squad "${squad.name}" has no primary goalkeeper; only emergency or tertiary coverage.`,
          squadId: squad.id,
        });
      }
    }
  }

  const hasBlocking = issues.some((i) => i.severity === "blocking");
  return { valid: !hasBlocking, issues };
}

export async function confirmEventSquadsAction(eventId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  await requireEventOrgAccess(eventId, orgFilter);

  const validation = await validateEventSquadsBeforeCommit(eventId);

  if (!validation.valid) {
    const blockingIssues = validation.issues.filter(
      (i) => i.severity === "blocking",
    );
    logEventSquadLock(coach.email ?? "unknown", eventId, "failure", "Blocking validation issues");
    return {
      success: false as const,
      error: "Cannot commit squads: blocking issues found.",
      issues: validation.issues,
      blockingIssues,
    };
  }

  const result = await db.eventSquad.updateMany({
    where: { eventId, status: "DRAFT", ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    data: { status: "LOCKED" },
  });

  const squads = await db.eventSquad.findMany({
    where: { eventId, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    select: { id: true },
  });

  for (const squad of squads) {
    await supersedePendingReviews("EVENT_SQUAD", squad.id);
  }

  logEventSquadLock(coach.email ?? "unknown", eventId, "success");

  return {
    success: true as const,
    confirmedCount: result.count,
    issues: validation.issues,
  };
}

export async function unconfirmEventSquadsAction(eventId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  await requireEventOrgAccess(eventId, orgFilter);

  const confirmedCount = await db.eventSquad.count({
    where: { eventId, status: "LOCKED", ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
  });

  if (confirmedCount === 0) {
    logEventSquadUnlock(coach.email ?? "unknown", eventId, "failure");
    return {
      success: false as const,
      error: "No confirmed squads to unconfirm.",
    };
  }

  const result = await db.eventSquad.updateMany({
    where: { eventId, status: "LOCKED", ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    data: { status: "DRAFT" },
  });

  const squads = await db.eventSquad.findMany({
    where: { eventId, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    select: { id: true },
  });

  for (const squad of squads) {
    await supersedePendingReviews("EVENT_SQUAD", squad.id);
  }

  logEventSquadUnlock(coach.email ?? "unknown", eventId, "success");

  return {
    success: true as const,
    unconfirmedCount: result.count,
  };
}

export async function getEventSquadsStatusAction(eventId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  const squads = await db.eventSquad.findMany({
    where: { eventId, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    select: { id: true, name: true, status: true },
  });

  const allLocked = squads.length > 0 && squads.every((s) => s.status === "LOCKED");
  const allDraft = squads.every((s) => s.status === "DRAFT");
  const mixed = squads.length > 0 && !allLocked && !allDraft;

  let aggregateStatus: "DRAFT" | "LOCKED" | "MIXED";
  if (allDraft || squads.length === 0) {
    aggregateStatus = "DRAFT";
  } else if (allLocked) {
    aggregateStatus = "LOCKED";
  } else {
    aggregateStatus = "MIXED";
  }

  return {
    squads,
    aggregateStatus,
    allLocked,
    allDraft,
    mixed,
  };
}