"use client";

import { useState, useTransition } from "react";
import {
  Users,
  AlertTriangle,
  ArrowRightCircle,
  ArrowLeftCircle,
  Trash2,
  X,
  Plus,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import { RoleBadge, type SelectionRole } from "@/components/ui/role-badge";
import { clearMatchDraftAction } from "@/app/rounds/[matchRoundId]/actions";
import {
  removePlayerFromMatchAction,
  addPlayerToMatchAction,
  changePlayerRoleAction,
  replacePlayerInMatchAction,
} from "@/app/rounds/[matchRoundId]/draft-selection-actions";

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

type AvailablePlayer = {
  id: string;
  name: string;
  coreTeamName: string;
};

type MatchSquadCardProps = {
  matchId: string;
  matchRoundId: string;
  teamName: string;
  opponent: string;
  matchDate: Date;
  targetSquadSize: number;
  selectedCount: number;
  minSquadSize?: number;
  players: PlayerInMatch[];
  availablePlayers?: AvailablePlayer[];
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
  { key: "BACKFILL", label: "Squad repair" },
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
  matchId,
  matchRoundId,
  teamName,
  opponent,
  matchDate,
  targetSquadSize,
  selectedCount,
  minSquadSize,
  players,
  availablePlayers = [],
  supportStatus = "none",
  backfillCount = 0,
  warningCount = 0,
  isFinalized = false,
  onSelect,
  onPlayerClick,
  isSelected = false,
}: MatchSquadCardProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addRole, setAddRole] = useState<SelectionRole>("CORE");
  const [addPlayerSearch, setAddPlayerSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [roleChangePlayerId, setRoleChangePlayerId] = useState<string | null>(null);
  const [replacePlayerId, setReplacePlayerId] = useState<string | null>(null);
  const [replaceRole, setReplaceRole] = useState<SelectionRole>("CORE");
  const [replaceSearch, setReplaceSearch] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
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
      className={`relative rounded-xl border transition-colors cursor-pointer ${
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
          {!isFinalized && selectedCount > 0 && (
            <div className="flex items-center gap-1">
              <button
                className="rounded p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowFinalizeConfirm(true); }}
                aria-label="Finalize match"
                title="Finalize this match"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
              </button>
              <button
                className="rounded p-1 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-900/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowClearConfirm(true);
                }}
                aria-label="Clear match draft"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <SupportStatusIndicator status={supportStatus} />

      {(backfillCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-2 px-4 pt-1">
          {backfillCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              <ArrowLeftCircle className="h-3 w-3" aria-hidden="true" />
               {backfillCount} squad repair
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
                {group.players.map((p) => {
                  const isChangingRole = roleChangePlayerId === p.playerId;
                  const isReplacing = replacePlayerId === p.playerId;
                  return (
                    <span
                      key={`${teamName}-${group.key}-${p.playerId}`}
                      className="group/pl inline-flex items-center gap-0.5 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors"
                    >
                      <button
                        aria-label={`${p.playerName} - ${group.label} - ${p.coreTeamName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayerClick?.(p);
                        }}
                        type="button"
                      >
                        {p.playerName}
                      </button>
                      {p.manualOverride && (
                        <span className="ml-1 text-[8px] text-amber-400 uppercase">ovr</span>
                      )}
                      {!isFinalized && (
                        <span className="inline-flex items-center gap-0.5 ml-0.5 opacity-0 group-hover/pl:opacity-100 transition-opacity">
                          <button
                            className="text-zinc-500 hover:text-zinc-50 transition-colors"
                            aria-label={`Change role for ${p.playerName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoleChangePlayerId(isChangingRole ? null : p.playerId);
                              setReplacePlayerId(null);
                              setActionError(null);
                            }}
                            disabled={isPending}
                            title="Change role"
                            type="button"
                          >
                            <Repeat className="h-3 w-3" />
                          </button>
                          <button
                            className="text-[var(--accent-strong)] hover:text-zinc-50 transition-colors"
                            aria-label={`Replace ${p.playerName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplacePlayerId(isReplacing ? null : p.playerId);
                              setRoleChangePlayerId(null);
                              setReplaceRole(p.selectionCategory as SelectionRole);
                              setReplaceSearch("");
                              setActionError(null);
                            }}
                            disabled={isPending}
                            title="Replace player"
                            type="button"
                          >
                            <ArrowRightCircle className="h-3 w-3" />
                          </button>
                          <button
                            className="text-red-400 hover:text-red-300 transition-colors"
                            aria-label={`Remove ${p.playerName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionError(null);
                              startTransition(async () => {
                                const fd = new FormData();
                                fd.set("matchId", matchId);
                                fd.set("playerId", p.playerId);
                                fd.set("matchRoundId", matchRoundId);
                                try {
                                  await removePlayerFromMatchAction(fd);
                                } catch (err) {
                                  setActionError(err instanceof Error ? err.message : "Could not remove player.");
                                }
                              });
                            }}
                            disabled={isPending}
                            type="button"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {isChangingRole && (
                        <select
                          className="ml-1 h-5 rounded border app-hairline bg-[rgba(255,255,255,0.06)] px-1 text-[10px] text-zinc-50"
                          value={p.selectionCategory as string}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newRole = e.target.value as SelectionRole;
                            setActionError(null);
                            startTransition(async () => {
                              const fd = new FormData();
                              fd.set("matchId", matchId);
                              fd.set("playerId", p.playerId);
                              fd.set("role", newRole);
                              fd.set("matchRoundId", matchRoundId);
                              if (overrideReason.trim()) {
                                fd.set("overrideReason", overrideReason.trim());
                              }
                              try {
                                await changePlayerRoleAction(fd);
                                setRoleChangePlayerId(null);
                                setOverrideReason("");
                              } catch (err) {
                                setActionError(err instanceof Error ? err.message : "Could not change role.");
                              }
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        >
                          <option value="CORE">Core</option>
                          <option value="SUPPORT">Support</option>
                          <option value="BACKFILL">Squad repair</option>
                          <option value="DEVELOPMENT">Development</option>
                        </select>
                      )}
                    </span>
                  );
                })}
              </div>
              {replacePlayerId && (() => {
                const replacingPlayer = players.find((p) => p.playerId === replacePlayerId);
                if (!replacingPlayer) return null;
                return (
                  <div className="mt-1 flex flex-col gap-1.5 rounded-lg border app-hairline bg-[rgba(0,0,0,0.1)] p-2" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Replace <strong className="text-zinc-200">{replacingPlayer.playerName}</strong> with:
                    </p>
                    <div className="flex items-center gap-2">
                      <select
                        value={replaceRole}
                        onChange={(e) => setReplaceRole(e.target.value as SelectionRole)}
                        className="h-7 rounded border app-hairline bg-[rgba(255,255,255,0.03)] px-1.5 text-[10px] text-zinc-50"
                      >
                        <option value="CORE">Core</option>
                        <option value="SUPPORT">Support</option>
                        <option value="BACKFILL">Squad repair</option>
                        <option value="DEVELOPMENT">Development</option>
                      </select>
                      <input
                        value={replaceSearch}
                        onChange={(e) => setReplaceSearch(e.target.value)}
                        placeholder="Search player..."
                        className="h-7 flex-1 rounded border app-hairline bg-[rgba(255,255,255,0.03)] px-2 text-[10px] text-zinc-50"
                        type="text"
                        autoFocus
                      />
                      <button
                        className="text-[10px] text-zinc-400 hover:text-zinc-50"
                        onClick={() => { setReplacePlayerId(null); setReplaceSearch(""); }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                    {replaceSearch.length > 0 && (
                      <div className="max-h-28 overflow-y-auto rounded border app-hairline bg-[rgba(0,0,0,0.14)]">
                        {availablePlayers
                          .filter((ap) =>
                            ap.name.toLowerCase().includes(replaceSearch.toLowerCase()) ||
                            ap.coreTeamName.toLowerCase().includes(replaceSearch.toLowerCase())
                          )
                          .filter((ap) => !players.some((sp) => sp.playerId === ap.id) || ap.id === replacePlayerId)
                          .slice(0, 6)
                          .map((ap) => (
                            <button
                              key={ap.id}
                              className="w-full px-2 py-1 text-left text-[10px] text-zinc-100 hover:bg-[rgba(255,255,255,0.06)] flex items-center justify-between"
                              disabled={isPending}
                              onClick={() => {
                                setActionError(null);
                                startTransition(async () => {
                                  const fd = new FormData();
                                  fd.set("matchId", matchId);
                                  fd.set("outgoingPlayerId", replacePlayerId);
                                  fd.set("incomingPlayerId", ap.id);
                                  fd.set("role", replaceRole);
                                  fd.set("matchRoundId", matchRoundId);
                                  if (overrideReason.trim()) {
                                    fd.set("overrideReason", overrideReason.trim());
                                  }
                                  try {
                                    await replacePlayerInMatchAction(fd);
                                    setReplacePlayerId(null);
                                    setReplaceSearch("");
                                  } catch (err) {
                                    setActionError(err instanceof Error ? err.message : "Could not replace player.");
                                  }
                                });
                              }}
                              type="button"
                            >
                              <span>{ap.name}</span>
                              <span className="text-[var(--text-muted)]">{ap.coreTeamName}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {!isFinalized && (
        <div className="border-t border-[var(--border-soft)] px-4 py-2">
          {actionError && (
            <p className="mb-2 text-xs text-red-300">{actionError}</p>
          )}
          {(showAddPlayer || roleChangePlayerId || replacePlayerId) && (
            <div className="mb-2 flex items-center gap-2">
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Override reason (required for manual overrides)"
                className="h-7 flex-1 rounded border app-hairline bg-[rgba(255,255,255,0.03)] px-2 text-[10px] text-zinc-50"
                type="text"
              />
            </div>
          )}
          {!showAddPlayer ? (
            <button
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)] hover:underline"
              onClick={(e) => { e.stopPropagation(); setShowAddPlayer(true); setActionError(null); }}
              type="button"
            >
              <Plus className="h-3.5 w-3.5" /> Add player
            </button>
          ) : (
            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as SelectionRole)}
                  className="h-8 rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 text-xs text-zinc-50"
                >
                  <option value="CORE">Core</option>
                  <option value="SUPPORT">Support</option>
                  <option value="BACKFILL">Squad repair</option>
                  <option value="DEVELOPMENT">Development</option>
                </select>
                <input
                  value={addPlayerSearch}
                  onChange={(e) => setAddPlayerSearch(e.target.value)}
                  placeholder="Search player..."
                  className="h-8 flex-1 rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 text-xs text-zinc-50"
                  type="text"
                />
                <button
                  className="text-xs text-zinc-400 hover:text-zinc-50"
                  onClick={() => { setShowAddPlayer(false); setAddPlayerSearch(""); }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
              {addPlayerSearch.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg border app-hairline bg-[rgba(0,0,0,0.14)]">
                  {availablePlayers
                    .filter((p) =>
                      p.name.toLowerCase().includes(addPlayerSearch.toLowerCase()) ||
                      p.coreTeamName.toLowerCase().includes(addPlayerSearch.toLowerCase())
                    )
                    .filter((p) => !players.some((sp) => sp.playerId === p.id))
                    .slice(0, 8)
                    .map((p) => (
                      <button
                        key={p.id}
                        className="w-full px-3 py-1.5 text-left text-xs text-zinc-100 hover:bg-[rgba(255,255,255,0.06)] flex items-center justify-between"
                        disabled={isPending}
                        onClick={() => {
                          setActionError(null);
                          startTransition(async () => {
                            const fd = new FormData();
                            fd.set("matchId", matchId);
                            fd.set("playerId", p.id);
                            fd.set("role", addRole);
                            fd.set("matchRoundId", matchRoundId);
                            if (overrideReason.trim()) {
                              fd.set("overrideReason", overrideReason.trim());
                            }
                            try {
                              await addPlayerToMatchAction(fd);
                              setShowAddPlayer(false);
                              setAddPlayerSearch("");
                            } catch (err) {
                              setActionError(err instanceof Error ? err.message : "Could not add player.");
                            }
                          });
                        }}
                        type="button"
                      >
                        <span>{p.name}</span>
                        <span className="text-[var(--text-muted)]">{p.coreTeamName}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showClearConfirm && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowClearConfirm(false); }}
        >
          <div className="flex flex-col gap-2 p-4 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-zinc-100">Clear draft for this match?</p>
            <p className="text-xs text-zinc-400">Draft selections will be removed.</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <button
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] transition-colors"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/30 transition-colors disabled:opacity-50"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const formData = new FormData();
                    formData.set("matchId", matchId);
                    await clearMatchDraftAction(formData);
                    setShowClearConfirm(false);
                  });
                }}
              >
                {isPending ? "Clearing..." : "Clear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinalizeConfirm && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowFinalizeConfirm(false); }}
        >
          <div className="flex flex-col gap-2 p-4 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-zinc-100">Finalize this match?</p>
            <p className="text-xs text-zinc-400">
              {selectedCount} of {targetSquadSize} players selected. This will lock the squad.
            </p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <button
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] transition-colors"
                onClick={() => setShowFinalizeConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                disabled={isPending}
                onClick={() => {
                  setActionError(null);
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set("matchId", matchId);
                    const { finalizeMatchAction } = await import("@/app/matches/actions");
                    await finalizeMatchAction(fd);
                    setShowFinalizeConfirm(false);
                  });
                }}
              >
                {isPending ? "Finalizing..." : "Finalize"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}