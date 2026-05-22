import {
  OctagonAlert,
  AlertTriangle,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { type WarningSeverity } from "@/generated/prisma/client";

export type SignalLevel = "blocked" | "decisionRequired" | "planningNote";

type SignalConfig = {
  label: string;
  icon: LucideIcon;
  className: string;
};

const signalConfig: Record<SignalLevel, SignalConfig> = {
  blocked: {
    label: "Blocked",
    icon: OctagonAlert,
    className:
      "bg-red-900/30 text-red-300 border-red-700/40",
  },
  decisionRequired: {
    label: "Decision required",
    icon: AlertTriangle,
    className:
      "bg-amber-900/30 text-amber-300 border-amber-700/40",
  },
  planningNote: {
    label: "Planning note",
    icon: FileText,
    className:
      "bg-zinc-800/30 text-zinc-400 border-zinc-700/40",
  },
};

export function SignalBadge({ level }: { level: SignalLevel }) {
  const config = signalConfig[level] ?? signalConfig.planningNote;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${config.className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
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

// Deprecated: kept for backward compatibility during migration
export type Severity = "blocking" | "high" | "medium" | "info";

export function severityFromDbSeverity(dbSeverity: WarningSeverity): Severity {
  const level = signalLevelFromDbSeverity(dbSeverity);
  switch (level) {
    case "blocked": return "blocking";
    case "decisionRequired": return "high";
    case "planningNote": return "medium";
  }
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const level: SignalLevel = severity === "blocking" ? "blocked" : severity === "high" ? "decisionRequired" : "planningNote";
  return <SignalBadge level={level} />;
}

export function severityConfigFor(severity: Severity): SignalConfig {
  const level: SignalLevel = severity === "blocking" ? "blocked" : severity === "high" ? "decisionRequired" : "planningNote";
  return signalConfigFor(level);
}

export function severityFromCode(code: string): Severity {
  const level = signalLevelFromCode(code);
  switch (level) {
    case "blocked": return "blocking";
    case "decisionRequired": return "high";
    case "planningNote": return "medium";
  }
}