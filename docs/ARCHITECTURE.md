# Architecture

How the built app fits together. Checked against the code on 2026-11-06.

## Parts

```mermaid
flowchart TB
  subgraph Browser["Browser on tablet or laptop"]
    Canvas["Note canvas (Excalidraw)"]
    Blocks["Question blocks and correct-answer boxes"]
    Export["PDF export"]
    Marks["Marking layer and what it read"]
    Lect["Lecturer screen"]
  end
  subgraph Supa["Supabase"]
    Auth["Sign-in"]
    DB["Tables with access rules"]
  end
  subgraph Server["Marking service (Node, one endpoint)"]
    Mark["api mark: check sign-in, rate limit, call the model"]
  end
  Gemini["Gemini"]
  Browser -->|"sign-in, notes, lecturer books"| Supa
  Browser -->|"mark request: images, context, optional book"| Mark
  Mark -->|"verify the user's token"| Auth
  Mark -->|"prompts and images"| Gemini
  Gemini -->|"JSON"| Mark
  Mark -->|"progress and result"| Browser
```

## The marking call

```mermaid
sequenceDiagram
  participant B as Browser
  participant S as Marking service
  participant A as Supabase Auth
  participant G as Gemini
  B->>B: look up a lecturer book for this course and note name
  B->>S: POST api mark with images, optional book, user token
  S->>A: verify the token
  S->>S: rate limit and size check
  S->>G: locate the handwritten lines
  S->>S: cut one picture per line
  S->>G: read all line pictures
  S->>G: solve twice and compare, unless a reference exists
  S->>G: mark
  S->>S: apply the rules and check the JSON against the shared schema
  S-->>B: progress lines, then the marking result
  B->>B: save the marks with the note and draw them
```

The reply streams as NDJSON so the app can show progress. How each step works is in MARKING.md.

## Parts in words

- **Canvas.** Excalidraw supplies pen, eraser, undo, zoom, scroll, text and image paste. Handwriting is stored as strokes, not text.
- **Question block.** A pasted question picture. The answer region is everything written below it, up to the next block.
- **Correct-answer box (optional).** Typed text or a picture, on a block.
- **Lecturer answer book.** One per paper (course code and exam). Text up to 30000 characters, or one picture. A signed-in student's Mark finds it by course name and note name, cleaned the same way on both sides (`shared/src/question-key.ts`). If a book is found it is used first, then the student's own correct answer, then the AI solves the question itself.
- **Marking service.** `marking-service/`, a small Node server. It can run anywhere with a Google AI Studio key. Replit is an optional way to pay for the model. `AI_PROVIDER=demo` never calls an AI.
- **Shared.** `shared/` holds the marking result shape and the key cleaning, used by both the app and the service.
- **Supabase.** Sign-in and the tables below.

## Data

Migrations are in `supabase/migrations/` (run in order). Every table has access rules.

| Table | Holds | Who can see it |
|---|---|---|
| courses, years | the user's list. A year is the note. Free-text names | owner only |
| pages | the note: strokes, images, saved marks and correct answers (JSON) | owner only |
| papers, question_blocks, markings | created by migration 0001, not used by the app yet | owner only |
| profiles | role: student or lecturer. No one can write it from the app | own row only |
| bank_solutions | the lecturer's answer books, with version and withdrawn flag | every signed-in user reads live books. Only the author (a lecturer) changes or withdraws. No delete |
| app_secrets, lecturer_claim_attempts | the lecturer code hash and the tries | nobody from the app |

A person becomes a lecturer by giving the code from `.env` to the database function `claim_lecturer`. Five wrong tries in an hour lock that person for an hour, and 30 wrong tries by everyone lock everyone.

Without an account, the list is kept in `localStorage` and the writing in IndexedDB, in that browser only. When the person signs in, the guest notes are uploaded.


## Flows

**Open a note.** A guest works in the browser only. A signed-in user loads their notes from Supabase and saves after a short pause (latest save wins).

**Mark.**
1. The browser renders the question and the answer region to images.
2. It looks up the lecturer book, or uses the student's own correct answer.
3. The service marks (see MARKING.md) and the result is drawn in the margin and saved with the note.
4. Real marking needs sign-in. Without it, Mark shows a saved example.

**Export.** Each page is drawn with or without the marks, then built into a PDF in the browser (jsPDF).

## Security

- Row-level access rules on every table. Tested with temporary accounts by `scripts/rls-test.mjs` and `scripts/bank-rls-test.mjs`.
- The service role key and the AI key stay on the server and in `.env`. Only the Supabase URL and the anon key reach the browser.
- The marking service verifies the user's Supabase token and fails closed. It rate-limits each user.
- A lecturer book is readable by every signed-in student. It holds solutions only, never a paper image.
- Do not log image contents or answers.

## Providers

```mermaid
flowchart TD
  S["Marking service gets a request"] --> P{"AI_PROVIDER"}
  P -->|"demo"| D["Saved example result"]
  P -->|"google"| K["Gemini with GEMINI_API_KEY"]
  P -->|"replit"| R["Gemini through Replit AI Integrations, owner only"]
```

## Cost and speed (not measured)

A normal marking makes about five model calls (locate, read the lines, solve twice, mark). Cost per marking has not been measured. Free-tier limits of Gemini and Supabase have not been checked. Google's free tier has returned 429 and 503 errors during tests.

## Risks

1. Reading messy handwriting (the largest one).
2. Correct work with different steps marked wrong.
3. A wrong book is used by every student until the lecturer fixes or withdraws it. Students are not told when a book changes.
4. Sync conflicts if two devices edit one note at once. Latest save wins.
5. Storage limits and the school's terms about papers and solutions (not checked).
