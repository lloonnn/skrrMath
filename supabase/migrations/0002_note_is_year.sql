-- The paper level is gone. A year is the note, so a page belongs to a year.
-- Safe only while pages is empty (adding a NOT NULL column fails otherwise, and the
-- migration rolls back). Written when the dev project held no real data.

drop policy pages_owner on pages;
drop table papers cascade;                 -- also removes pages.paper_id's foreign key
alter table pages drop column paper_id;    -- and its unique (paper_id, page_index)

alter table pages add column year_id uuid not null references years (id) on delete cascade;
alter table pages add constraint pages_year_page unique (year_id, page_index);
create index on pages (year_id);

create policy pages_owner on pages for all
  using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from years y where y.id = year_id and y.owner = auth.uid()));
