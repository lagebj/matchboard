import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clearRateLimitStore } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("allows requests within the limit", () => {
    const result = rateLimit("test-key", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on each request", () => {
    rateLimit("test-key", 3, 60_000);
    rateLimit("test-key", 3, 60_000);
    const result = rateLimit("test-key", 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks requests when limit is reached", () => {
    rateLimit("test-key", 2, 60_000);
    rateLimit("test-key", 2, 60_000);
    const result = rateLimit("test-key", 2, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after the time window expires", () => {
    rateLimit("test-key", 1, 1);
    const blocked = rateLimit("test-key", 1, 1);
    expect(blocked.allowed).toBe(false);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = rateLimit("test-key", 1, 60_000);
        expect(result.allowed).toBe(true);
        resolve();
      }, 10);
    });
  });

  it("tracks different keys independently", () => {
    rateLimit("key-a", 1, 60_000);
    const resultA = rateLimit("key-a", 1, 60_000);
    const resultB = rateLimit("key-b", 1, 60_000);
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it("returns resetAt timestamp", () => {
    const result = rateLimit("test-key", 5, 60_000);
    expect(result.resetAt).toBeGreaterThan(0);
  });
});