/**
 * Durable browser outbox (ADR-0138 Bundle 6, DECISIONS.md D12/D13).
 *
 * IndexedDB is an outbox, not truth — Neon remains the system of record; this store exists so a
 * coach's recorded action survives a page reload, browser crash, or connectivity loss on the
 * *same device* before the coordinator has confirmed it. Every local command has one of six
 * durable synchronization states (D13):
 *
 *   LOCAL_PENDING              — captured locally, not yet sent (or returned here after a
 *                                 transient send failure / a crash interrupted an in-flight send)
 *   SENDING                    — a send attempt is currently in flight
 *   ACCEPTED_PENDING_PERSISTENCE — the coordinator accepted the operation (a real canonical
 *                                 sequence exists) but Neon durability is not yet confirmed
 *   PERSISTED                  — confirmed durably written to Neon
 *   NEEDS_REVIEW               — a genuine state-sensitive conflict was detected; only a coach
 *                                 decision resolves this (Bundle 8's job to surface a UI for it —
 *                                 this bundle only makes the state a legal, durable outcome)
 *   FAILED_TERMINAL            — the operation is invalid on its own terms and will never
 *                                 succeed no matter how many times it is retried
 *
 * `LOCAL_PENDING`, `NEEDS_REVIEW`, and `FAILED_TERMINAL` rows are never auto-deleted (D13) — only
 * `clearPersistedCommands()` removes rows, and only `PERSISTED` ones.
 *
 * Commands are keyed by `subjectType` + `subjectId` (League match id / Event match id) rather
 * than a single overloaded `matchId` field, so League and Event local queues are explicitly
 * distinguished even though — incidentally — their id namespaces never actually collide (League
 * `Match.id` and Event `EventMatch.id` are disjoint CUID tables). `subjectId` alone is sufficient
 * for every query below; `subjectType` is carried for explicitness/diagnostics, not because a
 * query would be ambiguous without it.
 */

const DB_NAME = "matchboard-live";
const DB_VERSION = 3;
const COMMANDS_STORE = "commands";
const SESSION_STORE = "session";
const COUNTERS_STORE = "counters";
const PACKAGE_STORE = "preparedPackage";
const LEGACY_EVENTS_STORE = "events";

export type SubjectType = "LEAGUE" | "EVENT";

export type CommandStatus =
  | "LOCAL_PENDING"
  | "SENDING"
  | "ACCEPTED_PENDING_PERSISTENCE"
  | "PERSISTED"
  | "NEEDS_REVIEW"
  | "FAILED_TERMINAL";

/** Statuses that still need eventual resolution — never safe to delete (D13). */
const UNRESOLVED_STATUSES: readonly CommandStatus[] = [
  "LOCAL_PENDING",
  "SENDING",
  "ACCEPTED_PENDING_PERSISTENCE",
  "NEEDS_REVIEW",
  "FAILED_TERMINAL",
];

/** Statuses a retry loop should actively (re)send. `SENDING` is deliberately excluded here — a
 * row found in `SENDING` on load means a prior attempt was interrupted (crash/reload) and must
 * first be recovered to `LOCAL_PENDING` via `recoverInterruptedSends()` before it is retried;
 * this set is what a normal, already-recovered retry pass acts on. */
const RETRYABLE_STATUSES: readonly CommandStatus[] = ["LOCAL_PENDING"];

export interface LocalCommand {
  /** Primary key — generated client-side, stable for the life of this command (never
   * regenerated on retry, which is what makes server-side clientEventId dedup effective). */
  clientEventId: string;
  subjectType: SubjectType;
  subjectId: string;
  sessionId: string;
  eventType: string;
  period?: string;
  matchSeconds?: number;
  playerId?: string;
  secondaryPlayerId?: string;
  payload?: Record<string, unknown>;
  correctionType?: string;
  correctsEventId?: string;
  status: CommandStatus;
  /** Monotonic per-(subjectType, subjectId) ordinal, assigned at creation time before any
   * network attempt. A local-only ordering aid, distinct from the server-assigned canonical
   * `sequence` — never renumbered once assigned. */
  localOrdinal: number;
  createdAt: number;
  updatedAt: number;
  /** Incremented on every send attempt (including the first). */
  attemptCount: number;
  lastAttemptAt?: number;
  /** Set when status is NEEDS_REVIEW. */
  conflictCode?: string;
  /** Set when status is FAILED_TERMINAL — never silently discarded. */
  terminalReason?: string;
}

