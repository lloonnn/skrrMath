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
