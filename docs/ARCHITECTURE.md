# Architecture

Everything here is proposed. Nothing has been built except a throwaway marking demo made in Replit.

## Parts

```
 Browser (tablet or laptop)
 ┌──────────────────────────────────────────────┐
 │ React app                                    │
 │  - note canvas (pen, text, eraser, undo)     │
 │  - question blocks + verified-answer areas   │
 │  - PDF import (pdf.js) / PDF export          │
 │  - marking layer (red pen) + "what it read"  │
 └───────────────┬───────────────┬──────────────┘
                 │               │
        sign-in, notes,      mark request
        files, bank          (image + context)
                 │               │
        ┌────────▼───────┐ ┌─────▼──────────────┐
        │ Supabase       │ │ Server function     │
        │ auth, tables,  │ │ holds the AI key,   │
        │ storage        │ │ calls Gemini,       │
        └────────────────┘ │ returns marking JSON│
                           └─────────────────────┘
```

## Parts in words

- **Canvas.** An existing drawing library supplies pen, eraser, undo, zoom, scroll, text and image paste. Not chosen. Check licences and tablet feel.
- **Question block.** A pasted crop or a box drawn on an imported PDF page. It carries course code, exam year and question number. The answer region is everything written below the block, up to the next block.
- **Verified-answer area.** A second writing area on a block. Handwriting, a pasted image or typed text.
- **Server function.** Receives the block image and answer region, the optional verified answer, and the course tags. Calls Gemini. Returns the marking result. The AI key never reaches the browser.
- **Supabase.** Sign-in, private tables for notes, files in private storage, and the shared bank table.

## Data

Draft tables are in `supabase/schema.sql`. Summary:

| Table | Holds | Who can see it |
|---|---|---|
| papers | imported PDF info, file path, course and year | owner only |
| pages | strokes (JSON) per page | owner only |
| question_blocks | block position, tags, optional own reference | owner only |
| markings | marking result (JSON), status, label | owner only |
| bank_answers | tags, answer, who added, trust level | all signed-in users read, author edits |
| bank_confirmations | who confirmed an answer | signed-in users |
| bank_reports | reports of wrong answers | reporter and admin |

Files: PDFs and pasted images go to private storage under the owner's id. The shared bank never holds paper images.

## Flows

**Open a note.** Sign in. Load pages and blocks for the paper. Draw strokes on the canvas.

**Mark a block.**
1. The browser renders the block and its answer region to one image.
2. The server function receives it with any verified answer.
3. The AI transcribes, then solves or compares, then marks (see MARKING.md).
4. The result is saved to `markings` and drawn on the marking layer.

**Look up the bank (stage two).** On "mark", look up course, year and question number. If a bank answer exists, send it as the reference and show its trust level. If not, mark by AI reasoning and show "Not verified".

**Export.** Render each page with the marking layer to an image, then build a PDF in the browser.

## Security

- Row-level access rules on every table. Private tables: owner only. Test with two accounts.
- Service role key and AI key stay on the server.
- Optional email-domain limit on sign-in.
- Rate limit the mark endpoint. Each marking costs money.
- A report button on bank answers. Show who added each answer and how it was checked.
- Do not log image contents or answers.

## Hosting

Replit or Vercel. Replit AI Integrations are billed to Replit credits and the docs describe them for Replit apps. Calls from an app on Vercel probably need your own Google AI Studio key. Not tested.

## Cost and speed (not verified)

The Replit demo cost about 0.01 per marking call (unit assumed to be dollars). The planned flow uses up to four calls when no verified answer exists, so up to about 0.04. Check the usage page.

## Risks

1. Reading messy handwriting.
2. Where one answer ends and the next block starts.
3. Correct work with different steps marked wrong.
4. Sync conflicts if two devices edit one page at once. Plan: autosave after a short pause, latest save wins.
5. Storage limits and the school's terms.
6. Overlap with Goodnotes Math Assist and with paper-marking apps.

## Open decisions

- Canvas library (tldraw or Excalidraw or other). Licence unchecked.
- Replit or Vercel hosting.
- Replit AI Integrations on this account, or a Google AI Studio key.
- Google sign-in, and whether the school uses Google accounts.
- Store the PDF privately (option A) or re-import from the portal each time (option B). Option A planned.
- Whether per-line marks are possible. Needs a test of Gemini locating handwriting lines.
- Free-tier limits for Supabase and Gemini.
- App name and licence.
