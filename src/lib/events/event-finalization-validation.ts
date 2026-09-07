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

/**
 * Event finalization (`Event.status` DRAFT -> FINALIZED, ADR-0109 §7) is a whole-container
 * "this event is over" assertion that a coach makes *after* the matches have been played. It is
 * NOT a pre-match planning gate. Squad-composition quality — goalkeeper coverage, squad size,
 * a pool player still marked unavailable, an empty squad, even zero squads — describes how the
 * event was *planned*, not whether it is *finished*, and must never block finalization
 * (ADR-0122). Whoever actually played in goal on the day is a real-world fact recorded in the
 * post-match report, not something this check can or should second-guess.
 *
 * Only genuine data-integrity impossibilities block: the event does not exist, it is already
 * finalized, or the same player is somehow assigned to two squads of the same event (DB-unique
 * on `[eventId, playerId]`, so effectively unreachable — kept as defense-in-depth corruption
 * detection, not a planning preference). Everything else is surfaced as a non-blocking
 * warning/info so the coach still sees it without being stopped.
 *
 * The separate pre-match squad-set lock (`confirmEventSquadsAction` and its inline validation in
 * `event-squad-commit-actions.ts`) DOES still block on composition — that one is a planning gate
 * and is deliberately unchanged.
 */
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
    // Non-blocking (ADR-0122): an event with no squads can still be a legitimate "done" state
    // (e.g. it was only ever used to record match results). Surface it, do not stop finalization.
    issues.push({
      code: "no_squads",
      severity: "warning",
      message: "Event has no squads.",
    });
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

    // ADR-0106: EventSquadPlayer.playerId/player are now nullable (a GuestPlayer assignment uses
    // guestPlayerId instead). Event GuestPlayer participation is not yet wired into finalization
    // validation -- filtered here as a no-op today (no write path produces a guest row yet).
    // playerCount above intentionally still counts every assignment (guest or not) for squad
    // size checks; only the Player-specific checks below (duplicate, unavailable, GK coverage)
    // are scoped to Player rows for now.
    const playerBackedRows = squad.players.filter(
      (sp): sp is typeof sp & { playerId: string; player: NonNullable<typeof sp.player> } =>
        sp.playerId !== null && sp.player !== null,
    );

    for (const sp of playerBackedRows) {
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
        // Non-blocking (ADR-0122): post-match, the player may well have played anyway, or the
        // availability flag was simply never updated. It is context, not a finalization blocker.
        issues.push({
          code: "unavailable_player_in_squad",
          severity: "warning",
          message: `${sp.player.firstName} ${sp.player.lastName ?? ""} is marked unavailable but is assigned to squad "${squad.name}".`,
          squadId: squad.id,
          playerId: sp.playerId,
        });
      }
    }

    // Squad-size shortfalls describe the plan, not whether the event is finished — non-blocking
    // (ADR-0122).
    if (playerCount === 0) {
      issues.push({
        code: "empty_squad",
        severity: "warning",
        message: `Squad "${squad.name}" has no players assigned.`,
        squadId: squad.id,
      });
    } else if (squad.minSize && playerCount < squad.minSize) {
      issues.push({
        code: "squad_below_minimum",
        severity: "warning",
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

    const gkYes = playerBackedRows.filter(
      (sp) => sp.player.goalkeeperAbility === "YES" || sp.player.primaryPosition === "GK",
    ).length;
    const anyGK = playerBackedRows.filter(
      (sp) => ["YES", "EMERGENCY"].includes(sp.player.goalkeeperAbility) || sp.player.primaryPosition === "GK",
    ).length;

    // Goalkeeper coverage is a planning signal, never a finalization blocker (ADR-0122): the
    // match has been played, and whoever actually kept goal is recorded in the post-match report.
    if (playerCount > 0 && gkYes === 0) {
      if (anyGK === 0) {
        issues.push({
          code: "no_goalkeeper_coverage",
          severity: "warning",
          message: `Squad "${squad.name}" has no goalkeeper-marked player.`,
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