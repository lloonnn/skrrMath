import { describe, expect, it } from "vitest"
import { cleanExamLabel, cleanQuestionLabel, keyParts, missingKeyParts, questionKey } from "./question-key.ts"

describe("cleanExamLabel", () => {
  it.each([
    ["2023 May", "2023 may"],
    ["May 2023", "2023 may"],
    ["may-2023", "2023 may"],
    ["  MAY   2023 ", "2023 may"],
    ["2023/24", "2023 24"],
    ["Semester 1, 2023", "1 2023 semester"],
  ])("%j gives %j", (input, want) => expect(cleanExamLabel(input)).toBe(want))
  it("gives the same result for the same words in any order", () =>
    expect(cleanExamLabel("Final 2023 Paper 1")).toBe(cleanExamLabel("paper 1 final 2023")))
  it("gives null for nothing usable", () => {
    expect(cleanExamLabel("")).toBeNull()
    expect(cleanExamLabel("  ")).toBeNull()
    expect(cleanExamLabel("---")).toBeNull()
  })
  it("keeps letters from other languages", () => expect(cleanExamLabel("期末 2023")).toBe("2023 期末"))
})

describe("cleanQuestionLabel", () => {
  it.each([
    ["23a", "23a"],
    ["23(a)", "23a"],
    ["23 (a)", "23a"],
    ["23.a", "23a"],
    ["Q23a", "23a"],
    ["Q 23 a", "23a"],
    ["Question 5", "5"],
    ["question5", "5"],
    ["No. 7", "7"],
    ["3(b)(ii)", "3bii"],
    ["  A1  ", "a1"],
  ])("%j gives %j", (input, want) => expect(cleanQuestionLabel(input)).toBe(want))
  it("does not eat a label that only starts with the letter q", () => expect(cleanQuestionLabel("quad")).toBe("quad"))
  it("gives null for nothing usable", () => {
    expect(cleanQuestionLabel("")).toBeNull()
    expect(cleanQuestionLabel("()")).toBeNull()
    expect(cleanQuestionLabel("Q")).toBeNull()
  })
})

describe("the key", () => {
  const parts = keyParts({ courseCode: "uecm 2353", exam: "May 2023", question: "Q23(a)" })
  it("cleans all three parts", () => expect(parts).toEqual({ course: "UECM2353", exam: "2023 may", question: "23a" }))
  it("is the same for the same question typed two ways", () => {
    const other = keyParts({ courseCode: "UECM-2353", exam: "2023 may", question: "23 a" })
    expect(questionKey(parts)).toBe("UECM2353|2023 may|23a")
    expect(questionKey(other)).toBe(questionKey(parts))
  })
  it("differs when the course, the exam or the question differs", () => {
    const base = questionKey(parts)
    expect(questionKey(keyParts({ courseCode: "UECM2354", exam: "May 2023", question: "23a" }))).not.toBe(base)
    expect(questionKey(keyParts({ courseCode: "UECM2353", exam: "Oct 2023", question: "23a" }))).not.toBe(base)
    expect(questionKey(keyParts({ courseCode: "UECM2353", exam: "May 2023", question: "23b" }))).not.toBe(base)
  })
  it("is null when any part is missing, and says which", () => {
    const p = keyParts({ courseCode: "Calculus", exam: "2023 May", question: "" })
    expect(questionKey(p)).toBeNull()
    expect(missingKeyParts(p)).toEqual(["course code", "question label"])
  })
  it("says nothing is missing for a full key", () => expect(missingKeyParts(parts)).toEqual([]))
  it("a course name that is not a code gives no course part", () =>
    expect(keyParts({ courseCode: "Calculus II", exam: "x", question: "1" }).course).toBeNull())
  it("a part that cannot be an empty string never makes a key like 'a||b'", () => {
    expect(questionKey({ course: "AB12", exam: "", question: "1" })).toBeNull()
  })
})
