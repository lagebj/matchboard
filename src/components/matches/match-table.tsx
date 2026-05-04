"use client";

import { deleteMatchAction } from "@/app/matches/actions";
import Link from "next/link";

type MatchRow = {
  id: string;
  teamName: string;
  opponent: string;
  startsAt: Date;
  homeAway: string;
  matchType: string;
  gameFormat: string;
  matchRoundId: string;
  matchRoundName: string | null;
  matchRoundStatus: string | null;
};

function formatMatchType(type: string): string {
  const map: Record<string, string> = {
    LEAGUE: "League",
    FRIENDLY: "Friendly",
    CUP: "Cup",
    DEVELOPMENT: "Development",
  };
  return map[type] ?? type;
}

function formatGameFormat(format: string): string {
  const map: Record<string, string> = {
    SEVEN_A_SIDE: "7-a-side",
    NINE_A_SIDE: "9-a-side",
    ELEVEN_A_SIDE: "11-a-side",
  };
  return map[format] ?? format;
}

function formatVenue(venue: string): string {
  return venue === "HOME" ? "Home" : "Away";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("default", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(status: string | null): string {
  if (!status) return "—";
  const map: Record<string, string> = {
    NOT_GENERATED: "Not generated",
    DRAFT: "Draft",
    BLOCKED: "Blocked",
    READY: "Ready",
    FINALIZED: "Finalized",
  };
  return map[status] ?? status;
}

function statusColor(status: string | null): string {
  if (!status || status === "NOT_GENERATED") return "text-[var(--text-muted)]";
  if (status === "DRAFT") return "text-amber-300";
  if (status === "BLOCKED") return "text-red-400";
  if (status === "READY") return "text-emerald-400";
  if (status === "FINALIZED") return "text-zinc-100";
  return "text-zinc-100";
}

export function MatchTable({ matches }: { matches: MatchRow[] }) {
  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
        No matches yet.{" "}
        <Link href="/matches/new" className="underline text-[var(--accent-strong)]">
          Create a match
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[1.4rem] border app-hairline bg-[rgba(12,15,20,0.45)]">
      <table className="w-full text-left text-sm border-collapse">
        <thead className="border-b app-hairline bg-[rgba(255,255,255,0.04)] text-xs uppercase tracking-wide app-copy-muted">
          <tr>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Date</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Team</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Opponent</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Venue</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Type</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Format</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Round</th>
            <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Status</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr
              key={m.id}
              className="group border-b border-[var(--border-soft)] transition-colors hover:bg-[rgba(255,255,255,0.03)]"
            >
              <td className="px-3 py-2.5">
                <Link href={`/matches/${m.id}`} className="text-zinc-100 hover:underline">
                  {formatDate(m.startsAt)}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-zinc-100">{m.teamName}</td>
              <td className="px-3 py-2.5">
                <Link href={`/matches/${m.id}`} className="text-zinc-100 hover:underline">
                  {m.opponent}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-zinc-100">{formatVenue(m.homeAway)}</td>
              <td className="px-3 py-2.5 text-zinc-100">{formatMatchType(m.matchType)}</td>
              <td className="px-3 py-2.5 text-zinc-100">{formatGameFormat(m.gameFormat)}</td>
              <td className="px-3 py-2.5 text-zinc-100">
                {m.matchRoundName ? (
                  <Link href={`/rounds/${m.matchRoundId}`} className="text-[var(--accent-strong)] hover:underline">
                    {m.matchRoundName}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className={`px-3 py-2.5 ${statusColor(m.matchRoundStatus)}`}>
                {formatStatus(m.matchRoundStatus)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex border-t app-hairline px-3 py-2.5">
        <Link
          href="/matches/new"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-strong)] hover:underline"
        >
          <span className="text-sm leading-none">+</span> Create match
        </Link>
      </div>
    </div>
  );
}