"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
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
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="SPRING">Spring (Jan–Jun)</option>
            <option value="FALL">Fall (Jul–Dec)</option>
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
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
          placeholder="Auto-generated from year and part if left blank"
        />
      </div>

      {groups.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="footballGroupId" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Group
          </label>
          <select
            id="footballGroupId"
            name="footballGroupId"
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">Default group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="primary" size="md" type="submit" disabled={isPending}>
          Create league season
        </Button>
        <Button variant="ghost" size="md" as="a" href={`/o/${orgSlug}/season`}>
          Cancel
        </Button>
      </div>
    </form>
  );
}