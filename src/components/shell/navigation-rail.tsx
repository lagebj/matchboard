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
import { cn } from "@/lib/cn";
import { TouchlineMark } from "@/components/touchline/brand/touchline-mark";
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
 * NavigationRail — medium-tier (600–839px) primary nav, Touchline visual system
 * (bundle `05_NAVIGATION_MATERIALS_AND_SHELL.md §3`). 72 px, quiet surface,
 * icon + short label, a 3 px accent rail marker on the active item. Not
 * floating over work content.
 */
export function NavigationRail({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const items = navItems(orgSlug);

  return (
    <nav
      aria-label="Primary"
      data-theme="dark"
      className="touchline flex h-full w-[72px] flex-col items-center border-r border-[var(--border-soft)] bg-[var(--tl-c-canvas)]"
    >
      <div className="flex h-14 items-center justify-center">
        <TouchlineMark className="h-6 w-6 text-[var(--accent)]" />
      </div>
      <ul className="flex w-full flex-1 flex-col items-center gap-1 px-1.5" role="list">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="w-full">
              <Link
                aria-current={active ? "page" : undefined}
                href={item.href}
                className={cn(
                  "relative flex w-full flex-col items-center gap-1 rounded-[var(--tl-c-radius-control)] px-1 py-2.5 text-center no-underline transition-colors duration-[var(--tl-c-motion-state)]",
                  active
                    ? "text-[var(--foreground)] before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--text-soft)]",
                )}
              >
                <Icon
                  strokeWidth={active ? 2 : 1.75}
                  className={cn("h-5 w-5", active ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}
                  aria-hidden="true"
                />
                <span className="w-full truncate text-[11px] font-medium">{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
