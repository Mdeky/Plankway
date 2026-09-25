/**
 * Minimal promise wrapper around IndexedDB. When IndexedDB is unavailable (private mode,
 * blocked storage) it falls back to memory, so the game still works for this visit.
 */
const DB_NAME = 'bridgle';
const DB_VERSION = 1;
export const STORES = { daily: 'daily' } as const;
type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<StoreName, Map<IDBValidKey, unknown>>();

function open(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORES.daily)) db.createObjectStore(STORES.daily, { keyPath: 'number' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function mem(store: StoreName): Map<IDBValidKey, unknown> {
  let m = memory.get(store);
  if (!m) memory.set(store, (m = new Map()));
  return m;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await open();
  if (!db) return mem(store).get(key) as T | undefined;
  try {
    return (await request(db.transaction(store).objectStore(store).get(key))) as T | undefined;
  } catch {
    return mem(store).get(key) as T | undefined;
  }
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  if (!db) return [...mem(store).values()] as T[];
  try {
    return (await request(db.transaction(store).objectStore(store).getAll())) as T[];
  } catch {
    return [...mem(store).values()] as T[];
  }
}

export async function idbPut<T extends object>(store: StoreName, value: T, key: IDBValidKey): Promise<void> {
  mem(store).set(key, value);
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Kept in memory for this visit.
  }
}

export async function idbClear(store: StoreName): Promise<void> {
  mem(store).clear();
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // nothing stored
  }
}
