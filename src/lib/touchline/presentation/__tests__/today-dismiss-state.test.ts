import { describe, it, expect } from "vitest";
import {
  emptyTodayDismissedState,
  pruneStaleDismissals,
  isDismissed,
  withDismissal,
  withoutDismissal,
} from "../today-dismiss-state";

describe("today-dismiss-state", () => {
  it("starts empty", () => {
    expect(emptyTodayDismissedState()).toEqual({ version: 1, items: [] });
  });

  it("marks a fingerprint dismissed for the current display date", () => {
    const state = withDismissal(emptyTodayDismissedState(), "fp-1", "2026-09-14");
    expect(isDismissed(state, "fp-1", "2026-09-14")).toBe(true);
  });

  it("does not treat a dismissal as active on a different display date", () => {
    const state = withDismissal(emptyTodayDismissedState(), "fp-1", "2026-09-14");
    expect(isDismissed(state, "fp-1", "2026-09-15")).toBe(false);
  });

  it("prunes stale (yesterday's) entries automatically", () => {
    const state = withDismissal(emptyTodayDismissedState(), "fp-1", "2026-09-13");
    const pruned = pruneStaleDismissals(state, "2026-09-14");
    expect(pruned.items).toEqual([]);
  });

  it("keeps entries for the current display date when pruning", () => {
    const state = withDismissal(emptyTodayDismissedState(), "fp-1", "2026-09-14");
    const pruned = pruneStaleDismissals(state, "2026-09-14");
    expect(pruned.items).toHaveLength(1);
  });

  it("treats a corrupt/unversioned stored value as empty (fail open)", () => {
    const pruned = pruneStaleDismissals({ version: 2 } as never, "2026-09-14");
    expect(pruned).toEqual({ version: 1, items: [] });
  });

  it("supports restoring a dismissed row", () => {
    const state = withDismissal(emptyTodayDismissedState(), "fp-1", "2026-09-14");
    const restored = withoutDismissal(state, "fp-1");
    expect(isDismissed(restored, "fp-1", "2026-09-14")).toBe(false);
  });

  it("is idempotent when dismissing the same fingerprint twice", () => {
    const once = withDismissal(emptyTodayDismissedState(), "fp-1", "2026-09-14");
    const twice = withDismissal(once, "fp-1", "2026-09-14");
    expect(twice.items).toHaveLength(1);
  });
});
