import { AlertTriangle, XCircle, Info, type LucideIcon } from "lucide-react";
import { SeverityBadge, severityFromCode } from "@/components/ui/severity-badge";

type WarningEntry = {
  code: string;
  message: string;
  playerId?: string;
  playerName?: string;
  teamName?: string;
};

type WarningPanelProps = {
  warnings: WarningEntry[];
  summary?: {
    blocking: number;
    high: number;
    medium: number;
    info: number;
  };
};

type WarningCardProps = {
  code: string;
  message: string;
  severity: "blocking" | "high" | "medium" | "info";
  playerName?: string;
  teamName?: string;
};

function SeverityIcon({ severity }: { severity: string }) {
  const map: Record<string, { icon: LucideIcon; className: string }> = {
    blocking: { icon: XCircle, className: "text-red-400" },
    high: { icon: AlertTriangle, className: "text-amber-400" },
    medium: { icon: AlertTriangle, className: "text-yellow-400" },
    info: { icon: Info, className: "text-sky-400" },
  };
  const config = map[severity] ?? map.info;
  const Icon = config.icon;
  return <Icon className={`h-4 w-4 ${config.className}`} aria-hidden="true" />;
}

export function WarningCard({
  code,
  message,
  severity,
  playerName,
  teamName,
}: WarningCardProps) {
  return (
    <div className="flex gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5">
      <div className="mt-0.5 shrink-0">
        <SeverityIcon severity={severity} />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={severity} />
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{code}</span>
        </div>
        <p className="text-sm text-zinc-200 leading-snug">{message}</p>
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

export function WarningPanel({ warnings, summary }: WarningPanelProps) {
  if (warnings.length === 0) {
    return null;
  }

  const resolvedSummary = summary ?? {
    blocking: warnings.filter((w) => severityFromCode(w.code) === "blocking").length,
    high: warnings.filter((w) => severityFromCode(w.code) === "high").length,
    medium: warnings.filter((w) => severityFromCode(w.code) === "medium").length,
    info: warnings.filter((w) => severityFromCode(w.code) === "info").length,
  };

  const hasBlocking = resolvedSummary.blocking > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Warnings</h3>
        <div className="flex items-center gap-2">
          {hasBlocking && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-red-400">
              <XCircle className="h-3 w-3" aria-hidden="true" />
              {resolvedSummary.blocking} blocking
            </span>
          )}
          {resolvedSummary.high > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {resolvedSummary.high} high
            </span>
          )}
        </div>
      </div>

      {hasBlocking && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2">
          <p className="text-xs text-red-300">
            Blocking warnings prevent finalization. Resolve or override before finalizing this selection.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {warnings.map((w, i) => (
          <WarningCard
            key={`${w.code}-${i}`}
            code={w.code}
            message={w.message}
            severity={severityFromCode(w.code)}
            playerName={w.playerName}
            teamName={w.teamName}
          />
        ))}
      </div>
    </div>
  );
}