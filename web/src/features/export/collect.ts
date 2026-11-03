import type { SceneBlock } from "@shared/index.ts"
import type { Scene } from "@/features/canvas/note-canvas"
import type { ExportItem } from "@/features/export/pdf-export"
import { MARK_MODE } from "@/features/marking/mark-service"
import type { MarkState } from "@/features/marking/question-section"
import type { References } from "@/features/marking/reference"
import { renderAnswer, renderQuestion } from "@/features/marking/render-images"

const dataUrl = (p: { mimeType: string; base64: string }) =>
  `data:${p.mimeType};base64,${p.base64}`

// Gathers what the PDF needs for each question: the question picture, the writing as it is
// now, and the marking that the panel shows. What you see in the panel is what is exported.
export async function collectItems(
  scene: Scene,
  blocks: SceneBlock[],
  states: Record<string, MarkState>,
  refs: References
): Promise<ExportItem[]> {
  const items: ExportItem[] = []
  for (const block of blocks) {
    let question: string | null = null
    let answerUrl: string | null = null
    try {
      question = dataUrl(await renderQuestion(scene, block))
    } catch {
      /* the question image is gone: shown as a note in the PDF */
    }
    try {
      answerUrl = dataUrl(await renderAnswer(scene, block))
    } catch {
      /* nothing written below it */
    }
    const state = states[block.id]
    items.push({
      number: block.number,
      question,
      answerUrl,
      mark:
        state?.phase === "done"
          ? {
              result: state.result,
              imageUrl: state.imageUrl,
              // These two notices only mean something for real marking.
              writingChanged:
                MARK_MODE === "service" && state.strokes !== block.strokes,
              answerChanged:
                MARK_MODE === "service" &&
                (state.refRev ?? "") !== (refs[block.id]?.rev ?? ""),
            }
          : null,
    })
  }
  return items
}
