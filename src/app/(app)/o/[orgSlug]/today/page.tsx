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
import type { DecisionCandidateProvider } from "@/lib/situational/situation-types";

export default async function TodayPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const commandCentre = await getAssistantCommandCentre(ctx.orgFilter);

  // The situational projection reuses commandCentre's already-loaded facts (todayMatches, items)
  // rather than issuing new queries — see AGENTS.md's projection performance requirement.
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
    getCandidates: () => assistantWorkItemsToCandidates(commandCentre.items, matchDeadlineLookup),
  };

  const projection = await getCoachSituationProjection(situationContext, [assistantProvider]);

  return <AssistantCommandCentrePage commandCentre={commandCentre} projection={projection} />;
}
