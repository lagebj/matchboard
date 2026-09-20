import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScalewaySecurityTransport } from "@/lib/ai/security-client/scaleway-transport";

function fakeResponse(init: { type?: string; ok?: boolean; status?: number; json?: () => Promise<unknown> }): Response {
  return {
    type: init.type ?? "basic",
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: init.json ?? (async () => ({})),
  } as unknown as Response;
}

const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = ["AI_SECURITY_RUNTIME_URL", "AI_SECURITY_ENROLLMENT_URL", "AI_SECURITY_FUNCTION_TOKEN"] as const;

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }
  process.env.AI_SECURITY_RUNTIME_URL = "https://runtime.example.com/";
  process.env.AI_SECURITY_ENROLLMENT_URL = "https://enroll.example.com/";
  process.env.AI_SECURITY_FUNCTION_TOKEN = "function-token-value";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] !== undefined) {
      process.env[key] = originalEnv[key];
    } else {
      delete process.env[key];
    }
  }
  vi.unstubAllGlobals();
});

describe("ai/security-client/scaleway-transport: accessCredential", () => {
  it("posts to the trimmed runtime URL with the exact required headers and body", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: async () => ({ credential: "sk-real" }) }));

    const transport = new ScalewaySecurityTransport();
    const result = await transport.accessCredential({ connectionId: "aic_1", accessToken: "jwt-token" });

    expect(result).toEqual({ ok: true, credential: "sk-real" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://runtime.example.com/v1/credentials/access");
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("manual");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Auth-Token": "function-token-value",
      Authorization: "Bearer jwt-token",
    });
    expect(JSON.parse(init?.body as string)).toEqual({ connectionId: "aic_1" });
  });

  it("fails closed on a blocked redirect, never following it", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ type: "opaqueredirect" }));

    const transport = new ScalewaySecurityTransport();
    const result = await transport.accessCredential({ connectionId: "aic_1", accessToken: "t" });
    expect(result).toEqual({ ok: false, errorCode: "REDIRECT_BLOCKED" });
  });

  it("normalizes a non-2xx HTTP status to an HTTP_<status> error code", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 403 }));

    const transport = new ScalewaySecurityTransport();
    const result = await transport.accessCredential({ connectionId: "aic_1", accessToken: "t" });
    expect(result).toEqual({ ok: false, errorCode: "HTTP_403" });
  });

  it("normalizes a network failure to NETWORK_ERROR, never rethrowing the raw error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("getaddrinfo ENOTFOUND runtime.example.com"));

    const transport = new ScalewaySecurityTransport();
    const result = await transport.accessCredential({ connectionId: "aic_1", accessToken: "t" });
    expect(result).toEqual({ ok: false, errorCode: "NETWORK_ERROR" });
  });

  it("rejects a response missing the credential field", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: async () => ({ status: "connected" }) }));

    const transport = new ScalewaySecurityTransport();
    const result = await transport.accessCredential({ connectionId: "aic_1", accessToken: "t" });
    expect(result).toEqual({ ok: false, errorCode: "INVALID_RESPONSE_SHAPE" });
  });

  it("rejects a response with a non-string or empty credential", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: async () => ({ credential: "" }) }));
    const transport = new ScalewaySecurityTransport();
    expect(await transport.accessCredential({ connectionId: "aic_1", accessToken: "t" })).toEqual({
      ok: false,
      errorCode: "INVALID_RESPONSE_SHAPE",
    });
  });

  it("rejects unparseable JSON without throwing", async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse({
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      }),
    );
    const transport = new ScalewaySecurityTransport();
    const result = await transport.accessCredential({ connectionId: "aic_1", accessToken: "t" });
    expect(result).toEqual({ ok: false, errorCode: "INVALID_RESPONSE_SHAPE" });
  });
});

describe("ai/security-client/scaleway-transport: deleteConnection", () => {
  it("posts to the trimmed enrollment URL with the delete token and body", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(fakeResponse({ json: async () => ({ status: "deleted" }) }));

    const transport = new ScalewaySecurityTransport();
    const result = await transport.deleteConnection({ connectionId: "aic_1", provider: "openai", deleteToken: "d" });

    expect(result).toEqual({ ok: true, status: "deleted" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://enroll.example.com/v1/connections/delete");
    expect(init?.redirect).toBe("manual");
    expect(JSON.parse(init?.body as string)).toEqual({ connectionId: "aic_1", provider: "openai" });
  });

  it("treats a 404 as an idempotent successful not_found, not an error", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 404 }));
    const transport = new ScalewaySecurityTransport();
    const result = await transport.deleteConnection({ connectionId: "aic_1", provider: "anthropic", deleteToken: "d" });
    expect(result).toEqual({ ok: true, status: "not_found" });
  });

  it("fails closed on a blocked redirect", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ type: "opaqueredirect" }));
    const transport = new ScalewaySecurityTransport();
    const result = await transport.deleteConnection({ connectionId: "aic_1", provider: "mistral", deleteToken: "d" });
    expect(result).toEqual({ ok: false, errorCode: "REDIRECT_BLOCKED" });
  });

  it("rejects an unrecognized status value in the response body", async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse({ json: async () => ({ status: "weird" }) }));
    const transport = new ScalewaySecurityTransport();
    const result = await transport.deleteConnection({ connectionId: "aic_1", provider: "google_gemini", deleteToken: "d" });
    expect(result).toEqual({ ok: false, errorCode: "INVALID_RESPONSE_SHAPE" });
  });
});
