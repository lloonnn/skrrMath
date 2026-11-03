import { describe, expect, it } from "vitest"
import { addCourse, addYear, findPaper, readTree, remove, rename, type PaperTree } from "./papers.ts"

const must = (e: { ok: boolean; tree?: PaperTree; error?: string }) => {
  if (!e.ok) throw new Error(e.error)
  return e.tree as PaperTree
}

function sample(): PaperTree {
  const t = must(addCourse([], "MATH201", "c1"))
  return must(addYear(t, "c1", "2023", "y1"))
}

describe("addCourse", () => {
  it("keeps any name, trimmed", () => expect(must(addCourse([], "  Calculus   II ", "c"))[0].code).toBe("Calculus II"))
  it("accepts a plain number", () => expect(addCourse([], "201", "c").ok).toBe(true))
  it("rejects an empty name", () => expect(addCourse([], "   ", "c")).toMatchObject({ ok: false }))
  it("rejects a very long name", () => expect(addCourse([], "x".repeat(41), "c")).toMatchObject({ ok: false }))
  it("rejects a duplicate, ignoring case", () => expect(addCourse(sample(), "math201", "x")).toMatchObject({ ok: false }))
  it("does not change the list passed in", () => {
    const t: PaperTree = []
    addCourse(t, "MATH201", "c")
    expect(t).toEqual([])
  })
})

describe("addYear", () => {
  it("accepts any label", () => {
    for (const label of ["23", "2023/24", "Semester 1", "Finals"]) expect(addYear(sample(), "c1", label, "y").ok).toBe(true)
  })
  it("rejects an empty label", () => expect(addYear(sample(), "c1", " ", "y")).toMatchObject({ ok: false }))
  it("rejects a duplicate year", () => expect(addYear(sample(), "c1", "2023", "y")).toMatchObject({ ok: false }))
  it("allows the same year in another course", () => {
    const t = must(addCourse(sample(), "CSC101", "c2"))
    expect(addYear(t, "c2", "2023", "y2").ok).toBe(true)
  })
  it("keeps the newest year first", () => {
    const t = must(addYear(sample(), "c1", "2024", "y2"))
    expect(t[0].years.map((y) => y.year)).toEqual(["2024", "2023"])
  })
  it("fails for a missing course", () => expect(addYear(sample(), "nope", "2022", "y")).toMatchObject({ ok: false }))
})

describe("rename", () => {
  it("renames a course to any name", () => expect(must(rename(sample(), "c1", "Linear Algebra"))[0].code).toBe("Linear Algebra"))
  it("renames a year to a term", () => expect(must(rename(sample(), "y1", "Semester 1"))[0].years[0].year).toBe("Semester 1"))
  it("re-sorts after a year rename", () => {
    let t = must(addYear(sample(), "c1", "2020", "y2"))
    t = must(rename(t, "y2", "2025"))
    expect(t[0].years.map((y) => y.year)).toEqual(["2025", "2023"])
  })
  it("rejects an empty name", () => expect(rename(sample(), "y1", "  ")).toMatchObject({ ok: false }))
  it("rejects a name the same course already has", () => {
    const t = must(addYear(sample(), "c1", "2024", "y2"))
    expect(rename(t, "y2", "2023")).toMatchObject({ ok: false })
  })
  it("allows renaming something to its own name", () => expect(rename(sample(), "y1", "2023").ok).toBe(true))
  it("fails for an unknown id", () => expect(rename(sample(), "zzz", "x")).toMatchObject({ ok: false }))
})

describe("remove", () => {
  it("removing a year lists it as a gone note and keeps the course", () => {
    const r = remove(sample(), "y1")
    expect(r.tree[0].years).toEqual([])
    expect(r.removedNoteIds).toEqual(["y1"])
  })
  it("removing a course lists every year inside it", () => {
    const t = must(addYear(sample(), "c1", "2024", "y2"))
    expect(remove(t, "c1")).toEqual({ tree: [], removedNoteIds: ["y2", "y1"] })
  })
  it("an unknown id changes nothing", () => expect(remove(sample(), "zzz")).toEqual({ tree: sample(), removedNoteIds: [] }))
})

describe("findPaper (the open note)", () => {
  it("gives the course and year", () =>
    expect(findPaper(sample(), "y1")).toEqual({ code: "MATH201", year: "2023", courseCode: "MATH201", exam: "2023" }))
  it("gives null for none, a course id, or an unknown id", () => {
    expect(findPaper(sample(), null)).toBeNull()
    expect(findPaper(sample(), "c1")).toBeNull()
    expect(findPaper(sample(), "zzz")).toBeNull()
  })
})

