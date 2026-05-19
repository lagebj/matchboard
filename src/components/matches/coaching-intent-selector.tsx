"use client";

import { useState, useTransition } from "react";
import { COACHING_INTENT_CATEGORIES, COACHING_INTENT_LABELS } from "@/lib/coaching/types";

type CoachingIntentSelectorProps = {
  matchId: string;
  currentIntent?: string;
  currentIntentId?: string;
};

export function CoachingIntentSelector({ matchId, currentIntent, currentIntentId }: CoachingIntentSelectorProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(currentIntent ?? "");

  function handleSet(category: string) {
    setError(null);
    startTransition(async () => {
      const { setCoachingIntentAction } = await import("@/app/(app)/matches/[matchId]/coaching-actions/actions");
      const result = await setCoachingIntentAction("MATCH", matchId, category, null);
      if (!result.success) {
        setError(result.error ?? "Failed to set intent.");
      }
      setSelected(category);
    });
  }

  function handleRemove() {
    if (!currentIntentId && !selected) return;
    setError(null);
    startTransition(async () => {
      const { removeCoachingIntentAction } = await import("@/app/(app)/matches/[matchId]/coaching-actions/actions");
      const intentId = currentIntentId;
      if (!intentId) return;
      const result = await removeCoachingIntentAction(intentId);
      if (!result.success) {
        setError(result.error ?? "Failed to remove intent.");
      } else {
        setSelected("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Coaching intent
      </label>
      <select
        className="rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        value={selected}
        onChange={(e) => {
          if (e.target.value) {
            handleSet(e.target.value);
          } else {
            handleRemove();
          }
        }}
        disabled={isPending}
      >
        <option value="">None</option>
        {COACHING_INTENT_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {COACHING_INTENT_LABELS[cat]}
          </option>
        ))}
      </select>
      {currentIntent && !selected && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          className="text-[10px] text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
        >
          Remove intent
        </button>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}