import "server-only";

import { db } from "@/lib/db";
import { recordDeterministicExtraction } from "@/lib/evidence/qualitative-evidence-service";
import { resolveFootballMatchRefById } from "@/lib/evidence/football-match-ref";
import { triggerAiCapability } from "@/lib/ai/jobs/triggers";

/**
 * "Clarification / evidence-gap assistant" (ADR-0152 §14, bundle
 * `05_ASSISTANT_COACH_LEARNING_PIPELINE.md`). A pure domain service, not a "use server" action —
 * page-level authorization, audit logging, and `revalidatePath` belong to whichever route's own
 * action wrapper calls this (mirroring `runPostMatchLearning`/`recordDeterministicExtraction`
 * themselves being plain services beneath their own page actions). No UI calls this yet; wiring
 * it into the Advisor's presentation is a later slice's job (bundle §16-17).
 *
 * "Persist answer in AiInsightClarification. Convert answer into deterministic ... qualitative
 * evidence, then trigger [the originating capability] again through normal fingerprinting."
 * Deliberately generic over whichever capability produced the EVIDENCE_GAP insight (today only
 * `post_match_review`'s own prompt ever emits a non-null `analysisRole`, per ADR-0152 4a/4c, but
 * bundle §18 allows `weekly_team_review` the same role later) — this service does not hardcode
 * `POST_MATCH_REVIEW`.
 */

export type AnswerAiInsightClarificationInput = {
  organisationId: string;
  insightId: string;
  selectedOption?: string | null;
  answerText?: string | null;
  answeredBy: string;
};

export type AnswerAiInsightClarificationResult = { success: true } | { success: false; error: string };

export async function answerAiInsightClarification(input: AnswerAiInsightClarificationInput): Promise<AnswerAiInsightClarificationResult> {
  const selectedOption = input.selectedOption?.trim() || null;
  const answerText = input.answerText?.trim() || null;
  if (!selectedOption && !answerText) return { success: false, error: "Provide an answer before submitting." };

  const insight = await db.aiAdvisorInsight.findFirst({
    where: { id: input.insightId, organisationId: input.organisationId, state: "ACTIVE" },
    include: { review: { select: { capability: true, scopeType: true, scopeId: true } } },
  });
  if (!insight) return { success: false, error: "This clarification is no longer available." };
  if (insight.analysisRole !== "EVIDENCE_GAP" || !insight.clarificationQuestion) {
    return { success: false, error: "This insight has no clarifying question to answer." };
  }

  const options = Array.isArray(insight.clarificationOptions) ? (insight.clarificationOptions as unknown[]) : [];
  if (selectedOption && !options.includes(selectedOption)) {
    return { success: false, error: "Choose one of the offered options, or answer in your own words." };
  }

  await db.aiInsightClarification.upsert({
    where: { insightId: input.insightId },
    create: { organisationId: input.organisationId, insightId: input.insightId, selectedOption, answerText, answeredBy: input.answeredBy },
    update: { selectedOption, answerText, answeredBy: input.answeredBy },
  });

  // Bundle §9 "deterministic derivation" — League-only for now, same reason as every other
  // deterministic writer in this domain (`qualitative-evidence-service.ts`'s own doc comment):
  // an Event match has no `teamId`-equivalent for `recordDeterministicExtraction` to key off
  // (issue #691/#696). The answer is still persisted above regardless.
  if (insight.review.scopeType === "MATCH") {
    const ref = await resolveFootballMatchRefById(insight.review.scopeId);
    if (ref?.kind === "LEAGUE_MATCH") {
      const match = await db.match.findFirst({ where: { id: ref.matchId, organisationId: input.organisationId }, select: { teamId: true } });
      if (match) {
        const answerLine = [selectedOption, answerText].filter((s): s is string => s !== null).join(" — ");
        await recordDeterministicExtraction({
          organisationId: input.organisationId,
          teamId: match.teamId,
          sourceType: "AI_CLARIFICATION",
          sourceId: input.insightId,
          fingerprintPayload: { selectedOption, answerText },
          subject: { matchId: ref.matchId },
          observations: [
            {
              scope: insight.subjectType === "PLAYER_PAIR" ? "PAIR" : insight.subjectType === "PLAYER" ? "PLAYER" : "TEAM",
              phase: "GENERAL",
              polarity: "UNCERTAIN",
              explicitness: selectedOption ? "EXPLICIT" : "TENTATIVE",
              statement: `Clarifying "${insight.clarificationQuestion}": ${answerLine}`,
              playerId: insight.subjectType === "PLAYER" || insight.subjectType === "PLAYER_PAIR" ? insight.subjectId : undefined,
              secondaryPlayerId: insight.subjectType === "PLAYER_PAIR" ? insight.secondarySubjectId : undefined,
            },
          ],
        });
      }
    }
  }

  await triggerAiCapability({
    organisationId: input.organisationId,
    capability: insight.review.capability,
    scopeType: insight.review.scopeType,
    scopeId: insight.review.scopeId,
  });

  return { success: true };
}
