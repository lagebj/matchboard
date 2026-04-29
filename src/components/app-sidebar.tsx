"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  group: string;
  items: { href: string; label: string; note: string }[];
};

const navGroups: NavItem[] = [
  {
    group: "Manager",
    items: [
      { href: "/", label: "Desk", note: "Decision inbox" },
      { href: "/assistant", label: "Assistant", note: "Structured review" },
      { href: "/matchday", label: "Matchday", note: "Execution mode" },
    ],
  },
  {
    group: "Match Week",
    items: [
      { href: "/matches", label: "Matches", note: "Queue & overview" },
      { href: "/rounds", label: "Round Board", note: "Team columns & roles" },
      { href: "/planner", label: "Planner", note: "Player × round matrix" },
      { href: "/rotation", label: "Rotation", note: "Movement graph" },
      { href: "/tactics", label: "Tactics", note: "Pitch layout" },
    ],
  },
  {
    group: "Squad",
    items: [
      { href: "/players", label: "Players", note: "Registry & profiles" },
      { href: "/teams", label: "Teams", note: "Health & config" },
      { href: "/availability", label: "Availability", note: "Command center" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/rules", label: "Rules", note: "Rule Studio" },
      { href: "/history", label: "History", note: "Rotation story" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/tactics" && pathname.startsWith("/tactics/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b app-hairline px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(140,167,146,0.3),rgba(88,110,100,0.2))]">
          <span className="text-sm font-bold text-zinc-50">M</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-50">Matchboard</p>
          <p className="text-[11px] app-copy-muted">Operations workspace</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.group} className="mb-4">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.24em] app-copy-muted">
              {group.group}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href + item.label}>
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-[rgba(140,167,146,0.16)] font-semibold text-zinc-50"
                          : "text-[var(--text-soft)] hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                      }`}
                      href={item.href}
                    >
                      <span className="flex-1">{item.label}</span>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t app-hairline px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] app-copy-muted">
          v0.1 · Local-first
        </p>
      </div>
    </nav>
  );
}