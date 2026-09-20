import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const AI_ENV_KEYS = [
  "AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64",
  "AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64",
  "AI_SECURITY_FUNCTION_TOKEN",
  "AI_SECURITY_ENROLLMENT_URL",
  "AI_SECURITY_RUNTIME_URL",
] as const;

const originalValues: Record<string, string | undefined> = {};

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, isTest: vi.fn(() => true) };
});

function setFullyConfigured() {
  for (const key of AI_ENV_KEYS) {
    process.env[key] = `value-for-${key}`;
  }
}

beforeEach(() => {
  for (const key of AI_ENV_KEYS) {
    originalValues[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of AI_ENV_KEYS) {
    if (originalValues[key] !== undefined) {
      process.env[key] = originalValues[key];
    } else {
      delete process.env[key];
    }
  }
  vi.clearAllMocks();
});

describe("ai/security-client/transport-factory", () => {
  it("returns the same singleton instance across repeated calls", async () => {
    const factory = await import("@/lib/ai/security-client/transport-factory");
    const first = factory.getMatchboardSecurityTransport();
    const second = factory.getMatchboardSecurityTransport();
    expect(first).toBe(second);
  });

  it("is the fake transport under the test runner, even when every env var is configured", async () => {
    setFullyConfigured();
    const factory = await import("@/lib/ai/security-client/transport-factory");
    expect(factory.getMatchboardSecurityTransport().name).toBe("fake");
  });

  it("is the fake transport when not fully configured, outside test", async () => {
    const env = await import("@/lib/env");
    vi.mocked(env.isTest).mockReturnValue(false);

    const factory = await import("@/lib/ai/security-client/transport-factory");
    expect(factory.getMatchboardSecurityTransport().name).toBe("fake");
  });

  it("is the real (Scaleway) transport when fully configured and not under test", async () => {
    setFullyConfigured();
    const env = await import("@/lib/env");
    vi.mocked(env.isTest).mockReturnValue(false);

    const factory = await import("@/lib/ai/security-client/transport-factory");
    expect(factory.getMatchboardSecurityTransport().name).toBe("scaleway");
  });

  it("setMatchboardSecurityTransport injects a specific instance, resetMatchboardSecurityTransport clears it", async () => {
    const factory = await import("@/lib/ai/security-client/transport-factory");
    const { FakeMatchboardSecurityTransport } = await import("@/lib/ai/security-client/fake-transport");

    const injected = new FakeMatchboardSecurityTransport();
    factory.setMatchboardSecurityTransport(injected);
    expect(factory.getMatchboardSecurityTransport()).toBe(injected);

    factory.resetMatchboardSecurityTransport();
    expect(factory.getMatchboardSecurityTransport()).not.toBe(injected);
  });
});
