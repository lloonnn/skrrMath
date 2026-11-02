import { fromStored, toStored } from "@/features/canvas/scene-codec"
import {
  deleteGuestScene,
  loadGuestScene,
  saveGuestScene,
} from "@/features/canvas/guest-scenes"
import {
  useNoteStore,
  type NoteStorage,
} from "@/features/canvas/use-note-store"
import { fetchPage, savePage } from "@/features/cloud/cloud"
import { uid } from "@/lib/uid"

// A signed-in user's writing lives in the account. It saves 3 s after you stop.
const cloudStorage: NoteStorage = {
  delayMs: 3000,
  async load(noteId) {
    const row = await fetchPage(noteId)
    return {
      scene: row ? fromStored(row.strokes) : undefined,
      token: row?.id ?? uid(),
    }
  },
  async save(noteId, scene, token) {
    await savePage(token ?? uid(), noteId, toStored(scene))
  },
}

// A guest's writing lives in this browser. It saves 1 s after you stop.
const guestStorage: NoteStorage = {
  delayMs: 1000,
  async load(noteId) {
    return { scene: await loadGuestScene(noteId) }
  },
  save: (noteId, scene) => saveGuestScene(noteId, scene),
}

export const useCloudNote = (userId: string | null, noteId: string | null) =>
  useNoteStore(cloudStorage, userId !== null, noteId)

export const useGuestNote = (enabled: boolean, noteId: string | null) =>
  useNoteStore(guestStorage, enabled, noteId)

export { deleteGuestScene }
