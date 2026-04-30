import {
  CheckCircle2,
  CircleDashed,
  FileCheck,
  FilePenLine,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";

export type RoundStatus =
  | "NOT_GENERATED"
  | "DRAFT"
  | "BLOCKED"
  | "READY"
  | "FINALIZED";

type StatusConfig = {
  label: string;
  icon: LucideIcon;
  className: string;
};

const statusConfig: Record<RoundStatus, StatusConfig> = {
  NOT_GENERATED: {
    label: "Not generated",
    icon: CircleDashed,
    className:
      "bg-zinc-800/50 text-zinc-400 border-zinc-600/40",
  },
  DRAFT: {
    label: "Draft",
    icon: FilePenLine,
    className:
      "bg-amber-900/30 text-amber-300 border-amber-700/40",
  },
  BLOCKED: {
    label: "Blocked",
    icon: OctagonAlert,
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
  const config = statusConfig[status] ?? statusConfig.NOT_GENERATED;
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
  return statusConfig[status] ?? statusConfig.NOT_GENERATED;
}