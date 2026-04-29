"use client";

import { useState } from "react";
import { MatchSquadCard, type PlayerInMatch } from "@/components/round/match-squad-card";
import { WarningPanel } from "@/components/round/warning-panel";
import { FairnessSummary } from "@/components/round/fairness-summary";
import { InspectorPanel } from "@/components/round/inspector-panel";
import { ConfirmFinalizeDialog } from "@/components/round/confirm-finalize-dialog";
import type { SelectionRole } from "@/components/ui/role-badge";

type WarningEntry = {
  code: string;
  message: string;
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

type RoundCommandCenterProps = {
  round: RoundData;
  matchRoundId: string;
};

export function RoundCommandCenter({ round, matchRoundId }: RoundCommandCenterProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<PlayerInMatch | null>(null);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

  const handlePlayerClick = (player: PlayerInMatch, matchId: string) => {
    setSelectedMatchId(matchId);
    setInspectedPlayer(player);
  };

  const handleCardSelect = (matchId: string) => {
    if (selectedMatchId === matchId) {
      setSelectedMatchId(null);
    } else {
      setSelectedMatchId(matchId);
    }
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

  const selectedSquad = round.squads.find((s) => s.matchId === selectedMatchId);
  const totalSelected = round.squads.reduce((sum, s) => sum + s.selectedCount, 0);
  const totalTarget = round.squads.reduce((sum, s) => sum + s.targetSquadSize, 0);

  return (
    <div className="flex min-h-full">
      <div className={`flex-1 ${inspectedPlayer ? "mr-[var(--inspector-width)]" : ""} transition-[margin] duration-200`}>
        <div className="flex flex-col gap-6">
          {round.warnings.length > 0 && (
            <WarningPanel warnings={round.warnings} summary={round.warningSummary} />
          )}

          {round.roundStatus === "DRAFT" && (
            <div className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-200">{round.roundLabel} · Draft</p>
                <p className="text-xs text-[var(--text-muted)]">{totalSelected} of {totalTarget} squad places filled</p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/30 transition-colors"
                onClick={() => setShowFinalizeDialog(true)}
              >
                Finalize round
              </button>
            </div>
          )}

          {round.roundStatus === "FINALIZED" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Finalized</span>
              <span className="text-sm text-emerald-200">{round.roundLabel} — selections are locked.</span>
            </div>
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

          <FairnessSummary
            metrics={round.fairnessMetrics}
            movementSummary={round.movementSummary}
          />
        </div>
      </div>

      <InspectorPanel
        player={inspectedPlayer ? {
          ...inspectedPlayer,
        } : null}
        matchContext={selectedSquad ? {
          teamName: selectedSquad.teamName,
          opponent: selectedSquad.opponent,
          matchDate: selectedSquad.matchDate,
        } : undefined}
        onClose={() => setInspectedPlayer(null)}
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
    </div>
  );
}