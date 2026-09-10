/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    liveMatchEvent: { findFirst: vi.fn() },
    liveMatchSession: { findUnique: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { estimateCurrentMatchOffsetMs } from "../live-match-event-store";

// ADR-0133 H3: the estimate is MILLISECONDS since period start (same unit as
// LiveMatchEvent.matchSeconds). H2 added the persisted-clock path.
describe("estimateCurrentMatchOffsetMs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("uses the persisted session clock (H2) when it has advanced", async () => {
    vi.setSystemTime(new Date("2026-01-01T12:10:00.000Z"));
    vi.mocked(db.liveMatchSession.findUnique).mockResolvedValue({
      startedAt: new Date("2026-01-01T12:00:00.000Z"),
      clockPeriod: "SECOND_HALF",
      clockRunning: true,
      clockPeriodStartedAt: new Date("2026-01-01T12:07:00.000Z"), // 3 min ago
      clockElapsedBeforeMs: 5 * 60 * 1000, // 5 min already elapsed this period
    } as any);

    const result = await estimateCurrentMatchOffsetMs("match-1", "session-1");

    expect(result.period).toBe("SECOND_HALF");
    expect(result.matchOffsetMs).toBe(8 * 60 * 1000); // 5 min + 3 min, in ms
    expect(db.liveMatchEvent.findFirst).not.toHaveBeenCalled();
  });

  it("extrapolates from the most recent timed event when the persisted clock is still BEFORE", async () => {
    vi.setSystemTime(new Date("2026-01-01T12:10:00.000Z"));
    vi.mocked(db.liveMatchSession.findUnique).mockResolvedValue({
      startedAt: new Date("2026-01-01T12:00:00.000Z"),
      clockPeriod: "BEFORE",
      clockRunning: false,
      clockPeriodStartedAt: null,
      clockElapsedBeforeMs: 0,
    } as any);
    vi.mocked(db.liveMatchEvent.findFirst).mockResolvedValue({
      matchSeconds: 20 * 60 * 1000, // 20:00 into the match, in ms
      period: "FIRST_HALF",
      createdAt: new Date("2026-01-01T12:05:00.000Z"), // recorded 5 minutes ago
    } as any);

    const result = await estimateCurrentMatchOffsetMs("match-1", "session-1");

    expect(result.period).toBe("FIRST_HALF");
    expect(result.matchOffsetMs).toBe(20 * 60 * 1000 + 5 * 60 * 1000);
  });

  it("falls back to elapsed time since session start when no timed event exists", async () => {
    vi.setSystemTime(new Date("2026-01-01T12:07:00.000Z"));
    vi.mocked(db.liveMatchSession.findUnique).mockResolvedValue({
      startedAt: new Date("2026-01-01T12:00:00.000Z"),
      clockPeriod: "BEFORE",
      clockRunning: false,
      clockPeriodStartedAt: null,
      clockElapsedBeforeMs: 0,
    } as any);
    vi.mocked(db.liveMatchEvent.findFirst).mockResolvedValue(null);

    const result = await estimateCurrentMatchOffsetMs("match-1", "session-1");

    expect(result.period).toBeNull();
    expect(result.matchOffsetMs).toBe(7 * 60 * 1000);
  });

  it("never returns a negative estimate", async () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    vi.mocked(db.liveMatchSession.findUnique).mockResolvedValue(null);
    vi.mocked(db.liveMatchEvent.findFirst).mockResolvedValue(null);

    const result = await estimateCurrentMatchOffsetMs("match-1", "session-1");

    expect(result.matchOffsetMs).toBe(0);
  });
});
