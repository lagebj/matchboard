"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { FairnessSummary } from "@/components/round/fairness-summary";
import { determineAutomaticRoleFromPaths } from "@/lib/selection/determine-automatic-role";
import { renderReason } from "@/lib/formatters/recommendation-reason-text";
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
import { TouchlineButton } from "@/components/touchline";
import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { StatusPill } from "@/components/ui/status-pill";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { Dialog } from "@/components/ui/dialog";
import { RoundStatusStrip } from "@/components/touchline/round-board/round-status-strip";
import { RoundAttentionList } from "@/components/touchline/round-board/round-attention-list";
import { PlayerAssignmentInspector } from "@/components/touchline/round-board/player-assignment-inspector";
import { PlayerAssignmentSheet } from "@/components/touchline/round-board/player-assignment-sheet";
import { AllocationMatrix } from "@/components/touchline/round-board/allocation-matrix";
import type {
  RoundBoardAttentionItem,
  RoundBoardAssignmentSuggestion,
} from "@/lib/touchline/presentation/round-board-view-model";
import {
  buildRoundBoardViewModel,
  buildAssignmentContext,
  buildAllocationMatrix,
} from "@/lib/touchline/presentation/round-board-production-adapter";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { formatKickoffDate, formatKickoffTime, formatKickoffDateTime } from "@/lib/date-utils";

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
  explanations?: Array<{
    code: string;
    summary: string;
    hardRule?: boolean;
    reason?: import("@/lib/explanations/recommendation-reason").RecommendationReason;
  }>;
  /** Shirt identity (Atlas Follow-up Phase F9): resolved kit hex + shirt number. */
  shirtNumber?: number | null;
  kitColor?: string | null;
};

