import { OctagonAlert, AlertTriangle, FileText, type LucideIcon } from "lucide-react";

export type SignalLevel = "blocked" | "decisionRequired" | "planningNote";

type SignalCardProps = {
  level: SignalLevel;
  title: string;
  message: string;
  playerName?: string;
  teamName?: string;
  rule?: string;
};

/**
 * Per ADR 0007: signal cards use the calm semantic palette via tokens
 * (--danger / --warning / --text-muted) rather than raw red/amber/zinc.
 * They retain the existing SignalCard prop shape for backwards compatibility.
 */
const signalConfig: Record<
  SignalLevel,
  {
    icon: LucideIcon;
    label: string;
    iconClass: string;
    surfaceClass: string;
    titleClass: string;
  }
> = {
  blocked: {
    icon: OctagonAlert,
    label: "Blocked",
    iconClass: "text-[var(--danger)]",
    surfaceClass: "bg-[var(--danger-subtle)] border-[var(--danger)]/35",
    titleClass: "text-[var(--danger)]",
  },
  decisionRequired: {
    icon: AlertTriangle,
    label: "Decision required",
    iconClass: "text-[var(--warning)]",
    surfaceClass: "bg-[var(--warning-subtle)] border-[var(--warning)]/35",
    titleClass: "text-[var(--warning)]",
  },
  planningNote: {
    icon: FileText,
    label: "Planning note",
    iconClass: "text-[var(--text-muted)]",
    surfaceClass: "bg-[var(--surface-muted)]/40 border-[var(--border-soft)]",
    titleClass: "text-[var(--text-soft)]",
  },
};

export function SignalCard({
  level,
  title,
  message,
  playerName,
  teamName,
  rule,
}: SignalCardProps) {
  const config = signalConfig[level] ?? signalConfig.planningNote;
  const Icon = config.icon;

  return (
    <div
      className={`flex gap-3 rounded-xl border px-3.5 py-2.5 ${config.surfaceClass}`}
      role={level === "planningNote" ? "status" : "alert"}
    >
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.iconClass}`} aria-hidden="true" />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${config.titleClass}`}
          >
            {config.label}
          </span>
          <span className="text-sm font-medium text-zinc-100">{title}</span>
          {rule && (
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {rule}
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-soft)] leading-snug">{message}</p>
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
