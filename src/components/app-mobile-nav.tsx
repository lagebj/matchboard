"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileNavItems = [
  { href: "/", label: "Desk", short: "Desk" },
  { href: "/matches", label: "Board", short: "Board" },
  { href: "/players", label: "Players", short: "Players" },
  { href: "/teams", label: "Teams", short: "Teams" },
  { href: "/assistant", label: "Asst.", short: "Asst." },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppMobileNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Mobile" className="app-mobile-nav lg:hidden">
      <div className="mx-auto flex max-w-[96rem] items-center justify-around px-2 py-2">
        {mobileNavItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
                active
                  ? "text-[var(--accent-strong)]"
                  : "app-copy-muted hover:text-zinc-50"
              }`}
              href={item.href}
            >
              <span>{item.short}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}