export interface LocalSession {
  subjectType: SubjectType;
  subjectId: string;
  id: string;
  coachId: string;
  startedAt: string;
}

/** Legacy pre-Bundle-6 row shape, read only during migration. */
interface LegacyLocalEvent {
  id: string;
  matchId: string;
  sessionId: string;
  eventType: string;
  period?: string;
  matchSeconds?: number;
  playerId?: string;
  secondaryPlayerId?: string;
  payload?: Record<string, unknown>;
  correctionType?: string;
  correctsEventId?: string;
  clientEventId: string;
  synced: boolean;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      const fromVersion = event.oldVersion;

      if (fromVersion < 1) {
        // Fresh install — go straight to the current schema, no migration needed.
        createCurrentSchema(db);
        return;
      }

      // Migrating from v1 (the pre-Bundle-6 `events`/`session` boolean-synced schema) only —
      // v2->v3 (Bundle 7, adding the prepared-package store) needs none of this: `commands`/
      // `session`/`counters` already have the correct v2 shape and must be left untouched.
      // ADR-0138 Bundle 6, D13/D19 — this data is transient, device-local, live-session-scoped
      // state (never long-term storage), so a best-effort default for the one field the old
      // schema never recorded (`subjectType`) is acceptable and does not affect correctness:
      // every query in this module keys off `subjectId` alone (already collision-free across
      // League/Event id namespaces) — `subjectType` is carried for explicitness/diagnostics,
      // never as query-disambiguating authority.
      //
      // The legacy `session` store shares this schema's store *name* but a different keyPath
      // (`matchId` vs `subjectId`) — IndexedDB cannot change a store's keyPath in place, so it
      // is dropped and recreated rather than migrated. Unlike command/event rows (irreplaceable
      // coach-recorded actions — migrated below), a session row is pure re-derivable metadata:
      // `LiveMatchClient`'s own mount effect re-saves it from `getPreMatchPackage()`'s
      // `activeSession` the moment the page next loads, so losing it across this one upgrade is
      // a non-event, not a data-loss concern.
      if (fromVersion < 2) {
        if (db.objectStoreNames.contains(SESSION_STORE)) db.deleteObjectStore(SESSION_STORE);
        createCurrentSchema(db);
        if (tx && db.objectStoreNames.contains(LEGACY_EVENTS_STORE)) {
          migrateLegacyEvents(tx);
        }
        return;
      }

      // v2 -> v3 (Bundle 7): only a new, empty prepared-package store is added.
      createCurrentSchema(db);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createCurrentSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(COMMANDS_STORE)) {
    const store = db.createObjectStore(COMMANDS_STORE, { keyPath: "clientEventId" });
    store.createIndex("subjectId", "subjectId", { unique: false });
    store.createIndex("subjectId_status", ["subjectId", "status"], { unique: false });
    store.createIndex("subjectId_localOrdinal", ["subjectId", "localOrdinal"], { unique: false });
  }
  if (!db.objectStoreNames.contains(SESSION_STORE)) {
    db.createObjectStore(SESSION_STORE, { keyPath: "subjectId" });
  }
  if (!db.objectStoreNames.contains(COUNTERS_STORE)) {
    db.createObjectStore(COUNTERS_STORE, { keyPath: "subjectId" });
  }
  if (!db.objectStoreNames.contains(PACKAGE_STORE)) {
    db.createObjectStore(PACKAGE_STORE, { keyPath: "subjectId" });
  }
}

/** Runs inside the same versionchange transaction as the schema upgrade — reads every row from
 * the legacy `events` store, converts it, and writes it into the new `commands` store (an
 * irreplaceable coach-recorded action must never be silently dropped by a schema migration),
 * then removes the legacy store. All within one atomic transaction: either the whole migration
 * lands, or (on error) none of it does — never a half-migrated database. */
