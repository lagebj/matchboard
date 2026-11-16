import type {
  RoundBoardAttentionItem,
  RoundBoardMatchLane,
  RoundBoardPlayerRow,
  RoundBoardSummary,
  RoundBoardViewModel,
  RoundStatus,
  RoundBoardPlayerAssignmentContext,
  RoundBoardAssignmentSuggestion,
  RoundBoardDevelopmentContext,
  RoundBoardEffectivePosition,
} from "@/lib/touchline/presentation/round-board-view-model";
import type { AllocationMatrixColumn, AllocationMatrixRow } from "@/components/touchline/round-board/allocation-matrix";

/**
 * Round Board production adapter (Atlas Follow-up Phase F9, `02_ROUND_BOARD_CONTRACT.md`).
 * Pure mapping from the page's canonical query results to the Gate D view-model shapes —
 * the same inputs the UI Lab fixtures used, so the gate-approved components render unchanged.
 * Never re-derives plan integrity (the page passes `computeRoundPlanIntegrity()`'s output
 * through, per the contract's own instruction); never invents suggestion reasons (contract §5 —
 * every reason string below is a factual statement of a canonical input: role derivation,
 * squad-count need, path existence).
 */

export type BoardMatchInput = {
  matchId: string;
  teamName: string;
  teamKitColor: string | null;
  opponent: string;
  matchDate: Date;
  targetSquadSize: number;
  minSquadSize: number;
  isFinalized: boolean;
  players: BoardMatchPlayerInput[];
};

export type BoardMatchPlayerInput = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  position: string | null;
  role: "CORE" | "SUPPORT" | "BACKFILL" | "DEVELOPMENT" | "CONFIDENCE_REBUILD";
  attention: boolean;
};

export type RoundBoardAdapterInput = {
  roundLabel: string;
  dateRangeLabel: string;
  matches: BoardMatchInput[];
  /** From `computeRoundPlanIntegrity()` — Blocked and Decision required only, never planning notes. */
  attentionSignals: { id: string; summary: string; detail: string; severity: "BLOCKED" | "DECISION_REQUIRED"; playerId?: string | null; matchId?: string | null }[];
  /**
   * From `computeRoundPlanIntegrity()`'s `coverage` — the canonical eligible-opportunity
   * denominator (distinct players whose core team has a playable fixture this round), never
   * re-derived here. Distinct from `plannedOpportunities`/`targetOpportunities` below, which
   * count squad placements, not distinct players.
   */
  eligibleCoverage: {
    eligiblePlayerCount: number;
    assignedEligiblePlayerCount: number;
  };
};

/** A player row within a lane — squad-repair (BACKFILL) and confidence-rebuild rows render as Support-group. */
function toLanePlayerRow(p: BoardMatchPlayerInput): RoundBoardPlayerRow {
  return {
    playerId: p.playerId,
    displayName: p.displayName,
    shirtNumber: p.shirtNumber,
    kitColor: p.kitColor,
    position: p.position,
    role: p.role === "CORE" ? "CORE" : p.role === "DEVELOPMENT" ? "DEVELOPMENT" : "SUPPORT",
    attention: p.attention,
  };
}

