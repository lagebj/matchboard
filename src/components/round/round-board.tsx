"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  addPlayerToMatchAction,
  removePlayerFromMatchAction,
} from "@/app/(app)/rounds/[matchRoundId]/draft-selection-actions";
import {
  ShieldCheck,
  Trash2,
  RefreshCw,
  GripVertical,
  Lock,
  RotateCcw,
} from "lucide-react";
import { ConfirmFinalizeDialog } from "@/components/round/confirm-finalize-dialog";
import { OverrideReasonInput } from "@/components/round/override-reason-input";
import { RoundStatusStrip } from "@/components/round/round-status-strip";
import { FairnessSummary } from "@/components/round/fairness-summary";
import { deriveRoundStatus, type RoundStatus } from "@/lib/round-status";
import {
  clearRoundDraftAction,
  regenerateRoundAction,
  finalizeSingleMatchFromBoardAction,
  unfinalizeRoundAction,
  unfinalizeSingleMatchFromBoardAction,
} from "@/app/(app)/rounds/[matchRoundId]/actions";
import { RoleBadge, type SelectionRole as UISelectionRole } from "@/components/ui/role-badge";
import {
  MATCHDAY_RESPONSIBILITY_DESCRIPTIONS,
  COACHING_INTENT_LABELS,
  type MatchdayResponsibilityType,
  type ReadinessSignalType,
  READINESS_SIGNAL_LABELS,
} from "@/lib/coaching/types";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import type { WarningSeverity } from "@/generated/prisma/client";
import {
  PlayerChip,
  type PlayerChipAvailability,
  type PlayerChipRoleHint,
} from "@/components/ui/player-chip";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { Dialog } from "@/components/ui/dialog";

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
  matchdayResponsibility?: string | null;
  negativeReadinessSignals?: string[];
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
  coachingIntentCategory?: string;
  coachingIntentId?: string;
};

type SignalEntry = {
  code: string;
  message: string;
  severity?: WarningSeverity;
  playerId?: string;
  playerName?: string;
  teamName?: string;
};

type SignalSummary = {
  blocked: number;
  decisionRequired: number;
  planningNote: number;
};

