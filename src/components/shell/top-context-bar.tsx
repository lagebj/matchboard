"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useDeferredValue } from "react";
import { Search } from "lucide-react";

type ContextData = {
  season: { id: string; name: string } | null;
  planningPeriod: {
    id: string;
    name: string;
    phaseLabel: string;
    seasonLabel: string;
    combinedLabel: string;
    dateRangeLabel: string;
    startDate: string;
    endDate: string;
  } | null;
  matchRound: { id: string; name: string; status: string } | null;
};

type SearchResult = {
  players: { id: string; name: string; coreTeamName: string }[];
  teams: { id: string; name: string }[];
};

const pageTitles: Record<string, string> = {
  "/assistant": "Assistant",
  "/fixtures": "Fixtures",
  "/players": "Players",
  "/teams": "Teams",
  "/rules": "Rules",
  "/history": "History",
  "/season": "Season",
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/rounds/") && pathname !== "/rounds") return "Round Board";
  if (pathname.startsWith("/teams/") && pathname !== "/teams") return "Team";
  if (pathname.startsWith("/players/") && pathname !== "/players") return "Player";
  if (pathname.startsWith("/matches/") && pathname !== "/matches") return "Match";
  if (pathname.startsWith("/opponents/") && pathname !== "/opponents") return "Opponent";
  return pageTitles[pathname] ?? "Matchboard";
}

/**
 * TopContextBar — per ADR 0007 the top bar is a quiet command/context bar.
 *
 * - Left: current page label.
 * - Middle: season + phase + current week context (quiet, never louder than the title).
 * - Right: search.
 *
 * Per AGENTS.md the page title must not be presented as "Dashboard" for
 * /assistant. Page content owns its own H1; the top bar provides surrounding
 * context only.
 */
export function TopContextBar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
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
      .then((data) => {
        if (seq === searchSeqRef.current) setSearchResults(data);
      })
      .catch(() => {
        if (seq === searchSeqRef.current) setSearchResults(null);
      });
  }, [deferredQuery]);

  const visibleResults = deferredQuery.trim().length < 2 ? null : searchResults;

  return (
    <div className="flex h-[var(--topbar-height)] items-center px-4 gap-4">
      <div className="flex items-baseline gap-3 min-w-0 flex-1">
        <span className="text-sm font-semibold text-zinc-50 shrink-0">{title}</span>
        {ctx && (
          <div className="hidden items-center gap-2 text-xs text-[var(--text-muted)] min-w-0 lg:flex">
            {ctx.planningPeriod && (
              <span className="truncate">
                {ctx.planningPeriod.seasonLabel} · {ctx.planningPeriod.combinedLabel}
              </span>
            )}
            {ctx.matchRound && (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  href={`/rounds/${ctx.matchRound.id}`}
                  className="text-[var(--accent-strong)] hover:underline shrink-0"
                >
                  {ctx.matchRound.name}
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative shrink-0">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <input
          type="text"
          aria-label="Search players and teams"
          placeholder="Search…"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!searchOpen) setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
          className="h-8 w-40 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 pl-7 pr-3 text-xs text-[var(--text-soft)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 sm:w-48"
        />
        {searchOpen &&
          visibleResults &&
          (visibleResults.players.length > 0 || visibleResults.teams.length > 0) && (
            <div className="absolute right-0 top-9 z-50 w-60 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] p-1.5 shadow-xl">
              {visibleResults.players.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Players
                  </p>
                  {visibleResults.players.map((p) => (
                    <Link
                      key={p.id}
                      href={`/players/${p.id}`}
                      className="block rounded-md px-2 py-1.5 text-xs font-medium text-zinc-100 hover:bg-[var(--surface-hover)]/60"
                    >
                      {p.name}{" "}
                      <span className="text-[var(--text-muted)]">
                        · {p.coreTeamName}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {visibleResults.teams.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Teams
                  </p>
                  {visibleResults.teams.map((t) => (
                    <Link
                      key={t.id}
                      href={`/teams/${t.id}`}
                      className="block rounded-md px-2 py-1.5 text-xs font-medium text-zinc-100 hover:bg-[var(--surface-hover)]/60"
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
