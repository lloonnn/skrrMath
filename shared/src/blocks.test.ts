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

import { blocksFromScene, type SceneElement } from "./blocks.ts"

const el = (id: string, type: string, y: number, height = 50, extra: Partial<SceneElement> = {}): SceneElement => ({
  id, type, x: 0, y, width: 100, height, ...extra,
})

describe("blocksFromScene", () => {
  it("an empty canvas has no blocks", () => expect(blocksFromScene([])).toEqual([]))
  it("ignores shapes and text", () =>
    expect(blocksFromScene([el("r", "rectangle", 0), el("t", "text", 10)])).toEqual([]))
  it("one image: its strokes below count, strokes above do not", () => {
    const r = blocksFromScene([el("q", "image", 100, 80), el("s1", "freedraw", 200, 20), el("s2", "freedraw", 400, 20), el("above", "freedraw", 10, 20)])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id: "q", number: 1, strokes: 2 })
  })
  it("two images: strokes go to the nearest question above them", () => {
    const r = blocksFromScene([
      el("q1", "image", 0, 50), el("a", "freedraw", 100, 20), el("b", "freedraw", 150, 20),
      el("q2", "image", 300, 50), el("c", "freedraw", 400, 20),
    ])
    expect(r.map((b) => [b.id, b.number, b.strokes])).toEqual([["q1", 1, 2], ["q2", 2, 1]])
  })
  it("numbers images by position, not by the order of the list", () => {
    const r = blocksFromScene([el("low", "image", 500), el("high", "image", 0)])
    expect(r.map((b) => b.id)).toEqual(["high", "low"])
  })
  it("ignores deleted elements", () => {
    const r = blocksFromScene([el("q", "image", 0), el("gone", "image", 200, 50, { isDeleted: true }), el("s", "freedraw", 100, 10, { isDeleted: true })])
    expect(r).toHaveLength(1)
    expect(r[0].strokes).toBe(0)
  })
  it("overlapping images give an empty answer", () => {
    const r = blocksFromScene([el("q1", "image", 0, 100), el("q2", "image", 50, 100), el("s", "freedraw", 120, 10)])
    expect(r[0].region.overlaps).toBe(true)
    expect(r[0].strokes).toBe(0)
  })
})
