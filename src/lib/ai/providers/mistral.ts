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
 * Mistral AI adapter (03_PROVIDER_ADAPTERS_AND_MODELS.md / 13_PROVIDER_API_REFERENCE.md).
 * OpenAI-compatible chat-completions shape, `response_format.type = "json_schema"` structured
 * output. Model listing filters out archived/non-chat-capable entries where that capability
 * metadata is actually present on the entry — never assumes an unlabeled model is unsupported.
 */

const BASE_URL = "https://api.mistral.ai";

function authHeaders(credential: string): Record<string, string> {
  return { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" };
}

interface MistralModelEntry {
  id: string;
  capabilities?: { completion_chat?: unknown };
  deprecation?: unknown;
}

function isUsableMistralModel(entry: MistralModelEntry): boolean {
  if (entry.capabilities && "completion_chat" in entry.capabilities && entry.capabilities.completion_chat === false) {
    return false;
  }
  if (entry.deprecation) {
    return false;
  }
  return true;
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
    .filter((entry): entry is MistralModelEntry => typeof entry === "object" && entry !== null && typeof (entry as { id?: unknown }).id === "string")
    .filter(isUsableMistralModel)
    .map((entry) => ({ id: entry.id }));

  if (models.length === 0) return { ok: false, errorCode: "PROVIDER_MODEL_LIST_EMPTY" };
  return { ok: true, models };
}

function extractMessageContent(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
  return typeof content === "string" ? content : null;
}

async function executeReview(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
  const startedAt = Date.now();

  const result = await guardedProviderFetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(request.credential),
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: "system", content: request.instructions },
        { role: "user", content: JSON.stringify(request.input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "advisor_response", schema: ADVISOR_RESPONSE_JSON_SCHEMA, strict: true },
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

  const text = extractMessageContent(body.body);
  if (text === null) return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID", durationMs };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID", durationMs };
  }

  const usage = (body.body as { usage?: unknown } | null)?.usage;
  const inputTokens = typeof (usage as { prompt_tokens?: unknown })?.prompt_tokens === "number" ? (usage as { prompt_tokens: number }).prompt_tokens : undefined;
  const outputTokens =
    typeof (usage as { completion_tokens?: unknown })?.completion_tokens === "number" ? (usage as { completion_tokens: number }).completion_tokens : undefined;

  return { ok: true, raw, inputTokens, outputTokens, durationMs };
}

async function probeModel(credential: string, modelId: string): Promise<ProviderProbeResult> {
  return runStandardProbe(mistralAdapter, credential, modelId);
}

export const mistralAdapter: AiProviderAdapter = {
  id: "mistral",
  label: "Mistral AI",
  credentialLabel: "API key",
  supportsStructuredOutput: true,
  listModels,
  probeModel,
  executeReview,
};
