import "server-only";
import type { AiProviderWireId } from "@/lib/ai/provider-registry";

/**
 * The server-only provider adapter interface (03_PROVIDER_ADAPTERS_AND_MODELS.md). Every real
 * adapter (openai.ts, anthropic.ts, google-gemini.ts, mistral.ts, ollama-cloud.ts — the last
 * three land in a following PR) and the fake adapter used by pipeline tests implement this same
 * shape. No adapter ever receives an organisation-configured base URL — every adapter's host is
 * a literal from `provider-registry.ts`.
 */

export interface ProviderModel {
  id: string;
  displayName?: string;
  description?: string;
}

/** Normalized failure codes shared across every adapter (04_ORG_CONNECTION_FLOW.md "Normalized
 * errors" + 03_PROVIDER_ADAPTERS_AND_MODELS.md's Ollama-specific terminal code). A transient
 * failure (timeout, 5xx, network error) must never be reported as `PROVIDER_AUTH_FAILED` — see
 * 04_ORG_CONNECTION_FLOW.md: "Transient failures must not be converted to PROVIDER_AUTH_FAILED." */
export type ProviderErrorCode =
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_ACCESS_DENIED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_MODEL_LIST_EMPTY"
  | "PROVIDER_RESPONSE_INVALID"
  | "PROVIDER_OUTPUT_INVALID";

export type ProviderListModelsResult =
  | { ok: true; models: ProviderModel[] }
  | { ok: false; errorCode: ProviderErrorCode };

export type ProviderProbeResult = { ok: true } | { ok: false; errorCode: ProviderErrorCode };

export interface ProviderExecuteRequest {
  credential: string;
  model: string;
  /** Stable doctrine plus capability-specific instructions, already composed by the caller — the
   * adapter never sees coach-authored free text (07_EXECUTION_PIPELINE.md "Prompt layering"). */
  instructions: string;
  /** The normalized, pseudonymized structured facts for this operation — the only "content" a
   * provider ever receives beyond `instructions`. */
  input: unknown;
}

export type ProviderExecuteResult =
  | { ok: true; raw: unknown; inputTokens?: number; outputTokens?: number; durationMs: number }
  | { ok: false; errorCode: ProviderErrorCode; durationMs: number };

export interface AiProviderAdapter {
  readonly id: AiProviderWireId;
  readonly label: string;
  readonly credentialLabel: string;
  readonly supportsStructuredOutput: boolean;
  listModels(credential: string): Promise<ProviderListModelsResult>;
  probeModel(credential: string, modelId: string): Promise<ProviderProbeResult>;
  executeReview(request: ProviderExecuteRequest): Promise<ProviderExecuteResult>;
}

/** The synthetic capability-probe input (03_PROVIDER_ADAPTERS_AND_MODELS.md "Model selection
 * stage") — no real Matchboard data, used only to prove a model can complete the Advisor schema
 * request at all before it may be selected. */
export const SYNTHETIC_PROBE_INSTRUCTIONS =
  "You are the Matchboard AI Advisor capability probe. Given the supplied synthetic player " +
  "data, return a response that conforms exactly to the required JSON schema. This is a " +
  "connectivity/compatibility check, not real football data — keep the response brief.";

export const SYNTHETIC_PROBE_INPUT = {
  players: [
    { ref: "P01", minutes: 20 },
    { ref: "P02", minutes: 40 },
  ],
};
