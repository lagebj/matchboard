// ─────────────────────────────────────────────────────────────────
// Evidence-aware automatic rotation plan generation.
//
// Evidence-Informed Match Planning programme, Bundle 7 (ADR-0118).
// Generates a complete match rotation plan — a sequence of evolving
// on-field states, not independent substitutions — as PlannedRotationChangeData
// rows the coach reviews/edits through the existing Rotations tab exactly like
// a manually-authored plan (src/lib/planned-rotation/planned-rotation.ts remains
// the sole owner of persistence and lineup/minutes projection; this module never
// duplicates that logic).
//
// Search strategy (disclosed, per PROGRAMME.md "Use a deterministic bounded
// search... avoid exponential brute force. Document candidate generation,
// pruning, scoring precedence, tie-breaking and performance limits."):
//
//   - Candidate decision points are a small, fixed internal grid (1/3 and 2/3 of
//     each playing period, plus the start of every period after the first —
//     a natural-break opportunity). This is a computational search bound, not
//     asserted footballing doctrine — PROGRAMME.md explicitly allows internal
//     time grids on this condition ("They must not become product doctrine").
//   - At each decision point, batch size EMERGES from how many on-pitch outfield
//     players are simultaneously "due" (stint long enough, meaningfully ahead of
//     an equal-share target) — there is no fixed/hard-coded batch-size cap.
//   - This is a deterministic GREEDY algorithm with a minimum-useful-stint floor,
//     not exhaustive backtracking search. A locally-good early substitution is
//     not re-evaluated against every possible future sequence — the fairness
//     target-to-date mechanism (see below) is the bounded stand-in for "a locally
//     good early substitution cannot be accepted if it creates impossible
//     fairness problems later": every decision is made relative to the *whole
//     match's* fair-share curve, not just the moment at hand, but there is no
//     multi-step lookahead/backtracking. Disclosed as a real, deliberate scope
//     limit in ADR-0118, not claimed to be optimal.
//   - Goalkeeper is never touched — starters with position "GK" are excluded
//     entirely from candidacy in both directions (AGENTS.md Goalkeeper boundary).
// ─────────────────────────────────────────────────────────────────

import {
  computeOutfieldRoleSuitabilityProfile,
  computeTacticalFunctionFit,
  type DeclaredBroadPositions,
  type TacticalFunctionAttributes,
} from "@/domain/team-composition/outfield-role-evidence";
import type { OutfieldRoleSuitabilityResult, OutfieldStructuralRole, TacticalFunctionCode } from "@/domain/team-composition/team-composition-types";
import { capEvidenceBonus, assertEvidenceDidNotExcludeCandidates } from "@/lib/policies/evidence-guardrails";
import { projectPlannedMinutes, type PlannedRotationChangeData } from "@/lib/planned-rotation/planned-rotation";
import type { TransitionStructureEvidenceRow } from "@/lib/evidence/transition-structure-evidence";
import { bucketForSubstitutionCount } from "@/lib/evidence/transition-structure-evidence";
import type { MatchPeriod, OpponentPlayingStyleTag } from "@/generated/prisma/client";

const MINIMUM_USEFUL_STINT_SECONDS = 5 * 60;
const MEANINGFUL_SHARE_GAP_SECONDS = 60;
const MAX_OPPONENT_FUNCTION_BONUS = 6;

// A small, explicit, football-justified mapping — not an attempt to cover every tag. Each pairing
// names the response it stands for; tags with no clear, defensible functional response are
// deliberately left unmapped rather than guessed (PROGRAMME.md: "not vague AI labels").
const OPPONENT_TENDENCY_PREFERRED_FUNCTION: Partial<Record<OpponentPlayingStyleTag, TacticalFunctionCode>> = {
  SLOW_BUILD_UP: "FIRST_LINE_PRESS",
  TECHNICAL_AND_PATIENT: "FIRST_LINE_PRESS",
  POSSESSION_BASED: "FIRST_LINE_PRESS",
  HIGH_PRESSING: "PACE_IN_BEHIND",
  LOW_BLOCK: "HOLD_UP_LINK_PLAY",
  COUNTER_ATTACKING: "CENTRAL_DEFENSIVE_CONTINUITY",
  FAST_PACED_TRANSITIONS: "CENTRAL_DEFENSIVE_CONTINUITY",
};

export interface RotationPlanPlayer {
  playerId: string;
  declaredPositions: DeclaredBroadPositions;
  tacticalAttributes: TacticalFunctionAttributes;
}

export interface RotationPlanStarter {
  playerId: string;
  position: string;
}

export interface RotationPlanDecisionPoint {
  atSeconds: number;
  period: MatchPeriod;
  isNaturalBreak: boolean;
}

