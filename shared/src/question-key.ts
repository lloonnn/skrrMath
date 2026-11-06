import { normaliseCourseCode } from "./blocks.ts"

// The key that finds a question again: course code, exam, question label.
// Two students who type the same question in different ways must get the same key,
// so every part is cleaned by one rule, here. Nothing else builds a key.

// The exam is the note name ("2023 May", "May 2023", "may-2023"). Lowercase, punctuation
// becomes a space, and the words are put in alphabetical order, so the order does not matter.
// Limit: "Oct" and "October" are different. Marked as a proposal in docs/LECTURER-PLAN.md (D3).
export function cleanExamLabel(input: string): string | null {
  const words = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .sort()
  return words.length > 0 ? words.join(" ") : null
}

// The question label ("23a", "23(a)", "Q23 a", "Question 5"). Lowercase, a leading "q", "question"
// or "no" is dropped, and anything that is not a letter or a number is removed.
export function cleanQuestionLabel(input: string): string | null {
  const s = input
    .toLowerCase()
    .trim()
    // Only when a digit, a space, a dot or the end follows, so "quad" and "note" are left alone.
    .replace(/^(question|ques|qn|q|no)(?=[\s.\d]|$)\.?\s*/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
  return s.length > 0 ? s : null
}

export type KeyParts = {
  course: string | null
  exam: string | null
  question: string | null
}

// Cleans the three things a person typed. Any of them can come out as null.
export function keyParts(input: {
  courseCode: string | null | undefined
  exam: string | null | undefined
  question: string | null | undefined
}): KeyParts {
  return {
    course: input.courseCode ? normaliseCourseCode(input.courseCode) : null,
    exam: input.exam ? cleanExamLabel(input.exam) : null,
    question: input.question ? cleanQuestionLabel(input.question) : null,
  }
}

// The key, or null if any part is missing.
export function questionKey(parts: KeyParts): string | null {
  const { course, exam, question } = parts
  return course && exam && question ? `${course}|${exam}|${question}` : null
}

// Which parts are still missing, in words for the person.
export function missingKeyParts(parts: KeyParts): string[] {
  const out: string[] = []
  if (!parts.course) out.push("course code")
  if (!parts.exam) out.push("note name")
  if (!parts.question) out.push("question label")
  return out
}

// The key of a paper (one lecturer answer book): the cleaned course code and exam. Same cleaning
// as for a student's course and note, so the two meet. Either part can be null.
export function paperParts(input: { courseCode: string; exam: string }): { course: string | null; exam: string | null } {
  return {
    course: input.courseCode ? normaliseCourseCode(input.courseCode) : null,
    exam: input.exam ? cleanExamLabel(input.exam) : null,
  }
}
