# Marking

How the AI marks a question block. This is a design. It has not been tested beyond a first Replit demo that marked one page.

## Goals

- Mark like a teacher with a red pen, not like a list of checks.
- Be honest about what is verified and what is not.
- Say "I can't tell" instead of judging when unsure.

## Why these rules

Studies on AI marking of handwritten maths (see the notes in the knowledge-base repo) report that models mostly fail at reading handwriting and at finding the wrong step in faulty work. They suggest a reference solution and a transcribe-first step. This design follows both. The studies used older models, and the claim is not tested on this app.

## Input

- The question block image (the question).
- The answer region image (your handwriting below the block, up to the next block).
- Optional verified answer: handwriting, an image or text, from the user or the shared bank.
- Tags: course code, exam year, question number.

## Pipeline

1. **Transcribe.** Restate the question. Copy the answer line by line, as LaTeX. Flag any line the model is unsure it read. Do not mark yet.
2. **Reference.**
   - If a verified answer exists, use it.
   - If not, solve the question independently `MARK_SOLVE_RUNS` times (default 2), without looking at the student's work. If the final answers disagree, the status is "unsure": do not judge the final answer.
3. **Check the lines.** For each readable line, decide whether it follows from the previous line. This check does not need the reference.
4. **Mark like a teacher.**
   - Find the first line that does not follow. That is the error. Name its type: sign, algebra, missing condition, notation or other.
   - Later lines that are consistent with the wrong line are "follows from the error", not new errors.
   - Say whether the method is right even if the answer is wrong.
   - Compare the final answer with the reference.
   - A different route to the same answer is fine if each step is valid.
5. **Short comment.** One short line per error. One short summary line.

## Output (JSON the app draws on the page)

```json
{
  "status": "marked | unsure | unreadable",
  "question_restated": "string",
  "lines": [
    {
      "n": 1,
      "latex": "string",
      "readable": true,
      "verdict": "ok | error | follows_from_error | skipped_step | unreadable | not_checked",
      "comment": "short string or empty",
      "correct_latex": "string or null"
    }
  ],
  "first_error_line": 12,
  "error_type": "sign | algebra | missing_condition | notation | other | null",
  "final_answer": {
    "matches_reference": "yes | no | unknown",
    "student_latex": "string",
    "reference_latex": "string or null"
  },
  "method_ok": true,
  "reference_source": "verified_bank | verified_user | ai_solved",
  "solve_runs_agree": true,
  "summary": "one short line",
  "model": "string"
}
```

## On the page

| Verdict | What the student sees |
|---|---|
| ok | a tick in the margin (can be shown only at the end of a run of good lines) |
| error | a cross and the short comment in red pen |
| follows_from_error | a small "follows from the error" note |
| skipped_step | a faint, soft note |
| unreadable | "can't read this line, please check", line left unmarked |

Label under the block:
- "Not verified" when `reference_source` is `ai_solved`.
- "Checked against your answer" for a user's own reference.
- The bank's trust level for a bank answer (stage two).

The "what it read" link opens the transcription so the student can fix a misread and mark again. The marking layer can be hidden.

## Per-line marks

Version 1 puts one margin comment per block, with a tick or cross for the whole answer. Version 2 places marks beside each line. Version 2 needs the model to say where each handwritten line is on the image.

Tested on 2026-11-01 on one page (the owner's page 2): Gemini returned 17 boxes in `[ymin, xmin, ymax, xmax]` on a 0 to 1000 scale, one per handwritten line, in order, and every box sat on the right line (see `img/locate-overlay-page2.png`). Small flaws: two boxes overlapped vertically where fractions were stacked, and one box clipped the right edge a little. So version 2 looks feasible. Add a margin of a few percent to each box, and test on more pages before relying on it.

## Transcription must be literal

On the same page, the line-locating call returned text in which the student's sign slip was silently corrected (the page says +3 ln, the returned text says -3 ln). The plain transcription call kept the sign as written. A marker that corrects the student while reading cannot find the student's mistake. Rules:
- The transcription prompt says: copy exactly what is written, including errors. Never correct, simplify or complete anything.
- Do not use the text returned by a locating call as the transcription for marking. Use the boxes only for position, and match each box to a line of the literal transcription.
- Automated test with the mock model: a transcription that differs from the fixture's written line fails the pipeline check.
- Manual test: page 2 must transcribe line 12 as `+3 ln|x|` and line 17 as `+ 8x^3` with the plus sign on the log term. Record pass or fail in `TEST-LOG.md` each time the prompt changes.

## Question types

- **Final answer:** check the working and the answer.
- **Proof:** no final answer. Check that each step follows, and note skipped steps softly.
- **Theory and handwritten code:** out of scope.

## Test cases

Use the author's own handwritten pages. The question was cropped out of the originals, so crop the question back in before testing.

| Page | Content | Expected result (author's reading, not machine-verified) |
|---|---|---|
| 1 | Induction: 5 divides 7^n - 2^n | status marked, all lines ok, method ok, no error |
| 2 | ODE x y^2 dy/dx = y^3 - x^3, y(1) = 2 | first error where u^3 = -3 ln\|x\| + C becomes (y/x)^3 = +3 ln\|x\| + C. Later lines follow_from_error. Method ok, answer wrong. Reference answer y^3 = -3x^3 ln\|x\| + 8x^3 |
| 4 | Symmetric A, eigenvectors orthogonal | marked, all ok. Soft note that A v2 = lambda2 v2 is used but not stated |

Open point from page 2: one line may say du/dx or dy/dx. The Replit demo read du/dx. Look at the page and decide what the expected result is.

Also test: a correct solution that uses different steps from the reference. It must not be marked wrong.

## Cost

Up to four calls per marking when no verified answer exists if every step is separate (transcribe, solve twice, mark). Steps can be merged to cut calls. Measure on the usage page. The demo was about 0.01 per call, unit not confirmed.

## Speed

- The transcription step can use a low thinking level, because it only copies what it sees.
- The solve and mark steps probably need more thinking to be accurate. Keep it higher there, and measure the time and the accuracy together.
- Send images no larger than needed (longest side about 1600 px).
- Show progress in the interface (reading, solving, marking), because a full marking may take longer than a single transcription.
- Measured so far: the Replit test service took 24 s to transcribe the owner's page 2 before any changes. Replit Agent then lowered the thinking level and added image resizing, and reported 4.7 s to 2.3 s on a blank test image only. That is not a benchmark. Re-measured on 2026-11-01 with the real page 2 on the republished app: 5.3 s and 3.9 s (two calls). This is for the transcription step only. The solve and mark steps are not measured yet.
- Gemini 3.8 Flash, as reported by Agent, supports a lowest level of LOW and cannot turn thinking off. Even at LOW it reported thinking tokens. Not verified by us.

## Limits

- The AI can misread handwriting. That is why the transcription is shown on request.
- Two agreeing AI solutions are still not proof of a correct answer. The label stays "Not verified".
- Not tested on messy pages, diagrams, or other subjects.
