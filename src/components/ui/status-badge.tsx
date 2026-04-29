import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck,
  CircleEllipsis,
  type LucideIcon,
} from "lucide-react";

export type RoundStatus = "DRAFT" | "WARNINGS" | "READY" | "FINALIZED";

type StatusConfig = {
  label: string;
  icon: LucideIcon;
  className: string;
};

const statusConfig: Record<RoundStatus, StatusConfig> = {
  DRAFT: {
    label: "Draft",
    icon: CircleEllipsis,
    className:
      "bg-amber-900/30 text-amber-300 border-amber-700/40",
  },
  WARNINGS: {
    label: "Warnings",
    icon: AlertTriangle,
    className:
      "bg-red-900/30 text-red-300 border-red-700/40",
  },
  READY: {
    label: "Ready",
    icon: CheckCircle2,
    className:
      "bg-emerald-900/30 text-emerald-300 border-emerald-700/40",
  },
  FINALIZED: {
    label: "Finalized",
    icon: FileCheck,
    className:
      "bg-emerald-900/30 text-emerald-300 border-emerald-700/40",
  },
};

export function StatusBadge({ status }: { status: RoundStatus }) {
  const config = statusConfig[status] ?? statusConfig.DRAFT;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider border ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

export function statusConfigFor(status: RoundStatus): StatusConfig {
  return statusConfig[status] ?? statusConfig.DRAFT;
}

export { Clock };