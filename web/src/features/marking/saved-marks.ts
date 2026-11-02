import { parseMarkingResult, type MarkingResult } from "@shared/index.ts"

// A marked question, as kept with its note. The picture is the one that was sent for
// marking, because the line boxes in the result belong to it.
export type SavedMark = {
  result: MarkingResult
  imageUrl: string
  // How many pieces of writing were below the question when it was marked. If it is
  // different now, the writing changed after the marking.
  strokes: number
  at: string
}
export type SavedMarks = Record<string, SavedMark>

const DATA_PNG = "data:image/png;base64,"
// A marking picture is a few hundred KB. Anything far bigger is not one of ours.
const MAX_IMAGE_CHARS = 4_000_000

// Only real marking is kept. The demo's example picture is not a data URL.
export const isKeepable = (m: { imageUrl: string }) =>
  m.imageUrl.startsWith(DATA_PNG)

// Stored data is untrusted. Keep only entries that are well formed.
export function readMarks(raw: unknown): SavedMarks {
  const out: SavedMarks = {}
  if (typeof raw !== "object" || raw === null) return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const m = v as Partial<SavedMark> | null
    if (!m || typeof m !== "object") continue
    if (
      typeof m.imageUrl !== "string" ||
      !m.imageUrl.startsWith(DATA_PNG) ||
      m.imageUrl.length > MAX_IMAGE_CHARS
    )
      continue
    if (typeof m.strokes !== "number" || typeof m.at !== "string") continue
    const parsed = parseMarkingResult(m.result)
    if (!parsed.ok) continue
    out[id] = {
      result: parsed.result,
      imageUrl: m.imageUrl,
      strokes: m.strokes,
      at: m.at,
    }
  }
  return out
}

// Changes when a mark is added, redone or removed. Used to tell if a save is needed.
export const marksSignature = (marks: SavedMarks | undefined) =>
  Object.keys(marks ?? {})
    .sort()
    .map((k) => `${k}:${marks![k].at}`)
    .join(",")
