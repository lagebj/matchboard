import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotData, BroadPosition } from "./types";
import { deriveExactTargetRole } from "@/domain/positions/slot-target";
import { matchSlotsToCandidates, type SafeMatchCandidate, type SafeMatchSlot } from "@/domain/positions/matching";
import { fitLabel } from "@/domain/positions/labels";
import type { SideInput } from "@/domain/positions/roles";

export type FormationSuggestion = {
  formationId: string;
  formationName: string;
  gameFormat: GameFormat;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  warnings: string[];
  slotMatchCount: number;
  slotTotalCount: number;
  goalkeeperAvailable: boolean;
};

export type SuggestFormationInput = {
  gameFormat: GameFormat;
  playerPool: {
    id: string;
    primaryPosition: string;
    secondaryPosition: string | null;
    coreTeamId: string | null;
  }[];
  teamId: string;
  recentFormationId?: string | null;
  formations: {
    id: string;
    name: string;
    gameFormat: GameFormat;
    source: string;
    teamId: string | null;
    slots: FormationSlotData[];
  }[];
};

function isGoalkeeperCompatible(primaryPosition: string, secondaryPositions: string[]): boolean {
  return primaryPosition === "GK" || secondaryPositions.includes("GK");
}

function playerMatchesSlot(
  primaryPosition: string,
  secondaryPosition: string | null,
  acceptedPositionIds: BroadPosition[],
): { match: boolean; level: "primary" | "secondary" | "can_play" | "flexible" | "none" } {
  const primaryBroad = mapExistingPositionToBroadSimple(primaryPosition);
  if (acceptedPositionIds.includes(primaryBroad)) return { match: true, level: "primary" };

  if (secondaryPosition && secondaryPosition !== "NONE") {
    const secondaryBroad = mapExistingPositionToBroadSimple(secondaryPosition);
    if (acceptedPositionIds.includes(secondaryBroad)) return { match: true, level: "secondary" };
  }

  if (acceptedPositionIds.includes("flexible")) return { match: true, level: "flexible" };

  return { match: false, level: "none" };
}

function mapExistingPositionToBroadSimple(position: string): BroadPosition {
  const lower = position.toLowerCase();
  if (lower === "gk") return "goalkeeper";
  if (lower === "cb" || lower === "lb" || lower === "rb") return "defender";
  if (lower === "cm" || lower === "dm" || lower === "am" || lower === "lm" || lower === "rm" || lower === "w") return "midfielder";
  if (lower === "st" || lower === "cf" || lower === "lw" || lower === "rw") return "forward";
  return "flexible";
}

