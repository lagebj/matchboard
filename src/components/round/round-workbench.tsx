"use client";

import { useState, useTransition } from "react";
import { MatchSquadCard, type PlayerInMatch } from "@/components/round/match-squad-card";
import { WarningPanel } from "@/components/round/warning-panel";
import { FairnessSummary } from "@/components/round/fairness-summary";
import { RoundStatusStrip } from "@/components/round/round-status-strip";
import { MovementChain, type MovementChainEntry } from "@/components/round/movement-chain";
import { InspectorPanel, type InspectorItem } from "@/components/inspector/inspector-panel";
import { ConfirmFinalizeDialog } from "@/components/round/confirm-finalize-dialog";
import { severityFromCode, severityFromDbSeverity } from "@/components/ui/severity-badge";
import type { WarningSeverity } from "@/generated/prisma/client";
import { clearRoundDraftAction } from "@/app/rounds/[matchRoundId]/actions";
import { deriveRoundStatus, type RoundStatus } from "@/lib/round-status";

type WarningEntry = {
  code: string;
  message: string;
  severity?: WarningSeverity;
  playerId?: string;
  playerName?: string;
  teamName?: string;
};

type SquadData = {
  matchId: string;
  teamName: string;
  opponent: string;
  matchDate: Date;
  targetSquadSize: number;
  minSquadSize: number;
  selectedCount: number;
  players: PlayerInMatch[];
  supportStatus: "fulfilled" | "partial" | "missing" | "none";
  backfillCount: number;
  warningCount: number;
  isFinalized: boolean;
};

type RoundData = {
  roundLabel: string;
  roundStatus: "DRAFT" | "FINALIZED";
  hasDraftSelections: boolean;
  hasMatches: boolean;
  squads: SquadData[];
  warnings: WarningEntry[];
  warningSummary?: {
    blocking: number;
    high: number;
    medium: number;
    info: number;
  };
  movementSummary: {
    supportSent: number;
    supportReceived: number;
    developmentSent: number;
    developmentReceived: number;
    backfillReceived: number;
    drops: number;
  };
  fairnessMetrics: Array<{
    label: string;
    value: string | number;
    detail?: string;
    trend?: "up" | "down" | "neutral";
  }>;
};

type RoundWorkbenchProps = {
  round: RoundData;
  matchRoundId: string;
};

