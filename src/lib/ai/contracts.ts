import "server-only";
import { z } from "zod";
import { AiInsightKind as PrismaAiInsightKind, AiInsightAnalysisRole as PrismaAiInsightAnalysisRole } from "@/generated/prisma/client";

/**
 * The shared AI Advisor response contract (06_AI_CAPABILITY_CONTRACTS.md, extended by ADR-0152
 * §5 contract v2). Every provider adapter — regardless of how it gets structured output out of
 * its provider (native JSON schema, or Ollama Cloud's prompt-constrained-JSON-plus-local-
 * validation path) — parses into exactly this shape. Nothing downstream of
 * `response-validation.ts` ever sees a provider-specific type.
 */

export const AI_CONTRACT_VERSION = "2";
export const MAX_INSIGHTS = 10;

/** `P01`, `M01`, ... — the only entity-reference shape a provider may ever see or emit. Never a
 * Matchboard database ID. */
export const EPHEMERAL_REF_PATTERN = /^[A-Z]\d{2,4}$/;

/** `fact:<category>:<ref>[:<sub>]`, e.g. `fact:opportunity:P01:week`,
 * `fact:planned-position:P03:slot-2` (06_AI_CAPABILITY_CONTRACTS.md "Evidence references"). */
export const EVIDENCE_REF_PATTERN = /^fact:[a-z][a-z-]*:[A-Za-z0-9]+(?::[A-Za-z0-9-]+)?$/;

export const AI_INSIGHT_KIND_WIRE_VALUES = ["observation", "attention", "opportunity", "development_suggestion"] as const;
export type AiInsightKindWire = (typeof AI_INSIGHT_KIND_WIRE_VALUES)[number];

const WIRE_TO_PRISMA_INSIGHT_KIND: Record<AiInsightKindWire, PrismaAiInsightKind> = {
  observation: PrismaAiInsightKind.OBSERVATION,
  attention: PrismaAiInsightKind.ATTENTION,
  opportunity: PrismaAiInsightKind.OPPORTUNITY,
  development_suggestion: PrismaAiInsightKind.DEVELOPMENT_SUGGESTION,
};

export function toPrismaAiInsightKind(kind: AiInsightKindWire): PrismaAiInsightKind {
  return WIRE_TO_PRISMA_INSIGHT_KIND[kind];
}

const ephemeralRefSchema = z.string().regex(EPHEMERAL_REF_PATTERN, "must be an ephemeral ref like P01");
const evidenceRefSchema = z.string().regex(EVIDENCE_REF_PATTERN, "must be a fact:... evidence reference");

/** The one mutating-adjacent action shape a provider may propose. It is never applied
 * automatically — 01_LOCKED_DECISIONS.md: "becomes canonical only after explicit coach
 * confirmation through the existing development/evidence workflow." */
export const confirmDevelopmentObservationActionSchema = z.object({
  type: z.literal("confirm_development_observation"),
  playerRef: ephemeralRefSchema,
  category: z.string().min(1).max(200),
  observation: z.string().min(1).max(2000),
});

export type ConfirmDevelopmentObservationAction = z.infer<typeof confirmDevelopmentObservationActionSchema>;

/** ADR-0152 §5 contract v2 — plan-vs-reality classification. `null` for every capability that
 * hasn't been explicitly upgraded to reason about it yet (bundle §3: "non-post-match
 * capabilities may use null unless explicitly upgraded") — never invented just to fill the
 * field. */
export const ANALYSIS_ROLE_WIRE_VALUES = [
  "SUPPORTED",
  "CONTRADICTED",
  "UNRESOLVED",
  "SURPRISING",
  "RECURRING_PATTERN",
  "NEXT_FOCUS",
  "EVIDENCE_GAP",
] as const;
export type AnalysisRoleWire = (typeof ANALYSIS_ROLE_WIRE_VALUES)[number];

const WIRE_TO_PRISMA_ANALYSIS_ROLE: Record<AnalysisRoleWire, PrismaAiInsightAnalysisRole> = {
  SUPPORTED: PrismaAiInsightAnalysisRole.SUPPORTED,
  CONTRADICTED: PrismaAiInsightAnalysisRole.CONTRADICTED,
  UNRESOLVED: PrismaAiInsightAnalysisRole.UNRESOLVED,
  SURPRISING: PrismaAiInsightAnalysisRole.SURPRISING,
  RECURRING_PATTERN: PrismaAiInsightAnalysisRole.RECURRING_PATTERN,
  NEXT_FOCUS: PrismaAiInsightAnalysisRole.NEXT_FOCUS,
  EVIDENCE_GAP: PrismaAiInsightAnalysisRole.EVIDENCE_GAP,
};

export function toPrismaAnalysisRole(role: AnalysisRoleWire): PrismaAiInsightAnalysisRole {
  return WIRE_TO_PRISMA_ANALYSIS_ROLE[role];
}

/** ADR-0152 §5 contract v2 — bundle §14 "at most one active clarification per match review".
 * The one-per-response half of that rule is enforced by `advisorResponseSchema`'s own refine
 * below; this schema only shapes a single prompt. */
export const clarificationPromptSchema = z.object({
  question: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(120)).max(4),
});

