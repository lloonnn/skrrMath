import type { Image } from "../types.ts"

export type ModelCall = {
  system: string
  prompt: string
  images: Image[]
  // Transcription only copies, so it can think less. Solve and mark think more.
  thinking: "low" | "high"
}

// A model returns text. The pipeline parses and validates it. Never trust it.
export type ModelClient = { generate(call: ModelCall): Promise<string> }

// The model could not be used at all: quota, bad key, or unknown model.
// This is not an unreadable answer, so it must not be reported as one.
export class ModelUnavailableError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
