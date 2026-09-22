import "server-only";
import { db } from "@/lib/db";
import { AiInsightKind } from "@/generated/prisma/client";
import { getOrganisationAiSettings } from "@/lib/ai/organisation-ai-settings";
import { getPlannedMatchAdvisorViewModel } from "@/lib/ai/presentation/planned-match-advisor";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { buildCurrentPlanInput } from "./build-current-plan-input";
import { buildMatchInsightFacts } from "./build-match-insight-facts";
import { buildDeterministicInsights } from "./build-deterministic-insights";
import { categoryForEvidenceRefs, rankInsightCandidates } from "./ranking";
import type { MatchInsightCandidate, MatchInsightRelevance } from "./types";

/**
 * Match Insights server view-model (ADR-0149, PR 4 of 6). One merged model combining PR 2's
 * deterministic insights with the current-fingerprint AI review's insights — the UI never
 * independently joins raw AI output to raw statistics (05_IMPLEMENTATION_PLAN.md Phase 7).
 *
 * `status` distinguishes the four states the bundle's UX spec requires (01_PRODUCT_AND_UX_SPEC.md
 * §10, 04_FINGERPRINT_JOBS_AND_FAILURES.md §9-11): deterministic insights are ALWAYS present and
 * current regardless of `status` -- only the AI-enrichment slice's availability changes.
 */
export type MatchInsightsStatus =
  | "CURRENT" // no AI mention needed -- either AI is off, or a fresh review's insights are merged in.
  | "UPDATING" // a new review is queued/running for the current plan; deterministic insights are current.
  | "STALE_AI_WITHHELD" // a successful review exists but for a different fingerprint; withheld from the primary list.
  | "AI_UNAVAILABLE"; // AI is enabled but the most recent attempt for this plan failed terminally.

export type MatchInsightsViewModel = {
  status: MatchInsightsStatus;
  /** Full ranked list (relevance tier, then a deterministic tiebreak) -- the UI slices this for
   * the default top-N view and "Show all" (bundle §3: five is a presentation threshold, not a
   * generation limit). */
  insights: MatchInsightCandidate[];
  totalCount: number;
};

export const DEFAULT_VISIBLE_COUNT = 5;

/** `kind` -> relevance for an AI-sourced insight (ADR-0149 Decision 2: Matchboard always derives
 * relevance, the AI never emits one). A deliberately simpler rule than cross-referencing a
 * specific matched fact's own `deterministicPriority` (which would require resolving the AI
 * insight's ephemeral evidence refs back through a rebuilt `refMap` just for a display tier) --
 * `kind` alone already carries real signal (attention is explicitly attention-worthy; a plain
 * observation is background), and every AI insight is already grounded via its required
 * evidenceRefs regardless of which relevance tier it lands in. Keyed on the persisted
 * `AiInsightKind` enum (`planned-match-advisor.ts` passes the raw stored value through, not the
 * lowercase wire form used only at the provider boundary). */
const RELEVANCE_BY_AI_KIND: Record<AiInsightKind, MatchInsightRelevance> = {
  [AiInsightKind.ATTENTION]: "HIGH",
  [AiInsightKind.DEVELOPMENT_SUGGESTION]: "MEDIUM",
  [AiInsightKind.OPPORTUNITY]: "MEDIUM",
  [AiInsightKind.OBSERVATION]: "CONTEXTUAL",
};

function toAiCandidate(insight: { title: string; body: string; kind: string; evidenceRefs: string[] }, index: number): MatchInsightCandidate {
  const kind = (Object.values(AiInsightKind) as string[]).includes(insight.kind) ? (insight.kind as AiInsightKind) : AiInsightKind.OBSERVATION;
  return {
    id: `ai:${index}`,
    category: categoryForEvidenceRefs(insight.evidenceRefs),
    relevance: RELEVANCE_BY_AI_KIND[kind],
    title: insight.title,
    observation: insight.body,
    subjectRefs: [],
    factRefs: [],
    evidenceRefs: insight.evidenceRefs,
    source: "AI",
  };
}

export async function getMatchInsights(params: { organisationId: string; matchId: string }): Promise<MatchInsightsViewModel> {
  const plan = await buildCurrentPlanInput({ organisationId: params.organisationId, matchId: params.matchId });
  if (!plan) return { status: "CURRENT", insights: [], totalCount: 0 };

  const orgFilter: OrgFilterMode = {
    type: "org",
    filter: { organisationId: params.organisationId },
    filterNullable: { organisationId: params.organisationId },
    organisationId: params.organisationId,
  };

  const bundle = await buildMatchInsightFacts(plan, orgFilter);

  const playerIds = [...bundle.playerSummaries.keys()];
  const players = playerIds.length
    ? await db.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const playerNameById = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName ?? ""}`.trim()]));

  const deterministicInsights = buildDeterministicInsights({
    facts: bundle.facts,
    plan,
    playerSummaries: bundle.playerSummaries,
    playerNameById,
  });

  const settings = await getOrganisationAiSettings(params.organisationId);
  const aiEnabled = Boolean(settings?.enabled && settings.activeConnectionId);

  let status: MatchInsightsStatus = "CURRENT";
  let aiCandidates: MatchInsightCandidate[] = [];

  if (aiEnabled) {
    const pendingJob = await db.aiAdvisorJob.findFirst({
      where: {
        organisationId: params.organisationId,
        scopeType: "MATCH",
        scopeId: params.matchId,
        capability: { in: ["MATCH_PREP", "LINEUP_REVIEW"] },
        status: { in: ["QUEUED", "RUNNING"] },
      },
      select: { id: true },
    });

    if (pendingJob) {
      status = "UPDATING";
    } else {
      const advisorViewModel = await getPlannedMatchAdvisorViewModel({ organisationId: params.organisationId, matchId: params.matchId });
      if (advisorViewModel?.status === "stale") {
        status = "STALE_AI_WITHHELD";
      } else if (advisorViewModel?.status === "fresh") {
        status = "CURRENT";
        aiCandidates = advisorViewModel.insights.map((insight, index) => toAiCandidate(insight, index));
      } else {
        const failedJob = await db.aiAdvisorJob.findFirst({
          where: {
            organisationId: params.organisationId,
            scopeType: "MATCH",
            scopeId: params.matchId,
            capability: { in: ["MATCH_PREP", "LINEUP_REVIEW"] },
            status: "FAILED",
          },
          select: { id: true },
        });
        status = failedJob ? "AI_UNAVAILABLE" : "CURRENT";
      }
    }
  }

  const insights = rankInsightCandidates([...deterministicInsights, ...aiCandidates]);

  return { status, insights, totalCount: insights.length };
}
