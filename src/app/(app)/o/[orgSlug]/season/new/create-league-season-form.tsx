"use client";

import { useActionState } from "react";
import { TouchlineButton } from "@/components/touchline";
import { DecisionBanner } from "@/components/ui/decision-banner";

type Group = { id: string; name: string };

type CreateLeagueSeasonFormProps = {
  action: (prevState: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  groups: Group[];
  orgSlug: string;
};

const currentYear = new Date().getFullYear();
const NEXT_YEAR = currentYear + 1;

export function CreateLeagueSeasonForm({ action, groups, orgSlug }: CreateLeagueSeasonFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <DecisionBanner variant="blocked" title={state.error} />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="year" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Year
          </label>
          <select
            id="year"
            name="year"
            required
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value={currentYear}>{currentYear}</option>
            <option value={NEXT_YEAR}>{NEXT_YEAR}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="part" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Part
          </label>
          <select
            id="part"
            name="part"
            required
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="SPRING">Spring (Jan–Jun)</option>
            <option value="FALL">Autumn (Jul–Dec)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Name (optional)
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          placeholder="Auto-generated from year and part if left blank"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Match format
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="numberOfPeriods" className="text-xs text-[var(--text-muted)]">
              Number of periods
            </label>
            <select
              id="numberOfPeriods"
              name="numberOfPeriods"
              required
              defaultValue="2"
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="1">1 (single period)</option>
              <option value="2">2 (halves)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="periodDurationMinutes" className="text-xs text-[var(--text-muted)]">
              Period length (min)
            </label>
            <input
              id="periodDurationMinutes"
              name="periodDurationMinutes"
              type="number"
              min={1}
              max={120}
              required
              defaultValue={25}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="breakDurationMinutes" className="text-xs text-[var(--text-muted)]">
              Break length (min)
            </label>
            <input
              id="breakDurationMinutes"
              name="breakDurationMinutes"
              type="number"
              min={0}
              max={60}
              required
              defaultValue={10}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]">
          This is the intended structure used for warnings and timing during live reporting — teams and individual
          matches can override it later. A period does not end automatically at this length.
        </p>
      </div>

      {groups.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="footballGroupId" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Group
          </label>
          <select
            id="footballGroupId"
            name="footballGroupId"
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">Default group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <TouchlineButton variant="primary" size="md" type="submit" disabled={isPending}>
          Create league season
        </TouchlineButton>
        <TouchlineButton variant="ghost" size="md" as="a" href={`/o/${orgSlug}/season`}>
          Cancel
        </TouchlineButton>
      </div>
    </form>
  );
}