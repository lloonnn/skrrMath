import { Jimp } from "jimp"
import type { Image } from "../types.ts"
import type { Box } from "./rules.ts"

// More lines than this is probably a bad locate result, and would make a huge request.
export const MAX_CROPS = 40
const MIN_SIDE_PX = 8
// Thin handwriting in a small crop is scaled up so it stays readable.
const MIN_WIDTH_PX = 60

// Cuts one small picture for each located line, so a line can be read on its own,
// without the lines around it. Boxes are [ymin, xmin, ymax, xmax] on a 0 to 1000 scale.
// Returns null when it cannot (bad picture, no boxes, too many, a box that is tiny):
// the caller then reads the whole page instead.
export async function cropLines(image: Image, boxes: Box[]): Promise<Image[] | null> {
  if (boxes.length === 0 || boxes.length > MAX_CROPS) return null
  try {
    const src = await Jimp.read(Buffer.from(image.base64, "base64"))
    const W = src.width
    const H = src.height
    const out: Image[] = []
    for (const [y0, x0, y1, x1] of boxes) {
      const x = Math.floor((x0 * W) / 1000)
      const y = Math.floor((y0 * H) / 1000)
      const w = Math.min(Math.ceil(((x1 - x0) * W) / 1000), W - x)
      const h = Math.min(Math.ceil(((y1 - y0) * H) / 1000), H - y)
      if (w < MIN_SIDE_PX || h < MIN_SIDE_PX) return null
      const piece = src.clone().crop({ x, y, w, h })
      if (piece.width < MIN_WIDTH_PX) piece.resize({ w: piece.width * 2 })
      const png = await piece.getBuffer("image/png")
      out.push({ mimeType: "image/png", base64: png.toString("base64") })
    }
    return out
  } catch {
    return null
  }
}
