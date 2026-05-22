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
  "/assistant": { label: "Assistant", note: "Next action, blockers, and upcoming work." },
  "/fixtures": { label: "Fixtures", note: "Planning period, rounds, and match hierarchy." },
  "/players": { label: "Players", note: "Availability, load, and movement history." },
  "/teams": { label: "Teams", note: "Core groups, support needs, and movement paths." },
  "/rules": { label: "Rules", note: "Selection rules, support priority, and rotation paths." },
  "/history": { label: "History", note: "Finalized rounds, movement, and fairness over time." },
  "/season": { label: "Season", note: "Player-by-round matrix, movement, and fairness." },
};

function getPageInfo(pathname: string) {
  if (pathname.startsWith("/rounds/") && pathname !== "/rounds") {
    return { label: "Round Board", note: "Squad planning and match decisions." };
  }
  if (pathname.startsWith("/teams/") && pathname !== "/teams") {
    return { label: "Team detail", note: "Core group, support, movement, and warnings." };
  }
  if (pathname.startsWith("/players/") && pathname !== "/players") {
    return { label: "Player profile", note: "Availability, load, and movement history." };
  }
  if (pathname.startsWith("/matches/") && pathname !== "/matches") {
    return { label: "Match detail", note: "Match preparation and reporting." };
  }
  if (pathname.startsWith("/opponents/") && pathname !== "/opponents") {
    return { label: "Opponent history", note: "Encounter observations and history." };
  }
  return pageTitles[pathname] ?? { label: "Matchboard", note: "Squad planning." };
}

export function TopContextBar() {
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
      .then((data) => {
        if (seq === searchSeqRef.current) setSearchResults(data);
      })
      .catch(() => {
        if (seq === searchSeqRef.current) setSearchResults(null);
      });
  }, [deferredQuery]);

  const visibleResults = deferredQuery.trim().length < 2 ? null : searchResults;

  return (
    <header className="flex h-[var(--topbar-height)] items-center border-b border-[var(--border-soft)] bg-[var(--surface-base)] px-4 backdrop-blur-sm">
      <div className="flex flex-1 items-center gap-3">
        <p className="text-sm font-semibold text-zinc-50">{info.label}</p>
        {info.note && (
          <span className="hidden rounded-full border border-[var(--border-soft)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] sm:inline-block">
            {info.note}
          </span>
        )}
        {ctx && (
          <div className="ml-1 hidden items-center gap-2 lg:flex">
            {ctx.season && (
              <span className="text-xs text-[var(--text-muted)]">{ctx.season.name}</span>
            )}
            {ctx.planningPeriod && (
              <>
                <span className="text-xs text-[var(--text-muted)]">·</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {ctx.planningPeriod.name}
                </span>
              </>
            )}
            {ctx.matchRound && (
              <>
                <span className="text-xs text-[var(--text-muted)]">·</span>
                <Link
                  href={`/rounds/${ctx.matchRound.id}`}
                  className="text-xs text-[var(--accent-strong)] hover:underline"
                >
                  {ctx.matchRound.name}
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            aria-label="Search players and teams"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!searchOpen) setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            className="h-8 w-32 rounded-lg border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] pl-8 pr-3 text-xs text-[var(--text-soft)] placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40 sm:w-44"
          />
          {searchOpen && visibleResults && (visibleResults.players.length > 0 || visibleResults.teams.length > 0) && (
            <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-[var(--border-soft)] bg-[rgba(10,13,19,0.97)] p-1.5 shadow-xl backdrop-blur-2xl">
              {visibleResults.players.length > 0 && (
                <div>
                  <p className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Players</p>
                  {visibleResults.players.map((p) => (
                    <Link
                      key={p.id}
                      href={`/players/${p.id}`}
                      className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-100 hover:bg-[rgba(255,255,255,0.06)]"
                    >
                      {p.name} <span className="text-[var(--text-muted)]">· {p.coreTeamName}</span>
                    </Link>
                  ))}
                </div>
              )}
              {visibleResults.teams.length > 0 && (
                <div>
                  <p className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Teams</p>
                  {visibleResults.teams.map((t) => (
                    <Link
                      key={t.id}
                      href={`/teams/${t.id}`}
                      className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-100 hover:bg-[rgba(255,255,255,0.06)]"
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
    </header>
  );
}