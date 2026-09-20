import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { openaiAdapter } from "@/lib/ai/providers/openai";

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

describe("ai/providers/openai: adapter identity", () => {
  it("is registered under the locked provider ID with structured output support", () => {
    expect(openaiAdapter.id).toBe("openai");
    expect(openaiAdapter.supportsStructuredOutput).toBe(true);
  });
});

describe("ai/providers/openai: listModels", () => {
  it("returns models from a well-formed response", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { data: [{ id: "gpt-5" }, { id: "gpt-5-mini" }] } }));
    const result = await openaiAdapter.listModels("sk-test");
    expect(result).toEqual({ ok: true, models: [{ id: "gpt-5" }, { id: "gpt-5-mini" }] });
  });

  it("sends the exact required headers to GET /v1/models", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { data: [{ id: "gpt-5" }] } }));
    await openaiAdapter.listModels("sk-test");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/models");
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("manual");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer sk-test" });
  });

  it("fails with PROVIDER_MODEL_LIST_EMPTY when the provider returns zero models", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { data: [] } }));
    const result = await openaiAdapter.listModels("sk-test");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_MODEL_LIST_EMPTY" });
  });

  it("normalizes a 401 to PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 401 }));
    const result = await openaiAdapter.listModels("sk-bad");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_AUTH_FAILED" });
  });

  it("rejects a malformed response shape", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { unexpected: true } }));
    const result = await openaiAdapter.listModels("sk-test");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });
});

describe("ai/providers/openai: executeReview", () => {
  const request = { credential: "sk-test", model: "gpt-5", instructions: "doctrine", input: { players: [] } };

  it("extracts the JSON payload from a well-formed Responses API result", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({
        json: {
          output: [
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: JSON.stringify({ contractVersion: "1", summary: "ok", insights: [] }) }],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 40 },
        },
      }),
    );

    const result = await openaiAdapter.executeReview(request);
    expect(result).toMatchObject({
      ok: true,
      raw: { contractVersion: "1", summary: "ok", insights: [] },
      inputTokens: 100,
      outputTokens: 40,
    });
  });

  it("sends store: false, stream: false, and the strict JSON schema format", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      fakeResponse({
        json: { output: [{ type: "message", content: [{ type: "output_text", text: '{"contractVersion":"1","summary":"x","insights":[]}' }] }] },
      }),
    );
    await openaiAdapter.executeReview(request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(init?.body as string);
    expect(body.store).toBe(false);
    expect(body.stream).toBe(false);
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
    expect(body.model).toBe("gpt-5");
  });

  it("never sends tools, conversation linkage, or coach-authored free text outside `instructions`/`input`", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      fakeResponse({
        json: { output: [{ type: "message", content: [{ type: "output_text", text: '{"contractVersion":"1","summary":"x","insights":[]}' }] }] },
      }),
    );
    await openaiAdapter.executeReview(request);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.tools).toBeUndefined();
    expect(body.previous_response_id).toBeUndefined();
    expect(Object.keys(body).sort()).toEqual(["input", "model", "store", "stream", "text"].sort());
  });

  it("fails with PROVIDER_RESPONSE_INVALID when no output_text item is present", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { output: [] } }));
    const result = await openaiAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });

  it("fails with PROVIDER_RESPONSE_INVALID when output_text is not valid JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({ json: { output: [{ type: "message", content: [{ type: "output_text", text: "not json" }] }] } }),
    );
    const result = await openaiAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });

  it("normalizes a 429 to PROVIDER_RATE_LIMITED, not PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 429 }));
    const result = await openaiAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_RATE_LIMITED" });
  });

  it("normalizes a network failure to PROVIDER_UNAVAILABLE, not PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    const result = await openaiAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_UNAVAILABLE" });
  });

  it("always includes a durationMs on both success and failure", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 500 }));
    const result = await openaiAdapter.executeReview(request);
    expect(typeof (result as { durationMs: number }).durationMs).toBe("number");
  });
});

describe("ai/providers/openai: probeModel", () => {
  it("succeeds when executeReview returns a schema-valid response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({
        json: { output: [{ type: "message", content: [{ type: "output_text", text: '{"contractVersion":"1","summary":"probe","insights":[]}' }] }] },
      }),
    );
    const result = await openaiAdapter.probeModel("sk-test", "gpt-5");
    expect(result).toEqual({ ok: true });
  });

  it("fails when the model cannot produce a schema-valid response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({ json: { output: [{ type: "message", content: [{ type: "output_text", text: '{"not":"valid"}' }] }] } }),
    );
    const result = await openaiAdapter.probeModel("sk-test", "gpt-5");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });
});
