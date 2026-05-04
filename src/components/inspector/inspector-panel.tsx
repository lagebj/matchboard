"use client";

import { X, AlertTriangle, OctagonAlert, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { RoleBadge, type SelectionRole } from "@/components/ui/role-badge";

type ExplanationItem = {
  code: string;
  summary: string;
  details?: string;
  hardRule?: boolean;
};

export type PlayerDetail = {
  type: "player";
  playerId: string;
  playerName: string;
  coreTeamName: string;
  playerPosition: string;
  selectionCategory: SelectionRole | "REDUCED_MATCH_LOAD_DROP" | "CORE_MATCH_DROP" | "UNAVAILABLE";
  selectionReason: string;
  explanations: ExplanationItem[];
  priorityScore: number | null;
  manualOverride: boolean;
  matchContext?: {
    teamName: string;
    opponent: string;
    matchDate: Date;
  };
};

export type WarningDetail = {
  type: "warning";
  severity: "blocking" | "high" | "medium" | "info";
  message: string;
  code: string;
  playerName?: string;
  teamName?: string;
  rule?: string;
  why?: string;
  whatHappensIfIgnored?: string;
  allowedActions?: string[];
};

export type MatchDetail = {
  type: "match";
  teamName: string;
  opponent: string;
  matchDate: Date;
  selectedCount: number;
  targetSquadSize: number;
  minSquadSize: number;
  supportStatus: "fulfilled" | "partial" | "missing" | "none";
  backfillCount: number;
  warningCount: number;
  isFinalized: boolean;
  coreCount: number;
  supportCount: number;
  backfillCount_: number;
  developmentCount: number;
};

export type MovementDetail = {
  type: "movement";
  sourceTeamName: string;
  playerName: string;
  role: "SUPPORT" | "BACKFILL" | "DEVELOPMENT";
  targetTeamName: string;
  consequence?: string;
  backfillResult?: string;
  warningState?: "unresolved" | "resolved";
};

export type InspectorItem = PlayerDetail | WarningDetail | MatchDetail | MovementDetail;

type InspectorPanelProps = {
  item: InspectorItem | null;
  onClose: () => void;
};

function PlayerInspector({ detail }: { detail: PlayerDetail }) {
  return (
    <div className="flex flex-col gap-4">
      {detail.matchContext && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-xs font-medium text-zinc-300">{detail.matchContext.teamName} vs {detail.matchContext.opponent}</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {detail.matchContext.matchDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </p>
        </div>
      )}

      <div>
        <p className="text-base font-semibold text-zinc-50">{detail.playerName}</p>
        <p className="text-xs text-[var(--text-muted)]">{detail.playerPosition} · {detail.coreTeamName}</p>
      </div>

      <div className="flex items-center gap-2">
        <RoleBadge role={detail.selectionCategory} />
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
        <p className="text-xs font-medium text-zinc-300 mb-1">Selected because</p>
        <p className="text-sm text-zinc-100 leading-snug">{detail.selectionReason}</p>
      </div>

      {detail.manualOverride && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2">
          <p className="text-xs font-semibold text-amber-300">Manual override reason</p>
        </div>
      )}

      {detail.priorityScore !== null && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">Priority score</span>
          <span className="text-sm font-mono tabular-nums text-zinc-200">{detail.priorityScore.toFixed(1)}</span>
        </div>
      )}

      {detail.explanations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-zinc-300">Explanations</p>
          {detail.explanations.map((exp, i) => (
            <div
              key={`${exp.code}-${i}`}
              className={`rounded-lg border px-3 py-2 ${
                exp.hardRule
                  ? "border-red-700/40 bg-red-900/10"
                  : "border-[var(--border-soft)] bg-[var(--surface-muted)]"
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{exp.code}</span>
                {exp.hardRule && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Hard rule</span>
                )}
              </div>
              <p className="text-sm text-zinc-200 leading-snug">{exp.summary}</p>
              {exp.details && (
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-snug">{exp.details}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WarningInspector({ detail }: { detail: WarningDetail }) {
  const severityConfig = {
    blocking: { icon: OctagonAlert, label: "Blocking", iconClass: "text-red-400", borderClass: "border-red-800/50", bgClass: "bg-red-950/20" },
    high: { icon: AlertTriangle, label: "High", iconClass: "text-amber-400", borderClass: "border-amber-800/40", bgClass: "bg-amber-950/15" },
    medium: { icon: AlertTriangle, label: "Medium", iconClass: "text-yellow-400", borderClass: "border-yellow-800/30", bgClass: "bg-yellow-950/10" },
    info: { icon: AlertTriangle, label: "Info", iconClass: "text-sky-400", borderClass: "border-sky-800/30", bgClass: "bg-sky-950/10" },
  };
  const config = severityConfig[detail.severity] ?? severityConfig.info;
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex items-center gap-2 rounded-lg border ${config.borderClass} ${config.bgClass} px-3 py-2`}>
        <Icon className={`h-4 w-4 ${config.iconClass}`} aria-hidden="true" />
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${config.iconClass}`}>{config.label}</span>
        <span className="text-sm text-zinc-100">{detail.message}</span>
      </div>

      {detail.rule && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-xs font-medium text-zinc-300 mb-1">Rule</p>
          <p className="text-sm text-zinc-200 font-mono">{detail.rule}</p>
        </div>
      )}

      {(detail.playerName || detail.teamName) && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-xs font-medium text-zinc-300 mb-1">Affected</p>
          {detail.playerName && <p className="text-sm text-zinc-100">{detail.playerName}</p>}
          {detail.teamName && <p className="text-xs text-[var(--text-muted)]">{detail.teamName}</p>}
        </div>
      )}

      {detail.why && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-xs font-medium text-zinc-300 mb-1">Why this happened</p>
          <p className="text-sm text-zinc-200 leading-snug">{detail.why}</p>
        </div>
      )}

      {detail.whatHappensIfIgnored && (
        <div className="rounded-lg border border-amber-700/30 bg-amber-900/10 px-3 py-2">
          <p className="text-xs font-medium text-amber-300 mb-1">If ignored</p>
          <p className="text-sm text-zinc-200 leading-snug">{detail.whatHappensIfIgnored}</p>
        </div>
      )}

      {detail.allowedActions && detail.allowedActions.length > 0 && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-xs font-medium text-zinc-300 mb-1">Allowed actions</p>
          <ul className="flex flex-col gap-1">
            {detail.allowedActions.map((action, i) => (
              <li key={i} className="text-sm text-zinc-200">{action}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MatchInspector({ detail }: { detail: MatchDetail }) {
  const supportConfig = {
    fulfilled: { label: "Support fulfilled", icon: ShieldCheck, className: "text-emerald-400" },
    partial: { label: "Support partial", icon: AlertTriangle, className: "text-amber-400" },
    missing: { label: "Support missing", icon: OctagonAlert, className: "text-red-400" },
    none: { label: "No support needed", icon: ShieldCheck, className: "text-zinc-400" },
  };
  const support = supportConfig[detail.supportStatus] ?? supportConfig.none;
  const SupportIcon = support.icon;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-base font-semibold text-zinc-50">{detail.teamName} vs {detail.opponent}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {detail.matchDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-muted)]">Squad</span>
          <span className="text-sm font-medium tabular-nums text-zinc-100">{detail.selectedCount} / {detail.targetSquadSize}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-muted)]">Minimum</span>
          <span className="text-sm tabular-nums text-zinc-300">{detail.minSquadSize}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-muted)]">Core</span>
          <span className="text-sm tabular-nums text-zinc-300">{detail.coreCount}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-muted)]">Support</span>
          <span className="text-sm tabular-nums text-zinc-300">{detail.supportCount}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-muted)]">Squad repair</span>
          <span className="text-sm tabular-nums text-zinc-300">{detail.backfillCount_}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">Development</span>
          <span className="text-sm tabular-nums text-zinc-300">{detail.developmentCount}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SupportIcon className={`h-4 w-4 ${support.className}`} aria-hidden="true" />
        <span className={`text-sm font-medium ${support.className}`}>{support.label}</span>
      </div>

      {detail.warningCount > 0 && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span className="text-sm text-amber-300">{detail.warningCount} {detail.warningCount === 1 ? "warning" : "warnings"}</span>
        </div>
      )}

      {detail.isFinalized && (
        <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-3 py-2">
          <span className="text-xs font-semibold text-emerald-400">Finalized</span>
          <span className="text-sm text-emerald-200"> — selections are locked</span>
        </div>
      )}
    </div>
  );
}

function MovementInspector({ detail }: { detail: MovementDetail }) {
  const roleConfig = {
    SUPPORT: { label: "Support", className: "text-emerald-400" },
    BACKFILL: { label: "Squad repair", className: "text-sky-400" },
    DEVELOPMENT: { label: "Development", className: "text-amber-400" },
  };
  const config = roleConfig[detail.role] ?? roleConfig.SUPPORT;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-base font-semibold text-zinc-50">Movement</p>
        <p className="text-xs text-[var(--text-muted)]">Cross-team player movement</p>
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-zinc-200">{detail.sourceTeamName}</span>
          <ArrowRightLeft className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="text-sm font-medium text-zinc-200">{detail.targetTeamName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-100">{detail.playerName}</span>
          <span className={`text-xs font-medium ${config.className}`}>{config.label}</span>
        </div>
      </div>

      {detail.consequence && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-xs font-medium text-zinc-300 mb-1">Fairness impact</p>
          <p className="text-sm text-zinc-200 leading-snug">{detail.consequence}</p>
        </div>
      )}

      {detail.backfillResult && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
           <p className="text-xs font-medium text-zinc-300 mb-1">Squad repair</p>
          <p className="text-sm text-zinc-200 leading-snug">{detail.backfillResult}</p>
        </div>
      )}

      {detail.warningState === "unresolved" && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span className="text-sm text-amber-300">Unresolved</span>
        </div>
      )}

      {detail.warningState === "resolved" && (
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <span className="text-sm text-emerald-300">Resolved</span>
        </div>
      )}
    </div>
  );
}

export function InspectorPanel({ item, onClose }: InspectorPanelProps) {
  const isOpen = item !== null;

  return (
    <aside className={`fixed right-0 top-0 z-40 h-screen w-[var(--inspector-width)] flex-col border-l border-[var(--border-soft)] bg-[var(--surface-base)] transition-transform duration-200 ${isOpen ? "translate-x-0 flex" : "translate-x-full hidden"}`}>
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-100">
          {!item ? "Inspector" : item.type === "player" ? "Player" : item.type === "warning" ? "Issue" : item.type === "match" ? "Match" : "Movement"}
        </h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-[var(--text-muted)] hover:text-zinc-100 hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!item ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-[var(--text-muted)]">Click a player, warning, match, or movement to inspect</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {item.type === "player" && <PlayerInspector detail={item} />}
          {item.type === "warning" && <WarningInspector detail={item} />}
          {item.type === "match" && <MatchInspector detail={item} />}
          {item.type === "movement" && <MovementInspector detail={item} />}
        </div>
      )}
    </aside>
  );
}