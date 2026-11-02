import { exportToBlob } from "@excalidraw/excalidraw"
import { answerElementIds, type SceneBlock } from "@shared/index.ts"
import type { Scene } from "@/features/canvas/note-canvas"

export type PngImage = { mimeType: "image/png"; base64: string }

// The picture sent to the marker is no bigger than needed (docs/MARKING.md).
const MAX_SIDE = 1600

async function toPng(
  elements: Scene["elements"],
  files: Scene["files"]
): Promise<PngImage> {
  const blob = await exportToBlob({
    elements: elements as never,
    files,
    appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
    mimeType: "image/png",
    exportPadding: 24,
    maxWidthOrHeight: MAX_SIDE,
  })
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error("Could not read the picture."))
    r.readAsDataURL(blob)
  })
  return { mimeType: "image/png", base64: url.slice(url.indexOf(",") + 1) }
}

// The pasted question image on its own.
export function renderQuestion(scene: Scene, block: SceneBlock) {
  const el = scene.elements.filter((e) => e.id === block.id && !e.isDeleted)
  if (el.length === 0)
    throw new Error("The question image is gone from the note.")
  return toPng(el, scene.files)
}

// Everything written below the question, down to the next question, as one picture.
export function renderAnswer(scene: Scene, block: SceneBlock) {
  const ids = new Set(answerElementIds(scene.elements, block))
  if (ids.size === 0)
    throw new Error("Write your answer below the question first.")
  return toPng(
    scene.elements.filter((e) => ids.has(e.id)),
    scene.files
  )
}
