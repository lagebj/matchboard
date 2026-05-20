import Link from "next/link";
import { notFound } from "next/navigation";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { removePlayerAction, togglePlayerActiveAction, updatePlayerAction } from "@/app/(app)/players/actions";
import { PlayerEditorForm } from "@/components/players/player-editor-form";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { formatSelectionRole, isFloatingSelectionRole, formatExplanation } from "@/lib/match-utils";
import { getPlayerSelectionInvolvement } from "@/lib/players/get-player-selection-involvement";
import {
  formatAvailabilityStatus,
  formatBestSide,
  formatPlayerName,
  formatPreferredFoot,
  formatSecondaryFoot,
  getOverallStarRating,
  getPlayerAttributeAverages,
  getPlayerPositionSummary,
} from "@/lib/player-metrics";
import { getPlayerAllTimeStats } from "@/lib/selection/effective-participation";
import { ReadinessSignalEditor } from "@/components/players/readiness-signal-editor";

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

function formatRoleCount(history: Array<{ role: SelectionRole }>, roleType: SelectionRole): number {
  return history.filter((entry) => entry.role === roleType).length;
}

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const [{ playerId }, { error, saved }] = await Promise.all([params, searchParams]);

  const [player, teams, orderedPlayerIds, finalizedHistory, savedInvolvementSnapshots, movementHistory, recentExplanationsRaw, actualStats, readinessSignals] = await Promise.all([
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
  ]);

  if (!player) notFound();

  const recentExplanations = recentExplanationsRaw.filter((sel) => sel.explanation !== null || sel.overrideReason !== null).slice(0, 10);
  const averages = getPlayerAttributeAverages(player);
  const overallStars = getOverallStarRating(averages.overall);
  const orderedIds = orderedPlayerIds.map((entry) => entry.id);
  const currentPlayerIndex = orderedIds.indexOf(player.id);
  const previousPlayerId = currentPlayerIndex > 0 ? orderedIds[currentPlayerIndex - 1] : null;
  const nextPlayerId = currentPlayerIndex >= 0 && currentPlayerIndex < orderedIds.length - 1 ? orderedIds[currentPlayerIndex + 1] : null;
  const saveAction = updatePlayerAction.bind(null, player.id);
  const toggleAction = togglePlayerActiveAction.bind(null, player.id);
  const removeAction = removePlayerAction.bind(null, player.id);

  const _totalFinalized = finalizedHistory.length;
  const totalFloating = finalizedHistory.filter((e) => isFloatingSelectionRole(e.role)).length;
  const coreCount = formatRoleCount(finalizedHistory, SelectionRole.CORE);
  const supportCount = formatRoleCount(finalizedHistory, SelectionRole.SUPPORT);
  const devCount = formatRoleCount(finalizedHistory, SelectionRole.DEVELOPMENT);
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

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">{error}</div>}
      {formatSavedMessage(saved) && <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">{formatSavedMessage(saved)}</div>}

      {/* Header strip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-zinc-50">{formatPlayerName(player)}</h1>
          <span className="rounded border border-zinc-700/50 bg-zinc-800/30 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">{player.coreTeam?.name ?? "Unassigned"}</span>
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
            player.currentAvailability === "AVAILABLE"
              ? "border-emerald-700/40 bg-emerald-900/20 text-emerald-300"
              : "border-amber-700/40 bg-amber-900/20 text-amber-300"
          }`}>{formatAvailabilityStatus(player.currentAvailability)}</span>
          {!player.active && <span className="rounded border border-zinc-600/50 bg-zinc-800/30 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">Inactive</span>}
          {planningFlags.map((f) => <span key={f} className="rounded border border-amber-700/30 bg-amber-900/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">{f}</span>)}
        </div>
        <div className="flex items-center gap-1.5">
          {previousPlayerId && <Link href={`/players/${previousPlayerId}`} className="h-6 rounded border border-zinc-700/50 bg-zinc-800/30 px-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200">Prev</Link>}
          {nextPlayerId && <Link href={`/players/${nextPlayerId}`} className="h-6 rounded border border-zinc-700/50 bg-zinc-800/30 px-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200">Next</Link>}
          <Link href="/players" className="h-6 rounded border border-zinc-700/50 bg-zinc-800/30 px-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200">All</Link>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        {/* Col 1: Identity & Attributes */}
        <div className="flex flex-col gap-2">
          <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Identity</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-zinc-500">Position</span><span className="text-zinc-200">{getPlayerPositionSummary(player)}</span>
              <span className="text-zinc-500">Foot</span><span className="text-zinc-200">{formatPreferredFoot(player.preferredFoot)} / {formatSecondaryFoot(player.secondaryFoot)} / {formatBestSide(player.bestSide)}</span>
              <span className="text-zinc-500">Rotation</span><span className="text-zinc-200">{player.nonRotatable ? "Non-rotatable" : "Eligible"}</span>
            </div>
          </div>

          <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Attributes</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl font-semibold text-zinc-50">{averages.overall}</span>
              <span className="text-sm text-[#d0b07f]" aria-label={`${overallStars} star overall rating`}>
                {"★".repeat(overallStars)}<span className="text-zinc-600">{"★".repeat(5 - overallStars)}</span>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <div><p className="text-zinc-500">Tech</p><p className="text-zinc-200 font-medium">{averages.technical}</p></div>
              <div><p className="text-zinc-500">Tact</p><p className="text-zinc-200 font-medium">{averages.tactical}</p></div>
              <div><p className="text-zinc-500">Mental</p><p className="text-zinc-200 font-medium">{averages.mental}</p></div>
              <div><p className="text-zinc-500">Phys</p><p className="text-zinc-200 font-medium">{averages.physical}</p></div>
            </div>
          </div>

          {player.notes && (
            <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Coach notes</p>
              <p className="mt-1 text-xs text-zinc-300 whitespace-pre-wrap">{player.notes}</p>
            </div>
          )}
        </div>

        {/* Col 2: Selection & Load */}
        <div className="flex flex-col gap-2">
          <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Selection status</p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <div><p className="text-zinc-500">Total</p><p className="text-zinc-200 font-medium">{savedInvolvement.length}</p></div>
              <div><p className="text-zinc-500">Draft</p><p className="text-amber-300 font-medium">{draftInvolvement.length}</p></div>
              <div><p className="text-zinc-500">Final</p><p className="text-emerald-300 font-medium">{finalizedInvolvement.length}</p></div>
              <div><p className="text-zinc-500">Float</p><p className="text-zinc-200 font-medium">{totalFloating}</p></div>
            </div>
          </div>

          <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Finalized history</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-zinc-500">Core</p><p className="text-zinc-200 font-medium">{coreCount}</p></div>
              <div><p className="text-zinc-500">Support</p><p className="text-zinc-200 font-medium">{supportCount}</p></div>
              <div><p className="text-zinc-500">Dev</p><p className="text-zinc-200 font-medium">{devCount}</p></div>
            </div>
            {lastFinalized && <p className="mt-2 text-[10px] text-zinc-500">Last: {formatDate(lastFinalized.match.startsAt)} vs {lastFinalized.match.opponent}</p>}
          </div>

          {(actualStats.actualAppearances > 0 || actualStats.goals > 0 || actualStats.assists > 0) && (
            <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Match stats (reported)</p>
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                <div><p className="text-zinc-500">Apps</p><p className="text-blue-300 font-medium">{actualStats.actualAppearances}</p></div>
                <div><p className="text-zinc-500">Goals</p><p className="text-emerald-300 font-medium">{actualStats.goals}</p></div>
                <div><p className="text-zinc-500">Assists</p><p className="text-amber-300 font-medium">{actualStats.assists}</p></div>
                <div><p className="text-zinc-500">Absent</p><p className="text-red-300 font-medium">{actualStats.plannedButAbsent}</p></div>
              </div>
            </div>
          )}

          {involvementPreview.length > 0 && (
            <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Current involvement</p>
              <div className="mt-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {involvementPreview.slice(0, 8).map((entry, i) => (
                  <div key={`${i}-${entry.matchId}-${entry.role}`} className="flex items-center justify-between gap-2 text-xs">
                    <Link href={`/rounds/${entry.matchId}`} className="text-zinc-300 hover:text-zinc-100 truncate">
                      {formatDate(entry.matchStartsAt)} · {entry.teamName}
                    </Link>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-zinc-500">{formatSelectionRole(entry.role)}</span>
                      <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                        entry.status === SelectionStatus.FINALIZED
                          ? "bg-emerald-900/20 text-emerald-400"
                          : "bg-amber-900/20 text-amber-400"
                      }`}>{entry.status === SelectionStatus.FINALIZED ? "F" : "D"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
           <div id="readiness" className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Readiness</p>
             <ReadinessSignalEditor playerId={player.id} signals={readinessSignals.map((s) => ({ id: s.id, signalType: s.signalType, value: s.value, note: s.note }))} />
           </div>
        </div>

        {/* Col 3: Movement, Explanations, Actions */}
        <div className="flex flex-col gap-2">
          {movementHistory.length > 0 && (
            <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Movement</p>
              <div className="mt-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {movementHistory.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="text-xs">
                    <span className="text-zinc-300">{formatDate(entry.match.startsAt)}</span>
                    <span className="text-zinc-500"> {entry.fromTeam.name}→{entry.toTeam.name}</span>
                    <span className="text-zinc-600 ml-1">{formatSelectionRole(entry.role)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentExplanations.length > 0 && (
            <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Explanations</p>
              <div className="mt-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {recentExplanations.slice(0, 6).map((sel) => (
                  <div key={sel.id} className="text-xs">
                    <span className="text-zinc-300">{formatDate(sel.match.startsAt)}</span>
                    <span className="text-zinc-500 ml-1">{formatSelectionRole(sel.role)}</span>
                    {sel.overrideReason && <span className="text-amber-400 ml-1">Override</span>}
                    {sel.explanation && (
                      <p className="text-zinc-500 mt-0.5 truncate">
                        {formatExplanation(sel.explanation)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <form action={toggleAction}>
              <button type="submit" className="h-6 rounded border border-zinc-700/50 bg-zinc-800/30 px-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200">
                {player.active ? "Set inactive" : "Set active"}
              </button>
            </form>
            <form action={removeAction}>
              <button type="submit" className="h-6 rounded border border-red-700/30 bg-red-900/15 px-2 text-[10px] font-medium text-red-300 hover:bg-red-900/25">
                Remove
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Edit form — collapsed by default */}
      <details className="group">
        <summary className="cursor-pointer rounded-md border border-zinc-700/40 bg-zinc-800/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
          Edit player
        </summary>
        <div className="mt-2 rounded-md border border-zinc-700/40 bg-zinc-800/20 p-4">
          <PlayerEditorForm
            action={saveAction}
            cancelHref="/players"
            player={player}
            submitLabel="Save changes"
            teams={teams}
          />
        </div>
      </details>
    </div>
  );
}