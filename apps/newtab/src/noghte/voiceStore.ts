/**
 * The recordings made in this browser: one blob each in IndexedDB, by the file name the note keeps
 * (as the phone keeps its own in a folder). The audio does not sync, only the note's block does — so
 * a recording plays where it was made, and elsewhere the block still shows its wave and length.
 */

const DB = "noghte-voice";
const STORE = "audio";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error("indexedDB"));
    };
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = work(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => {
        resolve(req.result);
      };
      req.onerror = () => {
        reject(req.error ?? new Error("indexedDB"));
      };
    });
  } finally {
    db.close();
  }
}

export const keepVoice = (file: string, blob: Blob): Promise<IDBValidKey> =>
  run("readwrite", (s) => s.put(blob, file));

/** A playable address for a recording made here, or null (another device made it, or it was removed). */
export async function voiceUrl(file: string): Promise<string | null> {
  try {
    const blob = await run<Blob | undefined>(
      "readonly",
      (s) => s.get(file) as IDBRequest<Blob | undefined>,
    );
    return blob === undefined ? null : URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function dropVoice(file: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(file));
  } catch {
    // already gone
  }
}
