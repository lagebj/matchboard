// Shared between SidebarNav, MobileNav, and NavigationRail so the three navs' active-state
// logic can't silently drift apart. Secondary destinations live under a primary nav item
// (ADR-0157 C8 "Active nav state"): League covers league teams, rounds/matches, season review,
// and the opponent domain. These paths make the corresponding primary item show active without
// adding their own top-level nav entries.
//
// `More` and its secondary prefixes were removed in ADR-0157 C8 — there are only four primary
// items now. Admin/settings routes (`/settings`, `/groups`, `/rules`, `/simulation`,
// `/workbench`) intentionally select no primary item: isNavItemActive returns false for all four
// items on those paths, which every nav renders as "nothing active" (no fifth item is invented).
export const LEAGUE_SECONDARY_PREFIXES = ["/rounds", "/matches", "/teams", "/season", "/opponents"];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  if (href.endsWith("/fixtures")) {
    return LEAGUE_SECONDARY_PREFIXES.some((p) => pathname.includes(p));
  }
  return false;
}
