-- DRAFT of the shared bank (stage two). NOT applied.
-- The lecturer solutions (option A in docs/LECTURER-PLAN.md) are built and applied, as bank_solutions,
-- in supabase/migrations/0004_lecturer_solutions.sql. The tables below are for student answers,
-- confirmations and reports, which are not part of option A.
-- The private tables (courses, years, papers, pages, question_blocks, markings) moved to
-- supabase/migrations/0001_private_tables.sql, which is applied.
-- Problem to solve before the bank is built: names are now free text, so two students may
-- write "Calculus II" and "MATH201" for one course. Bank lookups need a shared course code.

create extension if not exists "pgcrypto";

-- Shared bank (stage two). Tags and answers only. No paper images. ------------

create table bank_answers (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  exam_year text not null,
  question_no text not null,
  answer_text text,
  answer_image_path text,                                   -- the answer only, not the paper
  added_by uuid not null references auth.users (id) on delete cascade,
  trust_level text not null default 'student' check (trust_level in ('student', 'confirmed', 'tutor')),
  created_at timestamptz not null default now(),
  check (answer_text is not null or answer_image_path is not null)
);
create index bank_lookup on bank_answers (course_code, exam_year, question_no);

create table bank_confirmations (
  answer_id uuid not null references bank_answers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);

create table bank_reports (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references bank_answers (id) on delete cascade,
  reporter uuid not null references auth.users (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

-- Access rules (draft) ---------------------------------------------

alter table bank_answers enable row level security;
alter table bank_confirmations enable row level security;
alter table bank_reports enable row level security;


-- Bank: any signed-in user reads. Only the author adds, edits or deletes their own answer.
create policy bank_read on bank_answers for select using (auth.uid() is not null);
-- A new answer always starts at 'student'. Clients cannot set a higher trust level.
create policy bank_insert on bank_answers for insert with check (added_by = auth.uid() and trust_level = 'student');
-- No client update policy on purpose: an update could change trust_level. To edit an answer, delete it and add a new one,
-- or change it through a server function that uses the service role.
create policy bank_delete on bank_answers for delete using (added_by = auth.uid());

-- Confirmations: read all, add or remove only your own. Do not let an author confirm their own answer (enforce in app or a trigger).
create policy conf_read on bank_confirmations for select using (auth.uid() is not null);
create policy conf_insert on bank_confirmations for insert with check (user_id = auth.uid());
create policy conf_delete on bank_confirmations for delete using (user_id = auth.uid());

-- Reports: you can add and see your own. Admin review is done with the service role, outside the app.
create policy reports_insert on bank_reports for insert with check (reporter = auth.uid());
create policy reports_read_own on bank_reports for select using (reporter = auth.uid());

-- Still to do:
-- * trust_level changes (student -> confirmed) should come from a trigger or a server function, not from the client.
-- * storage bucket policies: private bucket, path prefix = auth.uid().
-- * a tutor role and how it is approved.
-- * copyright and school terms on stored papers.
