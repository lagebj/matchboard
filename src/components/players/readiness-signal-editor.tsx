"use client";

import { useState, useTransition } from "react";
import { READINESS_SIGNAL_TYPES, READINESS_SIGNAL_LABELS, READINESS_SIGNAL_VALID_VALUES, type ReadinessSignalType } from "@/lib/coaching/types";

type ReadinessSignalEntry = {
  id: string;
  signalType: string;
  value: string;
  note: string | null;
};

type ReadinessSignalEditorProps = {
  playerId: string;
  signals: ReadinessSignalEntry[];
};

const VALUE_LABELS: Record<string, string> = {
  RISING: "Rising",
  STABLE: "Stable",
  FALLING: "Falling",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  STRONG: "Strong",
  OK: "OK",
  NEEDS_ATTENTION: "Needs attention",
};

const VALUE_COLORS: Record<string, string> = {
  RISING: "text-emerald-400",
  STABLE: "text-zinc-300",
  FALLING: "text-amber-400",
  HIGH: "text-emerald-400",
  MEDIUM: "text-zinc-300",
  LOW: "text-amber-400",
  STRONG: "text-emerald-400",
  OK: "text-zinc-300",
  NEEDS_ATTENTION: "text-amber-400",
};

export function ReadinessSignalEditor({ playerId, signals }: ReadinessSignalEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const signalMap = new Map(signals.map((s) => [s.signalType, s]));

  function handleSet(signalType: string, value: string) {
    setError(null);
    startTransition(async () => {
      const { setReadinessSignalAction } = await import("@/app/(app)/players/[playerId]/coaching-actions/actions");
      const result = await setReadinessSignalAction(playerId, signalType, value, null);
      if (!result.success) {
        setError(result.error ?? "Failed to update readiness signal.");
      }
    });
  }

  function handleDelete(signalType: string) {
    setError(null);
    startTransition(async () => {
      const { deleteReadinessSignalAction } = await import("@/app/(app)/players/[playerId]/coaching-actions/actions");
      const result = await deleteReadinessSignalAction(playerId, signalType);
      if (!result.success) {
        setError(result.error ?? "Failed to delete readiness signal.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {READINESS_SIGNAL_TYPES.map((signalType) => {
        const existing = signalMap.get(signalType);
        const validValues = READINESS_SIGNAL_VALID_VALUES[signalType as ReadinessSignalType];

        return (
          <div key={signalType} className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] w-40 shrink-0">{READINESS_SIGNAL_LABELS[signalType as ReadinessSignalType]}</span>
            <div className="flex gap-1">
              {validValues.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSet(signalType, val)}
                  disabled={isPending}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    existing?.value === val
                      ? `${VALUE_COLORS[val] ?? "text-zinc-200"} bg-zinc-700/40 border border-zinc-600/40`
                      : "text-zinc-500 bg-zinc-800/20 border border-zinc-700/30 hover:bg-zinc-800/40 hover:text-zinc-300"
                  }`}
                >
                  {VALUE_LABELS[val] ?? val}
                </button>
              ))}
            </div>
            {existing && (
              <button
                type="button"
                onClick={() => handleDelete(signalType)}
                disabled={isPending}
                className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}