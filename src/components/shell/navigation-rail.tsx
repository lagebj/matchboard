"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  CalendarRange,
  CalendarDays,
  Users,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { MatchboardLogo } from "@/components/shell/matchboard-logo";
import { isNavItemActive } from "@/components/shell/nav-active";

type NavItem = {
  href: string;
  labelKey: "today" | "league" | "events" | "players" | "more";
  icon: LucideIcon;
};

function navItems(orgSlug: string): NavItem[] {
  return [
    { href: `/o/${orgSlug}/today`, labelKey: "today", icon: CalendarClock },
    { href: `/o/${orgSlug}/fixtures`, labelKey: "league", icon: CalendarRange },
    { href: `/o/${orgSlug}/events`, labelKey: "events", icon: CalendarDays },
    { href: `/o/${orgSlug}/players`, labelKey: "players", icon: Users },
    { href: `/o/${orgSlug}/more`, labelKey: "more", icon: MoreHorizontal },
  ];
}

/**
 * NavigationRail — Medium-tier (600–839px) nav: icon + short label, narrower
 * than SidebarNav's full 14rem width. Same 5 primary destinations as
 * SidebarNav/MobileNav, same active-state logic (isNavItemActive).
 */
export function NavigationRail({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const items = navItems(orgSlug);

  return (
    <nav
      aria-label="Primary"
      className="flex h-full flex-col items-center bg-[rgba(8,11,18,0.98)]"
    >
      <div className="flex items-center justify-center pt-5 pb-4">
        <MatchboardLogo className="h-7 w-7 text-[var(--accent-strong)]" ariaHidden />
      </div>

      <ul className="flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto px-1.5 pt-1" role="list">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="w-full">
              <Link
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-center transition-colors",
                  active
                    ? "bg-[var(--accent-subtle)] text-zinc-50 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2.5px] before:rounded-r before:bg-[var(--accent-strong)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/40 hover:text-zinc-100",
                ].join(" ")}
                href={item.href}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-[var(--accent-strong)]" : "text-[var(--text-muted)]"}`}
                  aria-hidden="true"
                />
                <span className="w-full truncate text-[9px] font-semibold uppercase tracking-[0.08em]">
                  {t(item.labelKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
