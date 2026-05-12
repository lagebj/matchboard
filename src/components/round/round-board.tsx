"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import {
  addPlayerToMatchAction,
  removePlayerFromMatchAction,
  changePlayerRoleAction,
} from "@/app/(app)/rounds/[matchRoundId]/draft-selection-actions";
import {
  ShieldCheck,
  Trash2,
  RefreshCw,
  AlertTriangle,
  GripVertical,
  XCircle,
  Lock,
  Unlock,
} from "lucide-react";
import { ConfirmFinalizeDialog } from "@/components/round/confirm-finalize-dialog";
import { RoundStatusStrip } from "@/components/round/round-status-strip";
import { FairnessSummary } from "@/components/round/fairness-summary";
import { deriveRoundStatus, type RoundStatus } from "@/lib/round-status";
import { clearRoundDraftAction, regenerateRoundAction, finalizeSingleMatchFromBoardAction, unfinalizeRoundAction, unfinalizeSingleMatchFromBoardAction } from "@/app/(app)/rounds/[matchRoundId]/actions";
import { RoleBadge, type SelectionRole as UISelectionRole } from "@/components/ui/role-badge";
import type { WarningSeverity } from "@/generated/prisma/client";

type SelectionRole = UISelectionRole;

type PlayerInColumn = {
  id: string;
  name: string;
  coreTeamName: string;
  primaryPosition?: string;
  coreTeamId?: string;
  role?: SelectionRole;
  selectionCategory?: string;
  manualOverride?: boolean;
  controlledDoubleLoad?: boolean;
  availability?: string;
  playerCoreTeamId?: string;
  warningCount?: number;
};

type MatchColumn = {
  matchId: string;
  teamId: string;
  teamName: string;
  opponent: string;
  matchDate: Date;
  targetSquadSize: number;
  minSquadSize: number;
  isFinalized: boolean;
  players: PlayerInColumn[];
};

type WarningEntry = {
  code: string;
  message: string;
  severity?: WarningSeverity;
  playerId?: string;
  playerName?: string;
  teamName?: string;
};

