"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  {
    href: "/",
    kicker: "Step 1",
    label: "Coach Desk",
    note: "Choose the next job.",
    stage: "Desk",
  },
  {
    href: "/matches",
    kicker: "Step 2",
    label: "Week Flow",
    note: "Work one week card at a time.",
    stage: "Queue",
  },
  {
    href: "/matches",
    kicker: "Step 3",
    label: "Match Rooms",
    note: "Open one match and adjust the squad.",
    stage: "Work",
  },
  {
    href: "/players",
    kicker: "Registry",
    label: "Players",
    note: "Update availability and roles.",
    stage: "Setup",
  },
  {
    href: "/teams",
    kicker: "Setup",
    label: "Teams",
    note: "Set support and development paths.",
    stage: "Setup",
  },
  {
    href: "/history",
    kicker: "Review",
    label: "History",
    note: "Review load and movement.",
    stage: "Review",
  },
  {
    href: "/rules",
    kicker: "Controls",
    label: "Rules",
    note: "Adjust selection limits.",
    stage: "Controls",
  },
] as const;

function isActivePath(pathname: string, href: string, label?: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (label === "Match Rooms" && pathname.startsWith("/selection/")) {
    return true;
  }

  if (label === "Match Rooms") {
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();
  const flowItems = navigationItems.slice(0, 3);
  const supportItems = navigationItems.slice(3);

  return (
    <nav aria-label="Primary" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
          Coach Loop
        </p>
        <p className="text-[11px] uppercase tracking-[0.18em] app-copy-muted">
          Desk / Weekly cards / Match room / Setup and review
        </p>
      </div>
      <ul className="grid gap-2 xl:grid-cols-3">
        {flowItems.map((item, index) => {
          const isActive = isActivePath(pathname, item.href, item.label);

          return (
            <li key={`${item.href}:${item.label}`}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex h-full min-h-[8rem] flex-col justify-between rounded-[1.45rem] border p-4 ${
                  isActive
                    ? "border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(148,175,155,0.22),rgba(34,41,53,0.82))] text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:bg-[rgba(255,255,255,0.045)] hover:text-zinc-50"
                }`}
                href={item.href}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                      {item.kicker}
                    </p>
                    <p className="mt-2 text-base font-semibold">{item.label}</p>
                  </div>
                  <span className="rounded-full border app-hairline px-3 py-1 text-[10px] uppercase tracking-[0.18em] app-copy-muted">
                    {item.stage}
                  </span>
                </div>
                <div>
                  <p className="mt-3 text-sm leading-6 app-copy-soft">{item.note}</p>
                  {index < flowItems.length - 1 ? (
                    <p className="mt-3 text-[11px] uppercase tracking-[0.18em] app-copy-muted">
                      Continue right
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {supportItems.map((item) => {
          const isActive = isActivePath(pathname, item.href, item.label);

          return (
            <li key={`${item.href}:${item.label}`}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex h-full min-h-[6.5rem] flex-col justify-between rounded-[1.25rem] border p-4 ${
                  isActive
                    ? "border-[var(--border-strong)] bg-[rgba(148,175,155,0.14)] text-zinc-50"
                    : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:bg-[rgba(255,255,255,0.045)] hover:text-zinc-50"
                }`}
                href={item.href}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                      {item.kicker}
                    </p>
                    <p className="mt-2 text-base font-semibold">{item.label}</p>
                  </div>
                  <span className="rounded-full border app-hairline px-3 py-1 text-[10px] uppercase tracking-[0.18em] app-copy-muted">
                    {item.stage}
                  </span>
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
