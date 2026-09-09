// ─────────────────────────────────────────────────────────────────
// Evidence-aware automatic rotation plan generation.
//
// Evidence-Informed Match Planning programme, Bundle 7 (ADR-0118),
// with exact positional safety layered on top (ADR-0129 §11).
//
// Generates a complete match rotation plan — a sequence of evolving
// on-field states, not independent substitutions — as
// PlannedRotationChangeData rows the coach reviews/edits through the
// existing Rotations tab exactly like a manually-authored plan
// (src/lib/planned-rotation/planned-rotation.ts remains the sole owner
// of persistence and lineup/minutes projection).
//
// Exact slot occupancy is tracked over time. At each decision point the
// due-out slots and the eligible bench are matched by one deterministic
// bounded bipartite matching (src/domain/positions/matching.ts): a
// bench player is only a candidate for a vacated slot when their
// declared positions make them NATURAL / STRONG / PLAUSIBLE for that
// exact role. If four are due but only three safe replacements exist,
// three rotate and the fourth stays on — a DEVELOPMENTAL / UNSUPPORTED
// player is never used to satisfy the batch size. Every skipped
// replacement is recorded as a diagnostic.
//
// Goalkeeper is never touched — starters with position "GK" are
// excluded entirely from candidacy in both directions.
// ─────────────────────────────────────────────────────────────────

import { assertEvidenceDidNotExcludeCandidates } from "@/lib/policies/evidence-guardrails";
import { projectPlannedMinutes, type PlannedRotationChangeData } from "@/lib/planned-rotation/planned-rotation";
import type { TransitionStructureEvidenceRow } from "@/lib/evidence/transition-structure-evidence";
import { bucketForSubstitutionCount } from "@/lib/evidence/transition-structure-evidence";
import {
  preferredFunctionFor,
  computeOpponentFunctionBonus,
  type OpponentFunctionTendency,
} from "@/lib/planned-rotation/opponent-function-preference";
import { computePositionContextBonus, type PlayerPositionContextEvidence } from "@/lib/evidence/position-context-evidence";
import type { MatchPeriod } from "@/generated/prisma/client";
import { buildReason, type RecommendationReason } from "@/lib/explanations/recommendation-reason";
import { renderReason } from "@/lib/formatters/recommendation-reason-text";
import { computeOutfieldRoleSuitabilityProfile, type TacticalFunctionAttributes } from "@/domain/team-composition/outfield-role-evidence";
import { mapPositionCodeToBroad } from "@/domain/team-composition/position-suitability";
import { deriveExactTargetRole } from "@/domain/positions/slot-target";
import { matchSlotsToCandidates } from "@/domain/positions/matching";
import type { DeclaredPositions } from "@/domain/positions/suitability";
import type { ExactRole } from "@/domain/positions/roles";
import type { FormationSlotRoleType } from "@/lib/formations/types";

export type { OpponentFunctionTendency };

const MINIMUM_USEFUL_STINT_SECONDS = 5 * 60;
const MEANINGFUL_SHARE_GAP_SECONDS = 60;

export interface RotationPlanPlayer {
  playerId: string;
  /** Exact declared positions (ADR-0129) — primary/secondary/tertiary strings + bestSide. */
  declaredPositions: DeclaredPositions;
  tacticalAttributes: TacticalFunctionAttributes;
}

export interface RotationPlanStarter {
  playerId: string;
  /** The slot's `FormationSlotRoleType` (or "GK" for the goalkeeper). */
  position: string;
  /** The slot's grid column, used to resolve an exact target role. Absent → role unresolved. */
  gridX?: number;
}

export interface RotationPlanDecisionPoint {
  atSeconds: number;
  period: MatchPeriod;
  isNaturalBreak: boolean;
}

export interface GenerateRotationPlanInput {
  starters: RotationPlanStarter[];
  benchPlayerIds: string[];
  players: Map<string, RotationPlanPlayer>;
  totalMatchSeconds: number;
  decisionPoints: RotationPlanDecisionPoint[];
  opponentTendencies?: OpponentFunctionTendency[];
  transitionPatterns?: TransitionStructureEvidenceRow[];
  /** Position-context evidence: one row per (playerId, position) pair a bench candidate could
   * be assigned to. Absent/empty contributes no position-context bonus. */
  positionContextEvidence?: PlayerPositionContextEvidence[];
  seed: string;
}

