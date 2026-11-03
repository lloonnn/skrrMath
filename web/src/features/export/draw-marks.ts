import { lineMarks, type MarkingResult } from "@shared/index.ts"
import { font, wrapText } from "@/features/export/page-canvas"

const RED = "#b91c1c"

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = url
  await img.decode()
  return img
}

// The student's answer picture with the red marks drawn on it, in the same places as in
// the app: just to the right of each line. If the result has no line positions, only
// the picture is returned (the notes are printed under it instead).
export async function markedPicture(
  url: string,
  result: MarkingResult | null,
  label: string
): Promise<HTMLCanvasElement> {
  const img = await loadImage(url)
  // A small picture is enlarged a little, so that the red notes are readable on paper.
  const scale = img.width < 1000 ? 1000 / img.width : 1
  const W = Math.round(img.width * scale)
  const H = Math.round(img.height * scale)
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(img, 0, 0, W, H)

  const marks = result ? lineMarks(result) : null
  if (marks) {
    const size = Math.max(16, Math.round(W * 0.026))
    for (const m of marks) {
      const yMid = ((m.box[0] + m.box[2]) / 2000) * H
      const x = (m.box[3] / 1000) * W + W * 0.01
      const avail = Math.max(W - x - W * 0.01, size * 5)
      const left = Math.min(x, W - avail - W * 0.01)
      const bold = m.kind === "error"
      ctx.font = font(size, bold, m.kind === "follows")
      ctx.fillStyle = RED
      ctx.globalAlpha =
        m.kind === "follows" ? 0.75 : m.kind === "skipped" ? 0.55 : 1
      ctx.textBaseline = "top"
      const text =
        m.kind === "tick"
          ? "✓"
          : m.kind === "error"
            ? `✗ ${m.text}`
            : m.kind === "follows"
              ? "↳ carried over"
              : m.text
      const lines = wrapText(ctx, text, avail).slice(0, 4)
      const lineH = Math.round(size * 1.15)
      let y = yMid - (lines.length * lineH) / 2
      for (const line of lines) {
        ctx.fillText(line, left, y)
        y += lineH
      }
      ctx.globalAlpha = 1
    }
  }
  if (label) {
    ctx.font = font(Math.max(14, Math.round(W * 0.02)))
    ctx.fillStyle = "#666666"
    ctx.textBaseline = "alphabetic"
    ctx.fillText(
      label,
      W - ctx.measureText(label).width - W * 0.015,
      H - H * 0.008
    )
  }
  return c
}
