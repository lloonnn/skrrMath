# Plan

One person, a self-set target of 8 days. Day 5 is the cut line. Days 1 to 5 are the MVP. Days 6 and 7 are stage two.

## Before day 1 (about half a day, optional but useful)

- Ask Replit Agent to add Gemini and check it says "(Replit managed)". A demo already worked once.
- Check Supabase free-tier limits for storage and rows.
- Read the school's terms on storing past papers on a server.
- Test whether Gemini can return the position of each handwritten line on page 2. This decides per-line marks.
- Test stylus writing in the tablet browser with the chosen canvas library.

## Days

| Day | Work | Done when |
|---|---|---|
| 1 | Replit project. Supabase sign-in. Canvas with pen, eraser, undo, zoom, scroll. Save and load a page. | A page written on the tablet reopens on the laptop. |
| 2 | PDF import (pdf.js) to private storage. Question blocks from a pasted crop or a box on a PDF page, with course, year and question number. | A block can be made and saved from both sources. |
| 3 | Marking. Send block and answer region to the server function. Run the pipeline in MARKING.md. Draw margin marks and the "Not verified" label. Save results with the paper. | Page 2 shows one cross and "follows from the error" below it. |
| 4 | Verified-answer area per block (handwriting, image or text). Marking uses it when present, and the label changes. | A block marked with and without a verified answer shows different labels. |
| 5 | PDF export of the marked paper. | The PDF shows the writing and the marks. **MVP done. Cut line.** |
| 6 | Shared bank. Table, save an answer, look up by course, year and question number on mark. | A second account gets the first account's answer as reference. |
| 7 | Trust levels, report button, tag clean-up (course drop-down), test with a few friends. Test access rules with two accounts. | No account can read another's private notes. |
| 8 | Fix the worst bugs. README setup steps. Deploy. | A deployed link works on the tablet. |

## If behind

1. Drop typing in the verified-answer area, then pasted images.
2. Drop PDF export.
3. On day 6, skip the bank and ship days 1 to 5.

Never skip the "Not verified" label or the access rules.

## Hardest days

- Day 3: working out where one answer ends and the next block starts, and drawing marks that look like a pen.
- Day 6: sign-in, access rules and wrong answers shared across a class.
