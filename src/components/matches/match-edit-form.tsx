"use client";

import { useState, useTransition } from "react";
import { updateMatchAction } from "@/app/(app)/matches/actions";
import { formatIsoWeekKey } from "@/lib/date-utils";
import { Pencil, Check, X, Loader2 } from "lucide-react";

type MatchRoundOption = {
  id: string;
  name: string;
};

type MatchEditFormProps = {
  matchId: string;
  startsAt: Date;
  matchRoundId: string;
  matchRoundName: string;
  phaseStartDate: Date;
  phaseEndDate: Date;
  availableRounds: MatchRoundOption[];
};

function toDateInputValue(date: Date): string {
  return date.toISOString().split("T")[0];
}

function toTimeInputValue(date: Date): string {
  return date.toISOString().split("T")[1]?.slice(0, 5) ?? "12:00";
}

export function MatchEditForm({
  matchId,
  startsAt,
  matchRoundId: _matchRoundId,
  matchRoundName,
  phaseStartDate,
  phaseEndDate,
  availableRounds,
}: MatchEditFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateValue, setDateValue] = useState(toDateInputValue(startsAt));
  const [timeValue, setTimeValue] = useState(toTimeInputValue(startsAt));
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [showRoundPrompt, setShowRoundPrompt] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const phaseDateRange = `${phaseStartDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} – ${phaseEndDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-1.5 text-xs font-medium text-[var(--text-soft)] hover:text-zinc-100 hover:bg-[rgba(255,255,255,0.06)] transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit match details
      </button>
    );
  }

  function handleDateChange(newDate: string) {
    setDateValue(newDate);
    setError(null);
    setSuccess(false);
    setShowRoundPrompt(false);
    setSelectedRoundId(null);

    if (!newDate) return;

    const newDateObj = new Date(`${newDate}T12:00:00Z`);
    const currentWeekKey = formatIsoWeekKey(startsAt);
    const newWeekKey = formatIsoWeekKey(newDateObj);

    if (newWeekKey !== currentWeekKey) {
      setShowRoundPrompt(true);
    }
  }

  function handleSave() {
    setError(null);
    setSuccess(false);

    if (!dateValue) {
      setError("Date is required.");
      return;
    }

    const combined = `${dateValue}T${timeValue}:00.000Z`;
    const parsed = new Date(combined);
    if (isNaN(parsed.getTime())) {
      setError("Invalid date or time.");
      return;
    }

    const roundId = showRoundPrompt && selectedRoundId ? selectedRoundId : undefined;

    startTransition(async () => {
      const result = await updateMatchAction(matchId, combined, roundId);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 1500);
      } else {
        setError(result.error);
      }
    });
  }

  function handleCancel() {
    setDateValue(toDateInputValue(startsAt));
    setTimeValue(toTimeInputValue(startsAt));
    setSelectedRoundId(null);
    setShowRoundPrompt(false);
    setError(null);
    setSuccess(false);
    setIsOpen(false);
  }

  return (
    <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">Edit match details</h3>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-startsAt-date" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Date
          </label>
          <input
            id="edit-startsAt-date"
            type="date"
            value={dateValue}
            onChange={(e) => handleDateChange(e.target.value)}
            min={toDateInputValue(phaseStartDate)}
            max={toDateInputValue(phaseEndDate)}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-startsAt-time" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Time
          </label>
          <input
            id="edit-startsAt-time"
            type="time"
            value={timeValue}
            onChange={(e) => { setTimeValue(e.target.value); setError(null); setSuccess(false); }}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">Round</span>
          <span className="text-sm text-zinc-100">{matchRoundName}</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">Phase</span>
          <span className="text-sm text-[var(--text-soft)]">{phaseDateRange}</span>
        </div>

        {showRoundPrompt && (
          <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 p-3">
            <p className="text-xs text-amber-300 mb-2">
              The new date is in a different week. Select which round to move the match to:
            </p>
            {availableRounds.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {availableRounds.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="radio"
                      name="targetRound"
                      value={r.id}
                      checked={selectedRoundId === r.id}
                      onChange={() => setSelectedRoundId(r.id)}
                      className="accent-[var(--accent-strong)]"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                No other rounds available in this phase. The match will stay in the current round.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
            <Check className="mr-1 inline h-3 w-3" />
            Changes saved.
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 py-2 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))] disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {isPending ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-2 text-xs font-medium text-[var(--text-soft)] hover:text-zinc-100 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}