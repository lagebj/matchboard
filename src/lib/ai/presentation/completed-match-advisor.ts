import "server-only";
import { db } from "@/lib/db";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { buildPostMatchReviewContext } from "@/lib/ai/context/post-match-review";
import { buildRefDisplayNameMap, resolveInsightText } from "@/lib/ai/presentation/resolve-insight-text";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";
import type { AiAdvisorInsight } from "@/generated/prisma/client";

export type DevelopmentSuggestionViewModel = {
  insightId: string;
  /** e.g. "Henrik · positional understanding" (08_UI_UX_SPEC.md: "locally resolved player name"). */
  title: string;
  body: string;
};

/** ADR-0152 §16 "Evidence UI distinguishes Match data, Coach observation, Previous Assistant
 * Coach expectation, and Development evidence." Derived from an insight's own `evidenceRefs`
 * (already validated at persistence time against the exact refs its own context produced), not
 * re-derived from provider output. */
export type EvidenceSourceLabel = "Match data" | "Coach observation" | "Previous Assistant Coach expectation" | "Development evidence";

const EVIDENCE_SOURCE_ORDER: EvidenceSourceLabel[] = ["Match data", "Coach observation", "Previous Assistant Coach expectation", "Development evidence"];

// Prefixes exactly as `post-match-review.ts` emits them via `withEvidenceRef`. Longer/more
// specific prefixes are irrelevant here since every prefix below is already unambiguous.
const EVIDENCE_SOURCE_PREFIXES: [string, EvidenceSourceLabel][] = [
  ["fact:pre-match-expectation:", "Previous Assistant Coach expectation"],
  ["fact:player-context:", "Development evidence"],
  ["fact:development-focus:", "Development evidence"],
  ["fact:debrief", "Coach observation"], // fact:debrief: and fact:debrief-player-observation:
  ["fact:active-qualitative-evidence:", "Coach observation"],
  ["fact:team-reflection:", "Coach observation"],
  ["fact:opponent-encounter:", "Coach observation"],
  ["fact:report-team-note:", "Coach observation"],
  ["fact:recent-team-patterns:", "Coach observation"],
  ["fact:score:", "Match data"],
  ["fact:goal:", "Match data"],
  ["fact:assist:", "Match data"],
  ["fact:attendance:", "Match data"],
  ["fact:minutes:", "Match data"],
  ["fact:bench-interval:", "Match data"],
  ["fact:substitution:", "Match data"],
  ["fact:recovered-timing:", "Match data"],
  ["fact:opponent-history:", "Match data"],
];

function classifyEvidenceRef(ref: string): EvidenceSourceLabel | null {
  for (const [prefix, label] of EVIDENCE_SOURCE_PREFIXES) {
    if (ref.startsWith(prefix)) return label;
  }
  return null;
}

function evidenceSourcesFor(evidenceRefs: unknown): EvidenceSourceLabel[] {
  if (!Array.isArray(evidenceRefs)) return [];
  const present = new Set<EvidenceSourceLabel>();
  for (const ref of evidenceRefs) {
    if (typeof ref !== "string") continue;
    const label = classifyEvidenceRef(ref);
    if (label) present.add(label);
  }
  return EVIDENCE_SOURCE_ORDER.filter((label) => present.has(label));
}

/** ADR-0152 §16 post-match presentation order, steps 2-6 (Summary is handled separately below;
 * step 7 "Clarify" is its own `clarification` field, never mixed into this list). An insight
 * whose `analysisRole` is `null` (every pre-4c/contract-v1 review) or `RECURRING_PATTERN` (that
 * role belongs to weekly_team_review only, per §18 — see `post-match-review.ts`'s own prompt
 * correction) falls back to a catch-all "Observations" bucket at the end rather than being
 * silently dropped. */
