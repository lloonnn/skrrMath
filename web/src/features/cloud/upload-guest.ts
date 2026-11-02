import type { PaperTree } from "@shared/index.ts"
import { toStored } from "@/features/canvas/scene-codec"
import {
  deleteGuestScene,
  loadGuestScene,
} from "@/features/canvas/guest-scenes"
import { fetchPage, insertYear, savePage } from "@/features/cloud/cloud"
import { uid } from "@/lib/uid"

export type GuestUpload = {
  uploaded: number
  // The account's note already had writing. The guest copy became a new note.
  copies: { id: string; courseId: string; label: string }[]
  // Could not upload (network or storage). It stays in this browser. Sign in again to retry.
  failed: number
}

// At sign-in: move a guest's writing into the account. Nothing is overwritten and
// nothing is deleted from this browser until it is safely in the account.
export async function uploadGuestWriting(
  yearIdMap: Record<string, string>,
  merged: PaperTree
): Promise<GuestUpload> {
  const out: GuestUpload = { uploaded: 0, copies: [], failed: 0 }
  for (const [localId, cloudId] of Object.entries(yearIdMap)) {
    const scene = await loadGuestScene(localId)
    if (!scene || scene.elements.every((e) => e.isDeleted)) {
      await deleteGuestScene(localId)
      continue
    }
    try {
      if (await fetchPage(cloudId)) {
        // Both have writing. Keep both: the guest copy goes into a new note.
        const course = merged.find((c) => c.years.some((y) => y.id === cloudId))
        const base = course?.years.find((y) => y.id === cloudId)?.year ?? "Note"
        const taken = new Set(course?.years.map((y) => y.year.toLowerCase()))
        let label = `${base} (from this browser)`
        for (let n = 2; taken.has(label.toLowerCase()); n++)
          label = `${base} (from this browser ${n})`
        const id = uid()
        await insertYear(id, course!.id, label)
        await savePage(uid(), id, toStored(scene))
        out.copies.push({ id, courseId: course!.id, label })
      } else {
        await savePage(uid(), cloudId, toStored(scene))
        out.uploaded++
      }
      await deleteGuestScene(localId)
    } catch {
      out.failed++
    }
  }
  return out
}
