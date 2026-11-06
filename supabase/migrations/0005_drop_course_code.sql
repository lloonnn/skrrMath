-- Removes the course_code column added in 0003. The owner asked to remove the course code and the
-- question label from the app (too many things to type), so nothing uses the column.
-- The course name is used as the course part of a key when the name looks like a code.
alter table courses drop column course_code;