export function buildRoundBoardViewModel(input: RoundBoardAdapterInput): RoundBoardViewModel {
  const matches: RoundBoardMatchLane[] = input.matches.map((m) => {
    const selectedCount = m.players.length;
    const needsCount = Math.max(0, m.targetSquadSize - selectedCount);
    return {
      matchId: m.matchId,
      teamName: m.teamName,
      teamKitColor: m.teamKitColor,
      opponent: m.opponent,
      kickoffLabel: formatKickoffLabel(m.matchDate),
      squadCount: selectedCount,
      targetCount: m.targetSquadSize,
      laneState: needsCount > 0 ? "NEEDS" : "COMPLETE",
      laneStateDetail: needsCount > 0 ? `Needs ${needsCount}` : "Complete",
      players: m.players.map(toLanePlayerRow),
    };
  });

  const plannedOpportunities = matches.reduce((sum, m) => sum + m.squadCount, 0);
  const targetOpportunities = matches.reduce((sum, m) => sum + m.targetCount, 0);
  const belowMinimum = input.matches.filter((m) => m.players.length < m.minSquadSize).length;
  const decisions = input.attentionSignals.filter((s) => s.severity === "DECISION_REQUIRED").length;
  const blocked = input.attentionSignals.filter((s) => s.severity === "BLOCKED").length;

  // Gate C W2 remediation (P1-01): a legitimate resolution path exists only when the canonical
  // per-match boundary allows one — never the round-level boundary alone (a mixed round can have
  // both open and closed matches). Built from the same `input.matches` this function already
  // receives, not a second derivation.
  const matchIdByPlayerId = new Map<string, string>();
  for (const m of input.matches) {
    for (const p of m.players) matchIdByPlayerId.set(p.playerId, m.matchId);
  }
  const isMatchOpen = (matchId: string) => input.matches.find((m) => m.matchId === matchId)?.isFinalized === false;
  // Re-opened finding (second remediation pass): the first fix only checked whether an open
  // DESTINATION existed — it never checked whether the player's own SOURCE match had closed.
  // The central `movePlayerToMatch` command rejects moving a player out of a closed match
  // regardless of how open the destination is, so a player on a closed match was being offered
  // a Resolve action that could never succeed. Round Board currently has exactly one action for
  // a selected player — assign them into a destination — so once their own match is closed,
  // nothing is resolvable for them, full stop, regardless of which rule produced the signal.
  function isResolvable(signal: RoundBoardAdapterInput["attentionSignals"][number]): boolean {
    // Re-opened finding (third remediation pass): a warning's OWNING match (signal.matchId) and
    // the player's CURRENT match (matchIdByPlayerId) are two independent facts — neither implies
    // the other, and conflating them let a player-specific warning that names a CLOSED match be
    // marked resolvable purely because some unrelated match happened to be open (e.g. the player
    // was unassigned, or assigned to a different, open match). No supported action can correct a
    // warning whose own owning match has closed, regardless of what else is open, so this check
    // runs first and is decisive on its own.
    if (signal.matchId && !isMatchOpen(signal.matchId)) return false;

    if (signal.playerId) {
      const currentMatchId = matchIdByPlayerId.get(signal.playerId) ?? null;
      if (currentMatchId && !isMatchOpen(currentMatchId)) return false;
      return input.matches.some((m) => m.matchId !== currentMatchId && !m.isFinalized);
    }
    if (signal.matchId) {
      return isMatchOpen(signal.matchId);
    }
    return false;
  }

  const attention: RoundBoardAttentionItem[] = input.attentionSignals.map((s) => ({
    id: s.id,
    playerId: s.playerId ?? null,
    matchId: s.matchId ?? null,
    summary: s.summary,
    detail: s.detail,
    severity: s.severity,
    resolvable: isResolvable(s),
  }));

  const status: RoundStatus = blocked > 0 ? "BLOCKED" : decisions > 0 ? "NEEDS_DECISIONS" : "READY";

  const summary: RoundBoardSummary = {
    decisions: decisions + blocked,
    matches: matches.length,
    plannedOpportunities,
    targetOpportunities,
    coverageIssues: belowMinimum,
    eligibleCoverage: input.eligibleCoverage,
  };

  return {
    status,
    roundLabel: input.roundLabel,
    dateRangeLabel: input.dateRangeLabel,
    summary,
    matches,
    attention,
  };
}

function formatKickoffLabel(date: Date): string {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date);
  return `${day} · ${time}`;
}

export type AssignmentSuggestionInput = {
  matchId: string;
  teamName: string;
  teamKitColor: string | null;
  targetTeamId: string;
  currentSquadCount: number;
  targetCount: number;
  /** The role `determineAutomaticRoleFromPaths()` derives for this player → match. */
  derivedRole: "CORE" | "SUPPORT" | "DEVELOPMENT";
  /** True when the player's core team is the match's team. */
  isCoreTeam: boolean;
  /** True when an active rotation path connects core team → match team. */
  hasRotationPath: boolean;
};

/**
 * Suggested destinations for the currently-selected player — the contract's separate contextual
 * view model. The recommended suggestion is the one that best serves the round's unmet need:
 * the below-target match with a valid path/role derivation; ties resolve deterministically by
 * lane order. Reasons are factual statements of the canonical inputs above — never invented.
 */
