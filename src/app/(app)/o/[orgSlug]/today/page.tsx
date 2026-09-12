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
import { getOrgActivePlayerAvailability } from "@/lib/players/get-org-active-player-availability";
import { getRecentCompletedMatches } from "@/lib/matches/get-recent-completed-matches";
import { summarizeSquadStatus } from "@/lib/touchline/presentation/today-view-model";

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
  //
  // "Latest matches" deliberately uses the narrow, bounded `getRecentCompletedMatches()` rather
  // than League's `getFixturesOverview()` (which loads every season/round/match org-wide,
  // unbounded) — calling that a second time from Today, very likely the single highest-traffic
  // page in the app, was a real, measured cause of repeated "Deploy PR to Test slot" CI timeouts
  // (`/today` navigation exceeding 30s under concurrent Playwright load) even after the
  // evidence-spotlight removal below. See docs/domain/touchline-atlas-provenance.md §14/§17 for
  // the full account.
  const orgUrl = (path: string) => `/o/${orgSlug}${path}`;
  const [recentMatches, orgPlayerAvailability] = await Promise.all([
    getRecentCompletedMatches(ctx.orgFilter, orgUrl),
    getOrgActivePlayerAvailability(ctx.orgFilter),
  ]);
  const squadStatus = orgPlayerAvailability.length > 0 ? summarizeSquadStatus(orgPlayerAvailability) : null;

  // Evidence spotlight (a `getTeamSeasonMatchPhasePatterns()` story) was deliberately dropped
  // from this page for now — that function's own doc comment already discloses it issues one
  // goal-attribution query per completed match rather than a single batched query, "acceptable
  // at the youth-league scale this product targets... flagged here for a future optimisation
  // pass if profiling ever shows otherwise." Wiring it into Today (the single highest-traffic
  // page) is exactly the profiling signal that comment anticipated: it measurably slowed Today's
  // page load under concurrent load in CI. See docs/domain/touchline-atlas-provenance.md §14 for
  // the full account — a real, disclosed scope reduction, not a silent regression.

  return (
    <AssistantCommandCentrePage
      commandCentre={commandCentre}
      projection={projection}
      weeklyContext={weeklyContext}
      recentMatches={recentMatches}
      squadStatus={squadStatus}
    />
  );
}
