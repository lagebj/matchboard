import { ArrowRight, AlertTriangle, CheckCircle2, ShieldCheck, TrendingUp, ArrowLeftRight } from "lucide-react";

export type MovementChainEntry = {
  sourceTeamName: string;
  playerName: string;
  role: "SUPPORT" | "BACKFILL" | "DEVELOPMENT";
  targetTeamName: string;
  consequence?: string;
  backfillResult?: string;
  warningState?: "unresolved" | "resolved";
};

type MovementChainProps = {
  movements: MovementChainEntry[];
};

const roleConfig: Record<string, { icon: typeof ArrowRight; label: string; className: string }> = {
  SUPPORT: { icon: ShieldCheck, label: "Support", className: "text-emerald-400" },
  BACKFILL: { icon: ArrowLeftRight, label: "Backfill", className: "text-sky-400" },
  DEVELOPMENT: { icon: TrendingUp, label: "Development", className: "text-amber-400" },
};

export function MovementChain({ movements }: MovementChainProps) {
  if (movements.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-3 text-sm text-[var(--text-muted)]">
        No cross-team movement this round.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {movements.map((m, i) => {
        const config = roleConfig[m.role] ?? roleConfig.SUPPORT;
        const RoleIcon = config.icon;
        return (
          <div key={`${m.playerName}-${m.sourceTeamName}-${i}`} className="flex flex-col gap-0.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-zinc-200">{m.sourceTeamName}</span>
              <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" aria-hidden="true" />
              <span className="text-zinc-100">{m.playerName}</span>
              <RoleIcon className={`h-3.5 w-3.5 ${config.className}`} aria-hidden="true" />
              <span className={`text-xs font-medium ${config.className}`}>{config.label}</span>
              <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" aria-hidden="true" />
              <span className="font-medium text-zinc-200">{m.targetTeamName}</span>
            </div>
            {(m.consequence || m.backfillResult || m.warningState) && (
              <div className="flex items-center gap-2 mt-0.5">
                {m.consequence && (
                  <span className="text-xs text-[var(--text-muted)]">{m.consequence}</span>
                )}
                {m.backfillResult && (
                  <span className="text-xs text-[var(--text-muted)]">
                    Backfill: {m.backfillResult}
                  </span>
                )}
                {m.warningState === "unresolved" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    Unresolved
                  </span>
                )}
                {m.warningState === "resolved" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Resolved
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}