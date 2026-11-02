-- Private per-user tables for the MVP. Every table has row-level security.
-- The owner can do everything with their own rows and nothing with anyone else's.
-- Test with two accounts: scripts/rls-test.mjs.
-- Names are free text (the app allows "Calculus II", "2023/24", "Semester 1").

create extension if not exists "pgcrypto";

create table courses (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table years (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  created_at timestamptz not null default now()
);

-- A paper is one note canvas. file_path is for an imported PDF later.
create table papers (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year_id uuid not null references years (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  file_path text,
  created_at timestamptz not null default now()
);

-- The canvas for a paper. Strokes are stored as data, not typed text.
create table pages (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  paper_id uuid not null references papers (id) on delete cascade,
  page_index int not null default 0,
  strokes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (paper_id, page_index)
);

create table question_blocks (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page_id uuid not null references pages (id) on delete cascade,
  question_no text,
  x real, y real, w real, h real,
  question_image_path text,
  own_reference jsonb,
  created_at timestamptz not null default now()
);

create table markings (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  block_id uuid not null references question_blocks (id) on delete cascade,
  status text not null check (status in ('marked', 'unsure', 'unreadable')),
  reference_source text not null check (reference_source in ('verified_bank', 'verified_user', 'ai_solved')),
  result jsonb not null,
  model text,
  created_at timestamptz not null default now()
);

create index on years (course_id);
create index on papers (year_id);
create index on question_blocks (page_id);
create index on markings (block_id);

-- Latest save wins: stamp every change.
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger pages_updated before update on pages for each row execute function set_updated_at();

-- Access rules --------------------------------------------------------------

alter table courses enable row level security;
alter table years enable row level security;
alter table papers enable row level security;
alter table pages enable row level security;
alter table question_blocks enable row level security;
alter table markings enable row level security;

-- Each row must belong to the caller, and its parent must belong to the caller too.
-- Without the parent check, a user could hang a row on someone else's course.
create policy courses_owner on courses for all
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy years_owner on years for all
  using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from courses c where c.id = course_id and c.owner = auth.uid()));

create policy papers_owner on papers for all
  using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from years y where y.id = year_id and y.owner = auth.uid()));

create policy pages_owner on pages for all
  using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from papers p where p.id = paper_id and p.owner = auth.uid()));

create policy blocks_owner on question_blocks for all
  using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from pages g where g.id = page_id and g.owner = auth.uid()));

create policy markings_owner on markings for all
  using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from question_blocks b where b.id = block_id and b.owner = auth.uid()));

-- Signed-out visitors get nothing. Only signed-in users may touch the tables.
revoke all on courses, years, papers, pages, question_blocks, markings from anon;
grant select, insert, update, delete on courses, years, papers, pages, question_blocks, markings to authenticated;
