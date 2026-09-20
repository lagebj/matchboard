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
 * OpenAI adapter (03_PROVIDER_ADAPTERS_AND_MODELS.md / 13_PROVIDER_API_REFERENCE.md). Uses the
 * Responses API with `store: false`, no tools, no conversation/previous-response linkage, no
 * streaming, and server-enforced strict JSON-schema structured output.
 */

const BASE_URL = "https://api.openai.com";

function authHeaders(credential: string): Record<string, string> {
  return { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" };
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

function extractOutputText(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    if ((item as { type?: unknown }).type !== "message") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      if ((part as { type?: unknown }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

async function executeReview(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
  const startedAt = Date.now();

  const result = await guardedProviderFetch(`${BASE_URL}/v1/responses`, {
    method: "POST",
    headers: authHeaders(request.credential),
    body: JSON.stringify({
      model: request.model,
      input: [
        { role: "system", content: request.instructions },
        { role: "user", content: JSON.stringify(request.input) },
      ],
      store: false,
      stream: false,
      text: {
        format: {
          type: "json_schema",
          name: "advisor_response",
          schema: ADVISOR_RESPONSE_JSON_SCHEMA,
          strict: true,
        },
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

  const text = extractOutputText(body.body);
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
  return runStandardProbe(openaiAdapter, credential, modelId);
}

export const openaiAdapter: AiProviderAdapter = {
  id: "openai",
  label: "OpenAI",
  credentialLabel: "API key",
  supportsStructuredOutput: true,
  listModels,
  probeModel,
  executeReview,
};
