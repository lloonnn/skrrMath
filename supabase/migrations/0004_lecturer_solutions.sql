-- Phase 2 of docs/LECTURER-PLAN.md: roles, the lecturer code, and the shared lecturer solutions.
-- Test it with three or more accounts: scripts/bank-rls-test.mjs.
--
-- How it works:
-- * Everyone is a student. A person becomes a lecturer by giving the lecturer code (claim_lecturer).
--   The code is kept in .env as LECTURER_CODE and stored here only as a salted hash.
-- * The app can never write a role. Only claim_lecturer and the service role can.
-- * Lecturer solutions are readable by every signed-in user (decision D4) and writable only by
--   lecturers, and a lecturer can change only their own. There is no delete: a solution is withdrawn.

-- Roles ----------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'lecturer')),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
-- You can read your own row. Nothing in the app can insert, change or delete a profile.
create policy profiles_read_own on profiles for select to authenticated using (id = auth.uid());
revoke all on profiles from anon, authenticated;
grant select on profiles to authenticated;

-- True when the caller is a lecturer. A missing profile means student.
create function is_lecturer() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'lecturer')
$$;
revoke all on function is_lecturer() from public, anon;
grant execute on function is_lecturer() to authenticated;

-- The lecturer code ------------------------------------------------------------

-- Holds the hash of the code. No policies and no grants: only the functions below can reach it.
create table app_secrets (
  name text primary key,
  value text not null
);
alter table app_secrets enable row level security;
revoke all on app_secrets from anon, authenticated;

-- Every try at the code, so a wrong code cannot be guessed over and over.
create table lecturer_claim_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  ok boolean not null
);
create index on lecturer_claim_attempts (user_id, at);
alter table lecturer_claim_attempts enable row level security;
revoke all on lecturer_claim_attempts from anon, authenticated;

-- Stores the code (as a salted bcrypt hash). Only the service role can call it, from
-- scripts/set-lecturer-code.mjs. The code needs at least 12 characters.
create function set_lecturer_code(code text) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if code is null or char_length(code) < 12 then
    raise exception 'the lecturer code must have at least 12 characters';
  end if;
  insert into app_secrets (name, value) values ('lecturer_code_hash', crypt(code, gen_salt('bf')))
  on conflict (name) do update set value = excluded.value;
end $$;
revoke all on function set_lecturer_code(text) from public, anon, authenticated;
grant execute on function set_lecturer_code(text) to service_role;

-- A signed-in person gives the code. Returns 'lecturer', 'wrong_code', 'locked' or 'not_set'.
-- It returns a word instead of raising an error, because an error would also undo the
-- record of the wrong try. Five wrong tries in an hour lock it for that person for an hour.
create function claim_lecturer(code text) returns text
  language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  stored text;
  wrong int;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  select count(*) into wrong from lecturer_claim_attempts
    where user_id = uid and ok = false and at > now() - interval '1 hour';
  if wrong >= 5 then
    return 'locked';
  end if;
  select value into stored from app_secrets where name = 'lecturer_code_hash';
  if stored is null then
    return 'not_set';
  end if;
  if code is null or crypt(code, stored) <> stored then
    insert into lecturer_claim_attempts (user_id, ok) values (uid, false);
    return 'wrong_code';
  end if;
  insert into lecturer_claim_attempts (user_id, ok) values (uid, true);
  insert into profiles (id, role) values (uid, 'lecturer')
  on conflict (id) do update set role = 'lecturer';
  return 'lecturer';
end $$;
revoke all on function claim_lecturer(text) from public, anon;
grant execute on function claim_lecturer(text) to authenticated;

-- The shared lecturer solutions --------------------------------------------------

-- The key is the cleaned course code, exam and question label (see shared/src/question-key.ts).
-- The checks below only make sure it has that cleaned shape. The app does the cleaning.
-- A solution is text or a picture of the solution only, never a paper or a question image.
create table bank_solutions (
  id uuid primary key default gen_random_uuid(),
  course_code text not null check (course_code ~ '^[A-Z]{1,8}[0-9]{1,5}[A-Z]?$'),
  exam text not null check (exam = lower(exam) and exam = btrim(exam) and char_length(exam) between 1 and 80),
  question text not null check (question = lower(question) and question !~ '\s' and char_length(question) between 1 and 20),
  answer_text text check (char_length(answer_text) <= 5000),
  answer_image text check (char_length(answer_image) <= 2500000),
  answer_image_type text check (answer_image_type in ('image/jpeg', 'image/png', 'image/webp')),
  lecturer uuid not null default auth.uid() references auth.users (id) on delete cascade,
  version int not null default 1,
  withdrawn boolean not null default false,
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Exactly one of: typed text, or a picture (with its type).
  check ((coalesce(btrim(answer_text), '') <> '') <> (answer_image is not null)),
  check (answer_image is null or answer_image_type is not null)
);

-- One live solution per key. A lecturer who wants to replace someone else's must wait for it
-- to be withdrawn.
create unique index bank_one_live_solution on bank_solutions (course_code, exam, question)
  where not withdrawn;
create index on bank_solutions (lecturer);

-- The key and the author never change. Each change adds one to the version, so a student's
-- saved marking can tell that the solution was updated after it.
create function bank_solutions_guard() returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.lecturer <> old.lecturer or new.course_code <> old.course_code
     or new.exam <> old.exam or new.question <> old.question then
    raise exception 'the key and the author of a solution cannot be changed';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  if not new.withdrawn then
    new.verified_at := now();
  end if;
  return new;
end $$;
create trigger bank_solutions_guard before update on bank_solutions
  for each row execute function bank_solutions_guard();

alter table bank_solutions enable row level security;

-- Every signed-in user reads the live solutions. A lecturer also sees their own withdrawn ones.
create policy bank_read on bank_solutions for select to authenticated
  using (not withdrawn or lecturer = auth.uid());
-- Only a lecturer adds, only as themselves, and only a live one.
create policy bank_insert on bank_solutions for insert to authenticated
  with check (lecturer = auth.uid() and is_lecturer() and not withdrawn);
-- Only the author, and only while they are still a lecturer.
create policy bank_update on bank_solutions for update to authenticated
  using (lecturer = auth.uid() and is_lecturer())
  with check (lecturer = auth.uid() and is_lecturer());
-- No delete policy on purpose: a solution is withdrawn, not deleted.

revoke all on bank_solutions from anon;
revoke delete on bank_solutions from authenticated;
grant select, insert, update on bank_solutions to authenticated;
