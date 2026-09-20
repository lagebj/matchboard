import "server-only";
import { advisorResponseSchema, type AdvisorResponse } from "@/lib/ai/contracts";

/**
 * Whole-response validation for a parsed provider result (06_AI_CAPABILITY_CONTRACTS.md
 * "Whole-response rejection" / 07_EXECUTION_PIPELINE.md "Provider output handling"). Three
 * ordered stages, each capable of rejecting the entire response — never a partial/salvaged
 * result:
 *
 * 1. schema — `parseAdvisorResponse()`, structural shape only, no external knowledge needed.
 * 2. semantic — `validateAdvisorSemantics()`, every subject/secondary/action ref must be one of
 *    the ephemeral refs this specific review's normalized context actually handed out.
 * 3. evidence — `validateAdvisorEvidenceRefs()`, every evidence ref must be one this specific
 *    review's normalized context actually produced.
 *
 * Stages 2 and 3 take their allowed-ref sets as parameters rather than looking them up
 * themselves: the normalized per-capability context builders that produce those sets
 * (`context/*.ts`) land in a later PR. This module's job is the validation mechanism, which does
 * not depend on which capability produced the input.
 */

export type AdvisorValidationFailureReason =
  | "SCHEMA_INVALID"
  | "UNKNOWN_SUBJECT_REF"
  | "UNKNOWN_EVIDENCE_REF"
  | "SUSPECTED_LEAKED_IDENTIFIER";

export type AdvisorValidationResult =
  | { valid: true; response: AdvisorResponse }
  | { valid: false; reason: AdvisorValidationFailureReason; detail: string };

// A raw Prisma cuid looks like a lowercase letter followed by ~20-30 more base36 characters.
// Ephemeral refs (P01, M01, ...) and evidence refs (fact:...) never match this shape, so this is
// a safe heuristic for "the provider echoed back something that looks like a leaked database ID"
// without false-positiving on the contract's own legitimate ref formats.
const SUSPECTED_DATABASE_ID_PATTERN = /\b[a-z][a-z0-9]{20,30}\b/;

/** Stage 1: pure structural validation, no external context required. */
export function parseAdvisorResponse(raw: unknown): AdvisorValidationResult {
  const parsed = advisorResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { valid: false, reason: "SCHEMA_INVALID", detail: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { valid: true, response: parsed.data };
}

/** Stage 2: every `subjectRef`/`secondarySubjectRef`/`suggestedAction.playerRef` must be a ref
 * this review's own normalized context actually issued — never a ref the provider invented, and
 * never a raw-ID-shaped string that happened to pass the ephemeral-ref regex. */
export function validateAdvisorSemantics(response: AdvisorResponse, allowedSubjectRefs: Set<string>): AdvisorValidationResult {
  for (const insight of response.insights) {
    for (const ref of [insight.subjectRef, insight.secondarySubjectRef, insight.suggestedAction?.playerRef]) {
      if (ref !== null && ref !== undefined && !allowedSubjectRefs.has(ref)) {
        return { valid: false, reason: "UNKNOWN_SUBJECT_REF", detail: `Unknown subject ref: ${ref}` };
      }
    }
  }

  if (containsSuspectedLeakedIdentifier(response)) {
    return { valid: false, reason: "SUSPECTED_LEAKED_IDENTIFIER", detail: "Response text contains a database-ID-shaped token" };
  }

  return { valid: true, response };
}

/** Stage 3: every evidence ref must be one this review's own normalized context actually
 * produced — an insight cannot cite evidence that was never in the input. */
export function validateAdvisorEvidenceRefs(response: AdvisorResponse, allowedEvidenceRefs: Set<string>): AdvisorValidationResult {
  for (const insight of response.insights) {
    for (const ref of insight.evidenceRefs) {
      if (!allowedEvidenceRefs.has(ref)) {
        return { valid: false, reason: "UNKNOWN_EVIDENCE_REF", detail: `Unknown evidence ref: ${ref}` };
      }
    }
  }
  return { valid: true, response };
}

/** Runs all three stages in order, short-circuiting on the first failure. */
export function validateAdvisorResponse(
  raw: unknown,
  allowed: { subjectRefs: Set<string>; evidenceRefs: Set<string> },
): AdvisorValidationResult {
  const schemaResult = parseAdvisorResponse(raw);
  if (!schemaResult.valid) return schemaResult;

  const semanticResult = validateAdvisorSemantics(schemaResult.response, allowed.subjectRefs);
  if (!semanticResult.valid) return semanticResult;

  return validateAdvisorEvidenceRefs(semanticResult.response, allowed.evidenceRefs);
}

function containsSuspectedLeakedIdentifier(response: AdvisorResponse): boolean {
  const texts = [response.summary, ...response.insights.flatMap((i) => [i.title, i.body])];
  return texts.some((text) => SUSPECTED_DATABASE_ID_PATTERN.test(text));
}
