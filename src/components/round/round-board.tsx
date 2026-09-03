"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  addPlayerToMatchAction,
  removePlayerFromMatchAction,
} from "@/app/(app)/rounds/[matchRoundId]/draft-selection-actions";
import {
  Trash2,
  RefreshCw,
  GripVertical,
  CalendarClock,
} from "lucide-react";
import { generateEmergencyRepairOptionsAction } from "@/app/(app)/matches/emergency-repair-actions";
import type { EmergencyRepairOption } from "@/lib/selection/emergency-repair-options";
import { RoundStatusStrip } from "@/components/round/round-status-strip";
import { FairnessSummary } from "@/components/round/fairness-summary";
import { determineAutomaticRoleFromPaths } from "@/lib/selection/determine-automatic-role";
import {
  clearRoundDraftAction,
  regenerateRoundAction,
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
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { formatKickoffDate } from "@/lib/date-utils";

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
  /** Why this selection — see AGENTS.md "Explanation model" (ARR-0033). Surfaced via the chip's tooltip, not a badge. */
  selectionReason?: string;
  explanations?: Array<{ code: string; summary: string; hardRule?: boolean }>;
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
  /** Live-derived (isMatchRoundPlanningEditable()), not the persisted MatchRound.status — a
   * round finalized manually before ADR-0109 removed coach-operated finalize can carry a stale
   * MatchRound.status of "FINALIZED" even though none of its matches ever actually closed. This
   * drives the "Planning closed" banner and the Regenerate/Clear button gate; per-match editing
   * gates (drag/drop, add player) use their own per-match live check — see MatchColumn.isFinalized. */
  planningBoundaryOpen: boolean;
  matchRoundId: string;
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

// "Why this selection" (AGENTS.md Explanation model, ARR-0033) — surfaced through the chip's
// native tooltip, the design-sanctioned place for verbose per-player metadata (see
// player-chip.tsx's own doc comment). Not every explanation record is shown: hard-rule
// eligibility rationale is already summarized in selectionReason; only the additional soft
// signals a coach could not otherwise see (position-fit caveats, combination evidence) are
// appended, to keep the tooltip short.
function explanationTooltipFor(player: PlayerInColumn): string {
  const lines = [`${player.name} · ${player.coreTeamName}`];
  if (player.selectionReason) {
    lines.push(player.selectionReason);
  }
  const softNotes = (player.explanations ?? [])
    .filter((e) => !e.hardRule && e.summary && e.summary !== player.selectionReason)
    .map((e) => e.summary);
  lines.push(...softNotes);
  return lines.join("\n");
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
  onMove,
  onRepair,
  onTouchStart,
  isTouchDragging,
}: {
  player: PlayerInColumn;
  isDraggable: boolean;
  isFinalized: boolean;
  isPending: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onRemove?: () => void;
  onMove?: () => void;
  onRepair?: () => void;
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
      onMove={onMove}
      onRepair={onRepair}
      title={explanationTooltipFor(player)}
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
  onMovePlayer,
  onRepairPlayer,
  onTouchStartPlayer,
  isTouchHighlight,
  touchDragPlayerId,
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
  onMovePlayer: (matchId: string, playerId: string, playerName: string) => void;
  onRepairPlayer: (matchId: string, playerId: string, playerName: string) => void;
  onTouchStartPlayer?: (playerId: string, fromMatchId: string, currentRole?: SelectionRole) => void;
  isTouchHighlight?: boolean;
  touchDragPlayerId?: string | null;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dateStr = formatKickoffDate(match.matchDate);

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
        "shrink-0 w-[82vw] max-w-[340px] snap-start expanded:w-auto expanded:max-w-none expanded:shrink",
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
          {match.isFinalized && (
            <span
              className="flex items-center gap-1 text-[var(--text-muted)]"
              title="Planning is closed for this match — kickoff has passed or live reporting has started. Reschedule the match to reopen planning if it hasn't actually started."
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
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
                    onMove={() => onMovePlayer(match.matchId, p.id, p.name)}
                    onRepair={
                      match.isFinalized ? undefined : () => onRepairPlayer(match.matchId, p.id, p.name)
                    }
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
  planningBoundaryOpen,
  matchRoundId,
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
  const [showClearRoundDialog, setShowClearRoundDialog] = useState(false);
  const [overrideReason] = useState("");

  // Non-drag "Move to..." alternative (PROGRAMME.md §50). Desktop/expanded
  // viewports get a Dialog-based list (no dropdown/menu primitive exists
  // yet); medium/compact viewports get BottomSheet, matching §22's own
  // "Tap player → Move to: ..." example.
  const [movePicker, setMovePicker] = useState<{
    playerId: string;
    playerName: string;
    fromMatchId: string | null;
  } | null>(null);
  const isCompactViewport = useMediaQuery("(max-width: 839px)");

  // Emergency repair (Phase 9, DECISIONS.md "Emergency repair"): generates ranked alternatives for
  // a specific player without changing anything until the coach picks one.
  const [repairTarget, setRepairTarget] = useState<{
    matchId: string;
    playerId: string;
    playerName: string;
  } | null>(null);
  const [repairOptions, setRepairOptions] = useState<EmergencyRepairOption[] | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);

  const handleOpenRepair = useCallback((matchId: string, playerId: string, playerName: string) => {
    setRepairTarget({ matchId, playerId, playerName });
    setRepairOptions(null);
    setRepairError(null);
    startTransition(async () => {
      const result = await generateEmergencyRepairOptionsAction(matchId, playerId);
      if (result.success) {
        setRepairOptions(result.options);
      } else {
        setRepairError(result.error);
      }
    });
  }, [startTransition]);

  const handleApplyRepairOption = useCallback(
    (option: EmergencyRepairOption) => {
      if (!repairTarget) return;
      const { matchId, playerId, playerName } = repairTarget;
      startTransition(async () => {
        const rmFd = new FormData();
        rmFd.set("matchId", matchId);
        rmFd.set("playerId", playerId);
        rmFd.set("matchRoundId", matchRoundId);
        await removePlayerFromMatchAction(rmFd);

        const addFd = new FormData();
        addFd.set("matchId", matchId);
        addFd.set("playerId", option.playerId);
        addFd.set("role", option.role);
        addFd.set("matchRoundId", matchRoundId);
        addFd.set("overrideReasonCategory", "availability_changed");
        addFd.set("overrideReasonDetail", `Emergency repair: replacing ${playerName} (generated option)`);
        await addPlayerToMatchAction(addFd);

        setRepairTarget(null);
        setRepairOptions(null);
        router.refresh();
      });
    },
    [repairTarget, matchRoundId, startTransition, router],
  );

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

      const paths = rotationPathMap[`${playerCoreTeamId ?? ""}:${match.teamId}`] ?? [];
      return determineAutomaticRoleFromPaths(playerCoreTeamId, match.teamId, paths);
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

  // Single source of truth for "move a player to a match" — used by drag/drop,
  // touch-drag, and the explicit non-drag Move action below. Never duplicate
  // this sequence (PROGRAMME.md §50's non-drag alternative must produce the
  // identical result as drag/drop, not a parallel implementation).
  const movePlayerToMatch = useCallback(
    async (playerId: string, fromMatchId: string | null, targetMatchId: string) => {
      const role = determineRole(playerId, targetMatchId);
      const isCoreMove =
        initialAvailable.find((p) => p.id === playerId)?.coreTeamId ===
        matches.find((m) => m.matchId === targetMatchId)?.teamId;

      const addFd = new FormData();
      addFd.set("matchId", targetMatchId);
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
    },
    [matchRoundId, overrideReason, determineRole, initialAvailable, matches],
  );

  const handleDropOnMatch = useCallback(
    (matchId: string, e: React.DragEvent) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { playerId, fromMatchId } = data as { playerId: string; fromMatchId: string | null };

        if (fromMatchId === matchId) return;

        startTransition(async () => {
          await movePlayerToMatch(playerId, fromMatchId, matchId);
          router.refresh();
        });
      } catch {}
    },
    [startTransition, movePlayerToMatch, router],
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

  const handleConfirmMove = useCallback(
    (targetMatchId: string) => {
      if (!movePicker) return;
      const { playerId, fromMatchId } = movePicker;
      startTransition(async () => {
        await movePlayerToMatch(playerId, fromMatchId, targetMatchId);
        router.refresh();
      });
      setMovePicker(null);
    },
    [movePicker, movePlayerToMatch, startTransition, router],
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
        startTransition(async () => {
          await movePlayerToMatch(dragData.playerId, dragData.fromMatchId, matchId);
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
    [matchRoundId, startTransition, movePlayerToMatch, router],
  );

  const planningNotes = warnings.filter((w) => w.severity === "WARNING");

  const [availableDragOver, setAvailableDragOver] = useState(false);

  const moveDestinations = movePicker
    ? matches.filter((m) => m.matchId !== movePicker.fromMatchId)
    : [];

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

      {planningBoundaryOpen && (
        <div className="flex flex-wrap items-center gap-2">
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

      {!planningBoundaryOpen && (
        <DecisionBanner
          variant="finalized"
          title={
            <>
              Planning closed · <span className="font-normal">{roundLabel}</span>
            </>
          }
          description="Every match's planning boundary has closed (kickoff passed or live reporting started). Reschedule a specific match to reopen its plan if it hasn't actually started."
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
           description="Resolve or record an override reason before kickoff."
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
           description="Coach judgement required before kickoff."
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

      {matches.length > 1 && (
        <p className="text-[11px] text-[var(--text-muted)] expanded:hidden">
          Swipe to see other matches →
        </p>
      )}

      {/* Below `expanded` (840px), fixed-width match columns don't fit — a phone or a
          medium-tier tablet needs horizontal scroll-snap instead of a squeezed grid.
          `gridTemplateColumns` only takes effect once `display: grid` is active
          (expanded:grid below), so it's harmless to set unconditionally. */}
      <div
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 expanded:mx-0 expanded:px-0 expanded:grid expanded:overflow-visible expanded:snap-none expanded:pb-0"
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
            "shrink-0 w-[82vw] max-w-[340px] snap-start expanded:w-auto expanded:max-w-none expanded:shrink",
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
                    onMove={
                      matches.length > 0
                        ? () => setMovePicker({ playerId: p.id, playerName: p.name, fromMatchId: null })
                        : undefined
                    }
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
            onMovePlayer={(matchId, playerId, playerName) =>
              setMovePicker({ playerId, playerName, fromMatchId: matchId })
            }
            onRepairPlayer={(matchId, playerId, playerName) =>
              handleOpenRepair(matchId, playerId, playerName)
            }
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
          />
        ))}
      </div>

      <FairnessSummary metrics={fairnessMetrics} movementSummary={movementSummary} />

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
        isOpen={!!repairTarget}
        onClose={() => {
          setRepairTarget(null);
          setRepairOptions(null);
          setRepairError(null);
        }}
        title={repairTarget ? `Repair options for ${repairTarget.playerName}` : ""}
        description="Generated alternatives, ranked most to least suitable. Nothing changes until you pick one."
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setRepairTarget(null);
              setRepairOptions(null);
              setRepairError(null);
            }}
          >
            Cancel
          </Button>
        }
      >
        {repairError && <p className="text-sm text-[var(--text-error)]">{repairError}</p>}
        {!repairError && repairOptions === null && (
          <p className="text-sm text-[var(--text-muted)]">Generating options…</p>
        )}
        {!repairError && repairOptions !== null && repairOptions.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">
            No viable alternative found. You can still make a manual change from the Available column.
          </p>
        )}
        {!repairError && repairOptions !== null && repairOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            {repairOptions.map((option) => (
              <div
                key={option.playerId}
                className="flex flex-col gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-zinc-50 truncate">{option.playerName}</span>
                    <RoleBadge role={option.role as UISelectionRole} />
                    {option.isOwnTeam && (
                      <span className="text-[10px] text-[var(--text-muted)]">Own team</span>
                    )}
                    {!option.isOwnTeam && option.coreTeamName && (
                      <span className="text-[10px] text-[var(--text-muted)]">from {option.coreTeamName}</span>
                    )}
                    {option.positionMatch && (
                      <span className="text-[10px] text-[var(--accent-strong)]">Position match</span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleApplyRepairOption(option)}
                  >
                    Use this player
                  </Button>
                </div>
                {option.combinationNotes.length > 0 && (
                  <p className="text-[11px] text-[var(--text-muted)]">{option.combinationNotes.join(" · ")}</p>
                )}
                {option.resolvedSignals.length > 0 && (
                  <p className="text-[11px] text-[var(--accent-strong)]">
                    Resolves: {option.resolvedSignals.join(", ")}
                  </p>
                )}
                {(option.newBlockedSignals.length > 0 || option.newDecisionRequiredSignals.length > 0) && (
                  <p className="text-[11px] text-[var(--warning)]">
                    New: {[...option.newBlockedSignals, ...option.newDecisionRequiredSignals].join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Dialog>

      {isCompactViewport ? (
        <BottomSheet
          isOpen={!!movePicker}
          onClose={() => setMovePicker(null)}
          title={movePicker ? `Move ${movePicker.playerName} to...` : ""}
          footer={
            <Button variant="secondary" onClick={() => setMovePicker(null)}>
              Cancel
            </Button>
          }
        >
          <MoveDestinationList
            destinations={moveDestinations}
            isPending={isPending}
            onSelect={handleConfirmMove}
          />
        </BottomSheet>
      ) : (
        <Dialog
          isOpen={!!movePicker}
          onClose={() => setMovePicker(null)}
          title={movePicker ? `Move ${movePicker.playerName} to...` : ""}
          size="sm"
          footer={
            <Button variant="secondary" onClick={() => setMovePicker(null)}>
              Cancel
            </Button>
          }
        >
          <MoveDestinationList
            destinations={moveDestinations}
            isPending={isPending}
            onSelect={handleConfirmMove}
          />
        </Dialog>
      )}
    </div>
  );
}

function MoveDestinationList({
  destinations,
  isPending,
  onSelect,
}: {
  destinations: MatchColumn[];
  isPending: boolean;
  onSelect: (matchId: string) => void;
}) {
  if (destinations.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        No other match in this round to move this player to.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {destinations.map((m) => (
        <button
          key={m.matchId}
          type="button"
          disabled={isPending}
          onClick={() => onSelect(m.matchId)}
          className="flex flex-col items-start gap-0.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-left text-sm transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 disabled:opacity-50"
        >
          <span className="font-medium text-zinc-50">{m.teamName}</span>
          <span className="text-[11px] text-[var(--text-muted)]">vs {m.opponent}</span>
        </button>
      ))}
    </div>
  );
}
