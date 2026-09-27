import { z } from "zod";

/**
 * AI_STRUCTURED extraction output contract (ADR-0152 §4, bundle
 * `04_QUALITATIVE_EVIDENCE_MODEL.md` §13). A parsing mechanism, not inference — the model's job
 * is to structure claims already present in the coach's own text, never to add, advise, or
 * infer. No adapter or runner ever sees this schema's shape decided ad hoc; it is the one
 * contract every extraction call is validated against, mirroring how `response-validation.ts`
 * is the one contract every Advisor review is validated against.
 */

export const EXTRACTION_CONTRACT_VERSION = "1" as const;
export const MAX_EXTRACTION_OBSERVATIONS = 8;
export const MAX_EXTRACTION_STATEMENT_CHARS = 500;

const SCOPE_VALUES = ["TEAM", "PLAYER", "OPPONENT", "PAIR"] as const;
const PHASE_VALUES = [
  "GENERAL",
  "BUILD_UP",
  "PROGRESSION",
  "CHANCE_CREATION",
  "PRESSING",
  "DEFENSIVE_SHAPE",
  "DEFENSIVE_TRANSITION",
  "ATTACKING_TRANSITION",
  "SET_PLAYS",
] as const;
const POLARITY_VALUES = ["WORKING", "PROBLEM", "NEUTRAL", "UNCERTAIN"] as const;
const EXPLICITNESS_VALUES = ["EXPLICIT", "TENTATIVE"] as const;
const PERIOD_VALUES = ["BEFORE", "FIRST_HALF", "HALF_TIME", "SECOND_HALF", "EXTRA_FIRST_HALF", "EXTRA_HALF_TIME", "EXTRA_SECOND_HALF", "FULL_TIME"] as const;

export const extractionObservationSchema = z
  .object({
    scope: z.enum(SCOPE_VALUES),
    playerRef: z.string().min(1).nullable(),
    secondaryPlayerRef: z.string().min(1).nullable(),
    phase: z.enum(PHASE_VALUES),
    polarity: z.enum(POLARITY_VALUES),
    period: z.enum(PERIOD_VALUES).nullable(),
    statement: z.string().min(1).max(MAX_EXTRACTION_STATEMENT_CHARS),
    explicitness: z.enum(EXPLICITNESS_VALUES),
  })
  .strict();

export const extractionResponseSchema = z
  .object({
    version: z.literal(EXTRACTION_CONTRACT_VERSION),
    observations: z.array(extractionObservationSchema).max(MAX_EXTRACTION_OBSERVATIONS),
  })
  .strict();

export type ExtractionObservation = z.infer<typeof extractionObservationSchema>;
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

export function safeParseExtractionResponse(raw: unknown) {
  return extractionResponseSchema.safeParse(raw);
}

/**
 * Semantic validation beyond shape (bundle §5: "PAIR is supported only when two known
 * persistent players are explicitly identified. Never bind vague pronouns to players."). Every
 * source this slice wires (BOTH_CHANGED, "Anything else") supplies zero player refs in its
 * input — so for those, any PLAYER/PAIR-scoped observation is always ungroundable, and the whole
 * response is rejected, matching `validateAdvisorResponse`'s established all-or-nothing
 * philosophy for an unresolvable ref (07_EXECUTION_PIPELINE.md: "no provider output bypasses
 * local validation").
 */
export function validateExtractionSemantics(
  response: ExtractionResponse,
  allowedPlayerRefs: ReadonlySet<string>,
): { valid: true } | { valid: false; reason: string } {
  for (const obs of response.observations) {
    if ((obs.scope === "PLAYER" || obs.scope === "PAIR") && (!obs.playerRef || !allowedPlayerRefs.has(obs.playerRef))) {
      return { valid: false, reason: `Observation with scope ${obs.scope} has no resolvable playerRef.` };
    }
    if (obs.scope === "PAIR" && (!obs.secondaryPlayerRef || !allowedPlayerRefs.has(obs.secondaryPlayerRef) || obs.secondaryPlayerRef === obs.playerRef)) {
      return { valid: false, reason: "PAIR scope requires two distinct resolvable players." };
    }
  }
  return { valid: true };
}

/** Bundle §13 "Prompt rules" 1-10, verbatim in spirit. Stable across every extraction call —
 * never composed with coach-authored text (the coach's text is `input`, not `instructions`,
 * mirroring `AI_ADVISOR_STABLE_DOCTRINE`'s own separation). */
export const EXTRACTION_STABLE_INSTRUCTIONS = `
You structure a coach's own written observation about a football match into discrete,
verifiable claims. You are a parsing mechanism, not an analyst.

Rules:
1. Extract only claims present in the text -- never add advice or recommendations.
2. Never infer a specific player's identity from an ambiguous or pronoun-only reference; use a
   player reference only when one was explicitly supplied to you in the input.
3. Never infer motive, attitude, intelligence, or potential.
4. Preserve uncertainty in the coach's own wording by marking that observation TENTATIVE, rather
   than resolving the uncertainty yourself.
5. Split into multiple observations only when that genuinely separates distinct claims.
6. Use phase GENERAL when the tactical phase is not clear from the text.
7. Use polarity NEUTRAL when the text's sentiment is not clear.
8. Producing no observations at all is an acceptable, correct result -- never invent one merely
   to have something to return.
9. The match result itself (who won, the scoreline) is not qualitative evidence -- do not
   restate it as an observation.
10. Return strictly the JSON contract you were given -- no prose, no markdown, no commentary.
`.trim();
