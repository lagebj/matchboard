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

const signalConfig: Record<SignalLevel, { icon: LucideIcon; label: string; iconClass: string; borderClass: string; bgClass: string }> = {
  blocked: {
    icon: OctagonAlert,
    label: "Blocked",
    iconClass: "text-red-400",
    borderClass: "border-red-800/50",
    bgClass: "bg-red-950/20",
  },
  decisionRequired: {
    icon: AlertTriangle,
    label: "Decision required",
    iconClass: "text-amber-400",
    borderClass: "border-amber-800/40",
    bgClass: "bg-amber-950/15",
  },
  planningNote: {
    icon: FileText,
    label: "Planning note",
    iconClass: "text-zinc-400",
    borderClass: "border-zinc-700/40",
    bgClass: "bg-zinc-900/20",
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

// Deprecated: kept for backward compatibility during migration
type WarningSeverity = "blocking" | "high" | "medium" | "info";

type WarningCardProps = {
  severity: WarningSeverity;
  title: string;
  message: string;
  playerName?: string;
  teamName?: string;
  rule?: string;
};

function toSignalLevel(severity: WarningSeverity): SignalLevel {
  switch (severity) {
    case "blocking": return "blocked";
    case "high": return "decisionRequired";
    case "medium": return "planningNote";
    case "info": return "planningNote";
  }
}

export function WarningCard(props: WarningCardProps) {
  return <SignalCard level={toSignalLevel(props.severity)} title={props.title} message={props.message} playerName={props.playerName} teamName={props.teamName} rule={props.rule} />;
}