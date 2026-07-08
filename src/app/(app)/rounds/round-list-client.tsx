"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, RotateCcw } from "lucide-react";
import { clearAllDraftsAction, populateAllAction, generateRoundAction, regroupRoundsAction, regenerateAllDraftsAction, finalizeRoundFromListAction, unfinalizeRoundFromListAction } from "./actions";
import { ConfirmFinalizeDialog } from "@/components/round/confirm-finalize-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { MetricTile } from "@/components/ui/metric-tile";
import { CalendarRange } from "lucide-react";

type RoundListItem = {
  id: string;
  name: string;
  weekLabel: string;
  matchCount: number;
  teamNames: string[];
  derivedStatus: "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED";
};

type FilterState = "all" | "needs_action" | "draft" | "ready" | "finalized";

type RoundListClientProps = {
  rounds: RoundListItem[];
  activeLeagueSeasonId: string | null;
  hasDraftRounds: boolean;
  hasNotGeneratedRounds: boolean;
  roundCount: number;
};

const filterConfig: Array<{ key: FilterState; label: string }> = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs action" },
  { key: "draft", label: "Draft" },
  { key: "ready", label: "Ready" },
  { key: "finalized", label: "Finalized" },
];

function filterRounds(rounds: RoundListItem[], filter: FilterState): RoundListItem[] {
  switch (filter) {
    case "needs_action":
      return rounds.filter((r) => r.derivedStatus === "NOT_GENERATED" || r.derivedStatus === "BLOCKED");
    case "draft":
      return rounds.filter((r) => r.derivedStatus === "DRAFT");
    case "ready":
      return rounds.filter((r) => r.derivedStatus === "READY");
    case "finalized":
      return rounds.filter((r) => r.derivedStatus === "FINALIZED");
    default:
      return rounds;
  }
}

