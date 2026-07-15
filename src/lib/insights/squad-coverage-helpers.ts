import type { CoverageWarning } from "./insights-types";

export function classifyGKCapability(
  ability: string,
): "primary" | "emergency" | "none" {
  if (ability === "YES") return "primary";
  if (ability === "EMERGENCY") return "emergency";
  return "none";
}

export function classifyPosition(
  primaryPosition: string | null,
): "defender" | "midfielder" | "attacker" | "unassigned" {
  if (!primaryPosition) return "unassigned";
  const pos = primaryPosition.toUpperCase();
  if (["CB", "LB", "RB", "LWB", "RWB", "DEF"].includes(pos)) return "defender";
  if (["CM", "CDM", "CAM", "LM", "RM", "MID"].includes(pos)) return "midfielder";
  if (["ST", "CF", "LW", "RW", "FW", "ATT"].includes(pos)) return "attacker";
  return "unassigned";
}

export function computeCoverageWarnings(input: {
  totalGK: number;
  primaryGK: number;
  secondaryGK: number;
  emergencyGK: number;
  defenders: number;
  midfielders: number;
  attackers: number;
}): CoverageWarning[] {
  const warnings: CoverageWarning[] = [];
  const noGK = input.totalGK === 0;
  const tertiaryOnlyGK =
    !noGK &&
    input.primaryGK === 0 &&
    input.secondaryGK === 0 &&
    input.emergencyGK === 0;

  if (noGK) warnings.push("no_goalkeeper");
  if (input.primaryGK === 0 && !noGK) warnings.push("no_primary_goalkeeper");
  if (tertiaryOnlyGK) warnings.push("tertiary_goalkeeper_only");
  if (input.defenders === 0) warnings.push("no_defenders");
  if (input.midfielders === 0) warnings.push("no_midfielders");
  if (input.attackers === 0) warnings.push("no_attackers");

  return warnings;
}