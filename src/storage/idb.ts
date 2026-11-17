/** Minimal promise wrapper over IndexedDB for the `money-control` database. */

export const DB_NAME = "money-control";
const DB_VERSION = 1;
export type StoreName = "keys" | "state" | "meta";

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
let dbFactory: IDBFactory | null = null;

export function openDb(): Promise<IDBDatabase> {
  // Re-open when the factory changes (tests swap in a fresh fake IndexedDB).
  if (!dbPromise || dbFactory !== indexedDB) {
    dbFactory = indexedDB;
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of ["keys", "state", "meta"] as const) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      }
    };
    dbPromise = promisify(req);
  }
  return dbPromise;
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb();
  return promisify(db.transaction(store, "readonly").objectStore(store).get(key)) as Promise<
    T | undefined
  >;
}

export async function idbPut(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value, key);
  await txDone(tx);
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(key);
  await txDone(tx);
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}
