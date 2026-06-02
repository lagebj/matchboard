import {
  CheckCircle2,
  CircleDashed,
  FileCheck,
  FilePenLine,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";

export type RoundStatus =
  | "NOT_GENERATED"
  | "DRAFT"
  | "BLOCKED"
  | "READY"
  | "FINALIZED";

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
    label: "Not generated",
    icon: CircleDashed,
    variant: "neutral",
  },
  DRAFT: { label: "Draft", icon: FilePenLine, variant: "warning" },
  BLOCKED: { label: "Blocked", icon: OctagonAlert, variant: "danger" },
  READY: { label: "Ready", icon: CheckCircle2, variant: "success" },
  FINALIZED: { label: "Finalized", icon: FileCheck, variant: "finalized" },
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
