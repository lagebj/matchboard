import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { anthropicAdapter } from "@/lib/ai/providers/anthropic";

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

describe("ai/providers/anthropic: adapter identity", () => {
  it("is registered under the locked provider ID with structured output support", () => {
    expect(anthropicAdapter.id).toBe("anthropic");
    expect(anthropicAdapter.supportsStructuredOutput).toBe(true);
  });
});

describe("ai/providers/anthropic: listModels", () => {
  it("returns models from a well-formed response", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { data: [{ id: "claude-sonnet-5" }], has_more: false } }));
    const result = await anthropicAdapter.listModels("sk-ant-test");
    expect(result).toEqual({ ok: true, models: [{ id: "claude-sonnet-5" }] });
  });

  it("sends the exact required headers, including anthropic-version, to GET /v1/models", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { data: [{ id: "claude-sonnet-5" }] } }));
    await anthropicAdapter.listModels("sk-ant-test");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/models");
    expect(init?.redirect).toBe("manual");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer sk-ant-test",
      "anthropic-version": "2023-06-01",
    });
    // Explicitly never the legacy x-api-key form — one consistent auth shape.
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBeUndefined();
  });

  it("fails with PROVIDER_MODEL_LIST_EMPTY when the provider returns zero models", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { data: [] } }));
    const result = await anthropicAdapter.listModels("sk-ant-test");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_MODEL_LIST_EMPTY" });
  });

  it("normalizes a 401 to PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 401 }));
    const result = await anthropicAdapter.listModels("sk-ant-bad");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_AUTH_FAILED" });
  });
});

describe("ai/providers/anthropic: executeReview", () => {
  const request = { credential: "sk-ant-test", model: "claude-sonnet-5", instructions: "doctrine", input: { players: [] } };

  it("extracts the JSON payload from a well-formed Messages API result", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({
        json: {
          content: [{ type: "text", text: JSON.stringify({ contractVersion: "1", summary: "ok", insights: [] }) }],
          usage: { input_tokens: 80, output_tokens: 30 },
        },
      }),
    );

    const result = await anthropicAdapter.executeReview(request);
    expect(result).toMatchObject({
      ok: true,
      raw: { contractVersion: "1", summary: "ok", insights: [] },
      inputTokens: 80,
      outputTokens: 30,
    });
  });

  it("sends output_config.format.type json_schema and no provider-side session/agent fields", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { content: [{ type: "text", text: '{"contractVersion":"1","summary":"x","insights":[]}' }] } }));
    await anthropicAdapter.executeReview(request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(init?.body as string);
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.system).toBe("doctrine");
    expect(body.messages).toEqual([{ role: "user", content: JSON.stringify({ players: [] }) }]);
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"].sort());
  });

  it("fails with PROVIDER_RESPONSE_INVALID when no text content block is present", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { content: [] } }));
    const result = await anthropicAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });

  it("fails with PROVIDER_RESPONSE_INVALID when the text block is not valid JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { content: [{ type: "text", text: "not json" }] } }));
    const result = await anthropicAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });

  it("normalizes a 429 to PROVIDER_RATE_LIMITED, not PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 429 }));
    const result = await anthropicAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RATE_LIMITED" });
  });

  it("normalizes a network failure to PROVIDER_UNAVAILABLE, not PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    const result = await anthropicAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_UNAVAILABLE" });
  });
});

describe("ai/providers/anthropic: probeModel", () => {
  it("succeeds when executeReview returns a schema-valid response", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { content: [{ type: "text", text: '{"contractVersion":"1","summary":"probe","insights":[]}' }] } }));
    const result = await anthropicAdapter.probeModel("sk-ant-test", "claude-sonnet-5");
    expect(result).toEqual({ ok: true });
  });

  it("fails when the model cannot produce a schema-valid response", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { content: [{ type: "text", text: '{"not":"valid"}' }] } }));
    const result = await anthropicAdapter.probeModel("sk-ant-test", "claude-sonnet-5");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });
});