export interface OpponentFunctionTendency {
  tag: OpponentPlayingStyleTag;
  confidence: "INSUFFICIENT" | "EMERGING" | "ESTABLISHED";
}

export interface GenerateRotationPlanInput {
  starters: RotationPlanStarter[];
  benchPlayerIds: string[];
  players: Map<string, RotationPlanPlayer>;
  totalMatchSeconds: number;
  decisionPoints: RotationPlanDecisionPoint[];
  opponentTendencies?: OpponentFunctionTendency[];
  transitionPatterns?: TransitionStructureEvidenceRow[];
  seed: string;
}

export interface GeneratedRotationChange extends PlannedRotationChangeData {
  explanation: string;
}

export interface GenerateRotationPlanResult {
  changes: GeneratedRotationChange[];
}

/**
 * `position`/`vacatedRole` strings arriving from real match line-ups are raw
 * `FormationSlotRoleType` values (DEFENDER/DEFENSIVE_MIDFIELDER/MIDFIELDER/
 * ATTACKING_MIDFIELDER/FORWARD/FREE — see checkPlannedRotationCoverageAction's identical
 * convention), not the `OutfieldStructuralRole` vocabulary role-suitability uses. This maps
 * either convention (also accepting the OutfieldStructuralRole strings directly, so a caller
 * that already resolved a broad role — e.g. this module's own tests — works unchanged) onto
 * the four suitability roles, defaulting unrecognised labels to FLEXIBLE rather than guessing a
 * specific line.
 */
