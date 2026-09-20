import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { ollamaCloudAdapter } from "@/lib/ai/providers/ollama-cloud";

function fakeResponse(init: { ok?: boolean; status?: number; json?: unknown }): Response {
  return {
    type: "basic",
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(init.json ?? {}),
  } as unknown as Response;
}

const validAdvisorJson = JSON.stringify({ contractVersion: "1", summary: "ok", insights: [] });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ai/providers/ollama-cloud: adapter identity", () => {
  it("is registered under the locked provider ID and explicitly does NOT support structured output", () => {
    expect(ollamaCloudAdapter.id).toBe("ollama_cloud");
    expect(ollamaCloudAdapter.supportsStructuredOutput).toBe(false);
  });
});

describe("ai/providers/ollama-cloud: listModels", () => {
  it("maps the `name` field to `id`", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { models: [{ name: "llama3.1:70b" }, { name: "qwen3:32b" }] } }));
    const result = await ollamaCloudAdapter.listModels("ok-test");
    expect(result).toEqual({ ok: true, models: [{ id: "llama3.1:70b" }, { id: "qwen3:32b" }] });
  });

  it("calls GET /api/tags with a bearer credential", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { models: [{ name: "llama3.1:70b" }] } }));
    await ollamaCloudAdapter.listModels("ok-test");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ollama.com/api/tags");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer ok-test" });
  });

  it("fails with PROVIDER_MODEL_LIST_EMPTY when the provider returns zero models", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: { models: [] } }));
    const result = await ollamaCloudAdapter.listModels("ok-test");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_MODEL_LIST_EMPTY" });
  });

  it("normalizes a 401 to PROVIDER_AUTH_FAILED", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 401 }));
    const result = await ollamaCloudAdapter.listModels("ok-bad");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_AUTH_FAILED" });
  });
});

describe("ai/providers/ollama-cloud: executeReview — first attempt succeeds", () => {
  const request = { credential: "ok-test", model: "llama3.1:70b", instructions: "doctrine", input: { players: [] } };

  it("returns the parsed JSON with no retry when the first response is already schema-valid", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { message: { content: validAdvisorJson }, prompt_eval_count: 40, eval_count: 12 } }));

    const result = await ollamaCloudAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: true, raw: { contractVersion: "1", summary: "ok", insights: [] }, inputTokens: 40, outputTokens: 12 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends stream: false and format: json, embedding the schema in the system instructions", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { message: { content: validAdvisorJson } } }));
    await ollamaCloudAdapter.executeReview(request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ollama.com/api/chat");
    const body = JSON.parse(init?.body as string);
    expect(body.stream).toBe(false);
    expect(body.format).toBe("json");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("doctrine");
    expect(body.messages[0].content).toContain("JSON Schema");
  });
});

describe("ai/providers/ollama-cloud: executeReview — repair retry", () => {
  const request = { credential: "ok-test", model: "llama3.1:70b", instructions: "doctrine", input: { players: [] } };

  it("makes exactly one repair retry when the first response fails validation, and succeeds if the retry is valid", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: '{"not":"the advisor shape"}' } } }))
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: validAdvisorJson } } }));

    const result = await ollamaCloudAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: true, raw: { contractVersion: "1", summary: "ok", insights: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("the repair prompt carries the failure category and the original input, never the invalid raw output", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: '{"secret-invalid-marker":"should-not-be-echoed"}' } } }))
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: validAdvisorJson } } }));

    await ollamaCloudAdapter.executeReview(request);

    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
    const secondSystemContent = secondCallBody.messages[0].content;
    expect(secondSystemContent).toContain("failed validation");
    expect(secondSystemContent).not.toContain("secret-invalid-marker");
    expect(secondSystemContent).not.toContain("should-not-be-echoed");
    // The original user content (the real input) is sent again unchanged, not the invalid output.
    expect(secondCallBody.messages[1].content).toBe(JSON.stringify(request.input));
  });

  it("fails with PROVIDER_OUTPUT_INVALID after the retry also fails validation — never a third attempt", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: '{"still":"wrong"}' } } }))
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: '{"also":"wrong"}' } } }));

    const result = await ollamaCloudAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_OUTPUT_INVALID" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats syntactically-invalid JSON on the first attempt as a recoverable failure, not a hard error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: "not json at all, no braces" } } }))
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: validAdvisorJson } } }));

    const result = await ollamaCloudAdapter.executeReview(request);
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a hard transport failure — a network error on the first call fails immediately", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await ollamaCloudAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a hard transport failure on the retry attempt too", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(fakeResponse({ json: { message: { content: "{}" } } })).mockRejectedValueOnce(new Error("network down"));

    const result = await ollamaCloudAdapter.executeReview(request);
    expect(result).toMatchObject({ ok: false, errorCode: "PROVIDER_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("ai/providers/ollama-cloud: probeModel reuses the same repair-retry executeReview path", () => {
  it("succeeds via the retry path, same as real review execution would", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: '{"bad":true}' } } }))
      .mockResolvedValueOnce(fakeResponse({ json: { message: { content: validAdvisorJson } } }));

    const result = await ollamaCloudAdapter.probeModel("ok-test", "llama3.1:70b");
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails with PROVIDER_OUTPUT_INVALID when both attempts fail, matching executeReview's own terminal code", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: { message: { content: '{"bad":true}' } } }));

    const result = await ollamaCloudAdapter.probeModel("ok-test", "llama3.1:70b");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_OUTPUT_INVALID" });
  });
});
