import type { Scene } from "@/features/canvas/note-canvas"
import { fromStored, toStored } from "@/features/canvas/scene-codec"

// A guest's writing, kept in this browser. IndexedDB, not localStorage, because
// pasted images are big and localStorage holds only about 5 MB. The browser can
// still refuse (private windows, full disk), so every call can fail.
const DB = "skrrmath"
const STORE = "scenes"

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () =>
      reject(req.error ?? new Error("Browser storage is not available."))
  })
}

async function run<T>(
  mode: IDBTransactionMode,
  job: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = job(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () =>
        reject(tx.error ?? new Error("Could not use browser storage."))
      tx.onabort = () =>
        reject(tx.error ?? new Error("Browser storage is full or blocked."))
    })
  } finally {
    db.close()
  }
}

export async function loadGuestScene(
  noteId: string
): Promise<Scene | undefined> {
  try {
    return fromStored(await run("readonly", (s) => s.get(noteId)))
  } catch {
    return undefined // storage unavailable: start empty
  }
}

export async function saveGuestScene(
  noteId: string,
  scene: Scene
): Promise<void> {
  await run("readwrite", (s) => s.put(toStored(scene), noteId))
}

export async function deleteGuestScene(noteId: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(noteId))
  } catch {
    // nothing to remove, or storage unavailable
  }
}
