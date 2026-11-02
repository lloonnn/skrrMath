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
| `shared/` marking schema and fixtures | Done. Zod schema and rules in `shared/src/marking.ts`, four made-up fixtures in `fixtures/marking/`, 26 Vitest tests pass (`npm test` in `shared/`). Not yet imported by `web/` or `marking-service/`. |
| `marking-service/` | `demo` and `google` providers, pipeline, rules, limits and rate limit built. 30 Vitest tests pass with a mock model (`npm test` there). Demo mode smoke-tested by curl. The `google` provider ran twice live on page 2 (see `docs/TEST-LOG.md`): works, but the first error moved between runs (line 12, then line 10) because the minus on line 10 was read differently. About 32 s per marking. Cost not measured. The auth check is a dev token. `replit` provider built (same Google SDK with Replit's base URL), tests pass, never run on Replit. Supabase auth not built. |
| Tests (Vitest, Playwright) | Not set up |

## Next tasks, in order

1. The owner tests pen feel in `web/` on the tablet (write, palm, pen-only, zoom, eraser). If it fails, reopen the choice. Then: save and load strokes, with Supabase (task 4).
2. Run the marking service on Replit and test the stronger model. The owner creates a new Replit app from this repo, adds the Gemini integration to it, and sets `AI_PROVIDER=replit`, `GEMINI_MODEL`, `MARK_DEV_TOKEN`. Replit Agent suggested `gemini-4-argon` as strongest (unverified by us, slower and costlier than Flash, not yet tested from Replit). Then rerun page 2 several times to see if the first error stays on line 12 (it moved to line 10 once on the local flash-lite model). If it still moves, add the two-read check. Then pages 1 and 4.
3. Supabase: the owner creates a project and puts the URL and anon key in a local `.env`. Then sign-in and save and load of one page, tested tablet to laptop.
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
