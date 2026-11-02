import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { markingLabel, parseMarkingResult } from "./marking.ts"

const dir = join(import.meta.dirname, "../../fixtures/marking")
const load = (name: string) => JSON.parse(readFileSync(join(dir, name), "utf8"))
const files = readdirSync(dir).filter((f) => f.endsWith(".json"))
const base = () => load("sign-error-verified-user.json")

describe("fixtures", () => {
  it("finds fixtures", () => expect(files.length).toBeGreaterThan(0))
  it.each(files)("%s is valid", (f) => {
    const out = parseMarkingResult(load(f))
    expect(out.ok ? [] : out.errors).toEqual([])
  })
})

describe("shape", () => {
  const fails = (mutate: (r: any) => void) => {
    const r = base()
    mutate(r)
    return !parseMarkingResult(r).ok
  }
  it("rejects non-objects", () => {
    expect(parseMarkingResult(null).ok).toBe(false)
    expect(parseMarkingResult("x").ok).toBe(false)
  })
  it("rejects a missing field", () => expect(fails((r) => delete r.summary)).toBe(true))
  it("rejects an unknown verdict", () =>
    expect(fails((r) => (r.lines[0].verdict = "great"))).toBe(true))
  it("rejects a wrong type", () => expect(fails((r) => (r.method_ok = "yes"))).toBe(true))
  it("rejects an extra field", () => expect(fails((r) => (r.confidence = 0.99))).toBe(true))
  it("rejects an unknown reference source", () =>
    expect(fails((r) => (r.reference_source = "trusted"))).toBe(true))
})

describe("rules", () => {
  const fails = (name: string, mutate: (r: any) => void) => {
    const r = load(name)
    mutate(r)
    return !parseMarkingResult(r).ok
  }
  const err = "sign-error-verified-user.json"
  it("needs line numbers in order", () =>
    expect(fails(err, (r) => (r.lines[2].n = 9))).toBe(true))
  it("needs first_error_line to match the error line", () =>
    expect(fails(err, (r) => (r.first_error_line = 3))).toBe(true))
  it("rejects a second error after the first", () =>
    expect(fails(err, (r) => (r.lines[2].verdict = "error"))).toBe(true))
  it("rejects follows_from_error before the first error", () =>
    expect(fails(err, (r) => (r.lines[0].verdict = "follows_from_error"))).toBe(true))
  it("allows an unsure result to name a line error", () => {
    const r = load(err)
    r.status = "unsure"
    r.final_answer.matches_reference = "unknown"
    expect(parseMarkingResult(r).ok).toBe(true)
  })
  it("rejects an unreadable result that names an error", () =>
    expect(fails(err, (r) => (r.status = "unreadable"))).toBe(true))
  it("needs an error type when there is an error", () =>
    expect(fails(err, (r) => (r.error_type = null))).toBe(true))
  it("rejects an error line with no first_error_line", () =>
    expect(fails(err, (r) => { r.first_error_line = null; r.error_type = null })).toBe(true))
  it("rejects a readable line with the unreadable verdict", () =>
    expect(fails("unreadable-line.json", (r) => (r.lines[1].readable = true))).toBe(true))
  it("rejects an unreadable line with another verdict", () =>
    expect(fails("correct-ai-solved.json", (r) => { r.lines[0].readable = false })).toBe(true))
  it("rejects marked status when solutions disagree", () =>
    expect(fails("solutions-disagree.json", (r) => (r.status = "marked"))).toBe(true))
  it("rejects judging the final answer when solutions disagree", () =>
    expect(fails("solutions-disagree.json", (r) => (r.final_answer.matches_reference = "yes"))).toBe(true))
  it("rejects solve_runs_agree with a verified answer", () =>
    expect(fails(err, (r) => (r.solve_runs_agree = true))).toBe(true))
  it("rejects an unsure result that judges the answer", () =>
    expect(fails("solutions-disagree.json", (r) => { r.solve_runs_agree = null; r.reference_source = "verified_user"; r.final_answer.matches_reference = "no" })).toBe(true))
})

describe("markingLabel", () => {
  it("says Not verified for ai_solved", () =>
    expect(markingLabel({ reference_source: "ai_solved" })).toBe("Not verified"))
  it("says checked for a user answer", () =>
    expect(markingLabel({ reference_source: "verified_user" })).toBe("Checked against your answer"))
  it("never says Not verified for a verified source", () => {
    for (const s of ["verified_user", "verified_bank"] as const)
      expect(markingLabel({ reference_source: s })).not.toBe("Not verified")
  })
})
