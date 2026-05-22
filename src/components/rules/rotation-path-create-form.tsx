"use client";

import { useActionState } from "react";
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
        <div className="rounded-2xl border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-4 py-3 text-sm text-[#f0cbc5]">
          {state.error}
        </div>
      )}

      <input name="redirectTeamId" type="hidden" defaultValue={defaultToTeamId ?? ""} />

      <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
        From team (source)
        <select
          name="fromTeamId"
          required
          className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
          disabled={isPending}
        >
          <option value="">Select source team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
        To team (target)
        <select
          name="toTeamId"
          required
          defaultValue={defaultToTeamId ?? ""}
          className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
          disabled={isPending}
        >
          <option value="">Select target team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
        Role
        <select
          name="role"
          required
          defaultValue="SUPPORT"
          className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
          disabled={isPending}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-sm font-normal app-copy-soft">Each path authorizes exactly one role. SUPPORT paths permit only support movement, DEVELOPMENT only development, BACKFILL only squad repair.</span>
      </label>

      <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
        Purpose
        <input
          name="purpose"
          type="text"
          placeholder="Why this path exists"
          className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
          disabled={isPending}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
          Priority
          <input
            name="priority"
            type="number"
            min={0}
            placeholder="Lower = higher priority"
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
          <span className="text-sm font-normal app-copy-soft">Lower number = resolved first</span>
        </label>

        <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
          Cooldown rounds
          <input
            name="cooldownRounds"
            type="number"
            min={0}
            placeholder="Optional"
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
          Min count
          <input
            name="minimumCount"
            type="number"
            min={0}
            placeholder="Optional"
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
          Target count
          <input
            name="targetCount"
            type="number"
            min={0}
            placeholder="Optional"
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
          Max count
          <input
            name="maximumCount"
            type="number"
            min={0}
            placeholder="Optional"
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
        </label>
      </div>

      <div className="flex">
        <button
          className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Creating..." : "Create rotation path"}
        </button>
      </div>
    </form>
  );
}