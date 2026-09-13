import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { getAllCommands, getNextLocalOrdinal, getLocalSession } from "../live-local-store";

/**
 * ADR-0138 Bundle 6 — schema migration from the pre-Bundle-6 boolean-synced `events`/`session`
 * store. Isolated in its own file so this module's `indexedDB` global (fresh per test file under
 * vitest's isolated module registry) has no prior connections from any other test before the
 * migration runs — the exact "first time this browser has ever opened the DB since the upgrade
 * shipped" scenario being tested.
 */
describe("schema migration from the pre-Bundle-6 boolean-synced store", () => {
  it("migrates an old synced=false row to LOCAL_PENDING and synced=true to PERSISTED, preserving all fields, and drops the legacy session row (re-derived on next load instead)", async () => {
    const dbName = "matchboard-live";

    // Build a v1 database by hand, matching the pre-Bundle-6 schema exactly.
    await new Promise<void>((resolve, reject) => {
      const openReq = indexedDB.open(dbName, 1);
      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        const eventStore = db.createObjectStore("events", { keyPath: "clientEventId" });
        eventStore.createIndex("matchId", "matchId", { unique: false });
        eventStore.createIndex("synced", "synced", { unique: false });
        eventStore.createIndex("createdAt", "createdAt", { unique: false });
        db.createObjectStore("session", { keyPath: "matchId" });
      };
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction(["events", "session"], "readwrite");
        tx.objectStore("events").put({
          id: "legacy-1",
          matchId: "match-1",
          sessionId: "session-1",
          eventType: "GOAL_FOR",
          clientEventId: "legacy-1",
          synced: false,
          createdAt: 1000,
        });
        tx.objectStore("events").put({
          id: "legacy-2",
          matchId: "match-1",
          sessionId: "session-1",
          eventType: "GOAL_AGAINST",
          clientEventId: "legacy-2",
          synced: true,
          createdAt: 2000,
        });
        tx.objectStore("session").put({ matchId: "match-1", id: "session-1", coachId: "coach-1", startedAt: "2026-01-01T00:00:00.000Z" });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });

    // Now open through the real module (bumps to v2, running the real migration).
    const migrated = await getAllCommands("match-1");
    expect(migrated).toHaveLength(2);

    const unsynced = migrated.find((c) => c.clientEventId === "legacy-1");
    expect(unsynced?.status).toBe("LOCAL_PENDING");
    expect(unsynced?.subjectId).toBe("match-1");
    expect(unsynced?.eventType).toBe("GOAL_FOR");

    const synced = migrated.find((c) => c.clientEventId === "legacy-2");
    expect(synced?.status).toBe("PERSISTED");
    expect(synced?.eventType).toBe("GOAL_AGAINST");

    // A new command created after migration continues the ordinal sequence rather than
    // colliding with a migrated row's ordinal.
    const nextOrdinal = await getNextLocalOrdinal("match-1");
    expect(nextOrdinal).toBeGreaterThan(Math.max(...migrated.map((c) => c.localOrdinal)));

    // The legacy session row is intentionally not migrated (re-derived from the server on next
    // load instead — see the module's own comment) — reading it back returns null, not a stale
    // or malformed row.
    expect(await getLocalSession("match-1")).toBeNull();
  });
});
