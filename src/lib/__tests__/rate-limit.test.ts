import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { setupTestDb, teardownTestDb, getTestDb } from "@/test/test-db";
import { rateLimit, clearRateLimitStore } from "../rate-limit";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

// Distributed rate limiter backed by RateLimitBucket (ARR-0019, platform-integrity-programme
// Phase 6). Uses a real test-database fixture, not mocks, since the correctness of this
// implementation hinges on the atomicity of the INSERT ... ON CONFLICT statement itself.
describe("rateLimit", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearRateLimitStore();
  });

  it("allows requests within the limit", async () => {
    const result = await rateLimit("test-key", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("decrements remaining on each request", async () => {
    await rateLimit("test-key", 3, 60_000);
    await rateLimit("test-key", 3, 60_000);
    const result = await rateLimit("test-key", 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks requests when limit is reached", async () => {
    await rateLimit("test-key", 2, 60_000);
    await rateLimit("test-key", 2, 60_000);
    const result = await rateLimit("test-key", 2, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after the time window expires", async () => {
    await rateLimit("test-key-reset", 1, 10);
    const blocked = await rateLimit("test-key-reset", 1, 10);
    expect(blocked.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const result = await rateLimit("test-key-reset", 1, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("tracks different keys independently", async () => {
    await rateLimit("key-a", 1, 60_000);
    const resultA = await rateLimit("key-a", 1, 60_000);
    const resultB = await rateLimit("key-b", 1, 60_000);
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it("returns resetAt timestamp", async () => {
    const result = await rateLimit("test-key", 5, 60_000);
    expect(result.resetAt).toBeGreaterThan(0);
  });

  it("serializes concurrent increments for the same key without double-counting", async () => {
    const results = await Promise.all([
      rateLimit("concurrent-key", 10, 60_000),
      rateLimit("concurrent-key", 10, 60_000),
      rateLimit("concurrent-key", 10, 60_000),
      rateLimit("concurrent-key", 10, 60_000),
      rateLimit("concurrent-key", 10, 60_000),
    ]);
    const remainingValues = results.map((r) => r.remaining).sort((a, b) => b - a);
    expect(remainingValues).toEqual([9, 8, 7, 6, 5]);
    expect(results.every((r) => r.allowed)).toBe(true);
  });
});
