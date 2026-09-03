// ─────────────────────────────────────────────────────────────────
// Position suitability: maps player positions to structural role
// fit tiers and computes role-relevant strengths.
//
// Reuses and aligns with the existing player-position-resolver
// logic but operates on the shared composition domain types.
// ─────────────────────────────────────────────────────────────────

import type {
  BroadPosition,
  StructuralRole,
  PositionFitTier,
  RoleSuitabilityProfile,
  RoleStrengthProfile,
  CompositionPlayer,
  StructuralSlotRequirement,
} from "./team-composition-types";

import {
  FIT_TIER_PRIORITY,
} from "./team-composition-types";

// ── Position mapping ──────────────────────────────────────────────

const POSITION_CODE_TO_BROAD: Record<string, BroadPosition> = {
  GK: "goalkeeper",
  CB: "defender",
  LB: "defender",
  RB: "defender",
  LCB: "defender",
  RCB: "defender",
  CM: "midfielder",
  DM: "midfielder",
  AM: "midfielder",
  LM: "midfielder",
  RM: "midfielder",
  CDM: "midfielder",
  CAM: "midfielder",
  W: "midfielder",
  LW: "forward",
  RW: "forward",
  ST: "forward",
  CF: "forward",
  SS: "forward",
};

export function mapPositionCodeToBroad(position: string): BroadPosition {
  if (POSITION_CODE_TO_BROAD[position]) return POSITION_CODE_TO_BROAD[position];
  const lower = position.toLowerCase();
  if (lower.includes("gk") || lower.includes("goalkeeper") || lower === "keeper") return "goalkeeper";
  if (lower.includes("def") || lower.includes("cb") || lower.includes("lb") || lower.includes("rb") || lower === "cb") return "defender";
  if (lower.includes("mid") || lower.includes("cm") || lower.includes("dm") || lower.includes("am") || lower === "cm") return "midfielder";
  if (lower.includes("for") || lower.includes("st") || lower.includes("wing") || lower.includes("cf") || lower === "st") return "forward";
  return "flexible";
}

// ── Position fit tier ────────────────────────────────────────────

export function getPositionFit(
  primaryPosition: BroadPosition | undefined,
  secondaryPosition: BroadPosition | undefined,
  tertiaryPosition: BroadPosition | undefined,
  acceptedPositions: BroadPosition[],
): PositionFitTier {
  if (!acceptedPositions || acceptedPositions.length === 0) return "NO_FIT";
  const accepted = new Set(acceptedPositions);
  // A player whose primary position directly matches gets PRIMARY
  if (primaryPosition && accepted.has(primaryPosition)) return "PRIMARY";
  // A flexible-primary player in a role that accepts flexible gets PRIMARY
  if (primaryPosition === "flexible" && accepted.has("flexible")) return "PRIMARY";
  // Secondary position match gets SECONDARY
  if (secondaryPosition && accepted.has(secondaryPosition)) return "SECONDARY";
  // Tertiary position match gets TERTIARY
  if (tertiaryPosition && accepted.has(tertiaryPosition)) return "TERTIARY";
  // A flexible-primary player can fill any role at TERTIARY level
  if (primaryPosition === "flexible") return "TERTIARY";
  // A player with flexible as secondary/tertiary trait gets TERTIARY for any role that accepts flexible
  if (secondaryPosition === "flexible" || tertiaryPosition === "flexible") return "TERTIARY";
  // A role that accepts "flexible" can be filled by any player, but at TERTIARY fit — not PRIMARY
  // This prevents attackers from being PRIMARY fit for defence just because the role accepts flexible players
  if (accepted.has("flexible")) return "TERTIARY";
  return "NO_FIT";
}

export function getRoleFit(
  player: CompositionPlayer,
  role: StructuralRole,
): PositionFitTier {
  return player.roleSuitability[roleToKey(role)];
}

export function roleToKey(role: StructuralRole): keyof RoleSuitabilityProfile {
  switch (role) {
    case "GOALKEEPER": return "goalkeeper";
    case "DEFENCE": return "defence";
    case "MIDFIELD": return "midfield";
    case "ATTACK": return "attack";
    case "FLEXIBLE": return "flexible";
  }
}

// ── Declared-position role suitability ──────────────────────────────
//
// The single owner of "declared primary/secondary/tertiary position ->
// RoleSuitabilityProfile" (Evidence-Informed Match Planning, Bundle 5,
// ADR-0116). Previously duplicated inline inside
// league-team-adapter.ts; moved here so both league-team composition
// and the evidence-aware outfield-role-suitability adapter
// (src/lib/players/get-player-outfield-role-suitability.ts) share one
// implementation instead of two copies of the same business rule.

