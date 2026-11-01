# skrrMath

A note-taking web app where a student writes past-year paper answers by hand and an AI marks them in the margin. Read README.md first. Details are in docs/.

## Tools

Claude Code builds this project locally. Replit is used only to run the model API, as a small marking service. Do not move the main app into Replit unless the owner asks. The marking service must also run without Replit, with `AI_PROVIDER=google` and a Google AI Studio key, so anyone who clones the repo can run it. Keep the Replit path behind the `AI_PROVIDER` setting. `AI_PROVIDER=demo` must never call an AI. It returns saved example results from a fixtures folder. Fixtures use the owner's own work or made-up questions, never text copied from the school's papers. The hosted prototype runs in demo mode.

## Status

Planning stage. No code yet. Every tech choice is proposed. Ask before changing a decision in docs/.

## Scope rule

Keep the project as an MVP. Build days 1 to 5 of docs/PLAN.md first. The shared course bank (days 6 and 7) is stage two. If behind on day 6, cut the bank and ship the MVP.

In: basic note canvas, question blocks, marking with a label, a verified-answer area, PDF export, sign-in and cloud sync.
Out: a general chatbot, shapes, lasso, handwriting-to-text, folders, templates, theory-question marking, handwritten-code marking.

## Rules

- Marking must say what it is. Every mark shows "Not verified" unless it was marked against a verified answer. Never present AI marking as certain.
- If the AI cannot read a line or is unsure, it says so and does not judge that line.
- Follow docs/MARKING.md for how marking works. Mark the first error, then mark later lines as "follows from the error".
- The model is one setting (`GEMINI_MODEL`). Do not hard-code a model name in many places.
- Handwriting is stored as strokes, not typed text. The AI transcription is a temporary step. It is shown only behind "what it read".
- UI: paper look, red-pen margin marks, a marking layer that can be hidden. No gradients, badges, sparkle icons, chat bubbles or "AI" labels.
- Secrets: `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` live only on the server. Never put them in browser code, logs or commits. Only `.env.example` is committed.
- Private data (notes, papers, markings) is visible only to its owner. Use database access rules on every table. Test them with two accounts.
- The shared bank stores tags and answers only. Never store paper images in a shared table.
- Do not store or share the school's papers in a public place.
- Diagrams are Mermaid code blocks. Never draw ASCII diagrams.
- Write plain, direct, short sentences in docs and comments. State limits. Mark guesses as guesses.
- Do not invent facts about libraries, prices or limits. Check the docs and say when something is unchecked.

## Commands

To be filled in when the project is scaffolded: install, run, test, build, deploy.

## Git

Do not run `git commit` or `git push`. Leave changes uncommitted for the owner to review.

## Open decisions

See "Open decisions" in docs/ARCHITECTURE.md. Do not close one without the owner's answer.
