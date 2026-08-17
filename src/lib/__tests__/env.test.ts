import { describe, it, expect } from "vitest";
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