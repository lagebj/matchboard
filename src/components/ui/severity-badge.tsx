import {
  OctagonAlert,
  AlertTriangle,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { type WarningSeverity } from "@/generated/prisma/client";
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";

export type SignalLevel = "blocked" | "decisionRequired" | "planningNote";

/**
 * Per ADR 0007 signal badges now use the calm semantic palette and reuse the
 * shared StatusPill primitive.
 */
type SignalConfig = {
  label: string;
  icon: LucideIcon;
  variant: StatusPillVariant;
};

const signalConfig: Record<SignalLevel, SignalConfig> = {
  blocked: { label: "Blocked", icon: OctagonAlert, variant: "danger" },
  decisionRequired: { label: "Decision required", icon: AlertTriangle, variant: "warning" },
  planningNote: { label: "Planning note", icon: FileText, variant: "neutral" },
};

export function SignalBadge({ level }: { level: SignalLevel }) {
  const config = signalConfig[level] ?? signalConfig.planningNote;
  return (
    <StatusPill variant={config.variant} icon={config.icon}>
      {config.label}
    </StatusPill>
  );
}

export function signalConfigFor(level: SignalLevel): SignalConfig {
  return signalConfig[level] ?? signalConfig.planningNote;
}

export function signalLevelFromDbSeverity(dbSeverity: WarningSeverity): SignalLevel {
  switch (dbSeverity) {
    case "HARD_BLOCK":
      return "blocked";
    case "REQUIRES_OVERRIDE":
      return "decisionRequired";
    case "WARNING":
      return "planningNote";
    case "SCORING_PREFERENCE":
      return "planningNote";
    default:
      return "planningNote";
  }
}

export function signalLevelFromCode(code: string): SignalLevel {
  const HARD_BLOCK_CODES = new Set([
    "player_in_multiple_matches",
    "duplicate_player_in_match",
    "invariant_invalid_non_core_selection",
    "squad_below_minimum",
    "selected_player_unavailable",
    "duplicate_planned_assignment_integrity_failure",
  ]);

  const REQUIRES_OVERRIDE_CODES = new Set([
    "support_requirement_shortfall",
    "squad_repair_shortfall_after_resolution",
    "repair_requires_override",
    "repair_below_minimum",
    "squad_repair_no_path_available",
    "round_player_conflict_removed",
    "available_player_without_planned_opportunity",
  ]);

  if (HARD_BLOCK_CODES.has(code)) return "blocked";
  if (REQUIRES_OVERRIDE_CODES.has(code)) return "decisionRequired";
  return "planningNote";
}
