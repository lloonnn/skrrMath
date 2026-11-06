-- Option C (docs/LECTURER-PLAN.md): one answer book per paper, not one solution per question.
-- The key is now only the course code and the exam. The AI finds the question inside the book.
-- Safe only while bank_solutions is empty (it is: nothing could write to it from the app yet).

drop index bank_one_live_solution;
alter table bank_solutions drop column question;

-- A whole paper's solutions are longer than one question's.
alter table bank_solutions drop constraint bank_solutions_answer_text_check;
alter table bank_solutions add constraint bank_solutions_answer_text_check
  check (char_length(answer_text) <= 30000);

-- One live book per paper. To replace someone else's, they must withdraw it first.
create unique index bank_one_live_book on bank_solutions (course_code, exam) where not withdrawn;

create or replace function bank_solutions_guard() returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.lecturer <> old.lecturer or new.course_code <> old.course_code
     or new.exam <> old.exam then
    raise exception 'the paper and the author of a book cannot be changed';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  if not new.withdrawn then
    new.verified_at := now();
  end if;
  return new;
end $$;
