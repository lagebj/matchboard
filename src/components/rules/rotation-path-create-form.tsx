"use client";

import { useActionState } from "react";
import { TouchlineButton } from "@/components/touchline";
import { createRotationPathAction } from "@/app/(app)/rules/actions";

type TeamOption = {
  id: string;
  name: string;
};

const ROLE_OPTIONS = [
  { value: "SUPPORT", label: "Support" },
  { value: "DEVELOPMENT", label: "Development" },
  { value: "BACKFILL", label: "Squad repair" },
] as const;

export function RotationPathCreateForm({
  teams,
  defaultToTeamId,
}: {
  teams: TeamOption[];
  defaultToTeamId?: string;
}) {
  const [state, formAction, isPending] = useActionState(createRotationPathAction, { error: "" });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <div className="rounded-[var(--tl-c-radius-object)] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </div>
      )}

      <input name="redirectTeamId" type="hidden" defaultValue={defaultToTeamId ?? ""} />

      <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
        From team (source)
        <select
          name="fromTeamId"
          required
          className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
          disabled={isPending}
        >
          <option value="">Select source team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
        To team (target)
        <select
          name="toTeamId"
          required
          defaultValue={defaultToTeamId ?? ""}
          className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
          disabled={isPending}
        >
          <option value="">Select target team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
        Role
        <select
          name="role"
          required
          defaultValue="SUPPORT"
          className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
          disabled={isPending}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-sm font-normal app-copy-soft">Each path authorizes exactly one role. SUPPORT paths permit only support movement, DEVELOPMENT only development, BACKFILL only squad repair.</span>
      </label>

      <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
        Purpose
        <input
          name="purpose"
          type="text"
          placeholder="Why this path exists"
          className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
          disabled={isPending}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
          Priority
          <input
            name="priority"
            type="number"
            min={0}
            placeholder="Lower = higher priority"
            className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
          <span className="text-sm font-normal app-copy-soft">Lower number = resolved first</span>
        </label>

        <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
          Cooldown rounds
          <input
            name="cooldownRounds"
            type="number"
            min={0}
            placeholder="Optional"
            className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
          Min count
          <input
            name="minimumCount"
            type="number"
            min={0}
            placeholder="Optional"
            className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
          Target count
          <input
            name="targetCount"
            type="number"
            min={0}
            placeholder="Optional"
            className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
          Max count
          <input
            name="maximumCount"
            type="number"
            min={0}
            placeholder="Optional"
            className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
        </label>
      </div>

      <div className="flex">
        <TouchlineButton type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Creating..." : "Create rotation path"}
        </TouchlineButton>
      </div>
    </form>
  );
}