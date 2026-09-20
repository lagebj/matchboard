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
 * Google Gemini adapter (03_PROVIDER_ADAPTERS_AND_MODELS.md / 13_PROVIDER_API_REFERENCE.md).
 * Uses the current native Gemini API (not the OpenAI-compatibility shim), `x-goog-api-key`
 * authentication, and JSON-schema structured output. No built-in tools, search/grounding,
 * files, Live API, or agents.
 */

const BASE_URL = "https://generativelanguage.googleapis.com";

function authHeaders(credential: string): Record<string, string> {
  return { "x-goog-api-key": credential, "Content-Type": "application/json" };
}

/**
 * Gemini's `responseSchema` accepts a restricted, OpenAPI-3.0-flavoured subset of JSON Schema,
 * not the full draft-2020-12 shape `z.toJSONSchema()` produces (07_EXECUTION_PIPELINE.md gives
 * no exact translation, so this is this adapter's own best-faith, minimal conversion — flagged,
 * like the request/response body shapes elsewhere in this programme, as needing verification
 * against a real credential before production go-live): strip the `$schema` meta-key Gemini
 * doesn't accept, and rewrite `const` (unsupported) as a single-value `enum`.
 */
function toGeminiResponseSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(toGeminiResponseSchema);
  }
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }
  const entries = Object.entries(schema as Record<string, unknown>).filter(([key]) => key !== "$schema");
  const result: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (key === "const") {
      result.enum = [value];
      continue;
    }
    result[key] = toGeminiResponseSchema(value);
  }
  return result;
}

/** Gemini model names come back as `models/gemini-2.5-pro`; every other adapter's model IDs are
 * bare, so this strips the `models/` prefix for consistency across the shared `ProviderModel`
 * shape. The bare name is also what Gemini's own `generateContent` path segment accepts. */
function stripModelsPrefix(name: string): string {
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

async function listModels(credential: string): Promise<ProviderListModelsResult> {
  const result = await guardedProviderFetch(`${BASE_URL}/v1beta/models`, {
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
    .filter((entry): entry is { name: string; supportedGenerationMethods?: unknown; displayName?: unknown } => {
      if (typeof entry !== "object" || entry === null || typeof (entry as { name?: unknown }).name !== "string") return false;
      const methods = (entry as { supportedGenerationMethods?: unknown }).supportedGenerationMethods;
      return Array.isArray(methods) && methods.includes("generateContent");
    })
    .map((entry) => ({
      id: stripModelsPrefix(entry.name),
      displayName: typeof entry.displayName === "string" ? entry.displayName : undefined,
    }));

  if (models.length === 0) return { ok: false, errorCode: "PROVIDER_MODEL_LIST_EMPTY" };
  return { ok: true, models };
}

function extractResponseText(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (typeof part === "object" && part !== null && typeof (part as { text?: unknown }).text === "string") {
      return (part as { text: string }).text;
    }
  }
  return null;
}

async function executeReview(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
  const startedAt = Date.now();

  const result = await guardedProviderFetch(`${BASE_URL}/v1beta/models/${encodeURIComponent(request.model)}:generateContent`, {
    method: "POST",
    headers: authHeaders(request.credential),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: JSON.stringify(request.input) }] }],
      systemInstruction: { parts: [{ text: request.instructions }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiResponseSchema(ADVISOR_RESPONSE_JSON_SCHEMA),
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

  const usage = (body.body as { usageMetadata?: unknown } | null)?.usageMetadata;
  const inputTokens =
    typeof (usage as { promptTokenCount?: unknown })?.promptTokenCount === "number" ? (usage as { promptTokenCount: number }).promptTokenCount : undefined;
  const outputTokens =
    typeof (usage as { candidatesTokenCount?: unknown })?.candidatesTokenCount === "number"
      ? (usage as { candidatesTokenCount: number }).candidatesTokenCount
      : undefined;

  return { ok: true, raw, inputTokens, outputTokens, durationMs };
}

async function probeModel(credential: string, modelId: string): Promise<ProviderProbeResult> {
  return runStandardProbe(googleGeminiAdapter, credential, modelId);
}

export const googleGeminiAdapter: AiProviderAdapter = {
  id: "google_gemini",
  label: "Google Gemini",
  credentialLabel: "Gemini API key",
  supportsStructuredOutput: true,
  listModels,
  probeModel,
  executeReview,
};
