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
      z.strictObject({ kind: z.literal("text"), text: z.string().min(1).max(5000) }),
      z.strictObject({ kind: z.literal("image"), image }),
    ])
    .optional(),
  tags: z.strictObject({
    course: z.string().max(40),
    year: z.number().int().optional(),
    question: z.string().max(20),
  }),
})
export type MarkRequest = z.infer<typeof markRequestSchema>

// One thing that can mark. The demo engine and the model engine both fit.
export type Engine = { mark(req: MarkRequest): Promise<MarkingResult> }
