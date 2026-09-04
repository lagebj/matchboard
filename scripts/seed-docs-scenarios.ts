/**
 * Scenario builder for the Fjordvik FK documentation dataset. Invoked by
 * seed-docs-dataset.ts once the organisation/teams/players/opponents exist. Builds the
 * DEMO_UNIVERSE.md S1-S7 scenarios using the real generation/finalization/reporting domain
 * operations wherever the operation exists, so derived state (draft selections, evidence)
 * matches actual product behaviour.
 */

type SeedContext = {
  db: any;
  rawDb: any;
  org: { id: string; slug: string };
  group: { id: string };
  teams: Array<{ id: string; name: string }>;
  players: Record<string, { id: string; team: { id: string; name: string } }>;
  eliasStorm: { id: string; team: { id: string; name: string } };
  theoFalk: { id: string; team: { id: string; name: string } };
  opponentIds: Record<string, string>;
  leagueSeason: { id: string };
  REF: Record<string, Date>;
};

function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `W${String(week).padStart(2, "0")} ${d.getUTCFullYear()}`;
}

export async function seedScenarios(ctx: SeedContext) {
  const { db, org, teams, players, eliasStorm, theoFalk, opponentIds, leagueSeason, REF } = ctx;
  // ARR-0029 "Bug 3": AsyncLocalStorage context set in main() does not propagate across the
  // separate .then() continuation this function is called from -- must be set again here.
  const { setTenantOrganisationId } = await import("../src/lib/tenancy/tenant-async-storage");
  setTenantOrganisationId(org.id);
  const { generateMatchRound } = await import("../src/lib/selection/generate-round");
  const { createGeneratedDraftRound } = await import("../src/lib/selection/save-generated-draft");
  const { persistRoundExplanations } = await import("../src/lib/selection/persist-explanations");
  const { buildPersistableWarnings, persistRoundWarnings } = await import("../src/lib/selection/persist-warnings");
  const { reconcileRoundAfterDraftMutation } = await import("../src/lib/selection/reconcile-integrity");
  const { ensureMatchPlanningBaselineCaptured } = await import("../src/lib/selection/capture-planning-baseline");

  // generateMatchRound() only computes a plan -- persisting draft Selection rows,
  // explanations, and plan-integrity warnings are separate steps every real caller
  // (src/app/(app)/rounds/actions.ts) performs afterward. Mirrored here so the seed produces
  // the same on-disk state a real "Generate round" action would.
  async function generateAndPersistRound(matchRoundId: string) {
    const generatedRound = await generateMatchRound(matchRoundId);
    await createGeneratedDraftRound(generatedRound);
    await persistRoundExplanations(generatedRound);

    const fullRound = await db.matchRound.findFirstOrThrow({
      where: { id: matchRoundId },
      include: { matches: { include: { team: { select: { id: true, name: true } } } } },
    });
    const matchIdByTeamName = new Map<string, string>();
    const teamIdByTeamName = new Map<string, string>();
    for (const match of fullRound.matches) {
      matchIdByTeamName.set(match.team.name, match.id);
      teamIdByTeamName.set(match.team.name, match.team.id);
    }
    const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName, org.id);
    await persistRoundWarnings(warnings);
    await reconcileRoundAfterDraftMutation(matchRoundId);

    return generatedRound;
  }
  const { seedReportFromFinalizedSquad, completeReport } = await import("../src/lib/reports/report-mutations");
  const { rebuildActualTimeline } = await import("../src/lib/evidence/actual-timeline");
  const { seedSystemFormations } = await import("../src/lib/formations/seed");
  const { generateEventSquads } = await import("../src/lib/events/event-squad-generation");
  const { toPlayerAttributeProfile } = await import("../src/lib/events/player-event-profile");

  const allPlayerIds = Object.values(players).map((p) => p.id);

  // Sets Player.currentAvailability directly -- the single field the real production
  // availability control (setPlayerAvailabilityAction -> setPlayerAvailability(),
  // src/lib/players/player-domain.ts) writes, and the only field generateSelection()'s
  // own eligibility loop reads. Not the round-scoped Availability Prisma model: that model has
  // no production write path anywhere in the app (ARR-0041) -- seeding rows into it here would
  // model a mechanism no real coach exercises, and (confirmed while investigating ARR-0041) can
  // trigger an unrelated default-policy signal via a separate, still-unfixed read of that same
  // table, producing a documentation example the real product would never show a coach.
  async function markAllAvailable(unavailablePlayerIds: string[] = []) {
    const unavailable = new Set(unavailablePlayerIds);
    await db.player.updateMany({
      where: { id: { in: allPlayerIds } },
      data: { currentAvailability: "AVAILABLE" },
    });
    if (unavailable.size > 0) {
      await db.player.updateMany({
        where: { id: { in: [...unavailable] } },
        data: { currentAvailability: "UNAVAILABLE" },
      });
    }
  }

  async function createHistoricalMatch(opts: {
    weekLabel: string;
    date: Date;
    team: { id: string };
    opponentKey: string;
    homeAway: "HOME" | "AWAY";
    homeGoals: number;
    awayGoals: number;
    scorerName?: string;
    assistName?: string;
  }) {
    const round = await db.matchRound.create({
      data: { name: opts.weekLabel, leagueSeasonId: leagueSeason.id, organisationId: org.id, status: "DRAFT" },
    });
    const match = await db.match.create({
      data: {
        matchRoundId: round.id,
        teamId: opts.team.id,
        opponent: OPPONENT_DISPLAY[opts.opponentKey],
        opponentTeamId: opponentIds[opts.opponentKey],
        startsAt: opts.date,
        homeAway: opts.homeAway,
        matchType: "LEAGUE",
        gameFormat: "SEVEN_A_SIDE",
        squadSize: 9,
        organisationId: org.id,
      },
    });
    await markAllAvailable();
    await generateAndPersistRound(round.id);
    // This historical round intentionally schedules only one Fjordvik FK team, so capturing this
    // match's baseline also closes the (single-match) round automatically.
    const captureResult = await ensureMatchPlanningBaselineCaptured(match.id, { force: true });
    if (!captureResult.captured) throw new Error(`Failed to capture planning baseline for ${opts.weekLabel}`);

    const seeded = await seedReportFromFinalizedSquad(match.id, { type: "org", filter: { organisationId: org.id }, filterNullable: { organisationId: org.id }, organisationId: org.id });
    if (!seeded.success) throw new Error(`Failed to seed report for ${opts.weekLabel}: ${seeded.error}`);

    const report = await db.postMatchReport.findFirstOrThrow({ where: { matchId: match.id } });
    await db.postMatchPlayerActual.updateMany({ where: { reportId: report.id }, data: { attendanceStatus: "PRESENT" } });
    await db.postMatchReport.update({ where: { id: report.id }, data: { homeGoals: opts.homeGoals, awayGoals: opts.awayGoals } });

    const ourGoals = opts.homeAway === "HOME" ? opts.homeGoals : opts.awayGoals;
    if (ourGoals > 0 && opts.scorerName) {
      const goal = await db.goal.create({ data: { organisationId: org.id, reportId: report.id, playerId: players[opts.scorerName].id, minute: 34 } });
      if (opts.assistName) {
        await db.assist.create({ data: { organisationId: org.id, reportId: report.id, playerId: players[opts.assistName].id } });
      }
    }

    const completed = await completeReport(report.id, "docs-coach@docs-agent.matchboard.football");
    if (!completed.success) throw new Error(`Failed to complete report for ${opts.weekLabel}: ${completed.error}`);

    return { round, match, report };
  }

  const OPPONENT_DISPLAY: Record<string, string> = {
    "stormhavn il": "Stormhavn IL",
    "solsiden sk": "Solsiden SK",
    "skogheim fk": "Skogheim FK",
    "bergstad if": "Bergstad IF",
    "havørn fk": "Havørn FK",
    "granli il": "Granli IL",
  };

  // ============ S5: opponent evidence history (three prior meetings + the connected story match) ============
  console.log("Seeding historical matches against Bergstad IF...");
  await createHistoricalMatch({
    weekLabel: isoWeekLabel(REF.historical1),
    date: REF.historical1,
    team: teams[0],
    opponentKey: "bergstad if",
    homeAway: "AWAY",
    homeGoals: 2,
    awayGoals: 1,
    scorerName: "Elias Storm",
  });
  await createHistoricalMatch({
    weekLabel: isoWeekLabel(REF.historical2),
    date: REF.historical2,
    team: teams[0],
    opponentKey: "bergstad if",
    homeAway: "HOME",
    homeGoals: 2,
    awayGoals: 2,
    scorerName: "Mateo Silva",
    assistName: "Theo Falk",
  });
  await createHistoricalMatch({
    weekLabel: isoWeekLabel(REF.historical3),
    date: REF.historical3,
    team: teams[1],
    opponentKey: "bergstad if",
    homeAway: "AWAY",
    homeGoals: 1,
    awayGoals: 0,
  });

  // A little variety against other opponents in the same historical window (S7: historical
  // immutable state — these finalized, completed rounds are never touched again by this script).
  await createHistoricalMatch({
    weekLabel: isoWeekLabel(REF.historicalGranli),
    date: REF.historicalGranli,
    team: teams[2],
    opponentKey: "granli il",
    homeAway: "HOME",
    homeGoals: 3,
    awayGoals: 1,
    scorerName: "Filip Solberg",
  });

  // ============ S3 + S4: the connected story match (Fjordvik Rød vs Bergstad IF, 4th meeting) ============
  console.log("Seeding the connected story match (W19, Fjordvik Rød vs Bergstad IF)...");
  const storyWeek = isoWeekLabel(REF.story);
  const storyRound = await db.matchRound.create({
    data: { name: storyWeek, leagueSeasonId: leagueSeason.id, organisationId: org.id, status: "DRAFT" },
  });
  const storyMatch = await db.match.create({
    data: {
      matchRoundId: storyRound.id,
      teamId: teams[0].id,
      opponent: "Bergstad IF",
      opponentTeamId: opponentIds["bergstad if"],
      startsAt: REF.story,
      homeAway: "HOME",
      matchType: "LEAGUE",
      gameFormat: "SEVEN_A_SIDE",
      squadSize: 9,
      organisationId: org.id,
    },
  });
  await markAllAvailable();
  await generateAndPersistRound(storyRound.id);
  const storyCaptureResult = await ensureMatchPlanningBaselineCaptured(storyMatch.id, { force: true });
  if (!storyCaptureResult.captured) throw new Error("Failed to capture planning baseline for story round");

  await seedSystemFormations();
  const formation = await db.formation.findFirst({ where: { gameFormat: "SEVEN_A_SIDE", source: "SYSTEM", isArchived: false }, include: { slots: { orderBy: { sortOrder: "asc" } } } });
  if (!formation) throw new Error("No SEVEN_A_SIDE system formation available after seedSystemFormations().");

  const rodSelections = await db.selection.findMany({ where: { matchId: storyMatch.id }, select: { playerId: true } });
  const rodPlayerIds = rodSelections.map((s: { playerId: string }) => s.playerId);

  const lineup = await db.matchLineup.create({
    data: { organisationId: org.id, matchId: storyMatch.id, teamId: teams[0].id, formationId: formation.id, status: "CONFIRMED" },
  });
  const slotAssignments: Array<{ matchLineupId: string; slotId: string; playerId: string; organisationId: string }> = [];
  for (let i = 0; i < formation.slots.length && i < rodPlayerIds.length; i++) {
    slotAssignments.push({ matchLineupId: lineup.id, slotId: formation.slots[i].id, playerId: rodPlayerIds[i], organisationId: org.id });
  }
  // Ensure Elias Storm and Theo Falk are both on the pitch, for the position-swap rotation below.
  const eliasSlot = slotAssignments.find((a) => a.playerId === eliasStorm.id) ?? slotAssignments[0];
  eliasSlot.playerId = eliasStorm.id;
  const theoSlot = slotAssignments.find((a) => a.playerId === theoFalk.id && a !== eliasSlot) ?? slotAssignments[1];
  theoSlot.playerId = theoFalk.id;
  await db.matchLineupAssignment.createMany({ data: slotAssignments });

  // The planned/actual position-only rotation the connected story describes (Working with
  // Matchboard, Rotations; How Matchboard works/Rotation engine): Elias Storm was planned to
  // swap with Theo Falk at 30 minutes; the coach applied it three minutes later than planned.
  // Both halves of the story are real, seeded records -- a PlannedRotation/PlannedRotationChange
  // (the pre-match plan) and a MatchRotation with source LIVE (what actually happened) -- not
  // only the actual event, so "Rotations" and "Rotation engine"'s plan-vs-actual claims have a
  // genuine PlannedRotation behind them, not just prose.
  const eliasFormationSlot = formation.slots.find((s: { id: string }) => s.id === eliasSlot.slotId)!;
  const theoFormationSlot = formation.slots.find((s: { id: string }) => s.id === theoSlot.slotId)!;

  const { createPlannedRotation } = await import("../src/lib/planned-rotation/planned-rotation");
  const orgFilter = {
    type: "org" as const,
    filter: { organisationId: org.id },
    filterNullable: { organisationId: org.id },
    organisationId: org.id,
  };
  const plannedRotationResult = await createPlannedRotation(
    {
      matchId: storyMatch.id,
      teamId: teams[0].id,
      notes: "Move Elias wide once Bergstad settle into their shape; Theo covers centrally.",
      changes: [
        {
          outPlayerId: eliasStorm.id,
          inPlayerId: theoFalk.id,
          outPosition: eliasFormationSlot.label,
          inPosition: theoFormationSlot.label,
          positionOnly: true,
          approximateMatchSeconds: 30 * 60,
          notes: null,
        },
      ],
    },
    orgFilter,
  );
  if (!plannedRotationResult.success) throw new Error(`Failed to seed planned rotation: ${plannedRotationResult.error}`);

  await db.matchRotation.create({
    data: {
      organisationId: org.id,
      matchId: storyMatch.id,
      outPlayerId: eliasStorm.id,
      inPlayerId: theoFalk.id,
      outPosition: eliasFormationSlot.label,
      inPosition: theoFormationSlot.label,
      positionOnly: true,
      period: 2,
      matchSeconds: 33 * 60,
      source: "LIVE",
    },
  });

  // Records the plan as applied -- three minutes later than intended -- matching the actual
  // MatchRotation just created, rather than leaving the plan looking un-acted-on.
  await db.plannedRotationChange.updateMany({
    where: { plannedRotationId: plannedRotationResult.rotation.id },
    data: { status: "APPLIED", actualMatchSeconds: 33 * 60 },
  });

  await rebuildActualTimeline(storyMatch.id);

  const storySeeded = await seedReportFromFinalizedSquad(storyMatch.id, { type: "org", filter: { organisationId: org.id }, filterNullable: { organisationId: org.id }, organisationId: org.id });
  if (!storySeeded.success) throw new Error(`Failed to seed story match report: ${storySeeded.error}`);
  const storyReport = await db.postMatchReport.findFirstOrThrow({ where: { matchId: storyMatch.id } });
  await db.postMatchPlayerActual.updateMany({ where: { reportId: storyReport.id }, data: { attendanceStatus: "PRESENT" } });
  await db.postMatchReport.update({ where: { id: storyReport.id }, data: { homeGoals: 3, awayGoals: 1 } });
  await db.goal.create({ data: { organisationId: org.id, reportId: storyReport.id, playerId: eliasStorm.id, minute: 12 } });
  await db.goal.create({ data: { organisationId: org.id, reportId: storyReport.id, playerId: theoFalk.id, minute: 41 } });
  await db.assist.create({ data: { organisationId: org.id, reportId: storyReport.id, playerId: eliasStorm.id } });
  await db.goal.create({ data: { organisationId: org.id, reportId: storyReport.id, playerId: null, minute: 55, type: "OWN_GOAL" } });

  // Football observation (post-match): matches the DOCUMENTATION_MESSAGE.md/DEMO_UNIVERSE.md
  // connected story exactly. This mirrors football-observation-service.ts's own field mapping
  // (kind/attributeKey/direction) rather than calling the service directly -- it requires a real
  // Auth.js request session (requireActorContext()), which a seed script does not have.
  await db.playerDevelopmentObservation.create({
    data: {
      organisationId: org.id,
      playerId: eliasStorm.id,
      sourceType: "LEAGUE_MATCH",
      matchId: storyMatch.id,
      kind: "ATTRIBUTE",
      attributeKey: "TEAM_COMBINATION_EFFECTIVE",
      direction: "POSITIVE",
      observableNote: "Adjusted well to the wide role after switching with Theo Falk — kept combining with teammates instead of forcing it alone.",
      observedAt: new Date(REF.story.getTime() + 70 * 60 * 1000),
      recordedBy: "docs-coach@docs-agent.matchboard.football",
    },
  });

  const completedStory = await completeReport(storyReport.id, "docs-coach@docs-agent.matchboard.football");
  if (!completedStory.success) throw new Error(`Failed to complete story report: ${completedStory.error}`);

  // ============ S1 + S2: upcoming round (draft), one match already finalized as "ready" ============
  console.log("Seeding the upcoming round (W20, draft with one finalized match)...");
  const upcomingWeek = isoWeekLabel(REF.upcomingRod);
  const upcomingRound = await db.matchRound.create({
    data: { name: upcomingWeek, leagueSeasonId: leagueSeason.id, organisationId: org.id, status: "DRAFT" },
  });
  await db.match.create({
    data: {
      matchRoundId: upcomingRound.id, teamId: teams[0].id, opponent: "Stormhavn IL", opponentTeamId: opponentIds["stormhavn il"],
      startsAt: REF.upcomingRod, homeAway: "HOME", matchType: "LEAGUE", gameFormat: "SEVEN_A_SIDE", squadSize: 9, organisationId: org.id,
    },
  });
  const blaMatch = await db.match.create({
    data: {
      matchRoundId: upcomingRound.id, teamId: teams[1].id, opponent: "Solsiden SK", opponentTeamId: opponentIds["solsiden sk"],
      startsAt: REF.upcomingBla, homeAway: "AWAY", matchType: "LEAGUE", gameFormat: "SEVEN_A_SIDE", squadSize: 9, organisationId: org.id,
    },
  });
  const hvitMatch = await db.match.create({
    data: {
      matchRoundId: upcomingRound.id, teamId: teams[2].id, opponent: "Skogheim FK", opponentTeamId: opponentIds["skogheim fk"],
      startsAt: REF.upcomingHvit, homeAway: "HOME", matchType: "LEAGUE", gameFormat: "SEVEN_A_SIDE", squadSize: 9, organisationId: org.id,
    },
  });

  // Two Fjordvik Blå players unavailable — below target but still playable (a planning note,
  // not a blocker), and enough of a gap that the active support rotation path to Blå gets used.
  const blaPlayerIds = Object.values(players).filter((p) => p.team.id === teams[1].id).map((p) => p.id);
  await markAllAvailable(blaPlayerIds.slice(0, 1));
  await generateAndPersistRound(upcomingRound.id);

  // Close planning only for the Hvit match ("ready"/planning-closed — S2); Rød/Blå stay open
  // (DRAFT) for review (S1).
  const hvitCaptureResult = await ensureMatchPlanningBaselineCaptured(hvitMatch.id, { force: true });
  if (!hvitCaptureResult.captured) throw new Error("Failed to capture planning baseline for the Hvit match");
  void blaMatch;

  // ============ S6: event/cup ============
  console.log("Seeding the Fjord Cup event...");
  const event = await db.event.create({
    data: {
      organisationId: org.id, name: "Fjord Cup", eventType: "CUP", startsAt: REF.event,
      gameFormat: "SEVEN_A_SIDE", matchDurationMinutes: 40, selectionPattern: "ONE_COMPETITIVE_BALANCED_REMAINDER", footballGroupId: ctx.group.id,
    },
  });
  await db.eventPlayerAvailability.createMany({
    data: allPlayerIds.map((playerId) => ({ organisationId: org.id, eventId: event.id, playerId, status: "AVAILABLE" })),
  });
  const competitiveSquad = await db.eventSquad.create({
    data: { organisationId: org.id, eventId: event.id, name: "Fjordvik FK Cup Squad", intent: "COMPETITIVE", targetSize: 9, minSize: 7, maxSize: 12, generationOrder: 0 },
  });
  const balancedSquad = await db.eventSquad.create({
    data: { organisationId: org.id, eventId: event.id, name: "Fjordvik FK Development Squad", intent: "BALANCED", targetSize: 9, minSize: 7, maxSize: 12, generationOrder: 1 },
  });

  const allPlayers = await db.player.findMany({ where: { organisationId: org.id } });
  const eventFormation = await db.formation.findFirst({ where: { gameFormat: "SEVEN_A_SIDE", source: "SYSTEM", isArchived: false }, include: { slots: true } });
  const generation = generateEventSquads({
    eventId: event.id,
    players: allPlayers.map((p: any) => toPlayerAttributeProfile(p)),
    formations: eventFormation ? [eventFormation] : [],
    defaultFormationId: eventFormation?.id ?? null,
    squads: [
      { id: competitiveSquad.id, name: competitiveSquad.name, intent: "COMPETITIVE", targetSize: 9, minSize: 7, maxSize: 12, formationId: eventFormation?.id ?? null, generationOrder: 0 },
      { id: balancedSquad.id, name: balancedSquad.name, intent: "BALANCED", targetSize: 9, minSize: 7, maxSize: 12, formationId: eventFormation?.id ?? null, generationOrder: 1 },
    ],
    selectionPattern: "ONE_COMPETITIVE_BALANCED_REMAINDER",
    lockedAssignments: new Map(),
    includeReserves: false,
    includeLateAdditions: false,
    gameFormat: "SEVEN_A_SIDE",
  });

  for (const assignment of generation.assignments) {
    await db.eventSquadPlayer.create({
      data: {
        organisationId: org.id,
        eventId: event.id,
        eventSquadId: assignment.eventSquadId,
        playerId: assignment.playerId,
        assignedRoleType: assignment.assignedRoleType,
        assignedPositionId: assignment.assignedPositionId,
        assignedSlotIndex: assignment.assignedSlotIndex,
        assignedSlotLabel: assignment.assignedSlotLabel,
        lineupOrder: assignment.lineupOrder,
        source: assignment.source,
        locked: assignment.locked,
        selectionReason: assignment.selectionReason,
        positionFitTier: assignment.positionFitTier,
      },
    });
  }
  for (const summary of generation.balanceSummaries) {
    await db.eventSquad.update({ where: { id: summary.squadId }, data: { balanceSummary: summary as any } });
  }
  await db.eventMatch.create({
    data: {
      organisationId: org.id, eventId: event.id, eventSquadId: competitiveSquad.id, category: "CUP",
      opponentName: "Havørn FK", opponentTeamId: opponentIds["havørn fk"], startsAt: REF.event,
    },
  });

  console.log("Scenarios seeded: S1 (upcoming round), S2 (ready match), S3 (recordable match), S4 (completed + reflection), S5 (opponent history), S6 (event), S7 (historical immutable state).");
}
