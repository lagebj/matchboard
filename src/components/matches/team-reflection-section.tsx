"use client";

import { useState, useTransition } from "react";

type TeamReflectionData = {
  effort?: string | null;
  teamCohesion?: string | null;
  positionalShape?: string | null;
  recoveryBehavior?: string | null;
  note?: string | null;
};

type TeamReflectionSectionProps = {
  matchId: string;
  reflection: TeamReflectionData | null;
};

const RATING_OPTIONS = ["STRONG", "OK", "NEEDS_ATTENTION"] as const;

const RATING_LABELS: Record<string, string> = {
  STRONG: "Strong",
  OK: "OK",
  NEEDS_ATTENTION: "Needs attention",
};

const FIELDS: Array<{ key: keyof TeamReflectionData; label: string }> = [
  { key: "effort", label: "Effort" },
  { key: "teamCohesion", label: "Team cohesion" },
  { key: "positionalShape", label: "Positional shape" },
  { key: "recoveryBehavior", label: "Recovery behavior" },
];

export function TeamReflectionSection({ matchId, reflection }: TeamReflectionSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<TeamReflectionData>({
    effort: reflection?.effort ?? null,
    teamCohesion: reflection?.teamCohesion ?? null,
    positionalShape: reflection?.positionalShape ?? null,
    recoveryBehavior: reflection?.recoveryBehavior ?? null,
    note: reflection?.note ?? null,
  });
  const [note, setNote] = useState(reflection?.note ?? "");

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const { setTeamReflectionAction } = await import("@/app/(app)/matches/[matchId]/coaching-actions/responsibility-actions");
      const result = await setTeamReflectionAction(matchId, {
        effort: values.effort ?? undefined,
        teamCohesion: values.teamCohesion ?? undefined,
        positionalShape: values.positionalShape ?? undefined,
        recoveryBehavior: values.recoveryBehavior ?? undefined,
        note: note || undefined,
      });
      if (!result.success) {
        setError(result.error ?? "Failed to save reflection.");
      }
    });
  }

  return (
    <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Team reflection</h3>

      {error && <p className="text-xs text-[var(--danger)] mb-2">{error}</p>}

      <div className="flex flex-col gap-3">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)] w-36">{label}</span>
            <div className="flex gap-1.5">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, [key]: values[key] === opt ? null : opt }))}
                  disabled={isPending}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    values[key] === opt
                      ? opt === "STRONG"
                        ? "bg-[var(--success-subtle)] text-[var(--success)] border border-[color-mix(in_srgb,var(--success)_35%,transparent)]"
                        : opt === "NEEDS_ATTENTION"
                          ? "bg-[var(--warning-subtle)] text-[var(--warning)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)]"
                          : "bg-[var(--tl-c-surface-selected)] text-[var(--foreground)] border border-[var(--border-strong)]"
                      : "bg-[var(--tl-c-surface)] text-[var(--text-muted)] border border-[var(--border-soft)] hover:bg-[var(--tl-c-surface-hover)]"
                  }`}
                >
                  {RATING_LABELS[opt]}
                </button>
              ))}
              {values[key] && (
                <button
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, [key]: null }))}
                  disabled={isPending}
                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-start gap-3">
          <span className="text-xs text-[var(--text-muted)] w-36 mt-1.5">Note</span>
          <textarea
            className="flex-1 rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-2 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--text-muted)] min-h-[60px]"
            placeholder="Optional team-level reflection notes…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="mt-3 rounded-md bg-[var(--tl-c-accent)] px-3 py-1.5 text-xs font-medium text-[var(--tl-c-accent-on-fill)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-[filter]"
      >
        {reflection ? "Update reflection" : "Save reflection"}
      </button>
    </div>
  );
}