"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CommandPalette, CommandPaletteTrigger } from "@/components/shell/command-palette";

type ContextData = {
  season: { id: string; name: string } | null;
  leagueSeason: {
    id: string;
    name: string;
    leagueSeasonLabel: string;
    seasonLabel: string;
    combinedLabel: string;
    dateRangeLabel: string;
    startDate: string;
    endDate: string;
  } | null;
  matchRound: { id: string; name: string; status: string } | null;
};

const pageTitles: Record<string, string> = {
  "/assistant": "Assistant",
  "/fixtures": "Fixtures",
  "/events": "Events",
  "/players": "Players",
  "/teams": "Teams",
  "/opponents": "Opponents",
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
  if (pathname.startsWith("/events/new")) return "New Event";
  if (pathname.startsWith("/events/") && pathname !== "/events") return "Event";
  return pageTitles[pathname] ?? "Matchboard";
}

export function TopContextBar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    fetch("/api/context")
      .then((r) => r.json())
      .then(setCtx)
      .catch(() => {});
  }, []);

  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <div className="flex h-[var(--topbar-height)] items-center gap-4 px-4">
        <div className="flex items-baseline gap-3 min-w-0 flex-1">
          <span className="text-sm font-semibold text-zinc-50 shrink-0">{title}</span>
          {ctx && (
            <div className="hidden items-center gap-2 text-xs text-[var(--text-muted)] min-w-0 lg:flex">
              {ctx.leagueSeason && (
                <span className="truncate">
                  {ctx.leagueSeason.seasonLabel} · {ctx.leagueSeason.combinedLabel}
                </span>
              )}
              {ctx.matchRound && (
                <>
                  <span aria-hidden="true" className="text-[var(--border-strong)]">·</span>
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

        <CommandPaletteTrigger onClick={() => setPaletteOpen(true)} />
      </div>
    </>
  );
}