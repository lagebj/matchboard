"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  label: string;
  icon: LucideIcon;
};

function mobileNavItems(orgSlug: string): MobileNavItem[] {
  return [
    { href: `/o/${orgSlug}/assistant`, label: "Assistant", icon: Bot },
    { href: `/o/${orgSlug}/fixtures`, label: "Fixtures", icon: CalendarRange },
    { href: `/o/${orgSlug}/teams`, label: "Teams", icon: Shield },
    { href: `/o/${orgSlug}/groups`, label: "Groups", icon: Layers },
    { href: `/o/${orgSlug}/players`, label: "Players", icon: Users },
    { href: `/o/${orgSlug}/opponents`, label: "Opponents", icon: Swords },
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
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}