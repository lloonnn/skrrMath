import * as React from "react"
import { Excalidraw } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import type { ExcalidrawProps } from "@excalidraw/excalidraw/types"
import type { SavedMarks } from "@/features/marking/saved-marks"
import type { References } from "@/features/marking/reference"
import type { Labels } from "@/features/marking/labels"

import { blocksFromScene, type SceneBlock } from "@shared/index.ts"

type OnChange = NonNullable<ExcalidrawProps["onChange"]>
export type Scene = {
  elements: Parameters<OnChange>[0]
  files: Parameters<OnChange>[2]
  // The marking results of this note's questions, kept and saved with the writing.
  marks?: SavedMarks
  // The student's own correct answer for each question, by question id.
  references?: References
  // The label of each question ("23a"), by question id.
  labels?: Labels
}

// The note canvas for one paper. Strokes stay in Excalidraw's own scene.
// The parent keeps each paper's scene in memory, so switching papers keeps the
// writing. It is lost on refresh until cloud save exists (docs/STATUS.md).
// A pasted image is a question block. The parent gets the list of blocks.
export function NoteCanvas({
  initial,
  onScene,
  onBlocks,
}: {
  initial: Scene | undefined
  onScene: (scene: Scene) => void
  onBlocks: (blocks: SceneBlock[]) => void
}) {
  // onChange fires on every pan and zoom too. Only report block changes.
  const last = React.useRef("")
  return (
    <div className="h-full w-full">
      <Excalidraw
        theme="light"
        initialData={
          initial
            ? { elements: initial.elements, files: initial.files }
            : undefined
        }
        onChange={(elements, _appState, files) => {
          onScene({ elements, files })
          const blocks = blocksFromScene(elements)
          const key = JSON.stringify(
            blocks.map((b) => [b.id, b.number, b.strokes, b.region.overlaps])
          )
          if (key !== last.current) {
            last.current = key
            onBlocks(blocks)
          }
        }}
      />
    </div>
  )
}
