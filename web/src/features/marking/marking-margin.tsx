import * as React from "react"

import type { ActivePaper, SceneBlock } from "@shared/index.ts"
import { QuestionSection } from "@/features/marking/question-section"

// The marking panel beside the note. One section per pasted question image.
// Closed means hidden, not removed, so the marks come back as they were.
const MIN_WIDTH = 280
const MAX_WIDTH = 760
const DEFAULT_WIDTH = 360

export function MarkingMargin({
  open,
  blocks,
  paper,
  signedIn,
}: {
  open: boolean
  blocks: SceneBlock[]
  paper: ActivePaper | null
  signedIn: boolean
}) {
  const [width, setWidth] = React.useState(DEFAULT_WIDTH)

  // Drag the left edge. Pointer events, so a finger or a pen works too.
  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    const startX = e.clientX
    const startWidth = width
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) =>
      setWidth(
        Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + startX - ev.clientX)
        )
      )
    const stop = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", stop)
      el.removeEventListener("pointercancel", stop)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", stop)
    el.addEventListener("pointercancel", stop)
  }

  return (
    <div
      style={{ width }}
      className={"relative shrink-0 " + (open ? "flex" : "hidden")}
    >
      {/* Wide, so a finger can grab it. It sits over the panel's left edge. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the marking panel"
        title="Drag to resize"
        onPointerDown={startDrag}
        className="group absolute inset-y-0 -left-3 z-10 flex w-6 cursor-col-resize touch-none justify-center"
      >
        <div className="h-full w-px bg-border group-hover:w-0.5 group-active:w-0.5" />
      </div>
      <aside className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto border-l bg-background p-4 text-sm">
        {blocks.length === 0 && (
          <p className="text-muted-foreground">
            Paste a cropped question image onto the canvas (Ctrl+V). It shows up
            here. Then write your answer below it.
          </p>
        )}
        {blocks.map((b) => (
          <QuestionSection
            key={b.id}
            block={b}
            paper={paper}
            signedIn={signedIn}
          />
        ))}
        {blocks.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Demo: Mark shows a saved example page, not your writing. Nothing is
            sent to an AI.
          </p>
        )}
      </aside>
    </div>
  )
}
