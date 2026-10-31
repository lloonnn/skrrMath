# skrrMath

A note-taking app for practising past-year exam papers by hand. You write your answer under a question, press "mark", and the AI marks it on the page like a teacher with a red pen. You never upload to a chatbot and scroll back to find the correction.

Status: planning. No code yet. Every tech choice below is proposed, not final.

## The problem

When I am preparing for final exams, I do past-year papers, then screenshot them or export them to PDF and send them to an AI to check my answers. The chat gets very long and I need to scroll back to find the corrected answer.

## What it is

- A web app with a basic note canvas: pen, text box, eraser, undo, zoom and scroll.
- Papers come from the school portal. You import a PDF, or paste a cropped screenshot of one question.
- Each question becomes a **question block**. You write your answer below it by hand.
- A **mark** button sends the block and your answer to the AI. The correction appears in the margin of your page, in red pen. It is saved with that paper.
- Every mark carries an honest label. "Not verified" means the AI marked from its own reasoning. A verified answer, if one exists, is used instead and the label changes.
- Each question has a **verified-answer area** where you can handwrite, paste an image, or type the correct answer.
- Export the marked paper as a PDF.
- Notes sync between a tablet and a laptop.
- Stage two: a **shared course bank** of verified answers, keyed by course code, exam year and question number.

Subject for the first version: math (working steps and proofs). Handwritten code and theory questions come later.

## What it is not

- Not a general chatbot.
- Not a full Notability or GoodNotes clone. No shapes, lasso, handwriting-to-text, folders or templates.
- Not a source of official grades. The footer says it is a study aid.

## Proposed stack

| Part | Proposed |
|---|---|
| App | React and TypeScript web app |
| Canvas | An existing library (tldraw or Excalidraw, not chosen, check licences) |
| PDF import | pdf.js |
| PDF export | Render pages to images, build with jsPDF or pdf-lib |
| Maths in comments | KaTeX |
| AI | Gemini (a Flash-class model first), kept as one setting |
| AI access | Replit AI Integrations if they work on the account, else a Google AI Studio key |
| Sign-in, database, files | Supabase |
| Hosting | Replit, or Vercel (note: Replit credits probably do not pay for AI calls from Vercel) |

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): parts, data, flows, security.
- [docs/MARKING.md](docs/MARKING.md): how the AI marks, the output format, test cases.
- [docs/PLAN.md](docs/PLAN.md): the 8-day plan, the cut line, tests to run first.
- [supabase/schema.sql](supabase/schema.sql): draft database tables and access rules. Not applied, not tested.
- [CLAUDE.md](CLAUDE.md): rules for AI coding helpers working in this repo.

## Setup

Not written yet. It will be added once the project is scaffolded.

1. Copy `.env.example` to `.env` and fill in the values.
2. Install and run commands: to be decided.

## Known risks

- Reading messy handwriting is the biggest technical risk.
- The AI can mark correct work wrong when the steps differ from the reference.
- Overlap: Goodnotes Math Assist and apps such as AusGrader already read or mark handwritten work. The difference here is marking inside the note, per paper, with a verified answer.
- Storing the school's past papers on a server may break the school's terms. Not checked.
- Free-tier limits for Supabase and the AI are not checked.

## Origin

This came from a hackathon brief (GDG APU, Domain 2) that the author turned out not to be eligible for, so it continues as a personal project. Notes live in a separate knowledge-base repo.
