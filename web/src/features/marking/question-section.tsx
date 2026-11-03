import {
  lineMarks,
  marginView,
  type ActivePaper,
  type SceneBlock,
} from "@shared/index.ts"
import * as React from "react"

import {
  MARK_MODE,
  MARK_NEEDS_SIGN_IN,
  type Marked,
} from "@/features/marking/mark-service"
import { Latex } from "@/features/marking/latex"
import type { Reference } from "@/features/marking/reference"
import { ReferenceEditor } from "@/features/marking/reference-editor"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export type MarkState =
  | { phase: "idle" }
  | { phase: "working"; since: number; step?: string }
  | ({ phase: "done"; strokes: number; at: string; refRev?: string } & Marked)
  | { phase: "failed"; message: string }

// Counts the seconds since marking started.
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return <>{Math.max(0, Math.round((now - since) / 1000))} s</>
}

// Can this question be marked now? Used by its own button and by Mark all.
export function canMark(
  block: SceneBlock,
  paper: ActivePaper | null,
  signedIn: boolean
): boolean {
  return (
    paper !== null &&
    !(MARK_NEEDS_SIGN_IN && !signedIn) &&
    !block.region.overlaps &&
    // Real marking needs something to read. The demo does not.
    (MARK_MODE === "demo" || block.strokes > 0)
  )
}

// One pasted question: its Mark button and the marks. The marking state lives in
// the panel, so that Mark all can start every question.
export function QuestionSection({
  block,
  paper,
  signedIn,
  state,
  onMark,
  reference,
  onReference,
}: {
  block: SceneBlock
  paper: ActivePaper | null
  signedIn: boolean
  state: MarkState
  onMark: () => void
  reference: Reference | undefined
  onReference: (r: Reference | undefined) => void
}) {
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
          onClick={onMark}
          disabled={
            !canMark(block, paper, signedIn) || state.phase === "working"
          }
        >
          {state.phase === "working" ? "Marking..." : "Mark"}
        </Button>
      </div>

      {MARK_MODE === "service" &&
        paper &&
        block.strokes === 0 &&
        !block.region.overlaps && (
          <p className="text-xs text-muted-foreground">
            Write your answer below the question image first.
          </p>
        )}

      {needsSignIn && (
        <p className="text-xs text-muted-foreground">
          Sign in (bottom of the left list) to mark.
        </p>
      )}

      {MARK_MODE === "service" && (
        <ReferenceEditor reference={reference} onChange={onReference} />
      )}

      {state.phase === "working" && (
        <p className="text-xs text-muted-foreground" role="status">
          {state.step ?? "Starting..."} <Elapsed since={state.since} />
        </p>
      )}

      {state.phase === "failed" && (
        <p className="text-red-700">{state.message}</p>
      )}

      {state.phase === "done" &&
        MARK_MODE === "service" &&
        state.strokes !== block.strokes && (
          <p className="text-xs text-muted-foreground">
            You changed your writing after this was marked. Press Mark to mark
            it again.
          </p>
        )}

      {state.phase === "done" &&
        MARK_MODE === "service" &&
        (state.refRev ?? "") !== (reference?.rev ?? "") && (
          <p className="text-xs text-muted-foreground">
            Your correct answer changed after this was marked. Press Mark to
            mark it again.
          </p>
        )}

      {state.phase === "done" && result && view && (
        <>
          <div className="relative border">
            <img
              src={state.imageUrl}
              alt="The marked page"
              className="w-full"
            />
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
