import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ENV_KEYS = [
  "AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64",
  "AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64",
  "AI_SECURITY_FUNCTION_TOKEN",
  "AI_SECURITY_ENROLLMENT_URL",
  "AI_SECURITY_RUNTIME_URL",
  "AI_OLLAMA_DEV_BASE_URL",
] as const;

const originalValues: Record<string, string | undefined> = {};

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, isProduction: vi.fn(() => false) };
});

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalValues[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalValues[key] !== undefined) {
      process.env[key] = originalValues[key];
    } else {
      delete process.env[key];
    }
  }
  vi.clearAllMocks();
});

describe("ai/config", () => {
  it("each required-secret getter throws a clear error when its env var is unset", async () => {
    const config = await import("@/lib/ai/config");
    expect(() => config.getAiEnrollmentSigningPrivateKeyB64()).toThrow(
      "AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64 environment variable is not set.",
    );
    expect(() => config.getAiCredentialAccessSigningPrivateKeyB64()).toThrow(
      "AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 environment variable is not set.",
    );
    expect(() => config.getAiSecurityFunctionToken()).toThrow("AI_SECURITY_FUNCTION_TOKEN environment variable is not set.");
    expect(() => config.getAiSecurityEnrollmentUrl()).toThrow("AI_SECURITY_ENROLLMENT_URL environment variable is not set.");
    expect(() => config.getAiSecurityRuntimeUrl()).toThrow("AI_SECURITY_RUNTIME_URL environment variable is not set.");
  });

  it("each required-secret getter returns the raw value when set", async () => {
    process.env.AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64 = "enrollment-key";
    process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 = "access-key";
    process.env.AI_SECURITY_FUNCTION_TOKEN = "function-token";
    process.env.AI_SECURITY_ENROLLMENT_URL = "https://enroll.example.com";
    process.env.AI_SECURITY_RUNTIME_URL = "https://runtime.example.com";

    const config = await import("@/lib/ai/config");
    expect(config.getAiEnrollmentSigningPrivateKeyB64()).toBe("enrollment-key");
    expect(config.getAiCredentialAccessSigningPrivateKeyB64()).toBe("access-key");
    expect(config.getAiSecurityFunctionToken()).toBe("function-token");
    expect(config.getAiSecurityEnrollmentUrl()).toBe("https://enroll.example.com");
    expect(config.getAiSecurityRuntimeUrl()).toBe("https://runtime.example.com");
  });

  it("isAiSecurityBoundaryConfigured is false unless every var is set", async () => {
    const config = await import("@/lib/ai/config");
    expect(config.isAiSecurityBoundaryConfigured()).toBe(false);

    process.env.AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64 = "a";
    process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 = "b";
    process.env.AI_SECURITY_FUNCTION_TOKEN = "c";
    process.env.AI_SECURITY_ENROLLMENT_URL = "d";
    // AI_SECURITY_RUNTIME_URL intentionally left unset.
    expect(config.isAiSecurityBoundaryConfigured()).toBe(false);

    process.env.AI_SECURITY_RUNTIME_URL = "e";
    expect(config.isAiSecurityBoundaryConfigured()).toBe(true);
  });

  it("getAiOllamaDevBaseUrl returns undefined when unset", async () => {
    const config = await import("@/lib/ai/config");
    expect(config.getAiOllamaDevBaseUrl()).toBeUndefined();
  });

  it("getAiOllamaDevBaseUrl returns the value outside production", async () => {
    process.env.AI_OLLAMA_DEV_BASE_URL = "http://localhost:11434";
    const config = await import("@/lib/ai/config");
    expect(config.getAiOllamaDevBaseUrl()).toBe("http://localhost:11434");
  });

  it("getAiOllamaDevBaseUrl throws if set in production, even though nothing else does", async () => {
    process.env.AI_OLLAMA_DEV_BASE_URL = "http://localhost:11434";
    const env = await import("@/lib/env");
    vi.mocked(env.isProduction).mockReturnValue(true);

    const config = await import("@/lib/ai/config");
    expect(() => config.getAiOllamaDevBaseUrl()).toThrow("AI_OLLAMA_DEV_BASE_URL must not be set in production");
  });
});
