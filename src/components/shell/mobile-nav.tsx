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
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 transition-colors ${
                active
                  ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/40 hover:text-zinc-100"
              }`}
              href={item.href}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em]">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
