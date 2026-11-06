import { buildTree, type PaperTree } from "@shared/index.ts"
import { supabase } from "@/lib/supabase"

// Every call here needs a signed-in user. The database access rules make sure a
// user only ever sees and changes their own rows (scripts/rls-test.mjs).

function db() {
  if (!supabase) throw new Error("Sign-in is not set up.")
  return supabase
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function fetchTree(): Promise<PaperTree> {
  const [c, y] = await Promise.all([
    db().from("courses").select("id, name").order("created_at"),
    db().from("years").select("id, course_id, label"),
  ])
  check(c.error)
  check(y.error)
  return buildTree(c.data ?? [], y.data ?? [])
}

export async function insertCourse(id: string, name: string) {
  check((await db().from("courses").insert({ id, name })).error)
}
export async function insertYear(id: string, courseId: string, label: string) {
  check(
    (await db().from("years").insert({ id, course_id: courseId, label })).error
  )
}
export async function renameCourse(id: string, name: string) {
  check((await db().from("courses").update({ name }).eq("id", id)).error)
}
export async function renameYear(id: string, label: string) {
  check((await db().from("years").update({ label }).eq("id", id)).error)
}
// Deleting removes what is inside (years, pages) by the database's cascade.
export async function deleteCourse(id: string) {
  check((await db().from("courses").delete().eq("id", id)).error)
}
export async function deleteYear(id: string) {
  check((await db().from("years").delete().eq("id", id)).error)
}

// The writing of one note. A note has one page.
export type PageRow = { id: string; strokes: unknown }

export async function fetchPage(yearId: string): Promise<PageRow | null> {
  const { data, error } = await db()
    .from("pages")
    .select("id, strokes")
    .eq("year_id", yearId)
    .eq("page_index", 0)
    .maybeSingle()
  check(error)
  return data
}

export async function savePage(
  pageId: string,
  yearId: string,
  strokes: unknown
) {
  check(
    (
      await db()
        .from("pages")
        .upsert({ id: pageId, year_id: yearId, page_index: 0, strokes })
    ).error
  )
}
