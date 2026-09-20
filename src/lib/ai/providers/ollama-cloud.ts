import "server-only";
import type {
  AiProviderAdapter,
  ProviderModel,
  ProviderListModelsResult,
  ProviderProbeResult,
  ProviderExecuteRequest,
  ProviderExecuteResult,
  ProviderErrorCode,
} from "@/lib/ai/providers/provider-adapter";
import { runStandardProbe } from "@/lib/ai/providers/standard-probe";
import { guardedProviderFetch, readLimitedJsonBody, classifyProviderHttpStatus } from "@/lib/ai/providers/http-utils";
import { ADVISOR_RESPONSE_JSON_SCHEMA } from "@/lib/ai/contracts";
import { parseAdvisorResponse } from "@/lib/ai/response-validation";

/**
 * Ollama Cloud adapter (03_PROVIDER_ADAPTERS_AND_MODELS.md / 13_PROVIDER_API_REFERENCE.md).
 * Ollama Cloud has no server-enforced structured-output support, unlike the other four
 * providers — `supportsStructuredOutput: false` below is load-bearing, not decorative. The V1
 * execution contract instead: requests JSON via prompt instructions plus Ollama's basic
 * `format: "json"` mode (valid JSON, not schema-constrained), validates locally, and makes
 * exactly one bounded repair retry — using only the original input plus the validation failure
 * category, never the invalid raw output — before failing with `PROVIDER_OUTPUT_INVALID`.
 */

const BASE_URL = "https://ollama.com/api";

function authHeaders(credential: string): Record<string, string> {
  return { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" };
}

function buildSchemaInstructions(baseInstructions: string): string {
  return (
    `${baseInstructions}\n\nRespond with ONLY a single JSON object — no markdown code fences, ` +
    `no commentary before or after — that conforms exactly to this JSON Schema:\n` +
    JSON.stringify(ADVISOR_RESPONSE_JSON_SCHEMA)
  );
}

function buildRepairInstructions(baseInstructions: string, failureReason: string): string {
  return (
    `${buildSchemaInstructions(baseInstructions)}\n\nYour previous response failed validation ` +
    `(${failureReason}). Produce a corrected response for the same input, following the schema exactly this time.`
  );
}

async function listModels(credential: string): Promise<ProviderListModelsResult> {
  const result = await guardedProviderFetch(`${BASE_URL}/tags`, {
    method: "GET",
    headers: authHeaders(credential),
  });
  if (!result.ok) return { ok: false, errorCode: result.errorCode };

  if (!result.response.ok) {
    return { ok: false, errorCode: classifyProviderHttpStatus(result.response.status) };
  }

  const body = await readLimitedJsonBody(result.response);
  if (!body.ok) return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" };

  const entries = (body.body as { models?: unknown } | null)?.models;
  if (!Array.isArray(entries)) return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" };

  const models: ProviderModel[] = entries
    .filter((entry): entry is { name: string } => typeof entry === "object" && entry !== null && typeof (entry as { name?: unknown }).name === "string")
    .map((entry) => ({ id: entry.name }));

  if (models.length === 0) return { ok: false, errorCode: "PROVIDER_MODEL_LIST_EMPTY" };
  return { ok: true, models };
}

function extractMessageContent(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const content = (body as { message?: { content?: unknown } }).message?.content;
  return typeof content === "string" ? content : null;
}

type ChatCallResult =
  | { ok: true; raw: unknown; inputTokens?: number; outputTokens?: number }
  | { ok: false; errorCode: ProviderErrorCode };

async function callChat(credential: string, model: string, systemContent: string, userContent: string): Promise<ChatCallResult> {
  const result = await guardedProviderFetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: authHeaders(credential),
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!result.ok) return { ok: false, errorCode: result.errorCode };

  if (!result.response.ok) {
    return { ok: false, errorCode: classifyProviderHttpStatus(result.response.status) };
  }

  const body = await readLimitedJsonBody(result.response);
  if (!body.ok) return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" };

  const text = extractMessageContent(body.body);
  if (text === null) return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // A syntactically-invalid JSON body is exactly the failure class the repair retry exists
    // for — surface it as a normal (recoverable) schema failure, not a hard adapter error.
    return { ok: true, raw: { __unparsable: true } };
  }

  const usage = body.body as { prompt_eval_count?: unknown; eval_count?: unknown };
  const inputTokens = typeof usage.prompt_eval_count === "number" ? usage.prompt_eval_count : undefined;
  const outputTokens = typeof usage.eval_count === "number" ? usage.eval_count : undefined;

  return { ok: true, raw, inputTokens, outputTokens };
}

async function executeReview(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
  const startedAt = Date.now();
  const userContent = JSON.stringify(request.input);

  const first = await callChat(request.credential, request.model, buildSchemaInstructions(request.instructions), userContent);
  if (!first.ok) {
    return { ok: false, errorCode: first.errorCode, durationMs: Date.now() - startedAt };
  }

  const firstValidation = parseAdvisorResponse(first.raw);
  if (firstValidation.valid) {
    return { ok: true, raw: first.raw, inputTokens: first.inputTokens, outputTokens: first.outputTokens, durationMs: Date.now() - startedAt };
  }

  // Exactly one bounded repair retry — the original input again, plus the failure category,
  // never the invalid raw output (03_PROVIDER_ADAPTERS_AND_MODELS.md's Ollama execution contract).
  const second = await callChat(
    request.credential,
    request.model,
    buildRepairInstructions(request.instructions, firstValidation.reason),
    userContent,
  );
  const durationMs = Date.now() - startedAt;
  if (!second.ok) {
    return { ok: false, errorCode: second.errorCode, durationMs };
  }

  const secondValidation = parseAdvisorResponse(second.raw);
  if (!secondValidation.valid) {
    return { ok: false, errorCode: "PROVIDER_OUTPUT_INVALID", durationMs };
  }

  return { ok: true, raw: second.raw, inputTokens: second.inputTokens, outputTokens: second.outputTokens, durationMs };
}

async function probeModel(credential: string, modelId: string): Promise<ProviderProbeResult> {
  return runStandardProbe(ollamaCloudAdapter, credential, modelId);
}

export const ollamaCloudAdapter: AiProviderAdapter = {
  id: "ollama_cloud",
  label: "Ollama Cloud",
  credentialLabel: "API key",
  supportsStructuredOutput: false,
  listModels,
  probeModel,
  executeReview,
};
