import { describe, expect, it } from "vitest"
import { answerRegion, normaliseCourseCode, type Block, type Page } from "./blocks.ts"

const pages: Page[] = [
  { page: 1, width: 600, height: 800 },
  { page: 2, width: 600, height: 800 },
]
const b = (id: string, page: number, y: number, height: number): Block => ({ id, page, x: 50, y, width: 500, height })

describe("answerRegion", () => {
  it("one block: from its bottom edge to the end of the page", () => {
    const a = b("a", 1, 100, 80)
    expect(answerRegion(a, [a], pages)).toMatchObject({ y: 180, height: 620, width: 600, x: 0, overlaps: false })
  })
  it("two blocks: ends where the next block starts", () => {
    const a = b("a", 1, 100, 80)
    const c = b("c", 1, 400, 60)
    const all = [a, c]
    expect(answerRegion(a, all, pages)).toMatchObject({ y: 180, height: 220 })
    expect(answerRegion(c, all, pages)).toMatchObject({ y: 460, height: 340 })
  })
  it("does not depend on the order of the list", () => {
    const a = b("a", 1, 100, 80)
    const c = b("c", 1, 400, 60)
    expect(answerRegion(a, [c, a], pages).height).toBe(220)
  })
  it("a block at the bottom of the page gets an empty region", () => {
    const a = b("a", 1, 720, 80)
    expect(answerRegion(a, [a], pages)).toMatchObject({ y: 800, height: 0, overlaps: false })
  })
  it("a block that runs past the page end is clamped", () => {
    const a = b("a", 1, 760, 100)
    expect(answerRegion(a, [a], pages)).toMatchObject({ y: 800, height: 0 })
  })
  it("two blocks very close: a small region", () => {
    const a = b("a", 1, 100, 80)
    const c = b("c", 1, 184, 60)
    expect(answerRegion(a, [a, c], pages).height).toBe(4)
  })
  it("touching blocks: an empty region, not an overlap", () => {
    const a = b("a", 1, 100, 80)
    const c = b("c", 1, 180, 60)
    expect(answerRegion(a, [a, c], pages)).toMatchObject({ height: 0, overlaps: false })
  })
  it("overlapping blocks: an empty region, flagged", () => {
    const a = b("a", 1, 100, 80)
    const c = b("c", 1, 150, 60)
    expect(answerRegion(a, [a, c], pages)).toMatchObject({ height: 0, overlaps: true })
  })
  it("ignores blocks on other pages", () => {
    const a = b("a", 1, 100, 80)
    const other = b("o", 2, 200, 50)
    expect(answerRegion(a, [a, other], pages).height).toBe(620)
  })
  it("uses the right page size", () => {
    const wide: Page[] = [{ page: 1, width: 900, height: 500 }]
    const a = b("a", 1, 100, 80)
    expect(answerRegion(a, [a], wide)).toMatchObject({ width: 900, height: 320 })
  })
  it("throws for an unknown page", () => {
    expect(() => answerRegion(b("a", 9, 0, 10), [], pages)).toThrow(/no page 9/)
  })
})

describe("normaliseCourseCode", () => {
  it.each(["math201", "Math 201", " MATH-201 ", "math_201"])("%j gives MATH201", (s) =>
    expect(normaliseCourseCode(s)).toBe("MATH201"))
  it("keeps a trailing letter", () => expect(normaliseCourseCode("csc 101a")).toBe("CSC101A"))
  it.each(["", "   ", "201", "MATH", "MATH 201 extra", "M@TH201", "数学201"])("rejects %j", (s) =>
    expect(normaliseCourseCode(s)).toBeNull())
})