function migrateLegacyEvents(tx: IDBTransaction): void {
  const legacyEventsStore = tx.objectStore(LEGACY_EVENTS_STORE);
  const commandsStore = tx.objectStore(COMMANDS_STORE);
  const countersStore = tx.objectStore(COUNTERS_STORE);
  const maxOrdinalBySubject = new Map<string, number>();

  legacyEventsStore.openCursor().onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
    if (!cursor) {
      // Cursor exhausted — every legacy row has been converted; persist the final per-subject
      // ordinal counters so a new command created after migration continues the sequence rather
      // than restarting at 1 and colliding with a migrated row's ordinal, then remove the now-
      // fully-migrated legacy store entirely (never leave an orphaned, permanently-empty store).
      for (const [subjectId, maxOrdinal] of maxOrdinalBySubject) {
        countersStore.put({ subjectId, value: maxOrdinal });
      }
      tx.db.deleteObjectStore(LEGACY_EVENTS_STORE);
      return;
    }
    const legacy = cursor.value as LegacyLocalEvent;
    const subjectId = legacy.matchId;
    const nextOrdinal = (maxOrdinalBySubject.get(subjectId) ?? 0) + 1;
    maxOrdinalBySubject.set(subjectId, nextOrdinal);

    const migrated: LocalCommand = {
      clientEventId: legacy.clientEventId,
      subjectType: "LEAGUE", // best-effort default — see the ADR-0138 Bundle 6 comment above
      subjectId,
      sessionId: legacy.sessionId,
      eventType: legacy.eventType,
      period: legacy.period,
      matchSeconds: legacy.matchSeconds,
      playerId: legacy.playerId,
      secondaryPlayerId: legacy.secondaryPlayerId,
      payload: legacy.payload,
      correctionType: legacy.correctionType,
      correctsEventId: legacy.correctsEventId,
      status: legacy.synced ? "PERSISTED" : "LOCAL_PENDING",
      localOrdinal: nextOrdinal,
      createdAt: legacy.createdAt,
      updatedAt: legacy.createdAt,
      attemptCount: 0,
    };
    commandsStore.put(migrated);
    cursor.continue();
  };
}

export async function saveCommandLocally(command: LocalCommand): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMMANDS_STORE, "readwrite");
    tx.objectStore(COMMANDS_STORE).put(command);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface CommandStatusUpdate {
  attemptCount?: number;
  lastAttemptAt?: number;
  conflictCode?: string;
  terminalReason?: string;
}

/** Read-modify-write status transition. Never renumbers `localOrdinal`, never regenerates
 * `clientEventId` — only `status`/`updatedAt` and the optional bookkeeping fields change. */
export async function updateCommandStatus(
  clientEventId: string,
  status: CommandStatus,
  extra?: CommandStatusUpdate,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMMANDS_STORE, "readwrite");
    const store = tx.objectStore(COMMANDS_STORE);
    const getReq = store.get(clientEventId);
    getReq.onsuccess = () => {
      const command = getReq.result as LocalCommand | undefined;
      if (!command) return; // already deleted/never existed — nothing to update
      store.put({ ...command, status, updatedAt: Date.now(), ...extra });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Atomically assigns the next local ordinal for a subject, before any command referencing it is
 * persisted (work items 3+4: "generate/persist command before network send", "add local
 * ordinal"). Persisted in its own small store rather than derived by scanning `commands` each
 * time — O(1) per assignment regardless of how many commands a subject has accumulated. */
export async function getNextLocalOrdinal(subjectId: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COUNTERS_STORE, "readwrite");
    const store = tx.objectStore(COUNTERS_STORE);
    const getReq = store.get(subjectId);
    let next = 1;
    getReq.onsuccess = () => {
      const existing = getReq.result as { subjectId: string; value: number } | undefined;
      next = (existing?.value ?? 0) + 1;
      store.put({ subjectId, value: next });
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllCommands(subjectId: string): Promise<LocalCommand[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMMANDS_STORE, "readonly");
    const store = tx.objectStore(COMMANDS_STORE);
    const request = store.index("subjectId").getAll(subjectId);
    request.onsuccess = () => {
      resolve((request.result as LocalCommand[]).sort((a, b) => a.localOrdinal - b.localOrdinal));
    };
    request.onerror = () => reject(request.error);
  });
}

/** Commands a retry loop should actively (re)send, in local-ordinal order — `LOCAL_PENDING`
 * only. `SENDING`/`NEEDS_REVIEW`/`FAILED_TERMINAL` are deliberately excluded: a `SENDING` row
 * needs `recoverInterruptedSends()` first, and `NEEDS_REVIEW`/`FAILED_TERMINAL` need a coach
 * decision, never a silent auto-retry. */
