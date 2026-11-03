// The label of each question ("23a"), by question id. Typed once, saved with the note.
// It is what the lecturer-solution lookup uses (docs/LECTURER-PLAN.md). Marking works without it.
export type Labels = Record<string, string>

export const MAX_LABEL = 20

// Stored data is untrusted. Keep only short strings.
export function readLabels(raw: unknown): Labels {
  const out: Labels = {}
  if (typeof raw !== "object" || raw === null) return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim() !== "" && v.length <= MAX_LABEL)
      out[id] = v
  }
  return out
}

// Changes when a label is added, edited or removed.
export const labelsSignature = (labels: Labels | undefined) =>
  Object.keys(labels ?? {})
    .sort()
    .map((k) => `${k}=${labels![k]}`)
    .join(",")