type SectionKey = "SUPPORTED" | "CONTRADICTED" | "UNRESOLVED" | "SURPRISING" | "NEXT_FOCUS" | "OTHER";
const SECTION_LABELS: Record<SectionKey, string> = {
  SUPPORTED: "Supported",
  CONTRADICTED: "Contradicted",
  UNRESOLVED: "Still unresolved",
  SURPRISING: "Unexpected",
  NEXT_FOCUS: "Next focus",
  OTHER: "Observations",
};
const SECTION_ORDER: SectionKey[] = ["SUPPORTED", "CONTRADICTED", "UNRESOLVED", "SURPRISING", "NEXT_FOCUS", "OTHER"];

function sectionKeyForRole(role: string | null): SectionKey {
  if (role === "SUPPORTED" || role === "CONTRADICTED" || role === "UNRESOLVED" || role === "SURPRISING" || role === "NEXT_FOCUS") return role;
  return "OTHER";
}

export type AdvisorInsightViewModel = {
  sectionLabel: string;
  title: string;
  body: string;
  evidenceSources: EvidenceSourceLabel[];
};

export type AdvisorClarificationViewModel = {
  insightId: string;
  question: string;
  options: string[];
  title: string;
  body: string;
};

export type CompletedMatchAdvisorViewModel =
  | {
      status: "fresh" | "stale";
      summary: string;
      /** Full ordered list (not pre-truncated) — the UI shows the first `VISIBLE_INSIGHT_COUNT`
       * by default and a "Show all" affordance for the rest (bundle §16). */
      insights: AdvisorInsightViewModel[];
      clarification: AdvisorClarificationViewModel | null;
      suggestions: DevelopmentSuggestionViewModel[];
    }
  /** Bundle §17 error states. `reviewing`/`unavailable` reflect the `AiAdvisorJob` row for the
   * *current* source fingerprint — never shown when AI is disabled (the settings gate above
   * returns `null` first) or when a usable review already exists (a `stale` review with content
   * is always preferred over an in-flight/failed banner for the *next* one). */
  | { status: "reviewing" }
  | { status: "unavailable" };

/** A stale review's `refMap` cannot be safely rebuilt (`resolve-insight-text.ts`'s own doctrine:
 * ref assignment is deterministic over *current* data, so a mismatched fingerprint means the
 * current refMap may not even agree with the stale review's own numbering) — so stale text is
 * shown with any literal ref tokens (`P01`, ...) left unresolved rather than risk attaching a
 * wrong name. This is a display degradation, not a correctness gap: `AiAdvisorInsight.subjectId`
 * (used for `suggestions`' player-name resolution below) is a real, stable DB id independent of
 * ref-token numbering and is always resolved regardless of freshness. */
function presentText(text: string, isFresh: boolean, displayNameByRef: Map<string, string>): string {
  return isFresh ? resolveInsightText(text, displayNameByRef) : text;
}

/**
 * Builds the "completed match" Advisor panel's view model (08_UI_UX_SPEC.md "Completed match":
 * canonical result/report facts first, Post-match AI Advisor after them). Returns `null` when
 * there is nothing to show at all — no connection, AI disabled, `postMatchReviewEnabled` off, the
 * report not yet `LOCKED`, or nothing queued/succeeded/failed for this scope.
 */
export async function getCompletedMatchAdvisorViewModel(params: {
  organisationId: string;
  matchId: string;
}): Promise<CompletedMatchAdvisorViewModel | null> {
  const settings = await getOrganisationAiSettings(params.organisationId);
  if (!settings || !settings.enabled || !settings.activeConnectionId) return null;
  if (!isAiCapabilityEnabled(settings, "POST_MATCH_REVIEW")) return null;

  const activeConnection = await db.aiProviderConnection.findFirst({
    where: { id: settings.activeConnectionId, organisationId: params.organisationId },
    select: { status: true },
  });
  if (!activeConnection || activeConnection.status !== "READY") return null;

  const context = await buildPostMatchReviewContext({ organisationId: params.organisationId, scopeId: params.matchId });
  if (!context) return null;

  const currentFingerprint = computeSourceFingerprint(context.normalizedContext);

  const review = await db.aiAdvisorReview.findFirst({
    where: { organisationId: params.organisationId, scopeType: "MATCH", scopeId: params.matchId, capability: "POST_MATCH_REVIEW", status: "SUCCEEDED" },
    orderBy: { completedAt: "desc" },
    include: { insights: { where: { state: "ACTIVE" }, orderBy: { displayOrder: "asc" } } },
  });

  if (review && review.insights.length > 0) {
    const isFresh = review.sourceFingerprint === currentFingerprint;
    const displayNameByRef = isFresh ? await buildRefDisplayNameMap(context.refMap) : new Map<string, string>();
    return buildViewModel(review.insights, review.summary ?? "", isFresh, displayNameByRef);
  }

  // Bundle §17 — nothing successful to show yet for this scope; report whichever in-flight/
  // failed state applies to the *current* fingerprint, if any.
  const job = await db.aiAdvisorJob.findFirst({
    where: { organisationId: params.organisationId, capability: "POST_MATCH_REVIEW", scopeType: "MATCH", scopeId: params.matchId, sourceFingerprint: currentFingerprint },
  });
  if (job?.status === "QUEUED" || job?.status === "RUNNING") return { status: "reviewing" };
  if (job?.status === "FAILED") return { status: "unavailable" };
  return null;
}

