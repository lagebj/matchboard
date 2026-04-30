"use client";

import { useState } from "react";
import Link from "next/link";

type RoundListItem = {
  id: string;
  name: string;
  weekLabel: string;
  matchCount: number;
  teamNames: string[];
  derivedStatus: "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED";
};

type FilterState = "all" | "needs_action" | "draft" | "ready" | "finalized";

type RoundListClientProps = {
  rounds: RoundListItem[];
};

const filterConfig: Array<{ key: FilterState; label: string }> = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs action" },
  { key: "draft", label: "Draft" },
  { key: "ready", label: "Ready" },
  { key: "finalized", label: "Finalized" },
];

function filterRounds(rounds: RoundListItem[], filter: FilterState): RoundListItem[] {
  switch (filter) {
    case "needs_action":
      return rounds.filter((r) => r.derivedStatus === "NOT_GENERATED" || r.derivedStatus === "BLOCKED");
    case "draft":
      return rounds.filter((r) => r.derivedStatus === "DRAFT");
    case "ready":
      return rounds.filter((r) => r.derivedStatus === "READY");
    case "finalized":
      return rounds.filter((r) => r.derivedStatus === "FINALIZED");
    default:
      return rounds;
  }
}

const statusConfig: Record<RoundListItem["derivedStatus"], { label: string; border: string; bg: string; text: string }> = {
  NOT_GENERATED: { label: "Not generated", border: "border-zinc-600/40", bg: "bg-zinc-800/30", text: "text-zinc-400" },
  DRAFT: { label: "Draft", border: "border-amber-700/40", bg: "bg-amber-900/20", text: "text-amber-300" },
  BLOCKED: { label: "Blocked", border: "border-red-700/40", bg: "bg-red-900/20", text: "text-red-300" },
  READY: { label: "Ready", border: "border-emerald-700/40", bg: "bg-emerald-900/20", text: "text-emerald-300" },
  FINALIZED: { label: "Finalized", border: "border-[rgba(140,167,146,0.28)]", bg: "bg-[rgba(140,167,146,0.12)]", text: "text-[var(--accent-strong)]" },
};

export function RoundListClient({ rounds }: RoundListClientProps) {
  const [filter, setFilter] = useState<FilterState>("all");
  const filtered = filterRounds(rounds, filter);

  return (
    <>
      <div className="flex items-center gap-2 mt-4">
        {filterConfig.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border border-[var(--accent)]/30"
                : "text-[var(--text-muted)] hover:text-zinc-50 hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
          {filter === "all"
            ? "No match rounds yet. Create matches to start."
            : `No ${filter === "needs_action" ? "blocked or ungenerated" : filter} rounds.`}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {filtered.map((round) => {
            const config = statusConfig[round.derivedStatus];
            return (
              <Link
                key={round.id}
                className={`rounded-[1.5rem] border p-4 hover:bg-[rgba(255,255,255,0.03)] transition-colors ${config.border}`}
                style={round.derivedStatus === "FINALIZED"
                  ? { borderColor: "rgba(140,167,146,0.26)", background: "linear-gradient(180deg,rgba(140,167,146,0.08),rgba(17,22,31,0.82))" }
                  : undefined}
                href={`/rounds/${round.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-zinc-50">{round.weekLabel}</p>
                    <p className="mt-1 text-sm app-copy-soft">
                      {round.matchCount} match{round.matchCount !== 1 ? "es" : ""}
                    </p>
                    <p className="mt-2 text-xs app-copy-muted">
                      {round.teamNames.join(" · ")}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${config.border} ${config.bg} ${config.text}`}>
                    {config.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}