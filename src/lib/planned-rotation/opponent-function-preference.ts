// ─────────────────────────────────────────────────────────────────
// Shared opponent-tendency -> tactical-function preference (Evidence-Informed Match Planning,
// Bundles 7-8, ADR-0118/ADR-0119). One owner for the football-judgment mapping and the bounded
// scoring it feeds, reused by both the rotation-plan generator (Bundle 7) and the integrated
// starting-lineup generator (Bundle 8) — a real football decision like this should exist exactly
// once, not be re-justified in two files.
// ─────────────────────────────────────────────────────────────────

import {
  computeTacticalFunctionFit,
  type TacticalFunctionAttributes,
} from "@/domain/team-composition/outfield-role-evidence";
import type { OutfieldRoleSuitabilityResult, TacticalFunctionCode } from "@/domain/team-composition/team-composition-types";
import { capEvidenceBonus } from "@/lib/policies/evidence-guardrails";
import type { OpponentPlayingStyleTag } from "@/generated/prisma/client";

export const MAX_OPPONENT_FUNCTION_BONUS = 6;

// A small, explicit, football-justified mapping — not an attempt to cover every tag. Each pairing
// names the response it stands for; tags with no clear, defensible functional response are
// deliberately left unmapped rather than guessed (PROGRAMME.md: "not vague AI labels").
export const OPPONENT_TENDENCY_PREFERRED_FUNCTION: Partial<Record<OpponentPlayingStyleTag, TacticalFunctionCode>> = {
  SLOW_BUILD_UP: "FIRST_LINE_PRESS",
  TECHNICAL_AND_PATIENT: "FIRST_LINE_PRESS",
  POSSESSION_BASED: "FIRST_LINE_PRESS",
  HIGH_PRESSING: "PACE_IN_BEHIND",
  LOW_BLOCK: "HOLD_UP_LINK_PLAY",
  COUNTER_ATTACKING: "CENTRAL_DEFENSIVE_CONTINUITY",
  FAST_PACED_TRANSITIONS: "CENTRAL_DEFENSIVE_CONTINUITY",
};

export type OpponentFunctionTendency = {
  tag: OpponentPlayingStyleTag;
  confidence: "INSUFFICIENT" | "EMERGING" | "ESTABLISHED";
};

export function preferredFunctionFor(
  tendencies: OpponentFunctionTendency[] | undefined,
): { code: TacticalFunctionCode; confidence: "EMERGING" | "ESTABLISHED" } | null {
  if (!tendencies) return null;
  for (const tendency of tendencies) {
    if (tendency.confidence === "INSUFFICIENT") continue;
    const code = OPPONENT_TENDENCY_PREFERRED_FUNCTION[tendency.tag];
    if (code) return { code, confidence: tendency.confidence };
  }
  return null;
}

/**
 * Bounded, confidence-gated bonus for a candidate's fit for whichever tactical function the
 * opponent's recorded tendency favours — 0 when no tendency, no mapped function, or the
 * candidate isn't a strong fit. Never a penalty; never excludes anyone (Bundle 6).
 */
export function computeOpponentFunctionBonus(
  attributes: TacticalFunctionAttributes,
  outfieldProfile: OutfieldRoleSuitabilityResult[],
  preferred: { code: TacticalFunctionCode; confidence: "EMERGING" | "ESTABLISHED" } | null,
): number {
  if (!preferred) return 0;
  const fit = computeTacticalFunctionFit(preferred.code, attributes, outfieldProfile);
  if (fit.tier !== "STRONG_FIT") return 0;
  const raw = preferred.confidence === "ESTABLISHED" ? 8 : 4;
  return capEvidenceBonus(raw, MAX_OPPONENT_FUNCTION_BONUS);
}
