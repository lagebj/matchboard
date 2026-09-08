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
import { isNavItemActive } from "@/components/shell/nav-active";

type MobileNavItem = {
  href: string;
  labelKey: "today" | "league" | "events" | "players" | "more";
  icon: LucideIcon;
};

function mobileNavItems(orgSlug: string): MobileNavItem[] {
  return [
    { href: `/o/${orgSlug}/today`, labelKey: "today", icon: CalendarClock },
    { href: `/o/${orgSlug}/fixtures`, labelKey: "league", icon: CalendarRange },
    { href: `/o/${orgSlug}/events`, labelKey: "events", icon: CalendarDays },
    { href: `/o/${orgSlug}/players`, labelKey: "players", icon: Users },
    { href: `/o/${orgSlug}/more`, labelKey: "more", icon: MoreHorizontal },
  ];
}

export function MobileNav({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const items = mobileNavItems(orgSlug);

  return (
    <nav aria-label="Mobile" className="app-mobile-nav medium:hidden">
      <div className="mx-auto flex max-w-[96rem] items-center justify-around px-2 py-2">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-1.5 transition-colors ${
                active
                  ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/40 hover:text-zinc-100"
              }`}
              href={item.href}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-semibold tracking-[0.02em]">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
