import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  guardedProviderFetch,
  readLimitedJsonBody,
  classifyProviderHttpStatus,
  MAX_PROVIDER_RESPONSE_BYTES,
} from "@/lib/ai/providers/http-utils";

function fakeResponse(init: { type?: string; ok?: boolean; status?: number; text?: () => Promise<string> }): Response {
  return {
    type: init.type ?? "basic",
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: init.text ?? (async () => "{}"),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ai/providers/http-utils: guardedProviderFetch", () => {
  it("passes through a successful response", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({}));
    const result = await guardedProviderFetch("https://api.example.com/x", { method: "GET" });
    expect(result.ok).toBe(true);
  });

  it("always sets redirect: manual, even if the caller didn't ask for it", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({}));
    await guardedProviderFetch("https://api.example.com/x", { method: "GET" });
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("manual");
  });

  it("treats an opaque redirect as PROVIDER_UNAVAILABLE, never following it", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ type: "opaqueredirect" }));
    const result = await guardedProviderFetch("https://api.example.com/x", { method: "GET" });
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_UNAVAILABLE" });
  });

  it("normalizes a network failure to PROVIDER_UNAVAILABLE", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    const result = await guardedProviderFetch("https://api.example.com/x", { method: "GET" });
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_UNAVAILABLE" });
  });

  it("normalizes an abort (timeout) to PROVIDER_TIMEOUT", async () => {
    vi.mocked(fetch).mockImplementation(() => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    const result = await guardedProviderFetch("https://api.example.com/x", { method: "GET" });
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_TIMEOUT" });
  });
});

describe("ai/providers/http-utils: readLimitedJsonBody", () => {
  it("parses well-formed JSON", async () => {
    const result = await readLimitedJsonBody(fakeResponse({ text: async () => '{"a":1}' }));
    expect(result).toEqual({ ok: true, body: { a: 1 } });
  });

  it("rejects malformed JSON without throwing", async () => {
    const result = await readLimitedJsonBody(fakeResponse({ text: async () => "not json" }));
    expect(result).toEqual({ ok: false });
  });

  it("rejects a body over the size cap without parsing it", async () => {
    const huge = "x".repeat(MAX_PROVIDER_RESPONSE_BYTES + 1);
    const result = await readLimitedJsonBody(fakeResponse({ text: async () => huge }));
    expect(result).toEqual({ ok: false });
  });

  it("does not throw if reading the body itself fails", async () => {
    const result = await readLimitedJsonBody(
      fakeResponse({
        text: async () => {
          throw new Error("stream error");
        },
      }),
    );
    expect(result).toEqual({ ok: false });
  });
});

describe("ai/providers/http-utils: classifyProviderHttpStatus", () => {
  it("maps 401 to PROVIDER_AUTH_FAILED", () => {
    expect(classifyProviderHttpStatus(401)).toBe("PROVIDER_AUTH_FAILED");
  });

  it("maps 403 to PROVIDER_ACCESS_DENIED", () => {
    expect(classifyProviderHttpStatus(403)).toBe("PROVIDER_ACCESS_DENIED");
  });

  it("maps 429 to PROVIDER_RATE_LIMITED", () => {
    expect(classifyProviderHttpStatus(429)).toBe("PROVIDER_RATE_LIMITED");
  });

  it.each([500, 502, 503, 504])("maps %i to PROVIDER_UNAVAILABLE", (status) => {
    expect(classifyProviderHttpStatus(status)).toBe("PROVIDER_UNAVAILABLE");
  });

  it("never maps a transient class to PROVIDER_AUTH_FAILED", () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(classifyProviderHttpStatus(status)).not.toBe("PROVIDER_AUTH_FAILED");
    }
  });

  it("falls back to PROVIDER_RESPONSE_INVALID for an unrecognized status", () => {
    expect(classifyProviderHttpStatus(418)).toBe("PROVIDER_RESPONSE_INVALID");
  });
});
