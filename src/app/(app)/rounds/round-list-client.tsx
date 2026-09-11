"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { clearAllDraftsAction, populateAllAction, generateRoundAction, regroupRoundsAction, regenerateAllDraftsAction } from "./actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { MetricTile } from "@/components/ui/metric-tile";
import { CalendarRange } from "lucide-react";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import { TouchlineButton } from "@/components/touchline";

type RoundListItem = {
  id: string;
  name: string;
  weekLabel: string;
  matchCount: number;
  teamNames: string[];
  derivedStatus: "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED";
  /**
   * Additive to derivedStatus, never a replacement — derivedStatus is the mandatory planning-
   * completeness vocabulary (AGENTS.md "Status vocabulary"). progress describes whether the
   * round has actually been played and reported yet (DECISIONS.md's Planning/Partially
   * played/All matches played/Reporting/Complete lifecycle axis).
   */
  progress?: { label: string };
  /** Set when this round's own plan-integrity computation failed server-side. Coach-facing,
   * non-blocking -- the round is still shown and clickable. */
  loadError?: string;
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
  { key: "finalized", label: "Finalised" },
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
  const orgUrl = useOrgUrl();
  const [filter, setFilter] = useState<FilterState>("all");
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [regroupResult, setRegroupResult] = useState<string | null>(null);
  const [regenerateResult, setRegenerateResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const filtered = filterRounds(rounds, filter);

  return (
    // Rendered inside o/[orgSlug]/rounds/page.tsx's .touchline island — no wrap needed here.
    <>
      <div className="flex items-center gap-2 mt-4">
        {filterConfig.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border border-[var(--accent)]/30"
                : "text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {roundCount > 0 && (
            <TouchlineButton
              variant="secondary"
              size="sm"
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
            </TouchlineButton>
          )}
          {hasNotGeneratedRounds && activeLeagueSeasonId && (
            <TouchlineButton
              variant="primary"
              size="sm"
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
            </TouchlineButton>
          )}
          {hasDraftRounds && activeLeagueSeasonId && (
            <TouchlineButton
              variant="secondary"
              size="sm"
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
            </TouchlineButton>
          )}
          {hasDraftRounds && activeLeagueSeasonId && (
            <TouchlineButton variant="danger" size="sm" onClick={() => setShowClearAllDialog(true)}>
              Clear all drafts
            </TouchlineButton>
          )}
        </div>
      </div>

      {regroupResult && (
        <div className="mt-2 rounded-lg border border-[var(--success)]/35 bg-[var(--success-subtle)] px-4 py-3 text-sm text-[var(--success)]">
          {regroupResult}
          <button
            className="ml-3 underline hover:text-[var(--foreground)]"
            onClick={() => setRegroupResult(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      {regenerateResult && (
        <div className="mt-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-4 py-3 text-sm text-[var(--foreground)]">
          {regenerateResult}
          <button
            className="ml-3 underline hover:text-[var(--foreground)]"
            onClick={() => setRegenerateResult(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border app-hairline bg-[var(--surface-muted)]/40 px-4 py-5 text-sm app-copy-soft">
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
                  href={orgUrl(`/rounds/${round.id}`)}
                  prefetch={false}
                  className="block hover:bg-[var(--surface-hover)] p-4 rounded-[1.5rem]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[var(--foreground)]">{round.weekLabel}</p>
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
                      {round.progress && (
                        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                          {round.progress.label}
                        </p>
                      )}
                      {round.loadError && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--warning)]">
                          <TriangleAlert className="h-3 w-3" />
                          {round.loadError}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={round.derivedStatus} />
                  </div>
                </Link>
                {round.derivedStatus === "NOT_GENERATED" && (
                  <div className="mt-3 border-t app-hairline pt-3">
                    <TouchlineButton
                      variant="primary"
                      size="sm"
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
                    </TouchlineButton>
                  </div>
                )}
              </TacticalSurface>
            );
          })}
        </div>
      )}

      {showClearAllDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowClearAllDialog(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-2xl">
            <div className="flex flex-col gap-4 px-5 py-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Clear all draft selections</h3>
              <p className="text-sm text-[var(--text-soft)]">
                This will remove all non-finalized draft selections, plan integrity signals, and explanations across all rounds.
              </p>
              <div className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-subtle)] px-3 py-2">
                <p className="text-sm text-[var(--warning)]">Finalised rounds and setup data will not be affected. This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-3">
              <TouchlineButton variant="secondary" size="md" onClick={() => setShowClearAllDialog(false)}>
                Cancel
              </TouchlineButton>
              <TouchlineButton
                variant="danger"
                size="md"
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
              </TouchlineButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}