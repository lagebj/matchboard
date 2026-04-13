"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/", label: "Home" },
  { href: "/players", label: "Players" },
  { href: "/teams", label: "Teams" },
  { href: "/matches", label: "Matches" },
  { href: "/history", label: "History" },
  { href: "/rules", label: "Rules" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="overflow-x-auto">
      <ul className="flex min-w-max gap-2 rounded-full border app-hairline bg-[rgba(255,255,255,0.02)] p-1.5">
        {navigationItems.map((item) => {
          const isActive = isActivePath(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                  isActive
                    ? "border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(148,175,155,0.22),rgba(98,118,109,0.18))] text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border border-transparent text-[var(--text-soft)] hover:border-[var(--border-soft)] hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-50"
                }`}
                href={item.href}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
