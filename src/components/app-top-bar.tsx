"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useDeferredValue } from "react";

type ContextData = {
  season: { id: string; name: string } | null;
  planningPeriod: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    startDateLabel: string;
    endDateLabel: string;
  } | null;
  matchRound: { id: string; name: string; status: string } | null;
};

type SearchResult = {
  players: { id: string; name: string; coreTeamName: string }[];
  teams: { id: string; name: string }[];
};

const pageTitles: Record<string, { label: string; note: string }> = {
  "/": { label: "Manager Desk", note: "Decision inbox & assistant advice" },
  "/matches": { label: "Round Board", note: "Team columns and role buckets" },
  "/assistant": { label: "Assistant Manager", note: "Structured review room" },
  "/planner": { label: "Squad Planner", note: "Player usage across rounds" },
  "/players": { label: "Players", note: "Registry, availability, and profiles" },
  "/teams": { label: "Teams", note: "Health, config, and paths" },
  "/availability": { label: "Availability", note: "Command center" },
  "/tactics": { label: "Tactics Board", note: "Pitch layout" },
  "/rules": { label: "Rule Studio", note: "Validate and configure rules" },
  "/history": { label: "History", note: "Rotation story over time" },
};

function getPageInfo(pathname: string) {
  if (pathname.startsWith("/selection/")) {
    return { label: "Match Room", note: "Selection workspace" };
  }
  if (pathname.startsWith("/tactics/") && pathname !== "/tactics") {
    return { label: "Tactics Board", note: "Pitch view" };
  }
  if (pathname.startsWith("/players/") && pathname !== "/players") {
    return { label: "Player Profile", note: "Dossier" };
  }
  if (pathname.startsWith("/weeks/")) {
    return { label: "Week Board", note: "Weekly overview" };
  }
  return pageTitles[pathname] ?? { label: "Matchboard", note: "" };
}

function StatusBadge({ status }: { status: string }) {
  const isFinalized = status === "FINALIZED";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
        isFinalized
          ? "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]"
          : "border-[rgba(208,176,127,0.3)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"
      }`}
    >
      {status}
    </span>
  );
}

export function AppTopBar() {
  const pathname = usePathname();
  const info = getPageInfo(pathname);
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery);
  const searchSeqRef = useRef(0);

  useEffect(() => {
    fetch("/api/context")
      .then((r) => r.json())
      .then(setCtx)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (deferredQuery.trim().length < 2) return;
    const seq = ++searchSeqRef.current;
    fetch(`/api/context?q=${encodeURIComponent(deferredQuery.trim())}`)
      .then((r) => r.json())
      .then((data) => { if (seq === searchSeqRef.current) setSearchResults(data); })
      .catch(() => { if (seq === searchSeqRef.current) setSearchResults(null); });
  }, [deferredQuery]);

  const visibleResults = deferredQuery.trim().length < 2 ? null : searchResults;

  return (
    <div className="mx-auto flex w-full max-w-[96rem] items-center justify-between px-6 py-3 sm:px-10">
      <div className="flex items-center gap-4">
        <p className="text-lg font-semibold tracking-[-0.02em] text-zinc-50">{info.label}</p>
        <span className="hidden rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] app-copy-muted sm:inline-block">
          {info.note}
        </span>
        {ctx && (
          <div className="ml-2 hidden items-center gap-2 lg:flex">
            {ctx.season && (
              <span className="text-xs app-copy-muted">{ctx.season.name}</span>
            )}
            {ctx.planningPeriod && (
              <>
                <span className="text-xs app-copy-muted">·</span>
                <span className="text-xs app-copy-muted">
                  {ctx.planningPeriod.name} ({ctx.planningPeriod.startDateLabel} – {ctx.planningPeriod.endDateLabel})
                </span>
              </>
            )}
            {ctx.matchRound && (
              <>
                <span className="text-xs app-copy-muted">·</span>
                <span className="flex items-center gap-1.5 text-xs app-copy-muted">
                  {ctx.matchRound.name}
                  <StatusBadge status={ctx.matchRound.status} />
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!searchOpen) setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            className="h-9 w-36 rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-3 pl-3 text-sm app-copy-soft placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[rgba(140,167,146,0.4)] sm:w-48"
          />
          {searchOpen && visibleResults && (visibleResults.players.length > 0 || visibleResults.teams.length > 0) && (
            <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border app-hairline bg-[rgba(10,13,19,0.96)] p-2 shadow-xl backdrop-blur-2xl">
              {visibleResults.players.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] app-copy-muted">Players</p>
                  {visibleResults.players.map((p) => (
                    <Link
                      key={p.id}
                      href={`/players/${p.id}`}
                      className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-[rgba(255,255,255,0.06)]"
                    >
                      {p.name} <span className="app-copy-muted">· {p.coreTeamName}</span>
                    </Link>
                  ))}
                </div>
              )}
              {visibleResults.teams.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] app-copy-muted">Teams</p>
                  {visibleResults.teams.map((t) => (
                    <Link
                      key={t.id}
                      href={`/teams/${t.id}`}
                      className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-[rgba(255,255,255,0.06)]"
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <Link
          className="inline-flex h-9 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
          href="/"
        >
          Desk
        </Link>
      </div>
    </div>
  );
}