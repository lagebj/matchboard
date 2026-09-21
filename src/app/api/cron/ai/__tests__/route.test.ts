import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockProcessAiJobsBatch, mockEnqueueDueMatchPrepJobs, mockEnqueueDueWeeklyTeamReviewJobs, mockRetryPendingConnectionDeletions } = vi.hoisted(() => ({
  mockProcessAiJobsBatch: vi.fn(),
  mockEnqueueDueMatchPrepJobs: vi.fn(),
  mockEnqueueDueWeeklyTeamReviewJobs: vi.fn(),
  mockRetryPendingConnectionDeletions: vi.fn(),
}));
vi.mock("@/lib/ai/jobs/runner", () => ({
  processAiJobsBatch: mockProcessAiJobsBatch,
}));
vi.mock("@/lib/ai/jobs/scheduled-triggers", () => ({
  enqueueDueMatchPrepJobs: mockEnqueueDueMatchPrepJobs,
  enqueueDueWeeklyTeamReviewJobs: mockEnqueueDueWeeklyTeamReviewJobs,
}));
vi.mock("@/lib/ai/jobs/connection-maintenance", () => ({
  retryPendingConnectionDeletions: mockRetryPendingConnectionDeletions,
}));

import { GET } from "@/app/api/cron/ai/route";

const originalCronSecret = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
  mockProcessAiJobsBatch.mockReset();
  mockEnqueueDueMatchPrepJobs.mockReset();
  mockEnqueueDueMatchPrepJobs.mockResolvedValue({ scanned: 0 });
  mockEnqueueDueWeeklyTeamReviewJobs.mockReset();
  mockEnqueueDueWeeklyTeamReviewJobs.mockResolvedValue({ scanned: 0 });
  mockRetryPendingConnectionDeletions.mockReset();
  mockRetryPendingConnectionDeletions.mockResolvedValue({ scanned: 0 });
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
    expect(mockEnqueueDueMatchPrepJobs).not.toHaveBeenCalled();
    expect(mockEnqueueDueWeeklyTeamReviewJobs).not.toHaveBeenCalled();
    expect(mockRetryPendingConnectionDeletions).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong bearer token", async () => {
    const response = await GET(request("Bearer wrong-secret"));
    expect(response.status).toBe(401);
    expect(mockProcessAiJobsBatch).not.toHaveBeenCalled();
    expect(mockEnqueueDueMatchPrepJobs).not.toHaveBeenCalled();
    expect(mockEnqueueDueWeeklyTeamReviewJobs).not.toHaveBeenCalled();
  });

  it("scans for due match_prep jobs, weekly_team_review jobs, and pending connection deletions, then processes a batch and returns its combined summary for a correctly authenticated request", async () => {
    mockEnqueueDueMatchPrepJobs.mockResolvedValue({ scanned: 2 });
    mockEnqueueDueWeeklyTeamReviewJobs.mockResolvedValue({ scanned: 4 });
    mockRetryPendingConnectionDeletions.mockResolvedValue({ scanned: 1 });
    mockProcessAiJobsBatch.mockResolvedValue({ claimed: 3, succeeded: 2, failed: 1, retried: 0, skippedNotEligible: 0 });

    const response = await GET(request(`Bearer test-cron-secret`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      matchPrepScanned: 2,
      weeklyTeamReviewScanned: 4,
      connectionDeletionRetriesScanned: 1,
      claimed: 3,
      succeeded: 2,
      failed: 1,
    });
    expect(mockEnqueueDueMatchPrepJobs).toHaveBeenCalledTimes(1);
    expect(mockEnqueueDueWeeklyTeamReviewJobs).toHaveBeenCalledTimes(1);
    expect(mockRetryPendingConnectionDeletions).toHaveBeenCalledTimes(1);
    expect(mockProcessAiJobsBatch).toHaveBeenCalledTimes(1);
  });

  it("returns 500 without leaking internals when the batch processor throws", async () => {
    mockProcessAiJobsBatch.mockRejectedValue(new Error("db connection lost, internal detail"));

    const response = await GET(request(`Bearer ${process.env.CRON_SECRET}`));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("db connection lost");
  });

  it("returns 500 without leaking internals when the match_prep scan itself throws", async () => {
    mockEnqueueDueMatchPrepJobs.mockRejectedValue(new Error("db connection lost, internal detail"));

    const response = await GET(request(`Bearer ${process.env.CRON_SECRET}`));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("db connection lost");
    expect(mockProcessAiJobsBatch).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking internals when the weekly_team_review scan itself throws", async () => {
    mockEnqueueDueWeeklyTeamReviewJobs.mockRejectedValue(new Error("db connection lost, internal detail"));

    const response = await GET(request(`Bearer ${process.env.CRON_SECRET}`));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("db connection lost");
    expect(mockProcessAiJobsBatch).not.toHaveBeenCalled();
  });
});
