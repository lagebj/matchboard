import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { getAllCommands, getLocalSession, getPreparedPackage } from "../live-local-store";

/**
 * ADR-0138 Bundle 7 — regression test for a real migration bug caught before merge: the v1->v3
 * upgrade path's "drop and recreate the legacy session store" logic was originally gated only on
 * "does a session store exist", which is also true for an already-correct v2 database — a v2->v3
 * upgrade (adding the new prepared-package store) would have wrongly wiped existing v2
 * command/session data for no reason. Fixed by gating that legacy-only logic on
 * `fromVersion < 2`. Isolated in its own file for a guaranteed-fresh `indexedDB` global, matching
 * `live-local-store-migration.test.ts`'s established pattern.
 */
describe("v2 -> v3 migration (adding the prepared-package store)", () => {
  it("preserves existing v2 commands and session data untouched", async () => {
    const dbName = "matchboard-live";

    await new Promise<void>((resolve, reject) => {
      const openReq = indexedDB.open(dbName, 2);
      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        const store = db.createObjectStore("commands", { keyPath: "clientEventId" });
        store.createIndex("subjectId", "subjectId", { unique: false });
        store.createIndex("subjectId_status", ["subjectId", "status"], { unique: false });
        store.createIndex("subjectId_localOrdinal", ["subjectId", "localOrdinal"], { unique: false });
        db.createObjectStore("session", { keyPath: "subjectId" });
        db.createObjectStore("counters", { keyPath: "subjectId" });
      };
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction(["commands", "session"], "readwrite");
        tx.objectStore("commands").put({
          clientEventId: "evt-v2-1",
          subjectType: "LEAGUE",
          subjectId: "match-v2",
          sessionId: "session-v2",
          eventType: "GOAL_FOR",
          status: "PERSISTED",
          localOrdinal: 1,
          createdAt: 1000,
          updatedAt: 1000,
          attemptCount: 0,
        });
        tx.objectStore("session").put({ subjectType: "LEAGUE", subjectId: "match-v2", id: "session-v2", coachId: "coach-1", startedAt: "2026-01-01T00:00:00.000Z" });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });

    // Opening through the real module bumps v2 -> v3 (current DB_VERSION), running the real
    // upgrade path.
    const commands = await getAllCommands("match-v2");
    expect(commands).toHaveLength(1);
    expect(commands[0].clientEventId).toBe("evt-v2-1");
    expect(commands[0].status).toBe("PERSISTED");

    const session = await getLocalSession("match-v2");
    expect(session?.id).toBe("session-v2");

    // The new store exists and is empty for this subject — no crash, no fabricated data.
    expect(await getPreparedPackage("match-v2")).toBeNull();
  });
});
