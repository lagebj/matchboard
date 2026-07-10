"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CalendarRange,
  CalendarDays,
  Users,
  Shield,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { MatchboardLogo } from "@/components/shell/matchboard-logo";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/fixtures", label: "Fixtures", icon: CalendarRange },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/players", label: "Players", icon: Users },
  { href: "/formations", label: "Formations", icon: LayoutGrid },
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
  if (href === "/formations") {
    return pathname.startsWith("/formations/");
  }
  return true;
}

/**
 * SidebarNav — professional ops cockpit sidebar.
 *
 * Active item: calm left rail accent + muted surface highlight.
 * Inactive: quiet, muted, hover reveals surface.
 * Brand mark: subtle identity, not heavy.
 * Version: barely visible footer text.
 */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="flex h-full flex-col bg-[rgba(8,11,18,0.98)]"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <MatchboardLogo className="h-7 w-7 text-[var(--accent-strong)]" ariaHidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-zinc-50">Matchboard</p>
          <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Squad planning</p>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto px-2 pt-1">
        <ul className="flex flex-col gap-0.5" role="list">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative flex items-center gap-2.5 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-[var(--accent-subtle)] text-zinc-50 font-medium before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2.5px] before:rounded-r before:bg-[var(--accent-strong)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/40 hover:text-zinc-100",
                  ].join(" ")}
                  href={item.href}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-[var(--accent-strong)]" : "text-[var(--text-muted)]"}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Pitch-line subtle texture hint at bottom */}
      <div className="border-t border-[var(--border-soft)] px-4 py-3">
        <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--text-disabled)]">v0.1</p>
      </div>
    </nav>
  );
}