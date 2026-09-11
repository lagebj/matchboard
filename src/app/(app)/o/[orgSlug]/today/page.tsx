export const dynamic = "force-dynamic";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getAssistantCommandCentre } from "@/lib/assistant/get-assistant-command-centre";
import { AssistantCommandCentrePage } from "@/components/assistant/assistant-command-centre-page";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getWeeklyCoachingContext } from "@/lib/weekly/get-weekly-coaching-context";
import { formatIsoWeekKey } from "@/lib/date-utils";
import { resolveSituationContext, type SituationMatchFact } from "@/lib/situational/resolve-situation-context";
import { getCoachSituationProjection } from "@/lib/situational/get-coach-situation-projection";
import {
  ASSISTANT_CANDIDATE_PROVIDER_ID,
  assistantWorkItemsToCandidates,
} from "@/lib/situational/providers/assistant-candidate-provider";
import { createPlanIntegrityCandidateProvider } from "@/lib/situational/providers/plan-integrity-candidate-provider";
import { createLiveSessionCandidateProvider } from "@/lib/situational/providers/live-session-candidate-provider";
import type { DecisionCandidateProvider } from "@/lib/situational/situation-types";
import { getFixturesOverview } from "@/domain/fixtures/service";
import type { FixtureMatch } from "@/domain/fixtures/types";
import { getOrgActivePlayerAvailability } from "@/lib/players/get-org-active-player-availability";
import { resolveFeaturedUpcomingMatch } from "@/lib/matches/today-match-presentation";
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import { summarizeSquadStatus, type TodayEvidenceSpotlightInput } from "@/lib/touchline/presentation/today-view-model";
import {
  getTeamSeasonMatchPhasePatterns,
  classifyMatchPhaseConfidence,
} from "@/lib/evidence/match-phase-pattern-evidence";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

/**
 * "Latest matches" (Touchline Design Atlas, ADR-0136): the last 5 completed results across every
 * team, own-team perspective — reuses `getFixturesOverview()`'s already-computed report state
 * exactly like the League page does, rather than a second query.
 */
function buildRecentMatches(overview: Awaited<ReturnType<typeof getFixturesOverview>>, orgUrl: (path: string) => string): MatchPresentation[] {
  const flat: FixtureMatch[] = overview.periods.flatMap((period) => period.rounds.flatMap((round) => round.matches));
  const completed = flat.filter((m) => m.reportState.state === "COMPLETED" && m.matchStatus !== "CANCELLED");
  completed.sort((a, b) => {
    const av = a.startsAt ? Date.parse(a.startsAt) : 0;
    const bv = b.startsAt ? Date.parse(b.startsAt) : 0;
    return bv - av;
  });
  return completed.slice(0, 5).map((match) => {
    const result = match.reportState.state === "COMPLETED" ? match.reportState.result : undefined;
    return buildMatchPresentation({
      id: match.id,
      href: orgUrl(`/matches/${match.id}`),
      teamName: match.teamName,
      opponentName: match.opponent,
      isHome: match.venue === "Home",
      kickoffAt: match.startsAt ?? null,
      lifecycleStatus: match.lifecycleStatus,
      ownGoals: result ? result.goalsFor : null,
      opponentGoals: result ? result.goalsAgainst : null,
      outcome: result ? result.outcome : null,
    });
  });
}

/**
 * Evidence spotlight (Touchline Design Atlas, ADR-0136): one factual "opening 10 minutes" story
 * for the featured match's own team — never an arbitrary team pick, since it's scoped to whatever
 * team the hero above is already about. A count-based statement ("N goals conceded in the
 * opening 10 minutes across M matches"), not a percentage — computing "% of all goals" correctly
 * would require reconciling overlapping phase windows (OPENING_5 sits inside OPENING_10, etc.),
 * which `getTeamSeasonMatchPhasePatterns()`'s per-window rows don't disambiguate; a percentage
 * risks being subtly wrong rather than just less punchy, so it's not attempted here.
 */
