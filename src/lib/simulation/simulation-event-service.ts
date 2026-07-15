import "server-only";

import { db } from "@/lib/db";
import { generateEventSquads } from "@/lib/events/event-squad-generation";
import { validateEventPool } from "@/lib/events/event-validation";
import type {
  EventSimulationResult,
  SimulatedEventSquad,
  SimulationWarning,
} from "./simulation-types";
import type { PlayerAttributeProfile, EventSelectionPattern, GameFormat } from "@/lib/events/event-types";
import { detectSimulationConflicts } from "./simulation-conflicts";

export async function simulateEvent(
  eventId: string,
): Promise<EventSimulationResult> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      squads: {
        include: {
          players: {
            where: { source: { not: "LOCKED" } },
          },
        },
      },
      eventMatches: {
        include: {
          opponentTeam: { select: { displayName: true } },
          supportAssignments: true,
        },
      },
    },
  });

  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const poolPlayers = await db.eventPlayerAvailability.findMany({
    where: {
      eventId,
      status: { in: ["AVAILABLE"] },
    },
    include: {
      player: true,
    },
  });

  const playersWithAttrs: PlayerAttributeProfile[] = poolPlayers.map((ep) => ({
    playerId: ep.playerId,
    firstName: ep.player.firstName,
    lastName: ep.player.lastName,
    coreTeamId: ep.player.coreTeamId,
    primaryPosition: ep.player.primaryPosition,
    secondaryPosition: ep.player.secondaryPosition,
    tertiaryPosition: ep.player.tertiaryPosition,
    goalkeeperAbility: ep.player.goalkeeperAbility,
    ballControl: ep.player.ballControl,
    passing: ep.player.passing,
    firstTouch: ep.player.firstTouch,
    oneVOneAttacking: ep.player.oneVOneAttacking,
    positioning: ep.player.positioning,
    oneVOneDefending: ep.player.oneVOneDefending,
    decisionMaking: ep.player.decisionMaking,
    effort: ep.player.effort,
    teamplay: ep.player.teamplay,
    concentration: ep.player.concentration,
    speed: ep.player.speed,
    strength: ep.player.strength,
    nonRotatable: ep.player.nonRotatable,
    preferredFoot: ep.player.preferredFoot,
    bestSide: ep.player.bestSide,
  }));

  const lockedAssignments = new Map<string, string>();
  for (const squad of event.squads) {
    for (const sp of squad.players) {
      if (sp.locked) {
        lockedAssignments.set(sp.playerId, squad.id);
      }
    }
  }

  const squadFormationIds = event.squads
    .map((s) => s.formationId)
    .filter((id): id is string => id !== null);

  const formations = squadFormationIds.length > 0
    ? await db.formation.findMany({
        where: { id: { in: squadFormationIds } },
        include: { slots: true },
      })
    : [];

  const gameFormat = (event.gameFormat ?? "FIVE_A_SIDE") as GameFormat;
  const selectionPattern = (event.selectionPattern ?? "ALL_BALANCED") as EventSelectionPattern;

  const result = generateEventSquads({
    eventId: event.id,
    players: playersWithAttrs,
    formations,
    defaultFormationId: event.defaultFormationId,
    squads: event.squads.map((s) => ({
      id: s.id,
      name: s.name,
      intent: s.intent as "COMPETITIVE" | "BALANCED" | "MANUAL",
      targetSize: s.targetSize,
      minSize: s.minSize,
      maxSize: s.maxSize,
      formationId: s.formationId,
      generationOrder: s.generationOrder,
    })),
    selectionPattern,
    lockedAssignments,
    includeReserves: false,
    includeLateAdditions: false,
    gameFormat,
  });

  const simulatedSquads: SimulatedEventSquad[] = event.squads.map((squad) => {
    const assignments = result.assignments.filter((a) => a.eventSquadId === squad.id);
    const balance = result.balanceSummaries.find((b) => b.squadId === squad.id);

    return {
      squadId: squad.id,
      squadName: squad.name,
      intent: squad.intent,
      playerCount: assignments.length,
      players: assignments.map((a) => ({
        playerId: a.playerId,
        role: a.assignedRoleType ?? a.source,
        reason: a.selectionReason,
      })),
      balance: balance
        ? {
            averageOverall: balance.averageOverall,
            gkCount: balance.goalkeeperCount,
            positionCoverage: {
              defender: balance.defenderCount,
              midfielder: balance.midfielderCount,
              forward: balance.forwardCount,
              flexible: balance.flexibleCount,
            },
          }
        : undefined,
    };
  });

  const conflictInputs = event.eventMatches.flatMap((match) =>
    match.supportAssignments.map((sa) => ({
      playerId: sa.playerId,
      leagueAssignments: [],
      eventAssignments: [
        {
          eventId: event.id,
          eventMatchId: match.id,
          startsAt: match.startsAt,
          endsAt: event.matchDurationMinutes
            ? new Date(match.startsAt.getTime() + event.matchDurationMinutes * 60 * 1000)
            : null,
        },
      ],
      totalAssignments: 1,
    })),
  );

  const conflicts = detectSimulationConflicts(conflictInputs);

  const warnings: SimulationWarning[] = result.warnings.map((w) => ({
    code: "event_generation_warning",
    severity: "planning_note" as const,
    message: w,
  }));

  for (const note of result.validationNotes) {
    warnings.push({
      code: "event_validation_note",
      severity: "planning_note" as const,
      message: note,
    });
  }

  const poolValidation = validateEventPool(
    playersWithAttrs,
    event.squads.length,
    event.squads[0]?.targetSize ?? 5,
    gameFormat,
    [],
  );

  return {
    eventId: event.id,
    eventName: event.name,
    squads: simulatedSquads,
    helpers: [],
    poolValidation: {
      totalPlayers: poolValidation.availablePlayerCount,
      availablePlayers: poolValidation.availablePlayerCount,
      missingRatingsCount: poolValidation.missingRatingsCount,
      gkCoverageStatus:
        poolValidation.goalkeeperCoverage.sufficient ? "adequate" : "gap",
    },
    conflicts,
    warnings,
    valid: conflicts.filter((c) => c.type === "player_overuse_same_week").length === 0,
  };
}