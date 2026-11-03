// The student's own correct answer for a question. It is sent with the marking request,
// and then the AI compares the lines to it instead of solving the question itself.
export type Reference =
  | { kind: "text"; text: string; rev: string }
  | {
      kind: "image"
      mimeType: "image/png" | "image/jpeg" | "image/webp"
      base64: string
      rev: string
    }
export type References = Record<string, Reference>

export const MAX_TEXT = 5000
// The service refuses requests over 8 MB in all, and the question and the writing are
// sent too. So a reference picture is kept well below that.
const MAX_BASE64 = 2_500_000
const MAX_SIDE = 1600

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]

// Stored data is untrusted. Keep only entries that are well formed.
export function readReferences(raw: unknown): References {
  const out: References = {}
  if (typeof raw !== "object" || raw === null) return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = v as Partial<Record<string, unknown>> | null
    if (!r || typeof r !== "object" || typeof r.rev !== "string") continue
    if (
      r.kind === "text" &&
      typeof r.text === "string" &&
      r.text.trim() &&
      r.text.length <= MAX_TEXT
    )
      out[id] = { kind: "text", text: r.text, rev: r.rev }
    else if (
      r.kind === "image" &&
      typeof r.base64 === "string" &&
      r.base64.length <= MAX_BASE64 &&
      typeof r.mimeType === "string" &&
      IMAGE_TYPES.includes(r.mimeType)
    )
      out[id] = {
        kind: "image",
        mimeType: r.mimeType as "image/png",
        base64: r.base64,
        rev: r.rev,
      }
  }
  return out
}

// Changes when a reference is added, edited or removed. It uses "rev" (a new value on
// every edit), so nothing has to read a big picture on every canvas change.
export const referencesSignature = (refs: References | undefined) =>
  Object.keys(refs ?? {})
    .sort()
    .map((k) => `${k}:${refs![k].rev}`)
    .join(",")

// A picture from a file or the clipboard, made smaller and turned into a reference.
// A photo of a solution is usually big, so it is scaled down to 1600 px and saved as JPEG.
export async function imageToReference(
  file: Blob,
  rev: string
): Promise<Reference> {
  if (!file.type.startsWith("image/")) throw new Error("That is not a picture.")
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not read the picture.")
  ctx.fillStyle = "#ffffff" // a transparent picture must not turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const url = canvas.toDataURL("image/jpeg", 0.85)
  const base64 = url.slice(url.indexOf(",") + 1)
  if (base64.length > MAX_BASE64)
    throw new Error("That picture is too big even after shrinking it.")
  return { kind: "image", mimeType: "image/jpeg", base64, rev }
}

export const referenceImageUrl = (r: Extract<Reference, { kind: "image" }>) =>
  `data:${r.mimeType};base64,${r.base64}`
