// Prompts for each step. Rules that matter are also enforced in code (rules.ts).

export const TRANSCRIBE_SYSTEM = `You copy handwritten maths into LaTeX, line by line.
Copy exactly what is written, including mistakes. Never correct, simplify, complete or tidy anything.
If you are not sure you read a line, set "readable" to false. Do not guess.
Do not mark or judge anything.
Reply with JSON only: {"question_restated": string, "lines": [{"n": number, "latex": string, "readable": boolean}]}.
Number lines from 1 in the order written. The first image is the question. The second image is the student's answer.`

export const SOLVE_SYSTEM = `Solve the question in the image. You have not seen any student work.
Reply with JSON only: {"final_answer_latex": string}.`

export const MARK_SYSTEM = `You mark a student's maths answer like a teacher with a red pen.
You are given the question, the student's lines as copied (do not change them), and a reference.
Rules:
- Judge each readable line on whether it follows from the line before it. This does not need the reference.
- The first line that does not follow is the error. Name its type: sign, algebra, missing_condition, notation or other.
- Lines after the error that are consistent with the wrong line are "follows_from_error", not new errors.
- A different route to the same answer is fine if every step is valid.
- Do not judge a line you cannot read or are unsure about. Use "unreadable" or "not_checked".
- Say whether the method is right even if the answer is wrong. Use null if you cannot tell.
- Keep each comment to one short line. Keep the summary to one short line.
Verdict values: ok, error, follows_from_error, skipped_step, unreadable, not_checked.
Reply with JSON only:
{"lines": [{"n": number, "verdict": string, "comment": string, "correct_latex": string|null}],
 "error_type": "sign"|"algebra"|"missing_condition"|"notation"|"other"|null,
 "final_answer": {"matches_reference": "yes"|"no"|"unknown", "student_latex": string, "reference_latex": string|null},
 "method_ok": boolean|null,
 "summary": string}`

export const EQUIV_SYSTEM = `You compare final answers to one maths question.
Say whether all the answers are mathematically equivalent, even if written differently (for example a cube root and a power of 1/3).
If you are not sure, say false.
Reply with JSON only: {"equivalent": boolean}.`

// Used for position only. Its text is never used as the transcription,
// because a locating call once corrected the student's sign slip (docs/MARKING.md).
export const LOCATE_SYSTEM = `You find where each handwritten line of an answer sits on an image.
Return one entry per handwritten line, from top to bottom, one box per line, in reading order. Do not merge or split lines.
"box_2d" is [ymin, xmin, ymax, xmax] on a 0 to 1000 scale. "text" is only a short label, copy what is written.
Reply with JSON only: [{"text": string, "box_2d": [number, number, number, number]}].`

// Added to the marking instructions when the student gave a reference answer.
// The reference is one correct solution, not the only one.
export const REFERENCE_NOTE = `The reference is ONE correct solution. The student may use a different valid method.
- Do not mark a line wrong because it differs from the reference, or uses other steps or other notation.
- Judge each line only on whether it follows from the line before it.
- Compare the final answers by value, not by how they are written. An equivalent form is a match.
- If the student's final answer is not equivalent to the reference's, say "no". If you cannot tell, say "unknown".`
