"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMatchNotesAction } from "@/app/(app)/matches/actions";
import { TouchlineButton } from "@/components/touchline";

/**
 * "Team notes" (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md` secondary row / `09_...md` "each must
 * have one clear next action when empty and a concise summary when populated"). Real persistence
 * via `updateMatchNotesAction` — not a UI-only draft.
 */
export function MatchNotesEditor({ matchId, notes }: { matchId: string; notes: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return notes ? (
      <div className="flex flex-col gap-2">
        <p className="whitespace-pre-wrap text-[13px] text-[var(--text-soft)]">{notes}</p>
        <TouchlineButton variant="ghost" size="sm" className="self-start" onClick={() => setEditing(true)}>
          Edit note
        </TouchlineButton>
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-[var(--text-muted)]">No notes yet.</p>
        <TouchlineButton variant="secondary" size="sm" className="self-start" onClick={() => setEditing(true)}>
          Add note
        </TouchlineButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="Reminders or focus areas for this match."
        className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-[13px] text-[var(--foreground)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
      />
      {error && <p className="text-[12px] text-[var(--danger)]">{error}</p>}
      <div className="flex items-center gap-2">
        <TouchlineButton
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateMatchNotesAction(matchId, value);
              if (result.success) {
                setError(null);
                setEditing(false);
                router.refresh();
              } else {
                setError(result.error);
              }
            })
          }
        >
          {isPending ? "Saving…" : "Save note"}
        </TouchlineButton>
        <TouchlineButton
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setValue(notes ?? "");
            setError(null);
            setEditing(false);
          }}
        >
          Cancel
        </TouchlineButton>
      </div>
    </div>
  );
}