export async function getRetryableCommands(subjectId: string): Promise<LocalCommand[]> {
  const all = await getAllCommands(subjectId);
  return all.filter((c) => RETRYABLE_STATUSES.includes(c.status));
}

/** Commands that still need eventual resolution — used to decide whether it is safe to fully
 * clear a subject's local outbox (work items 8/9: never delete an unresolved command). */
export async function getUnresolvedCommands(subjectId: string): Promise<LocalCommand[]> {
  const all = await getAllCommands(subjectId);
  return all.filter((c) => UNRESOLVED_STATUSES.includes(c.status));
}

/** A `SENDING` row found on load means a prior send attempt was interrupted (browser crash, tab
 * closed mid-request, reload) before its outcome was ever recorded — the coordinator may or may
 * not have received it. Demoting to `LOCAL_PENDING` for retry is safe either way: a genuine
 * duplicate resend is deduplicated server-side by `clientEventId` (`recordEventForActor`).
 * Returns the recovered commands so the caller can log/surface this. */
export async function recoverInterruptedSends(subjectId: string): Promise<LocalCommand[]> {
  const all = await getAllCommands(subjectId);
  const interrupted = all.filter((c) => c.status === "SENDING");
  for (const command of interrupted) {
    await updateCommandStatus(command.clientEventId, "LOCAL_PENDING", {
      attemptCount: command.attemptCount,
      lastAttemptAt: command.lastAttemptAt,
    });
  }
  return interrupted;
}

/** Deletes only `PERSISTED` rows for a subject — never a row in any unresolved status (D13, work
 * items 8/9/10). Returns counts so the caller can tell whether the store is now fully clear or
 * something remains for a future review surface (Bundle 8). */
export async function clearPersistedCommands(
  subjectId: string,
): Promise<{ removed: number; retainedUnresolved: number }> {
  const db = await openDB();
  const all = await getAllCommands(subjectId);
  const toRemove = all.filter((c) => c.status === "PERSISTED");
  const retainedUnresolved = all.length - toRemove.length;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(COMMANDS_STORE, "readwrite");
    const store = tx.objectStore(COMMANDS_STORE);
    for (const command of toRemove) store.delete(command.clientEventId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return { removed: toRemove.length, retainedUnresolved };
}

export async function saveSessionLocally(session: LocalSession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readwrite");
    tx.objectStore(SESSION_STORE).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalSession(subjectId: string): Promise<LocalSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readonly");
    const request = tx.objectStore(SESSION_STORE).get(subjectId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearLocalSession(subjectId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readwrite");
    tx.objectStore(SESSION_STORE).delete(subjectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Prepared live match package (ADR-0138 Bundle 7, DECISIONS.md D20 "local outbox" +
 * PROGRAMME.md's scoped offline continuation contract).
 *
 * Everything a live-reporting session's UI needs to render *without* a server round-trip —
 * squad, team names, period configuration — captured the moment a normal online load already
 * fetches it, so a later fully-offline reload (network genuinely unreachable, not merely a
 * slow/failed single request) can reconstruct the same screen from this device's own storage
 * instead of showing a dead page. This is display data, not canonical truth — it is never used
 * to resolve a conflict or override a server response; `live-match-offline-shell.tsx` is its one
 * consumer. Kept type-oblivious here (a generic JSON-serializable record) so this module stays
 * free of a dependency on `SquadPlayer`/`PeriodConfig`'s owning modules — the caller supplies and
 * reads back its own concrete shape.
 */
export interface PreparedLiveMatchPackageBase {
  subjectType: SubjectType;
  subjectId: string;
  savedAt: number;
}

export async function savePreparedPackage<T extends PreparedLiveMatchPackageBase>(pkg: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PACKAGE_STORE, "readwrite");
    tx.objectStore(PACKAGE_STORE).put(pkg);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPreparedPackage<T extends PreparedLiveMatchPackageBase>(subjectId: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PACKAGE_STORE, "readonly");
    const request = tx.objectStore(PACKAGE_STORE).get(subjectId);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** Retention (work item 7): called alongside `clearLocalSession` once a session's outbox is
 * fully resolved and cleared — a prepared package has no purpose once its match is done and
 * never needs to persist past that point. */
export async function clearPreparedPackage(subjectId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PACKAGE_STORE, "readwrite");
    tx.objectStore(PACKAGE_STORE).delete(subjectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
