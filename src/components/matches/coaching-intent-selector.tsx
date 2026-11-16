"use client";

import { useState, useTransition } from "react";
import { COACHING_INTENT_CATEGORIES, COACHING_INTENT_LABELS, type CoachingIntentScopeType } from "@/lib/coaching/types";

type CoachingIntentSelectorProps = {
  scopeType: CoachingIntentScopeType;
  scopeId: string;
  currentIntent?: string;
  currentIntentId?: string;
  label?: string;
  /**
   * Gate C W2 remediation (P1-06): this component dynamically imports its own real server
   * actions, outside any `commands`-style boundary a parent (e.g. `RoundBoard`) might expose —
   * an audit gap that let UI Lab call a real mutation with a synthetic id. These two optional
   * overrides default to the real dynamic imports when omitted, so every other caller of this
   * shared, widely-used component is completely unaffected.
   */
  setCoachingIntentCommand?: (
    scopeType: CoachingIntentScopeType,
    scopeId: string,
    category: string,
    note: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  removeCoachingIntentCommand?: (intentId: string) => Promise<{ success: boolean; error?: string }>;
};

export function CoachingIntentSelector({
  scopeType,
  scopeId,
  currentIntent,
  currentIntentId,
  label,
  setCoachingIntentCommand,
  removeCoachingIntentCommand,
}: CoachingIntentSelectorProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(currentIntent ?? "");

  function handleSet(category: string) {
    setError(null);
    startTransition(async () => {
      const setIntent =
        setCoachingIntentCommand ??
        (await import("@/app/(app)/matches/[matchId]/coaching-actions/actions")).setCoachingIntentAction;
      const result = await setIntent(scopeType, scopeId, category, null);
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
      const intentId = currentIntentId;
      if (!intentId) return;
      const removeIntent =
        removeCoachingIntentCommand ??
        (await import("@/app/(app)/matches/[matchId]/coaching-actions/actions")).removeCoachingIntentAction;
      const result = await removeIntent(intentId);
      if (!result.success) {
        setError(result.error ?? "Failed to remove intent.");
      } else {
        setSelected("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </label>
      )}
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