export function suggestFormationForMatch(input: SuggestFormationInput): FormationSuggestion | null {
  const { gameFormat, playerPool, teamId, recentFormationId, formations } = input;
  const is3v3 = gameFormat === "THREE_A_SIDE";

  const compatibleFormations = formations.filter(
    (f) => f.gameFormat === gameFormat,
  );

  if (compatibleFormations.length === 0) return null;

  const hasGoalkeeper = playerPool.some((p) => isGoalkeeperCompatible(p.primaryPosition, p.secondaryPosition ? [p.secondaryPosition] : []));

  const scored = compatibleFormations.map((formation) => {
    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    score += 50;
    reasons.push(`Matches ${formatGameFormatLabelSimple(gameFormat)} game format`);

    if (formation.source === "CUSTOM" && formation.teamId === teamId) {
      score += 20;
      reasons.push("Team custom formation");
    } else if (formation.source === "SYSTEM") {
      reasons.push("System formation");
    }

    if (recentFormationId && formation.id === recentFormationId) {
      score += 15;
      reasons.push("Recently used by this team");
    }

    let slotMatchCount = 0;
    for (const slot of formation.slots) {
      const hasCompatiblePlayer = playerPool.some((p) =>
        playerMatchesSlot(p.primaryPosition, p.secondaryPosition, slot.acceptedPositionIds as BroadPosition[]).match,
      );
      if (hasCompatiblePlayer) {
        score += 10;
        slotMatchCount++;
      } else {
        score -= 10;
        warnings.push(`No compatible player for ${slot.label}`);
      }
    }

    if (!is3v3) {
      const gkSlot = formation.slots.find((s) => s.roleType === "GOALKEEPER");
      if (gkSlot) {
        if (hasGoalkeeper) {
          score += 20;
          reasons.push("Goalkeeper available for this formation");
        } else {
          score -= 100;
          warnings.push("No registered goalkeeper found in planned player pool");
        }
      }
    }

    let confidence: "high" | "medium" | "low" = "low";
    if (slotMatchCount === formation.slots.length && (!is3v3 ? hasGoalkeeper : true)) {
      confidence = "high";
    } else if (slotMatchCount >= formation.slots.length * 0.6) {
      confidence = "medium";
    }

    return {
      formationId: formation.id,
      formationName: formation.name,
      gameFormat: formation.gameFormat,
      score,
      confidence,
      reasons,
      warnings,
      slotMatchCount,
      slotTotalCount: formation.slots.length,
      goalkeeperAvailable: hasGoalkeeper,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0] ?? null;
}

export type LineupSuggestion = {
  assignments: {
    slotId: string;
    playerId: string;
    source: "suggested";
    locked: boolean;
    reasons: string[];
    confidence: "high" | "medium" | "low";
  }[];
  benchPlayerIds: string[];
  warnings: string[];
  unfilledSlotIds: string[];
};

export type LineupEvidenceBonus = {
  /** Already bounded/capped by the caller (Evidence-Informed Match Planning, Bundle 8,
   * ADR-0119) — this module never computes or caps evidence itself, it only adds whatever the
   * caller supplies to the existing position-fit score. */
  score: number;
  reasons: string[];
};

export type SuggestLineupPlayer = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  /** Declared tertiary position, consumed by exact positional eligibility (ADR-0129). */
  tertiaryPosition?: string | null;
  /** `Player.bestSide` — a ±4 modifier for unsided sources → left/right targets (ADR-0129 §6). */
  bestSide?: SideInput;
  coreTeamId: string | null;
};

export type SuggestLineupInput = {
  formationSlots: FormationSlotData[];
  playerPool: SuggestLineupPlayer[];
  existingAssignments?: {
    slotId: string;
    playerId: string;
    locked: boolean;
  }[];
  /** Deterministic tie-break seed for the matcher. Defaults to a stable hash of the input. */
  seed?: string;
  /**
   * Optional evidence-aware WITHIN-TIER preference hook (ADR-0129 §9 objective 6). Contributes a
   * bounded, non-negative preference score (and factual reasons) for a (player, slot) pair —
   * combination evidence, opponent-function fit, position-context evidence, etc., already
   * bounded by the caller. It can only re-order candidates that are ALREADY automatically
   * eligible for the slot's exact target role; it can never widen eligibility or beat a higher
   * fit tier (ADR-0129 §5).
   *
   * `alreadyAssignedPlayerIds` contains only the assignments known BEFORE matching — locked
   * slots and the goalkeeper — not an incremental running set: exact assignment is one
   * deterministic bounded matching, not a sequential greedy fill (ADR-0129 §10).
   */
  evidenceBonusForSlot?: (playerId: string, slot: FormationSlotData, alreadyAssignedPlayerIds: string[]) => LineupEvidenceBonus | undefined;
};

function slotKey(slot: FormationSlotData): string {
  return slot.id ?? `${slot.gridX}-${slot.gridY}`;
}

export function suggestLineupForFormation(input: SuggestLineupInput): LineupSuggestion {
  const { formationSlots, playerPool, existingAssignments = [], evidenceBonusForSlot } = input;

  const assignments: LineupSuggestion["assignments"] = [];
  const warnings: string[] = [];
  const unfilledSlotIds: string[] = [];
  const assignedPlayerIds = new Set<string>();
  const benchPlayerIds: string[] = [];
  const assignedSlotIds = new Set<string>();

  for (const existing of existingAssignments) {
    if (existing.locked) {
      assignedPlayerIds.add(existing.playerId);
      assignedSlotIds.add(existing.slotId);
      assignments.push({
        slotId: existing.slotId,
        playerId: existing.playerId,
        source: "suggested",
        locked: true,
        reasons: ["Locked by coach"],
        confidence: "high",
      });
    }
  }

  const gkSlot = formationSlots.find((s) => s.roleType === "GOALKEEPER");
  if (gkSlot && !assignedSlotIds.has(gkSlot.id ?? `${gkSlot.gridX}-${gkSlot.gridY}`)) {
    const gkSlotId = gkSlot.id ?? `${gkSlot.gridX}-${gkSlot.gridY}`;
    const gkPlayers = playerPool.filter(
      (p) => !assignedPlayerIds.has(p.id) && isGoalkeeperCompatible(p.primaryPosition, p.secondaryPosition ? [p.secondaryPosition] : []),
    );

    if (gkPlayers.length > 0) {
      const gk = gkPlayers[0];
      assignedPlayerIds.add(gk.id);
      assignedSlotIds.add(gkSlotId);
      assignments.push({
        slotId: gkSlotId,
        playerId: gk.id,
        source: "suggested",
        locked: false,
        reasons: ["Only available goalkeeper-compatible player", `Registered as ${gk.primaryPosition}`],
        confidence: gkPlayers.length === 1 ? "high" : "medium",
      });
    } else {
      warnings.push("No goalkeeper-compatible player available");
      unfilledSlotIds.push(gkSlotId);
      assignedSlotIds.add(gkSlotId);
    }
  }

  // Remaining slots (non-GK, not locked). Exact automatic assignment is one deterministic
  // bounded bipartite matching over exact target roles (ADR-0129 §10) — never a greedy per-slot
  // fill. FREE slots derive no automatic target role and are left for manual assignment.
  const remainingSlots = formationSlots.filter((s) => !assignedSlotIds.has(slotKey(s)));

  const matchableSlots: SafeMatchSlot[] = [];
  const slotBySlotId = new Map<string, FormationSlotData>();
  for (const slot of remainingSlots) {
    const key = slotKey(slot);
    if (slot.roleType === "FREE") {
      unfilledSlotIds.push(key);
      assignedSlotIds.add(key);
      warnings.push(`${slot.label} is a Free slot — assign manually`);
      continue;
    }
    const targetRole = deriveExactTargetRole(slot.roleType, slot.gridX);
    if (!targetRole) {
      unfilledSlotIds.push(key);
      assignedSlotIds.add(key);
      warnings.push(`${slot.label} — no automatic target role for this slot`);
      continue;
    }
    matchableSlots.push({ slotId: key, targetRole });
    slotBySlotId.set(key, slot);
  }

  const candidatePool = playerPool.filter((p) => !assignedPlayerIds.has(p.id));
  const candidates: SafeMatchCandidate[] = candidatePool.map((p) => ({
    candidateId: p.id,
    declaredPositions: {
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      tertiaryPosition: p.tertiaryPosition ?? null,
      bestSide: p.bestSide,
    },
  }));

  // Preference (objective 6) is the caller's bounded evidence hook, applied WITHIN a tier only.
  const knownAssignedIds = [...assignedPlayerIds];
  const evidenceReasonsByPair = new Map<string, string[]>();
  const preference = evidenceBonusForSlot
    ? (candidateId: string, slotId: string): number => {
        const slot = slotBySlotId.get(slotId);
        if (!slot) return 0;
        const bonus = evidenceBonusForSlot(candidateId, slot, knownAssignedIds);
        if (!bonus) return 0;
        if (bonus.reasons.length > 0) evidenceReasonsByPair.set(`${candidateId}:${slotId}`, bonus.reasons);
        return bonus.score;
      }
    : undefined;

  const seed =
    input.seed ??
    `${matchableSlots.map((s) => s.slotId).join(",")}|${[...candidatePool.map((p) => p.id)].sort().join(",")}`;

  const matchResult = matchSlotsToCandidates(matchableSlots, candidates, { seed, preference });

  for (const a of matchResult.assignments) {
    assignedPlayerIds.add(a.candidateId);
    assignedSlotIds.add(a.slotId);
    const reasons = [`${fitLabel(a.tier)} for ${a.role}`];
    const evidenceReasons = evidenceReasonsByPair.get(`${a.candidateId}:${a.slotId}`);
    if (evidenceReasons) reasons.push(...evidenceReasons);
    assignments.push({
      slotId: a.slotId,
      playerId: a.candidateId,
      source: "suggested",
      locked: false,
      reasons,
      confidence: a.tier === "PLAUSIBLE" ? "medium" : "high",
    });
  }

  for (const gap of matchResult.unfilledSlots) {
    unfilledSlotIds.push(gap.slotId);
    assignedSlotIds.add(gap.slotId);
    warnings.push(`No safe automatic fit for ${gap.role}`);
  }

  for (const player of playerPool) {
    if (!assignedPlayerIds.has(player.id)) {
      benchPlayerIds.push(player.id);
    }
  }

  return { assignments, benchPlayerIds, warnings, unfilledSlotIds };
}

export type AssignmentMigration = {
  slotId: string;
  newSlotId?: string;
  playerId: string;
  preserved: boolean;
  reason: string;
};

export function preserveAssignmentsOnChange(
  oldSlots: FormationSlotData[],
  newSlots: FormationSlotData[],
  existingAssignments: { slotId: string; playerId: string; locked: boolean }[],
): AssignmentMigration[] {
  const newSlotMap = new Map(newSlots.map((s) => [s.id ?? `${s.gridX},${s.gridY}`, s]));
  const newCoordMap = new Map(newSlots.map((s) => [`${s.gridX},${s.gridY}`, s]));
  // Tracks new-slot targets already claimed by an earlier assignment in this same call, so two
  // old assignments with the same roleType (and no ID/coordinate match) never both migrate onto
  // the same new slot — each new slot can receive at most one preserved player.
  const claimedNewSlotIds = new Set<string>();

  const results: AssignmentMigration[] = [];

  for (const assignment of existingAssignments) {
    const oldSlot = oldSlots.find((s) => (s.id ?? `${s.gridX},${s.gridY}`) === assignment.slotId);
    if (!oldSlot) {
      results.push({
        slotId: assignment.slotId,
        playerId: assignment.playerId,
        preserved: false,
        reason: "Original slot not found in old formation",
      });
      continue;
    }

    const newSlotById = newSlotMap.get(assignment.slotId);
    if (newSlotById && !claimedNewSlotIds.has(assignment.slotId)) {
      claimedNewSlotIds.add(assignment.slotId);
      results.push({
        slotId: assignment.slotId,
        newSlotId: assignment.slotId,
        playerId: assignment.playerId,
        preserved: true,
        reason: "Same slot ID exists in new formation",
      });
      continue;
    }

    const newSlotByCoord = newCoordMap.get(`${oldSlot.gridX},${oldSlot.gridY}`);
    const coordSlotId = newSlotByCoord ? newSlotByCoord.id ?? `${newSlotByCoord.gridX},${newSlotByCoord.gridY}` : null;
    if (newSlotByCoord && newSlotByCoord.roleType === oldSlot.roleType && coordSlotId && !claimedNewSlotIds.has(coordSlotId)) {
      claimedNewSlotIds.add(coordSlotId);
      results.push({
        slotId: assignment.slotId,
        newSlotId: coordSlotId,
        playerId: assignment.playerId,
        preserved: true,
        reason: "Mapped to same coordinate and role type",
      });
      continue;
    }

    const roleMatchSlot = newSlots.find((s) => {
      const id = s.id ?? `${s.gridX},${s.gridY}`;
      return s.roleType === oldSlot.roleType && !claimedNewSlotIds.has(id);
    });
    if (roleMatchSlot) {
      const newId = roleMatchSlot.id ?? `${roleMatchSlot.gridX},${roleMatchSlot.gridY}`;
      claimedNewSlotIds.add(newId);
      results.push({
        slotId: assignment.slotId,
        newSlotId: newId,
        playerId: assignment.playerId,
        preserved: true,
        reason: `Mapped to ${roleMatchSlot.roleType} role type`,
      });
      continue;
    }

    results.push({
      slotId: assignment.slotId,
      playerId: assignment.playerId,
      preserved: false,
      reason: "No matching slot in new formation",
    });
  }

  return results;
}

function formatGameFormatLabelSimple(gameFormat: GameFormat): string {
  switch (gameFormat) {
    case "THREE_A_SIDE": return "3v3";
    case "FIVE_A_SIDE": return "5v5";
    case "SEVEN_A_SIDE": return "7v7";
    case "NINE_A_SIDE": return "9v9";
    case "ELEVEN_A_SIDE": return "11v11";
    default: return gameFormat;
  }
}