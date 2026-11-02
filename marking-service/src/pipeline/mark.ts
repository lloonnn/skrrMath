import { z } from "zod"
import type { MarkingResult } from "../../../shared/src/index.ts"
import type { ModelCall, ModelClient } from "../providers/types.ts"
import type { Engine, MarkRequest } from "../types.ts"
import { EQUIV_SYSTEM, LOCATE_SYSTEM, MARK_SYSTEM, SOLVE_SYSTEM, TRANSCRIBE_SYSTEM } from "./prompts.ts"
import {
  assemble,
  matchBoxes,
  solvesAgree,
  unreadableResult,
  type MarkOutput,
  type Transcription,
} from "./rules.ts"

const transcriptionSchema = z.object({
  question_restated: z.string(),
  lines: z.array(z.object({ n: z.number().int(), latex: z.string(), readable: z.boolean() })),
})
const solveSchema = z.object({ final_answer_latex: z.string() })
const locateSchema = z.array(z.object({ text: z.string(), box_2d: z.array(z.number()).length(4) }))
const equivSchema = z.object({ equivalent: z.boolean() })
const markSchema = z.object({
  lines: z.array(
    z.object({
      n: z.number().int(),
      verdict: z.enum(["ok", "error", "follows_from_error", "skipped_step", "unreadable", "not_checked"]),
      comment: z.string(),
      correct_latex: z.string().nullable(),
    })
  ),
  error_type: z.enum(["sign", "algebra", "missing_condition", "notation", "other"]).nullable(),
  final_answer: z.object({
    matches_reference: z.enum(["yes", "no", "unknown"]),
    student_latex: z.string(),
    reference_latex: z.string().nullable(),
  }),
  method_ok: z.boolean().nullable(),
  summary: z.string(),
})

// Ask, parse, validate. On bad JSON or a wrong shape: one retry, then null.
async function callJson<T>(client: ModelClient, call: ModelCall, schema: z.ZodType<T>): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = schema.safeParse(JSON.parse(await client.generate(call)))
      if (parsed.success) return parsed.data
    } catch {
      // bad JSON or a failed call: try once more
    }
  }
  return null
}

export type PipelineOptions = { solveRuns: number; model: string }

export function createModelEngine(client: ModelClient, opts: PipelineOptions): Engine {
  return { mark: (req) => markWithModel(client, req, opts) }
}

export async function markWithModel(
  client: ModelClient,
  req: MarkRequest,
  opts: PipelineOptions
): Promise<MarkingResult> {
  const { model } = opts

  // 1. Transcribe literally. Do not mark yet.
  const t = await callJson<Transcription>(
    client,
    {
      system: TRANSCRIBE_SYSTEM,
      prompt: `Question tags: ${req.tags.course} ${req.tags.year ?? ""} Q${req.tags.question}. Copy the student's answer.`,
      images: [req.blockImage, req.answerImage],
      thinking: "low",
    },
    transcriptionSchema
  )
  if (!t || t.lines.length === 0) return unreadableResult(model, t?.question_restated ?? "")

  // 1b. Locate the lines, for position only. A failure here is not fatal:
  // the result then has no boxes and the margin note is used.
  const located = await callJson(
    client,
    { system: LOCATE_SYSTEM, prompt: "Locate each handwritten line.", images: [req.answerImage], thinking: "low" },
    locateSchema
  )
  const boxes = located ? matchBoxes(located, t.lines.length) : null

  // 2. Reference: a verified answer, or solve independently without the student's work.
  let referenceText: string
  let referenceImages = [] as MarkRequest["blockImage"][]
  let agree: boolean | null = null
  let source: MarkingResult["reference_source"]
  if (req.verifiedAnswer) {
    source = "verified_user"
    if (req.verifiedAnswer.kind === "text") referenceText = `Verified answer (text): ${req.verifiedAnswer.text}`
    else {
      referenceText = "Verified answer: see the third image."
      referenceImages = [req.verifiedAnswer.image]
    }
  } else {
    source = "ai_solved"
    const answers: string[] = []
    for (let i = 0; i < opts.solveRuns; i++) {
      const s = await callJson(
        client,
        { system: SOLVE_SYSTEM, prompt: "Solve this question.", images: [req.blockImage], thinking: "high" },
        solveSchema
      )
      if (s) answers.push(s.final_answer_latex)
    }
    if (answers.length === 0) return unreadableResult(model, t.question_restated, "Could not solve the question to check against.")
    agree = answers.length < opts.solveRuns ? false : solvesAgree(answers)
    // Same maths can be written many ways. When the text differs, ask once.
    // If that check fails or is unsure, the answers count as different.
    if (agree === false && answers.length >= 2 && answers.length === opts.solveRuns) {
      const e = await callJson(
        client,
        { system: EQUIV_SYSTEM, prompt: `Answers:\n${answers.join("\n")}`, images: [req.blockImage], thinking: "high" },
        equivSchema
      )
      agree = e?.equivalent === true
    }
    referenceText = `AI solutions (not verified): ${answers.join(" | ")}`
  }

  // 3. Check the lines and mark. The student's lines are passed as copied.
  const m = await callJson<MarkOutput>(
    client,
    {
      system: MARK_SYSTEM,
      prompt: `Question: ${t.question_restated}\nStudent lines (copied, do not change):\n${t.lines
        .map((l) => `${l.n}. ${l.readable ? l.latex : "[unreadable]"}`)
        .join("\n")}\nReference: ${referenceText}`,
      images: [req.blockImage, req.answerImage, ...referenceImages],
      thinking: "high",
    },
    markSchema
  )
  if (!m) return unreadableResult(model, t.question_restated, "Could not mark this answer.")

  return assemble(t, m, { referenceSource: source, solveRunsAgree: agree, model, boxes })
}
