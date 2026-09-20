import "server-only";
import { z } from "zod";
import { AiInsightKind as PrismaAiInsightKind } from "@/generated/prisma/client";

/**
 * The shared AI Advisor response contract (06_AI_CAPABILITY_CONTRACTS.md). Every provider
 * adapter — regardless of how it gets structured output out of its provider (native JSON schema,
 * or Ollama Cloud's prompt-constrained-JSON-plus-local-validation path) — parses into exactly
 * this shape. Nothing downstream of `response-validation.ts` ever sees a provider-specific type.
 */

export const AI_CONTRACT_VERSION = "1";
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

export const advisorInsightSchema = z.object({
  kind: z.enum(AI_INSIGHT_KIND_WIRE_VALUES),
  subjectRef: ephemeralRefSchema.nullable(),
  secondarySubjectRef: ephemeralRefSchema.nullable(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  evidenceRefs: z.array(evidenceRefSchema).min(1).max(20),
  suggestedAction: confirmDevelopmentObservationActionSchema.nullable(),
});

export type AdvisorInsight = z.infer<typeof advisorInsightSchema>;

export const advisorResponseSchema = z.object({
  contractVersion: z.literal(AI_CONTRACT_VERSION),
  summary: z.string().min(1).max(2000),
  insights: z.array(advisorInsightSchema).max(MAX_INSIGHTS),
});

export type AdvisorResponse = z.infer<typeof advisorResponseSchema>;
