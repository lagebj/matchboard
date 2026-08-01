const DB_NAME = "matchboard-live";
const DB_VERSION = 1;
const EVENTS_STORE = "events";
const SESSION_STORE = "session";

export interface LocalEvent {
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

export interface LocalSession {
  id: string;
  matchId: string;
  coachId: string;
  startedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const eventStore = db.createObjectStore(EVENTS_STORE, { keyPath: "clientEventId" });
        eventStore.createIndex("matchId", "matchId", { unique: false });
        eventStore.createIndex("synced", "synced", { unique: false });
        eventStore.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: "matchId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveEventLocally(event: LocalEvent): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS_STORE, "readwrite");
    const store = tx.objectStore(EVENTS_STORE);
    const request = store.put(event);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => {};
  });
}

export async function markEventSynced(clientEventId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS_STORE, "readwrite");
    const store = tx.objectStore(EVENTS_STORE);
    const getReq = store.get(clientEventId);
    getReq.onsuccess = () => {
      const event = getReq.result;
      if (event) {
        event.synced = true;
        store.put(event);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getUnsyncedEvents(matchId: string): Promise<LocalEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS_STORE, "readonly");
    const store = tx.objectStore(EVENTS_STORE);
    const index = store.index("matchId");
    const request = index.getAll(matchId);
    request.onsuccess = () => {
      const events = request.result as LocalEvent[];
      resolve(events.filter((e) => !e.synced).sort((a, b) => a.createdAt - b.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllLocalEvents(matchId: string): Promise<LocalEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS_STORE, "readonly");
    const store = tx.objectStore(EVENTS_STORE);
    const index = store.index("matchId");
    const request = index.getAll(matchId);
    request.onsuccess = () => {
      resolve((request.result as LocalEvent[]).sort((a, b) => a.createdAt - b.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearLocalEvents(matchId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS_STORE, "readwrite");
    const store = tx.objectStore(EVENTS_STORE);
    const index = store.index("matchId");
    const request = index.openCursor(matchId);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSessionLocally(session: LocalSession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readwrite");
    const store = tx.objectStore(SESSION_STORE);
    const request = store.put(session);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalSession(matchId: string): Promise<LocalSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readonly");
    const store = tx.objectStore(SESSION_STORE);
    const request = store.get(matchId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearLocalSession(matchId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readwrite");
    const store = tx.objectStore(SESSION_STORE);
    const request = store.delete(matchId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}