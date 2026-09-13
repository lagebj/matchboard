import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  saveCommandLocally,
  updateCommandStatus,
  getNextLocalOrdinal,
  getAllCommands,
  getRetryableCommands,
  getUnresolvedCommands,
  recoverInterruptedSends,
  clearPersistedCommands,
  saveSessionLocally,
  getLocalSession,
  clearLocalSession,
  type LocalCommand,
} from "../live-local-store";

/**
 * ADR-0138 Bundle 6 ("Durable browser outbox"), DECISIONS.md D12/D13, TEST_MATRIX.md §5.
 * Uses `fake-indexeddb` for genuine IndexedDB semantics (versionchange transactions, cursors,
 * indexes) in a plain Node test environment — no jsdom needed.
 *
 * Every test uses its own unique `subjectId` (never deletes/recreates the database between
 * tests) so tests never interfere with each other and the suite never needs to coordinate
 * closing the many `IDBDatabase` connections this module opens over its lifetime — exactly the
 * durability property being tested (a real browser tab behaves the same way: connections
 * accumulate across a session and are cleaned up by the browser, not by application code).
 * The one exception, the schema-migration test, lives in its own file
 * (`live-local-store-migration.test.ts`) so it gets a database with no prior connections at all.
 */

let subjectCounter = 0;
function uniqueSubjectId(): string {
  subjectCounter += 1;
  return `match-${subjectCounter}-${Date.now()}`;
}

function makeCommand(subjectId: string, overrides: Partial<LocalCommand> = {}): LocalCommand {
  const now = Date.now();
  return {
    clientEventId: `${subjectId}-evt-1`,
    subjectType: "LEAGUE",
    subjectId,
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

describe("saveCommandLocally / getAllCommands", () => {
  it("persists a command before any send is attempted — the command is durable immediately", async () => {
    const subjectId = uniqueSubjectId();
    const command = makeCommand(subjectId);
    await saveCommandLocally(command);
    const all = await getAllCommands(subjectId);
    expect(all).toEqual([command]);
  });

  it("unsent commands survive a fresh store reopen (a new call to any exported function re-opens the DB)", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "evt-1" }));
    // Simulate a fresh page load: no in-memory state carries over, only a new function call.
    const reopened = await getAllCommands(subjectId);
    expect(reopened).toHaveLength(1);
    expect(reopened[0].clientEventId).toBe("evt-1");
  });

  it("orders commands by localOrdinal, not insertion order", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "evt-2", localOrdinal: 2 }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "evt-1", localOrdinal: 1 }));
    const all = await getAllCommands(subjectId);
    expect(all.map((c) => c.clientEventId)).toEqual(["evt-1", "evt-2"]);
  });
});

describe("getNextLocalOrdinal", () => {
  it("is monotonic per subject, starting at 1", async () => {
    const subjectId = uniqueSubjectId();
    expect(await getNextLocalOrdinal(subjectId)).toBe(1);
    expect(await getNextLocalOrdinal(subjectId)).toBe(2);
    expect(await getNextLocalOrdinal(subjectId)).toBe(3);
  });

  it("tracks each subject independently", async () => {
    const subjectA = uniqueSubjectId();
    const subjectB = uniqueSubjectId();
    expect(await getNextLocalOrdinal(subjectA)).toBe(1);
    expect(await getNextLocalOrdinal(subjectB)).toBe(1);
    expect(await getNextLocalOrdinal(subjectA)).toBe(2);
  });
});

describe("updateCommandStatus", () => {
  it("changes status without renumbering localOrdinal or regenerating clientEventId", async () => {
    const subjectId = uniqueSubjectId();
    const command = makeCommand(subjectId, { localOrdinal: 5 });
    await saveCommandLocally(command);
    await updateCommandStatus(command.clientEventId, "SENDING", { attemptCount: 1 });
    const [updated] = await getAllCommands(subjectId);
    expect(updated.clientEventId).toBe(command.clientEventId);
    expect(updated.localOrdinal).toBe(5);
    expect(updated.status).toBe("SENDING");
    expect(updated.attemptCount).toBe(1);
  });

  it("is a no-op for a clientEventId that does not exist", async () => {
    await expect(updateCommandStatus("nonexistent-" + uniqueSubjectId(), "PERSISTED")).resolves.toBeUndefined();
  });
});

