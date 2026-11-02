import * as React from "react"

import { lineMarks, marginView, type MarkingResult } from "@shared/index.ts"
import { demoPageImage, markDemo } from "@/features/marking/demo-marking"
import { Latex } from "@/features/marking/latex"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type State =
  | { phase: "idle" }
  | { phase: "working" }
  | { phase: "done"; result: MarkingResult }
  | { phase: "failed" }

// The marking panel beside the note. Red pen marks sit on top of the page.
export function MarkingMargin({ open }: { open: boolean }) {
  const [state, setState] = React.useState<State>({ phase: "idle" })

  async function mark() {
    setState({ phase: "working" })
    try {
      setState({ phase: "done", result: await markDemo() })
    } catch {
      setState({ phase: "failed" })
    }
  }

  const result = state.phase === "done" ? state.result : null
  const view = result ? marginView(result) : null
  const marks = result ? lineMarks(result) : null

  return (
    // Closed: hidden, not removed, so the marks come back as they were.
    <aside
      className={
        "w-[30rem] shrink-0 flex-col gap-3 overflow-y-auto border-l bg-background p-4 text-sm " +
        (open ? "flex" : "hidden")
      }
    >
      <div>
        <Button size="sm" onClick={mark} disabled={state.phase === "working"}>
          {state.phase === "working" ? "Marking..." : "Mark"}
        </Button>
      </div>

      {state.phase === "idle" && (
        <p className="text-muted-foreground">
          Demo: marks a saved example page (a made-up reading of your page 2),
          not your drawing. Nothing is sent to an AI.
        </p>
      )}
      {state.phase === "failed" && (
        <p className="text-red-700">Marking failed. Nothing was changed.</p>
      )}

      {result && view && (
        <>
          <div className="relative border">
            <img src={demoPageImage} alt="The marked page" className="w-full" />
            <p className="absolute right-2 bottom-1 text-xs text-muted-foreground">
              {view.label}
            </p>
            {marks &&
              marks.map((m) => (
                <p
                  key={m.n}
                  className={
                    "absolute -translate-y-1/2 text-[11px] leading-tight text-red-700 " +
                    (m.kind === "follows"
                      ? "italic opacity-70"
                      : m.kind === "skipped"
                        ? "opacity-50"
                        : "")
                  }
                  style={{
                    top: `${(m.box[0] + m.box[2]) / 20}%`,
                    left: `${m.box[3] / 10 + 1}%`,
                    right: "1%",
                    zIndex: m.kind === "error" ? 2 : 1,
                  }}
                >
                  {m.kind === "tick"
                    ? "✓"
                    : m.kind === "error"
                      ? `✗ ${m.text}`
                      : m.kind === "follows"
                        ? "↳ carried over"
                        : m.text}
                </p>
              ))}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-red-700">
                {view.mark === "tick"
                  ? "✓ "
                  : view.mark === "cross"
                    ? "✗ "
                    : ""}
                {view.headline}
              </p>
              {view.detail && (
                <p className="text-muted-foreground">{view.detail}</p>
              )}
              {(marks ? [] : view.notes).map((n, i) => (
                <p key={i} className="text-red-700">
                  {n.text}
                </p>
              ))}
            </div>

            {view.answer && (
              <div className="flex flex-col gap-1 border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  {view.answer.by === "ai"
                    ? "Expected answer"
                    : "Correct answer"}
                </p>
                <p className="text-base">
                  <Latex tex={view.answer.latex} />
                </p>
              </div>
            )}

            <p className="border-t pt-3">{view.summary}</p>

            <div className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
              <Collapsible>
                <CollapsibleTrigger className="underline">
                  what it read
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ol className="mt-1 flex flex-col gap-0.5 font-mono text-foreground">
                    {result.lines.map((l) => (
                      <li key={l.n}>
                        {l.n}. {l.readable ? l.latex : "(could not read)"}
                      </li>
                    ))}
                  </ol>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
