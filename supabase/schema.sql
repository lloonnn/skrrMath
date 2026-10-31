-- DRAFT. Not applied. Not tested. Review every policy and test with two accounts before use.
-- Names and columns may change.

create extension if not exists "pgcrypto";

-- Private per-user data ------------------------------------------------------

create table papers (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  title text not null,
  course_code text,
  exam_year int,
  file_path text,                 -- path in private storage, under the owner's id
  created_at timestamptz not null default now()
);

create table pages (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  paper_id uuid references papers (id) on delete cascade,  -- null for a blank note
  page_index int not null default 0,
  strokes jsonb not null default '{}'::jsonb,              -- canvas data
  updated_at timestamptz not null default now()
);

create table question_blocks (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  page_id uuid not null references pages (id) on delete cascade,
  course_code text,
  exam_year int,
  question_no text,
  x real, y real, w real, h real,                           -- block box on the page
  question_image_path text,                                 -- private storage
  own_reference jsonb,                                      -- user's verified answer (text, image path or strokes)
  created_at timestamptz not null default now()
);

create table markings (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  block_id uuid not null references question_blocks (id) on delete cascade,
  status text not null check (status in ('marked', 'unsure', 'unreadable')),
  reference_source text not null check (reference_source in ('verified_bank', 'verified_user', 'ai_solved')),
  result jsonb not null,                                    -- see docs/MARKING.md
  model text,
  created_at timestamptz not null default now()
);

-- Shared bank (stage two). Tags and answers only. No paper images. ------------

create table bank_answers (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  exam_year int not null,
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

-- Access rules ----------------------------------------------------------------

alter table papers enable row level security;
alter table pages enable row level security;
alter table question_blocks enable row level security;
alter table markings enable row level security;
alter table bank_answers enable row level security;
alter table bank_confirmations enable row level security;
alter table bank_reports enable row level security;

-- Private tables: the owner can do everything with their own rows.
create policy papers_owner on papers for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy pages_owner on pages for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy blocks_owner on question_blocks for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy markings_owner on markings for all using (owner = auth.uid()) with check (owner = auth.uid());

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
