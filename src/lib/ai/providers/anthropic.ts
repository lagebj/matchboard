import "server-only";
import type {
  AiProviderAdapter,
  ProviderModel,
  ProviderListModelsResult,
  ProviderProbeResult,
  ProviderExecuteRequest,
  ProviderExecuteResult,
} from "@/lib/ai/providers/provider-adapter";
import { runStandardProbe } from "@/lib/ai/providers/standard-probe";
import { guardedProviderFetch, readLimitedJsonBody, classifyProviderHttpStatus } from "@/lib/ai/providers/http-utils";
import { ADVISOR_RESPONSE_JSON_SCHEMA } from "@/lib/ai/contracts";

/**
 * Anthropic / Claude adapter (03_PROVIDER_ADAPTERS_AND_MODELS.md / 13_PROVIDER_API_REFERENCE.md).
 * Uses `Authorization: Bearer` (not the legacy `x-api-key` form — one consistent auth shape),
 * the required `anthropic-version` header, and `output_config.format` structured output. Never
 * creates a provider-side agent/session.
 */

const BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_RESPONSE_TOKENS = 2048;

function authHeaders(credential: string): Record<string, string> {
  return {
    Authorization: `Bearer ${credential}`,
    "anthropic-version": ANTHROPIC_VERSION,
    "Content-Type": "application/json",
  };
}

async function listModels(credential: string): Promise<ProviderListModelsResult> {
  const result = await guardedProviderFetch(`${BASE_URL}/v1/models`, {
    method: "GET",
    headers: authHeaders(credential),
  });
  if (!result.ok) return { ok: false, errorCode: result.errorCode };

  if (!result.response.ok) {
    return { ok: false, errorCode: classifyProviderHttpStatus(result.response.status) };
  }

  const body = await readLimitedJsonBody(result.response);
  if (!body.ok) return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" };

  const data = (body.body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" };

  const models: ProviderModel[] = data
    .filter((entry): entry is { id: string } => typeof entry === "object" && entry !== null && typeof (entry as { id?: unknown }).id === "string")
    .map((entry) => ({ id: entry.id }));

  if (models.length === 0) return { ok: false, errorCode: "PROVIDER_MODEL_LIST_EMPTY" };
  return { ok: true, models };
}

function extractResponseText(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;

  for (const part of content) {
    if (typeof part !== "object" || part === null) continue;
    if ((part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string") {
      return (part as { text: string }).text;
    }
  }
  return null;
}

async function executeReview(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
  const startedAt = Date.now();

  const result = await guardedProviderFetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: authHeaders(request.credential),
    body: JSON.stringify({
      model: request.model,
      max_tokens: MAX_RESPONSE_TOKENS,
      system: request.instructions,
      messages: [{ role: "user", content: JSON.stringify(request.input) }],
      output_config: {
        format: { type: "json_schema", schema: ADVISOR_RESPONSE_JSON_SCHEMA },
      },
    }),
  });

  const durationMs = Date.now() - startedAt;
  if (!result.ok) return { ok: false, errorCode: result.errorCode, durationMs };

  if (!result.response.ok) {
    return { ok: false, errorCode: classifyProviderHttpStatus(result.response.status), durationMs };
  }

  const body = await readLimitedJsonBody(result.response);
  if (!body.ok) return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID", durationMs };

  const text = extractResponseText(body.body);
  if (text === null) return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID", durationMs };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID", durationMs };
  }

  const usage = (body.body as { usage?: unknown } | null)?.usage;
  const inputTokens = typeof (usage as { input_tokens?: unknown })?.input_tokens === "number" ? (usage as { input_tokens: number }).input_tokens : undefined;
  const outputTokens = typeof (usage as { output_tokens?: unknown })?.output_tokens === "number" ? (usage as { output_tokens: number }).output_tokens : undefined;

  return { ok: true, raw, inputTokens, outputTokens, durationMs };
}

async function probeModel(credential: string, modelId: string): Promise<ProviderProbeResult> {
  return runStandardProbe(anthropicAdapter, credential, modelId);
}

export const anthropicAdapter: AiProviderAdapter = {
  id: "anthropic",
  label: "Anthropic / Claude",
  credentialLabel: "API key",
  supportsStructuredOutput: true,
  listModels,
  probeModel,
  executeReview,
};
