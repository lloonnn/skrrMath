# skrrMath

A note-taking web app for practising past-year exam papers by hand, with AI marking on the page.

Status: working prototype. Notes, handwriting, AI marking, PDF export, sign-in with cloud sync and lecturer answer books are built and tested. A demo you can open in the browser is hosted (see [Try the demo](#try-the-demo)). Reading messy handwriting is still the weak spot. Built with Claude Code.

## Try the demo

**Demo: https://YOUR-DEMO-ADDRESS** (add the address after deploying)

The hosted demo is a mock version, so anyone can try it safely:
- Write or paste a question on the canvas and press **Mark**. You get a saved example marking, not a live one. No AI is called, so there is no cost and no key.
- Nothing is uploaded. Your notes stay in your own browser, and there is no sign-in.
- Live AI marking, sign-in with cloud sync and lecturer answer books need your own setup. See [Setup](#setup).

## Problem

When preparing for examinations, students practise with past-year papers. The usual routine is to work through a paper in a note, then take a screenshot or export a PDF and upload it to an AI chatbot to check the answers.

This routine has two weaknesses.

1. **Chats become cluttered.** Students often upload several past papers into the same conversation. The corrections for one paper end up buried among the solutions to others, and finding a particular correction later means scrolling back through the whole chat.
2. **Lecturers cannot mark everything.** As an examination approaches, many students ask their lecturers to check their answers. Lecturers do not have the time to mark the work of every student within such a short period.

## Solution

skrrMath is a note-taking web app built for practising past-year papers. Students import a paper or paste a cropped question, write their answer by hand directly beneath it, and press "mark". The AI then marks the answer on the page in the way a teacher would: a tick or a cross in the margin, with a short comment beside the first mistake. The corrections are saved with the paper itself.

How this addresses the problems:

- **No more upload and scroll.** Students write and mark in the same place. The correction stays beside the answer it belongs to, and each paper keeps its own corrections.
- **Immediate feedback without waiting for a lecturer.** Students can check their work at any time. This eases the pressure on lecturers near an examination.
- **Honest marking.** Every mark states how it was produced. "AI-checked" means the AI marked from its own reasoning. When a verified answer exists, the AI marks against it and the label changes. The app is a study aid and does not replace a teacher.

## Features

- A note canvas (Excalidraw) with a pen, text box, eraser, undo, zoom and scroll.
- Notes are organised as course, then a note per paper (the name is free text, like "2023 May").
- Paste a cropped screenshot of a question, then write the answer by hand below it.
- Marking in the margin, in red pen. The AI reads each line of the handwriting, finds the first error, names the type of mistake, and marks later lines that follow from it as such. It says whether the method was right. **Mark all** marks every question in a note.
- A marking layer that can be hidden, so the student can redo a question. Marks are saved with the note.
- A "what it read" view that shows how the AI read the handwriting, so a misreading can be seen.
- An optional "Correct answer" box for each question (typed or a picture).
- Export to PDF, with the marks or clean.
- Sign-in (email or Google) and cloud sync, so notes are the same on a tablet and a laptop. Without signing in, notes stay on the device and Mark shows a saved example.
- Lecturer answer books: a lecturer adds one answer book per paper (course code and exam). A student's Mark finds it by the course name and the note name, and the AI marks against it. The label says "Checked against a lecturer's solution". With no book, the AI solves the question itself and the label is "AI-checked". See "For lecturers" below.

Not built yet: PDF import of a whole paper, student confirmations and reports for shared answers, handwritten code and theory questions. The first subject is mathematics.

## Not included

- A general chatbot.
- A full note-app toolset such as shapes, lasso selection, handwriting-to-text, folders and templates.
- Official grades. Marks are for practice only.

## Stack

| Part | Proposed |
|---|---|
| App | React and TypeScript web app |
| Interface components | shadcn/ui, light mode. The left sidebar starts from the `sidebar-08` block, adapted to a course, year and paper tree. App name: skrrMath. |
| Canvas | Excalidraw (MIT licence) |
| PDF export | Pages drawn to images, then built with jsPDF |
| Maths in comments | KaTeX |
| AI model | Gemini, kept as one setting (`GEMINI_MODEL`) |
| Model access | A small marking service with three modes. The hosted demo runs in demo mode and returns saved example results, with no AI call. Real marking needs your own key. In real use it calls Gemini with a Google AI Studio key, so anyone can run it. The owner can switch it to Replit AI Integrations (billed to Replit credits) on their own Replit app. |
| Sign-in, database, files | Supabase |
| App hosting | Not decided |

Claude Code builds the project. The hosted demo shows saved example results only, and real marking requires your own Gemini API key. Replit is an optional way for the owner to run the model API. The project does not require Replit.

## Repository structure

| Folder | Purpose |
|---|---|
| `web/` | The browser app: React, TypeScript, Vite, shadcn/ui. Features are split by folder under `src/features`. |
| `marking-service/` | The small server with one endpoint, `POST /api/mark`, and the `demo`, `google` and `replit` model modes. |
| `shared/` | The marking result shape and validation, used by both `web` and `marking-service`. |
| `fixtures/` | Made-up or own-work test and demo data. No school paper content. |
| `supabase/` | Database migrations (applied in order). |
| `e2e/` | Browser tests, off by default. Each file says how to run it in its first lines. |
| `scripts/` | Database access tests and the lecturer code script. |
| `docs/` | Architecture, marking design, and the owner's handwritten test pages (`docs/img`). |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): components, data, flows and security.
- [docs/MARKING.md](docs/MARKING.md): how the AI marks, the output format and test cases.

## For lecturers

1. The owner sets a simple lecturer code (at least 6 characters): put `LECTURER_CODE=...` in `.env`, then run `node --env-file=.env scripts/set-lecturer-code.mjs`. Share the code only with lecturers.
2. The lecturer signs in, taps **Lecturer** (bottom left) and gives the code. Five wrong tries lock that person for an hour.
3. Add a book: the course code (like `UECM2353`), the exam (like `2023 May`), and the solutions as text (`Q1: ...`, `Q2: ...`) or one picture.
4. Students match it when their course is named by that code and their note is named like the exam ("May 2023" and "2023 may" match). They type nothing extra.
5. **Change** replaces the solutions. **Withdraw** stops students getting the book.

Limits: every signed-in student can read a book. A lecturer's book wins over a student's own correct answer. Students are not told when a book changes after they marked. Check the school's rules on sharing solutions first (not checked).

## Setup

You need [Node.js](https://nodejs.org) (a recent version; the exact minimum is not checked), git, a free [Supabase](https://supabase.com) project and a free key from [Google AI Studio](https://aistudio.google.com).

**1. Install**

```bash
git clone https://github.com/lloonnn/skrrMath.git
cd skrrMath
npm install
cp .env.example .env
```

**2. Fill in `.env`.** Open it and paste:
- From Supabase (Project settings, API): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The service role key is secret: never share it. `.env` is never committed.
- From Google AI Studio: `GEMINI_API_KEY`, and `GEMINI_MODEL` (a current Gemini model name).

**3. Set up the database.** In Supabase, open the SQL editor, paste the whole of `supabase/setup.sql`, and press Run. Then open Authentication, URL configuration, and add `http://localhost:5173` to the redirect URLs.

**4. Run**

```bash
npm run dev
```

Open `http://localhost:5173` and sign in. On a tablet on the same Wi-Fi, open `http://<your computer's address>:5173`.

### Updating

Only if a new file appears in `supabase/migrations/` after you set up: do not paste `setup.sql` again. Paste only the new files, in number order, into the Supabase SQL editor. For example, if you last ran `0007`, paste `0008`, then `0009`.

### Optional

**Try it without an AI key.** In `.env` set `MARK_MODE=demo`. Mark then shows a saved example and calls no AI.

**Lecturers.** In `.env` set `LECTURER_CODE=` to any code of 6 or more characters, then run:

```bash
node --env-file=.env scripts/set-lecturer-code.mjs
```

**Checks.**

```bash
(cd shared && npm test)
(cd marking-service && npm test)
(cd web && npm run build)
node --env-file=.env scripts/rls-test.mjs
node --env-file=.env scripts/bank-rls-test.mjs
```

The last two test the database access rules with temporary accounts, which they delete. The scripts in `e2e/` drive a real browser, are off by default, and explain themselves in their first lines.

Limits: this setup was written from how the project was built here and has not been tried on a clean machine. `supabase/setup.sql` has not been run on a new Supabase project (the same files ran one by one on the owner's). Supabase may ask you to confirm sign-up emails. On a tablet over plain `http`, Chrome warns when downloading the PDF.

## Known risks

- Reading messy handwriting is the largest technical risk.
- The AI can mark correct work as wrong when the steps differ from the reference.
- Similar tools exist. Goodnotes Math Assist reads handwritten maths, and apps such as AusGrader mark handwritten papers. The difference here is marking inside the note, per paper, against a verified answer.
- Storing the school's past papers on a server may breach the school's terms. This has not been checked.
- Free-tier limits for Supabase and the AI have not been checked.