async function buildEvidenceSpotlight(
  leagueSeasonId: string | null,
  teamId: string | undefined,
  orgFilter: OrgFilterMode,
  detailHref: string,
): Promise<TodayEvidenceSpotlightInput | null> {
  if (!leagueSeasonId || !teamId) return null;
  const rows = await getTeamSeasonMatchPhasePatterns(leagueSeasonId, teamId, orgFilter);
  const openingRows = rows.filter((r) => r.phase === "OPENING_10");
  const matches = openingRows.reduce((sum, r) => sum + r.matches, 0);
  const goalsAgainst = openingRows.reduce((sum, r) => sum + r.goalsAgainst, 0);
  const confidence = classifyMatchPhaseConfidence(matches);
  if (confidence === "INSUFFICIENT") return null;
  return {
    question: "How often does this team concede in the opening minutes?",
    label: "Opening 10 minutes",
    title: "Goals conceded in the opening 10 minutes",
    value: String(goalsAgainst),
    valueCaption: goalsAgainst === 1 ? "goal conceded" : "goals conceded",
    sample: `${matches} match${matches === 1 ? "" : "es"} this season`,
    confidence,
    detailHref,
  };
}

export default async function TodayPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const commandCentre = await getAssistantCommandCentre(ctx.orgFilter);
  const weeklyContext = await getWeeklyCoachingContext(ctx.orgFilter, {
    leagueSeasonId: commandCentre.leagueSeasonId,
    weekKey: formatIsoWeekKey(new Date()),
  });

  // The situational projection reuses commandCentre's already-loaded facts (todayMatches, items,
  // roundPlanIntegrities) rather than issuing new queries — see AGENTS.md's projection
  // performance requirement.
  const situationMatches: SituationMatchFact[] = commandCentre.todayMatches.map((m) => ({
    matchId: m.matchId,
    matchRoundId: m.matchRoundId,
    startsAt: m.startsAt,
    hasActiveLiveSession: m.hasActiveLiveSession,
  }));
  const situationContext = resolveSituationContext({
    nowIso: new Date().toISOString(),
    matches: situationMatches,
    routeIntent: "TODAY",
  });

  const matchDeadlineLookup = (matchId: string | undefined) =>
    matchId ? (commandCentre.todayMatches.find((m) => m.matchId === matchId)?.startsAt ?? undefined) : undefined;

  const assistantProvider: DecisionCandidateProvider = {
    id: ASSISTANT_CANDIDATE_PROVIDER_ID,
    getCandidates: () =>
      // blocked_round/decision_required are excluded here because the plan-integrity provider
      // below covers the exact same underlying signals one at a time (per match/player), instead
      // of one item aggregating an entire round — registering both without excluding would
      // represent the same problem twice in the projection.
      assistantWorkItemsToCandidates(commandCentre.items, matchDeadlineLookup, ["blocked_round", "decision_required"]),
  };

  const planIntegrityProvider: DecisionCandidateProvider = createPlanIntegrityCandidateProvider(
    commandCentre.roundPlanIntegrities,
    matchDeadlineLookup,
  );

  const liveSessionProvider: DecisionCandidateProvider = createLiveSessionCandidateProvider(
    commandCentre.activeLiveSessions,
    commandCentre.todayMatches,
    situationContext.nowIso,
  );

  const projection = await getCoachSituationProjection(situationContext, [
    assistantProvider,
    planIntegrityProvider,
    liveSessionProvider,
  ]);

  // Touchline Design Atlas additions (ADR-0136) — genuinely new content, not a replacement for
  // anything above. Independent of the situational projection, so loaded in parallel with it
  // would also be fine; kept sequential-after here only for readability, not a perf requirement.
  const orgUrl = (path: string) => `/o/${orgSlug}${path}`;
  const [fixturesOverview, orgPlayerAvailability] = await Promise.all([
    getFixturesOverview(ctx.orgFilter),
    getOrgActivePlayerAvailability(ctx.orgFilter),
  ]);
  const recentMatches = buildRecentMatches(fixturesOverview, orgUrl);
  const squadStatus = orgPlayerAvailability.length > 0 ? summarizeSquadStatus(orgPlayerAvailability) : null;

  const featuredMatch = resolveFeaturedUpcomingMatch(commandCentre.todayMatches);
  const featuredTeamId = featuredMatch
    ? fixturesOverview.periods
        .flatMap((p) => p.rounds)
        .flatMap((r) => r.matches)
        .find((m) => m.id === featuredMatch.matchId)?.teamId
    : undefined;
  const evidenceSpotlight = await buildEvidenceSpotlight(
    commandCentre.leagueSeasonId,
    featuredTeamId,
    ctx.orgFilter,
    orgUrl("/insights/match-phase-patterns"),
  );

  return (
    <AssistantCommandCentrePage
      commandCentre={commandCentre}
      projection={projection}
      weeklyContext={weeklyContext}
      recentMatches={recentMatches}
      squadStatus={squadStatus}
      evidenceSpotlight={evidenceSpotlight}
    />
  );
}
