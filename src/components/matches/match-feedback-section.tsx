"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FEEDBACK_CATEGORIES, FEEDBACK_CATEGORY_LABELS, FEEDBACK_NEXT_ACTIONS, FEEDBACK_VALUES, FEEDBACK_VALUE_LABELS, NEXT_ACTION_LABELS, FEEDBACK_TO_READINESS, READINESS_SIGNAL_LABELS, type FeedbackCategory, type ReadinessSignalType, type ReadinessSignalValue } from "@/lib/coaching/types";
import { formatFeedbackValue, formatNextAction } from "@/lib/match-utils";

type FeedbackEntry = {
  id: string;
  playerId: string;
  category: string;
  value: string;
  observableBehavior: string | null;
  nextAction: string;
  note: string | null;
};

type PlayerOption = {
  id: string;
  name: string;
};

type ReadinessSuggestion = {
  signalType: ReadinessSignalType;
  suggestedValue: ReadinessSignalValue;
  signalLabel: string;
  valueLabel: string;
  playerId: string;
};

type MatchFeedbackSectionProps = {
  matchId: string;
  feedback: FeedbackEntry[];
  players: PlayerOption[];
};

export function MatchFeedbackSection({ matchId, feedback, players }: MatchFeedbackSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const [observableBehavior, setObservableBehavior] = useState("");
  const [selectedNextAction, setSelectedNextAction] = useState("NO_ACTION");
  const [note, setNote] = useState("");
  const [readinessSuggestion, setReadinessSuggestion] = useState<ReadinessSuggestion | null>(null);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  function handleAdd() {
    if (!selectedPlayer || !selectedCategory || !selectedValue) return;
    setError(null);
    setReadinessSuggestion(null);
    setSuggestionApplied(false);
    startTransition(async () => {
      const { createMatchFeedbackAction } = await import("@/app/(app)/matches/[matchId]/post-match/feedback-actions");
      const result = await createMatchFeedbackAction(matchId, selectedPlayer, selectedCategory, selectedValue, observableBehavior || null, selectedNextAction, note || null);
      if (result.success) {
        if (result.readinessSuggestion) {
          setReadinessSuggestion({
            ...result.readinessSuggestion,
            signalType: result.readinessSuggestion.signalType as ReadinessSignalType,
            suggestedValue: result.readinessSuggestion.suggestedValue as ReadinessSignalValue,
            playerId: selectedPlayer,
          });
        }
        setSelectedPlayer("");
        setSelectedCategory("");
        setSelectedValue("");
        setObservableBehavior("");
        setSelectedNextAction("NO_ACTION");
        setNote("");
      } else {
        setError(result.error ?? "Failed to add feedback.");
      }
    });
  }

  function handleAcceptSuggestion() {
    if (!readinessSuggestion) return;
    startTransition(async () => {
      const { setReadinessSignalAction } = await import("@/app/(app)/players/[playerId]/coaching-actions/actions");
      const result = await setReadinessSignalAction(
        readinessSuggestion.playerId,
        readinessSuggestion.signalType,
        readinessSuggestion.suggestedValue,
        null,
      );
      if (result.success) {
        setReadinessSuggestion(null);
        setSuggestionApplied(true);
      }
    });
  }

  function handleDismissSuggestion() {
    setReadinessSuggestion(null);
  }

  function handleDelete(feedbackId: string) {
    setError(null);
    startTransition(async () => {
      const { deleteMatchFeedbackAction } = await import("@/app/(app)/matches/[matchId]/post-match/feedback-actions");
      const result = await deleteMatchFeedbackAction(feedbackId);
      if (!result.success) setError(result.error ?? "Failed to delete feedback.");
    });
  }

  return (
    <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">Post-match feedback</h3>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {readinessSuggestion && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-700/40 bg-amber-900/15 px-3 py-2">
          <span className="text-[10px] text-amber-300">
            Set <span className="font-semibold">{readinessSuggestion.signalLabel}</span> to <span className="font-semibold">{readinessSuggestion.valueLabel}</span>?
          </span>
          <button
            type="button"
            onClick={handleAcceptSuggestion}
            disabled={isPending}
            className="rounded border border-amber-600/40 bg-amber-800/30 px-2 py-0.5 text-[10px] font-medium text-amber-200 hover:bg-amber-700/40 disabled:opacity-40 transition-colors"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={handleDismissSuggestion}
            disabled={isPending}
            className="rounded border border-zinc-600/40 bg-zinc-800/30 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-700/40 disabled:opacity-40 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {suggestionApplied && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-emerald-700/40 bg-emerald-900/15 px-3 py-2">
          <span className="text-[10px] text-emerald-300">Readiness signal updated.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <select
          className="rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200"
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          disabled={isPending}
        >
          <option value="">Player…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          className="rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          disabled={isPending}
        >
          <option value="">Category…</option>
          {FEEDBACK_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{FEEDBACK_CATEGORY_LABELS[cat]}</option>
          ))}
        </select>

        <select
          className="rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200"
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value)}
          disabled={isPending}
        >
          <option value="">Value…</option>
          {FEEDBACK_VALUES.map((v) => (
            <option key={v} value={v}>{FEEDBACK_VALUE_LABELS[v]}</option>
          ))}
        </select>

        <select
          className="rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200"
          value={selectedNextAction}
          onChange={(e) => setSelectedNextAction(e.target.value)}
          disabled={isPending}
        >
          {FEEDBACK_NEXT_ACTIONS.map((a) => (
            <option key={a} value={a}>{NEXT_ACTION_LABELS[a]}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <input
          type="text"
          className="rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500"
          placeholder="Observable behavior (e.g. helped teammate after ball loss)"
          value={observableBehavior}
          onChange={(e) => setObservableBehavior(e.target.value)}
          disabled={isPending}
        />
        <input
          type="text"
          className="rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isPending}
        />
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={isPending || !selectedPlayer || !selectedCategory || !selectedValue}
        className="rounded-md bg-blue-600/80 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-blue-500/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Add feedback
      </button>

      {feedback.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {feedback.map((f) => {
            const player = players.find((p) => p.id === f.playerId);
            const readinessMapping = (FEEDBACK_TO_READINESS as Record<string, { signalType: ReadinessSignalType; suggestedValue: ReadinessSignalValue } | null>)[f.category];
            return (
              <div key={f.id} className="flex items-start gap-2 rounded-md border border-zinc-700/40 bg-zinc-800/20 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-200">
                    <span className="font-medium">{player?.name ?? f.playerId}</span>
                    <span className="text-zinc-500 mx-1">·</span>
                    <span className="text-[var(--text-muted)]">{FEEDBACK_CATEGORY_LABELS[f.category as FeedbackCategory] ?? f.category}</span>
                    <span className="text-zinc-500 mx-1">·</span>
                    <span className={f.value === "POSITIVE" ? "text-emerald-400" : f.value === "NEEDS_ATTENTION" ? "text-amber-400" : "text-zinc-300"}>
                      {formatFeedbackValue(f.value)}
                    </span>
                  </p>
                  {f.observableBehavior && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{f.observableBehavior}</p>
                  )}
                  {f.nextAction && f.nextAction !== "NO_ACTION" && (
                    <p className="text-[10px] text-blue-400 mt-0.5">Next: {formatNextAction(f.nextAction)}</p>
                  )}
                  {f.note && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">{f.note}</p>
                  )}
                  {f.value === "NEEDS_ATTENTION" && readinessMapping && (
                    <Link
                      href={`/players/${f.playerId}#readiness`}
                      className="inline-block mt-1 text-[10px] text-amber-400/80 hover:text-amber-300 transition-colors"
                    >
                      Consider updating {READINESS_SIGNAL_LABELS[readinessMapping.signalType]} readiness signal →
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  disabled={isPending}
                  className="text-zinc-500 hover:text-red-400 transition-colors text-xs"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}