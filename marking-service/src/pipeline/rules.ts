import {
  parseMarkingResult,
  type MarkingResult,
  type LineVerdict,
} from "../../../shared/src/index.ts"

// Rules in code, not only in the prompt. The model's output is a suggestion.

export type TranscribedLine = { n: number; latex: string; readable: boolean }
export type Transcription = { question_restated: string; lines: TranscribedLine[] }
export type MarkOutput = {
  lines: { n: number; verdict: LineVerdict; comment: string; correct_latex: string | null }[]
  error_type: "sign" | "algebra" | "missing_condition" | "notation" | "other" | null
  final_answer: { matches_reference: "yes" | "no" | "unknown"; student_latex: string; reference_latex: string | null }
  method_ok: boolean | null
  summary: string
}
export type Context = {
  referenceSource: MarkingResult["reference_source"]
  // null when a verified answer was used, or fewer than two solves ran
  solveRunsAgree: boolean | null
  model: string
}

export const UNREADABLE_COMMENT = "Can't read this line, please check."

// Crude comparison of two final answers. A false "differ" makes the result
// "unsure", which is the safe direction. A false "same" is possible for
// answers that only look alike. Unchecked on real model output.
export function normaliseLatex(s: string): string {
  return s
    .replace(/\\left|\\right|\\,|\;|\\!|\$/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
}

export function solvesAgree(answers: string[]): boolean | null {
  if (answers.length < 2) return null
  const first = normaliseLatex(answers[0])
  return answers.every((a) => normaliseLatex(a) === first)
}

export function unreadableResult(model: string, question = "", why = "Could not read this answer."): MarkingResult {
  return {
    status: "unreadable",
    question_restated: question,
    lines: [],
    first_error_line: null,
    error_type: null,
    final_answer: { matches_reference: "unknown", student_latex: "", reference_latex: null },
    method_ok: null,
    reference_source: "ai_solved",
    solve_runs_agree: null,
    summary: why,
    model,
  }
}

export function assemble(t: Transcription, m: MarkOutput, ctx: Context): MarkingResult {
  const byN = new Map(m.lines.map((l) => [l.n, l]))

  // 1. Lines. Text always comes from the transcription, never from the mark step.
  let firstError: number | null = null
  const lines = t.lines.map((tl) => {
    const ml = byN.get(tl.n)
    const unreadable = !tl.readable || ml?.verdict === "unreadable"
    if (unreadable)
      return { n: tl.n, latex: tl.latex, readable: false, verdict: "unreadable" as const, comment: UNREADABLE_COMMENT, correct_latex: null }
    let verdict: LineVerdict = ml?.verdict ?? "not_checked"
    if (verdict === "error") {
      if (firstError === null) firstError = tl.n
      else verdict = "follows_from_error" // keep the first error only
    }
    if (verdict === "follows_from_error" && firstError === null) verdict = "not_checked"
    return {
      n: tl.n,
      latex: tl.latex,
      readable: true,
      verdict,
      comment: ml?.comment ?? "",
      correct_latex: verdict === "error" ? (ml?.correct_latex ?? null) : null,
    }
  })

  // 2. Status.
  const anyReadable = lines.some((l) => l.readable)
  const disagree = ctx.solveRunsAgree === false
  const status = !anyReadable ? "unreadable" : disagree ? "unsure" : "marked"

  // 3. Final answer is judged only when marked.
  const judged = status === "marked"
  const final_answer = {
    matches_reference: judged ? m.final_answer.matches_reference : ("unknown" as const),
    student_latex: m.final_answer.student_latex,
    reference_latex: judged ? m.final_answer.reference_latex : null,
  }

  const hasError = status !== "unreadable" && firstError !== null
  const candidate: MarkingResult = {
    status,
    question_restated: t.question_restated,
    lines: status === "unreadable" ? lines.map((l) => (l.verdict === "ok" || l.verdict === "error" ? { ...l, verdict: "not_checked" as const } : l)) : lines,
    first_error_line: hasError ? firstError : null,
    error_type: hasError ? (m.error_type ?? "other") : null,
    final_answer,
    method_ok: status === "unreadable" ? null : m.method_ok,
    reference_source: ctx.referenceSource,
    solve_runs_agree: ctx.referenceSource === "ai_solved" ? ctx.solveRunsAgree : null,
    summary: m.summary,
    model: ctx.model,
  }
  if (!hasError) {
    candidate.lines = candidate.lines.map((l) =>
      l.verdict === "follows_from_error" ? { ...l, verdict: "not_checked" as const } : l
    )
  }

  // 4. Never return what the shared schema rejects.
  const checked = parseMarkingResult(candidate)
  if (!checked.ok) return unreadableResult(ctx.model, t.question_restated)
  return checked.result
}