type RoundBoardProps = {
  roundLabel: string;
  roundStatus: "NOT_GENERATED" | "DRAFT" | "FINALIZED";
  roundId: string;
  matchRoundId: string;
  hasDraftSelections: boolean;
  hasMatches: boolean;
  matches: MatchColumn[];
  availablePlayers: PlayerInColumn[];
  rotationPathMap: Record<string, string[]>;
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

const DISPLAY_ROLE_ORDER: SelectionRole[] = ["CORE", "SUPPORT", "BACKFILL", "DEVELOPMENT"];

const _ROLE_LABELS: Record<string, string> = {
  CORE: "Core",
  SUPPORT: "Support",
  BACKFILL: "Squad repair",
  DEVELOPMENT: "Development",
};

function PlayerChip({
  player,
  isDraggable,
  onDragStart,
  onRemove,
  onRoleChange: _onRoleChangeProp,
  isPending,
  isFinalized,
  onTouchStart,
  isTouchDragging,
}: {
  player: PlayerInColumn;
  isDraggable: boolean;
  onDragStart?: (e: React.DragEvent, playerId: string, fromMatchId: string | null, currentRole?: SelectionRole) => void;
  onRemove?: () => void;
  onRoleChange?: (newRole: SelectionRole) => void;
  isPending: boolean;
  isFinalized: boolean;
  onTouchStart?: (playerId: string, fromMatchId: string | null, currentRole?: SelectionRole) => void;
  isTouchDragging?: boolean;
  warningCount?: number;
}) {
  const availabilityClass =
    player.availability === "INJURED"
      ? "border-red-700/40 bg-red-900/20 text-red-300"
      : player.availability === "SICK"
        ? "border-amber-700/40 bg-amber-900/15 text-amber-300"
        : player.availability === "AWAY"
          ? "border-zinc-600/40 bg-zinc-800/30 text-zinc-400"
          : "";

  const _isNonCore = player.role && player.role !== "CORE" && player.coreTeamName !== player.selectionCategory
    ? true
    : false;

  return (
    <div
      draggable={isDraggable && !isFinalized}
      onDragStart={isDraggable && onDragStart ? (e) => onDragStart(e, player.id, null, player.role) : undefined}
      onTouchStart={isDraggable && !isFinalized && onTouchStart ? () => onTouchStart(player.id, null, player.role) : undefined}
      className={`group flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
        isDraggable && !isFinalized
          ? "cursor-grab border-[var(--border-soft)] bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] active:cursor-grabbing"
          : "border-[var(--border-soft)] bg-[var(--surface-muted)]"
      } ${availabilityClass} ${isTouchDragging ? "opacity-30" : ""}`}
    >
      {isDraggable && !isFinalized && (
        <GripVertical className="h-3 w-3 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
      <span className="truncate">{player.name}</span>
      {player.primaryPosition && (
        <span className="shrink-0 text-[9px] text-[var(--text-muted)] uppercase">{player.primaryPosition}</span>
      )}
      <span className="shrink-0 text-[9px] text-[var(--text-muted)]">{player.coreTeamName}</span>
      {player.controlledDoubleLoad && (
        <span className="shrink-0 text-[8px] text-red-400 uppercase font-semibold">2x</span>
      )}
      {player.manualOverride && (
        <span className="shrink-0 text-[8px] text-amber-400 uppercase">ovr</span>
      )}
      {player.warningCount && player.warningCount > 0 && (
        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
      )}
      {!isFinalized && onRemove && (
        <button
          className="shrink-0 ml-auto text-red-400/60 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          disabled={isPending}
          aria-label={`Remove ${player.name}`}
          type="button"
        >
          <XCircle className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function MatchColumnComponent({
  match,
  isPending,
  onDragOver,
  onDrop,
  onDragStart,
  onRemovePlayer,
  onRoleChange,
  showFinalizeMatch,
  onTouchStartPlayer,
  isTouchHighlight,
  touchDragPlayerId,
  matchRoundId,
}: {
  match: MatchColumn;
  isPending: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, playerId: string, fromMatchId: string | null, currentRole?: SelectionRole) => void;
  onRemovePlayer: (matchId: string, playerId: string) => void;
  onRoleChange: (matchId: string, playerId: string, newRole: SelectionRole) => void;
  showFinalizeMatch: (matchId: string) => void;
  onTouchStartPlayer?: (playerId: string, fromMatchId: string, currentRole?: SelectionRole) => void;
  isTouchHighlight?: boolean;
  touchDragPlayerId?: string | null;
  matchRoundId: string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFinalizing, startFinalizing] = useTransition();
  const dateStr = match.matchDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  const playersByRole = new Map<string, PlayerInColumn[]>();
  for (const role of DISPLAY_ROLE_ORDER) {
    playersByRole.set(role, []);
  }
  for (const p of match.players) {
    const role = (p.role ?? "CORE") as string;
    const list = playersByRole.get(role) ?? [];
    list.push(p);
    playersByRole.set(role, list);
  }

  const selectedCount = match.players.filter((p) => DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole)).length;

  const squadFilling = selectedCount >= match.targetSquadSize
    ? "full"
    : selectedCount >= match.minSquadSize
      ? "adequate"
      : "below-minimum";

  const squadFillingConfig = {
    full: { label: "Full", className: "text-emerald-400 bg-emerald-900/30 border-emerald-700/40" },
    adequate: { label: "Adequate", className: "text-amber-300 bg-amber-900/30 border-amber-700/40" },
    "below-minimum": { label: "Below min", className: "text-red-400 bg-red-900/30 border-red-700/40" },
  }[squadFilling];

  return (
    <div
      data-drop-match={match.matchId}
      className={`flex flex-col rounded-xl border transition-colors ${
        isDragOver || isTouchHighlight
          ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
          : "border-[var(--border-soft)] bg-[var(--surface-base)]"
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); onDragOver(e); }}
      onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { setIsDragOver(false); onDrop(e); }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-semibold text-zinc-50 truncate">{match.teamName}</p>
          <p className="text-[11px] text-[var(--text-muted)]">vs {match.opponent} · {dateStr}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider border ${squadFillingConfig.className}`}>
            {selectedCount}/{match.targetSquadSize}
          </span>
          {match.isFinalized && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">Finalized</span>
          )}
          {match.isFinalized && (
            <button
              className="inline-flex items-center gap-0.5 rounded p-1 text-[10px] text-zinc-400 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
              disabled={isFinalizing || isPending}
              onClick={() => {
                if (!confirm("Un-finalize this match? Selections will revert to draft.")) return;
                startFinalizing(async () => {
                  const fd = new FormData();
                  fd.set("matchId", match.matchId);
                  fd.set("matchRoundId", matchRoundId);
                  await unfinalizeSingleMatchFromBoardAction({ error: "" }, fd);
                });
              }}
              type="button"
              title="Un-finalize this match"
            >
              <Unlock className="h-3.5 w-3.5" />
            </button>
          )}
          {!match.isFinalized && (
            <button
              className="inline-flex items-center gap-0.5 rounded p-1 text-[10px] text-emerald-400 hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
              disabled={isFinalizing || isPending}
              onClick={() => showFinalizeMatch(match.matchId)}
              type="button"
              title="Finalize this match"
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-3 py-2 overflow-y-auto" style={{ maxHeight: "60vh" }}>
        {DISPLAY_ROLE_ORDER.map((role) => {
          const players = playersByRole.get(role) ?? [];
          if (players.length === 0) return null;
          return (
            <div key={role} className="mb-2 last:mb-0">
              <div className="flex items-center gap-1.5 mb-1">
                <RoleBadge role={role as UISelectionRole} />
                <span className="text-[10px] text-[var(--text-muted)]">{players.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {players.map((p) => (
                  <PlayerChip
                    key={p.id}
                    player={p}
                    isDraggable
                    onDragStart={onDragStart}
                    onRemove={() => onRemovePlayer(match.matchId, p.id)}
                    onRoleChange={(newRole) => onRoleChange(match.matchId, p.id, newRole)}
                    isPending={isPending}
                    isFinalized={match.isFinalized}
                    onTouchStart={onTouchStartPlayer ? (playerId, _fromMatchId, currentRole) => onTouchStartPlayer(playerId, match.matchId, currentRole) : undefined}
                    isTouchDragging={touchDragPlayerId === p.id}
                    warningCount={p.warningCount}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {selectedCount === 0 && (
          <p className="text-[11px] text-[var(--text-muted)] text-center py-4">Drop players here</p>
        )}
      </div>
    </div>
  );
}

export function RoundBoard({
  roundLabel,
  roundStatus,
  roundId: _roundId,
  matchRoundId,
  hasDraftSelections,
  hasMatches,
  matches,
  availablePlayers: initialAvailable,
  rotationPathMap,
  warnings,
  warningSummary,
  movementSummary,
  fairnessMetrics,
}: RoundBoardProps) {
  const [isPending, startTransition] = useTransition();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showClearRoundDialog, setShowClearRoundDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [finalizingMatchId, setFinalizingMatchId] = useState<string | null>(null);
  const [matchOverrideReason, setMatchOverrideReason] = useState("");

  const touchDragRef = useRef<{ playerId: string; fromMatchId: string | null; currentRole: SelectionRole } | null>(null);
  const [touchDragPlayerId, setTouchDragPlayerId] = useState<string | null>(null);
  const [touchDropTarget, setTouchDropTarget] = useState<string | null>(null);

  const determineRole = useCallback(
    (playerId: string, targetMatchId: string): SelectionRole => {
      const match = matches.find((m) => m.matchId === targetMatchId);
      if (!match) return "CORE";
      const player = initialAvailable.find((p) => p.id === playerId);
      const playerCoreTeamId = player?.coreTeamId ?? matches.flatMap((m) => m.players).find((p) => p.id === playerId)?.playerCoreTeamId;

      if (playerCoreTeamId === match.teamId) return "CORE";

      const paths = rotationPathMap[`${playerCoreTeamId ?? ""}:${match.teamId}`] ?? [];
      if (paths.includes("SUPPORT") && !paths.includes("DEVELOPMENT")) return "SUPPORT";
      if (paths.includes("DEVELOPMENT") && !paths.includes("SUPPORT")) return "DEVELOPMENT";
      if (paths.includes("SUPPORT")) return "SUPPORT";
      return "CORE";
    },
    [matches, initialAvailable, rotationPathMap],
  );

  const totalSelected = matches.reduce((sum, m) => {
    return sum + m.players.filter((p) => DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole)).length;
  }, 0);
  const totalTarget = matches.reduce((sum, m) => sum + m.targetSquadSize, 0);
  const completeTeams = matches.filter((m) => {
    const count = m.players.filter((p) => DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole)).length;
    return count >= m.targetSquadSize;
  }).length;
  const teamsNeedingSupport = 0;
  const backfillNeeded = 0;
  const blockingWarnings = warningSummary?.blocking ?? 0;
  const _requiresOverrideWarnings = warningSummary?.high ?? 0;

  const computedRoundStatus: RoundStatus = deriveRoundStatus({
    dbStatus: roundStatus,
    hasDraftSelections,
    hasMatches,
    blockingWarningCount: blockingWarnings,
  });

  const assignedPlayerIds = new Set<string>();
  for (const match of matches) {
    for (const p of match.players) {
      assignedPlayerIds.add(p.id);
    }
  }
  const unassignedPlayers = initialAvailable.filter((p) => !assignedPlayerIds.has(p.id));

  const handleDragStart = useCallback(
    (e: React.DragEvent, playerId: string, fromMatchId: string | null, currentRole?: SelectionRole) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ playerId, fromMatchId, currentRole: currentRole ?? "CORE" }));
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDropOnMatch = useCallback(
    (matchId: string, e: React.DragEvent) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { playerId, fromMatchId } = data as { playerId: string; fromMatchId: string | null };

        if (fromMatchId === matchId) return;

        const role = determineRole(playerId, matchId);
        const isCoreMove = initialAvailable.find((p) => p.id === playerId)?.coreTeamId === matches.find((m) => m.matchId === matchId)?.teamId;

        startTransition(async () => {
          const addFd = new FormData();
          addFd.set("matchId", matchId);
          addFd.set("playerId", playerId);
          addFd.set("role", role);
          addFd.set("matchRoundId", matchRoundId);
          const reason = overrideReason.trim() || (fromMatchId ? `Moving player from another match` : (isCoreMove ? undefined : `Manual placement on non-core team`));
          if (reason) addFd.set("overrideReason", reason);

          const addResult = await addPlayerToMatchAction(addFd);

          if (addResult?.success !== false && fromMatchId) {
            const rmFd = new FormData();
            rmFd.set("matchId", fromMatchId);
            rmFd.set("playerId", playerId);
            rmFd.set("matchRoundId", matchRoundId);
            await removePlayerFromMatchAction(rmFd);
          }
        });
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialAvailable and matches are intentionally excluded to avoid re-renders on every data change
    [matchRoundId, overrideReason, startTransition, determineRole],
  );

  const handleDropOnAvailable = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { playerId, fromMatchId } = data as { playerId: string; fromMatchId: string | null };

        if (!fromMatchId) return;

        startTransition(async () => {
          const fd = new FormData();
          fd.set("matchId", fromMatchId);
          fd.set("playerId", playerId);
          fd.set("matchRoundId", matchRoundId);
          await removePlayerFromMatchAction(fd);
        });
      } catch {}
    },
    [matchRoundId, startTransition],
  );

  const handleRemovePlayer = useCallback(
    (matchId: string, playerId: string) => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("matchId", matchId);
        fd.set("playerId", playerId);
        fd.set("matchRoundId", matchRoundId);
        await removePlayerFromMatchAction(fd);
      });
    },
    [matchRoundId, startTransition],
  );

  const handleRoleChange = useCallback(
    (matchId: string, playerId: string, newRole: SelectionRole) => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("matchId", matchId);
        fd.set("playerId", playerId);
        fd.set("role", newRole);
        fd.set("matchRoundId", matchRoundId);
        if (overrideReason.trim()) {
          fd.set("overrideReason", overrideReason.trim());
        }
        await changePlayerRoleAction(fd);
      });
    },
    [matchRoundId, overrideReason, startTransition],
  );

  const findDropTargetAt = (x: number, y: number): { type: "match"; matchId: string } | { type: "available" } | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const closest = el.closest("[data-drop-match]");
    if (closest) return { type: "match", matchId: (closest as HTMLElement).dataset.dropMatch! };
    if (el.closest("[data-drop-available]")) return { type: "available" };
    return null;
  };

  const handleTouchDrop = useCallback(
    (target: { type: "match"; matchId: string } | { type: "available" }) => {
      const dragData = touchDragRef.current;
      if (!dragData) return;

      if (target.type === "match") {
        const matchId = target.matchId;
        if (dragData.fromMatchId === matchId) { touchDragRef.current = null; setTouchDragPlayerId(null); setTouchDropTarget(null); return; }

        const role = determineRole(dragData.playerId, matchId);
        const isCoreMove = initialAvailable.find((p) => p.id === dragData.playerId)?.coreTeamId === matches.find((m) => m.matchId === matchId)?.teamId;

        startTransition(async () => {
          const addFd = new FormData();
          addFd.set("matchId", matchId);
          addFd.set("playerId", dragData.playerId);
          addFd.set("role", role);
          addFd.set("matchRoundId", matchRoundId);
          const reason = overrideReason.trim() || (dragData.fromMatchId ? `Moving player from another match` : (isCoreMove ? undefined : `Manual placement on non-core team`));
          if (reason) addFd.set("overrideReason", reason);

          const addResult = await addPlayerToMatchAction(addFd);

          if (addResult?.success !== false && dragData.fromMatchId) {
            const rmFd = new FormData();
            rmFd.set("matchId", dragData.fromMatchId);
            rmFd.set("playerId", dragData.playerId);
            rmFd.set("matchRoundId", matchRoundId);
            await removePlayerFromMatchAction(rmFd);
          }
        });
      } else {
        if (!dragData.fromMatchId) { touchDragRef.current = null; setTouchDragPlayerId(null); setTouchDropTarget(null); return; }

        const fromId = dragData.fromMatchId;
        startTransition(async () => {
          const fd = new FormData();
          fd.set("matchId", fromId);
          fd.set("playerId", dragData.playerId);
          fd.set("matchRoundId", matchRoundId);
          await removePlayerFromMatchAction(fd);
        });
      }
      touchDragRef.current = null;
      setTouchDragPlayerId(null);
      setTouchDropTarget(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialAvailable and matches are intentionally excluded to avoid re-renders on every data change
    [matchRoundId, overrideReason, startTransition, determineRole],
  );

  const handleFinalize = (reason: string) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/rounds/${matchRoundId}`;
    form.style.display = "none";
    const matchRoundIdInput = document.createElement("input");
    matchRoundIdInput.type = "hidden";
    matchRoundIdInput.name = "matchRoundId";
    matchRoundIdInput.value = matchRoundId;
    form.appendChild(matchRoundIdInput);
    if (reason) {
      const reasonInput = document.createElement("input");
      reasonInput.type = "hidden";
      reasonInput.name = "overrideReason";
      reasonInput.value = reason;
      form.appendChild(reasonInput);
    }
    document.body.appendChild(form);
    form.submit();
  };

  const actionableWarnings = warnings.filter(
    (w) => w.severity === "HARD_BLOCK" || w.severity === "REQUIRES_OVERRIDE",
  );
  const informationalWarnings = warnings.filter(
    (w) => w.severity !== "HARD_BLOCK" && w.severity !== "REQUIRES_OVERRIDE",
  );

  const [availableDragOver, setAvailableDragOver] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <RoundStatusStrip
        roundLabel={roundLabel}
        roundStatus={computedRoundStatus}
        totalTeams={matches.length}
        completeTeams={completeTeams}
        teamsNeedingSupport={teamsNeedingSupport}
        backfillNeeded={backfillNeeded}
        blockingWarnings={blockingWarnings}
        totalSelected={totalSelected}
        totalTarget={totalTarget}
      />

      {overrideReason && (
        <p className="text-xs text-amber-300">Override reason: {overrideReason}</p>
      )}

      {roundStatus === "DRAFT" && (
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
            disabled={isPending}
            onClick={() => setShowFinalizeDialog(true)}
            type="button"
          >
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
            Finalize round
          </button>
          <button
            className="rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("matchRoundId", matchRoundId);
                await regenerateRoundAction({ error: "" }, fd);
              });
            }}
            type="button"
          >
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
            Regenerate
          </button>
          <button
            className="rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/30 transition-colors disabled:opacity-50"
            disabled={isPending}
            onClick={() => setShowClearRoundDialog(true)}
            type="button"
          >
            <Trash2 className="mr-1 inline h-3.5 w-3.5" />
            Clear
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Override reason (if needed)"
              className="h-7 w-56 rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 text-[11px] text-zinc-50"
              type="text"
            />
          </div>
        </div>
      )}

      {computedRoundStatus === "FINALIZED" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Finalized</span>
          <span className="text-sm text-emerald-200">{roundLabel} — selections are locked.</span>
          <button
            className="ml-auto rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Un-finalize this round? All selections will revert to draft and can be recalculated.")) return;
              startTransition(async () => {
                const fd = new FormData();
                fd.set("matchRoundId", matchRoundId);
                await unfinalizeRoundAction({ error: "" }, fd);
              });
            }}
            type="button"
          >
            <Unlock className="mr-1 inline h-3.5 w-3.5" />
            Un-finalize round
          </button>
        </div>
      )}

      {actionableWarnings.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{actionableWarnings.length} actionable {actionableWarnings.length === 1 ? "warning" : "warnings"} — see player markers below</span>
        </div>
      )}

      {informationalWarnings.length > 0 && (
        <button
          className="text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors text-left"
          onClick={() => setShowAllWarnings(!showAllWarnings)}
          type="button"
        >
          {showAllWarnings ? "Hide" : `Show ${informationalWarnings.length} informational ${informationalWarnings.length === 1 ? "warning" : "warnings"}`}
        </button>
      )}

      {showAllWarnings && informationalWarnings.length > 0 && (
        <div className="flex flex-col gap-1">
          {informationalWarnings.map((w, i) => (
            <div
              key={`info-${w.code}-${i}`}
              className="rounded-lg border border-zinc-700/30 bg-zinc-800/20 px-3 py-1.5 text-[11px] text-zinc-400"
            >
              {w.playerName && <span className="font-medium text-zinc-300">{w.playerName}: </span>}
              {w.message}
            </div>
          ))}
        </div>
      )}

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `minmax(200px, 1fr) repeat(${matches.length}, minmax(220px, 2fr))` }}
        onTouchMove={(e) => {
          if (!touchDragRef.current) return;
          e.preventDefault();
          const touch = e.touches[0];
          const target = findDropTargetAt(touch.clientX, touch.clientY);
          setTouchDropTarget(target ? (target.type === "available" ? "available" : target.matchId) : null);
        }}
        onTouchEnd={(e) => {
          if (!touchDragRef.current) return;
          e.preventDefault();
          const touch = e.changedTouches[0];
          const target = findDropTargetAt(touch.clientX, touch.clientY);
          if (target) {
            handleTouchDrop(target);
          } else {
            touchDragRef.current = null;
            setTouchDragPlayerId(null);
            setTouchDropTarget(null);
          }
        }}
        onTouchCancel={() => {
          touchDragRef.current = null;
          setTouchDragPlayerId(null);
          setTouchDropTarget(null);
        }}
      >
        <div
          data-drop-available
          className={`flex flex-col rounded-xl border transition-colors ${
            availableDragOver || touchDropTarget === "available"
              ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
              : "border-[var(--border-soft)] bg-[var(--surface-base)]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setAvailableDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); setAvailableDragOver(true); }}
          onDragLeave={() => setAvailableDragOver(false)}
          onDrop={(e) => { setAvailableDragOver(false); handleDropOnAvailable(e); }}
        >
          <div className="border-b border-[var(--border-soft)] px-3 py-2">
            <p className="text-sm font-semibold text-zinc-100">Available</p>
            <p className="text-[11px] text-[var(--text-muted)]">{unassignedPlayers.length} player{unassignedPlayers.length !== 1 ? "s" : ""} unassigned</p>
          </div>
          <div className="flex-1 px-3 py-2 overflow-y-auto" style={{ maxHeight: "60vh" }}>
            {unassignedPlayers.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)] text-center py-4">All players assigned</p>
            ) : (
              <div className="flex flex-col gap-1">
                {unassignedPlayers.map((p) => (
                  <PlayerChip
                    key={p.id}
                    player={p}
                    isDraggable
                    onDragStart={handleDragStart}
                    isPending={isPending}
                    isFinalized={false}
                    onTouchStart={(playerId, _fromMatchId, currentRole) => {
                      touchDragRef.current = { playerId, fromMatchId: null, currentRole: currentRole ?? "CORE" };
                      setTouchDragPlayerId(playerId);
                    }}
                    isTouchDragging={touchDragPlayerId === p.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {matches.map((match) => (
          <MatchColumnComponent
            key={match.matchId}
            match={match}
            isPending={isPending}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropOnMatch(match.matchId, e)}
            onDragStart={(e, playerId, _fromMatchId, currentRole) => handleDragStart(e, playerId, match.matchId, currentRole)}
            onRemovePlayer={handleRemovePlayer}
            onRoleChange={handleRoleChange}
            showFinalizeMatch={(matchId: string) => {
              setFinalizingMatchId(matchId);
              setMatchOverrideReason("");
            }}
            onTouchStartPlayer={(playerId, fromMatchId, currentRole) => {
              touchDragRef.current = { playerId, fromMatchId, currentRole: currentRole ?? "CORE" };
              setTouchDragPlayerId(playerId);
            }}
            isTouchHighlight={touchDropTarget === match.matchId}
            touchDragPlayerId={touchDragPlayerId}
            matchRoundId={matchRoundId}
          />
        ))}
      </div>

      <FairnessSummary
        metrics={fairnessMetrics}
        movementSummary={movementSummary}
      />

      <ConfirmFinalizeDialog
        isOpen={showFinalizeDialog}
        onClose={() => setShowFinalizeDialog(false)}
        onConfirm={handleFinalize}
        blockingWarningCount={warningSummary?.blocking ?? 0}
        requiresOverrideCount={warningSummary?.high ?? 0}
        totalWarnings={warnings.length}
        selectedCount={totalSelected}
        targetSquadSize={totalTarget}
        matchCount={matches.length}
      />

      {showClearRoundDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowClearRoundDialog(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
            <div className="flex flex-col gap-4 px-5 py-4">
              <h3 className="text-base font-semibold text-zinc-100">Clear round draft</h3>
              <p className="text-sm text-zinc-300">
                Remove all draft selections and warnings for this round. Finalized data will not be affected.
              </p>
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

      {finalizingMatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFinalizingMatchId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
              <h3 className="text-base font-semibold text-zinc-100">Finalize match</h3>
              <button
                onClick={() => setFinalizingMatchId(null)}
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-100 transition-colors"
                aria-label="Close dialog"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4">
              {(() => {
                const m = matches.find((x) => x.matchId === finalizingMatchId);
                if (!m) return null;
                const mWarnings = warnings.filter((w) => w.teamName === m.teamName);
                const hardBlocks = mWarnings.filter((w) => w.severity === "HARD_BLOCK").length;
                const requiresOverride = mWarnings.filter((w) => w.severity === "REQUIRES_OVERRIDE").length;
                const selected = m.players.filter((p) => DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole)).length;
                return (
                  <>
                    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3">
                      <p className="text-sm text-zinc-200">
                        <span className="font-semibold">{m.teamName}</span> vs {m.opponent}:{" "}
                        <span className="font-semibold">{selected}</span>/{m.targetSquadSize} players selected.
                      </p>
                    </div>
                    {(hardBlocks > 0 || requiresOverride > 0) && (
                      <div className="flex flex-col gap-2">
                        {hardBlocks > 0 && (
                          <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2">
                            <span className="text-sm text-red-300">
                              {hardBlocks} blocking {hardBlocks === 1 ? "issue" : "issues"} — override reason required
                            </span>
                          </div>
                        )}
                        {requiresOverride > 0 && (
                          <div className="rounded-lg border border-amber-700/40 bg-amber-900/15 px-3 py-2">
                            <span className="text-sm text-amber-300">
                              {requiresOverride} {requiresOverride === 1 ? "issue requires" : "issues require"} override reason
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {(hardBlocks > 0 || requiresOverride > 0) && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-zinc-200" htmlFor="match-override-reason">
                          Override reason
                        </label>
                        <textarea
                          id="match-override-reason"
                          className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
                          rows={2}
                          placeholder="Explain why (min 10 characters)..."
                          value={matchOverrideReason}
                          onChange={(e) => setMatchOverrideReason(e.target.value)}
                        />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-3">
              <button
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-100 transition-colors"
                onClick={() => setFinalizingMatchId(null)}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isPending || (() => {
                  const m = matches.find((x) => x.matchId === finalizingMatchId);
                  if (!m) return true;
                  const mWarnings = warnings.filter((w) => w.teamName === m.teamName);
                  const hasBlocking = mWarnings.some((w) => w.severity === "HARD_BLOCK" || w.severity === "REQUIRES_OVERRIDE");
                  return hasBlocking && matchOverrideReason.trim().length < 10;
                })()}
                onClick={() => {
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set("matchId", finalizingMatchId);
                    fd.set("matchRoundId", matchRoundId);
                    if (matchOverrideReason.trim()) {
                      fd.set("overrideReason", matchOverrideReason.trim());
                    }
                    await finalizeSingleMatchFromBoardAction({ error: "" }, fd);
                    setFinalizingMatchId(null);
                  });
                }}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {isPending ? "Finalizing..." : "Finalize match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}