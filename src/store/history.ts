import type { ChatMessage } from "../providers/types";

/**
 * Durable thread history in IndexedDB. chrome.storage caps out well before this
 * would, and an index gives cheap newest-first listing without loading the lot.
 * Everything stays on this machine — nothing here is ever transmitted.
 */
export interface HistoryThread {
  /** Same id as the trigger that produced it. */
  id: string;
  createdAt: number;
  updatedAt: number;
  selection: string;
  title: string;
  url: string;
  providerId: string;
  model: string;
  messages: ChatMessage[];
}

const DB_NAME = "gloss";
const STORE = "threads";
const VERSION = 1;

let handle: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  return (handle ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function request<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function cursor(
  direction: IDBCursorDirection,
  range: IDBKeyRange | null,
  visit: (thread: HistoryThread, cur: IDBCursorWithValue) => boolean | void,
  mode: IDBTransactionMode = "readonly",
): Promise<void> {
  return open().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const req = db
          .transaction(STORE, mode)
          .objectStore(STORE)
          .index("updatedAt")
          .openCursor(range, direction);
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return resolve();
          // Returning false stops the walk early.
          if (visit(cur.value as HistoryThread, cur) === false) return resolve();
          cur.continue();
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function saveThread(thread: HistoryThread): Promise<void> {
  await request("readwrite", (s) => s.put(thread));
}

export function getThread(id: string): Promise<HistoryThread | undefined> {
  return request("readonly", (s) => s.get(id));
}

export async function listThreads(limit = 200): Promise<HistoryThread[]> {
  const out: HistoryThread[] = [];
  await cursor("prev", null, (t) => {
    out.push(t);
    return out.length < limit;
  });
  return out;
}

export async function deleteThread(id: string): Promise<void> {
  await request("readwrite", (s) => s.delete(id));
}

export async function clearHistory(): Promise<void> {
  await request("readwrite", (s) => s.clear());
}

export function countThreads(): Promise<number> {
  return request("readonly", (s) => s.count());
}

/** Returns how many were removed. `days` of 0 means keep everything. */
export async function purgeOlderThan(days: number): Promise<number> {
  if (!days) return 0;
  const cutoff = Date.now() - days * 86_400_000;
  let removed = 0;
  await cursor(
    "next",
    IDBKeyRange.upperBound(cutoff),
    (_t, cur) => {
      cur.delete();
      removed++;
    },
    "readwrite",
  );
  return removed;
}

export async function estimateUsage(): Promise<string> {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  if (!est?.usage) return "unknown";
  const kb = est.usage / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}
