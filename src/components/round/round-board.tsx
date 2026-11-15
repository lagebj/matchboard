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
  type CoachingIntentScopeType,
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
import { RoundBoardRail } from "@/components/touchline/round-board/round-board-rail";
import { PlayerAssignmentInspector } from "@/components/touchline/round-board/player-assignment-inspector";
import { PlayerAssignmentSheet } from "@/components/touchline/round-board/player-assignment-sheet";
import { AllocationMatrix } from "@/components/touchline/round-board/allocation-matrix";
import type {
  RoundBoardAssignmentSuggestion,
  RoundBoardEffectivePosition,
} from "@/lib/touchline/presentation/round-board-view-model";
import type { RoundBoardAdvisorViewModel } from "@/lib/ai/presentation/round-board-advisor";
import {
  buildRoundBoardViewModel,
  buildAssignmentContext,
  buildAllocationMatrix,
  sortAttentionForSelection,
  buildRoundBoardDevelopmentContext,
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

export type SignalEntry = {
  code: string;
  message: string;
  severity?: WarningSeverity;
  playerId?: string;
  playerName?: string;
  teamName?: string;
  /** Gate C W2 remediation (P1-04): previously dropped by `page.tsx`'s mapping from
   * `PlanIntegritySignal`, which silently broke match-specific Resolve routing and per-match
   * boundary resolvability for any warning the fixtures didn't hand-author with it directly. */
  matchId?: string;
  /** The signal's own stable `idempotencyKey` (`compute-plan-integrity.ts`) — preferred over an
   * array-index-derived id, which is not stable across re-renders when the signal list reorders. */
  idempotencyKey?: string;
};

type SignalSummary = {
  blocked: number;
  decisionRequired: number;
  planningNote: number;
};

/**
 * Narrow presentation/command boundary (Gate C W2) so UI Lab fixtures can inject safe,
 * deterministic responses instead of this component's real server actions, without changing
 * production behavior: every entry defaults to the real action below when omitted, so a
 * production render (which never passes `commands`) is byte-for-byte unchanged.
 */
export type RoundBoardCommands = {
  addPlayerToMatch?: typeof addPlayerToMatchAction;
  removePlayerFromMatch?: typeof removePlayerFromMatchAction;
  generateEmergencyRepairOptions?: typeof generateEmergencyRepairOptionsAction;
  clearRoundDraft?: typeof clearRoundDraftAction;
  regenerateRound?: typeof regenerateRoundAction;
  /** Gate C W2 remediation (P1-06): `CoachingIntentSelector` dynamically imports its own real
   * server actions, outside the five above — this is the narrow seam for it. Defaults to the
   * real actions when omitted, so production is unaffected. */
  setCoachingIntent?: (scopeType: CoachingIntentScopeType, scopeId: string, category: string, note: string | null) => Promise<{ success: boolean; error?: string }>;
  removeCoachingIntent?: (intentId: string) => Promise<{ success: boolean; error?: string }>;
};

/** The truthful result of a single move/assignment attempt (P1-03/P1-05) — never a bare
 * void that lets a caller assume success. */
type MoveOutcome =
  | { status: "success" }
  | { status: "rejected"; reason: string }
  | { status: "error"; reason: string };

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
  /** Round Board rail "Insights" mode's optional Assistant Coach synthesis (ADR-0157 §6) —
   * `null`/absent renders nothing extra, matching the retired standalone block's own empty rule. */
  assistantCoach?: RoundBoardAdvisorViewModel | null;
  /** Rail "Development" mode context, keyed by playerId — already-batched reads from the page,
   * never fetched per-player here. */
  effectivePositionsByPlayerId?: Record<string, RoundBoardEffectivePosition[]>;
  activeFocusByPlayerId?: Record<string, string[]>;
  /** From `computeRoundPlanIntegrity()` — the canonical eligible-opportunity coverage (rule 3:
   * never re-derived in the UI). `null`/absent renders the strip's coverage tile as 0/0. */
  coverage?: {
    eligibleAvailablePlayerCount: number;
    assignedEligibleAvailablePlayerCount: number;
    unassignedEligibleAvailablePlayerIds: string[];
  } | null;
  /** Gate C W2 command boundary — see `RoundBoardCommands`. Omitted in production. */
  commands?: RoundBoardCommands;
  /**
   * Gate C W2 remediation (P1-06): Clear/Regenerate have no deterministic fixture-local
   * behavior (unlike the five `RoundBoardCommands` entries) — implementing one truthfully would
   * mean simulating which selections are "draft" at the Selection-status level, well beyond this
   * wave's fixtures. Rather than a no-op that *looks* like it worked, this disables both actions
   * outright with an explanatory label. `false`/omitted in production (and whenever `commands`
   * is omitted) — this never changes real behavior.
   */
  disableClearAndRegenerate?: boolean;
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
  coachingIntentCommands,
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
  /** Gate C W2 remediation (P1-06) — the narrow command seam for `CoachingIntentSelector`,
   * which otherwise dynamically imports its own real server actions regardless of `commands`. */
  coachingIntentCommands?: Pick<RoundBoardCommands, "setCoachingIntent" | "removeCoachingIntent">;
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
                setCoachingIntentCommand={coachingIntentCommands?.setCoachingIntent}
                removeCoachingIntentCommand={coachingIntentCommands?.removeCoachingIntent}
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
  assistantCoach = null,
  effectivePositionsByPlayerId = {},
  activeFocusByPlayerId = {},
  coverage = null,
  commands,
  disableClearAndRegenerate = false,
}: RoundBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Resolve once per render: a production caller never passes `commands`, so these are the same
  // direct action references as before this boundary existed — zero production behavior change.
  const addPlayerToMatch = commands?.addPlayerToMatch ?? addPlayerToMatchAction;
  const removePlayerFromMatch = commands?.removePlayerFromMatch ?? removePlayerFromMatchAction;
  const generateEmergencyRepairOptions =
    commands?.generateEmergencyRepairOptions ?? generateEmergencyRepairOptionsAction;
  const clearRoundDraft = commands?.clearRoundDraft ?? clearRoundDraftAction;
  const regenerateRound = commands?.regenerateRound ?? regenerateRoundAction;
  const [showClearRoundDialog, setShowClearRoundDialog] = useState(false);
  const [overrideReason] = useState("");
  // Gate C W2 remediation (P1-05): the one shared, truthful feedback surface for a rejected or
  // errored move attempt — shown in the assignment inspector/sheet, never a silent no-op.
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

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
      const result = await generateEmergencyRepairOptions(matchId, playerId);
      if (result.success) {
        setRepairOptions(result.options);
      } else {
        setRepairError(result.error);
      }
    });
  }, [startTransition, generateEmergencyRepairOptions]);

  const handleApplyRepairOption = useCallback(
    (option: EmergencyRepairOption) => {
      if (!repairTarget) return;
      const { matchId, playerId, playerName } = repairTarget;
      startTransition(async () => {
        const rmFd = new FormData();
        rmFd.set("matchId", matchId);
        rmFd.set("playerId", playerId);
        rmFd.set("matchRoundId", matchRoundId);
        await removePlayerFromMatch(rmFd);

        const addFd = new FormData();
        addFd.set("matchId", matchId);
        addFd.set("playerId", option.playerId);
        addFd.set("role", option.role);
        addFd.set("matchRoundId", matchRoundId);
        addFd.set("overrideReasonCategory", "availability_changed");
        addFd.set("overrideReasonDetail", `Emergency repair: replacing ${playerName} (generated option)`);
        await addPlayerToMatch(addFd);

        setRepairTarget(null);
        setRepairOptions(null);
        router.refresh();
      });
    },
    [repairTarget, matchRoundId, startTransition, router, removePlayerFromMatch, addPlayerToMatch],
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

  // Gate C W2 remediation (mixed-boundary banner was factually wrong): `planningBoundaryOpen`
  // false means round-wide operations (Regenerate/Clear) are unavailable — ADR-0109 requires
  // EVERY match to still be open for that — but it does not mean every match has actually
  // closed. The previous copy ("Every match's planning boundary has closed") was simply untrue
  // for a mixed round (some closed, some still open), which is exactly C05's own fixture shape.
  // Never assume an empty round is fully closed either — there is nothing to have closed yet.
  const closedMatchCount = matches.filter((m) => m.isFinalized).length;
  const allMatchesClosed = matches.length > 0 && closedMatchCount === matches.length;
  const mixedPlanningBoundary = !planningBoundaryOpen && closedMatchCount > 0 && closedMatchCount < matches.length;

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
  //
  // Gate C W2 remediation (P1-03/P1-05): enforces BOTH boundaries centrally — a player can be
  // moved neither into nor out of a closed match, from any entry point, without each caller
  // re-implementing the check (callers previously only guarded the destination). Returns a
  // structured outcome instead of void so callers can show the real result truthfully: a
  // rejection must never look like a silent no-op or a success.
  const movePlayerToMatch = useCallback(
    async (
      playerId: string,
      fromMatchId: string | null,
      targetMatchId: string,
    ): Promise<MoveOutcome> => {
      const target = matches.find((m) => m.matchId === targetMatchId);
      if (!target) return { status: "rejected", reason: "That match could not be found." };
      if (target.isFinalized) {
        return { status: "rejected", reason: "Planning is closed for the destination match." };
      }
      if (fromMatchId) {
        const source = matches.find((m) => m.matchId === fromMatchId);
        if (source?.isFinalized) {
          return { status: "rejected", reason: "Planning is closed for the player's current match." };
        }
      }

      const role = determineRole(playerId, targetMatchId);
      const isCoreMove =
        initialAvailable.find((p) => p.id === playerId)?.coreTeamId === target.teamId;

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

      const addResult = await addPlayerToMatch(addFd);
      if (addResult?.success === false) {
        return { status: "rejected", reason: addResult.errors?.[0] ?? "The assignment was rejected." };
      }

      if (fromMatchId) {
        const rmFd = new FormData();
        rmFd.set("matchId", fromMatchId);
        rmFd.set("playerId", playerId);
        rmFd.set("matchRoundId", matchRoundId);
        const removeResult = await removePlayerFromMatch(rmFd);
        if (removeResult?.success === false) {
          // The add already succeeded — this is a genuine partial-completion risk the review
          // flagged, not something to hide behind a redesigned transaction (out of this wave's
          // scope). Surface it as an error so the coach knows to check manually, never as a
          // silent success.
          return {
            status: "error",
            reason: "The player was added to the new match but could not be removed from the previous one. Please review this player's assignments.",
          };
        }
      }

      return { status: "success" };
    },
    [matchRoundId, overrideReason, determineRole, initialAvailable, matches, addPlayerToMatch, removePlayerFromMatch],
  );

  const handleDropOnMatch = useCallback(
    (matchId: string, e: React.DragEvent) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { playerId, fromMatchId } = data as { playerId: string; fromMatchId: string | null };

        if (fromMatchId === matchId) return;

        startTransition(async () => {
          const outcome = await movePlayerToMatch(playerId, fromMatchId, matchId);
          if (outcome.status === "success") {
            setAssignmentError(null);
            router.refresh();
          } else {
            setAssignmentError(outcome.reason);
          }
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
        const source = matches.find((m) => m.matchId === fromMatchId);
        if (source?.isFinalized) {
          setAssignmentError("Planning is closed for this player's current match.");
          return;
        }

        startTransition(async () => {
          const fd = new FormData();
          fd.set("matchId", fromMatchId);
          fd.set("playerId", playerId);
          fd.set("matchRoundId", matchRoundId);
          const result = await removePlayerFromMatch(fd);
          if (result?.success === false) {
            setAssignmentError(result.errors?.[0] ?? "The removal was rejected.");
          } else {
            setAssignmentError(null);
            router.refresh();
          }
        });
      } catch {}
    },
    [matchRoundId, startTransition, router, removePlayerFromMatch, matches],
  );

  const handleRemovePlayer = useCallback(
    (matchId: string, playerId: string) => {
      const source = matches.find((m) => m.matchId === matchId);
      if (source?.isFinalized) {
        setAssignmentError("Planning is closed for this match.");
        return;
      }
      startTransition(async () => {
        const fd = new FormData();
        fd.set("matchId", matchId);
        fd.set("playerId", playerId);
        fd.set("matchRoundId", matchRoundId);
        const result = await removePlayerFromMatch(fd);
        if (result?.success === false) {
          setAssignmentError(result.errors?.[0] ?? "The removal was rejected.");
        } else {
          setAssignmentError(null);
          router.refresh();
        }
      });
    },
    [matchRoundId, startTransition, router, removePlayerFromMatch, matches],
  );

  const handleConfirmMove = useCallback(
    (targetMatchId: string) => {
      if (!movePicker) return;
      const { playerId, fromMatchId } = movePicker;
      startTransition(async () => {
        const outcome = await movePlayerToMatch(playerId, fromMatchId, targetMatchId);
        if (outcome.status === "success") {
          setAssignmentError(null);
          router.refresh();
        } else {
          setAssignmentError(outcome.reason);
        }
      });
      setMovePicker(null);
    },
    [movePicker, movePlayerToMatch, startTransition, router],
  );

  // Primary interaction commit (contract §3/§5): a suggestion card's single explicit assignment
  // action — the exact same movePlayerToMatch command drag/drop uses. Guards against a closed
  // destination the same way `handleMatrixToggle` already does — `buildAssignmentContext`'s
  // callers below already exclude finalized matches from `suggestions`, so this is defense in
  // depth against a stale suggestion object, not the primary gate. `movePlayerToMatch` itself now
  // also guards the SOURCE boundary and returns a real outcome (P1-03/P1-05) — on rejection or
  // error, the sheet/inspector stay open, the selection is preserved, and the real reason is
  // shown, never a silent close that implies success.
  const handleAssignSuggestion = useCallback(
    (suggestion: RoundBoardAssignmentSuggestion) => {
      if (!selectedPlayerId) return;
      const target = matches.find((m) => m.matchId === suggestion.matchId);
      if (!target || target.isFinalized) return;
      const fromMatchId =
        matches.find((m) => m.players.some((p) => p.id === selectedPlayerId))?.matchId ?? null;
      setAssignmentError(null);
      startTransition(async () => {
        const outcome = await movePlayerToMatch(selectedPlayerId, fromMatchId, suggestion.matchId);
        if (outcome.status === "success") {
          setAssignmentError(null);
          setSheetOpen(false);
          router.refresh();
        } else {
          setAssignmentError(outcome.reason);
        }
      });
    },
    [selectedPlayerId, matches, movePlayerToMatch, startTransition, router],
  );

  const handleSelectPlayer = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    setAssignmentError(null);
    if (isCompactViewport) setSheetOpen(true);
  }, [isCompactViewport]);

  // Gate C W2 remediation (desktop match-specific Resolve had no effective behavior — clicking
  // it only updated mobile-only state, which the desktop workbench never reads at all, so the
  // control appeared actionable while doing nothing visible). Resolves a match-specific
  // attention item (no single player to select) on BOTH compositions: mobile keeps its existing
  // match-first drill-in; desktop scrolls the real match lane into view and moves keyboard focus
  // to a genuinely useful control inside it (that match's first "Select {player}" button when
  // one exists, else the lane itself) — the existing lane and assignment workflow, not a second
  // match-selection engine or a new route.
  const handleResolveMatch = useCallback((matchId: string) => {
    setMobileMatchId(matchId);
    setMobileMode("match");
    setMobileMatchUrl(matchId);

    requestAnimationFrame(() => {
      const lane = Array.from(document.querySelectorAll<HTMLElement>("[data-drop-match]")).find(
        (el) => el.dataset.dropMatch === matchId,
      );
      if (!lane) return;
      lane.scrollIntoView({ behavior: "smooth", block: "center" });
      const firstSelectButton = lane.querySelector<HTMLElement>('button[aria-label^="Select "]');
      if (firstSelectButton) {
        firstSelectButton.focus();
        return;
      }
      if (!lane.hasAttribute("tabindex")) lane.setAttribute("tabindex", "-1");
      lane.focus();
    });
  }, [setMobileMatchUrl]);

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
          const outcome = await movePlayerToMatch(dragData.playerId, dragData.fromMatchId, matchId);
          if (outcome.status === "success") {
            setAssignmentError(null);
            router.refresh();
          } else {
            setAssignmentError(outcome.reason);
          }
        });
      } else {
        if (!dragData.fromMatchId) {
          touchDragRef.current = null;
          setTouchDragPlayerId(null);
          setTouchDropTarget(null);
          return;
        }
        const fromId = dragData.fromMatchId;
        const source = matches.find((m) => m.matchId === fromId);
        if (source?.isFinalized) {
          setAssignmentError("Planning is closed for this player's current match.");
        } else {
          startTransition(async () => {
            const fd = new FormData();
            fd.set("matchId", fromId);
            fd.set("playerId", dragData.playerId);
            fd.set("matchRoundId", matchRoundId);
            const result = await removePlayerFromMatch(fd);
            if (result?.success === false) {
              setAssignmentError(result.errors?.[0] ?? "The removal was rejected.");
            } else {
              setAssignmentError(null);
              router.refresh();
            }
          });
        }
      }
      touchDragRef.current = null;
      setTouchDragPlayerId(null);
      setTouchDropTarget(null);
    },
    [matchRoundId, startTransition, movePlayerToMatch, router, removePlayerFromMatch, matches],
  );

  const planningNotes = warnings.filter((w) => w.severity === "WARNING");

  const [availableDragOver, setAvailableDragOver] = useState(false);

  // Gate C W2 remediation (P2 — desktop Move picker offered closed destinations): the picker
  // must only ever offer the same destinations the central movePlayerToMatch command would
  // actually accept — never a match whose planning boundary has closed. `otherMatchesForPicker`
  // is kept separately so the empty state can distinguish "no other match exists at all" from
  // "other matches exist, but their planning is closed" (never conflate the two messages).
  const otherMatchesForPicker = movePicker
    ? matches.filter((m) => m.matchId !== movePicker.fromMatchId)
    : [];
  const moveDestinations = otherMatchesForPicker.filter((m) => !m.isFinalized);

  // --- Gate D view model (Phase F9): the page's canonical data → the approved composition.

  // Intermediate shape feeding `buildRoundBoardViewModel`'s `attentionSignals` input — not the
  // final `RoundBoardAttentionItem` (that type's `resolvable` field is computed by the adapter
  // from canonical per-match boundary data, not available here). Gate C W2 remediation (P1-04):
  // `matchId` is no longer dropped, and `id` prefers the signal's own stable `idempotencyKey`
  // over a re-render-unstable array-index-derived string.
  const attentionItems = warnings
    .filter((w) => w.severity === "HARD_BLOCK" || w.severity === "REQUIRES_OVERRIDE")
    .map((w, i) => ({
      id: w.idempotencyKey ?? `${w.code}-${i}`,
      playerId: w.playerId ?? null,
      matchId: w.matchId ?? null,
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
      matchId: a.matchId,
    })),
    eligibleCoverage: {
      eligiblePlayerCount: coverage?.eligibleAvailablePlayerCount ?? 0,
      assignedEligiblePlayerCount: coverage?.assignedEligibleAvailablePlayerCount ?? 0,
    },
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
  const selectedPlayerSourceClosed = selectedPlayerMatchId
    ? (matches.find((m) => m.matchId === selectedPlayerMatchId)?.isFinalized ?? false)
    : false;

  // Destinations with a closed planning boundary are never valid assignment targets (C05: the
  // matrix's handleMatrixToggle already enforced this; the suggestion-card path did not, which
  // let a closed match render as an assignable suggestion). Filtering here — not just guarding
  // the commit in handleAssignSuggestion — means a closed destination never even appears as an
  // option, rather than appearing and failing/being blocked after the tap.
  //
  // Gate C W2 remediation (P1-03 follow-up): the SOURCE side needs the same treatment. Before
  // this fix, a player currently on a CLOSED match still saw every open match offered as a
  // suggestion — `movePlayerToMatch` would correctly reject any attempt to move them (its own
  // source-boundary guard), but showing a destination that is guaranteed to fail the moment it's
  // tapped is itself a misleading action, exactly the class of defect P1-01/P1-05 targets. When
  // the player's own current match is closed, there is no legitimate destination at all — every
  // move touches the closed source — so the suggestion list is empty and `closedNotice` explains
  // why, the same as when every OTHER match happens to be closed.
  const otherMatches = matches.filter((m) => m.matchId !== selectedPlayerMatchId);
  const openDestinationMatches = selectedPlayerSourceClosed ? [] : otherMatches.filter((m) => !m.isFinalized);

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
        openDestinationMatches.map((m) => {
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

  // A deterministic explanation for why nothing is assignable (C05), distinct from "this player
  // has no other match to go to" (no notice — a different, unrelated reason): only shown when at
  // least one other match exists in the round and nothing is reachable from here, with the
  // correct reason — the player's OWN match being closed is a different fact from every OTHER
  // match happening to be closed, even though both end in the same empty suggestion list.
  const assignmentClosedNotice =
    selectedPlayer && otherMatches.length > 0 && openDestinationMatches.length === 0
      ? selectedPlayerSourceClosed
        ? "Planning is closed for this player's current match. This is historical information only — no destination is available to move them to."
        : "Planning is closed for every other match in this round. This is historical information only — no destination is available to assign this player."
      : null;

  // C06: Round Board's own assignment is player×match only — it has no exact tactical-position
  // field (ADR-0154's 24-code vocabulary belongs to the separate Lineup/Formation editor, not
  // this surface). Rather than fabricate a position here, link to the player's current match's
  // real Lineup editor, the correct canonical context — only once a match assignment exists.
  const selectedPlayerLineupHref = selectedPlayerMatchId ? `/matches/${selectedPlayerMatchId}` : null;

  // Rail "Insights" mode ordering (contract: "When a player is selected, prioritize insight rows
  // that involve that player...") and "Development" mode context — both derived here since
  // `selectedPlayerId` is this component's own interaction state, not page-render-time data.
  const sortedAttention = sortAttentionForSelection(vm.attention, selectedPlayerId);
  const developmentContext = selectedPlayer
    ? buildRoundBoardDevelopmentContext({
        playerId: selectedPlayer.id,
        displayName: selectedPlayer.name,
        activeFocusCategories: activeFocusByPlayerId[selectedPlayer.id] ?? [],
        effectivePositions: effectivePositionsByPlayerId[selectedPlayer.id] ?? [],
      })
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
        // Toggle off = remove from the match (drop back to available). `target` above is
        // guaranteed open (we returned early otherwise), so this is always a valid removal.
        startTransition(async () => {
          const fd = new FormData();
          fd.set("matchId", matchId);
          fd.set("playerId", playerId);
          fd.set("matchRoundId", matchRoundId);
          const result = await removePlayerFromMatch(fd);
          if (result?.success === false) {
            setAssignmentError(result.errors?.[0] ?? "The removal was rejected.");
          } else {
            setAssignmentError(null);
            router.refresh();
          }
        });
        return;
      }

      // movePlayerToMatch itself now also guards the SOURCE boundary (P1-03) — previously this
      // only checked the destination (`target` above), so toggling a different, open match's
      // cell for a player currently on a CLOSED match would silently remove them from it.
      startTransition(async () => {
        const outcome = await movePlayerToMatch(playerId, currentMatchId, matchId);
        if (outcome.status === "success") {
          setAssignmentError(null);
          router.refresh();
        } else {
          setAssignmentError(outcome.reason);
        }
      });
    },
    [matches, matchRoundId, movePlayerToMatch, startTransition, router, removePlayerFromMatch],
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

      {/* Gate C W2 remediation (P1-05): the shared, truthful feedback surface for a rejected or
          errored move attempted via drag/drop, touch-drag, the allocation matrix, or the
          non-drag Move picker — paths with no persistent panel of their own to show the reason
          inline. Suppressed whenever a player is selected: the inspector/sheet already show the
          identical message inline there (`errorNotice` below) — never the same reason twice. */}
      {assignmentError && !selectedPlayerId && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-[var(--tl-c-radius-object)] border border-[var(--danger)]/35 bg-[var(--danger-subtle)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          <span>{assignmentError}</span>
          <button
            type="button"
            onClick={() => setAssignmentError(null)}
            aria-label="Dismiss"
            className="shrink-0 text-[var(--danger)] hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}

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
              disabled={isPending || disableClearAndRegenerate}
              title={disableClearAndRegenerate ? "Not available in this preview — no deterministic fixture behavior exists for Regenerate." : undefined}
              leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => {
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("matchRoundId", matchRoundId);
                  await regenerateRound({ error: "" }, fd);
                  router.refresh();
                });
              }}
            >
              Regenerate
            </TouchlineButton>
            <TouchlineButton
              variant="danger"
              disabled={isPending || disableClearAndRegenerate}
              title={disableClearAndRegenerate ? "Not available in this preview — no deterministic fixture behavior exists for Clear." : undefined}
              leadingIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => setShowClearRoundDialog(true)}
            >
              Clear
            </TouchlineButton>
          </div>
        </div>
      )}

      {!planningBoundaryOpen && mixedPlanningBoundary && (
        <DecisionBanner
          variant="finalized"
          title={
            <>
              Round-wide planning locked · <span className="font-normal">{roundLabel}</span>
            </>
          }
          description="Some matches have closed (kickoff passed or live reporting started), which locks round-wide actions like Regenerate and Clear. You can still edit the matches whose planning boundary remains open."
        />
      )}

      {!planningBoundaryOpen && !mixedPlanningBoundary && (
        <DecisionBanner
          variant="finalized"
          title={
            <>
              Planning closed · <span className="font-normal">{roundLabel}</span>
            </>
          }
          description={
            allMatchesClosed
              ? "All matches have passed their planning boundary (kickoff passed or live reporting started). Assignments are now read-only. Reschedule a specific match to reopen its plan if it hasn't actually started."
              : "This round's planning boundary is closed. Reschedule a specific match to reopen its plan if it hasn't actually started."
          }
        />
      )}

      {/* Contextual rail (ADR-0157 §6 "Round Board contextual rail"): Insights (unresolved
          decisions before routine allocations, contract §6, plus any Assistant Coach synthesis)
          / Balance / Development. Replaces the former standalone `RoundBoardAdvisorBlock`. */}
      <RoundBoardRail
        attention={sortedAttention}
        onResolve={(item) => {
          // Rail already gates on item.resolvable (P1-01) — this only decides HOW to route,
          // never whether to.
          if (item.playerId) {
            handleSelectPlayer(item.playerId);
          } else if (item.matchId) {
            handleResolveMatch(item.matchId);
          }
        }}
        assistantCoach={assistantCoach}
        fairnessMetrics={fairnessMetrics}
        movementSummary={movementSummary}
        developmentContext={developmentContext}
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
              coachingIntentCommands={commands}
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
              onClose={() => {
                setSelectedPlayerId(null);
                setAssignmentError(null);
              }}
              closedNotice={assignmentClosedNotice}
              lineupHref={selectedPlayerLineupHref}
              errorNotice={assignmentError}
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
            {/* The contextual rail above (shared across breakpoints) already shows the
                unresolved-decisions list — no second copy here. */}
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
              coachingIntentCommands={commands}
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
        onClose={() => {
          setSheetOpen(false);
          setAssignmentError(null);
        }}
        closedNotice={assignmentClosedNotice}
        lineupHref={selectedPlayerLineupHref}
        errorNotice={assignmentError}
      />

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
                  await clearRoundDraft(formData);
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
            otherMatchesExistButClosed={otherMatchesForPicker.length > 0 && moveDestinations.length === 0}
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
  otherMatchesExistButClosed,
  isPending,
  onSelect,
}: {
  destinations: MatchColumn[];
  /** Distinguishes "no other match exists at all" from "other matches exist, but their
   * planning is closed" (Gate C W2 remediation, P2) — never the same message for both. */
  otherMatchesExistButClosed: boolean;
  isPending: boolean;
  onSelect: (matchId: string) => void;
}) {
  if (destinations.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        {otherMatchesExistButClosed
          ? "Other matches exist, but their planning is closed."
          : "No other matches exist."}
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