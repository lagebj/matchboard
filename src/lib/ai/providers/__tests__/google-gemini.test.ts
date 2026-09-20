import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { googleGeminiAdapter } from "@/lib/ai/providers/google-gemini";

function fakeResponse(init: { ok?: boolean; status?: number; json?: unknown }): Response {
  return {
    type: "basic",
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(init.json ?? {}),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ai/providers/google-gemini: adapter identity", () => {
  it("is registered under the locked provider ID with structured output support", () => {
    expect(googleGeminiAdapter.id).toBe("google_gemini");
    expect(googleGeminiAdapter.supportsStructuredOutput).toBe(true);
    expect(googleGeminiAdapter.credentialLabel).toBe("Gemini API key");
  });
});

describe("ai/providers/google-gemini: listModels", () => {
  it("returns only models supporting generateContent, with the models/ prefix stripped", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({
        json: {
          models: [
            { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"], displayName: "Gemini 2.5 Pro" },
            { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
          ],
        },
      }),
    );
    const result = await googleGeminiAdapter.listModels("gk-test");
    expect(result).toEqual({ ok: true, models: [{ id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" }] });
  });

  it("sends the credential via x-goog-api-key, not Authorization", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { models: [{ name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] }] } }));
    await googleGeminiAdapter.listModels("gk-test");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models");
    expect(init?.headers).toMatchObject({ "x-goog-api-key": "gk-test" });
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("fails with PROVIDER_MODEL_LIST_EMPTY when nothing supports generateContent", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { models: [{ name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] }] } }));
    const result = await googleGeminiAdapter.listModels("gk-test");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_MODEL_LIST_EMPTY" });
  });

  it("normalizes a 401 to PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 401 }));
    const result = await googleGeminiAdapter.listModels("gk-bad");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_AUTH_FAILED" });
  });
});

describe("ai/providers/google-gemini: executeReview", () => {
  const request = { credential: "gk-test", model: "gemini-2.5-pro", instructions: "doctrine", input: { players: [] } };

  it("extracts the JSON payload from a well-formed generateContent result", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({
        json: {
          candidates: [{ content: { parts: [{ text: JSON.stringify({ contractVersion: "1", summary: "ok", insights: [] }) }] } }],
          usageMetadata: { promptTokenCount: 60, candidatesTokenCount: 25 },
        },
      }),
    );

    const result = await googleGeminiAdapter.executeReview(request);
    expect(result).toMatchObject({
      ok: true,
      raw: { contractVersion: "1", summary: "ok", insights: [] },
      inputTokens: 60,
      outputTokens: 25,
    });
  });

  it("calls the model-scoped generateContent endpoint with responseMimeType application/json", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { candidates: [{ content: { parts: [{ text: '{"contractVersion":"1","summary":"x","insights":[]}' }] } }] } }));
    await googleGeminiAdapter.executeReview(request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent");
    const body = JSON.parse(init?.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.systemInstruction.parts[0].text).toBe("doctrine");
  });

  it("strips $schema and converts const to enum in the sent response schema", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { candidates: [{ content: { parts: [{ text: '{"contractVersion":"1","summary":"x","insights":[]}' }] } }] } }));
    await googleGeminiAdapter.executeReview(request);

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const schemaJson = JSON.stringify(body.generationConfig.responseSchema);
    expect(schemaJson).not.toContain("$schema");
    expect(schemaJson).not.toContain('"const"');
    expect(body.generationConfig.responseSchema.properties.contractVersion.enum).toEqual(["1"]);
  });

  it("never enables built-in tools, search/grounding, or files", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { candidates: [{ content: { parts: [{ text: '{"contractVersion":"1","summary":"x","insights":[]}' }] } }] } }));
    await googleGeminiAdapter.executeReview(request);

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.tools).toBeUndefined();
    expect(Object.keys(body).sort()).toEqual(["contents", "generationConfig", "systemInstruction"].sort());
  });

  it("fails with PROVIDER_RESPONSE_INVALID when no text part is present", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { candidates: [] } }));
    const result = await googleGeminiAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });

  it("fails with PROVIDER_RESPONSE_INVALID when the text part is not valid JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { candidates: [{ content: { parts: [{ text: "not json" }] } }] } }));
    const result = await googleGeminiAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });

  it("normalizes a 429 to PROVIDER_RATE_LIMITED, not PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 429 }));
    const result = await googleGeminiAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RATE_LIMITED" });
  });
});

describe("ai/providers/google-gemini: probeModel", () => {
  it("succeeds when executeReview returns a schema-valid response", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { candidates: [{ content: { parts: [{ text: '{"contractVersion":"1","summary":"probe","insights":[]}' }] } }] } }));
    const result = await googleGeminiAdapter.probeModel("gk-test", "gemini-2.5-pro");
    expect(result).toEqual({ ok: true });
  });

  it("fails when the model cannot produce a schema-valid response", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { candidates: [{ content: { parts: [{ text: '{"not":"valid"}' }] } }] } }));
    const result = await googleGeminiAdapter.probeModel("gk-test", "gemini-2.5-pro");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });
});