function mapPositionLabelToOutfieldRole(label: string): OutfieldStructuralRole {
  switch (label) {
    case "DEFENCE":
    case "DEFENDER":
      return "DEFENCE";
    case "MIDFIELD":
    case "MIDFIELDER":
    case "DEFENSIVE_MIDFIELDER":
    case "ATTACKING_MIDFIELDER":
      return "MIDFIELD";
    case "ATTACK":
    case "FORWARD":
      return "ATTACK";
    default:
      return "FLEXIBLE";
  }
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

function preferredFunctionFor(tendencies: OpponentFunctionTendency[] | undefined): { code: TacticalFunctionCode; confidence: "EMERGING" | "ESTABLISHED" } | null {
  if (!tendencies) return null;
  for (const tendency of tendencies) {
    if (tendency.confidence === "INSUFFICIENT") continue;
    const code = OPPONENT_TENDENCY_PREFERRED_FUNCTION[tendency.tag];
    if (code) return { code, confidence: tendency.confidence };
  }
  return null;
}

function opponentFunctionBonus(
  candidate: RotationPlanPlayer,
  outfieldProfile: OutfieldRoleSuitabilityResult[],
  preferred: { code: TacticalFunctionCode; confidence: "EMERGING" | "ESTABLISHED" } | null,
): number {
  if (!preferred) return 0;
  const fit = computeTacticalFunctionFit(preferred.code, candidate.tacticalAttributes, outfieldProfile);
  if (fit.tier !== "STRONG_FIT") return 0;
  const raw = preferred.confidence === "ESTABLISHED" ? 8 : 4;
  return capEvidenceBonus(raw, MAX_OPPONENT_FUNCTION_BONUS);
}

const ROLE_TIER_SCORE: Record<OutfieldRoleSuitabilityResult["tier"], number> = {
  NATURAL: 30,
  PLAUSIBLE: 20,
  DEVELOPMENTAL: 10,
  UNSUPPORTED: 0,
};

/**
 * Generates a complete rotation plan. Pure and deterministic — the same input always produces
 * the same output. Never mutates anything; the caller (the DB-bound action) is responsible for
 * persisting the returned changes via the existing `createPlannedRotation()` mutation.
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
  const lastEntrySeconds = new Map<string, number>();
  for (const starter of outfieldStarters) lastEntrySeconds.set(starter.playerId, 0);

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

    const consideredBenchIdsBefore = availableIn.map((c) => c.playerId);
    const usedThisTick = new Set<string>();
    const changesAtThisPoint: GeneratedRotationChange[] = [];

    for (const out of dueOut) {
      const vacatedRole = input.starters.find((s) => s.playerId === out.playerId)?.position
        ?? [...changes].reverse().find((c) => c.inPlayerId === out.playerId)?.inPosition
        ?? "FLEXIBLE";

      const remainingCandidates = availableIn.filter((c) => !usedThisTick.has(c.playerId));
      if (remainingCandidates.length === 0) break;

      const scored = remainingCandidates.map((candidate) => {
        const player = input.players.get(candidate.playerId);
        if (!player) return { candidate, score: -Infinity, outfieldProfile: [] as OutfieldRoleSuitabilityResult[], roleResult: undefined, evidenceBonus: 0 };

        const outfieldProfile = computeOutfieldRoleSuitabilityProfile(player.declaredPositions, { matchCountByRole: {} });
        const roleResult = outfieldProfile.find((r) => r.role === mapPositionLabelToOutfieldRole(vacatedRole));
        const roleScore = roleResult ? ROLE_TIER_SCORE[roleResult.tier] : 0;
        const fairnessScore = Math.min(candidate.underShare, 600) / 10;
        const evidenceBonus = opponentFunctionBonus(player, outfieldProfile, preferred);
        const tiebreak = stableTiebreak(input.seed, candidate.playerId) / 1e10;

        return { candidate, score: roleScore + fairnessScore + evidenceBonus + tiebreak, outfieldProfile, roleResult, evidenceBonus };
      });

      // Guardrail (Bundle 6): scoring must never shrink who was actually considered for this
      // vacated slot — everyone in `remainingCandidates` must still appear in `scored`.
      assertEvidenceDidNotExcludeCandidates(
        remainingCandidates.map((c) => c.playerId),
        scored.map((s) => s.candidate.playerId),
        "generateRotationPlan bench candidate scoring",
      );

      scored.sort((a, b) => b.score - a.score);
      const chosen = scored[0];
      if (!chosen || chosen.score === -Infinity) continue;

      usedThisTick.add(chosen.candidate.playerId);
      benchAvailable.delete(chosen.candidate.playerId);
      benchAvailable.add(out.playerId);
      onPitchOutfieldIds.delete(out.playerId);
      onPitchOutfieldIds.add(chosen.candidate.playerId);
      lastEntrySeconds.set(chosen.candidate.playerId, point.atSeconds);

      const disruptionBucket = bucketForSubstitutionCount(dueOut.length);
      const transitionEvidence = input.transitionPatterns?.find(
        (row) => row.period === point.period && row.batchSizeBucket === disruptionBucket && row.isAtNaturalBreak === point.isNaturalBreak,
      );

      changesAtThisPoint.push({
        outPlayerId: out.playerId,
        inPlayerId: chosen.candidate.playerId,
        outPosition: null,
        inPosition: vacatedRole,
        positionOnly: false,
        approximateMatchSeconds: point.atSeconds,
        notes: null,
        explanation: buildExplanation({
          roleResult: chosen.roleResult,
          underShareSeconds: chosen.candidate.underShare,
          evidenceBonus: chosen.evidenceBonus > 0,
          preferred,
          isNaturalBreak: point.isNaturalBreak,
          transitionEvidence,
        }),
      });
    }

    if (changesAtThisPoint.length > 0) {
      // Every bench player considered at this tick who was not swapped on remains a candidate
      // for a future tick — evidence-informed scoring only ever picks among candidates, it never
      // structurally removes an unpicked one from future consideration.
      const notSwappedOnThisTick = consideredBenchIdsBefore.filter((id) => !usedThisTick.has(id));
      assertEvidenceDidNotExcludeCandidates(notSwappedOnThisTick, [...benchAvailable], "generateRotationPlan tick completion");
      changes.push(...changesAtThisPoint);
    }
  }

  return { changes };
}

function buildExplanation(args: {
  roleResult: OutfieldRoleSuitabilityResult | undefined;
  underShareSeconds: number;
  evidenceBonus: boolean;
  preferred: { code: TacticalFunctionCode; confidence: "EMERGING" | "ESTABLISHED" } | null;
  isNaturalBreak: boolean;
  transitionEvidence: TransitionStructureEvidenceRow | undefined;
}): string {
  const parts: string[] = [];

  const minutesBehind = Math.round(args.underShareSeconds / 60);
  parts.push(`${minutesBehind} min behind an equal share of game time`);

  if (args.roleResult && args.roleResult.tier !== "UNSUPPORTED") {
    parts.push(`${args.roleResult.tier.toLowerCase()} fit for the vacated role`);
  }

  if (args.evidenceBonus && args.preferred) {
    parts.push(`helps preserve a useful function against a recorded opponent tendency`);
  }

  if (args.isNaturalBreak) {
    parts.push("at a natural break");
  }

  if (args.transitionEvidence && args.transitionEvidence.confidence !== "INSUFFICIENT") {
    const perOccurrence = args.transitionEvidence.occurrences > 0
      ? (args.transitionEvidence.goalsAgainstInWindow / args.transitionEvidence.occurrences).toFixed(1)
      : "0";
    parts.push(`similar changes have ${perOccurrence} goals conceded shortly after on average across ${args.transitionEvidence.occurrences} prior instances`);
  }

  return parts.join("; ") + ".";
}
