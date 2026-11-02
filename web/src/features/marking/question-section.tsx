import * as React from "react"

import {
  lineMarks,
  marginView,
  type ActivePaper,
  type MarkingResult,
  type SceneBlock,
} from "@shared/index.ts"
import {
  MARK_NEEDS_SIGN_IN,
  demoPageImage,
  markDemo,
} from "@/features/marking/demo-marking"
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

// One pasted question: its tags, a Mark button, and the marks.
export function QuestionSection({
  block,
  paper,
  signedIn,
}: {
  block: SceneBlock
  paper: ActivePaper | null
  signedIn: boolean
}) {
  const [state, setState] = React.useState<State>({ phase: "idle" })

  async function mark() {
    setState({ phase: "working" })
    try {
      setState({ phase: "done", result: await markDemo() })
    } catch {
      setState({ phase: "failed" })
    }
  }

  const needsSignIn = MARK_NEEDS_SIGN_IN && !signedIn
  const result = state.phase === "done" ? state.result : null
  const view = result ? marginView(result) : null
  const marks = result ? lineMarks(result) : null

  return (
    <section className="flex flex-col gap-3 border-b pb-6">
      <div>
        <h2 className="font-medium">Question {block.number}</h2>
        <p className="text-xs text-muted-foreground">
          {paper
            ? `${paper.code} · ${paper.year}`
            : "Open a note in the left list first."}
        </p>
      </div>
      {block.region.overlaps && (
        <p className="text-xs text-red-700">
          Another question image sits on top of this one. Move it down.
        </p>
      )}

      <div>
        <Button
          size="sm"
          onClick={mark}
          disabled={
            !paper ||
            needsSignIn ||
            state.phase === "working" ||
            block.region.overlaps
          }
        >
          {state.phase === "working" ? "Marking..." : "Mark"}
        </Button>
      </div>

      {needsSignIn && (
        <p className="text-xs text-muted-foreground">
          Sign in (bottom of the left list) to mark.
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
            {marks?.map((m) => (
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

            <div className="border-t pt-3 text-xs text-muted-foreground">
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
    </section>
  )
}
