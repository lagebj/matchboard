import "server-only";
import type { AiAdvisorCapability, AiInsightSubjectType } from "@/generated/prisma/client";
import type { JsonValue } from "@/lib/ai/fingerprints";

/**
 * The capability-handler contract every capability's `context/*.ts` builder (one per capability,
 * a later PR — round_review, lineup_review, match_prep, post_match_review, weekly_team_review)
 * implements and registers here. This module defines the contract and a get/set/reset registry;
 * the job runner (`runner.ts`) consumes it without knowing anything capability-specific.
 */

/** What one ephemeral ref (`P01`, `M01`, ...) resolves back to, inside this process only, for
 * exactly the duration of one review — 06_AI_CAPABILITY_CONTRACTS.md "External-ref mapping":
 * "The map exists only inside the Matchboard execution process for that review. It is never
 * sent externally." */
export interface AiCapabilityRefTarget {
  subjectType: AiInsightSubjectType;
  entityId: string;
}

export interface AiCapabilityContext {
  /** The fully normalized, UI-stripped, array-sorted fact object sent to the provider as
   * `input` — also what `computeSourceFingerprint()` hashes. */
  normalizedContext: JsonValue;
  /** Capability-specific instructions only — the shared stable doctrine
   * (`AI_ADVISOR_STABLE_DOCTRINE`) is prepended by the runner, not repeated here. */
  instructions: string;
  /** Every ephemeral ref this context handed out, and what it resolves to. Doubles as the
   * "allowed subject refs" set for `response-validation.ts`'s semantic-validation stage. */
  refMap: Map<string, AiCapabilityRefTarget>;
  /** Every `fact:...` evidence ref this context actually produced — the "allowed evidence refs"
   * set for `response-validation.ts`'s evidence-validation stage. */
  evidenceRefs: Set<string>;
}

export interface AiCapabilityHandler {
  readonly capability: AiAdvisorCapability;
  /**
   * Builds this review's context, or returns `null` if the scope is no longer eligible for
   * review at all (e.g. the match/round was deleted, cancelled, or otherwise moved out of the
   * state that made it reviewable in the first place) — the runner then fails the job safely
   * rather than calling a provider with stale/invalid data.
   */
  buildContext(params: { organisationId: string; scopeId: string }): Promise<AiCapabilityContext | null>;
}

const handlers = new Map<AiAdvisorCapability, AiCapabilityHandler>();

export function registerAiCapabilityHandler(handler: AiCapabilityHandler): void {
  handlers.set(handler.capability, handler);
}

export function getAiCapabilityHandler(capability: AiAdvisorCapability): AiCapabilityHandler | undefined {
  return handlers.get(capability);
}

/** Test-only: clears every registered handler so one test file's registrations can't leak into
 * another's. Also useful if a real handler module is ever hot-reloaded and needs to re-register
 * cleanly rather than accumulate duplicate registrations across reloads. */
export function resetAiCapabilityHandlers(): void {
  handlers.clear();
}
