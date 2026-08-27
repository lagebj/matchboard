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
import { estimateCurrentMatchSeconds } from "../live-match-event-store";

describe("estimateCurrentMatchSeconds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("extrapolates from the most recent timed event", async () => {
    const now = new Date("2026-01-01T12:10:00.000Z");
    vi.setSystemTime(now);

    vi.mocked(db.liveMatchEvent.findFirst).mockResolvedValue({
      matchSeconds: 1200, // 20:00 into the match
      period: "FIRST_HALF",
      createdAt: new Date("2026-01-01T12:05:00.000Z"), // recorded 5 minutes ago
    } as any);

    const result = await estimateCurrentMatchSeconds("match-1", "session-1");

    expect(result.period).toBe("FIRST_HALF");
    expect(result.matchSeconds).toBe(1200 + 5 * 60);
  });

  it("falls back to elapsed time since session start when no timed event exists", async () => {
    const now = new Date("2026-01-01T12:07:00.000Z");
    vi.setSystemTime(now);

    vi.mocked(db.liveMatchEvent.findFirst).mockResolvedValue(null);
    vi.mocked(db.liveMatchSession.findUnique).mockResolvedValue({
      startedAt: new Date("2026-01-01T12:00:00.000Z"),
    } as any);

    const result = await estimateCurrentMatchSeconds("match-1", "session-1");

    expect(result.period).toBeNull();
    expect(result.matchSeconds).toBe(7 * 60);
  });

  it("never returns a negative estimate", async () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    vi.setSystemTime(now);

    vi.mocked(db.liveMatchEvent.findFirst).mockResolvedValue(null);
    vi.mocked(db.liveMatchSession.findUnique).mockResolvedValue(null);

    const result = await estimateCurrentMatchSeconds("match-1", "session-1");

    expect(result.matchSeconds).toBe(0);
  });
});
