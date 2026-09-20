import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockProcessAiJobsBatch } = vi.hoisted(() => ({ mockProcessAiJobsBatch: vi.fn() }));
vi.mock("@/lib/ai/jobs/runner", () => ({
  processAiJobsBatch: mockProcessAiJobsBatch,
}));

import { GET } from "@/app/api/cron/ai/route";

const originalCronSecret = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
  mockProcessAiJobsBatch.mockReset();
});

afterEach(() => {
  if (originalCronSecret !== undefined) {
    process.env.CRON_SECRET = originalCronSecret;
  } else {
    delete process.env.CRON_SECRET;
  }
});

function request(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/ai", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cron/ai", () => {
  it("rejects a request with no Authorization header when CRON_SECRET is configured", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mockProcessAiJobsBatch).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong bearer token", async () => {
    const response = await GET(request("Bearer wrong-secret"));
    expect(response.status).toBe(401);
    expect(mockProcessAiJobsBatch).not.toHaveBeenCalled();
  });

  it("processes a batch and returns its summary for a correctly authenticated request", async () => {
    mockProcessAiJobsBatch.mockResolvedValue({ claimed: 3, succeeded: 2, failed: 1, retried: 0, skippedNotEligible: 0 });

    const response = await GET(request("Bearer test-cron-secret"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, claimed: 3, succeeded: 2, failed: 1 });
    expect(mockProcessAiJobsBatch).toHaveBeenCalledTimes(1);
  });

  it("returns 500 without leaking internals when the batch processor throws", async () => {
    mockProcessAiJobsBatch.mockRejectedValue(new Error("db connection lost, internal detail"));

    const response = await GET(request("Bearer test-cron-secret"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("db connection lost");
  });
});
