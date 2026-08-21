"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Bot,
  CalendarRange,
  Users,
  Shield,
  Swords,
  Layers,
  type LucideIcon,
} from "lucide-react";

type MobileNavItem = {
  href: string;
  labelKey: "assistant" | "fixtures" | "teams" | "groups" | "players" | "opponents";
  icon: LucideIcon;
};

function mobileNavItems(orgSlug: string): MobileNavItem[] {
  return [
    { href: `/o/${orgSlug}/assistant`, labelKey: "assistant", icon: Bot },
    { href: `/o/${orgSlug}/fixtures`, labelKey: "fixtures", icon: CalendarRange },
    { href: `/o/${orgSlug}/teams`, labelKey: "teams", icon: Shield },
    { href: `/o/${orgSlug}/groups`, labelKey: "groups", icon: Layers },
    { href: `/o/${orgSlug}/players`, labelKey: "players", icon: Users },
    { href: `/o/${orgSlug}/opponents`, labelKey: "opponents", icon: Swords },
  ];
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  if (href.includes("/fixtures")) {
    return ["/rounds", "/matches"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  if (href.includes("/opponents")) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return true;
}

export function MobileNav({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const items = mobileNavItems(orgSlug);

  return (
    <nav aria-label="Mobile" className="app-mobile-nav lg:hidden">
      <div className="mx-auto flex max-w-[96rem] items-center justify-around px-2 py-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
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