export function buildAssignmentContext(
  player: {
    playerId: string;
    displayName: string;
    shirtNumber: number | null;
    kitColor: string | null;
    positions: string[];
    attentionSummary: string | null;
  },
  suggestions: AssignmentSuggestionInput[],
): RoundBoardPlayerAssignmentContext {
  const enriched: (RoundBoardAssignmentSuggestion & { needAfter: number })[] = suggestions.map((s) => {
    const resultingSquadCount = s.currentSquadCount + 1;
    const needAfter = Math.max(0, s.targetCount - resultingSquadCount);
    const reasons: string[] = [];
    if (s.isCoreTeam) {
      reasons.push("Core team");
    } else if (s.hasRotationPath) {
      reasons.push(s.derivedRole === "SUPPORT" ? "Counts as support opportunity" : "Development movement via rotation path");
    } else {
      reasons.push("No rotation path — needs an override reason");
    }
    if (needAfter > 0) {
      reasons.push(`Would still need ${needAfter} for target`);
    } else if (resultingSquadCount > s.targetCount) {
      reasons.push("Would exceed target size");
    } else {
      reasons.push("Reaches target squad size");
    }

    return {
      matchId: s.matchId,
      teamName: s.teamName,
      teamKitColor: s.teamKitColor,
      resultingSquadCount,
      targetCount: s.targetCount,
      reasons,
      isRecommended: false,
      needAfter,
    };
  });

  // Deterministic recommendation: the most-under-target suggestion whose role derivation is
  // valid (core team or an active path) wins; ties resolve by lane order (input order).
  const valid = enriched.filter(
    (s, i) => suggestions[i].isCoreTeam || suggestions[i].hasRotationPath,
  );
  const pool = valid.length > 0 ? valid : enriched;
  const recommended = pool.reduce((best, current) => (current.needAfter > best.needAfter ? current : best), pool[0]);
  if (recommended) recommended.isRecommended = true;

  return {
    playerId: player.playerId,
    displayName: player.displayName,
    shirtNumber: player.shirtNumber,
    kitColor: player.kitColor,
    positions: player.positions,
    attentionSummary: player.attentionSummary,
    suggestions: enriched,
  };
}

export function buildAllocationMatrix(
  matches: BoardMatchInput[],
  roster: {
    playerId: string;
    displayName: string;
    shirtNumber: number | null;
    kitColor: string | null;
  }[],
  assignmentByPlayerId: Map<string, string | null>,
  targetPerPlayer: number,
): { columns: AllocationMatrixColumn[]; rows: AllocationMatrixRow[] } {
  const columns: AllocationMatrixColumn[] = matches.map((m) => ({
    matchId: m.matchId,
    teamName: m.teamName,
    teamKitColor: m.teamKitColor,
  }));

  const rows: AllocationMatrixRow[] = roster.map((p) => {
    const assignedMatchId = assignmentByPlayerId.get(p.playerId) ?? null;
    const assignments: Record<string, boolean> = {};
    for (const m of matches) {
      assignments[m.matchId] = assignedMatchId === m.matchId;
    }
    const total = assignedMatchId ? 1 : 0;
    return {
      playerId: p.playerId,
      displayName: p.displayName,
      shirtNumber: p.shirtNumber,
      kitColor: p.kitColor,
      assignments,
      total,
      target: targetPerPlayer,
      status: total >= targetPerPlayer ? "OK" : "NEEDS_ASSIGNMENT",
    };
  });

  // Needs-assignment rows float to the top — the matrix is for difficult rounds.
  rows.sort((a, b) => (a.status === b.status ? a.displayName.localeCompare(b.displayName) : a.status === "NEEDS_ASSIGNMENT" ? -1 : 1));

  return { columns, rows };
}

/**
 * Round Board rail "Insights" mode ordering (`06_ROUND_BOARD.md`: "When a player is selected,
 * prioritize insight rows that involve that player or the destination being considered."). A
 * stable sort — severity (BLOCKED before DECISION_REQUIRED) first, then the selected player's own
 * rows within each severity group — never a re-derivation of severity or a new ranking score.
 */
export function sortAttentionForSelection(
  items: RoundBoardAttentionItem[],
  selectedPlayerId: string | null,
): RoundBoardAttentionItem[] {
  const severityRank: Record<RoundBoardAttentionItem["severity"], number> = { BLOCKED: 0, DECISION_REQUIRED: 1 };
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const severityDiff = severityRank[a.item.severity] - severityRank[b.item.severity];
      if (severityDiff !== 0) return severityDiff;
      if (selectedPlayerId) {
        const aMatches = a.item.playerId === selectedPlayerId ? 0 : 1;
        const bMatches = b.item.playerId === selectedPlayerId ? 0 : 1;
        if (aMatches !== bMatches) return aMatches - bMatches;
      }
      return a.index - b.index; // stable tiebreak — preserve original (upstream) order otherwise.
    })
    .map(({ item }) => item);
}

/**
 * Round Board rail "Development" mode (`06_ROUND_BOARD.md`): context only for the
 * currently-selected player, built from the evolving player-position model's already-computed
 * profile and the player's already-recorded active `DevelopmentThread` categories. Every reason
 * is a pass-through fact, never an invented recommendation — this never produces an action.
 */
export function buildRoundBoardDevelopmentContext(params: {
  playerId: string;
  displayName: string;
  activeFocusCategories: string[];
  effectivePositions: RoundBoardEffectivePosition[];
}): RoundBoardDevelopmentContext {
  return {
    playerId: params.playerId,
    displayName: params.displayName,
    activeFocusCategories: params.activeFocusCategories,
    effectivePositions: params.effectivePositions,
  };
}