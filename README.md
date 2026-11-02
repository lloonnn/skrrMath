# skrrMath

A note-taking web app for practising past-year exam papers by hand, with AI marking on the page.

Status: planning, with a first scaffold. `web/` has the app shell with the sidebar only. Built with Claude Code. Every technical choice below is proposed, not final.

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

First version (MVP):

- A basic note canvas with a pen, text box, eraser, undo, zoom and scroll.
- Import of a past-year paper as a PDF, or a pasted cropped screenshot of a single question.
- Question blocks. Each question is a block, tagged with course code, exam year and question number, and the student writes the answer below it.
- Marking in the margin, in red pen. The AI finds the first error, names the type of mistake, and marks later lines that follow from it as such. It also says whether the method was right.
- A marking layer that can be hidden, so the student can redo a question.
- A "what it read" view that shows how the AI transcribed the handwriting, so a misreading can be corrected.
- A verified-answer area for each question, where the student can handwrite, paste an image or type the correct answer. Marking then uses it.
- Export of the marked paper as a PDF.
- Sign-in and cloud sync, so notes are the same on a tablet and a laptop.

Second stage (planned, cut first if time runs short):

- A shared course bank of verified answers, keyed by course code, exam year and question number. An answer is checked once and then reused by the whole course, with a trust level shown for each answer.

The first subject is mathematics (worked steps and proofs). Handwritten code and theory questions come later.

## Not included

- A general chatbot.
- A full note-app toolset such as shapes, lasso selection, handwriting-to-text, folders and templates.
- Official grades. Marks are for practice only.

## Proposed stack

| Part | Proposed |
|---|---|
| App | React and TypeScript web app |
| Interface components | shadcn/ui, light mode. The left sidebar starts from the `sidebar-08` block, adapted to a course, year and paper tree. App name: skrrMath. |
| Canvas | An existing library (Excalidraw, MIT licence) |
| PDF import | pdf.js |
| PDF export | Render pages to images, then build with jsPDF or pdf-lib |
| Maths in comments | KaTeX |
| AI model | Gemini (a Flash-class model first), kept as one setting |
| Model access | A small marking service with three modes. The hosted prototype runs in demo mode and returns saved example results, with no AI call. Real use needs the user's own key. In real use it calls Gemini with a Google AI Studio key, so anyone can run it. The owner can switch it to Replit AI Integrations (billed to Replit credits) on their own Replit app. |
| Sign-in, database, files | Supabase |
| App hosting | Not decided |

Claude Code builds the project. A hosted prototype shows example results only, and real marking requires your own Gemini API key. Replit is an optional way for the owner to run the model API. The project does not require Replit.

## Repository structure

The folders exist. Only `web/` has code so far, the sidebar. The folders also hold short local README files for the coding assistant. They are not tracked in git, so they do not appear in a clone.

| Folder | Purpose |
|---|---|
| `web/` | The browser app: React, TypeScript, Vite, shadcn/ui. Features are split by folder under `src/features`. |
| `marking-service/` | The small server with one endpoint, `POST /api/mark`, and the `demo`, `google` and `replit` model modes. |
| `shared/` | The marking result shape and validation, used by both `web` and `marking-service`. |
| `fixtures/` | Made-up or own-work test and demo data. No school paper content. |
| `supabase/` | The draft schema and database migrations. |
| `e2e/` | Browser tests that cover the app and the service together. |
| `scripts/` | Helper scripts. |
| `docs/` | Architecture, marking design, plan, test log and the interface mockup. |

```
skrrMath/
├── README.md
├── CLAUDE.md
├── .env.example
├── .gitignore
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MARKING.md
│   ├── PLAN.md
│   ├── TEST-LOG.md
│   ├── img/                  # handwritten test pages
│   └── mockup/
│       └── index.html
├── web/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── features/
│           ├── papers/
│           ├── canvas/
│           ├── blocks/
│           ├── marking/
│           ├── reference/
│           ├── export/
│           └── bank/
├── marking-service/
│   └── src/
│       ├── providers/
│       ├── pipeline/
│       └── middleware/
├── shared/
│   └── src/
├── fixtures/
│   ├── marking/
│   ├── images/
│   └── pdf/
├── supabase/
│   ├── schema.sql
│   └── migrations/
├── e2e/
└── scripts/
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): components, data, flows and security.
- [docs/MARKING.md](docs/MARKING.md): how the AI marks, the output format and test cases.
- [docs/PLAN.md](docs/PLAN.md): the 8-day plan with automated and manual tests for each day, and the cut line.
- [docs/TEST-LOG.md](docs/TEST-LOG.md): where manual test results are recorded.
- [docs/mockup/index.html](docs/mockup/index.html): a static mockup of the proposed interface. Open it in a browser.
- [supabase/schema.sql](supabase/schema.sql): draft database tables and access rules. Not applied, not tested.
- [CLAUDE.md](CLAUDE.md): rules for the AI coding assistant working in this repository.

## Setup

Not written yet. It will be added when the project is scaffolded.

1. Copy `.env.example` to `.env` and fill in the values.
2. Install and run commands: to be decided.

## Known risks

- Reading messy handwriting is the largest technical risk.
- The AI can mark correct work as wrong when the steps differ from the reference.
- Similar tools exist. Goodnotes Math Assist reads handwritten maths, and apps such as AusGrader mark handwritten papers. The difference here is marking inside the note, per paper, against a verified answer.
- Storing the school's past papers on a server may breach the school's terms. This has not been checked.
- Free-tier limits for Supabase and the AI have not been checked.
