import { Excalidraw } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"

// The note canvas. Strokes stay in Excalidraw's own scene for now.
// Saving and loading is not built yet (see docs/STATUS.md).
export function NoteCanvas() {
  return (
    <div className="h-full w-full">
      <Excalidraw theme="light" />
    </div>
  )
}
