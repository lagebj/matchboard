import { OctagonAlert, AlertTriangle, AlertCircle, Info, type LucideIcon } from "lucide-react";

type WarningSeverity = "blocking" | "high" | "medium" | "info";

type WarningCardProps = {
  severity: WarningSeverity;
  title: string;
  message: string;
  playerName?: string;
  teamName?: string;
  rule?: string;
};

const severityConfig: Record<WarningSeverity, { icon: LucideIcon; label: string; iconClass: string; borderClass: string; bgClass: string }> = {
  blocking: {
    icon: OctagonAlert,
    label: "Blocking",
    iconClass: "text-red-400",
    borderClass: "border-red-800/50",
    bgClass: "bg-red-950/20",
  },
  high: {
    icon: AlertTriangle,
    label: "High",
    iconClass: "text-amber-400",
    borderClass: "border-amber-800/40",
    bgClass: "bg-amber-950/15",
  },
  medium: {
    icon: AlertCircle,
    label: "Medium",
    iconClass: "text-yellow-400",
    borderClass: "border-yellow-800/30",
    bgClass: "bg-yellow-950/10",
  },
  info: {
    icon: Info,
    label: "Info",
    iconClass: "text-sky-400",
    borderClass: "border-sky-800/30",
    bgClass: "bg-sky-950/10",
  },
};

export function WarningCard({
  severity,
  title,
  message,
  playerName,
  teamName,
  rule,
}: WarningCardProps) {
  const config = severityConfig[severity] ?? severityConfig.info;
  const Icon = config.icon;

  return (
    <div className={`flex gap-3 rounded-lg border ${config.borderClass} ${config.bgClass} px-3 py-2.5`} role="alert">
      <div className="mt-0.5 shrink-0">
        <Icon className={`h-4 w-4 ${config.iconClass}`} aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.iconClass}`}>
            {config.label}
          </span>
          <span className="text-sm font-medium text-zinc-100">{title}</span>
          {rule && (
            <span className="text-[10px] font-mono text-[var(--text-muted)]">{rule}</span>
          )}
        </div>
        <p className="text-sm text-zinc-300 leading-snug">{message}</p>
        {(playerName || teamName) && (
          <p className="text-xs text-[var(--text-muted)]">
            {playerName && <span>{playerName}</span>}
            {playerName && teamName && <span> · </span>}
            {teamName && <span>{teamName}</span>}
          </p>
        )}
      </div>
    </div>
  );
}