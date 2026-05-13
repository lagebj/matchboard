"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FixturesOverview, FixturePeriod, FixtureRound, FixtureMatch, SelectionState } from "@/domain/fixtures/types";
import { fetchFixturesOverview, fixturePopulateAllAction, fixtureRegenerateAllAction, fixtureClearAllDraftsAction, fixtureGenerateRoundAction, fixtureRegenerateRoundAction, fixtureClearRoundDraftAction, fixtureFinalizeRoundAction, fixtureUnfinalizeRoundAction, fixtureRegenerateMatchAction, fixtureClearMatchDraftAction, fixtureFinalizeMatchAction } from "@/domain/fixtures/actions";

const selectionStateConfig: Record<SelectionState, { label: string; dotClass: string; textClass: string; borderClass: string }> = {
  NOT_GENERATED: { label: "Not generated", dotClass: "bg-zinc-500", textClass: "text-zinc-400", borderClass: "border-zinc-700/40" },
  DRAFT: { label: "Draft", dotClass: "bg-amber-400", textClass: "text-amber-300", borderClass: "border-amber-700/40" },
  BLOCKED: { label: "Blocked", dotClass: "bg-red-400", textClass: "text-red-300", borderClass: "border-red-700/40" },
  READY: { label: "Ready", dotClass: "bg-emerald-400", textClass: "text-emerald-300", borderClass: "border-emerald-700/40" },
  FINALIZED: { label: "Finalized", dotClass: "bg-[var(--accent)]", textClass: "text-[var(--accent-strong)]", borderClass: "border-[rgba(140,167,146,0.28)]" },
};

function SelectionStateBadge({ state }: { state: SelectionState }) {
  const config = selectionStateConfig[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.borderClass} ${config.textClass}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}

const postMatchStatusConfig: Record<string, { label: string; textClass: string }> = {
  NOT_STARTED: { label: "No report", textClass: "text-zinc-500" },
  DRAFT: { label: "Draft report", textClass: "text-amber-400" },
  REPORTED: { label: "Reported", textClass: "text-blue-400" },
  LOCKED: { label: "Locked report", textClass: "text-emerald-400" },
};

