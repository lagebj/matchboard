"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  {
    href: "/",
    kicker: "Desk",
    label: "Coach Desk",
    note: "Start with the next call.",
  },
  {
    href: "/matches",
    kicker: "Queue",
    label: "Match Queue",
    note: "Run the queue by week.",
  },
  {
    href: "/players",
    kicker: "Registry",
    label: "Players",
    note: "Check availability and fit.",
  },
  {
    href: "/teams",
    kicker: "Setup",
    label: "Teams",
    note: "Set support and development links.",
  },
  {
    href: "/history",
    kicker: "Review",
    label: "History",
    note: "Check load and movement.",
  },
  {
    href: "/rules",
    kicker: "Controls",
    label: "Rules",
    note: "Adjust the engine limits.",
  },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
          Coach Loop
        </p>
        <p className="text-[11px] uppercase tracking-[0.18em] app-copy-muted">
          Desk / Queue / Registry / Review / Controls
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {navigationItems.map((item) => {
          const isActive = isActivePath(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex h-full min-h-[7rem] flex-col justify-between rounded-[1.35rem] border p-4 ${
                  isActive
                    ? "border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(148,175,155,0.22),rgba(34,41,53,0.82))] text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:bg-[rgba(255,255,255,0.045)] hover:text-zinc-50"
                }`}
                href={item.href}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                    {item.kicker}
                  </p>
                  <p className="mt-2 text-base font-semibold">{item.label}</p>
                </div>
                <p className="mt-3 text-sm leading-6 app-copy-soft">{item.note}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
