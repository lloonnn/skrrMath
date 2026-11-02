// Question blocks: the answer region and course-code cleanup. Plain functions.
// Coordinates are page units with y growing downward. Same unit for all values.

export type Block = { id: string; page: number; x: number; y: number; width: number; height: number }
export type Page = { page: number; width: number; height: number }
export type Region = {
  blockId: string
  page: number
  x: number
  y: number
  width: number
  height: number
  // The next block starts above this block's bottom edge. The region is empty.
  overlaps: boolean
}

// The answer region is everything below a block, across the full page width,
// up to the top of the next block on the same page, or the end of the page.
// Limit: an answer that continues onto the next page is not followed.
export function answerRegion(block: Block, blocks: Block[], pages: Page[]): Region {
  const page = pages.find((p) => p.page === block.page)
  if (!page) throw new Error(`no page ${block.page}`)
  const bottom = Math.min(block.y + block.height, page.height)
  const nextTops = blocks
    .filter((b) => b.id !== block.id && b.page === block.page && b.y > block.y)
    .map((b) => b.y)
  const end = nextTops.length > 0 ? Math.min(...nextTops) : page.height
  const overlaps = end < bottom
  return {
    blockId: block.id,
    page: block.page,
    x: 0,
    y: bottom,
    width: page.width,
    height: overlaps ? 0 : end - bottom,
    overlaps,
  }
}

// "math201", "Math 201", " MATH-201 " all give MATH201. Returns null for anything odd.
// The pattern (letters, then digits, then an optional letter) is a guess.
// Check it against the school's real course codes.
export function normaliseCourseCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/[\s\-_]+/g, "")
  return /^[A-Z]{1,8}[0-9]{1,5}[A-Z]?$/.test(code) ? code : null
}

// ---- From the canvas to question blocks ----
// A pasted question image on the canvas is a block. The handwriting below it,
// down to the next image, is its answer. Only what is needed from the canvas is
// read, so this does not depend on the drawing library.

export type SceneElement = {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  isDeleted?: boolean
}

export type SceneBlock = {
  id: string
  // 1, 2, 3 from the top of the canvas
  number: number
  region: Region
  // Pen strokes and text whose middle sits inside the answer region
  strokes: number
}

// The canvas has no page edges, so one very tall page is used.
const CANVAS_PAGE: Page = { page: 1, width: 1e9, height: 1e9 }

export function blocksFromScene(elements: readonly SceneElement[]): SceneBlock[] {
  const live = elements.filter((e) => !e.isDeleted)
  const images = live
    .filter((e) => e.type === "image")
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const blocks: Block[] = images.map((e) => ({ id: e.id, page: 1, x: e.x, y: e.y, width: e.width, height: e.height }))
  // Writing: pen strokes and typed text. Pasted images are questions, not answers.
  const strokes = live.filter((e) => e.type === "freedraw" || e.type === "text")
  return blocks.map((b, i) => {
    const region = answerRegion(b, blocks, [CANVAS_PAGE])
    const count = region.overlaps
      ? 0
      : strokes.filter((s) => {
          const mid = s.y + s.height / 2
          return mid >= region.y && mid < region.y + region.height
        }).length
    return { id: b.id, number: i + 1, region, strokes: count }
  })
}

// Which elements make up a question's answer: everything inside its region, except
// pasted images (those are questions). Sent to be drawn as one picture for marking.
export function answerElementIds(
  elements: readonly SceneElement[],
  block: Pick<SceneBlock, "region">
): string[] {
  const r = block.region
  if (r.overlaps || r.height <= 0) return []
  return elements
    .filter((e) => !e.isDeleted && e.type !== "image")
    .filter((e) => {
      const mid = e.y + e.height / 2
      return mid >= r.y && mid < r.y + r.height
    })
    .map((e) => e.id)
}