type RoundBoardProps = {
  roundLabel: string;
  roundStatus: "NOT_GENERATED" | "DRAFT" | "FINALIZED";
  matchRoundId: string;
  hasDraftSelections: boolean;
  hasMatches: boolean;
  matches: MatchColumn[];
  availablePlayers: PlayerInColumn[];
  rotationPathMap: Record<string, string[]>;
  warnings: SignalEntry[];
  signalSummary?: SignalSummary;
  movementSummary: {
    supportSent: number;
    supportReceived: number;
    developmentSent: number;
    developmentReceived: number;
    squadRepairReceived: number;
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

const RESPONSIBILITY_LABEL: Record<MatchdayResponsibilityType, string> = {
  STABILIZER: "ST",
  CONNECTOR: "CN",
  RECOVERY_LEADER: "RL",
  WIDTH_HOLDER: "WH",
  CHALLENGE_PLAYER: "CH",
  CONFIDENCE_REBUILD_PLAYER: "CR",
};

function availabilityFor(player: PlayerInColumn): PlayerChipAvailability {
  switch (player.availability) {
    case "INJURED":
      return "INJURED";
    case "SICK":
      return "SICK";
    case "AWAY":
      return "AWAY";
    default:
      return "OK";
  }
}

function markersFor(player: PlayerInColumn): {
  label: string;
  title: string;
  tone: "neutral" | "warning" | "info" | "danger" | "subtle";
}[] {
  const markers: ReturnType<typeof markersFor> = [];

  if (player.manualOverride) {
    markers.push({ label: "OVR", title: "Manual override", tone: "warning" });
  }
  if (player.matchdayResponsibility) {
    markers.push({
      label:
        RESPONSIBILITY_LABEL[player.matchdayResponsibility as MatchdayResponsibilityType] ??
        "ST",
      title:
        MATCHDAY_RESPONSIBILITY_DESCRIPTIONS[
          player.matchdayResponsibility as MatchdayResponsibilityType
        ] ?? "Matchday responsibility",
      tone: "info",
    });
  }
  if (player.negativeReadinessSignals && player.negativeReadinessSignals.length > 0) {
    markers.push({
      label: `R${player.negativeReadinessSignals.length}`,
      title: `Readiness: ${player.negativeReadinessSignals
        .map((s) => READINESS_SIGNAL_LABELS[s as ReadinessSignalType] ?? s)
        .join(", ")}`,
      tone: "warning",
    });
  }

  return markers;
}

function BoardPlayerChip({
  player,
  isDraggable,
  isFinalized,
  isPending,
  onDragStart,
  onRemove,
  onTouchStart,
  isTouchDragging,
}: {
  player: PlayerInColumn;
  isDraggable: boolean;
  isFinalized: boolean;
  isPending: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onRemove?: () => void;
  onTouchStart?: () => void;
  isTouchDragging?: boolean;
}) {
  return (
    <PlayerChip
      name={player.name}
      position={player.primaryPosition}
      role={(player.role ?? null) as PlayerChipRoleHint | null}
      availability={availabilityFor(player)}
      markers={markersFor(player)}
      draggable={isDraggable && !isFinalized}
      disabled={isFinalized}
      pending={isPending}
      onDragStart={onDragStart}
      onTouchStart={onTouchStart}
      isTouchDragging={isTouchDragging}
      onRemove={onRemove}
      title={`${player.name} · ${player.coreTeamName}`}
    />
  );
}

function MatchColumnComponent({
  match,
  isPending,
  onDragOver,
  onDrop,
  onDragStart,
  onRemovePlayer,
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
  onDragStart: (
    e: React.DragEvent,
    playerId: string,
    fromMatchId: string | null,
    currentRole?: SelectionRole,
  ) => void;
  onRemovePlayer: (matchId: string, playerId: string) => void;
  showFinalizeMatch: (matchId: string) => void;
  onTouchStartPlayer?: (playerId: string, fromMatchId: string, currentRole?: SelectionRole) => void;
  isTouchHighlight?: boolean;
  touchDragPlayerId?: string | null;
  matchRoundId: string;
}) {
  const router = useRouter();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFinalizing, startFinalizing] = useTransition();
  const dateStr = match.matchDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const playersByRole = new Map<string, PlayerInColumn[]>();
  for (const role of DISPLAY_ROLE_ORDER) playersByRole.set(role, []);
  for (const p of match.players) {
    const role = (p.role ?? "CORE") as string;
    const list = playersByRole.get(role) ?? [];
    list.push(p);
    playersByRole.set(role, list);
  }

  const selectedCount = match.players.filter((p) =>
    DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole),
  ).length;

  const squadFilling =
    selectedCount >= match.targetSquadSize
      ? "full"
      : selectedCount >= match.minSquadSize
        ? "adequate"
        : "below";

  const fillVariant =
    squadFilling === "full"
      ? ("success" as const)
      : squadFilling === "adequate"
        ? ("warning" as const)
        : ("danger" as const);

  const highlightActive = isDragOver || isTouchHighlight;

  return (
    <div
      data-drop-match={match.matchId}
      className={[
        "flex flex-col rounded-xl border transition-colors",
        highlightActive
          ? "border-[var(--accent)]/55 bg-[var(--accent-subtle)]"
          : "border-[var(--border-soft)] bg-[var(--surface-base)]",
      ].join(" ")}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
        onDragOver(e);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        onDrop(e);
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-semibold text-zinc-50 truncate">{match.teamName}</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            vs {match.opponent} · {dateStr}
          </p>
          {!match.isFinalized && (
            <CoachingIntentSelector
              scopeType="MATCH"
              scopeId={match.matchId}
              currentIntent={match.coachingIntentCategory}
              currentIntentId={match.coachingIntentId}
            />
          )}
          {match.isFinalized && match.coachingIntentCategory && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {COACHING_INTENT_LABELS[
                match.coachingIntentCategory as keyof typeof COACHING_INTENT_LABELS
              ] ?? match.coachingIntentCategory}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusPill variant={fillVariant}>
            {selectedCount}/{match.targetSquadSize}
          </StatusPill>
          {match.isFinalized ? (
            <Button
              variant="quiet"
              size="sm"
              disabled={isFinalizing || isPending}
              onClick={() => {
                startFinalizing(async () => {
                  const fd = new FormData();
                  fd.set("matchId", match.matchId);
                  fd.set("matchRoundId", matchRoundId);
                  await unfinalizeSingleMatchFromBoardAction({ error: "" }, fd);
                  router.refresh();
                });
              }}
              title="Un-finalise this match"
              aria-label="Un-finalise this match"
              className="!px-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="quiet"
              size="sm"
              disabled={isFinalizing || isPending}
              onClick={() => showFinalizeMatch(match.matchId)}
              title="Finalise this match"
              aria-label="Finalise this match"
              className="!px-1.5 hover:!text-[var(--accent-strong)]"
            >
              <Lock className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 px-3 py-2 overflow-y-auto" style={{ maxHeight: "60vh" }}>
        {DISPLAY_ROLE_ORDER.map((role) => {
          const players = playersByRole.get(role) ?? [];
          if (players.length === 0) return null;
          return (
            <div key={role} className="mb-2.5 last:mb-0">
              <div className="flex items-center gap-1.5 mb-1">
                <RoleBadge role={role as UISelectionRole} />
                <span className="text-[11px] text-[var(--text-muted)]">{players.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {players.map((p) => (
                  <BoardPlayerChip
                    key={p.id}
                    player={p}
                    isDraggable
                    isFinalized={match.isFinalized}
                    isPending={isPending}
                    onDragStart={(e) => onDragStart(e, p.id, match.matchId, p.role)}
                    onRemove={() => onRemovePlayer(match.matchId, p.id)}
                    onTouchStart={
                      onTouchStartPlayer
                        ? () => onTouchStartPlayer(p.id, match.matchId, p.role)
                        : undefined
                    }
                    isTouchDragging={touchDragPlayerId === p.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {selectedCount === 0 && (
          <p className="text-[11px] text-[var(--text-muted)] text-center py-4">
            Drop players here
          </p>
        )}
      </div>
    </div>
  );
}

export function RoundBoard({
  roundLabel,
  roundStatus,
  matchRoundId,
  hasDraftSelections,
  hasMatches,
  matches,
  availablePlayers: initialAvailable,
  rotationPathMap,
  warnings,
  signalSummary,
  movementSummary,
  fairnessMetrics,
}: RoundBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showClearRoundDialog, setShowClearRoundDialog] = useState(false);
  const [overrideReason] = useState("");

  const [finalizingMatchId, setFinalizingMatchId] = useState<string | null>(null);
  const [matchOverrideReason, setMatchOverrideReason] = useState({ category: "", detail: "" });
  const [showUnfinalizeConfirm, setShowUnfinalizeConfirm] = useState(false);

  const touchDragRef = useRef<{
    playerId: string;
    fromMatchId: string | null;
    currentRole: SelectionRole;
  } | null>(null);
  const [touchDragPlayerId, setTouchDragPlayerId] = useState<string | null>(null);
  const [touchDropTarget, setTouchDropTarget] = useState<string | null>(null);

  const determineRole = useCallback(
    (playerId: string, targetMatchId: string): SelectionRole => {
      const match = matches.find((m) => m.matchId === targetMatchId);
      if (!match) return "CORE";
      const player = initialAvailable.find((p) => p.id === playerId);
      const playerCoreTeamId =
        player?.coreTeamId ??
        matches.flatMap((m) => m.players).find((p) => p.id === playerId)?.playerCoreTeamId;

      if (playerCoreTeamId === match.teamId) return "CORE";

      const paths = rotationPathMap[`${playerCoreTeamId ?? ""}:${match.teamId}`] ?? [];
      if (paths.includes("SUPPORT") && !paths.includes("DEVELOPMENT")) return "SUPPORT";
      if (paths.includes("DEVELOPMENT") && !paths.includes("SUPPORT")) return "DEVELOPMENT";
      if (paths.includes("SUPPORT")) return "SUPPORT";
      return "CORE";
    },
    [matches, initialAvailable, rotationPathMap],
  );

  const totalSelected = matches.reduce(
    (sum, m) =>
      sum +
      m.players.filter((p) => DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole))
        .length,
    0,
  );
  const totalTarget = matches.reduce((sum, m) => sum + m.targetSquadSize, 0);
  const completeTeams = matches.filter((m) => {
    const count = m.players.filter((p) =>
      DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole),
    ).length;
    return count >= m.targetSquadSize;
  }).length;
  const teamsNeedingSupport = matches.filter((m) => {
    const assigned = m.players.filter((p) =>
      DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole),
    ).length;
    return assigned < m.minSquadSize;
  }).length;
  const squadRepairNeeded = matches.reduce(
    (sum, m) => sum + m.players.filter((p) => p.role === "BACKFILL").length,
    0,
  );
  const blockedCount = signalSummary?.blocked ?? 0;
  const decisionRequiredCount = signalSummary?.decisionRequired ?? 0;

  const computedRoundStatus: RoundStatus = deriveRoundStatus({
    dbStatus: roundStatus,
    hasDraftSelections,
    hasMatches,
    blockedSignalCount: blockedCount,
  });

  const assignedPlayerIds = new Set<string>();
  for (const match of matches) {
    for (const p of match.players) assignedPlayerIds.add(p.id);
  }
  const unassignedPlayers = initialAvailable.filter((p) => !assignedPlayerIds.has(p.id));

  const handleDragStart = useCallback(
    (
      e: React.DragEvent,
      playerId: string,
      fromMatchId: string | null,
      currentRole?: SelectionRole,
    ) => {
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ playerId, fromMatchId, currentRole: currentRole ?? "CORE" }),
      );
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
        const isCoreMove =
          initialAvailable.find((p) => p.id === playerId)?.coreTeamId ===
          matches.find((m) => m.matchId === matchId)?.teamId;

        startTransition(async () => {
          const addFd = new FormData();
          addFd.set("matchId", matchId);
          addFd.set("playerId", playerId);
          addFd.set("role", role);
          addFd.set("matchRoundId", matchRoundId);
          const reason =
            overrideReason.trim() ||
            (fromMatchId
              ? `Moving player from another match`
              : isCoreMove
                ? undefined
                : `Manual placement on non-core team`);
          if (reason) addFd.set("overrideReason", reason);

          const addResult = await addPlayerToMatchAction(addFd);

          if (addResult?.success !== false && fromMatchId) {
            const rmFd = new FormData();
            rmFd.set("matchId", fromMatchId);
            rmFd.set("playerId", playerId);
            rmFd.set("matchRoundId", matchRoundId);
            await removePlayerFromMatchAction(rmFd);
          }
          router.refresh();
        });
      } catch {}
    },
    // initialAvailable and matches are intentionally excluded to avoid re-renders on every data change
    [matchRoundId, overrideReason, startTransition, determineRole, router],
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
          router.refresh();
        });
      } catch {}
    },
    [matchRoundId, startTransition, router],
  );

  const handleRemovePlayer = useCallback(
    (matchId: string, playerId: string) => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("matchId", matchId);
        fd.set("playerId", playerId);
        fd.set("matchRoundId", matchRoundId);
        await removePlayerFromMatchAction(fd);
        router.refresh();
      });
    },
    [matchRoundId, startTransition, router],
  );

  // Touch drag helpers — preserved verbatim from previous implementation.
  const findDropTargetAt = (
    x: number,
    y: number,
  ): { type: "match"; matchId: string } | { type: "available" } | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const closest = el.closest("[data-drop-match]");
    if (closest)
      return { type: "match", matchId: (closest as HTMLElement).dataset.dropMatch! };
    if (el.closest("[data-drop-available]")) return { type: "available" };
    return null;
  };

  const handleTouchDrop = useCallback(
    (target: { type: "match"; matchId: string } | { type: "available" }) => {
      const dragData = touchDragRef.current;
      if (!dragData) return;

      if (target.type === "match") {
        const matchId = target.matchId;
        if (dragData.fromMatchId === matchId) {
          touchDragRef.current = null;
          setTouchDragPlayerId(null);
          setTouchDropTarget(null);
          return;
        }
        const role = determineRole(dragData.playerId, matchId);
        const isCoreMove =
          initialAvailable.find((p) => p.id === dragData.playerId)?.coreTeamId ===
          matches.find((m) => m.matchId === matchId)?.teamId;
        startTransition(async () => {
          const addFd = new FormData();
          addFd.set("matchId", matchId);
          addFd.set("playerId", dragData.playerId);
          addFd.set("role", role);
          addFd.set("matchRoundId", matchRoundId);
          const reason =
            overrideReason.trim() ||
            (dragData.fromMatchId
              ? `Moving player from another match`
              : isCoreMove
                ? undefined
                : `Manual placement on non-core team`);
          if (reason) addFd.set("overrideReason", reason);
          const addResult = await addPlayerToMatchAction(addFd);
          if (addResult?.success !== false && dragData.fromMatchId) {
            const rmFd = new FormData();
            rmFd.set("matchId", dragData.fromMatchId);
            rmFd.set("playerId", dragData.playerId);
            rmFd.set("matchRoundId", matchRoundId);
            await removePlayerFromMatchAction(rmFd);
          }
          router.refresh();
        });
      } else {
        if (!dragData.fromMatchId) {
          touchDragRef.current = null;
          setTouchDragPlayerId(null);
          setTouchDropTarget(null);
          return;
        }
        const fromId = dragData.fromMatchId;
        startTransition(async () => {
          const fd = new FormData();
          fd.set("matchId", fromId);
          fd.set("playerId", dragData.playerId);
          fd.set("matchRoundId", matchRoundId);
          await removePlayerFromMatchAction(fd);
          router.refresh();
        });
      }
      touchDragRef.current = null;
      setTouchDragPlayerId(null);
      setTouchDropTarget(null);
    },
    // initialAvailable and matches are intentionally excluded to avoid re-renders on every data change
    [matchRoundId, overrideReason, startTransition, determineRole, router],
  );

  const handleFinalize = (
    overrideReasonCategory: string,
    overrideReasonDetail: string,
  ) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/rounds/${matchRoundId}`;
    form.style.display = "none";
    const matchRoundIdInput = document.createElement("input");
    matchRoundIdInput.type = "hidden";
    matchRoundIdInput.name = "matchRoundId";
    matchRoundIdInput.value = matchRoundId;
    form.appendChild(matchRoundIdInput);
    if (overrideReasonCategory) {
      const categoryInput = document.createElement("input");
      categoryInput.type = "hidden";
      categoryInput.name = "overrideReasonCategory";
      categoryInput.value = overrideReasonCategory;
      form.appendChild(categoryInput);
    }
    if (overrideReasonDetail) {
      const detailInput = document.createElement("input");
      detailInput.type = "hidden";
      detailInput.name = "overrideReasonDetail";
      detailInput.value = overrideReasonDetail;
      form.appendChild(detailInput);
    }
    document.body.appendChild(form);
    form.submit();
  };

  const prominentSignals = warnings.filter(
    (w) => w.severity === "HARD_BLOCK" || w.severity === "REQUIRES_OVERRIDE",
  );
  const planningNotes = warnings.filter((w) => w.severity === "WARNING");

  const [availableDragOver, setAvailableDragOver] = useState(false);

  const finalizingMatch = finalizingMatchId
    ? matches.find((m) => m.matchId === finalizingMatchId)
    : null;
  const finalizingMatchWarnings = finalizingMatch
    ? warnings.filter((w) => w.teamName === finalizingMatch.teamName)
    : [];
  const finalizingHardBlocks = finalizingMatchWarnings.filter(
    (w) => w.severity === "HARD_BLOCK",
  ).length;
  const finalizingRequiresOverride = finalizingMatchWarnings.filter(
    (w) => w.severity === "REQUIRES_OVERRIDE",
  ).length;
  const finalizingHasBlocking =
    finalizingHardBlocks > 0 || finalizingRequiresOverride > 0;
  const finalizingSelected = finalizingMatch
    ? finalizingMatch.players.filter((p) =>
        DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole),
      ).length
    : 0;

  return (
    <div className="flex flex-col gap-5">
      <RoundStatusStrip
        totalTeams={matches.length}
        completeTeams={completeTeams}
        teamsNeedingSupport={teamsNeedingSupport}
        squadRepairNeeded={squadRepairNeeded}
        blockedCount={blockedCount}
        decisionRequiredCount={decisionRequiredCount}
        totalSelected={totalSelected}
        totalTarget={totalTarget}
      />

      {roundStatus === "DRAFT" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={isPending}
            onClick={() => setShowFinalizeDialog(true)}
            leadingIcon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Finalize round
          </Button>
          <Button
            variant="secondary"
            disabled={isPending}
            leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("matchRoundId", matchRoundId);
                await regenerateRoundAction({ error: "" }, fd);
                router.refresh();
              });
            }}
          >
            Regenerate
          </Button>
          <Button
            variant="danger"
            disabled={isPending}
            leadingIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => setShowClearRoundDialog(true)}
          >
            Clear
          </Button>
        </div>
      )}

      {computedRoundStatus === "FINALIZED" && (
        <DecisionBanner
          variant="finalized"
          title={
            <>
              Finalised · <span className="font-normal">{roundLabel}</span>
            </>
          }
          description="Selections are locked. Reopen to make changes."
          action={
            <Button
              variant="warning"
              size="sm"
              disabled={isPending}
              leadingIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => setShowUnfinalizeConfirm(true)}
            >
              Un-finalise round
            </Button>
          }
        />
      )}

      {blockedCount > 0 && (
        <DecisionBanner
          variant="blocked"
          title={
            <>
              Plan checks · {blockedCount} blocked{" "}
              {blockedCount === 1 ? "condition" : "conditions"}
            </>
          }
           description="Resolve or record an override reason before finalise."
        />
      )}

      {decisionRequiredCount > 0 && (
        <DecisionBanner
          variant="decision"
          title={
            <>
              Plan checks ·{" "}
              {decisionRequiredCount === 1
                ? "1 decision needs review"
                : `${decisionRequiredCount} decisions need review`}
            </>
          }
           description="Coach judgement required before finalise."
        />
      )}

      {planningNotes.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--text-muted)] hover:text-zinc-100 transition-colors">
            Planning notes ({planningNotes.length})
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {planningNotes.map((w, i) => (
              <Surface
                key={`note-${w.code}-${i}`}
                variant="subtle"
                padding="none"
                className="px-3 py-1.5 text-[11px] text-[var(--text-soft)]"
              >
                {w.playerName && (
                  <span className="font-medium text-zinc-100">
                    {w.playerName}:{" "}
                  </span>
                )}
                {w.message}
              </Surface>
            ))}
          </div>
        </details>
      )}

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `minmax(200px, 1fr) repeat(${matches.length}, minmax(220px, 2fr))`,
        }}
        onTouchMove={(e) => {
          if (!touchDragRef.current) return;
          e.preventDefault();
          const touch = e.touches[0];
          const target = findDropTargetAt(touch.clientX, touch.clientY);
          setTouchDropTarget(
            target ? (target.type === "available" ? "available" : target.matchId) : null,
          );
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
          className={[
            "flex flex-col rounded-xl border transition-colors",
            availableDragOver || touchDropTarget === "available"
              ? "border-[var(--accent)]/55 bg-[var(--accent-subtle)]"
              : "border-[var(--border-soft)] bg-[var(--surface-base)]",
          ].join(" ")}
          onDragOver={(e) => {
            e.preventDefault();
            setAvailableDragOver(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setAvailableDragOver(true);
          }}
          onDragLeave={() => setAvailableDragOver(false)}
          onDrop={(e) => {
            setAvailableDragOver(false);
            handleDropOnAvailable(e);
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-zinc-50">Available</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {unassignedPlayers.length} unassigned
              </p>
            </div>
            <GripVertical className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          </div>
          <div className="flex-1 px-3 py-2 overflow-y-auto" style={{ maxHeight: "60vh" }}>
            {unassignedPlayers.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)] text-center py-4">
                All players assigned
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {unassignedPlayers.map((p) => (
                  <BoardPlayerChip
                    key={p.id}
                    player={p}
                    isDraggable
                    isFinalized={false}
                    isPending={isPending}
                    onDragStart={(e) => handleDragStart(e, p.id, null, p.role)}
                    onTouchStart={() => {
                      touchDragRef.current = {
                        playerId: p.id,
                        fromMatchId: null,
                        currentRole: p.role ?? "CORE",
                      };
                      setTouchDragPlayerId(p.id);
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
            onDragStart={(e, playerId, _fromMatchId, currentRole) =>
              handleDragStart(e, playerId, match.matchId, currentRole)
            }
            onRemovePlayer={handleRemovePlayer}
            showFinalizeMatch={(matchId: string) => {
              setFinalizingMatchId(matchId);
              setMatchOverrideReason({ category: "", detail: "" });
            }}
            onTouchStartPlayer={(playerId, fromMatchId, currentRole) => {
              touchDragRef.current = {
                playerId,
                fromMatchId,
                currentRole: currentRole ?? "CORE",
              };
              setTouchDragPlayerId(playerId);
            }}
            isTouchHighlight={touchDropTarget === match.matchId}
            touchDragPlayerId={touchDragPlayerId}
            matchRoundId={matchRoundId}
          />
        ))}
      </div>

      <FairnessSummary metrics={fairnessMetrics} movementSummary={movementSummary} />

      <ConfirmFinalizeDialog
        isOpen={showFinalizeDialog}
        onClose={() => setShowFinalizeDialog(false)}
        onConfirm={handleFinalize}
        blockedCount={blockedCount}
        decisionRequiredCount={decisionRequiredCount}
        selectedCount={totalSelected}
        targetSquadSize={totalTarget}
        matchCount={matches.length}
        signals={prominentSignals.map((w) => ({
          severity: w.severity ?? "WARNING",
          message: w.message,
          rule: w.code,
        }))}
      />

      <Dialog
        isOpen={showClearRoundDialog}
        onClose={() => setShowClearRoundDialog(false)}
        title="Clear round draft"
        description="Remove all draft selections and plan check signals for this round. Finalised data will not be affected."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowClearRoundDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const formData = new FormData();
                  formData.set("matchRoundId", matchRoundId);
                  await clearRoundDraftAction(formData);
                  setShowClearRoundDialog(false);
                  router.refresh();
                });
              }}
            >
              {isPending ? "Clearing…" : "Clear round"}
            </Button>
          </>
        }
      />

      <Dialog
        isOpen={!!finalizingMatchId}
        onClose={() => setFinalizingMatchId(null)}
        title="Finalise match"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setFinalizingMatchId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              leadingIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              disabled={
                isPending ||
                (finalizingHasBlocking &&
                  (!matchOverrideReason.category ||
                    matchOverrideReason.detail.trim().length < 10))
              }
              onClick={() => {
                if (!finalizingMatchId) return;
                const id = finalizingMatchId;
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("matchId", id);
                  fd.set("matchRoundId", matchRoundId);
                  if (matchOverrideReason.category) {
                    fd.set("overrideReasonCategory", matchOverrideReason.category);
                  }
                  if (matchOverrideReason.detail.trim()) {
                    fd.set("overrideReasonDetail", matchOverrideReason.detail.trim());
                  }
                  await finalizeSingleMatchFromBoardAction({ error: "" }, fd);
                  setFinalizingMatchId(null);
                  router.refresh();
                });
              }}
            >
              {isPending ? "Finalising…" : "Finalise match"}
            </Button>
          </>
        }
      >
        {finalizingMatch && (
          <>
            <Surface variant="subtle" padding="md">
              <p className="text-sm text-[var(--text-soft)]">
                <span className="font-semibold text-zinc-100">{finalizingMatch.teamName}</span> vs{" "}
                {finalizingMatch.opponent}:{" "}
                <span className="font-semibold text-zinc-100">{finalizingSelected}</span>/
                {finalizingMatch.targetSquadSize} players selected.
              </p>
            </Surface>

            {finalizingHardBlocks > 0 && (
              <DecisionBanner
                variant="blocked"
                title={
                  <>
                    {finalizingHardBlocks} blocked{" "}
                    {finalizingHardBlocks === 1 ? "condition" : "conditions"}
                  </>
                }
                description="Override reason required."
              />
            )}
            {finalizingRequiresOverride > 0 && (
              <DecisionBanner
                variant="decision"
                title={
                  <>
                    {finalizingRequiresOverride}{" "}
                    {finalizingRequiresOverride === 1
                      ? "decision needs review"
                      : "decisions need review"}
                  </>
                }
                description="Override reason required."
              />
            )}

            {finalizingHasBlocking && (
              <OverrideReasonInput
                hasBlockingWarnings={true}
                value={matchOverrideReason}
                onChange={setMatchOverrideReason}
              />
            )}
          </>
        )}
      </Dialog>

      <Dialog
        isOpen={showUnfinalizeConfirm}
        onClose={() => setShowUnfinalizeConfirm(false)}
        title="Un-finalise round"
        description="All selections will revert to draft and can be recalculated. Finalised history will be affected."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowUnfinalizeConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              disabled={isPending}
              onClick={() => {
                setShowUnfinalizeConfirm(false);
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("matchRoundId", matchRoundId);
                  await unfinalizeRoundAction({ error: "" }, fd);
                  router.refresh();
                });
              }}
            >
              {isPending ? "Un-finalising…" : "Un-finalise round"}
            </Button>
          </>
        }
      />
    </div>
  );
}
