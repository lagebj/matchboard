export const dynamic = "force-dynamic";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getAssistantCommandCentre } from "@/lib/assistant/get-assistant-command-centre";
import { AssistantCommandCentrePage } from "@/components/assistant/assistant-command-centre-page";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { resolveSituationContext, type SituationMatchFact } from "@/lib/situational/resolve-situation-context";
import { getCoachSituationProjection } from "@/lib/situational/get-coach-situation-projection";
import {
  ASSISTANT_CANDIDATE_PROVIDER_ID,
  assistantWorkItemsToCandidates,
} from "@/lib/situational/providers/assistant-candidate-provider";
import { createPlanIntegrityCandidateProvider } from "@/lib/situational/providers/plan-integrity-candidate-provider";
import type { DecisionCandidateProvider } from "@/lib/situational/situation-types";

export default async function TodayPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const commandCentre = await getAssistantCommandCentre(ctx.orgFilter);

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

  const projection = await getCoachSituationProjection(situationContext, [assistantProvider, planIntegrityProvider]);

  return <AssistantCommandCentrePage commandCentre={commandCentre} projection={projection} />;
}
