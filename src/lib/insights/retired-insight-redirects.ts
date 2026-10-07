import { redirect } from "next/navigation";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

/**
 * ADR-0157 slice C8 — retired `/insights/*` deep-link redirect map
 * (`11_INSIGHTS_ROUTE_DISPOSITION.md`).
 *
 * Each former insight job redirects to its contextual owner. Selected-entity query params
 * (`leagueSeasonId`, `playerId`, `teamId`, `matchId`) are forwarded so the original deep-link
 * intent is preserved; the bundle explicitly forbids redirecting everything to one generic
 * Season home and discarding intent.
 *
 * Routes not listed here (the `/insights` hub itself, and any unknown slug) redirect to
 * Season Review Overview — the closest still-existing season-level analysis surface.
 */

export type RetiredInsightRedirectSearchParams = {
  leagueSeasonId?: string;
  playerId?: string;
  teamId?: string;
  matchId?: string;
};

/** Query params a redirect destination cares about — everything else is dropped. */
const FORWARDED_PARAMS: ReadonlySet<string> = new Set([
  "leagueSeasonId",
  "playerId",
  "teamId",
  "matchId",
]);

function buildQuery(params: URLSearchParams, entries: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value) query.set(key, value);
  }
  for (const [key, value] of params.entries()) {
    if (!FORWARDED_PARAMS.has(key) || query.has(key)) continue;
    if (value) query.set(key, value);
  }
  const str = query.toString();
  return str ? `?${str}` : "";
}

/**
 * Resolve the contextual destination for a retired `/insights/[slug]` deep link.
 * Returns an org-relative path (no `/o/{orgSlug}` prefix).
 */
export function resolveRetiredInsightDestination(
  slug: string,
  params: RetiredInsightRedirectSearchParams,
  search: URLSearchParams,
): string {
  const seasonTab = (tab: string) =>
    `/season${buildQuery(search, { tab, leagueSeasonId: params.leagueSeasonId })}`;

  switch (slug) {
    // Opportunity family -> Season Review > Opportunity (C7 parity: same client components).
    case "opportunity":
    case "opportunity-quality":
    case "opportunity-gap":
      return seasonTab("opportunity");
    // Load -> Season Review > Opportunity (hosts LoadTimelineClient; Today only for current
    // conflicts, which are surfaced there as actionable items already).
    case "load":
      return seasonTab("opportunity");
    // Coverage -> Round Board for current/future rounds; Season Review > Teams for the
    // historical aggregate.
    case "coverage":
      return seasonTab("teams");
    // Position exposure -> Player Detail > Evidence for one player; Season Review >
    // Development for the aggregate.
    case "position-exposure":
      return params.playerId
        ? `/players/${params.playerId}${buildQuery(search, { tab: "evidence" })}`
        : seasonTab("development");
    // Player pathways -> Player Detail > Matches for one player; Season Review > Players.
    case "player-pathways":
      return params.playerId
        ? `/players/${params.playerId}${buildQuery(search, { tab: "matches" })}`
        : seasonTab("players");
    // Continuity -> Season Review > Teams (longer-term view). Match Preparation owns the
    // current-match view via its own opponent/continuity context.
    case "continuity":
      return seasonTab("teams");
    // Match phase patterns -> Season Review (Overview/Teams pattern stories).
    case "match-phase-patterns":
      return seasonTab("teams");
    // Player combinations -> Opponent Detail for an exact opponent; otherwise Season Review
    // > Teams (the still-existing combination evidence context).
    case "player-combinations":
      return params.teamId
        ? `/opponents/${params.teamId}`
        : seasonTab("teams");
    // Planned vs actual -> Completed Match primary surface (`after-match` hosts the
    // plan-vs-reality story; `analysis` is not a real tab key, an invalid value falls back to
    // overview per `resolveMatchDetailTab`); Season Review drill-down otherwise.
    case "planned-vs-actual":
      return params.matchId
        ? `/matches/${params.matchId}${buildQuery(search, { tab: "after-match" })}`
        : seasonTab("overview");
    // Policy warnings / conflicts -> Today (actionable policy/conflict state is surfaced
    // as work items there; Round Board covers the current round's context).
    case "policy-warnings":
    case "conflicts":
      return `/today`;
    // Operational health -> Today for actionable football work; structural/maintenance
    // items are Settings/admin territory.
    case "operational-health":
      return `/today`;
    default:
      return seasonTab("overview");
  }
}

/**
 * The org-scoped redirect executor shared by every retired `/insights` route page.
 * Authenticates first so unauthenticated visitors follow the normal sign-in flow instead
 * of a blind redirect.
 */
export async function redirectRetiredInsightRoute(
  orgSlug: string,
  slug: string,
  params: RetiredInsightRedirectSearchParams,
  search: URLSearchParams,
): Promise<never> {
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  redirect(`/o/${orgSlug}${resolveRetiredInsightDestination(slug, params, search)}`);
}