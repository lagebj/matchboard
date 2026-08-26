import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PostMatchPage } from "@/components/assistant/post-match-page";
import { MatchFeedbackSection } from "@/components/matches/match-feedback-section";
import { TeamReflectionSection } from "@/components/matches/team-reflection-section";
import { ObservationSection } from "@/components/opponents/observation-section";
import { FootballObservationSection } from "@/components/player-development/football-observation-section";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { ALL_OBSERVATION_CODES } from "@/lib/evidence/observation-vocabulary";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgSlug: string; matchId: string }>;
};

export default async function PostMatchRoute({ params }: PageProps) {
  const { orgSlug, matchId } = await params;

  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const match = await db.match.findFirst({
    where: {
      id: matchId,
      ...ctx.orgFilter.filter,
    },
    select: {
      id: true,
      teamId: true,
      opponent: true,
      homeAway: true,
      matchFit: true,
      team: { select: { id: true, name: true } },
      selections: {
        where: { status: "FINALIZED" },
        select: {
          playerId: true,
          role: true,
          player: {
            select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
          },
        },
        orderBy: [{ role: "asc" }],
      },
    },
  });

  if (!match) notFound();

  const report = await db.postMatchReport.findFirst({
    where: { matchId, ...ctx.orgFilter.filterNullable },
    include: {
      playerActuals: {
        include: {
          player: {
            select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
          },
        },
      },
      goals: {
        include: {
          player: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: [{ minute: "asc" }],
      },
      assists: {
        include: {
          player: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      absences: {
        include: {
          player: {
            select: { firstName: true, lastName: true, coreTeam: { select: { name: true } } },
          },
        },
      },
      playerStats: {
        include: {
          player: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  const plannedSelections = match.selections.map((s) => ({
    playerId: s.playerId,
    playerName: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
    coreTeamName: s.player.coreTeam?.name ?? "Unassigned",
    role: s.role,
  }));

  const initialReport = report ? {
    id: report.id,
    matchId: report.matchId,
    status: report.status,
    homeGoals: report.homeGoals,
    awayGoals: report.awayGoals,
    teamNote: report.teamNote,
    completedBy: report.completedBy,
    completedAt: report.completedAt?.toISOString() ?? null,
    playerActuals: report.playerActuals.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      playerName: `${p.player.firstName} ${p.player.lastName ?? ""}`.trim(),
      coreTeamName: p.player.coreTeam?.name ?? "Unassigned",
      source: p.source,
      attendanceStatus: p.attendanceStatus,
      unplannedAppearanceReason: p.unplannedAppearanceReason,
    })),
    goals: report.goals.map((g) => ({
      id: g.id,
      playerId: g.playerId,
      playerName: g.player ? `${g.player.firstName} ${g.player.lastName ?? ""}`.trim() : undefined,
      minute: g.minute,
      type: g.type,
    })),
    assists: report.assists.map((a) => ({
      id: a.id,
      playerId: a.playerId,
      playerName: `${a.player.firstName} ${a.player.lastName ?? ""}`.trim(),
      type: a.type,
    })),
    absences: report.absences.map((a) => ({
      id: a.id,
      playerId: a.playerId,
      playerName: `${a.player.firstName} ${a.player.lastName ?? ""}`.trim(),
      coreTeamName: a.player.coreTeam?.name ?? "Unassigned",
      reason: a.reason,
      note: a.note,
    })),
    playerStats: report.playerStats.map((s) => ({
      id: s.id,
      playerId: s.playerId,
      playerName: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
      goals: s.goals,
      assists: s.assists,
    })),
    teamName: match.team.name,
    opponent: match.opponent,
    homeAway: match.homeAway,
    plannedSelections,
  } : null;

  const [feedbackEntries, teamReflection, existingObservation, footballObservations] = await Promise.all([
    db.matchExecutionFeedback.findMany({
      where: { matchId },
      orderBy: [{ category: "asc" }, { playerId: "asc" }],
      select: {
        id: true,
        playerId: true,
        category: true,
        value: true,
        observableBehavior: true,
        nextAction: true,
        note: true,
      },
    }),
    db.teamReflection.findFirst({
      where: { matchId, ...ctx.orgFilter.filterNullable },
      select: { id: true, effort: true, teamCohesion: true, positionalShape: true, recoveryBehavior: true, note: true },
    }),
    db.opponentEncounterObservation.findFirst({
      where: { matchId, ...ctx.orgFilter.filterNullable },
      select: {
        id: true,
        overallEnvironment: true,
        opponentPlayersContext: true,
        opponentStaffContext: true,
        spectatorSidelineContext: true,
        concernCategories: true,
        factualSummary: true,
        followUp: true,
      },
    }),
    db.playerDevelopmentObservation.findMany({
      where: {
        matchId,
        kind: "ATTRIBUTE",
        attributeKey: { in: [...ALL_OBSERVATION_CODES] },
        ...ctx.orgFilter.filter,
      },
      orderBy: { observedAt: "desc" },
      select: {
        id: true,
        playerId: true,
        attributeKey: true,
        direction: true,
        observableNote: true,
        observedAt: true,
      },
    }),
  ]);

  const feedbackData = feedbackEntries.map((f) => ({
    id: f.id,
    playerId: f.playerId,
    category: f.category,
    value: f.value,
    observableBehavior: f.observableBehavior,
    nextAction: f.nextAction,
    note: f.note,
  }));

  const playerOptions = report
    ? report.playerActuals
        .filter((p) => p.attendanceStatus === "PRESENT")
        .map((p) => ({
          id: p.playerId,
          name: `${p.player.firstName} ${p.player.lastName ?? ""}`.trim(),
        }))
    : match.selections.map((s) => ({
        id: s.playerId,
        name: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
      }));

  const allPlayers = await db.player.findMany({
    where: { removedAt: null, active: true },
    select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }],
  });

  const allPlayerOptions = allPlayers.map((p) => ({
    id: p.id,
    name: `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`,
    teamName: p.coreTeam?.name ?? "Unassigned",
  }));

  const reflectionData = teamReflection
    ? {
        effort: teamReflection.effort,
        teamCohesion: teamReflection.teamCohesion,
        positionalShape: teamReflection.positionalShape,
        recoveryBehavior: teamReflection.recoveryBehavior,
        note: teamReflection.note,
      }
    : null;

  const footballObservationData = footballObservations.map((o) => ({
    id: o.id,
    playerId: o.playerId,
    observationCode: o.attributeKey ?? "",
    polarity: o.direction,
    note: o.observableNote,
    observedAt: o.observedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <PostMatchPage matchId={matchId} initialReport={initialReport} allPlayers={allPlayerOptions} hasFinalizedSelections={match.selections.length > 0} />
      <ObservationSection
        matchId={matchId}
        existingObservation={existingObservation}
        isLocked={initialReport?.status === "LOCKED"}
        matchFit={match.matchFit}
      />
      <MatchFeedbackSection matchId={matchId} feedback={feedbackData} players={playerOptions} />
      <FootballObservationSection
        matchId={matchId}
        players={playerOptions}
        existingObservations={footballObservationData}
        isLocked={initialReport?.status === "LOCKED"}
      />
      <TeamReflectionSection matchId={matchId} reflection={reflectionData} />
    </div>
  );
}