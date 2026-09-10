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

/**
 * TopContextBar — the quiet desktop context strip (bundle
 * `05_NAVIGATION_MATERIALS_AND_SHELL.md §5`). Leads with the current
 * group/season context; search / help / account stay visually secondary. On a
 * list page the page title lives in the page header, so the bar shows only the
 * context; on a detail page (Round Board / Team / …) the short type label is
 * kept as orientation.
 */
export function TopContextBar() {
  const t = useTranslations("PageTitles");
  const pathname = usePathname();
  const orgSlug = useOrgSlug();
  const titleKey = getPageTitleKey(pathname);
  const title = titleKey === "default" ? null : t(titleKey);
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
      <div className="flex h-[50px] items-center gap-3 px-4 medium:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-[var(--text-muted)]">
          {title ? (
            <span className="shrink-0 font-medium text-[var(--foreground)]">{title}</span>
          ) : null}
          {ctx?.leagueSeason ? (
            <span className="truncate">
              {ctx.leagueSeason.seasonLabel} · {ctx.leagueSeason.combinedLabel}
            </span>
          ) : null}
          {ctx?.matchRound ? (
            <>
              <span aria-hidden="true" className="text-[var(--border-strong)]">·</span>
              <Link
                href={`/o/${orgSlug}/rounds/${ctx.matchRound.id}`}
                className="shrink-0 text-[var(--accent)] no-underline hover:underline"
              >
                {ctx.matchRound.name}
              </Link>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <HelpButton onClick={() => setHelpOpen(true)} />
          <CommandPaletteTrigger onClick={() => setPaletteOpen(true)} />
        </div>
      </div>
    </>
  );
}