export type ClarificationPrompt = z.infer<typeof clarificationPromptSchema>;

export const advisorInsightSchema = z
  .object({
    kind: z.enum(AI_INSIGHT_KIND_WIRE_VALUES),
    subjectRef: ephemeralRefSchema.nullable(),
    secondarySubjectRef: ephemeralRefSchema.nullable(),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(2000),
    evidenceRefs: z.array(evidenceRefSchema).min(1).max(20),
    suggestedAction: confirmDevelopmentObservationActionSchema.nullable(),
    analysisRole: z.enum(ANALYSIS_ROLE_WIRE_VALUES).nullable(),
    clarificationPrompt: clarificationPromptSchema.nullable(),
  })
  // Bundle §3: "clarificationPrompt is non-null only for EVIDENCE_GAP" — and the converse: an
  // EVIDENCE_GAP's whole purpose is asking the one clarifying question, so it must carry one.
  .refine((insight) => (insight.clarificationPrompt !== null) === (insight.analysisRole === "EVIDENCE_GAP"), {
    message: "clarificationPrompt must be set if and only if analysisRole is EVIDENCE_GAP",
    path: ["clarificationPrompt"],
  });

export type AdvisorInsight = z.infer<typeof advisorInsightSchema>;

export const advisorResponseSchema = z
  .object({
    contractVersion: z.literal(AI_CONTRACT_VERSION),
    summary: z.string().min(1).max(2000),
    insights: z.array(advisorInsightSchema).max(MAX_INSIGHTS),
  })
  // Bundle §14: "at most one active clarification per match review."
  .refine((response) => response.insights.filter((i) => i.analysisRole === "EVIDENCE_GAP").length <= 1, {
    message: "At most one EVIDENCE_GAP insight is allowed per response",
    path: ["insights"],
  });

export type AdvisorResponse = z.infer<typeof advisorResponseSchema>;

/** JSON Schema form of `advisorResponseSchema`, for providers that accept a server-enforced
 * structured-output schema (every adapter except Ollama Cloud — see
 * 03_PROVIDER_ADAPTERS_AND_MODELS.md). Computed once; the schema is static. */
export const ADVISOR_RESPONSE_JSON_SCHEMA = z.toJSONSchema(advisorResponseSchema);

/**
 * The Assistant Coach hypothesis response contract (ADR-0155 step B7, source bundle §07's
 * `schemas/assistant-coach-hypotheses.schema.json`). Deliberately NOT a v2 of
 * `advisorResponseSchema` above — ADR-0155 §8 records why: that contract's shape has no field
 * for a hypothesis's uncertainty or its supporting/contradicting evidence, and widening it in
 * place would affect every existing capability's consumers for a change only this one needs.
 *
 * Evidence refs here are `{kind, id}` objects matching
 * `src/lib/development-context/types.ts`'s `EvidenceRef` shape exactly — a different convention
 * from `advisorResponseSchema`'s `fact:...` string refs, because Assistant Coach's evidence pack
 * is built from `DerivedMeasurement`/`DerivedTrend` rows, which already carry structured
 * `EvidenceRef[]` provenance; there is nothing to gain from re-encoding it as a string.
 */
export const ASSISTANT_COACH_CONTRACT_VERSION = "1.0";
export const MAX_ASSISTANT_COACH_HYPOTHESES = 6;

export const ASSISTANT_COACH_EVIDENCE_REF_KINDS = [
  "MATCH_EVENT",
  "ACTUAL_POSITION_INTERVAL",
  "QUALITATIVE_OBSERVATION",
  "HUMAN_ASSESSMENT",
  "MATCH_CONTEXT",
  "DERIVED_MEASUREMENT",
  "DERIVED_TREND",
] as const;

const assistantCoachEvidenceRefSchema = z.object({
  kind: z.enum(ASSISTANT_COACH_EVIDENCE_REF_KINDS),
  id: z.string().min(1),
});

export const ASSISTANT_COACH_UNCERTAINTY_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
export type AssistantCoachUncertaintyWire = (typeof ASSISTANT_COACH_UNCERTAINTY_VALUES)[number];

export const assistantCoachHypothesisSchema = z.object({
  statement: z.string().min(1).max(2000),
  uncertainty: z.enum(ASSISTANT_COACH_UNCERTAINTY_VALUES),
  supportingRefs: z.array(assistantCoachEvidenceRefSchema),
  contradictingRefs: z.array(assistantCoachEvidenceRefSchema),
  missingEvidence: z.array(z.string().min(1).max(300)),
});

export type AssistantCoachHypothesisWire = z.infer<typeof assistantCoachHypothesisSchema>;

export const assistantCoachHypothesesResponseSchema = z.object({
  schemaVersion: z.literal(ASSISTANT_COACH_CONTRACT_VERSION),
  hypotheses: z.array(assistantCoachHypothesisSchema).max(MAX_ASSISTANT_COACH_HYPOTHESES),
});

export type AssistantCoachHypothesesResponse = z.infer<typeof assistantCoachHypothesesResponseSchema>;

/** JSON Schema form, for providers that accept a server-enforced structured-output schema. */
export const ASSISTANT_COACH_HYPOTHESES_JSON_SCHEMA = z.toJSONSchema(assistantCoachHypothesesResponseSchema);
