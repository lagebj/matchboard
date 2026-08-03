"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CommandPalette, CommandPaletteTrigger } from "@/components/shell/command-palette";
import { useOrgSlug } from "@/components/shell/org-slug-context";

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

function getPageTitle(pathname: string): string {
  if (pathname.includes("/rounds/") && !pathname.endsWith("/rounds")) return "Round Board";
  if (pathname.includes("/teams/") && !pathname.endsWith("/teams")) return "Team";
  if (pathname.includes("/players/") && !pathname.endsWith("/players")) return "Player";
  if (pathname.includes("/matches/") && !pathname.endsWith("/matches")) return "Match";
  if (pathname.includes("/opponents/") && !pathname.endsWith("/opponents")) return "Opponent";
  if (pathname.includes("/events/new")) return "New Event";
  if (pathname.includes("/events/") && !pathname.endsWith("/events")) return "Event";
  return "Matchboard";
}

export function TopContextBar() {
  const pathname = usePathname();
  const orgSlug = useOrgSlug();
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
                    href={`/o/${orgSlug}/rounds/${ctx.matchRound.id}`}
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