describe("readTree", () => {
  it("round trips a valid list", () => expect(readTree(JSON.parse(JSON.stringify(sample())))).toEqual(sample()))
  it("turns an old numeric year into text and drops old papers", () => {
    const old = [{ id: "c", code: "A1", years: [{ id: "y", year: 2023, papers: [{ id: "p", title: "Paper 1" }] }] }]
    expect(readTree(old)).toEqual([{ id: "c", code: "A1", years: [{ id: "y", year: "2023" }] }])
  })
  it("drops junk without throwing", () => {
    expect(readTree("nope")).toEqual([])
    expect(readTree([{ id: 1 }, null, { id: "c", code: "A1", years: [{ id: "y", year: { bad: true } }] }])).toEqual([{ id: "c", code: "A1", years: [] }])
  })
})

import { buildTree, isUuid, mergeLocalIntoCloud } from "./papers.ts"

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

describe("buildTree", () => {
  it("nests years under their course, newest first", () => {
    const t = buildTree(
      [{ id: "c1", name: "Calc" }, { id: "c2", name: "Algebra" }],
      [{ id: "y1", course_id: "c1", label: "2022" }, { id: "y2", course_id: "c1", label: "2024" }, { id: "y3", course_id: "c2", label: "Tut" }]
    )
    expect(t[0].years.map((y) => y.year)).toEqual(["2024", "2022"])
    expect(t[1].years.map((y) => y.year)).toEqual(["Tut"])
  })
  it("a course with no years is kept", () => expect(buildTree([{ id: "c", name: "X" }], [])).toEqual([{ id: "c", code: "X", years: [] }]))
})

describe("mergeLocalIntoCloud", () => {
  let n = 100
  const fresh = () => U(n++)
  const local: PaperTree = [{ id: U(1), code: "Calculus", years: [{ id: U(2), year: "2023" }, { id: U(3), year: "Tut 1" }] }]

  it("uploads everything into an empty account, keeping ids that are UUIDs", () => {
    const r = mergeLocalIntoCloud([], local, fresh)
    expect(r.merged).toEqual(local.map((c) => ({ ...c, years: [{ id: U(3), year: "Tut 1" }, { id: U(2), year: "2023" }].sort((a, b) => b.year.localeCompare(a.year, undefined, { numeric: true })) })))
    expect(r.newCourses).toEqual([{ id: U(1), name: "Calculus" }])
    expect(r.newYears.map((y) => y.label).sort()).toEqual(["2023", "Tut 1"])
  })
  it("makes no copies when the account already has them (ignoring case)", () => {
    const cloud: PaperTree = [{ id: U(50), code: "calculus", years: [{ id: U(51), year: "2023" }] }]
    const r = mergeLocalIntoCloud(cloud, local, fresh)
    expect(r.newCourses).toEqual([])
    expect(r.newYears.map((y) => y.label)).toEqual(["Tut 1"])
    expect(r.newYears[0].courseId).toBe(U(50))
  })
  it("running it twice adds nothing the second time", () => {
    const first = mergeLocalIntoCloud([], local, fresh)
    const second = mergeLocalIntoCloud(first.merged, local, fresh)
    expect(second.newCourses).toEqual([])
    expect(second.newYears).toEqual([])
  })
  it("gives a new UUID to an old id that is not one", () => {
    const old: PaperTree = [{ id: "abc123", code: "Old", years: [{ id: "def456", year: "2020" }] }]
    const r = mergeLocalIntoCloud([], old, fresh)
    expect(isUuid(r.newCourses[0].id)).toBe(true)
    expect(isUuid(r.newYears[0].id)).toBe(true)
  })
  it("never reuses an id the account already has", () => {
    const cloud: PaperTree = [{ id: U(1), code: "Other", years: [] }]
    const r = mergeLocalIntoCloud(cloud, local, fresh)
    expect(r.newCourses[0].id).not.toBe(U(1))
  })
  it("maps every guest note to its id in the account", () => {
    const old: PaperTree = [{ id: "abc", code: "Old", years: [{ id: "def", year: "2020" }] }]
    const r = mergeLocalIntoCloud([], old, fresh)
    expect(r.yearIdMap).toEqual({ def: r.newYears[0].id })
  })
  it("maps a guest note to the account note with the same name", () => {
    const cloud: PaperTree = [{ id: U(50), code: "Calculus", years: [{ id: U(51), year: "2023" }] }]
    const r = mergeLocalIntoCloud(cloud, local, fresh)
    expect(r.yearIdMap[U(2)]).toBe(U(51))
    expect(r.yearIdMap[U(3)]).toBe(r.newYears[0].id)
  })
  it("does not change the lists passed in", () => {
    const cloud: PaperTree = [{ id: U(50), code: "Calculus", years: [] }]
    const copy = JSON.parse(JSON.stringify(cloud))
    mergeLocalIntoCloud(cloud, local, fresh)
    expect(cloud).toEqual(copy)
  })
})

