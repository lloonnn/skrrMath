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
  it("gives the course and year", () => expect(findPaper(sample(), "y1")).toEqual({ code: "MATH201", year: "2023" }))
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