export function RoundListClient({ rounds, activeLeagueSeasonId, hasDraftRounds, hasNotGeneratedRounds, roundCount }: RoundListClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterState>("all");
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [finalizingRoundId, setFinalizingRoundId] = useState<string | null>(null);
  const [regroupResult, setRegroupResult] = useState<string | null>(null);
  const [regenerateResult, setRegenerateResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const filtered = filterRounds(rounds, filter);

  return (
    <>
      <div className="flex items-center gap-2 mt-4">
        {filterConfig.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border border-[var(--accent)]/30"
                : "text-[var(--text-muted)] hover:text-zinc-50 hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {roundCount > 0 && (
            <button
              className="rounded-full border app-hairline px-3 py-1.5 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50 transition"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await regroupRoundsAction();
                  if (result.result) setRegroupResult(result.result);
                  router.refresh();
                });
              }}
            >
              Regroup rounds
            </button>
          )}
          {hasNotGeneratedRounds && activeLeagueSeasonId && (
            <button
              className="rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-3 py-1.5 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:brightness-110 transition"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("leagueSeasonId", activeLeagueSeasonId);
                  await populateAllAction({ error: "" }, fd);
                  router.refresh();
                });
              }}
            >
              {isPending ? "Generating..." : "Populate all rounds"}
            </button>
          )}
          {hasDraftRounds && activeLeagueSeasonId && (
            <button
              className="rounded-full border border-zinc-600/50 bg-zinc-800/30 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700/30 transition"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("leagueSeasonId", activeLeagueSeasonId);
                  const result = await regenerateAllDraftsAction({ error: "" }, fd);
                  if (result.result) setRegenerateResult(result.result);
                  router.refresh();
                });
              }}
            >
              {isPending ? "Regenerating..." : "Regenerate all drafts"}
            </button>
          )}
          {hasDraftRounds && activeLeagueSeasonId && (
            <button
              className="rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/30 transition-colors"
              onClick={() => setShowClearAllDialog(true)}
            >
              Clear all drafts
            </button>
          )}
        </div>
      </div>

      {regroupResult && (
        <div className="mt-2 rounded-lg border border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-zinc-100">
          {regroupResult}
          <button
            className="ml-3 underline hover:text-white"
            onClick={() => setRegroupResult(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      {regenerateResult && (
        <div className="mt-2 rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-4 py-3 text-sm text-zinc-100">
          {regenerateResult}
          <button
            className="ml-3 underline hover:text-white"
            onClick={() => setRegenerateResult(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
          {filter === "all"
            ? "No match rounds yet. Create matches to start."
            : `No ${filter === "needs_action" ? "blocked or ungenerated" : filter} rounds.`}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {filtered.map((round) => {
            return (
              <TacticalSurface key={round.id} variant="default" padding="none">
                <Link
                  href={`/rounds/${round.id}`}
                  className="block hover:bg-[rgba(255,255,255,0.03)] p-4 rounded-[1.5rem]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zinc-50">{round.weekLabel}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <MetricTile
                          icon={<CalendarRange className="h-3.5 w-3.5" />}
                          label="Matches"
                          value={round.matchCount}
                        />
                      </div>
                      <p className="mt-2 text-xs app-copy-muted">
                        {round.teamNames.join(" · ")}
                      </p>
                    </div>
                    <StatusBadge status={round.derivedStatus} />
                  </div>
                </Link>
                {round.derivedStatus === "NOT_GENERATED" && (
                  <div className="mt-3 border-t app-hairline pt-3">
                    <button
                      className="h-8 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-3 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:brightness-110 transition disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                           const fd = new FormData();
                           fd.set("roundId", round.id);
                           await generateRoundAction({ error: "" }, fd);
                           router.refresh();
                         });
                      }}
                      type="button"
                    >
                      {isPending ? "Generating..." : "Generate squads"}
                    </button>
                  </div>
                )}
                {(round.derivedStatus === "DRAFT" || round.derivedStatus === "BLOCKED" || round.derivedStatus === "READY") && (
                  <div className="mt-3 border-t app-hairline pt-3">
                    <button
                      className="h-8 rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => setFinalizingRoundId(round.id)}
                      type="button"
                    >
                      <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                      Finalize round
                    </button>
                  </div>
                )}
                {round.derivedStatus === "FINALIZED" && (
                  <div className="mt-3 border-t app-hairline pt-3">
                    <button
                      className="h-8 rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => {
                        if (!confirm("Un-finalize this round? Selections will revert to draft and can be recalculated.")) return;
                        startTransition(async () => {
                           const fd = new FormData();
                           fd.set("matchRoundId", round.id);
                           await unfinalizeRoundFromListAction({ error: "" }, fd);
                           router.refresh();
                         });
                      }}
                      type="button"
                    >
                      <RotateCcw className="mr-1 inline h-3.5 w-3.5" />
                      {isPending ? "Un-finalizing..." : "Un-finalize"}
                    </button>
                  </div>
                )}
              </TacticalSurface>
            );
          })}
        </div>
      )}

      {finalizingRoundId && (
        <ConfirmFinalizeDialog
          isOpen={true}
          onClose={() => setFinalizingRoundId(null)}
          onConfirm={(category, detail) => {
            startTransition(async () => {
              const fd = new FormData();
              fd.set("matchRoundId", finalizingRoundId);
              if (category) fd.set("overrideReasonCategory", category);
              if (detail) fd.set("overrideReasonDetail", detail);
              await finalizeRoundFromListAction(fd);
              setFinalizingRoundId(null);
              router.refresh();
            });
          }}
          blockedCount={0}
          decisionRequiredCount={0}
          selectedCount={0}
          targetSquadSize={0}
          matchCount={0}
        />
      )}

      {showClearAllDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowClearAllDialog(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
            <div className="flex flex-col gap-4 px-5 py-4">
              <h3 className="text-base font-semibold text-zinc-100">Clear all draft selections</h3>
              <p className="text-sm text-zinc-300">
                This will remove all non-finalized draft selections, plan integrity signals, and explanations across all rounds.
              </p>
              <div className="rounded-lg border border-amber-700/40 bg-amber-900/15 px-3 py-2">
                <p className="text-sm text-amber-300">Finalized rounds and setup data will not be affected. This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-3">
              <button
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-100 transition-colors"
                onClick={() => setShowClearAllDialog(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30 transition-colors disabled:opacity-50"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const formData = new FormData();
                    formData.set("leagueSeasonId", activeLeagueSeasonId!);
                    await clearAllDraftsAction(formData);
                    setShowClearAllDialog(false);
                    router.refresh();
                  });
                }}
              >
                {isPending ? "Clearing..." : "Clear all drafts"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}