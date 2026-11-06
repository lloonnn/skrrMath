import { z } from "zod"
import type { MarkingResult } from "../../shared/src/index.ts"

const image = z.strictObject({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1),
})
export type Image = z.infer<typeof image>

export const markRequestSchema = z.strictObject({
  blockImage: image,
  answerImage: image,
  verifiedAnswer: z
    .discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("text"), text: z.string().min(1).max(30000), book: z.literal(true).optional() }),
      z.strictObject({ kind: z.literal("image"), image, book: z.literal(true).optional() }),
    ])
    .optional(),
  tags: z.strictObject({
    course: z.string().max(40),
    year: z.number().int().optional(),
    question: z.string().max(20),
  }),
})
export type MarkRequest = z.infer<typeof markRequestSchema>

// What the pipeline is doing now. Sent to the app so it can show progress.
export type ProgressStep = {
  step: "reading" | "locating" | "solving" | "comparing" | "marking"
  // For solving: which run, out of how many
  n?: number
  of?: number
}

// One thing that can mark. The demo engine and the model engine both fit.
export type Engine = {
  mark(req: MarkRequest, onStep?: (s: ProgressStep) => void): Promise<MarkingResult>
}
