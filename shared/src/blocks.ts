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