export interface GeneratedRotationChange extends PlannedRotationChangeData {
  /** Structured material reasons (C6 / F6). The single source; `explanation` is derived from it. */
  reasons: RecommendationReason[];
  /** Coach-facing prose, derived from `reasons` via the one formatter — never hand-built here. */
  explanation: string;
}

export interface GenerateRotationPlanResult {
  changes: GeneratedRotationChange[];
  /** Human-readable notes about safe replacements that could not be made (ADR-0129 §6/§11). */
  diagnostics: string[];
}

function stableTiebreak(seed: string, id: string): number {
  let hash = 2166136261;
  const combined = `${seed}:${id}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function broadDeclared(d: DeclaredPositions) {
  return {
    primary: mapPositionCodeToBroad(d.primaryPosition ?? ""),
    secondary: d.secondaryPosition ? mapPositionCodeToBroad(d.secondaryPosition) : undefined,
    tertiary: d.tertiaryPosition ? mapPositionCodeToBroad(d.tertiaryPosition) : undefined,
  };
}

function resolveExactRole(roleLabel: string, gridX: number | undefined): ExactRole | null {
  if (roleLabel === "GK" || gridX == null) return null;
  return deriveExactTargetRole(roleLabel as FormationSlotRoleType, gridX);
}

/**
 * Generates a complete rotation plan. Pure and deterministic — the same input always produces
 * the same output. Never mutates anything; the caller (the DB-bound action) persists the
 * returned changes via the existing `createPlannedRotation()` mutation.
 */
export function generateRotationPlan(input: GenerateRotationPlanInput): GenerateRotationPlanResult {
  const outfieldStarters = input.starters.filter((s) => s.position !== "GK");
  const startersForProjection = input.starters.map((s) => ({ playerId: s.playerId, position: s.position }));

  const eligibleOutfieldPlayerIds = new Set<string>([
    ...outfieldStarters.map((s) => s.playerId),
    ...input.benchPlayerIds,
  ]);
  const totalOutfieldSlots = outfieldStarters.length;
  const totalEligibleOutfieldPlayers = eligibleOutfieldPlayerIds.size;
  const fairShareSecondsTotal =
    totalEligibleOutfieldPlayers > 0
      ? (input.totalMatchSeconds * totalOutfieldSlots) / totalEligibleOutfieldPlayers
      : 0;

  const preferred = preferredFunctionFor(input.opponentTendencies);

  const changes: GeneratedRotationChange[] = [];
  const diagnostics: string[] = [];
  const lastEntrySeconds = new Map<string, number>();
  for (const starter of outfieldStarters) lastEntrySeconds.set(starter.playerId, 0);

  // Exact slot occupancy over time: playerId → the role label + resolved exact role they hold.
  type SlotOccupancy = { roleLabel: string; exactRole: ExactRole | null };
  const onPitchSlot = new Map<string, SlotOccupancy>();
  for (const starter of outfieldStarters) {
    onPitchSlot.set(starter.playerId, { roleLabel: starter.position, exactRole: resolveExactRole(starter.position, starter.gridX) });
  }

  const onPitchOutfieldIds = new Set(outfieldStarters.map((s) => s.playerId));
  const benchAvailable = new Set(input.benchPlayerIds);

  const sortedPoints = [...input.decisionPoints].sort((a, b) => a.atSeconds - b.atSeconds);

  for (const point of sortedPoints) {
    if (point.atSeconds <= 0 || point.atSeconds >= input.totalMatchSeconds) continue;

    const targetToDate = fairShareSecondsTotal * (point.atSeconds / input.totalMatchSeconds);
    const minutesSoFar = projectPlannedMinutes(startersForProjection, changes, point.atSeconds);
    const secondsSoFarByPlayer = new Map(minutesSoFar.map((m) => [m.playerId, Math.round(m.plannedMinutes * 60)]));

    const dueOut = [...onPitchOutfieldIds]
      .map((playerId) => {
        const stint = point.atSeconds - (lastEntrySeconds.get(playerId) ?? 0);
        const accumulated = secondsSoFarByPlayer.get(playerId) ?? 0;
        const overShare = accumulated - targetToDate;
        return { playerId, stint, overShare };
      })
      .filter((c) => (point.isNaturalBreak || c.stint >= MINIMUM_USEFUL_STINT_SECONDS) && c.overShare >= MEANINGFUL_SHARE_GAP_SECONDS)
      .sort((a, b) => b.overShare - a.overShare || stableTiebreak(input.seed, a.playerId) - stableTiebreak(input.seed, b.playerId));

    const availableIn = [...benchAvailable]
      .map((playerId) => {
        const accumulated = secondsSoFarByPlayer.get(playerId) ?? 0;
        const underShare = Math.max(0, targetToDate - accumulated);
        return { playerId, underShare };
      })
      .filter((c) => c.underShare >= MEANINGFUL_SHARE_GAP_SECONDS)
      .sort((a, b) => b.underShare - a.underShare || stableTiebreak(input.seed, a.playerId) - stableTiebreak(input.seed, b.playerId));

    if (dueOut.length === 0 || availableIn.length === 0) continue;

    const minutesLabel = Math.round(point.atSeconds / 60);

    // Build the due-slot list. A due player whose slot has no resolvable exact role cannot be
    // safely rotated — they stay on, with a diagnostic.
    const dueSlots: { slotId: string; targetRole: ExactRole }[] = [];
    const dueBySlotId = new Map<string, { playerId: string; roleLabel: string }>();
    for (const due of dueOut) {
      const occupancy = onPitchSlot.get(due.playerId);
      if (!occupancy || occupancy.exactRole == null) {
        diagnostics.push(`Slot role for a due player could not be resolved at ${minutesLabel} min — kept on`);
        continue;
      }
      const slotId = `slot:${due.playerId}`;
      dueSlots.push({ slotId, targetRole: occupancy.exactRole });
      dueBySlotId.set(slotId, { playerId: due.playerId, roleLabel: occupancy.roleLabel });
    }
    if (dueSlots.length === 0) continue;

    const benchCandidates = availableIn.map((c) => ({
      candidateId: c.playerId,
      declaredPositions: input.players.get(c.playerId)?.declaredPositions ?? { primaryPosition: null },
    }));
    const underShareByPlayer = new Map(availableIn.map((c) => [c.playerId, c.underShare]));

    const matchResult = matchSlotsToCandidates(dueSlots, benchCandidates, {
      seed: `${input.seed}:${point.atSeconds}`,
      fairness: (candidateId) => underShareByPlayer.get(candidateId) ?? 0,
      preference: (candidateId, _slotId, role) => opponentAndContextPreference(input, preferred, candidateId, role),
    });

    // Guardrail (Bundle 6): scoring/matching must never structurally drop a considered candidate.
    assertEvidenceDidNotExcludeCandidates(
      benchCandidates.map((c) => c.candidateId),
      [...matchResult.assignments.map((a) => a.candidateId), ...matchResult.benchedCandidateIds],
      "generateRotationPlan per-tick matching",
    );

    for (const gap of matchResult.unfilledSlots) {
      diagnostics.push(`No safe replacement for ${gap.role} at ${minutesLabel} min`);
    }

    const disruptionBucket = bucketForSubstitutionCount(matchResult.assignments.length);
    const transitionEvidence = input.transitionPatterns?.find(
      (row) => row.period === point.period && row.batchSizeBucket === disruptionBucket && row.isAtNaturalBreak === point.isNaturalBreak,
    );

    for (const assignment of matchResult.assignments) {
      const due = dueBySlotId.get(assignment.slotId);
      if (!due) continue;
      const inId = assignment.candidateId;

      benchAvailable.delete(inId);
      benchAvailable.add(due.playerId);
      onPitchOutfieldIds.delete(due.playerId);
      onPitchOutfieldIds.add(inId);
      lastEntrySeconds.set(inId, point.atSeconds);
      onPitchSlot.delete(due.playerId);
      onPitchSlot.set(inId, { roleLabel: due.roleLabel, exactRole: assignment.role });

      const positionContextBonus = computePositionContextBonus(
        input.positionContextEvidence?.find((e) => e.playerId === inId && e.position === due.roleLabel),
      );
      const opponentBonus = opponentFunctionBonusFor(input, preferred, inId) > 0;

      const reasons = buildRotationReasons({
        underShareSeconds: underShareByPlayer.get(inId) ?? 0,
        evidenceBonus: opponentBonus,
        positionContextBonus: positionContextBonus > 0,
        preferred,
        isNaturalBreak: point.isNaturalBreak,
        transitionEvidence,
      });

      changes.push({
        outPlayerId: due.playerId,
        inPlayerId: inId,
        outPosition: null,
        inPosition: due.roleLabel,
        positionOnly: false,
        approximateMatchSeconds: point.atSeconds,
        notes: null,
        reasons,
        explanation: reasons.map(renderReason).join("; ") + ".",
      });
    }
  }

  return { changes, diagnostics };
}

function opponentFunctionBonusFor(
  input: GenerateRotationPlanInput,
  preferred: ReturnType<typeof preferredFunctionFor>,
  candidateId: string,
): number {
  const player = input.players.get(candidateId);
  if (!player || !preferred) return 0;
  const outfieldProfile = computeOutfieldRoleSuitabilityProfile(broadDeclared(player.declaredPositions), { matchCountByRole: {} });
  return computeOpponentFunctionBonus(player.tacticalAttributes, outfieldProfile, preferred);
}

function opponentAndContextPreference(
  input: GenerateRotationPlanInput,
  preferred: ReturnType<typeof preferredFunctionFor>,
  candidateId: string,
  role: ExactRole,
): number {
  const opponentBonus = opponentFunctionBonusFor(input, preferred, candidateId);
  // The tracked slot's role label drives position-context lookup; for the matcher we only have
  // the exact role, so match on the raw exact role too (callers key evidence by the role label).
  const positionContextBonus = computePositionContextBonus(
    input.positionContextEvidence?.find((e) => e.playerId === candidateId && e.position === role),
  );
  return opponentBonus + positionContextBonus;
}

/**
 * Structured material reasons for one generated rotation change (C6 / F6). The engine builds
 * `RecommendationReason[]`; prose is the formatter's job. Positional fit is the eligibility gate,
 * not a differentiating reason — every matched player is already NATURAL / STRONG / PLAUSIBLE —
 * so no role-fit clause is emitted here.
 */
function buildRotationReasons(args: {
  underShareSeconds: number;
  evidenceBonus: boolean;
  positionContextBonus: boolean;
  preferred: ReturnType<typeof preferredFunctionFor>;
  isNaturalBreak: boolean;
  transitionEvidence: TransitionStructureEvidenceRow | undefined;
}): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];

  reasons.push(
    buildReason("FAIRNESS_UNDER_SHARE", {
      params: { minutesBehind: Math.round(args.underShareSeconds / 60) },
      material: true,
    }),
  );

  if (args.evidenceBonus && args.preferred) {
    reasons.push(
      buildReason("OPPONENT_FUNCTION_CONTINUITY", {
        confidence: args.preferred.confidence,
      }),
    );
  }

  if (args.positionContextBonus) {
    reasons.push(buildReason("POSITION_CONTEXT_HISTORY", { confidence: "EMERGING" }));
  }

  if (args.isNaturalBreak) {
    reasons.push(buildReason("NATURAL_BREAK"));
  }

  if (args.transitionEvidence && args.transitionEvidence.confidence !== "INSUFFICIENT") {
    reasons.push(
      buildReason("TRANSITION_STRUCTURE_CONTEXT", {
        confidence: args.transitionEvidence.confidence,
        params: { occurrences: args.transitionEvidence.occurrences },
        polarity: "CAUTION",
      }),
    );
  }

  return reasons;
}
