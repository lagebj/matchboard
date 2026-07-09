import { notFound } from "next/navigation";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { isFloatingSelectionRole } from "@/lib/match-utils";
import { getPlayerAllTimeStats } from "@/lib/selection/effective-participation";
import { getPlayerCategoryStats } from "@/lib/stats/player-category-stats";
import { getPlayerSelectionInvolvement } from "@/lib/players/get-player-selection-involvement";
import { availabilityOptions, playerPositionOptions, optionalPlayerPositionOptions, preferredFootOptions, secondaryFootOptions as secondaryFootOpts, bestSideOptions, goalkeeperAbilityOptions } from "@/lib/player-form-options";

import { PlayerProfileLayout } from "@/components/players/player-profile-layout";
import { PlayerProfileHeader } from "@/components/players/player-profile-header";
import { PlayerIdentityPanel } from "@/components/players/player-identity-panel";
import { PlayerCoachingSignalsPanel } from "@/components/players/player-coaching-signals-panel";
import { PlayerStatsPanel } from "@/components/players/player-stats-panel";
import { PlayerCurrentInvolvementPanel } from "@/components/players/player-current-involvement-panel";
import { PlayerMovementHistoryPanel } from "@/components/players/player-movement-history-panel";
import { PlayerExplanationsPanel } from "@/components/players/player-explanations-panel";
import { PlayerSquadContextPanel } from "@/components/players/player-squad-context-panel";

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

  const [player, teams, orderedPlayerIds, finalizedHistory, savedInvolvementSnapshots, movementHistory, recentExplanationsRaw, actualStats, readinessSignals, categoryStats] = await Promise.all([
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
      where: { playerId, status: SelectionStatus.FINALIZED },
      select: { id: true, role: true, match: { select: { id: true, opponent: true, startsAt: true } } },
      orderBy: [{ match: { startsAt: "desc" } }],
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
    db.movementLedger.findMany({
      where: { playerId },
      include: {
        match: { select: { id: true, opponent: true, startsAt: true, team: { select: { id: true, name: true } } } },
        fromTeam: { select: { id: true, name: true } },
        toTeam: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    }),
    db.selection.findMany({
      where: { playerId },
      select: {
        id: true,
        role: true,
        explanation: true,
        overrideReason: true,
        match: { select: { id: true, opponent: true, startsAt: true, team: { select: { name: true } } } },
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    }),
    getPlayerAllTimeStats(playerId),
    db.playerReadinessSignal.findMany({
      where: { playerId },
      orderBy: { signalType: "asc" },
    }),
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

  const _totalFinalized = finalizedHistory.length;
  const totalFloating = finalizedHistory.filter((e) => isFloatingSelectionRole(e.role)).length;
  const coreCount = finalizedHistory.filter((e) => e.role === SelectionRole.CORE).length;
  const supportCount = finalizedHistory.filter((e) => e.role === SelectionRole.SUPPORT).length;
  const devCount = finalizedHistory.filter((e) => e.role === SelectionRole.DEVELOPMENT).length;
  const lastFinalized = finalizedHistory[0] ?? null;

  const savedInvolvement = getPlayerSelectionInvolvement(savedInvolvementSnapshots);
  const draftInvolvement = savedInvolvement
    .filter((e) => e.status === SelectionStatus.DRAFT)
    .sort((a, b) => a.matchStartsAt.getTime() - b.matchStartsAt.getTime());
  const finalizedInvolvement = savedInvolvement
    .filter((e) => e.status === SelectionStatus.FINALIZED)
    .sort((a, b) => b.matchStartsAt.getTime() - a.matchStartsAt.getTime());
  const involvementPreview = [...draftInvolvement, ...finalizedInvolvement];

  const planningFlags: string[] = [];
  if (player.nonRotatable) planningFlags.push("Non-rotatable");
  if (player.reducedMatchLoadAllowed) planningFlags.push("Reduced load");
  if (player.supportNoShowCount > 0) planningFlags.push(player.supportNoShowCount + " no-show(s)");
  if (player.supportSuitability && player.supportSuitability !== "neutral") planningFlags.push("Support " + player.supportSuitability);
  if (player.developmentReadiness && player.developmentReadiness !== "neutral") planningFlags.push("Dev " + player.developmentReadiness);

  const recentExplanations = recentExplanationsRaw
    .filter((sel) => sel.explanation !== null || sel.overrideReason !== null)
    .slice(0, 10)
    .map((sel) => ({
      id: sel.id,
      role: sel.role,
      explanation: typeof sel.explanation === "string" ? sel.explanation : sel.explanation ? JSON.stringify(sel.explanation) : null,
      overrideReason: sel.overrideReason,
      matchDate: sel.match.startsAt,
      matchId: sel.match.id,
      teamName: sel.match.team.name,
      opponent: sel.match.opponent,
    }));

  const movementEntries = movementHistory.map((entry) => ({
    id: entry.id,
    fromTeamName: entry.fromTeam.name,
    toTeamName: entry.toTeam.name,
    role: entry.role,
    matchDate: entry.match.startsAt,
    matchId: entry.match.id,
    isDraft: entry.isDraft,
  }));

  const mappedInvolvement = involvementPreview.map((entry) => ({
    matchId: entry.matchId,
    matchStartsAt: entry.matchStartsAt,
    teamName: entry.teamName,
    opponent: entry.opponent,
    role: entry.role,
    status: entry.status,
  }));

  const lastFinalizedStr = lastFinalized
    ? `${formatDate(lastFinalized.match.startsAt)} vs ${lastFinalized.match.opponent}`
    : null;

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
          <PlayerIdentityPanel
            player={player}
            teams={teams}
            availabilityOptions={availabilityOptions}
            positionOptions={playerPositionOptions}
            optionalPositionOptions={optionalPlayerPositionOptions}
            footOptions={preferredFootOptions}
            secondaryFootOptions={secondaryFootOpts}
            bestSideOptions={bestSideOptions}
            goalkeeperAbilityOptions={goalkeeperAbilityOptions}
            updateFieldAction={updatePlayerFieldAction}
          />
        }
        center={
          <div className="flex flex-col gap-3">
            <PlayerCurrentInvolvementPanel involvement={mappedInvolvement} />
            <PlayerCoachingSignalsPanel
              playerId={player.id}
              signals={readinessSignals.map((s) => ({ id: s.id, signalType: s.signalType, value: s.value, note: s.note }))}
            />
            <PlayerExplanationsPanel explanations={recentExplanations} />
          </div>
        }
        right={
          <div className="flex flex-col gap-3">
            <PlayerStatsPanel
              selectionStatus={{
                total: savedInvolvement.length,
                draft: draftInvolvement.length,
                finalized: finalizedInvolvement.length,
                floating: totalFloating,
              }}
              finalizedHistory={{
                core: coreCount,
                support: supportCount,
                development: devCount,
                lastMatch: lastFinalizedStr,
              }}
              stats={actualStats}
              categoryStats={categoryStats}
            />
            <PlayerMovementHistoryPanel movementHistory={movementEntries} />
            <PlayerSquadContextPanel
              rotationPaths={mappedRotationPaths}
              movementCandidates={mappedMovementCandidates}
              coreTeamId={player.coreTeamId}
            />
          </div>
        }
      />
    </div>
  );
}