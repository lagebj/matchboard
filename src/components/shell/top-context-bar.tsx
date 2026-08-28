"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CommandPalette, CommandPaletteTrigger } from "@/components/shell/command-palette";
import { HelpDrawer, HelpButton } from "@/components/shell/help-drawer";
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

type PageTitleKey =
  | "roundBoard"
  | "team"
  | "player"
  | "match"
  | "opponent"
  | "newEvent"
  | "event"
  | "default";

function getPageTitleKey(pathname: string): PageTitleKey {
  if (pathname.includes("/rounds/") && !pathname.endsWith("/rounds")) return "roundBoard";
  if (pathname.includes("/teams/") && !pathname.endsWith("/teams")) return "team";
  if (pathname.includes("/players/") && !pathname.endsWith("/players")) return "player";
  if (pathname.includes("/matches/") && !pathname.endsWith("/matches")) return "match";
  if (pathname.includes("/opponents/") && !pathname.endsWith("/opponents")) return "opponent";
  if (pathname.includes("/events/new")) return "newEvent";
  if (pathname.includes("/events/") && !pathname.endsWith("/events")) return "event";
  return "default";
}

export function TopContextBar() {
  const t = useTranslations("PageTitles");
  const pathname = usePathname();
  const orgSlug = useOrgSlug();
  const title = t(getPageTitleKey(pathname));
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    fetch("/api/context")
      .then((r) => r.json())
      .then(setCtx)
      .catch(() => {});
  }, []);

  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <HelpDrawer isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
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

        <HelpButton onClick={() => setHelpOpen(true)} />
        <CommandPaletteTrigger onClick={() => setPaletteOpen(true)} />
      </div>
    </>
  );
}