import {
  Users,
  AlertTriangle,
  ArrowRightCircle,
  ArrowLeftCircle,
} from "lucide-react";
import { RoleBadge, type SelectionRole } from "@/components/ui/role-badge";

export type PlayerInMatch = {
  playerId: string;
  playerName: string;
  coreTeamName: string;
  selectionCategory: SelectionRole | "REDUCED_MATCH_LOAD_DROP" | "CORE_MATCH_DROP" | "UNAVAILABLE";
  selectionReason: string;
  explanations: Array<{ code: string; summary: string; details?: string; hardRule?: boolean }>;
  priorityScore: number | null;
  manualOverride: boolean;
  playerPosition: string;
};

type MatchSquadCardProps = {
  teamName: string;
  opponent: string;
  matchDate: Date;
  targetSquadSize: number;
  selectedCount: number;
  minSquadSize?: number;
  players: PlayerInMatch[];
  supportStatus?: "fulfilled" | "partial" | "missing" | "none";
  backfillCount?: number;
  warningCount?: number;
  isFinalized?: boolean;
  onSelect?: () => void;
  onPlayerClick?: (player: PlayerInMatch) => void;
  isSelected?: boolean;
};

const roleGroups: Array<{
  key: SelectionRole | "REDUCED_MATCH_LOAD_DROP" | "CORE_MATCH_DROP" | "UNAVAILABLE";
  label: string;
}> = [
  { key: "CORE", label: "Core" },
  { key: "SUPPORT", label: "Support" },
  { key: "BACKFILL", label: "Backfill" },
  { key: "DEVELOPMENT", label: "Development" },
  { key: "REDUCED_MATCH_LOAD_DROP", label: "Reduced load" },
  { key: "CORE_MATCH_DROP", label: "Dropped" },
  { key: "UNAVAILABLE", label: "Unavailable" },
];

function SupportStatusIndicator({ status }: { status: MatchSquadCardProps["supportStatus"] }) {
  if (!status || status === "none") return null;
  const config = {
    fulfilled: { label: "Support fulfilled", className: "text-emerald-400" },
    partial: { label: "Support partial", className: "text-amber-400" },
    missing: { label: "Support missing", className: "text-red-400" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${config.className}`}>
      {status === "fulfilled" ? <ArrowRightCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {config.label}
    </span>
  );
}

export function MatchSquadCard({
  teamName,
  opponent,
  matchDate,
  targetSquadSize,
  selectedCount,
  minSquadSize,
  players,
  supportStatus = "none",
  backfillCount = 0,
  warningCount = 0,
  isFinalized = false,
  onSelect,
  onPlayerClick,
  isSelected = false,
}: MatchSquadCardProps) {
  const grouped = roleGroups.map((group) => ({
    ...group,
    players: players.filter((p) => p.selectionCategory === group.key),
  }));

  const squadFilling = selectedCount >= targetSquadSize
    ? "full"
    : selectedCount >= (minSquadSize ?? targetSquadSize)
      ? "adequate"
      : "below-minimum";

  const squadFillingConfig = {
    full: { label: "Full", className: "text-emerald-400 bg-emerald-900/30 border-emerald-700/40" },
    adequate: { label: "Adequate", className: "text-amber-300 bg-amber-900/30 border-amber-700/40" },
    "below-minimum": { label: "Below minimum", className: "text-red-400 bg-red-900/30 border-red-700/40" },
  }[squadFilling];

  const dateStr = matchDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div
      className={`rounded-xl border transition-colors cursor-pointer ${
        isSelected
          ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
          : "border-[var(--border-soft)] bg-[var(--surface-base)] hover:border-[var(--border-strong)]"
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`${teamName} vs ${opponent} - ${selectedCount} of ${targetSquadSize} players`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-zinc-50">{teamName}</p>
          <p className="text-xs text-[var(--text-muted)]">vs {opponent} · {dateStr}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${squadFillingConfig.className}`}>
            <Users className="h-3 w-3" aria-hidden="true" />
            {selectedCount}/{targetSquadSize}
          </span>
          {isFinalized && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Finalized</span>
          )}
        </div>
      </div>

      <SupportStatusIndicator status={supportStatus} />

      {(backfillCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-2 px-4 pt-1">
          {backfillCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              <ArrowLeftCircle className="h-3 w-3" aria-hidden="true" />
              {backfillCount} backfill
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-red-300">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {warningCount} {warningCount === 1 ? "warning" : "warnings"}
            </span>
          )}
        </div>
      )}

      <div className="px-4 py-2.5">
        {grouped.map((group) => {
          if (group.players.length === 0) return null;
          return (
            <div key={group.key} className="mb-2 last:mb-0">
              <div className="flex items-center gap-1.5 mb-1">
                <RoleBadge role={group.key === "REDUCED_MATCH_LOAD_DROP" ? "REDUCED_MATCH_LOAD_DROP" : group.key === "CORE_MATCH_DROP" ? "DROPPED" : group.key === "UNAVAILABLE" ? "UNAVAILABLE" : group.key} />
                <span className="text-[10px] text-[var(--text-muted)]">{group.players.length}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {group.players.map((p) => (
                  <button
                    key={`${teamName}-${group.key}-${p.playerId}`}
                    className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
                    aria-label={`${p.playerName} - ${group.label} - ${p.coreTeamName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayerClick?.(p);
                    }}
                  >
                    {p.playerName}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}