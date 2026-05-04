"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useDeferredValue, useCallback } from "react";
import {
  CalendarRange,
  CheckCircle2,
  OctagonAlert,
  Play,
  Search,
  History,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { deriveRoundStatus as deriveRoundStatusUtil, type RoundStatus } from "@/lib/round-status";

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
  matchRound: { id: string; name: string; status: string; hasDraftSelections: boolean; hasMatches: boolean; blockingWarningCount: number } | null;
  warnings?: { blocking: number; high: number; medium: number; info: number } | null;
};

type SearchResult = {
  players: { id: string; name: string; coreTeamName: string }[];
  teams: { id: string; name: string }[];
};

const pageTitles: Record<string, { label: string; note: string }> = {
  "/": { label: "Today", note: "Review the active round, blockers, and the next safe action." },
  "/rounds": { label: "Rounds", note: "Generate, review, and finalize squads per match round." },
  "/players": { label: "Players", note: "Availability, load, and movement history." },
  "/teams": { label: "Teams", note: "Core groups, support needs, and movement paths." },
  "/rules": { label: "Rules", note: "Selection rules, support priority, and squad repair behavior." },
  "/history": { label: "History", note: "Finalized rounds, movement, and fairness over time." },
};

function getPageInfo(pathname: string) {
  if (pathname.startsWith("/rounds/") && pathname !== "/rounds") {
    return { label: "Round", note: "Match round workbench" };
  }
  if (pathname.startsWith("/players/") && pathname !== "/players") {
    return { label: "Player profile", note: "Availability, load, and movement history." };
  }
  return pageTitles[pathname] ?? { label: "Matchboard", note: "Squad planning" };
}

type PrimaryAction = {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant: "primary" | "success" | "warning" | "default";
};

export function TopContextBar() {
  const pathname = usePathname();
  const router = useRouter();
  const info = getPageInfo(pathname);
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
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
  const roundStatus: RoundStatus = deriveRoundStatusUtil({
    dbStatus: ctx?.matchRound?.status ?? null,
    hasDraftSelections: ctx?.matchRound?.hasDraftSelections ?? false,
    hasMatches: ctx?.matchRound?.hasMatches ?? false,
    blockingWarningCount: ctx?.matchRound?.blockingWarningCount ?? 0,
  });

  const matchRoundId = ctx?.matchRound?.id;
  const handleGenerateRound = useCallback(async () => {
    if (!matchRoundId || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: matchRoundId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorMsg = data?.error ?? "Generation failed.";
        router.push(`/rounds/${matchRoundId}?error=${encodeURIComponent(errorMsg)}`);
        return;
      }
      router.push(`/rounds/${matchRoundId}?generated=1`);
    } catch {
      router.push(`/rounds/${matchRoundId}?error=${encodeURIComponent("Network error during generation.")}`);
    } finally {
      setGenerating(false);
    }
  }, [matchRoundId, generating, router]);

  function getPrimaryAction(): PrimaryAction | null {
    if (!ctx?.matchRound) {
      return {
        label: "Select round",
        icon: CalendarRange,
        href: "/rounds",
        variant: "default",
      };
    }
    if (!roundStatus || roundStatus === "NOT_GENERATED") {
      return {
        label: generating ? "Generating…" : "Generate squads",
        icon: Play,
        onClick: handleGenerateRound,
        disabled: generating,
        variant: "primary",
      };
    }
    if (roundStatus === "BLOCKED") {
      return {
        label: "Review blockers",
        icon: OctagonAlert,
        href: `/rounds/${ctx.matchRound.id}#warnings`,
        variant: "warning",
      };
    }
    if (roundStatus === "DRAFT") {
      return {
        label: "Finalize round",
        icon: CheckCircle2,
        href: `/rounds/${ctx.matchRound.id}`,
        variant: "success",
      };
    }
    if (roundStatus === "READY") {
      return {
        label: "Finalize round",
        icon: CheckCircle2,
        href: `/rounds/${ctx.matchRound.id}`,
        variant: "success",
      };
    }
    if (roundStatus === "FINALIZED") {
      return {
        label: "View history",
        icon: History,
        href: "/history",
        variant: "default",
      };
    }
    return null;
  }

  const primaryAction = getPrimaryAction();

  function getButtonClasses(variant: PrimaryAction["variant"]) {
    switch (variant) {
      case "primary":
        return "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border-[var(--accent)]/30 hover:bg-[var(--accent)]/20";
      case "success":
        return "bg-emerald-900/40 text-emerald-300 border-emerald-700/40 hover:bg-emerald-900/60";
      case "warning":
        return "bg-amber-900/40 text-amber-300 border-amber-700/40 hover:bg-amber-900/60";
      default:
        return "bg-zinc-800/50 text-zinc-300 border-zinc-600/40 hover:bg-zinc-700/50";
    }
  }

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
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  {ctx.matchRound.name}
                  {roundStatus && <StatusBadge status={roundStatus} />}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {primaryAction && (
          primaryAction.onClick ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getButtonClasses(primaryAction.variant)}`}
            >
              <primaryAction.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {primaryAction.label}
            </button>
          ) : (
            <Link
              href={primaryAction.href ?? "#"}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold border transition-colors ${getButtonClasses(primaryAction.variant)}`}
            >
              <primaryAction.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {primaryAction.label}
            </Link>
          )
        )}
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