export interface DeclaredPlayerPositions {
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
}

export function buildRoleSuitability(player: DeclaredPlayerPositions): RoleSuitabilityProfile {
  const primary = mapPositionCodeToBroad(player.primaryPosition ?? "") as BroadPosition;
  const secondary = player.secondaryPosition ? (mapPositionCodeToBroad(player.secondaryPosition) as BroadPosition) : undefined;
  const tertiary = player.tertiaryPosition ? (mapPositionCodeToBroad(player.tertiaryPosition) as BroadPosition) : undefined;

  return {
    goalkeeper: getPositionFit(primary, secondary, tertiary, ["goalkeeper"]),
    defence: getPositionFit(primary, secondary, tertiary, ["defender", "flexible"]),
    midfield: getPositionFit(primary, secondary, tertiary, ["midfielder", "flexible"]),
    attack: getPositionFit(primary, secondary, tertiary, ["forward", "flexible"]),
    flexible: getPositionFit(primary, secondary, tertiary, ["defender", "midfielder", "forward", "goalkeeper", "flexible"]),
  };
}

// ── Role-relevant strength ───────────────────────────────────────

const ROLE_STRENGTH_WEIGHTS: Record<StructuralRole, Record<string, number>> = {
  GOALKEEPER: { goalkeeper: 0.5, gameUnderstanding: 0.2, intensity: 0.15, teamplay: 0.15 },
  DEFENCE: { defending: 0.35, gameUnderstanding: 0.25, intensity: 0.2, teamplay: 0.2 },
  MIDFIELD: { gameUnderstanding: 0.3, teamplay: 0.25, attacking: 0.2, defending: 0.15, intensity: 0.1 },
  ATTACK: { attacking: 0.35, gameUnderstanding: 0.25, intensity: 0.15, teamplay: 0.15, defending: 0.1 },
  FLEXIBLE: { gameUnderstanding: 0.2, teamplay: 0.2, intensity: 0.2, attacking: 0.2, defending: 0.2 },
};

const COMPOSITE_KEY_TO_ATTRIBUTE: Record<string, keyof RoleStrengthProfile> = {
  goalkeeper: "goalkeeper",
  defending: "defence",
  gameUnderstanding: "midfield",
  intensity: "midfield",
  teamplay: "midfield",
  attacking: "attack",
};

