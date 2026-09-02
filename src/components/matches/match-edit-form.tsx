"use client";

import { useState, useTransition } from "react";
import { updateMatchAction } from "@/app/(app)/matches/actions";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { getKickoffDateInputValue, getKickoffTimeInputValue } from "@/lib/date-utils";

type MatchEditFormProps = {
  matchId: string;
  startsAt: Date;
  matchRoundName: string;
  phaseStartDate: Date;
  phaseEndDate: Date;
};

export function MatchEditForm({
  matchId,
  startsAt,
  matchRoundName: _matchRoundName,
  phaseStartDate,
  phaseEndDate,
}: MatchEditFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateValue, setDateValue] = useState(getKickoffDateInputValue(startsAt));
  const [timeValue, setTimeValue] = useState(getKickoffTimeInputValue(startsAt));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    setSuccessMsg(null);
  }

  function handleSave() {
    setError(null);
    setSuccessMsg(null);

    if (!dateValue) {
      setError("Date is required.");
      return;
    }

    // Parse as local wall-clock time — the coach enters the time they see on
    // their watch, not UTC. No timezone conversion should occur.
    const [year, month, day] = dateValue.split("-").map(Number);
    const [hours, minutes] = timeValue.split(":").map(Number);
    const parsed = new Date(year, month - 1, day, hours ?? 0, minutes ?? 0, 0);
    if (isNaN(parsed.getTime())) {
      setError("Invalid date or time.");
      return;
    }
    // Send as ISO string — the server stores this as a local wall-clock value
    const isoString = parsed.toISOString();

    startTransition(async () => {
      const result = await updateMatchAction(matchId, isoString);
      if (result.success) {
        if (!result.movedRound) {
          setSuccessMsg("Match date updated.");
        } else if (result.createdRound) {
          setSuccessMsg(`Match rescheduled. New round ${result.targetRoundName} was created automatically.`);
        } else {
          setSuccessMsg(`Match rescheduled and moved to ${result.targetRoundName}.`);
        }
        setTimeout(() => {
          setIsOpen(false);
          setSuccessMsg(null);
        }, 3000);
      } else {
        setError(result.error);
      }
    });
  }

  function handleCancel() {
    setDateValue(getKickoffDateInputValue(startsAt));
    setTimeValue(getKickoffTimeInputValue(startsAt));
    setError(null);
    setSuccessMsg(null);
    setIsOpen(false);
  }

  return (
    <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4" role="form" aria-label="Edit match details">
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
            min={getKickoffDateInputValue(phaseStartDate)}
            max={getKickoffDateInputValue(phaseEndDate)}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-startsAt-time" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Kick-off time
          </label>
          <input
            id="edit-startsAt-time"
            type="time"
            value={timeValue}
            onChange={(e) => { setTimeValue(e.target.value); setError(null); setSuccessMsg(null); }}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">League season</span>
          <span className="text-sm text-[var(--text-soft)]">{phaseDateRange}</span>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          The match is placed in the correct weekly round automatically when the date changes.
        </p>

        {error && (
          <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2 text-xs text-red-200" role="alert">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200" role="status">
            <Check className="mr-1 inline h-3 w-3" aria-hidden="true" />
            {successMsg}
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