function PostMatchBadge({ status }: { status?: string }) {
  if (!status || status === "NOT_STARTED") return null;
  const cfg = postMatchStatusConfig[status];
  if (!cfg) return null;
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wider ${cfg.textClass}`}>
      {cfg.label}
    </span>
  );
}

function ActionButton({ label, onClick, disabled, variant = "default" }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger" | "success";
}) {
  const classes = {
    default: "border border-zinc-600/50 bg-zinc-800/30 text-zinc-200 hover:bg-zinc-700/30",
    primary: "border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] text-zinc-50 hover:brightness-110",
    danger: "border border-red-700/40 bg-red-900/20 text-red-300 hover:bg-red-900/30",
    success: "border border-emerald-700/40 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-900/30",
  }[variant];

  return (
    <button
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${classes}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {label}
    </button>
  );
}

function MatchActions({ match, roundId, roundState }: { match: FixtureMatch; roundId: string; roundState: SelectionState }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (roundState === "FINALIZED") return null;

  const actions = match.availableActions;
  if (actions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {actions.includes("createDraft") && (
        <ActionButton
          label={isPending ? "Generating..." : "Generate squads"}
          variant="primary"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const fd = new FormData();
              fd.set("roundId", roundId);
              const result = await fixtureGenerateRoundAction({ error: "" }, fd);
              if (result.error) setResultMessage(result.error);
              else setResultMessage("Squads generated");
              router.refresh();
            });
          }}
        />
      )}
      {actions.includes("recreateDraft") && (
        <ActionButton
          label={isPending ? "Regenerating..." : "Regenerate"}
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const fd = new FormData();
              fd.set("matchId", match.id);
              const result = await fixtureRegenerateMatchAction({ error: "" }, fd);
              if (result.error) setResultMessage(result.error);
              router.refresh();
            });
          }}
        />
      )}
      {actions.includes("clearDraft") && (
        <ActionButton
          label="Clear"
          variant="danger"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Clear draft selections for this match? Finalized data will not be affected.")) return;
            startTransition(async () => {
              const fd = new FormData();
              fd.set("matchId", match.id);
              await fixtureClearMatchDraftAction(fd);
              router.refresh();
            });
          }}
        />
      )}
      {actions.includes("finalize") && (
        <ActionButton
          label="Finalize"
          variant="success"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Finalize this match? This locks the selection.")) return;
            startTransition(async () => {
              const fd = new FormData();
              fd.set("matchId", match.id);
              const result = await fixtureFinalizeMatchAction({ error: "" }, fd);
              if (result.error) setResultMessage(result.error);
              router.refresh();
            });
          }}
        />
      )}
      {resultMessage && (
        <span className="text-[10px] text-zinc-400">{resultMessage}</span>
      )}
    </div>
  );
}

function MatchRow({ match, roundId, roundState }: { match: FixtureMatch; roundId: string; roundState: SelectionState }) {
  return (
    <div className="flex flex-col gap-1.5 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-zinc-200 truncate">{match.title}</span>
          {match.venue && <span className="text-[10px] text-zinc-500">{match.venue}</span>}
          {match.startsAt && (
            <span className="text-[10px] text-zinc-500">{new Date(match.startsAt).toLocaleDateString()}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SelectionStateBadge state={match.selectionState} />
          <PostMatchBadge status={match.postMatchStatus} />
          {typeof match.selectedPlayerCount === "number" && match.selectedPlayerCount > 0 && (
            <span className="text-[10px] text-zinc-500">{match.selectedPlayerCount} selected</span>
          )}
          {match.unresolvedIssueCount > 0 && (
            <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-300">{match.unresolvedIssueCount} issue{match.unresolvedIssueCount !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MatchActions match={match} roundId={roundId} roundState={roundState} />
        <div className="flex items-center gap-2 ml-auto">
          <Link href={`/matches/${match.id}`} className="text-[10px] text-zinc-400 hover:text-zinc-200">
            Match detail
          </Link>
          <Link href={`/rounds/${roundId}`} className="text-[10px] text-zinc-400 hover:text-zinc-200">
            Open board
          </Link>
        </div>
      </div>
    </div>
  );
}

function RoundSection({ round }: { round: FixtureRound }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const actions = round.availableActions;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{round.title}</span>
          <SelectionStateBadge state={round.selectionState} />
        </div>
        <div className="flex items-center gap-2">
          {round.unresolvedIssueCount > 0 && (
            <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-300">{round.unresolvedIssueCount} issue{round.unresolvedIssueCount !== 1 ? "s" : ""}</span>
          )}
          <Link href={`/rounds/${round.id}`} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700">
            Open board
          </Link>
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-2 flex-wrap">
          {actions.includes("createDraft") && (
            <ActionButton
              label={isPending ? "Generating..." : "Generate squads"}
              variant="primary"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("roundId", round.id);
                  const result = await fixtureGenerateRoundAction({ error: "" }, fd);
                  if (result.error) setResultMessage(result.error);
                  else setResultMessage("Squads generated");
                  router.refresh();
                });
              }}
            />
          )}
          {actions.includes("recreateDraft") && (
            <ActionButton
              label={isPending ? "Regenerating..." : "Regenerate"}
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("roundId", round.id);
                  const result = await fixtureRegenerateRoundAction({ error: "" }, fd);
                  if (result.error) setResultMessage(result.error);
                  else setResultMessage("Squads regenerated");
                  router.refresh();
                });
              }}
            />
          )}
          {actions.includes("clearDraft") && (
            <ActionButton
              label="Clear"
              variant="danger"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Clear all draft selections for this round? Finalized data will not be affected.")) return;
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("roundId", round.id);
                  await fixtureClearRoundDraftAction(fd);
                  router.refresh();
                });
              }}
            />
          )}
          {actions.includes("finalize") && (
            <ActionButton
              label={isPending ? "Finalizing..." : "Finalize round"}
              variant="success"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Finalize this round? This locks all selections.")) return;
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("roundId", round.id);
                  const result = await fixtureFinalizeRoundAction({ error: "" }, fd);
                  if (result.error) setResultMessage(result.error);
                  router.refresh();
                });
              }}
            />
          )}
          {actions.includes("unfinalize") && (
            <ActionButton
              label={isPending ? "Un-finalizing..." : "Un-finalize"}
              disabled={isPending}
              onClick={() => {
                if (!confirm("Un-finalize this round? Selections will revert to draft.")) return;
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("roundId", round.id);
                  const result = await fixtureUnfinalizeRoundAction({ error: "" }, fd);
                  if (result.error) setResultMessage(result.error);
                  router.refresh();
                });
              }}
            />
          )}
          {resultMessage && (
            <span className="text-[10px] text-zinc-400">{resultMessage}</span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-3">
        {round.matches.length === 0 ? (
          <p className="text-xs text-zinc-500 py-2">No matches in this round.</p>
        ) : (
          round.matches.map((match) => <MatchRow key={match.id} match={match} roundId={round.id} roundState={round.selectionState} />)
        )}
      </div>
    </div>
  );
}

function PeriodSection({ period }: { period: FixturePeriod }) {
  const hasNotGenerated = period.rounds.some((r) => r.selectionState === "NOT_GENERATED");
  const hasDraftRounds = period.rounds.some((r) => r.selectionState === "DRAFT" || r.selectionState === "BLOCKED" || r.selectionState === "READY");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-100">{period.title}</h2>
          {period.dateRange && <span className="text-xs text-zinc-500">{period.dateRange}</span>}
        </div>
        <div className="flex items-center gap-2">
          {hasNotGenerated && (
            <ActionButton
              label={isPending ? "Generating..." : "Populate all rounds"}
              variant="primary"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("planningPeriodId", period.id);
                  const result = await fixturePopulateAllAction({ error: "" }, fd);
                  if (result.error) setResultMessage(result.error);
                  else setResultMessage(result.result ?? "Done");
                  router.refresh();
                });
              }}
            />
          )}
          {hasDraftRounds && (
            <ActionButton
              label={isPending ? "Regenerating..." : "Regenerate all drafts"}
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("planningPeriodId", period.id);
                  const result = await fixtureRegenerateAllAction({ error: "" }, fd);
                  if (result.error) setResultMessage(result.error);
                  else setResultMessage(result.result ?? "Done");
                  router.refresh();
                });
              }}
            />
          )}
          {hasDraftRounds && (
            <ActionButton
              label="Clear all drafts"
              variant="danger"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Clear all draft selections for this period? Finalized data will not be affected.")) return;
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("planningPeriodId", period.id);
                  await fixtureClearAllDraftsAction(fd);
                  router.refresh();
                });
              }}
            />
          )}
          {period.unresolvedIssueCount > 0 && (
            <span className="rounded bg-amber-900/30 px-2 py-0.5 text-[10px] text-amber-300">
              {period.unresolvedIssueCount} unresolved issue{period.unresolvedIssueCount !== 1 ? "s" : ""}
            </span>
          )}
          {resultMessage && (
            <span className="text-[10px] text-zinc-400">{resultMessage}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {period.rounds.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">No rounds in this period.</p>
        ) : (
          period.rounds.map((round) => <RoundSection key={round.id} round={round} />)
        )}
      </div>
    </div>
  );
}

export function FixturesPage() {
  const [data, setData] = useState<FixturesOverview | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchFixturesOverview();
      setData(result);
    });
  }, [startTransition]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Fixtures</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Plan rounds, review matches, and manage selections.</p>
      </div>

      {isPending && !data ? (
        <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-6 text-sm text-zinc-500">
          Loading fixtures...
        </div>
      ) : !data || data.periods.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No planning periods found.</p>
          <p className="text-xs text-zinc-500">Create a season and planning period to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {data.periods.map((period) => <PeriodSection key={period.id} period={period} />)}
        </div>
      )}
    </div>
  );
}