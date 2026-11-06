import { supabase } from "@/lib/supabase"

// What a lecturer can do. The database access rules decide who is allowed (supabase/migrations);
// the screen only hides what a person cannot use.

function db() {
  if (!supabase) throw new Error("Sign-in is not set up.")
  return supabase
}

export async function isLecturer(): Promise<boolean> {
  const { data, error } = await db().rpc("is_lecturer")
  if (error) throw new Error(error.message)
  return data === true
}

export type ClaimResult = "lecturer" | "wrong_code" | "locked" | "not_set"

export async function claimLecturer(code: string): Promise<ClaimResult> {
  const { data, error } = await db().rpc("claim_lecturer", { code })
  if (error) throw new Error(error.message)
  return data as ClaimResult
}

// One answer book: all the solutions of one paper.
export type Book = {
  id: string
  course_code: string
  exam: string
  answer_text: string | null
  answer_image: string | null
  answer_image_type: string | null
  version: number
  withdrawn: boolean
  updated_at: string
}

const COLUMNS =
  "id, course_code, exam, answer_text, answer_image, answer_image_type, version, withdrawn, updated_at"

// The signed-in lecturer's own books, newest first. Withdrawn ones are kept in the list.
export async function listMyBooks(userId: string): Promise<Book[]> {
  const { data, error } = await db()
    .from("bank_solutions")
    .select(COLUMNS)
    .eq("lecturer", userId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Book[]
}

export type BookContent =
  | { kind: "text"; text: string }
  | { kind: "image"; base64: string; mimeType: string }

const contentColumns = (c: BookContent) =>
  c.kind === "text"
    ? { answer_text: c.text, answer_image: null, answer_image_type: null }
    : {
        answer_text: null,
        answer_image: c.base64,
        answer_image_type: c.mimeType,
      }

export async function addBook(
  courseCode: string,
  exam: string,
  content: BookContent
) {
  const { error } = await db()
    .from("bank_solutions")
    .insert({ course_code: courseCode, exam, ...contentColumns(content) })
  if (error) {
    // 23505 is "already exists": another live book for this paper
    if (error.code === "23505")
      throw new Error(
        "There is already a book for this paper. It must be withdrawn first."
      )
    throw new Error(error.message)
  }
}

export async function changeBook(id: string, content: BookContent) {
  const { error } = await db()
    .from("bank_solutions")
    .update(contentColumns(content))
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function withdrawBook(id: string) {
  const { error } = await db()
    .from("bank_solutions")
    .update({ withdrawn: true })
    .eq("id", id)
  if (error) throw new Error(error.message)
}
