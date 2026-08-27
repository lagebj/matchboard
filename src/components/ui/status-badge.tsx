import {
  CheckCircle2,
  CircleDashed,
  FileCheck,
  FilePenLine,
  OctagonAlert,
  Lock,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";

export type RoundStatus =
  | "NOT_GENERATED"
  | "DRAFT"
  | "BLOCKED"
  | "READY"
  | "FINALIZED";

export type MatchPlanningStatus =
  | "planning_open"
  | "planning_closed"
  | "live"
  | "finalized"
  | "cancelled";

type StatusConfig = {
  label: string;
  icon: LucideIcon;
  variant: StatusPillVariant;
};

/**
 * Per ADR 0007 status badges use calm semantic tokens. Visible status text is
 * the canonical signal — colour is reinforcement only.
 */
const statusConfig: Record<RoundStatus, StatusConfig> = {
  NOT_GENERATED: {
    label: "No squad draft",
    icon: CircleDashed,
    variant: "neutral",
  },
  DRAFT: { label: "Draft", icon: FilePenLine, variant: "warning" },
  BLOCKED: { label: "Blocked", icon: OctagonAlert, variant: "danger" },
  READY: { label: "Ready", icon: CheckCircle2, variant: "success" },
  FINALIZED: { label: "Finalised", icon: FileCheck, variant: "finalized" },
};

export function StatusBadge({ status }: { status: RoundStatus }) {
  const config = statusConfig[status] ?? statusConfig.NOT_GENERATED;
  return (
    <StatusPill variant={config.variant} icon={config.icon} size="md">
      {config.label}
    </StatusPill>
  );
}

export function statusConfigFor(status: RoundStatus): StatusConfig {
  return statusConfig[status] ?? statusConfig.NOT_GENERATED;
}

type PlanningStatusConfig = {
  label: string;
  icon: LucideIcon;
  variant: StatusPillVariant;
};

const planningStatusConfig: Record<MatchPlanningStatus, PlanningStatusConfig> = {
  planning_open: { label: "Planning open", icon: FilePenLine, variant: "warning" },
  planning_closed: { label: "Planning closed", icon: Lock, variant: "neutral" },
  live: { label: "Live", icon: Radio, variant: "success" },
  finalized: { label: "Finalised", icon: FileCheck, variant: "finalized" },
  cancelled: { label: "Cancelled", icon: CircleDashed, variant: "neutral" },
};

export function planningStatusConfigFor(status: MatchPlanningStatus): PlanningStatusConfig {
  return planningStatusConfig[status] ?? planningStatusConfig.planning_open;
}

export function PlanningStatusBadge({ status }: { status: MatchPlanningStatus }) {
  const config = planningStatusConfig[status] ?? planningStatusConfig.planning_open;
  return (
    <StatusPill variant={config.variant} icon={config.icon} size="md">
      {config.label}
    </StatusPill>
  );
}
