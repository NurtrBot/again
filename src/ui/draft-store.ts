/* Local pre-auth draft: the chosen photo lives in IndexedDB (never localStorage)
 * with a 24-hour TTL. After sign-in the file is uploaded and the record removed. */
'use client';

const DB_NAME = 'again-drafts';
const STORE = 'drafts';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface LocalDraft {
  id: string;
  blob: Blob;
  filename: string;
  type: string;
  createdAt: number;
  feeling?: string;
  direction?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('indexeddb_unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexeddb_error'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error ?? new Error('indexeddb_error'));
    tx.oncomplete = () => db.close();
  });
}

/** In-memory fallback when private browsing refuses storage. */
let memoryDraft: LocalDraft | null = null;

export async function saveLocalDraft(draft: LocalDraft): Promise<{ persisted: boolean }> {
  try {
    await withStore('readwrite', (s) => s.put(draft));
    memoryDraft = null;
    return { persisted: true };
  } catch {
    memoryDraft = draft;
    return { persisted: false };
  }
}

export async function getLocalDraft(id?: string): Promise<LocalDraft | null> {
  if (memoryDraft && (!id || memoryDraft.id === id)) return memoryDraft;
  try {
    const all = await withStore<LocalDraft[]>('readonly', (s) => s.getAll());
    const now = Date.now();
    const valid = all.filter((d) => now - d.createdAt < TTL_MS);
    for (const d of all) if (now - d.createdAt >= TTL_MS) await deleteLocalDraft(d.id);
    if (id) return valid.find((d) => d.id === id) ?? null;
    return valid.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  } catch {
    return null;
  }
}

export async function deleteLocalDraft(id: string): Promise<void> {
  if (memoryDraft?.id === id) memoryDraft = null;
  try {
    await withStore('readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function clearLocalDrafts(): Promise<void> {
  memoryDraft = null;
  try {
    await withStore('readwrite', (s) => s.clear());
  } catch {
    /* ignore */
  }
}

export function newDraftId(): string {
  return crypto.randomUUID();
}
