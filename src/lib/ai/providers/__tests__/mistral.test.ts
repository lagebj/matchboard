import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { mistralAdapter } from "@/lib/ai/providers/mistral";

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

describe("ai/providers/mistral: adapter identity", () => {
  it("is registered under the locked provider ID with structured output support", () => {
    expect(mistralAdapter.id).toBe("mistral");
    expect(mistralAdapter.supportsStructuredOutput).toBe(true);
  });
});

describe("ai/providers/mistral: listModels", () => {
  it("returns models from a well-formed response", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { data: [{ id: "mistral-large-3" }] } }));
    const result = await mistralAdapter.listModels("mk-test");
    expect(result).toEqual({ ok: true, models: [{ id: "mistral-large-3" }] });
  });

  it("filters out a model explicitly marked completion_chat: false", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({
        json: {
          data: [
            { id: "mistral-large-3", capabilities: { completion_chat: true } },
            { id: "mistral-embed", capabilities: { completion_chat: false } },
          ],
        },
      }),
    );
    const result = await mistralAdapter.listModels("mk-test");
    expect(result).toEqual({ ok: true, models: [{ id: "mistral-large-3" }] });
  });

  it("filters out a model carrying deprecation metadata", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({ json: { data: [{ id: "mistral-large-3" }, { id: "mistral-old", deprecation: { moved_to: "mistral-large-3" } }] } }),
    );
    const result = await mistralAdapter.listModels("mk-test");
    expect(result).toEqual({ ok: true, models: [{ id: "mistral-large-3" }] });
  });

  it("does not filter a model with no capability metadata at all", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { data: [{ id: "mistral-large-3" }] } }));
    const result = await mistralAdapter.listModels("mk-test");
    expect(result).toEqual({ ok: true, models: [{ id: "mistral-large-3" }] });
  });

  it("fails with PROVIDER_MODEL_LIST_EMPTY when every model is filtered out", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { data: [{ id: "mistral-embed", capabilities: { completion_chat: false } }] } }));
    const result = await mistralAdapter.listModels("mk-test");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_MODEL_LIST_EMPTY" });
  });

  it("normalizes a 401 to PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 401 }));
    const result = await mistralAdapter.listModels("mk-bad");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_AUTH_FAILED" });
  });
});

describe("ai/providers/mistral: executeReview", () => {
  const request = { credential: "mk-test", model: "mistral-large-3", instructions: "doctrine", input: { players: [] } };

  it("extracts the JSON payload from a well-formed chat completion", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({
        json: {
          choices: [{ message: { content: JSON.stringify({ contractVersion: "1", summary: "ok", insights: [] }) } }],
          usage: { prompt_tokens: 50, completion_tokens: 15 },
        },
      }),
    );

    const result = await mistralAdapter.executeReview(request);
    expect(result).toMatchObject({
      ok: true,
      raw: { contractVersion: "1", summary: "ok", insights: [] },
      inputTokens: 50,
      outputTokens: 15,
    });
  });

  it("sends response_format.type json_schema with the strict Advisor schema", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { choices: [{ message: { content: '{"contractVersion":"1","summary":"x","insights":[]}' } }] } }));
    await mistralAdapter.executeReview(request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
    const body = JSON.parse(init?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.model).toBe("mistral-large-3");
  });

  it("fails with PROVIDER_RESPONSE_INVALID when no message content is present", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { choices: [] } }));
    const result = await mistralAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });

  it("fails with PROVIDER_RESPONSE_INVALID when the content is not valid JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { choices: [{ message: { content: "not json" } }] } }));
    const result = await mistralAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });

  it("normalizes a 429 to PROVIDER_RATE_LIMITED, not PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 429 }));
    const result = await mistralAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RATE_LIMITED" });
  });
});

describe("ai/providers/mistral: probeModel", () => {
  it("succeeds when executeReview returns a schema-valid response", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { choices: [{ message: { content: '{"contractVersion":"1","summary":"probe","insights":[]}' } }] } }));
    const result = await mistralAdapter.probeModel("mk-test", "mistral-large-3");
    expect(result).toEqual({ ok: true });
  });

  it("the capability probe is authoritative: fails when the model cannot complete the schema request", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { choices: [{ message: { content: '{"not":"valid"}' } }] } }));
    const result = await mistralAdapter.probeModel("mk-test", "mistral-large-3");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });
});
