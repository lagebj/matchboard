// ─────────────────────────────────────────────────────────────────
// Neutral coach-facing labels for exact positional fit (ADR-0129 §15).
//
// Never player-value language ("weak player", "bad position", "harmful
// player"). Fit describes the role relationship, not the player.
// ─────────────────────────────────────────────────────────────────

import type { SuitabilityTier } from "./matrix";

export const FIT_TIER_LABEL: Record<SuitabilityTier, string> = {
  NATURAL: "Natural fit",
  STRONG: "Strong fit",
  PLAUSIBLE: "Plausible fit",
  DEVELOPMENTAL: "Developmental positional fit",
  UNSUPPORTED: "Outside automatic fit",
};

export function fitLabel(tier: SuitabilityTier): string {
  return FIT_TIER_LABEL[tier];
}

/** DEVELOPMENTAL: small neutral annotation, no modal. */
export function developmentalAnnotation(): string {
  return "Developmental positional fit — outside the usual automatic range for this role.";
}

/**
 * UNSUPPORTED manual assignment requires one explicit confirmation (§15).
 * DEVELOPMENTAL does not — it only shows {@link developmentalAnnotation}.
 */
export function requiresUnsupportedConfirmation(tier: SuitabilityTier): boolean {
  return tier === "UNSUPPORTED";
}

export const UNSUPPORTED_CONFIRMATION = {
  title: "Use outside automatic positional fit?",
  /** `<Player>` and `<ROLE>` are substituted by the caller. */
  body: (playerName: string, role: string): string =>
    `${playerName} is not currently within Matchboard's automatic fit range for ${role}. You can still make this coaching decision.`,
  cancelLabel: "Cancel",
  confirmLabel: "Assign anyway",
} as const;
