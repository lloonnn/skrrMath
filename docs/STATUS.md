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
| Day 2: answer region and course-code cleanup | Done as pure functions in `shared/src/blocks.ts` with tests (51 tests in `shared/` now). Not used by `web/` yet. Course-code pattern is a guess. Answers that continue onto the next page are not handled. |
| Day 3: marking display (version 2, per-line marks) | Built. `marking-service` now has a locate step (position only, boxes matched to lines by order, only when the counts are equal, 2 percent padding). Result lines have a `box`. `shared/src/marking-view.ts` has `lineMarks` (cross on the error, "follows" notes, a tick at the end of each run of good lines, a can't-read note). `web/` draws them beside the page image. Falls back to the one-note margin when any line has no box. Tests: 62 in `shared/`, 40 in `marking-service/`. Screenshot checked in headless Chrome on the demo. |
| Day 2: question blocks (paste version) | Built. A pasted image on the canvas is a question, numbered from the top. Course, year and paper come from the paper picked in the left list, so nothing is typed. The panel has one section per question with a Mark button. Logic in `shared/src/blocks.ts` (`blocksFromScene`, 71 tests in `shared/`). Checked in headless Chrome by dropping an image; real Ctrl+V, the tablet and pen strokes are not tried. Nothing is saved. Mark shows the saved demo example. Drawing a box on an imported PDF is not built. The left list is still made-up sample data. |
| Day 1: canvas | Excalidraw added to `web/` (`src/features/canvas/note-canvas.tsx`), light theme, no save or load. Build passes. Not seen in a browser by Claude. Pen feel on the tablet not tested. |
| Day 1: Supabase project and tables | Done. Dev project exists (keys in the owner's `.env`). Migrations 0001 and 0002 are applied: courses, years, pages, question_blocks, markings, all with access rules. `scripts/rls-test.mjs` (two temporary accounts, 21 checks) passes. Not tried: proving the test fails when the rules are off (blocked as a security risk, needs the owner's OK). |
| Day 1: Supabase sign-in | Built as a user box at the bottom of the left panel: Continue with Google, or email and password, Sign out. Email sign-in tested in headless Chrome (wrong password, sign-in, reload keeps it, sign-out). **Google sign-in is untested**: the owner must turn it on in Supabase (needs a Google Cloud OAuth client). Domain limit (`ALLOWED_EMAIL_DOMAIN`) not enforced yet. |
| Day 1: cloud save and tablet to laptop sync | Not started. The course list is still in this browser only. Canvas writing is lost on refresh. |
| `shared/` marking schema and fixtures | Done. Zod schema and rules in `shared/src/marking.ts`, four made-up fixtures in `fixtures/marking/`, 26 Vitest tests pass (`npm test` in `shared/`). Not yet imported by `web/` or `marking-service/`. |
| `marking-service/` | `demo` and `google` providers, pipeline, rules, limits and rate limit built. 30 Vitest tests pass with a mock model (`npm test` there). Demo mode smoke-tested by curl. The `google` provider ran twice live on page 2 (see `docs/TEST-LOG.md`): works, but the first error moved between runs (line 12, then line 10) because the minus on line 10 was read differently. About 32 s per marking. Cost not measured. The auth check is a dev token. `replit` provider built (same Google SDK with Replit's base URL), tests pass, never run on Replit. Supabase auth not built. |
| Tests (Vitest, Playwright) | Not set up |

## To do before the project is finished

- Remove the demo note in the marking panel ("Demo: marks a saved example page ... Nothing is sent to an AI."). It is in `web/src/features/marking/marking-margin.tsx`. The owner asked for this. The hosted demo may keep a short "Example only" note instead.

## Model access (2026-11-02)

- Replit's Gemini integration cannot be added to the new Replit app (no approval prompt appears). The `replit` provider is built but cannot be tested.
- On the owner's free Google key, only flash models work. `gemini-4-argon` and `gemini-3.1-pro-preview` need a paid plan (quota 0). `gemini-3.8-flash` was slow (146 s for one transcription) and returned a 503 once. The stability test on a stronger model is not done.
- The service now reports quota, busy and timeout errors as HTTP 502 with a message, and does not retry them. Each model call stops after 90 s.

## Notes on the Supabase setup

- Free-text names mean the shared bank (stage two) cannot match "Calculus II" to "MATH201". The bank needs a shared course code. Noted in `supabase/schema.sql`.
- `MARK_DEV_TOKEN` in the owner's `.env` is 3 characters long. Fine on a laptop only. Make it long before any public use.
- The marking service still uses the dev token. `MARK_AUTH=supabase` (check the Supabase token) is not built.
- Ids are made by the browser as real UUIDs (`web/src/lib/uid.ts`). Over plain http on a tablet `crypto.randomUUID` does not exist, which is why Add did nothing there before.

## Parked

- Replit run of the marking service. The Replit app `skrrmath-marking` is imported. Run command that works so far: `cd shared && npm install && cd ../marking-service && npm install && npx tsx src/server.ts`. It stops at "Gemini integration variables not present". Needed: connect the Gemini integration to that app (Connectors panel, or ask Replit Agent), and set secrets `AI_PROVIDER=replit`, `GEMINI_MODEL`, `MARK_DEV_TOKEN`. Then run page 2 several times (see task 2 below).

## Next tasks, in order

1. The owner tests pen feel in `web/` on the tablet (write, palm, pen-only, zoom, eraser). If it fails, reopen the choice. Then: save and load strokes, with Supabase (task 4).
2. Run the marking service on Replit and test the stronger model. The owner creates a new Replit app from this repo, adds the Gemini integration to it, and sets `AI_PROVIDER=replit`, `GEMINI_MODEL`, `MARK_DEV_TOKEN`. Replit Agent suggested `gemini-4-argon` as strongest (unverified by us, slower and costlier than Flash, not yet tested from Replit). Then rerun page 2 several times to see if the first error stays on line 12 (it moved to line 10 once on the local flash-lite model). If it still moves, add the two-read check. Then pages 1 and 4.
3. Cloud save: load and save the course list and each paper's canvas to the Supabase tables when signed in. Then test tablet to laptop. Guest mode is decided (see Decisions). When signed in, load and save to the cloud; when a guest, keep using the browser.
4. The owner asks Replit Agent to add a sign-in check and rate limit to the test endpoint (see below).

## Schema rules to confirm

Beyond the shape in `docs/MARKING.md`, `shared/` enforces these. They are my reading of that doc, not owner decisions:
- Line numbers run 1, 2, 3. A line is unreadable exactly when its verdict is `unreadable`.
- At most one `error` line, and it is `first_error_line`. No `error` after it (later lines use `follows_from_error`).
- Disagreeing solves mean status `unsure` and the final answer is "unknown".
- Only a `marked` result can judge the final answer.
- The label comes only from `reference_source`.
- Extra fields are rejected.
- Bank trust levels (stage two) are not modelled yet.
- An `unsure` result may still name a line error (only the final answer is not judged). Changed from my first version, which was stricter than `docs/MARKING.md`.

## Demo example is hand-set

`fixtures/marking/ode-page2-demo.json` is not a raw model result. Its transcription and boxes come from one real run on the owner's page 2 (model from `.env`, reported as flash-lite). Its verdicts were set by hand to the owner's expected reading in `docs/MARKING.md` (first error at line 12). The raw run put the first error at line 5, from a misread of line 5. So the lines "what it read" shows for lines 5 and 6 may be misreads. The label says "AI-checked". Do not present it as model output.

## Marking service rules in code

My choices, not owner decisions. Check them against real output:
- Line text always comes from the transcription step, never from the mark step.
- After the first error, other `error` lines become `follows_from_error`. Lines the model called `ok` stay `ok`. Plan day 3 says "not ok" lines convert; I convert only `error`.
- If a solve run fails, it counts as a disagreement (result is `unsure`).
- Two solves "agree" if the text matches after cleanup, or if one extra model call says they are equivalent. A failed or unsure check counts as different. Added after a live run falsely called two equal answers different.
- A line the model flags unreadable, or the transcription flags unreadable, is left unmarked.
- Every reply is validated by `shared/` before it is returned. A failed check becomes `unreadable`.
- Not done: the automated check that a transcription differs from a fixture's written line (`docs/MARKING.md`). It needs real page fixtures.
- Node here has no built-in TypeScript, so the service runs with `tsx`.

## Open questions for Replit Agent (owner is asking)

Needed before the `replit` provider can be written. Only Replit Agent can answer, because they concern the owner's Replit app. Paste the answers here. Never paste secret values.

1. Names of the environment variables the Gemini AI Integration sets (for example a base URL and a key).
2. The base URL format, and whether it uses the Google `@google/genai` SDK shape or an OpenAI-compatible shape.
3. The exact model names available, and which is strongest for reading handwritten maths from images.
4. Whether image input and a thinking level setting are supported through it.
5. Whether the marking service can run as its own Replit app with these variables, separate from the handwriting-extractor app.

Answers: not received yet.

## Decisions made

- 2026-11-02: the owner's tablet reports that it cannot hover, even with a mouse or pen cursor, so Tailwind's hover styles never showed. `web/src/index.css` now uses real `:hover` (`@custom-variant hover`) and gives buttons a hand cursor. Side effect: after a finger tap, the tapped item can stay highlighted until the next tap elsewhere. Tested by forcing "no hover" in headless Chrome, not on the tablet.
- 2026-11-02, owner: a touch screen has no hover (the styling library also turns hover styles off there), so pressed feedback is done by script. `web/src/lib/press-feedback.ts` marks the pressed button on touch and pen, and `web/src/index.css` styles it (grey, or fainter for the black buttons). A mouse still uses real hover. Tested with simulated touch only, not on the owner's tablet.
- 2026-11-02, owner: the right panel has a **Mark all** button (marks every question one after another, not at once, because real marking costs money and is rate limited). Names in the left list wrap onto a second line instead of being cut off, and the left list is 19 rem wide. Hover and pressed states on buttons and list rows are stronger (the shadcn `button.tsx` was edited for this). The marking state of each question now lives in the panel (`marking-margin.tsx`).
- 2026-11-02, owner: **guest mode**. Without an account the app works fully: the list and the canvas stay in this browser, and the demo Mark works (it calls no AI). Signing in is needed for saving online, syncing the tablet and the laptop, and real AI marking (each marking costs money). The switch is `MARK_NEEDS_SIGN_IN` in `web/src/features/marking/demo-marking.ts` (now false, because Mark is a demo). Set it to true when Mark is connected to the marking service. This changes `docs/PLAN.md` Day 1 (sign-in first). Decided (owner): when a guest signs in, the notes already in the browser are kept and uploaded to the account. Not built yet, it is part of cloud save.
- 2026-11-02, owner: the second level is called a **note** on screen, not "year". It can be a year, a tutorial, extra practice, or anything. Only the visible words changed. The code, the shared functions and the database still say "year" (`years` table, `addYear`). A later clean-up can rename those. Not retested beyond the build and the shared tests.
- 2026-11-02, owner: the paper level is removed. The list is course, then year. A year is the note you write in. Migration `supabase/migrations/0002_note_is_year.sql` is applied (the `papers` table is gone and a page belongs to a year). The add box is full width with short placeholders ("Course", "Year"). Limit: one note per course and year, so Paper 1 and Paper 2 of one year share a canvas unless the owner adds the level back or names years like "2023 P1".
- 2026-11-02, owner: the left list is real, not sample data. Add a course, a year and a paper. Names are free text (up to 40 letters, no duplicates in the same place): "Calculus II", "2023/24", "Semester 1". Course codes are no longer forced to look like MATH201, and years are no longer forced to be 4 digits (owner decision). Buttons are 40 px on touch screens, 24 px with a mouse (a note canvas), with + buttons. A ⋯ menu per row renames or deletes. Each paper keeps its own canvas while the page is open. The list is saved in this browser only (`localStorage`), not synced. Canvas writing is lost on refresh. The mock folders, "New paper", "Notes", Settings, Help and the placeholder user were removed. Structure is course, year, paper only. Free folders stay out of scope (`CLAUDE.md`). The right panel's resize grip is wider so a finger can grab it (touch drag tested with simulated touch, not on a real tablet).
- 2026-11-02, owner: the right panel can be resized by dragging its left edge (min 280 px, max 760 px, default 360 px; not saved between visits). The "New paper" button and the "Notes" list (Blank notes, Scratch pad) were removed from the left sidebar because they did nothing. Settings and Help remain and do nothing. Courses and papers cannot be added yet: the list is made-up sample data until sign-in and storage exist.
- 2026-11-02, owner: the label for an AI-only mark is "AI-checked" (was "Not verified"). It does not mean correct. "Verified by AI" was rejected as misleading. Rules in `CLAUDE.md`, `docs/MARKING.md` and the tests were changed to match.
- 2026-11-02, owner: the right panel opens and closes with a button in the header. That replaces the hide-marks button and the eye icon. Closing the panel hides the marks and keeps them for when it reopens. Marks sit on the page image beside each line. The panel is white and full height. The reference answer is shown as maths (KaTeX, MIT) when the student's answer does not match: "Expected answer" for an AI reference (the "AI-checked" label sits under it), "Correct answer" for a verified one.
- MVP is plan days 1 to 5. The shared course bank is stage two. It is cut if behind on day 6.
- Math is the demo subject. Answers are handwritten. Theory and handwritten code come later.
- Marks look like a teacher with a red pen in the margin, with a hideable marking layer. No chat panel, badges or cards.
- Every mark says how it was produced. "AI-checked" unless it was marked against a verified answer. The owner said not to worry if nobody verifies answers.
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
