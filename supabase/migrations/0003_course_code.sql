-- A course code for finding questions again (see docs/LECTURER-PLAN.md, phase 1).
-- "name" stays the name shown in the list. "course_code" is optional and is only set when the
-- person set it by hand. The app works out the rest from the name when the name looks like a code.
-- No new access rule is needed: the existing courses_owner policy already covers every column.

alter table courses
  add column course_code text
  check (course_code is null or char_length(course_code) between 2 and 20);