describe("getRetryableCommands", () => {
  it("returns only LOCAL_PENDING commands, never SENDING/NEEDS_REVIEW/FAILED_TERMINAL", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "pending", localOrdinal: 1, status: "LOCAL_PENDING" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "sending", localOrdinal: 2, status: "SENDING" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "review", localOrdinal: 3, status: "NEEDS_REVIEW" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "failed", localOrdinal: 4, status: "FAILED_TERMINAL" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "persisted", localOrdinal: 5, status: "PERSISTED" }));

    const retryable = await getRetryableCommands(subjectId);
    expect(retryable.map((c) => c.clientEventId)).toEqual(["pending"]);
  });
});

describe("recoverInterruptedSends (D13, TEST_MATRIX: 'SENDING interrupted by crash recovers to retryable state')", () => {
  it("demotes a SENDING row to LOCAL_PENDING", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { status: "SENDING", attemptCount: 1 }));
    const recovered = await recoverInterruptedSends(subjectId);
    expect(recovered).toHaveLength(1);
    const [command] = await getAllCommands(subjectId);
    expect(command.status).toBe("LOCAL_PENDING");
  });

  it("does not touch a command already in any other status", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "a", localOrdinal: 1, status: "LOCAL_PENDING" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "b", localOrdinal: 2, status: "PERSISTED" }));
    const recovered = await recoverInterruptedSends(subjectId);
    expect(recovered).toHaveLength(0);
    const all = await getAllCommands(subjectId);
    expect(all.map((c) => c.status)).toEqual(["LOCAL_PENDING", "PERSISTED"]);
  });
});

describe("ACCEPTED_PENDING_PERSISTENCE / NEEDS_REVIEW survive reload", () => {
  it("ACCEPTED_PENDING_PERSISTENCE persists across a fresh read", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { status: "ACCEPTED_PENDING_PERSISTENCE" }));
    const [command] = await getAllCommands(subjectId);
    expect(command.status).toBe("ACCEPTED_PENDING_PERSISTENCE");
  });

  it("NEEDS_REVIEW persists across a fresh read, with its conflict code intact", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { status: "NEEDS_REVIEW", conflictCode: "PLAYER_ALREADY_OFF_FIELD" }));
    const [command] = await getAllCommands(subjectId);
    expect(command.status).toBe("NEEDS_REVIEW");
    expect(command.conflictCode).toBe("PLAYER_ALREADY_OFF_FIELD");
  });
});

describe("getUnresolvedCommands", () => {
  it("includes every non-PERSISTED status", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "a", localOrdinal: 1, status: "LOCAL_PENDING" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "b", localOrdinal: 2, status: "SENDING" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "c", localOrdinal: 3, status: "ACCEPTED_PENDING_PERSISTENCE" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "d", localOrdinal: 4, status: "NEEDS_REVIEW" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "e", localOrdinal: 5, status: "FAILED_TERMINAL" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "f", localOrdinal: 6, status: "PERSISTED" }));

    const unresolved = await getUnresolvedCommands(subjectId);
    expect(unresolved.map((c) => c.clientEventId)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("clearPersistedCommands (D13: never delete an unresolved command)", () => {
  it("removes only PERSISTED rows, reporting how many unresolved rows remain", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "persisted-1", localOrdinal: 1, status: "PERSISTED" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "persisted-2", localOrdinal: 2, status: "PERSISTED" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "pending", localOrdinal: 3, status: "LOCAL_PENDING" }));
    await saveCommandLocally(makeCommand(subjectId, { clientEventId: "review", localOrdinal: 4, status: "NEEDS_REVIEW" }));

    const result = await clearPersistedCommands(subjectId);
    expect(result).toEqual({ removed: 2, retainedUnresolved: 2 });

    const remaining = await getAllCommands(subjectId);
    expect(remaining.map((c) => c.clientEventId).sort()).toEqual(["pending", "review"]);
  });

  it("removes nothing and reports zero when every row is unresolved", async () => {
    const subjectId = uniqueSubjectId();
    await saveCommandLocally(makeCommand(subjectId, { status: "NEEDS_REVIEW" }));
    const result = await clearPersistedCommands(subjectId);
    expect(result).toEqual({ removed: 0, retainedUnresolved: 1 });
  });
});

describe("session store", () => {
  it("saves, reads, and clears a session by subjectId", async () => {
    const subjectId = uniqueSubjectId();
    await saveSessionLocally({ subjectType: "LEAGUE", subjectId, id: "session-1", coachId: "coach-1", startedAt: "2026-01-01T00:00:00.000Z" });
    const session = await getLocalSession(subjectId);
    expect(session?.id).toBe("session-1");

    await clearLocalSession(subjectId);
    expect(await getLocalSession(subjectId)).toBeNull();
  });
});
