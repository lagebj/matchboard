"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  Shield,
  Trophy,
  History,
  type LucideIcon,
} from "lucide-react";

type MobileNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const mobileNavItems: MobileNavItem[] = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/rounds", label: "Rounds", icon: CalendarRange },
  { href: "/players", label: "Players", icon: Users },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/matches", label: "Matches", icon: Trophy },
  { href: "/history", label: "History", icon: History },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Mobile" className="app-mobile-nav lg:hidden">
      <div className="mx-auto flex max-w-[96rem] items-center justify-around px-2 py-2">
        {mobileNavItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-colors ${
                active
                  ? "text-[var(--accent-strong)]"
                  : "text-[var(--text-muted)] hover:text-zinc-50"
              }`}
              href={item.href}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="text-[10px] font-medium uppercase tracking-[0.1em]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}