type MatchColumn = {
  matchId: string;
  teamId: string;
  teamName: string;
  teamKitColor: string | null;
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
  // Soft signals a coach could not otherwise see. Prefer the neutral, contract-shaped reason
  // text (C6 / ADR-0128) when present, falling back to the record's own summary.
  const softNotes = (player.explanations ?? [])
    .filter((e) => !e.hardRule)
    .map((e) => (e.reason ? renderReason(e.reason) : e.summary))
    .filter((text): text is string => !!text && text !== player.selectionReason);
  lines.push(...[...new Set(softNotes)]);
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

/**
 * One match lane (Atlas Follow-up Phase F9, `02_ROUND_BOARD_CONTRACT.md §4`) — the Gate D
 * lane anatomy (kit-mark identity, squad/target pill, state pill, progress bar, dense role-
 * grouped player rows, "+ Add player" affordance) applied to the production board, with the
 * production player chips and their remove/move/repair affordances preserved verbatim inside.
 * Still the drag/touch-drop target the previous column was — every mutation path is unchanged.
 */
function MatchLane({
  match,
  isPending,
  onDragOver,
  onDrop,
  onDragStart,
  onRemovePlayer,
  onMovePlayer,
  onRepairPlayer,
  onTouchStartPlayer,
  onSelectPlayer,
  onAddPlayer,
  isTouchHighlight,
  touchDragPlayerId,
  fullWidth = false,
}: {
  match: MatchColumn;
  isPending: boolean;
  /** Compact one-match view: fill the row instead of the fixed scroll-snap width. */
  fullWidth?: boolean;
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
  /** Primary interaction (contract §3): selecting a player populates the inspector / opens the sheet. */
  onSelectPlayer: (playerId: string) => void;
  onAddPlayer?: (matchId: string) => void;
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
  const needsCount = Math.max(0, match.targetSquadSize - selectedCount);
  const progressPct = match.targetSquadSize > 0 ? Math.min(100, Math.round((selectedCount / match.targetSquadSize) * 100)) : 0;

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
        "flex flex-col rounded-[var(--tl-c-radius-object)] border transition-colors",
        fullWidth
          ? "w-full"
          : "shrink-0 w-[82vw] max-w-[340px] snap-start expanded:w-auto expanded:max-w-none expanded:shrink",
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
        <div className="flex min-w-0 items-start gap-2">
          <TeamKitMark color={match.teamKitColor} size="sm" ariaLabel={`${match.teamName} shirt`} />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">{match.teamName}</p>
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
              <span className="text-[11px] text-[var(--text-muted)]">
                {COACHING_INTENT_LABELS[
                  match.coachingIntentCategory as keyof typeof COACHING_INTENT_LABELS
                ] ?? match.coachingIntentCategory}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded-full bg-[var(--accent-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-strong)]">
            Squad ({selectedCount})
          </span>
          <StatusPill variant={fillVariant}>
            {needsCount > 0 ? `Needs ${needsCount}` : `${selectedCount}/${match.targetSquadSize}`}
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
      <div className="px-3 pt-1.5" aria-hidden="true">
        <div className="h-1 overflow-hidden rounded-full bg-[var(--border-soft)]">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progressPct}%` }} />
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
                  <div key={p.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectPlayer(p.id)}
                      aria-label={`Select ${p.name}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    >
                      <span aria-hidden="true" className="text-[11px] font-semibold">→</span>
                      <span className="sr-only">Select</span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <BoardPlayerChip
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {selectedCount === 0 && (
          <p className="text-[11px] text-[var(--text-muted)] text-center py-4">
            Select or drop players here
          </p>
        )}
      </div>

      {onAddPlayer && !match.isFinalized ? (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => onAddPlayer(match.matchId)}
            className="w-full rounded-md border border-dashed border-[var(--border-soft)] py-1.5 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            + Add player
          </button>
        </div>
      ) : null}
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
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showClearRoundDialog, setShowClearRoundDialog] = useState(false);
  const [overrideReason] = useState("");

  // Primary interaction state (contract §3): select player → choose destination.
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [desktopView, setDesktopView] = useState<"board" | "allocation">("board");

  // Compact match-first modes (contract §7): Overview → Matches → one match's squad. The
  // drilled-into match is URL-backed (`?match=<id>`, ADR-0124 §12) so it survives refresh/back;
  // an unknown or absent id falls back to the Overview mode rather than guessing a match.
  const rawMobileMatch = searchParams.get("match");
  const [mobileMode, setMobileMode] = useState<"overview" | "matches" | "match">(() =>
    rawMobileMatch && matches.some((m) => m.matchId === rawMobileMatch) ? "match" : "overview",
  );
  const [mobileMatchId, setMobileMatchId] = useState<string | null>(() =>
    rawMobileMatch && matches.some((m) => m.matchId === rawMobileMatch) ? rawMobileMatch : null,
  );
  const setMobileMatchUrl = useCallback(
    (matchId: string | null) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      if (matchId) {
        params.set("match", matchId);
      } else {
        params.delete("match");
      }
      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  // Non-drag "Move to..." alternative (PROGRAMME.md §50), kept for the chip's own Move button:
  // on compact viewports this is superseded by the assignment sheet, but the chip affordance
  // remains and routes into the same destination picker on expanded viewports.
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
  // touch-drag, the explicit non-drag Move action, the inspector/sheet suggestion
  // cards, and the allocation matrix below. Never duplicate this sequence
  // (PROGRAMME.md §50's non-drag alternative must produce the identical result as
  // drag/drop, not a parallel implementation) — the contract's §3/§6 one-command rule.
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

  // Primary interaction commit (contract §3/§5): a suggestion card's single explicit assignment
  // action — the exact same movePlayerToMatch command drag/drop uses.
  const handleAssignSuggestion = useCallback(
    (suggestion: RoundBoardAssignmentSuggestion) => {
      if (!selectedPlayerId) return;
      const fromMatchId =
        matches.find((m) => m.players.some((p) => p.id === selectedPlayerId))?.matchId ?? null;
      startTransition(async () => {
        await movePlayerToMatch(selectedPlayerId, fromMatchId, suggestion.matchId);
        router.refresh();
      });
      setSheetOpen(false);
    },
    [selectedPlayerId, matches, movePlayerToMatch, startTransition, router],
  );

  const handleSelectPlayer = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    if (isCompactViewport) setSheetOpen(true);
  }, [isCompactViewport]);

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

  // --- Gate D view model (Phase F9): the page's canonical data → the approved composition.

  const attentionItems: RoundBoardAttentionItem[] = warnings
    .filter((w) => w.severity === "HARD_BLOCK" || w.severity === "REQUIRES_OVERRIDE")
    .map((w, i) => ({
      id: `${w.code}-${i}`,
      playerId: w.playerId ?? null,
      matchId: null,
      summary: w.playerName ?? w.teamName ?? w.code,
      detail: w.message,
      severity: w.severity === "HARD_BLOCK" ? ("BLOCKED" as const) : ("DECISION_REQUIRED" as const),
    }));

  const vm = buildRoundBoardViewModel({
    roundLabel,
    dateRangeLabel: matches.length > 0 ? formatKickoffDateTime(matches[0]!.matchDate) : roundLabel,
    matches: matches.map((m) => ({
      matchId: m.matchId,
      teamName: m.teamName,
      teamKitColor: m.teamKitColor,
      opponent: m.opponent,
      matchDate: m.matchDate,
      targetSquadSize: m.targetSquadSize,
      minSquadSize: m.minSquadSize,
      isFinalized: m.isFinalized,
      players: m.players.map((p) => ({
        playerId: p.id,
        displayName: p.name,
        shirtNumber: p.shirtNumber ?? null,
        kitColor: p.kitColor ?? m.teamKitColor,
        position: p.primaryPosition ?? null,
        role: (p.role ?? "CORE") as "CORE" | "SUPPORT" | "BACKFILL" | "DEVELOPMENT" | "CONFIDENCE_REBUILD",
        attention: (p.warningCount ?? 0) > 0,
      })),
    })),
    attentionSignals: attentionItems.map((a) => ({
      id: a.id,
      summary: a.summary,
      detail: a.detail,
      severity: a.severity,
      playerId: a.playerId,
    })),
    availablePlayerCount: unassignedPlayers.length,
  });

  // --- Selected-player assignment context (the contract's separate contextual view model).

  const allPlayersById = new Map<string, PlayerInColumn>();
  for (const p of initialAvailable) allPlayersById.set(p.id, p);
  for (const m of matches) {
    for (const p of m.players) if (!allPlayersById.has(p.id)) allPlayersById.set(p.id, p);
  }
  const selectedPlayer = selectedPlayerId ? (allPlayersById.get(selectedPlayerId) ?? null) : null;
  const selectedPlayerMatchId = selectedPlayerId
    ? (matches.find((m) => m.players.some((p) => p.id === selectedPlayerId))?.matchId ?? null)
    : null;

  const assignmentContext = selectedPlayer
    ? buildAssignmentContext(
        {
          playerId: selectedPlayer.id,
          displayName: selectedPlayer.name,
          shirtNumber: selectedPlayer.shirtNumber ?? null,
          kitColor: selectedPlayer.kitColor ?? null,
          positions: selectedPlayer.primaryPosition ? [selectedPlayer.primaryPosition] : [],
          attentionSummary:
            selectedPlayer.warningCount && selectedPlayer.warningCount > 0
              ? "This player is affected by unresolved plan signals."
              : null,
        },
        matches
          .filter((m) => m.matchId !== selectedPlayerMatchId)
          .map((m) => {
            const selectedCount = m.players.filter((p) =>
              DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole),
            ).length;
            const paths = rotationPathMap[`${selectedPlayer.coreTeamId ?? ""}:${m.teamId}`] ?? [];
            return {
              matchId: m.matchId,
              teamName: `${m.teamName} vs ${m.opponent}`,
              teamKitColor: m.teamKitColor,
              targetTeamId: m.teamId,
              currentSquadCount: selectedCount,
              targetCount: m.targetSquadSize,
              derivedRole: determineAutomaticRoleFromPaths(selectedPlayer.coreTeamId, m.teamId, paths),
              isCoreTeam: selectedPlayer.coreTeamId === m.teamId,
              hasRotationPath: paths.length > 0,
            };
          }),
      )
    : null;

  // --- Allocation matrix (desktop secondary mode, contract §8 — same assignment command).

  const matrix = buildAllocationMatrix(
    matches.map((m) => ({
      matchId: m.matchId,
      teamName: m.teamName,
      teamKitColor: m.teamKitColor,
      opponent: m.opponent,
      matchDate: m.matchDate,
      targetSquadSize: m.targetSquadSize,
      minSquadSize: m.minSquadSize,
      isFinalized: m.isFinalized,
      players: [],
    })),
    initialAvailable.map((p) => ({
      playerId: p.id,
      displayName: p.name,
      shirtNumber: p.shirtNumber ?? null,
      kitColor: p.kitColor ?? null,
    })),
    new Map(matches.flatMap((m) => m.players.map((p) => [p.id, m.matchId] as const))),
    1,
  );

  const handleMatrixToggle = useCallback(
    (playerId: string, matchId: string) => {
      const currentMatchId =
        matches.find((m) => m.players.some((p) => p.id === playerId))?.matchId ?? null;
      const target = matches.find((m) => m.matchId === matchId);
      if (!target || target.isFinalized) return;

      if (currentMatchId === matchId) {
        // Toggle off = remove from the match (drop back to available).
        startTransition(async () => {
          const fd = new FormData();
          fd.set("matchId", matchId);
          fd.set("playerId", playerId);
          fd.set("matchRoundId", matchRoundId);
          await removePlayerFromMatchAction(fd);
          router.refresh();
        });
        return;
      }

      startTransition(async () => {
        await movePlayerToMatch(playerId, currentMatchId, matchId);
        router.refresh();
      });
    },
    [matches, matchRoundId, movePlayerToMatch, startTransition, router],
  );

  const mobileMatch = mobileMatchId ? matches.find((m) => m.matchId === mobileMatchId) : null;

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134). Also
    // rendered directly by the org-scoped round page, which island-wraps too; nested
    // `.touchline` is idempotent.
    <div className="touchline flex flex-col gap-5">
      {/* Exception-first status strip (Atlas Follow-up Phase F9, contract §4/§6) — decisions
          needing attention is the visually dominant tile, before any routine allocation. */}
      <RoundStatusStrip summary={vm.summary} />

      {planningBoundaryOpen && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-[var(--text-muted)]">
            {vm.roundLabel}
            {vm.dateRangeLabel ? ` · ${vm.dateRangeLabel}` : ""}
          </span>
          <div className="hidden items-center gap-1 medium:flex">
            <button
              type="button"
              onClick={() => setDesktopView("board")}
              aria-pressed={desktopView === "board"}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ${desktopView === "board" ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]" : "text-[var(--text-muted)]"}`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setDesktopView("allocation")}
              aria-pressed={desktopView === "allocation"}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ${desktopView === "allocation" ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]" : "text-[var(--text-muted)]"}`}
            >
              Allocation
            </button>
          </div>
          <div className="flex items-center gap-2">
            <TouchlineButton
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
            </TouchlineButton>
            <TouchlineButton
              variant="danger"
              disabled={isPending}
              leadingIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => setShowClearRoundDialog(true)}
            >
              Clear
            </TouchlineButton>
          </div>
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

      {/* Unresolved decisions before routine allocations (contract §6). */}
      <RoundAttentionList
        items={attentionItems}
        onResolve={(item) => {
          if (item.playerId) handleSelectPlayer(item.playerId);
        }}
      />

      {planningNotes.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
            Planning notes ({planningNotes.length})
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {planningNotes.map((w, i) => (
              <div
                key={`note-${w.code}-${i}`}
                className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3 py-1.5 text-[11px] text-[var(--text-soft)]"
              >
                {w.playerName && (
                  <span className="font-medium text-[var(--foreground)]">
                    {w.playerName}:{" "}
                  </span>
                )}
                {w.message}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* --- Desktop workbench (medium+): lanes + inspector, or the allocation matrix. --- */}
      {desktopView === "board" ? (
        <div
          className="hidden medium:grid medium:gap-4"
          style={{
            gridTemplateColumns: `minmax(200px, 1fr) repeat(${Math.min(matches.length, 3)}, minmax(220px, 1.4fr)) minmax(260px, 1.3fr)`,
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
          {/* Available players column — preserved as the drag source and the unassigned list. */}
          <div
            data-drop-available
            className={[
              "flex flex-col rounded-[var(--tl-c-radius-object)] border transition-colors",
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
                <p className="text-sm font-semibold text-[var(--foreground)]">Available</p>
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
                    <div key={p.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectPlayer(p.id)}
                        aria-label={`Select ${p.name}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      >
                        <span aria-hidden="true" className="text-[11px] font-semibold">→</span>
                        <span className="sr-only">Select</span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <BoardPlayerChip
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {matches.map((match) => (
            <MatchLane
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
              onSelectPlayer={handleSelectPlayer}
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

          {/* Selected-player inspector (contract §5): the primary interaction's destination
              chooser — suggestion reasons from canonical planning logic, one explicit assign
              action per suggestion, the same command as drag. */}
          <div className="flex flex-col gap-3">
            <PlayerAssignmentInspector
              context={assignmentContext}
              onAssign={handleAssignSuggestion}
              onClose={() => setSelectedPlayerId(null)}
            />
          </div>
        </div>
      ) : (
        <AllocationMatrix
          columns={matrix.columns}
          rows={matrix.rows}
          onToggleCell={handleMatrixToggle}
          className="hidden medium:block"
        />
      )}

      {/* --- Compact: match-first composition (contract §7) — never a compressed kanban. --- */}
      <div className="flex flex-col gap-4 medium:hidden">
        <div className="flex gap-1 border-b border-[var(--border-soft)]" role="tablist" aria-label="Round board views">
          {(["overview", "matches"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={mobileMode === mode || (mobileMode === "match" && mode === "matches")}
              onClick={() => {
                setMobileMode(mode);
                setMobileMatchId(null);
                setMobileMatchUrl(null);
              }}
              className={`px-3 py-2 text-[13px] font-medium capitalize border-b-2 -mb-px ${
                mobileMode === mode || (mobileMode === "match" && mode === "matches")
                  ? "border-[var(--accent-strong)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--text-muted)]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {mobileMode === "overview" ? (
          <>
            <RoundAttentionList
              items={attentionItems}
              onResolve={(item) => {
                if (item.playerId) handleSelectPlayer(item.playerId);
              }}
            />
            <TouchlineWidget padding="compact">
              <p className="text-[12px] text-[var(--text-muted)]">
                {vm.summary.plannedOpportunities} of {vm.summary.targetOpportunities} planned
                opportunities across {vm.summary.matches}{" "}
                {vm.summary.matches === 1 ? "match" : "matches"}.
                {" "}
                {blockedCount > 0
                  ? `${blockedCount} blocked ${blockedCount === 1 ? "condition" : "conditions"}.`
                  : decisionRequiredCount > 0
                    ? `${decisionRequiredCount} ${decisionRequiredCount === 1 ? "decision" : "decisions"} needed.`
                    : "No unresolved conditions."}
              </p>
            </TouchlineWidget>
          </>
        ) : null}

        {mobileMode === "matches" && !mobileMatch ? (
          <ul className="flex flex-col gap-2">
            {matches.map((lane) => {
              const selectedCount = lane.players.filter((p) =>
                DISPLAY_ROLE_ORDER.includes((p.role ?? "CORE") as SelectionRole),
              ).length;
              const needsCount = Math.max(0, lane.targetSquadSize - selectedCount);
              return (
                <li key={lane.matchId}>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMatchId(lane.matchId);
                      setMobileMode("match");
                      setMobileMatchUrl(lane.matchId);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] p-3 text-left"
                  >
                    <TeamKitMark color={lane.teamKitColor} size="sm" ariaLabel={`${lane.teamName} shirt`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-[700] text-[var(--foreground)]">{lane.teamName}</p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        vs {lane.opponent} · {formatKickoffTime(lane.matchDate)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        needsCount === 0
                          ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]"
                          : "bg-[var(--warning-subtle)] text-[var(--warning)]"
                      }`}
                    >
                      {needsCount > 0 ? `Needs ${needsCount}` : "Complete"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {mobileMode === "match" && mobileMatch ? (
          <div>
            <button
              type="button"
              onClick={() => {
                setMobileMatchId(null);
                setMobileMode("matches");
                setMobileMatchUrl(null);
              }}
              className="mb-2 text-[12px] text-[var(--text-muted)] hover:underline"
            >
              &larr; All matches
            </button>
            <MatchLane
              match={mobileMatch}
              isPending={isPending}
              fullWidth
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropOnMatch(mobileMatch.matchId, e)}
              onDragStart={(e, playerId, _fromMatchId, currentRole) =>
                handleDragStart(e, playerId, mobileMatch.matchId, currentRole)
              }
              onRemovePlayer={handleRemovePlayer}
              onMovePlayer={(matchId, playerId, playerName) =>
                setMovePicker({ playerId, playerName, fromMatchId: matchId })
              }
              onRepairPlayer={(matchId, playerId, playerName) =>
                handleOpenRepair(matchId, playerId, playerName)
              }
              onSelectPlayer={handleSelectPlayer}
              onTouchStartPlayer={(playerId, fromMatchId, currentRole) => {
                touchDragRef.current = {
                  playerId,
                  fromMatchId,
                  currentRole: currentRole ?? "CORE",
                };
                setTouchDragPlayerId(playerId);
              }}
              isTouchHighlight={touchDropTarget === mobileMatch.matchId}
              touchDragPlayerId={touchDragPlayerId}
            />
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Available
              </p>
              {unassignedPlayers.length === 0 ? (
                <p className="text-[11px] text-[var(--text-muted)]">All players assigned</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {unassignedPlayers.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectPlayer(p.id)}
                        aria-label={`Select ${p.name}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      >
                        <span aria-hidden="true" className="text-[11px] font-semibold">→</span>
                        <span className="sr-only">Select</span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <BoardPlayerChip
                          player={p}
                          isDraggable
                          isFinalized={false}
                          isPending={isPending}
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Mobile assignment sheet (contract §7): the compact commit path — identical suggestion
          cards to the desktop inspector (one shared rendering), one sticky dominant action. */}
      <PlayerAssignmentSheet
        isOpen={sheetOpen}
        context={assignmentContext}
        onAssign={handleAssignSuggestion}
        onClose={() => setSheetOpen(false)}
      />

      <FairnessSummary metrics={fairnessMetrics} movementSummary={movementSummary} />

      <Dialog
        isOpen={showClearRoundDialog}
        onClose={() => setShowClearRoundDialog(false)}
        title="Clear round draft"
        description="Remove all draft selections and plan check signals for this round. Finalised data will not be affected."
        footer={
          <>
            <TouchlineButton
              variant="secondary"
              onClick={() => setShowClearRoundDialog(false)}
            >
              Cancel
            </TouchlineButton>
            <TouchlineButton
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
            </TouchlineButton>
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
          <TouchlineButton
            variant="secondary"
            onClick={() => {
              setRepairTarget(null);
              setRepairOptions(null);
              setRepairError(null);
            }}
          >
            Cancel
          </TouchlineButton>
        }
      >
        {repairError && <p className="text-sm text-[var(--danger)]">{repairError}</p>}
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
                    <span className="font-medium text-[var(--foreground)] truncate">{option.playerName}</span>
                    <RoleBadge role={option.role as UISelectionRole} />
                    {option.isOwnTeam && (
                      <span className="text-[10px] text-[var(--text-muted)]">Own team</span>
                    )}
                    {!option.isOwnTeam && option.coreTeamName && (
                      <span className="text-[10px] text-[var(--text-muted)]">from {option.coreTeamName}</span>
                    )}
                    {option.positionFit && (
                      <span className="text-[10px] text-[var(--accent-strong)]">
                        {option.positionFit === "NATURAL" ? "Natural fit" : option.positionFit === "STRONG" ? "Strong fit" : "Plausible fit"}
                      </span>
                    )}
                  </div>
                  <TouchlineButton
                    variant="primary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleApplyRepairOption(option)}
                  >
                    Use this player
                  </TouchlineButton>
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

      {/* Expanded-viewport destination picker for the chip's own "Move to..." affordance —
          compact viewports reach the same destinations through the assignment sheet instead. */}
      {!isCompactViewport && (
        <Dialog
          isOpen={!!movePicker}
          onClose={() => setMovePicker(null)}
          title={movePicker ? `Move ${movePicker.playerName} to...` : ""}
          size="sm"
          footer={
            <TouchlineButton variant="secondary" onClick={() => setMovePicker(null)}>
              Cancel
            </TouchlineButton>
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
          <span className="font-medium text-[var(--foreground)]">{m.teamName}</span>
          <span className="text-[11px] text-[var(--text-muted)]">vs {m.opponent}</span>
        </button>
      ))}
    </div>
  );
}