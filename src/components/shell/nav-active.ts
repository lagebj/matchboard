// Shared between sidebar-nav.tsx and mobile-nav.tsx so the two navs' active-state
// logic can't silently drift apart. Secondary destinations live under a primary nav
// item (PROGRAMME.md §6): League covers league teams and rounds/matches, More covers
// everything low-frequency. These paths make the corresponding primary item show
// active without adding their own top-level nav entries.
export const LEAGUE_SECONDARY_PREFIXES = ["/rounds", "/matches", "/teams", "/season"];

export const MORE_SECONDARY_PREFIXES = [
  "/insights",
  "/opponents",
  "/groups",
  "/formations",
  "/rules",
  "/history",
  "/reviews",
  "/settings",
  "/simulation",
  "/workbench",
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  if (href.endsWith("/fixtures")) {
    return LEAGUE_SECONDARY_PREFIXES.some((p) => pathname.includes(p));
  }
  if (href.endsWith("/more")) {
    return MORE_SECONDARY_PREFIXES.some((p) => pathname.includes(p));
  }
  return false;
}
