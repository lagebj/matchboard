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
    return ["/rounds", "/matches", "/opponents"].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
  }
  return true;
}

/**
 * SidebarNav — per ADR 0007 the sidebar is calm and matte: the active item is
 * marked with a left rail (not a heavy background block), the brand mark is
 * quiet, and the version label is barely-visible footer text.
 */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/40">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4 text-[var(--accent-strong)]"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-50">Matchboard</p>
          <p className="text-[10px] text-[var(--text-muted)]">Squad planning</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-2">
        <ul className="flex flex-col gap-0.5" role="list">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative flex items-center gap-2.5 rounded-md pl-3 pr-3 py-1.5 text-sm transition-colors",
                    active
                      ? "text-zinc-50 font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-r before:bg-[var(--accent-strong)]"
                      : "text-[var(--text-soft)] hover:bg-[var(--surface-muted)]/40 hover:text-zinc-50",
                  ].join(" ")}
                  href={item.href}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? "text-[var(--accent-strong)]" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-4 py-3 text-[10px] text-[var(--text-muted)]">v0.1</div>
    </nav>
  );
}
