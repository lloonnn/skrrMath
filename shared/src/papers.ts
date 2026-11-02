// The left list: course, then year. A year is one note canvas.
// Plain functions that return a new list. They never change the one passed in.

// Shown to the user as a "note" (a year, a tutorial, extra practice: any short name). It is the canvas.
// The code and the database still call it "year".
export type Year = { id: string; year: string }
export type Course = { id: string; code: string; years: Year[] }
export type PaperTree = Course[]

export type Edit = { ok: true; tree: PaperTree } | { ok: false; error: string }

const fail = (error: string): Edit => ({ ok: false, error })
const MAX_NAME = 40

// Names are free text. Trimmed, not empty, and not too long.
function cleanName(input: string, what: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = input.trim().replace(/\s+/g, " ")
  if (!value) return { ok: false, error: `Type a ${what}.` }
  if (value.length > MAX_NAME) return { ok: false, error: `Keep the name under ${MAX_NAME} letters.` }
  return { ok: true, value }
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// Newest first for numbers, otherwise by name. "2024" comes before "2023".
const byYear = (a: Year, b: Year) => b.year.localeCompare(a.year, undefined, { numeric: true })

export function addCourse(tree: PaperTree, input: string, id: string): Edit {
  const n = cleanName(input, "course name or code")
  if (!n.ok) return fail(n.error)
  if (tree.some((c) => same(c.code, n.value))) return fail(`${n.value} is already in the list.`)
  return { ok: true, tree: [...tree, { id, code: n.value, years: [] }] }
}

export function addYear(tree: PaperTree, courseId: string, input: string, id: string): Edit {
  const n = cleanName(input, "name for the note")
  if (!n.ok) return fail(n.error)
  const course = tree.find((c) => c.id === courseId)
  if (!course) return fail("That course is gone.")
  if (course.years.some((y) => same(y.year, n.value))) return fail(`${n.value} is already in ${course.code}.`)
  const years = [...course.years, { id, year: n.value }].sort(byYear)
  return { ok: true, tree: tree.map((c) => (c.id === courseId ? { ...c, years } : c)) }
}

// Renames a course or a year, by id.
export function rename(tree: PaperTree, id: string, input: string): Edit {
  const course = tree.find((c) => c.id === id)
  if (course) {
    const n = cleanName(input, "course name or code")
    if (!n.ok) return fail(n.error)
    if (tree.some((c) => c.id !== id && same(c.code, n.value))) return fail(`${n.value} is already in the list.`)
    return { ok: true, tree: tree.map((c) => (c.id === id ? { ...c, code: n.value } : c)) }
  }
  const y = findYear(tree, id)
  if (y) {
    const n = cleanName(input, "name for the note")
    if (!n.ok) return fail(n.error)
    const year = n.value
    if (y.course.years.some((o) => o.id !== id && same(o.year, year))) return fail(`${year} is already in ${y.course.code}.`)
    return {
      ok: true,
      tree: tree.map((c) =>
        c.id === y.course.id
          ? { ...c, years: c.years.map((o) => (o.id === id ? { ...o, year } : o)).sort(byYear) }
          : c
      ),
    }
  }
  return fail("That item is gone.")
}

// Removes a course or a year by id, with everything inside it.
// Also returns the ids of the years that went, because a year is a note,
// so their canvases can be dropped.
export function remove(tree: PaperTree, id: string): { tree: PaperTree; removedNoteIds: string[] } {
  const removed: string[] = []
  const next = tree
    .filter((c) => {
      if (c.id !== id) return true
      c.years.forEach((y) => removed.push(y.id))
      return false
    })
    .map((c) => ({
      ...c,
      years: c.years.filter((y) => {
        if (y.id !== id) return true
        removed.push(y.id)
        return false
      }),
    }))
  return { tree: next, removedNoteIds: removed }
}

function findYear(tree: PaperTree, yearId: string) {
  for (const course of tree) {
    const year = course.years.find((y) => y.id === yearId)
    if (year) return { course, year }
  }
  return null
}

// The open note: its course and year.
export type ActivePaper = { code: string; year: string }

export function findPaper(tree: PaperTree, noteId: string | null): ActivePaper | null {
  if (!noteId) return null
  const f = findYear(tree, noteId)
  return f ? { code: f.course.code, year: f.year.year } : null
}

// A saved list from disk is untrusted. Keep only what has the right shape.
export function readTree(raw: unknown): PaperTree {
  if (!Array.isArray(raw)) return []
  const ok = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null
  return raw.filter(ok).flatMap((c) => {
    if (typeof c.id !== "string" || typeof c.code !== "string" || !Array.isArray(c.years)) return []
    const years = c.years.filter(ok).flatMap((y) => {
      // Older saves kept the year as a number, and had papers inside it. Papers are gone.
      if (typeof y.id !== "string" || !(typeof y.year === "string" || typeof y.year === "number")) return []
      return [{ id: y.id, year: String(y.year) }]
    })
    return [{ id: c.id, code: c.code, years }]
  })
}

// ---- Cloud save ----

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: string) => UUID.test(s)

// Rows from the database become the list. Years are sorted the same way as everywhere.
export function buildTree(
  courses: { id: string; name: string }[],
  years: { id: string; course_id: string; label: string }[]
): PaperTree {
  return courses.map((c) => ({
    id: c.id,
    code: c.name,
    years: years
      .filter((y) => y.course_id === c.id)
      .map((y) => ({ id: y.id, year: y.label }))
      .sort(byYearItem),
  }))
}

function byYearItem(a: { year: string }, b: { year: string }) {
  return b.year.localeCompare(a.year, undefined, { numeric: true })
}

export type Upload = {
  // For every note of the guest list: the id it has in the account. It is the same id,
  // a new one, or the id of the account's note with the same name. The writing follows it.
  yearIdMap: Record<string, string>
  merged: PaperTree
  newCourses: { id: string; name: string }[]
  newYears: { id: string; courseId: string; label: string }[]
}

// A guest signs in with a list already in the browser. Keep it: add whatever the
// account does not have yet. A course or note with the same name (ignoring case) is
// treated as the same one, so signing in twice never makes copies.
// Ids that are not real UUIDs (older saves) get a new id, because the database needs UUIDs.
export function mergeLocalIntoCloud(cloud: PaperTree, local: PaperTree, newId: () => string): Upload {
  const merged: PaperTree = cloud.map((c) => ({ ...c, years: [...c.years] }))
  const newCourses: Upload["newCourses"] = []
  const newYears: Upload["newYears"] = []
  const yearIdMap: Record<string, string> = {}
  const taken = new Set<string>(merged.flatMap((c) => [c.id, ...c.years.map((y) => y.id)]))
  const pick = (id: string) => {
    let out = isUuid(id) && !taken.has(id) ? id : newId()
    while (taken.has(out)) out = newId()
    taken.add(out)
    return out
  }
  for (const lc of local) {
    let target = merged.find((c) => same(c.code, lc.code))
    if (!target) {
      target = { id: pick(lc.id), code: lc.code, years: [] }
      merged.push(target)
      newCourses.push({ id: target.id, name: target.code })
    }
    for (const ly of lc.years) {
      const existing = target.years.find((y) => same(y.year, ly.year))
      if (existing) {
        yearIdMap[ly.id] = existing.id
        continue
      }
      const year = { id: pick(ly.id), year: ly.year }
      yearIdMap[ly.id] = year.id
      target.years.push(year)
      newYears.push({ id: year.id, courseId: target.id, label: year.year })
    }
    target.years.sort(byYearItem)
  }
  return { yearIdMap, merged, newCourses, newYears }
}
