import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { marginView } from "./marking-view.ts"
import { parseMarkingResult } from "./marking.ts"

const load = (n: string) => {
  const p = parseMarkingResult(JSON.parse(readFileSync(join(import.meta.dirname, "../../fixtures/marking", n), "utf8")))
  if (!p.ok) throw new Error(p.errors.join())
  return p.result
}

describe("marginView", () => {
  it("sign error: cross, first error, and one note for the lines that follow", () => {
    const v = marginView(load("sign-error-verified-user.json"))
    expect(v.mark).toBe("cross")
    expect(v.headline).toBe("Mistake on line 2.")
    expect(v.detail).toBe("The lines after it carry this mistake into the answer.")
    expect(v.notes.map((n) => [n.kind, n.lines])).toEqual([["error", [2]], ["follows", [3, 4]]])
    expect(v.notes[1].text).toBe("lines 3 to 4 carry the mistake")
    expect(v.label).toBe("Checked against your answer")
  })
  it("correct answer: tick, and the label says AI-checked", () => {
    const v = marginView(load("correct-ai-solved.json"))
    expect(v.mark).toBe("tick")
    expect(v.label).toBe("AI-checked")
    expect(v.notes).toEqual([])
  })
  it("unreadable line: says so and does not judge it", () => {
    const v = marginView(load("unreadable-line.json"))
    expect(v.notes).toEqual([{ kind: "unreadable", lines: [2], text: "Can't read line 2, please check." }])
  })
  it("unsure: no tick and no cross, and it says the reference is not reliable", () => {
    const v = marginView(load("solutions-disagree.json"))
    expect(v.mark).toBe("none")
    expect(v.headline).toMatch(/Not sure/)
    expect(v.label).toBe("AI-checked")
  })
  it("shows the reference answer when the student's answer is wrong", () => {
    expect(marginView(load("sign-error-verified-user.json")).answer).toEqual({ latex: "x = 5", by: "verified" })
    expect(marginView(load("ode-page2-demo.json")).answer?.by).toBe("ai")
  })
  it("shows no answer when the student is right, or when unsure", () => {
    expect(marginView(load("correct-ai-solved.json")).answer).toBeNull()
    expect(marginView(load("solutions-disagree.json")).answer).toBeNull()
  })
  it("a lone follows line reads singular", () => {
    const r = load("sign-error-verified-user.json")
    r.lines = r.lines.slice(0, 3)
    expect(marginView(r).notes[1].text).toBe("line 3 carries the mistake")
  })
})

import { lineMarks } from "./marking-view.ts"

describe("lineMarks", () => {
  const boxed = (name: string) => {
    const r = load(name)
    r.lines.forEach((l, i) => (l.box = [i * 100, 100, i * 100 + 80, 900]))
    return r
  }
  it("returns null when a line has no box", () => expect(lineMarks(load("sign-error-verified-user.json"))).toBeNull())
  it("puts a cross on the error and notes on the lines that follow", () => {
    const m = lineMarks(boxed("sign-error-verified-user.json"))!
    expect(m.map((x) => [x.n, x.kind])).toEqual([[1, "tick"], [2, "error"], [3, "follows"], [4, "follows"]])
  })
  it("ticks only the end of a run of good lines", () => {
    const m = lineMarks(boxed("correct-ai-solved.json"))!
    expect(m.map((x) => [x.n, x.kind])).toEqual([[3, "tick"]])
  })
  it("marks an unreadable line and does not tick it", () => {
    const m = lineMarks(boxed("unreadable-line.json"))!
    expect(m.find((x) => x.n === 2)).toMatchObject({ kind: "unreadable" })
    expect(m.find((x) => x.n === 3)).toBeUndefined() // not_checked: no mark
  })
  it("returns null for an unreadable result", () => {
    const r = boxed("sign-error-verified-user.json")
    r.status = "unreadable"
    r.first_error_line = null
    r.error_type = null
    r.lines.forEach((l) => (l.verdict = "not_checked"))
    expect(lineMarks(r)).toBeNull()
  })
})
