import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export type EventFinalizationIssue = {
  code: string;
  severity: "blocking" | "warning" | "info";
  message: string;
  squadId?: string;
  playerId?: string;
  matchId?: string;
};

export type EventFinalizationValidationResult = {
  valid: boolean;
  issues: EventFinalizationIssue[];
};

export async function validateEventForFinalization(
  eventId: string,
  orgFilter: OrgFilterMode,
): Promise<EventFinalizationValidationResult> {
  const issues: EventFinalizationIssue[] = [];

  const event = await db.event.findFirst({
    where: { id: eventId, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    select: { id: true, status: true },
  });

  if (!event) {
    return {
      valid: false,
      issues: [{ code: "event_not_found", severity: "blocking", message: "Event not found." }],
    };
  }

  if (event.status === "FINALIZED") {
    return {
      valid: false,
      issues: [{ code: "event_already_finalized", severity: "blocking", message: "Event is already finalized." }],
    };
  }

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
      message: "Event has no squads. Create at least one squad before finalizing.",
    });
    return { valid: false, issues };
  }

  const unavailablePlayers = await db.eventPlayerAvailability.findMany({
    where: {
      eventId,
      status: "UNAVAILABLE",
      ...(orgFilter.type === "org" ? orgFilter.filter : {}),
    },
    select: { playerId: true },
  });
  const unavailablePlayerIds = new Set(unavailablePlayers.map((pa) => pa.playerId));

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

    if (playerCount === 0) {
      issues.push({
        code: "empty_squad",
        severity: "blocking",
        message: `Squad "${squad.name}" has no players assigned.`,
        squadId: squad.id,
      });
    } else if (squad.minSize && playerCount < squad.minSize) {
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
    const anyGK = squad.players.filter(
      (sp) => ["YES", "EMERGENCY"].includes(sp.player.goalkeeperAbility) || sp.player.primaryPosition === "GK",
    ).length;

    if (playerCount > 0 && gkYes === 0) {
      if (anyGK === 0) {
        issues.push({
          code: "no_goalkeeper_coverage",
          severity: "blocking",
          message: `Squad "${squad.name}" has no goalkeeper coverage at all.`,
          squadId: squad.id,
        });
      } else {
        issues.push({
          code: "no_primary_goalkeeper",
          severity: "warning",
          message: `Squad "${squad.name}" has no primary goalkeeper; only emergency coverage available.`,
          squadId: squad.id,
        });
      }
    }
  }

  const matches = await db.eventMatch.findMany({
    where: { eventId, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    select: {
      id: true,
      status: true,
      opponentName: true,
      postMatchReport: { select: { id: true, status: true } },
    },
  });

  for (const match of matches) {
    if (match.status === "CANCELLED") {
      issues.push({
        code: "cancelled_match",
        severity: "info",
        message: `Match vs ${match.opponentName} is cancelled and will be excluded from finalization.`,
        matchId: match.id,
      });
      continue;
    }

    if (match.postMatchReport?.status === "DRAFT") {
      issues.push({
        code: "incomplete_report",
        severity: "warning",
        message: `Match vs ${match.opponentName} has an incomplete post-match report.`,
        matchId: match.id,
      });
    }
  }

  const hasBlocking = issues.some((i) => i.severity === "blocking");
  return { valid: !hasBlocking, issues };
}

export async function validateEventForUnfinalization(
  eventId: string,
  orgFilter: OrgFilterMode,
): Promise<EventFinalizationValidationResult> {
  const issues: EventFinalizationIssue[] = [];

  const event = await db.event.findFirst({
    where: { id: eventId, ...(orgFilter.type === "org" ? orgFilter.filter : {}) },
    select: { id: true, status: true },
  });

  if (!event) {
    return {
      valid: false,
      issues: [{ code: "event_not_found", severity: "blocking", message: "Event not found." }],
    };
  }

  if (event.status !== "FINALIZED") {
    return {
      valid: false,
      issues: [{ code: "event_not_finalized", severity: "blocking", message: "Event is not finalized." }],
    };
  }

  return { valid: true, issues };
}