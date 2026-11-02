import { markingLabel, type MarkingResult } from "./marking.ts"

// Turns a marking result into the margin notes the page shows.
// Plain data, so the wording is tested once and the UI only draws it.

export type MarginNote = {
  kind: "error" | "follows" | "skipped" | "unreadable"
  lines: number[]
  text: string
}

export type MarginView = {
  // "tick" only when marked, no error, and the final answer matches or is unknown
  mark: "tick" | "cross" | "none"
  label: string
  headline: string
  // A second, quieter sentence under the headline. null when there is nothing to add.
  detail: string | null
  // The reference answer, shown when the student's answer does not match it.
  // For an AI-solved reference, "AI worked out" is the honest wording.
  answer: { latex: string; by: "verified" | "ai" } | null
  notes: MarginNote[]
  summary: string
}

// Consecutive numbers 3,4,5 become one note.
function runs(ns: number[]): number[][] {
  const out: number[][] = []
  for (const n of ns) {
    const last = out[out.length - 1]
    if (last && last[last.length - 1] === n - 1) last.push(n)
    else out.push([n])
  }
  return out
}

const range = (r: number[]) => (r.length === 1 ? `line ${r[0]}` : `lines ${r[0]} to ${r[r.length - 1]}`)

export function marginView(r: MarkingResult): MarginView {
  const notes: MarginNote[] = []
  const first = r.lines.find((l) => l.n === r.first_error_line)
  if (first)
    notes.push({
      kind: "error",
      lines: [first.n],
      text: first.comment || "This line does not follow from the one before.",
    })
  for (const run of runs(r.lines.filter((l) => l.verdict === "follows_from_error").map((l) => l.n)))
    notes.push({ kind: "follows", lines: run, text: `${range(run)} ${run.length === 1 ? "carries" : "carry"} the mistake` })
  for (const l of r.lines.filter((l) => l.verdict === "skipped_step"))
    notes.push({ kind: "skipped", lines: [l.n], text: l.comment || `line ${l.n}: a step may be skipped` })
  for (const l of r.lines.filter((l) => l.verdict === "unreadable"))
    notes.push({ kind: "unreadable", lines: [l.n], text: `Can't read line ${l.n}, please check.` })

  let headline: string
  let detail: string | null = null
  if (r.status === "unreadable") headline = "Can't read this answer well enough to mark it."
  else if (r.status === "unsure") headline = "Not sure about the final answer. The reference is not reliable."
  else if (r.first_error_line !== null) {
    const after = r.lines.some((l) => l.verdict === "follows_from_error")
    headline = `Mistake on line ${r.first_error_line}.`
    if (after) detail = "The lines after it carry this mistake into the answer."
  }
  else if (r.final_answer.matches_reference === "no") headline = "The working looks fine but the final answer does not match."
  else headline = "No error found."

  const mark =
    r.status === "unreadable" ? "none" : r.first_error_line !== null || r.final_answer.matches_reference === "no" ? "cross" : r.status === "marked" ? "tick" : "none"

  const ref = r.final_answer.reference_latex
  const answer =
    r.status === "marked" && ref && r.final_answer.matches_reference !== "yes"
      ? { latex: ref, by: r.reference_source === "ai_solved" ? ("ai" as const) : ("verified" as const) }
      : null

  return { mark, answer, label: markingLabel(r), headline, detail, notes, summary: r.summary }
}

export type LineMark = {
  n: number
  // [ymin, xmin, ymax, xmax] on a 0 to 1000 scale, on the answer image
  box: [number, number, number, number]
  kind: "tick" | "error" | "follows" | "skipped" | "unreadable"
  text: string
}

// Marks to draw beside each line. Returns null when any line has no box, so the
// caller falls back to marginView. A tick sits only on the last line of a run of
// good lines, so the margin is not full of ticks.
export function lineMarks(r: MarkingResult): LineMark[] | null {
  if (r.status === "unreadable" || r.lines.length === 0) return null
  if (r.lines.some((l) => l.box === null)) return null
  const out: LineMark[] = []
  r.lines.forEach((l, i) => {
    const box = l.box!
    const nextOk = r.lines[i + 1]?.verdict === "ok"
    if (l.verdict === "ok" && !nextOk) out.push({ n: l.n, box, kind: "tick", text: "" })
    else if (l.verdict === "error") out.push({ n: l.n, box, kind: "error", text: l.comment || "does not follow" })
    else if (l.verdict === "follows_from_error") out.push({ n: l.n, box, kind: "follows", text: "carried over" })
    else if (l.verdict === "skipped_step") out.push({ n: l.n, box, kind: "skipped", text: l.comment || "a step may be skipped" })
    else if (l.verdict === "unreadable") out.push({ n: l.n, box, kind: "unreadable", text: "can't read this line, please check" })
  })
  return out
}
