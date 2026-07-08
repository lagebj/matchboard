"use client";

import { useRouter, useSearchParams } from "next/navigation";

type PeriodSelectorProps = {
  leagueSeasons: Array<{ id: string; label: string }>;
  selectedPeriodId: string;
};

export function TeamPeriodSelector({ leagueSeasons, selectedPeriodId }: PeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">League season:</span>
      <select
        value={selectedPeriodId}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("periodId", e.target.value);
          router.push(`/teams?${params.toString()}`);
        }}
        className="h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 text-xs text-zinc-300 outline-none focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)] max-w-[180px] sm:max-w-none"
      >
        {leagueSeasons.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
    </label>
  );
}