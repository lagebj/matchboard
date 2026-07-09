import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPlayerCategoryStats } from "@/lib/stats/player-category-stats";
import { getPlayerAllTimeStats } from "@/lib/selection/effective-participation";
import { getPlayerSelectionInvolvement } from "@/lib/players/get-player-selection-involvement";
import { availabilityOptions, playerPositionOptions, optionalPlayerPositionOptions, preferredFootOptions, secondaryFootOptions, bestSideOptions, goalkeeperAbilityOptions } from "@/lib/player-form-options";

import { PlayerProfileLayout } from "@/components/players/player-profile-layout";
import { PlayerProfileHeader } from "@/components/players/player-profile-header";
import { PlayerPositionProfile } from "@/components/players/player-position-profile";
import { PlayerDetailsPanel } from "@/components/players/player-details-panel";
import { PlayerAttributesPanel } from "@/components/players/player-attributes-panel";
import { PlayerAvailabilityPanel } from "@/components/players/player-availability-panel";
import { CoachContextPanel as PlayerCoachContextPanel } from "@/components/players/player-coach-context-panel";
import { PlayerReportSummaryPanel } from "@/components/players/player-report-summary-panel";
import { PlayerSquadContextPanel } from "@/components/players/player-squad-context-panel";
import { PlayerCurrentInvolvementPanel } from "@/components/players/player-current-involvement-panel";
import { PlayerStatsSummaryTable } from "@/components/players/player-stats-summary-table";

import { updatePlayerFieldAction } from "./inline-actions";

type PlayerPageProps = {
  params: Promise<{
    playerId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

function formatSavedMessage(saved?: string): string | null {
  if (saved === "updated") return "Player updated.";
  if (saved === "status") return "Player status updated.";
  return null;
}

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const [{ playerId }, { error, saved }] = await Promise.all([params, searchParams]);

  const [player, teams, orderedPlayerIds, savedInvolvementSnapshots, actualStats, categoryStats] = await Promise.all([
    db.player.findFirst({
      where: { id: playerId, removedAt: null },
      include: { coreTeam: { select: { id: true, name: true } } },
    }),
    db.team.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.player.findMany({
      where: { removedAt: null },
      select: { id: true },
      orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }, { lastName: "asc" }, { playerCode: "asc" }],
    }),
    db.selection.findMany({
      where: { playerId },
      select: {
        createdAt: true,
        id: true,
        match: { select: { id: true, opponent: true, startsAt: true, team: { select: { name: true } } } },
        matchId: true,
        player: { select: { id: true, firstName: true, lastName: true } },
        role: true,
        status: true,
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    getPlayerAllTimeStats(playerId),
    getPlayerCategoryStats(playerId),
  ]);

  if (!player) notFound();

  const [rotationPaths, movementCandidates] = await Promise.all([
    db.rotationPath.findMany({
      where: {
        OR: [
          { fromTeamId: player.coreTeamId ?? "" },
          { toTeamId: player.coreTeamId ?? "" },
        ],
        fromTeam: { archivedAt: null },
        toTeam: { archivedAt: null },
      },
      include: {
        fromTeam: { select: { id: true, name: true } },
        toTeam: { select: { id: true, name: true } },
      },
      orderBy: [{ fromTeamId: "asc" }, { role: "asc" }],
    }),
    db.movementCandidate.findMany({
      where: { playerId },
      include: {
        rotationPath: {
          include: {
            fromTeam: { select: { name: true } },
            toTeam: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const orderedIds = orderedPlayerIds.map((entry) => entry.id);
  const currentPlayerIndex = orderedIds.indexOf(player.id);
  const previousPlayerId = currentPlayerIndex > 0 ? orderedIds[currentPlayerIndex - 1] : null;
  const nextPlayerId = currentPlayerIndex >= 0 && currentPlayerIndex < orderedIds.length - 1 ? orderedIds[currentPlayerIndex + 1] : null;

  const planningFlags: string[] = [];
  if (player.nonRotatable) planningFlags.push("Non-rotatable");
  if (player.reducedMatchLoadAllowed) planningFlags.push("Planning constraint");
  if (player.supportNoShowCount > 0) planningFlags.push(player.supportNoShowCount + " no-show(s)");
  if (player.supportSuitability && player.supportSuitability !== "neutral") planningFlags.push("Support " + player.supportSuitability);
  if (player.developmentReadiness && player.developmentReadiness !== "neutral") planningFlags.push("Dev " + player.developmentReadiness);

  const mappedRotationPaths = rotationPaths.map((rp) => ({
    id: rp.id,
    fromTeamName: rp.fromTeam.name,
    toTeamName: rp.toTeam.name,
    role: rp.role,
    active: rp.active,
  }));

  const mappedMovementCandidates = movementCandidates.map((mc) => ({
    id: mc.id,
    rotationPathId: mc.rotationPathId,
    fromTeamName: mc.rotationPath.fromTeam.name,
    toTeamName: mc.rotationPath.toTeam.name,
    role: mc.role,
    status: mc.status,
    rationaleCategory: mc.rationaleCategory,
    rationaleNote: mc.rationaleNote,
  }));

  const savedInvolvement = getPlayerSelectionInvolvement(savedInvolvementSnapshots);
  const involvementPreview = savedInvolvement
    .sort((a, b) => a.matchStartsAt.getTime() - b.matchStartsAt.getTime());

  const mappedInvolvement = involvementPreview.map((entry) => ({
    matchId: entry.matchId,
    matchStartsAt: entry.matchStartsAt,
    teamName: entry.teamName,
    opponent: entry.opponent,
    role: entry.role,
    status: entry.status,
  }));

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">{error}</div>}
      {formatSavedMessage(saved) && <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">{formatSavedMessage(saved)}</div>}

      <PlayerProfileHeader
        player={player}
        previousPlayerId={previousPlayerId}
        nextPlayerId={nextPlayerId}
        planningFlags={planningFlags}
      />

      <PlayerProfileLayout
        left={
          <div className="flex flex-col gap-3">
            <PlayerPositionProfile
              player={player}
              positionOptions={playerPositionOptions}
              optionalPositionOptions={optionalPlayerPositionOptions}
              updateFieldAction={updatePlayerFieldAction}
            />
            <PlayerCoachContextPanel
              player={player}
              updateFieldAction={updatePlayerFieldAction}
            />
            <PlayerSquadContextPanel
              rotationPaths={mappedRotationPaths}
              movementCandidates={mappedMovementCandidates}
              coreTeamId={player.coreTeamId}
            />
          </div>
        }
        center={
          <div className="flex flex-col gap-3">
            <PlayerDetailsPanel
              player={player}
              teams={teams}
              footOptions={preferredFootOptions}
              secondaryFootOptions={secondaryFootOptions}
              bestSideOptions={bestSideOptions}
              goalkeeperAbilityOptions={goalkeeperAbilityOptions}
              updateFieldAction={updatePlayerFieldAction}
            />
            <PlayerReportSummaryPanel
              player={player}
            />
            <PlayerCurrentInvolvementPanel involvement={mappedInvolvement} />
          </div>
        }
        right={
          <div className="flex flex-col gap-3">
            <PlayerAvailabilityPanel
              player={player}
              availabilityOptions={availabilityOptions}
              updateFieldAction={updatePlayerFieldAction}
            />
            <PlayerAttributesPanel
              player={player}
              updateFieldAction={updatePlayerFieldAction}
            />
          </div>
        }
      />

      <PlayerStatsSummaryTable
        stats={actualStats}
        categoryStats={categoryStats}
      />
    </div>
  );
}