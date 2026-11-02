import fixture from "@fixtures/marking/ode-page2-demo.json"
import pageImage from "@fixtures/images/ode-page2-answer.jpeg"
import {
  parseMarkingResult,
  type ActivePaper,
  type MarkingResult,
  type SceneBlock,
} from "@shared/index.ts"
import type { Scene } from "@/features/canvas/note-canvas"
import { renderAnswer, renderQuestion } from "@/features/marking/render-images"
import { supabase } from "@/lib/supabase"

// "demo": a saved example, no AI, no network. "service": the marking service, for real.
export const MARK_MODE = __MARK_MODE__

// Real marking costs money, so it needs a signed-in user (guest mode rule).
// The demo costs nothing and calls no AI, so a guest can use it.
export const MARK_NEEDS_SIGN_IN = MARK_MODE === "service"

// A marked question: the result, and the picture its line boxes belong to.
export type Marked = { result: MarkingResult; imageUrl: string }

// An error with a message that is fine to show the person.
export class MarkError extends Error {}

async function markDemo(): Promise<Marked> {
  await new Promise((r) => setTimeout(r, 600))
  const parsed = parseMarkingResult(fixture)
  if (!parsed.ok) throw new MarkError("The demo example is invalid.")
  return { result: parsed.result, imageUrl: pageImage }
}

// What the service says it is doing, in words for the person.
type Step = { step: string; n?: number; of?: number }
function stepLabel(s: Step): string {
  switch (s.step) {
    case "reading":
      return "Reading your writing..."
    case "locating":
      return "Finding the lines..."
    case "solving":
      return s.of && s.of > 1
        ? `Solving the question (${s.n} of ${s.of})...`
        : "Solving the question..."
    case "comparing":
      return "Comparing the two solutions..."
    case "marking":
      return "Marking line by line..."
    default:
      return "Working..."
  }
}

function messageFor(status: number, fromService: string | undefined): string {
  if (status === 401) return "Your sign-in ran out. Sign out and in again."
  if (status === 413) return "The pictures are too big to send."
  if (status === 429) return "Too many markings. Wait a minute and try again."
  if (status === 502 || status === 503 || status === 504)
    return fromService || "The model is not available. Try again in a minute."
  return fromService || `Marking failed (${status}).`
}

// Reads the service's reply line by line. Each line is one JSON object: a step, then
// the result (or an error). If the service sent one plain JSON body instead, that works too.
async function readReply(
  res: Response,
  onStep?: (label: string) => void
): Promise<unknown> {
  if (!(res.headers.get("content-type") ?? "").includes("ndjson") || !res.body)
    return res.json()
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let result: unknown
  const handle = (line: string) => {
    if (!line.trim()) return
    const msg = JSON.parse(line) as {
      type?: string
      result?: unknown
      status?: number
      error?: string
    } & Step
    if (msg.type === "step") onStep?.(stepLabel(msg))
    else if (msg.type === "result") result = msg.result
    else if (msg.type === "error")
      throw new MarkError(messageFor(msg.status ?? 500, msg.error))
  }
  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    lines.forEach(handle)
    if (done) break
  }
  handle(buffer)
  if (result === undefined)
    throw new MarkError("The marking service stopped before it finished.")
  return result
}

async function markViaService(
  scene: Scene,
  block: SceneBlock,
  paper: ActivePaper,
  onStep?: (label: string) => void
): Promise<Marked> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) throw new MarkError("Sign in to mark.")

  const [question, answer] = await Promise.all([
    renderQuestion(scene, block),
    renderAnswer(scene, block),
  ])

  let res: Response
  try {
    res = await fetch(__MARK_URL__, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        // Ask the service to report each step as it works (see readReply).
        accept: "application/x-ndjson",
      },
      body: JSON.stringify({
        blockImage: question,
        answerImage: answer,
        tags: {
          course: paper.code.slice(0, 40),
          question: String(block.number),
        },
      }),
    })
  } catch {
    throw new MarkError("Could not reach the marking service. Is it running?")
  }
  if (!res.ok) {
    let msg: string | undefined
    try {
      msg = ((await res.json()) as { error?: string }).error
    } catch {
      /* no body */
    }
    throw new MarkError(messageFor(res.status, msg))
  }
  // The service validates its reply. It is checked again here, because this is the
  // last step before it is drawn on your page.
  const parsed = parseMarkingResult(await readReply(res, onStep))
  if (!parsed.ok)
    throw new MarkError("The marking service sent something unexpected.")
  return {
    result: parsed.result,
    imageUrl: `data:image/png;base64,${answer.base64}`,
  }
}

export function markBlock(
  scene: Scene | null,
  block: SceneBlock,
  paper: ActivePaper,
  onStep?: (label: string) => void
): Promise<Marked> {
  if (MARK_MODE === "demo") return markDemo()
  if (!scene) return Promise.reject(new MarkError("Open the note first."))
  return markViaService(scene, block, paper, onStep)
}
