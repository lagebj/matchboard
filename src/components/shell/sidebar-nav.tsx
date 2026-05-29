"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CalendarRange,
  Users,
  Shield,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

const navItems: NavItem[] = [
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/fixtures", label: "Fixtures", icon: CalendarRange },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/players", label: "Players", icon: Users },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  if (href === "/fixtures") {
    return ["/rounds", "/matches", "/opponents"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return true;
}

export function SidebarNav({ warningCount }: { warningCount?: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--border-soft)] px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-subtle)] border border-[var(--border-soft)]">
          <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5 text-[var(--accent-strong)]" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" opacity="0.6" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-50">Matchboard</p>
          <p className="text-[10px] text-[var(--text-muted)]">Squad planning</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5" role="list">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[var(--accent-subtle)] font-semibold text-zinc-50"
                      : "text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-zinc-50"
                  }`}
                  href={item.href}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-900/50 px-1 text-[9px] font-bold text-red-300">
                      {item.badge}
                    </span>
                  )}
                  {item.href === "/fixtures" && warningCount != null && warningCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-900/50 px-1 text-[9px] font-bold text-amber-300">
                      {warningCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-[var(--border-soft)] px-4 py-3">
        <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          v0.1
        </p>
      </div>
    </nav>
  );
}