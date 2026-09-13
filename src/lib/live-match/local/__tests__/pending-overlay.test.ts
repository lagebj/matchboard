import { describe, it, expect } from "vitest";
import { summarizePendingCommands, overlayPendingCommands } from "../pending-overlay";
import type { LocalCommand } from "../live-local-store";
import type { LiveEventSummary } from "../../live-match-types";

function makeCommand(overrides: Partial<LocalCommand> = {}): LocalCommand {
  const now = Date.now();
  return {
    clientEventId: "evt-1",
    subjectType: "LEAGUE",
    subjectId: "match-1",
    sessionId: "session-1",
    eventType: "GOAL_FOR",
    status: "LOCAL_PENDING",
    localOrdinal: 1,
    createdAt: now,
    updatedAt: now,
    attemptCount: 0,
    ...overrides,
  };
}

describe("summarizePendingCommands", () => {
  it("counts LOCAL_PENDING/SENDING/ACCEPTED_PENDING_PERSISTENCE as pending", () => {
    const summary = summarizePendingCommands([
      makeCommand({ clientEventId: "a", status: "LOCAL_PENDING" }),
      makeCommand({ clientEventId: "b", status: "SENDING" }),
      makeCommand({ clientEventId: "c", status: "ACCEPTED_PENDING_PERSISTENCE" }),
      makeCommand({ clientEventId: "d", status: "PERSISTED" }),
    ]);
    expect(summary).toEqual({ pendingCount: 3, needsReviewCount: 0, failedCount: 0 });
  });

  it("counts NEEDS_REVIEW and FAILED_TERMINAL separately from pendingCount", () => {
    const summary = summarizePendingCommands([
      makeCommand({ clientEventId: "a", status: "NEEDS_REVIEW" }),
      makeCommand({ clientEventId: "b", status: "FAILED_TERMINAL" }),
    ]);
    expect(summary).toEqual({ pendingCount: 0, needsReviewCount: 1, failedCount: 1 });
  });

  it("returns all zeros for an empty list", () => {
    expect(summarizePendingCommands([])).toEqual({ pendingCount: 0, needsReviewCount: 0, failedCount: 0 });
  });
});

describe("overlayPendingCommands", () => {
  it("includes a not-yet-PERSISTED command in the display list", () => {
    const commands = [makeCommand({ status: "LOCAL_PENDING" })];
    const merged = overlayPendingCommands([], commands);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("evt-1");
  });

  it("excludes a PERSISTED command — it is expected to already appear via the canonical poll", () => {
    const commands = [makeCommand({ status: "PERSISTED" })];
    const merged = overlayPendingCommands([], commands);
    expect(merged).toHaveLength(0);
  });

  it("excludes an EVENT_REVERSED command — reversals are handled by removing the original, not by displaying the reversal itself", () => {
    const commands = [makeCommand({ eventType: "EVENT_REVERSED", status: "LOCAL_PENDING" })];
    const merged = overlayPendingCommands([], commands);
    expect(merged).toHaveLength(0);
  });

  it("keeps ACCEPTED_PENDING_PERSISTENCE visible — durability is not yet confirmed", () => {
    const commands = [makeCommand({ status: "ACCEPTED_PENDING_PERSISTENCE" })];
    const merged = overlayPendingCommands([], commands);
    expect(merged).toHaveLength(1);
  });

  it("keeps NEEDS_REVIEW/FAILED_TERMINAL visible — never silently discarded (D13)", () => {
    const commands = [
      makeCommand({ clientEventId: "a", status: "NEEDS_REVIEW" }),
      makeCommand({ clientEventId: "b", status: "FAILED_TERMINAL" }),
    ];
    const merged = overlayPendingCommands([], commands);
    expect(merged.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("merges canonical and local-only events, sorted by wall-clock time (most recent first)", () => {
    const canonical: LiveEventSummary[] = [
      { id: "server-1", eventType: "GOAL_AGAINST", period: null, matchSeconds: null, wallClockTime: new Date("2026-01-01T10:00:00Z"), playerId: null, secondaryPlayerId: null, isCorrected: false, isReversed: false, correctsEventId: null, positionChange: null },
    ];
    const local = [makeCommand({ clientEventId: "local-1", status: "LOCAL_PENDING" })];
    const merged = overlayPendingCommands(canonical, local);
    // The local entry has no wallClockTime (null), so it sorts after the timed canonical entry.
    expect(merged.map((e) => e.id)).toEqual(["server-1", "local-1"]);
  });

  it("caps the merged list to 15 items", () => {
    const commands = Array.from({ length: 20 }, (_, i) => makeCommand({ clientEventId: `evt-${i}`, status: "LOCAL_PENDING" }));
    const merged = overlayPendingCommands([], commands);
    expect(merged).toHaveLength(15);
  });

  it("derives positionChange from a POSITIONS_CHANGED command's payload", () => {
    const commands = [
      makeCommand({
        eventType: "POSITIONS_CHANGED",
        playerId: "p1",
        payload: { fromPosition: "CM", toPosition: "CB" },
        status: "LOCAL_PENDING",
      }),
    ];
    const merged = overlayPendingCommands([], commands);
    expect(merged[0].positionChange).toEqual({ fromPosition: "CM", toPosition: "CB" });
  });
});