import { effectiveCourseCode, setCourseCode } from "./papers.ts"

describe("course code", () => {
  const named = (name: string): PaperTree => must(addCourse([], name, "c1"))

  it("comes from the name when the name looks like a code", () => {
    expect(effectiveCourseCode(named("UECM2353")[0])).toBe("UECM2353")
    expect(effectiveCourseCode(named("uecm 2353")[0])).toBe("UECM2353")
  })
  it("is null when the name is not a code", () => expect(effectiveCourseCode(named("Calculus II")[0])).toBeNull())
  it("is set by hand, and cleaned", () => {
    const t = must(setCourseCode(named("Calculus II"), "c1", " uecm-2323 "))
    expect(t[0].courseCode).toBe("UECM2323")
    expect(effectiveCourseCode(t[0])).toBe("UECM2323")
  })
  it("a code set by hand wins over the name", () => {
    const t = must(setCourseCode(named("UECM2353"), "c1", "MATH101"))
    expect(effectiveCourseCode(t[0])).toBe("MATH101")
  })
  it("an empty input clears it, and the name is used again", () => {
    let t = must(setCourseCode(named("UECM2353"), "c1", "MATH101"))
    t = must(setCourseCode(t, "c1", "  "))
    expect(t[0].courseCode).toBeUndefined()
    expect(effectiveCourseCode(t[0])).toBe("UECM2353")
  })
  it("refuses something that is not a code, and a course that is gone", () => {
    expect(setCourseCode(named("x"), "c1", "calculus two")).toMatchObject({ ok: false })
    expect(setCourseCode(named("x"), "nope", "UECM2353")).toMatchObject({ ok: false })
  })
  it("does not change the list passed in", () => {
    const t = named("Calculus II")
    setCourseCode(t, "c1", "UECM2323")
    expect(t[0].courseCode).toBeUndefined()
  })
  it("findPaper gives the cleaned course code and exam for the key", () => {
    let t = must(setCourseCode(named("Calculus II"), "c1", "uecm2323"))
    t = must(addYear(t, "c1", "May 2023", "y1"))
    expect(findPaper(t, "y1")).toEqual({ code: "Calculus II", year: "May 2023", courseCode: "UECM2323", exam: "2023 may" })
  })
  it("findPaper gives null course code when there is none", () => {
    const t = must(addYear(named("Calculus II"), "c1", "2023", "y1"))
    expect(findPaper(t, "y1")?.courseCode).toBeNull()
  })
  it("survives a save and load, and a bad saved code is dropped", () => {
    const t = must(setCourseCode(named("Calculus II"), "c1", "UECM2323"))
    expect(readTree(JSON.parse(JSON.stringify(t)))[0].courseCode).toBe("UECM2323")
    expect(readTree([{ id: "c", code: "A", courseCode: "not a code!", years: [] }])[0].courseCode).toBeUndefined()
  })
  it("is read from the database column", () => {
    const t = buildTree([{ id: "c", name: "Calculus II", course_code: "UECM2323" }, { id: "d", name: "Other", course_code: null }], [])
    expect(t[0].courseCode).toBe("UECM2323")
    expect(t[1].courseCode).toBeUndefined()
  })
  it("a guest course code goes up with a new course", () => {
    const local: PaperTree = [{ id: "00000000-0000-4000-8000-000000000001", code: "Calc", courseCode: "UECM2323", years: [] }]
    const r = mergeLocalIntoCloud([], local, () => "00000000-0000-4000-8000-000000000099")
    expect(r.newCourses[0].courseCode).toBe("UECM2323")
  })
  it("a guest course code fills an account course that has none", () => {
    const cloud: PaperTree = [{ id: "00000000-0000-4000-8000-000000000050", code: "Calc", years: [] }]
    const local: PaperTree = [{ id: "00000000-0000-4000-8000-000000000001", code: "calc", courseCode: "UECM2323", years: [] }]
    const r = mergeLocalIntoCloud(cloud, local, () => "00000000-0000-4000-8000-000000000099")
    expect(r.codeUpdates).toEqual([{ id: "00000000-0000-4000-8000-000000000050", courseCode: "UECM2323" }])
    expect(r.merged[0].courseCode).toBe("UECM2323")
  })
  it("a guest course code does not replace one the account already has", () => {
    const cloud: PaperTree = [{ id: "00000000-0000-4000-8000-000000000050", code: "Calc", courseCode: "MATH101", years: [] }]
    const local: PaperTree = [{ id: "00000000-0000-4000-8000-000000000001", code: "calc", courseCode: "UECM2323", years: [] }]
    const r = mergeLocalIntoCloud(cloud, local, () => "00000000-0000-4000-8000-000000000099")
    expect(r.codeUpdates).toEqual([])
    expect(r.merged[0].courseCode).toBe("MATH101")
  })
})
