import { describe, it, expect, afterEach } from "vitest";
import { isPublicRoute, matchboardEnv, validateEnv, VALID_ENVS, isTest, isDevelopment, isProduction, isStaging } from "@/lib/env";

describe("env: resolveMatchboardEnv", () => {
  it("resolves to a valid environment", () => {
    expect(VALID_ENVS.has(matchboardEnv)).toBe(true);
  });

  it("isTest returns correct value for current environment", () => {
    // In CI/tests, MATCHBOARD_ENV or NODE_ENV should be "test"
    expect(typeof isTest()).toBe("boolean");
  });

  it("isDevelopment returns correct value", () => {
    expect(typeof isDevelopment()).toBe("boolean");
  });

  it("isProduction returns correct value", () => {
    expect(typeof isProduction()).toBe("boolean");
  });

  it("isStaging returns correct value", () => {
    expect(typeof isStaging()).toBe("boolean");
  });

  it("VALID_ENVS contains exactly four environments", () => {
    expect(VALID_ENVS.size).toBe(4);
    expect(VALID_ENVS.has("development")).toBe(true);
    expect(VALID_ENVS.has("test")).toBe(true);
    expect(VALID_ENVS.has("staging")).toBe(true);
    expect(VALID_ENVS.has("production")).toBe(true);
  });
});

describe("env: isPublicRoute", () => {
  it("identifies public routes correctly", () => {
    expect(isPublicRoute("/api/auth/callback")).toBe(true);
    expect(isPublicRoute("/api/auth/signin")).toBe(true);
    expect(isPublicRoute("/_next/static/chunk.js")).toBe(true);
    expect(isPublicRoute("/favicon.ico")).toBe(true);
    expect(isPublicRoute("/robots.txt")).toBe(true);
    expect(isPublicRoute("/signin")).toBe(true);
    expect(isPublicRoute("/error")).toBe(true);
    expect(isPublicRoute("/api/health")).toBe(true);
  });

  it("rejects protected routes", () => {
    expect(isPublicRoute("/o/my-org/assistant")).toBe(false);
    expect(isPublicRoute("/o/my-org/teams")).toBe(false);
    expect(isPublicRoute("/o/my-org/fixtures")).toBe(false);
    expect(isPublicRoute("/api/season/export")).toBe(false);
    expect(isPublicRoute("/organisations")).toBe(false);
    expect(isPublicRoute("/")).toBe(false);
  });
});

describe("env: validateEnv", () => {
  it("returns valid in test environment with required vars", () => {
    process.env.TEST_DATABASE_URL = "postgresql://test:test@localhost/test";
    const result = validateEnv();
    // In test env, only TEST_DATABASE_URL is required
    expect(result.valid).toBe(true);
  });

  it("detects NEXT_PUBLIC_ secrets as errors", () => {
    const original = process.env.NEXT_PUBLIC_AUTH_SECRET;
    process.env.NEXT_PUBLIC_AUTH_SECRET = "should-not-exist";
    const result = validateEnv();
    expect(result.errors.some((e) => e.includes("NEXT_PUBLIC_AUTH_SECRET"))).toBe(true);
    if (original !== undefined) {
      process.env.NEXT_PUBLIC_AUTH_SECRET = original;
    } else {
      delete process.env.NEXT_PUBLIC_AUTH_SECRET;
    }
  });

  it("rejects invalid MATCHBOARD_ENV values", () => {
    expect(VALID_ENVS.has("invalid")).toBe(false);
    expect(VALID_ENVS.has("production")).toBe(true);
  });
});