export function computeRoleStrength(
  overallStrength: number,
  roleStrength: RoleStrengthProfile,
  role: StructuralRole,
): number {
  const weights = ROLE_STRENGTH_WEIGHTS[role];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [attr, weight] of Object.entries(weights)) {
    const key = COMPOSITE_KEY_TO_ATTRIBUTE[attr] ?? attr;
    const value = roleStrength[key as keyof RoleStrengthProfile];
    if (value !== null && value !== undefined) {
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return overallStrength;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

// ── Position scarcity ────────────────────────────────────────────

export interface PositionScarcity {
  position: BroadPosition;
  primaryCandidateCount: number;
  totalCandidateCount: number;
  teamCount: number;
  isScarce: boolean;
  note: string;
}

export function computePositionScarcity(
  players: CompositionPlayer[],
  teamCount: number,
): PositionScarcity[] {
  const roles: StructuralRole[] = ["GOALKEEPER", "DEFENCE", "MIDFIELD", "ATTACK", "FLEXIBLE"];
  return roles.map((role) => {
    const position: BroadPosition = role === "GOALKEEPER" ? "goalkeeper"
      : role === "DEFENCE" ? "defender"
      : role === "MIDFIELD" ? "midfielder"
      : role === "ATTACK" ? "forward"
      : "flexible";
    const primaryCount = players.filter(
      (p) => p.active && p.available && p.roleSuitability[roleToKey(role)] === "PRIMARY",
    ).length;
    const totalCount = players.filter(
      (p) => p.active && p.available && p.roleSuitability[roleToKey(role)] !== "NO_FIT",
    ).length;
    const isScarce = primaryCount < teamCount;
    const note = isScarce
      ? `Only ${primaryCount} primary ${position} candidates for ${teamCount} teams`
      : `${primaryCount} primary ${position} candidates for ${teamCount} teams`;
    return { position, primaryCandidateCount: primaryCount, totalCandidateCount: totalCount, teamCount, isScarce, note };
  });
}

// ── Slot compatibility ───────────────────────────────────────────

export function getCandidatesForSlot(
  players: CompositionPlayer[],
  slot: StructuralSlotRequirement,
  assignedPlayerIds: Set<string>,
): { primary: CompositionPlayer[]; secondary: CompositionPlayer[]; tertiary: CompositionPlayer[]; noFit: CompositionPlayer[] } {
  const primary: CompositionPlayer[] = [];
  const secondary: CompositionPlayer[] = [];
  const tertiary: CompositionPlayer[] = [];
  const noFit: CompositionPlayer[] = [];

  for (const player of players) {
    if (!player.active || !player.available) continue;
    if (assignedPlayerIds.has(player.id)) continue;

    const fit = getPositionFit(
      player.primaryBroadPosition,
      undefined,
      undefined,
      slot.acceptedPositions,
    );

    const role = player.primaryBroadPosition === "goalkeeper" ? "GOALKEEPER"
    : player.primaryBroadPosition === "defender" ? "DEFENCE"
    : player.primaryBroadPosition === "midfielder" ? "MIDFIELD"
    : player.primaryBroadPosition === "forward" ? "ATTACK"
    : "FLEXIBLE" as StructuralRole;
    const roleFit = player.roleSuitability[roleToKey(role)] ?? "NO_FIT";

    const effectiveFit: PositionFitTier = FIT_TIER_PRIORITY[roleFit] > FIT_TIER_PRIORITY[fit] ? roleFit : fit;

    switch (effectiveFit) {
      case "PRIMARY": primary.push(player); break;
      case "SECONDARY": secondary.push(player); break;
      case "TERTIARY": tertiary.push(player); break;
      case "NO_FIT": noFit.push(player); break;
    }
  }

  return { primary, secondary, tertiary, noFit };
}

// ── Goalkeeper capability ────────────────────────────────────────

export function isGoalkeeperCapable(player: CompositionPlayer): boolean {
  return player.goalkeeperAbility === "YES" || player.goalkeeperAbility === "EMERGENCY" || player.primaryBroadPosition === "goalkeeper";
}

export function getGkCoverageTier(player: CompositionPlayer): "strong" | "acceptable" | "emergency" | "none" {
  if (player.primaryBroadPosition === "goalkeeper" && player.goalkeeperAbility === "YES") return "strong";
  if (player.goalkeeperAbility === "YES") return "acceptable";
  if (player.roleSuitability.goalkeeper === "SECONDARY") return "acceptable";
  if (player.roleSuitability.goalkeeper === "TERTIARY" || player.goalkeeperAbility === "EMERGENCY") return "emergency";
  return "none";
}

// ── Sorting ───────────────────────────────────────────────────────

export function sortByRoleRelevantStrength(
  players: CompositionPlayer[],
  role: StructuralRole,
  seed: string,
): CompositionPlayer[] {
  const sorted = [...players].sort((a, b) => {
    const aStrength = computeRoleStrength(a.overallStrength, a.roleStrength, role);
    const bStrength = computeRoleStrength(b.overallStrength, b.roleStrength, role);
    if (bStrength !== aStrength) return bStrength - aStrength;
    const aFit = FIT_TIER_PRIORITY[a.roleSuitability[roleToKey(role)]];
    const bFit = FIT_TIER_PRIORITY[b.roleSuitability[roleToKey(role)]];
    if (bFit !== aFit) return bFit - aFit;
    return stableCompare(a.id, b.id, seed);
  });
  return sorted;
}

export function sortByOverallStrength(
  players: CompositionPlayer[],
  seed: string,
): CompositionPlayer[] {
  return [...players].sort((a, b) => {
    if (b.overallStrength !== a.overallStrength) return b.overallStrength - a.overallStrength;
    return stableCompare(a.id, b.id, seed);
  });
}

export function stableCompare(a: string, b: string, seed: string): number {
  // Seed-dependent ordering: hash each ID with the seed to produce
  // a seed-dependent sort key. Different seeds produce different
  // relative orderings for tied players, enabling regeneration to
  // produce varied team suggestions.
  const hashA = seedDependentHash(seed, a);
  const hashB = seedDependentHash(seed, b);
  if (hashA !== hashB) return hashA < hashB ? -1 : 1;
  // Fall back to lexicographic for true ties (same hash)
  return a < b ? -1 : a > b ? 1 : 0;
}

function seedDependentHash(seed: string, id: string): number {
  // FNV-1a hash for well-distributed seed-dependent ordering.
  // Different seeds produce meaningfully different sort orders,
  // enabling regeneration to yield varied team compositions.
  const combined = seed + ":" + id;
  let hash = 2166136261;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}