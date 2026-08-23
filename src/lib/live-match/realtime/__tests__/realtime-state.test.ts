import { describe, it, expect } from "vitest";
import { compareIncomingVersion, RealtimeVersionTracker } from "../realtime-state";

describe("compareIncomingVersion", () => {
  it("treats an equal-or-lower version as a duplicate", () => {
    expect(compareIncomingVersion(41, 41)).toBe("duplicate");
    expect(compareIncomingVersion(41, 30)).toBe("duplicate");
  });

  it("treats exactly last+1 as apply", () => {
    expect(compareIncomingVersion(41, 42)).toBe("apply");
  });

  it("treats anything beyond last+1 as a gap", () => {
    expect(compareIncomingVersion(41, 44)).toBe("gap");
  });

  it("handles the zero/initial state", () => {
    expect(compareIncomingVersion(0, 1)).toBe("apply");
    expect(compareIncomingVersion(0, 0)).toBe("duplicate");
  });
});

describe("RealtimeVersionTracker", () => {
  it("starts at 0", () => {
    const tracker = new RealtimeVersionTracker();
    expect(tracker.current).toBe(0);
  });

  it("advances current only on apply", () => {
    const tracker = new RealtimeVersionTracker();
    expect(tracker.evaluate(1)).toBe("apply");
    expect(tracker.current).toBe(1);
  });

  it("does not advance on duplicate", () => {
    const tracker = new RealtimeVersionTracker();
    tracker.evaluate(1);
    expect(tracker.evaluate(1)).toBe("duplicate");
    expect(tracker.current).toBe(1);
  });

  it("does not silently advance on a gap — caller must resync", () => {
    const tracker = new RealtimeVersionTracker();
    tracker.evaluate(1);
    expect(tracker.evaluate(5)).toBe("gap");
    expect(tracker.current).toBe(1);
  });

  it("resetTo jumps to a snapshot version directly, bypassing comparison", () => {
    const tracker = new RealtimeVersionTracker();
    tracker.resetTo(100);
    expect(tracker.current).toBe(100);
    expect(tracker.evaluate(101)).toBe("apply");
  });
});
