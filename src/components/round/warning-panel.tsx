import { AlertTriangle, XCircle } from "lucide-react";
import { severityFromCode, severityFromDbSeverity } from "@/components/ui/severity-badge";
import { WarningCard as UIWarningCard } from "@/components/ui/warning-card";
import type { WarningSeverity } from "@/generated/prisma/client";

type WarningEntry = {
  code: string;
  message: string;
  severity?: WarningSeverity;
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
  onWarningClick?: (warning: WarningEntry) => void;
};

export { type WarningEntry };

export function WarningPanel({ warnings, summary, onWarningClick }: WarningPanelProps) {
  if (warnings.length === 0) {
    return null;
  }

  const getSeverity = (w: WarningEntry) =>
    w.severity ? severityFromDbSeverity(w.severity) : severityFromCode(w.code);

  const resolvedSummary = summary ?? {
    blocking: warnings.filter((w) => getSeverity(w) === "blocking").length,
    high: warnings.filter((w) => getSeverity(w) === "high").length,
    medium: warnings.filter((w) => getSeverity(w) === "medium").length,
    info: warnings.filter((w) => getSeverity(w) === "info").length,
  };

  const hasBlocking = resolvedSummary.blocking > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Round checks</h3>
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
            Blocking issues prevent finalization. Resolve or override before finalizing.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {warnings.map((w, i) => (
          <div
            key={`${w.code}-${i}`}
            className={onWarningClick ? "cursor-pointer" : ""}
            onClick={onWarningClick ? () => onWarningClick(w) : undefined}
            role={onWarningClick ? "button" : undefined}
            tabIndex={onWarningClick ? 0 : undefined}
          >
            <UIWarningCard
              severity={getSeverity(w)}
              title={w.code}
              message={w.message}
              playerName={w.playerName}
              teamName={w.teamName}
              rule={w.code}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