export function RoundWorkbench({ round, matchRoundId }: RoundWorkbenchProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [inspectedItem, setInspectedItem] = useState<InspectorItem | null>(null);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showClearRoundDialog, setShowClearRoundDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handlePlayerClick = (player: PlayerInMatch, matchId: string) => {
    setSelectedMatchId(matchId);
    const squad = round.squads.find((s) => s.matchId === matchId);
    setInspectedItem({
      type: "player",
      playerId: player.playerId,
      playerName: player.playerName,
      coreTeamName: player.coreTeamName,
      playerPosition: player.playerPosition,
      selectionCategory: player.selectionCategory,
      selectionReason: player.selectionReason,
      explanations: player.explanations,
      priorityScore: player.priorityScore,
      manualOverride: player.manualOverride,
      matchContext: squad ? {
        teamName: squad.teamName,
        opponent: squad.opponent,
        matchDate: squad.matchDate,
      } : undefined,
    });
  };

  const handleCardSelect = (matchId: string) => {
    if (selectedMatchId === matchId) {
      setSelectedMatchId(null);
    } else {
      setSelectedMatchId(matchId);
    }
  };

  const handleWarningClick = (warning: WarningEntry) => {
    const uiSeverity = warning.severity
      ? severityFromDbSeverity(warning.severity)
      : severityFromCode(warning.code);
    setInspectedItem({
      type: "warning",
      severity: uiSeverity,
      message: warning.message,
      code: warning.code,
      playerName: warning.playerName,
      teamName: warning.teamName,
    });
  };

  const handleFinalize = (overrideReason: string) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/rounds/${matchRoundId}`;
    form.style.display = "none";

    const matchRoundIdInput = document.createElement("input");
    matchRoundIdInput.type = "hidden";
    matchRoundIdInput.name = "matchRoundId";
    matchRoundIdInput.value = matchRoundId;
    form.appendChild(matchRoundIdInput);

    if (overrideReason) {
      const reasonInput = document.createElement("input");
      reasonInput.type = "hidden";
      reasonInput.name = "overrideReason";
      reasonInput.value = overrideReason;
      form.appendChild(reasonInput);
    }

    document.body.appendChild(form);
    form.submit();
  };

  const _selectedSquad = round.squads.find((s) => s.matchId === selectedMatchId);
  const totalSelected = round.squads.reduce((sum, s) => sum + s.selectedCount, 0);
  const totalTarget = round.squads.reduce((sum, s) => sum + s.targetSquadSize, 0);

  const completeTeams = round.squads.filter(
    (s) => s.selectedCount >= s.targetSquadSize,
  ).length;
  const teamsNeedingSupport = round.squads.filter(
    (s) => s.supportStatus === "missing" || s.supportStatus === "partial",
  ).length;
  const backfillNeeded = round.squads.filter(
    (s) => s.backfillCount > 0,
  ).length;
  const blockingWarnings = round.warningSummary?.blocking ?? 0;

  const computedRoundStatus: RoundStatus = deriveRoundStatus({
    dbStatus: round.roundStatus,
    hasDraftSelections: round.hasDraftSelections,
    hasMatches: round.hasMatches,
    blockingWarningCount: blockingWarnings,
  });

  const movements: MovementChainEntry[] = [];
  for (const squad of round.squads) {
    for (const player of squad.players) {
      if (player.selectionCategory === "SUPPORT" || player.selectionCategory === "BACKFILL" || player.selectionCategory === "DEVELOPMENT") {
        if (player.coreTeamName !== squad.teamName) {
          movements.push({
            sourceTeamName: player.coreTeamName,
            playerName: player.playerName,
            role: player.selectionCategory as "SUPPORT" | "BACKFILL" | "DEVELOPMENT",
            targetTeamName: squad.teamName,
          });
        }
      }
    }
  }

  return (
    <div className="flex min-h-full">
      <div className={`flex-1 ${inspectedItem ? "mr-[var(--inspector-width)]" : ""} transition-[margin] duration-200`}>
        <div className="flex flex-col gap-6">
          <RoundStatusStrip
            roundLabel={round.roundLabel}
            roundStatus={computedRoundStatus}
            totalTeams={round.squads.length}
            completeTeams={completeTeams}
            teamsNeedingSupport={teamsNeedingSupport}
            backfillNeeded={backfillNeeded}
            blockingWarnings={blockingWarnings}
            totalSelected={totalSelected}
            totalTarget={totalTarget}
          />

          {round.roundStatus === "DRAFT" && (
            <div className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-200">{round.roundLabel}</p>
                <p className="text-xs text-[var(--text-muted)]">{totalSelected} of {totalTarget} squad places filled</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30 transition-colors"
                  onClick={() => setShowClearRoundDialog(true)}
                  disabled={isPending}
                >
                  Clear round
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/30 transition-colors"
                  onClick={() => setShowFinalizeDialog(true)}
                >
                  Finalize round
                </button>
              </div>
            </div>
          )}

          {round.roundStatus === "FINALIZED" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Finalized</span>
              <span className="text-sm text-emerald-200">{round.roundLabel} — selections are locked.</span>
            </div>
          )}

          {round.warnings.length > 0 && (
            <WarningPanel
              warnings={round.warnings}
              summary={round.warningSummary}
              onWarningClick={handleWarningClick}
            />
          )}

          <div>
            <h2 className="text-sm font-semibold text-zinc-100 mb-3">Squads</h2>
            {round.squads.length === 0 ? (
              <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-6 text-center">
                <p className="text-sm text-[var(--text-muted)]">No matches in this round yet.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {round.squads.map((squad) => (
                  <MatchSquadCard
                    key={squad.matchId}
                    matchId={squad.matchId}
                    teamName={squad.teamName}
                    opponent={squad.opponent}
                    matchDate={squad.matchDate}
                    targetSquadSize={squad.targetSquadSize}
                    selectedCount={squad.selectedCount}
                    minSquadSize={squad.minSquadSize}
                    players={squad.players}
                    supportStatus={squad.supportStatus}
                    backfillCount={squad.backfillCount}
                    warningCount={squad.warningCount}
                    isFinalized={squad.isFinalized}
                    isSelected={selectedMatchId === squad.matchId}
                    onSelect={() => handleCardSelect(squad.matchId)}
                    onPlayerClick={(player) => handlePlayerClick(player, squad.matchId)}
                  />
                ))}
              </div>
            )}
          </div>

          {movements.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-zinc-100">Movement</h3>
              <MovementChain movements={movements} />
            </div>
          )}

          <FairnessSummary
            metrics={round.fairnessMetrics}
            movementSummary={round.movementSummary}
          />
        </div>
      </div>

      <InspectorPanel
        item={inspectedItem}
        onClose={() => setInspectedItem(null)}
      />

      <ConfirmFinalizeDialog
        isOpen={showFinalizeDialog}
        onClose={() => setShowFinalizeDialog(false)}
        onConfirm={handleFinalize}
        blockingWarningCount={round.warningSummary?.blocking ?? 0}
        requiresOverrideCount={round.warningSummary?.high ?? 0}
        totalWarnings={round.warnings.length}
        selectedCount={totalSelected}
        targetSquadSize={totalTarget}
        matchCount={round.squads.length}
      />

      {showClearRoundDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowClearRoundDialog(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
            <div className="flex flex-col gap-4 px-5 py-4">
              <h3 className="text-base font-semibold text-zinc-100">Clear round draft</h3>
              <p className="text-sm text-zinc-300">
                This will remove all draft selections and warnings for this round. Finalized data will not be affected.
              </p>
              <div className="rounded-lg border border-amber-700/40 bg-amber-900/15 px-3 py-2">
                <p className="text-sm text-amber-300">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-3">
              <button
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-100 transition-colors"
                onClick={() => setShowClearRoundDialog(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30 transition-colors disabled:opacity-50"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const formData = new FormData();
                    formData.set("matchRoundId", matchRoundId);
                    await clearRoundDraftAction(formData);
                    setShowClearRoundDialog(false);
                  });
                }}
              >
                {isPending ? "Clearing..." : "Clear round"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}