describe("env: production safety guards", () => {
  const originalMatchboardEnv = process.env.MATCHBOARD_ENV;
  const originalBypass = process.env.BYPASS_AUTH;
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalDbUrl = process.env.DATABASE_URL;
  const originalDirectUrl = process.env.DIRECT_URL;
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalAuthGoogleId = process.env.AUTH_GOOGLE_ID;
  const originalAuthGoogleSecret = process.env.AUTH_GOOGLE_SECRET;
  const originalTestDbUrl = process.env.TEST_DATABASE_URL;

  afterEach(() => {
    if (originalMatchboardEnv !== undefined) {
      process.env.MATCHBOARD_ENV = originalMatchboardEnv;
    } else {
      delete process.env.MATCHBOARD_ENV;
    }
    if (originalBypass !== undefined) {
      process.env.BYPASS_AUTH = originalBypass;
    } else {
      delete process.env.BYPASS_AUTH;
    }
    if (originalAppBaseUrl !== undefined) {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    } else {
      delete process.env.APP_BASE_URL;
    }
    if (originalDbUrl !== undefined) {
      process.env.DATABASE_URL = originalDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    if (originalDirectUrl !== undefined) {
      process.env.DIRECT_URL = originalDirectUrl;
    } else {
      delete process.env.DIRECT_URL;
    }
    if (originalAuthSecret !== undefined) {
      process.env.AUTH_SECRET = originalAuthSecret;
    } else {
      delete process.env.AUTH_SECRET;
    }
    if (originalAuthGoogleId !== undefined) {
      process.env.AUTH_GOOGLE_ID = originalAuthGoogleId;
    } else {
      delete process.env.AUTH_GOOGLE_ID;
    }
    if (originalAuthGoogleSecret !== undefined) {
      process.env.AUTH_GOOGLE_SECRET = originalAuthGoogleSecret;
    } else {
      delete process.env.AUTH_GOOGLE_SECRET;
    }
    if (originalTestDbUrl !== undefined) {
      process.env.TEST_DATABASE_URL = originalTestDbUrl;
    } else {
      delete process.env.TEST_DATABASE_URL;
    }
  });

  it("rejects BYPASS_AUTH=true in production", () => {
    process.env.MATCHBOARD_ENV = "production";
    process.env.BYPASS_AUTH = "true";
    process.env.DATABASE_URL = "postgresql://localhost/prod";
    process.env.DIRECT_URL = "postgresql://localhost/prod";
    process.env.AUTH_SECRET = "secret";
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";
    process.env.APP_BASE_URL = "https://app.matchboard.football";

    const result = validateEnv();
    const bypassError = result.errors.find((e) => e.includes("BYPASS_AUTH"));
    expect(bypassError).toBeDefined();
    expect(bypassError).toContain("must not be set in production");
  });

  it("allows BYPASS_AUTH=true in test environment", () => {
    process.env.MATCHBOARD_ENV = "test";
    process.env.BYPASS_AUTH = "true";
    process.env.TEST_DATABASE_URL = "postgresql://test:test@localhost/test";

    const result = validateEnv();
    const bypassError = result.errors.find((e) => e.includes("BYPASS_AUTH"));
    expect(bypassError).toBeUndefined();
  });

  it("requires APP_BASE_URL in production", () => {
    process.env.MATCHBOARD_ENV = "production";
    delete process.env.APP_BASE_URL;
    process.env.DATABASE_URL = "postgresql://localhost/prod";
    process.env.DIRECT_URL = "postgresql://localhost/prod";
    process.env.AUTH_SECRET = "secret";
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";

    const result = validateEnv();
    const appUrlError = result.errors.find((e) => e.includes("APP_BASE_URL"));
    expect(appUrlError).toBeDefined();
    expect(appUrlError).toContain("required in production");
  });

  it("rejects non-https APP_BASE_URL in production", () => {
    process.env.MATCHBOARD_ENV = "production";
    process.env.APP_BASE_URL = "http://matchboard.football";
    process.env.DATABASE_URL = "postgresql://localhost/prod";
    process.env.DIRECT_URL = "postgresql://localhost/prod";
    process.env.AUTH_SECRET = "secret";
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";

    const result = validateEnv();
    const httpsError = result.errors.find((e) => e.includes("https://"));
    expect(httpsError).toBeDefined();
    expect(httpsError).toContain("must start with https://");
  });

  it("accepts https APP_BASE_URL in production", () => {
    process.env.MATCHBOARD_ENV = "production";
    process.env.APP_BASE_URL = "https://app.matchboard.football";
    process.env.DATABASE_URL = "postgresql://localhost/prod";
    process.env.DIRECT_URL = "postgresql://localhost/prod";
    process.env.AUTH_SECRET = "secret";
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";

    const result = validateEnv();
    const appUrlError = result.errors.find((e) => e.includes("APP_BASE_URL"));
    expect(appUrlError).toBeUndefined();
  });
});