async function buildViewModel(
  reviewInsights: AiAdvisorInsight[],
  summary: string,
  isFresh: boolean,
  displayNameByRef: Map<string, string>,
): Promise<CompletedMatchAdvisorViewModel> {
  const suggestionInsights = reviewInsights.filter((i) => i.actionType === "CONFIRM_DEVELOPMENT_OBSERVATION" && i.actionPayload != null);
  const clarificationInsight = reviewInsights.find((i) => i.analysisRole === "EVIDENCE_GAP" && i.clarificationQuestion) ?? null;
  const sectionableInsights = reviewInsights.filter((i) => i.id !== clarificationInsight?.id && !suggestionInsights.some((s) => s.id === i.id));

  const insights: AdvisorInsightViewModel[] = SECTION_ORDER.flatMap((key) =>
    sectionableInsights
      .filter((i) => sectionKeyForRole(i.analysisRole) === key)
      .map((i) => ({
        sectionLabel: SECTION_LABELS[key],
        title: presentText(i.title, isFresh, displayNameByRef),
        body: presentText(i.body, isFresh, displayNameByRef),
        evidenceSources: evidenceSourcesFor(i.evidenceRefs),
      })),
  );

  const clarification: AdvisorClarificationViewModel | null = clarificationInsight
    ? {
        insightId: clarificationInsight.id,
        question: presentText(clarificationInsight.clarificationQuestion ?? "", isFresh, displayNameByRef),
        options: (Array.isArray(clarificationInsight.clarificationOptions) ? (clarificationInsight.clarificationOptions as unknown[]) : [])
          .filter((o): o is string => typeof o === "string")
          .map((o) => presentText(o, isFresh, displayNameByRef)),
        title: presentText(clarificationInsight.title, isFresh, displayNameByRef),
        body: presentText(clarificationInsight.body, isFresh, displayNameByRef),
      }
    : null;

  const suggestionPlayerIds = suggestionInsights
    .map((i) => (i.actionPayload as { playerId?: string } | null)?.playerId)
    .filter((id): id is string => typeof id === "string");
  const suggestionPlayers = suggestionPlayerIds.length
    ? await db.player.findMany({ where: { id: { in: suggestionPlayerIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const suggestionPlayerNameById = new Map(suggestionPlayers.map((p) => [p.id, `${p.firstName} ${p.lastName ?? ""}`.trim()]));

  const suggestions = suggestionInsights.flatMap((insight) => {
    const payload = insight.actionPayload as { playerId: string; category: string };
    // Real, stable DB id lookup — unlike ref-token resolution, safe regardless of `isFresh`.
    const playerName = suggestionPlayerNameById.get(payload.playerId);
    if (!playerName) return [];
    return [{ insightId: insight.id, title: `${playerName} · ${payload.category}`, body: presentText(insight.body, isFresh, displayNameByRef) }];
  });

  return { status: isFresh ? "fresh" : "stale", summary: presentText(summary, isFresh, displayNameByRef), insights, clarification, suggestions };
}
