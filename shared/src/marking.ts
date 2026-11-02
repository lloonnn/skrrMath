import { z } from "zod"

// The marking result from docs/MARKING.md. Define it here once.
// The AI output is untrusted. Parse it with parseMarkingResult before use.

export const statusValues = ["marked", "unsure", "unreadable"] as const
export const verdictValues = [
  "ok",
  "error",
  "follows_from_error",
  "skipped_step",
  "unreadable",
  "not_checked",
] as const
export const errorTypeValues = [
  "sign",
  "algebra",
  "missing_condition",
  "notation",
  "other",
] as const
export const referenceSourceValues = [
  "verified_bank",
  "verified_user",
  "ai_solved",
] as const

const lineSchema = z.strictObject({
  n: z.number().int().positive(),
  latex: z.string(),
  readable: z.boolean(),
  verdict: z.enum(verdictValues),
  comment: z.string(),
  correct_latex: z.string().nullable(),
})

const finalAnswerSchema = z.strictObject({
  matches_reference: z.enum(["yes", "no", "unknown"]),
  student_latex: z.string(),
  reference_latex: z.string().nullable(),
})

const baseSchema = z.strictObject({
  status: z.enum(statusValues),
  question_restated: z.string(),
  lines: z.array(lineSchema),
  first_error_line: z.number().int().positive().nullable(),
  error_type: z.enum(errorTypeValues).nullable(),
  final_answer: finalAnswerSchema,
  method_ok: z.boolean().nullable(),
  reference_source: z.enum(referenceSourceValues),
  solve_runs_agree: z.boolean().nullable(),
  summary: z.string(),
  model: z.string(),
})

// Rules that a plain shape cannot say. Each one follows docs/MARKING.md.
// "No error after the first" is this project's reading of "mark the first
// error, then mark later lines as follows from the error".
export const markingResultSchema = baseSchema.superRefine((r, ctx) => {
  const bad = (message: string) =>
    ctx.addIssue({ code: "custom", message, path: [] })

  r.lines.forEach((line, i) => {
    if (line.n !== i + 1) bad(`line numbers must run 1, 2, 3 (got ${line.n} at index ${i})`)
    if (line.readable === (line.verdict === "unreadable"))
      bad(`line ${line.n}: a line is unreadable exactly when its verdict is unreadable`)
  })

  const errors = r.lines.filter((l) => l.verdict === "error")
  if (r.first_error_line === null) {
    if (errors.length > 0) bad("an error line exists but first_error_line is null")
    if (r.lines.some((l) => l.verdict === "follows_from_error"))
      bad("follows_from_error needs a first_error_line")
    if (r.error_type !== null) bad("error_type must be null when there is no error")
  } else {
    if (r.status === "unreadable") bad("an unreadable result cannot name an error")
    if (r.error_type === null) bad("error_type is required when there is an error")
    if (errors.length !== 1 || errors[0].n !== r.first_error_line)
      bad("exactly one line has the error verdict, and it is first_error_line")
    if (r.lines.some((l) => l.verdict === "follows_from_error" && l.n < r.first_error_line!))
      bad("follows_from_error cannot come before the first error")
  }

  if (r.status === "unreadable") {
    if (r.lines.some((l) => l.verdict === "ok" || l.verdict === "error"))
      bad("an unreadable result cannot judge lines")
  }

  if (r.solve_runs_agree === false) {
    if (r.reference_source !== "ai_solved")
      bad("solve_runs_agree applies only to ai_solved")
    if (r.status === "marked") bad("disagreeing solutions mean status unsure")
    if (r.final_answer.matches_reference !== "unknown")
      bad("do not judge the final answer when the solutions disagree")
  }
  if (r.reference_source !== "ai_solved" && r.solve_runs_agree !== null)
    bad("solve_runs_agree must be null when a verified answer is used")

  if (r.status !== "marked") {
    if (r.final_answer.matches_reference !== "unknown")
      bad("only a marked result can judge the final answer")
  }
})

export type MarkingResult = z.infer<typeof markingResultSchema>
export type LineVerdict = (typeof verdictValues)[number]

export type ParseOutcome =
  | { ok: true; result: MarkingResult }
  | { ok: false; errors: string[] }

export function parseMarkingResult(input: unknown): ParseOutcome {
  const parsed = markingResultSchema.safeParse(input)
  if (parsed.success) return { ok: true, result: parsed.data }
  return {
    ok: false,
    errors: parsed.error.issues.map(
      (i) => `${i.path.join(".") || "(result)"}: ${i.message}`
    ),
  }
}

// The label shown under the block. Derived from reference_source only,
// so a result cannot claim to be verified when it was not.
// The bank trust level (stage two) is not modelled yet.
export function markingLabel(r: Pick<MarkingResult, "reference_source">): string {
  switch (r.reference_source) {
    case "ai_solved":
      return "Not verified"
    case "verified_user":
      return "Checked against your answer"
    case "verified_bank":
      return "Checked against a bank answer"
  }
}
