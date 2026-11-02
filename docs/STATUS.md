# Status

Last updated: 2026-11-01. Update this file at the end of every work session. Read it first.

## What this is

skrrMath: a note-taking web app where a student writes past-year paper answers by hand and an AI marks them in the margin. See `README.md` for the problem and solution, `docs/PLAN.md` for the plan and tests, `docs/MARKING.md` for how marking works.

The idea started in a separate knowledge-base repo at `/home/sl/Desktop/vscfile/idea-kb` (hackathon note `hackathons/gdg-apu-domain-2-intelligent-automation.md`, problem `problems/past-paper-corrections-lost-in-ai-chat.md`, spark `sparks/2026-10-30-notetaking-app-ai-marks-past-papers.md`). The hackathon is closed to the owner, so this is a solo personal project. Read those only if you need the history.

## Where we are

| Item | State |
|---|---|
| Docs, plan, mockup, draft schema | Done and pushed |
| Folder structure | Done |
| Day 0 check: Replit credits for a separate service | Passed. Calls were charged to Replit credits. |
| Day 0 check: Gemini can locate handwritten lines | Passed on one page |
| Day 0 checks: Supabase limits, school terms | Skipped by the owner |
| Day 1: sidebar in `web/` | Done (sidebar only, light mode, made-up sample data). Build passes. Not seen in a browser by Claude. |
| Day 1: canvas | Excalidraw added to `web/` (`src/features/canvas/note-canvas.tsx`), light theme, no save or load. Build passes. Not seen in a browser by Claude. Pen feel on the tablet not tested. |
| Day 1: Supabase sign-in, save and load, tablet to laptop sync | Not started. No Supabase project exists yet. |
| `shared/` marking schema and fixtures | Not started |
| `marking-service/` | Not started |
| Tests (Vitest, Playwright) | Not set up |

## Next tasks, in order

1. The owner tests pen feel in `web/` on the tablet (write, palm, pen-only, zoom, eraser). If it fails, reopen the choice. Then: save and load strokes, with Supabase (task 4).
2. `shared/`: the marking result schema from `docs/MARKING.md` with validation, made-up fixtures, and tests.
3. `marking-service/`: `demo` and `google` providers, the pipeline rules, tests with a mock model. Add the `replit` provider later.
4. Supabase: the owner creates a project and puts the URL and anon key in a local `.env`. Then sign-in and save and load of one page, tested tablet to laptop.
5. The owner asks Replit Agent to add a sign-in check and rate limit to the test endpoint (see below).

## Decisions made

- MVP is plan days 1 to 5. The shared course bank is stage two. It is cut if behind on day 6.
- Math is the demo subject. Answers are handwritten. Theory and handwritten code come later.
- Marks look like a teacher with a red pen in the margin, with a hideable marking layer. No chat panel, badges or cards.
- Every mark says how it was produced. "Not verified" unless it was marked against a verified answer. The owner said not to worry if nobody verifies answers.
- A verified-answer area per question: handwrite, paste an image, or type.
- Handwriting is stored as strokes. Notes must sync between the owner's tablet and laptop, so cloud storage and sign-in are needed from the start.
- Model: Gemini, kept as one setting. Marking steps: transcribe literally, solve independently twice, mark the first error, mark later lines as following from the error.
- `AI_PROVIDER` is `demo`, `google` or `replit`. The repo must run without Replit. The hosted prototype runs in demo mode with saved example results and no AI calls.
- Claude Code builds everything. Replit is only an optional way to run the model API on the owner's credits.
- UI: shadcn/ui, light mode only for now.

## Canvas choice

- Excalidraw 0.18.1 (MIT), chosen by the owner on 2026-11-02 without a tablet test. The test page was deleted.
- tldraw 5.6.0 was rejected. Its licence (checked 2026-11-01) allows development use only and bars production use without a key. That blocks the hosted demo and public clones. Not checked: whether a free key exists.

## Replit test service (the owner's)

- URL: `https://handwriting-extractor.replit.app`
- `POST /api/test` with JSON `{ "imageBase64": "...", "mimeType": "image/jpeg" }` returns `{ "text": "..." }`. Transcription as LaTeX, kept as written.
- `POST /api/locate`, same body, returns a JSON array of `{ text, box_2d }` with `box_2d` as `[ymin, xmin, ymax, xmax]` on a 0 to 1000 scale.
- Model reported by Replit Agent: `gemini-3.8-flash` with thinking at `LOW`. Not verified by us.
- Measured on the owner's page 2: 24 s before speed changes, then 5.3 s and 3.9 s. `/api/locate` took 9.9 s.
- Each call is charged to the owner's Replit credits (about 0.01, unit not confirmed). Do not call it more than needed.
- It has no sign-in and no rate limit yet. Anyone with the URL can spend the credits.
- Finding: `/api/locate` silently corrected the student's sign slip in its text. The literal transcription must say to copy exactly and never correct. See `docs/MARKING.md`.

## Test data

`docs/img/` has the owner's five handwritten pages. `WhatsApp Image 2026-10-30 at 22.38.56 (2).jpeg` is the ODE page (page 2 in the docs) and contains a real sign slip at the line `(y/x)^3 = 3 ln|x| + C`. The other four are the induction proof, a rook-polynomial counting page, an eigenvector proof, and a queueing formula sheet. The file-to-page mapping for those four is not confirmed. `docs/img/locate-overlay-page2.png` shows the line boxes. Move chosen files to `fixtures/images` with clear names. Test data must be the owner's own work or made-up, never text from school papers.

## Known issues

- `npm run lint` in `web/` reports one error in shadcn's generated `src/hooks/use-mobile.ts`. Not project code.
- Pressing `d` toggles dark mode (generated theme provider). Light only is the intent.
- The draft `supabase/schema.sql` is not applied or tested. Access rules must be tested with two accounts.

## How to work with the owner

- Show diagrams as Mermaid. The one exception is the folder tree in the README, which is plain text.
- Write plain, direct, short sentences. Give a recommendation, not a list of options.
- Do not over-hedge. Accept facts the owner gives. Flag a doubt only when it would change a decision or cost money.
- Do not commit or push unless asked. Never put keys in chat, files or commits.
